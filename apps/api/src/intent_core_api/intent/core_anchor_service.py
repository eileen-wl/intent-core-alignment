"""CoreAnchor / CoreAnchorRevision lifecycle: draft, update, confirm, reject.

Concurrency strategy (see the approved WP-A implementation plan and the
WP-A2 concurrency addendum):

- ``get_or_create_core_anchor`` and ``create_draft_revision`` rely on
  database UNIQUE constraints (``core_anchors.shot_id``,
  ``UNIQUE(core_anchor_id, revision_number)``) as the correctness backstop;
  a losing concurrent insert raises ``IntegrityError``, which is caught,
  the session is rolled back (restoring it to a usable state), and either
  the winning row is re-fetched (get-or-create) or a 409 ``ConflictError``
  is raised to the client (revision-number race).
- ``confirm_revision`` takes a ``SELECT ... FOR UPDATE`` lock on the
  CoreAnchor row on dialects that support it (a no-op on SQLite) for
  read-then-decide confidence, but the actual, dialect-portable commit
  gate is ``core_anchor_lock.compare_and_swap_active_revision`` -- a
  conditional ``UPDATE``, not a ``SELECT``, because a ``SELECT`` (even a
  bare-scalar one) is not guaranteed to observe another transaction's
  newly committed value under SQLite/PostgreSQL snapshot isolation. The
  CAS is always the *first mutating operation* in this function -- called
  before any other write -- and this same primitive, unmodified, is also
  used by ``execution_anchor_service.create_draft_revision`` and
  ``execution_anchor_service.confirm_revision`` (the global lock order is
  CoreAnchor -> ExecutionAnchor -> revisions/lineage throughout).
- Every mutating function performs all of its writes on one session and
  commits exactly once at the end; any ``IntegrityError`` at that commit
  (or at an earlier ``record_*()`` flush within the same try block) is
  caught, the session is rolled back, and a ``ConflictError`` (-> 409) is
  raised -- since nothing was ever committed, no partial Decision/
  WorkflowTransition/AuditEvent/status/pointer writes become visible to
  any other transaction. This also covers the stale cascade
  (``execution_anchor_service.mark_stale_for_new_core_revision``), which
  runs inside this same transaction and never commits independently.
- Two internal-consistency invariants (a superseded/confirmed revision
  actually belonging to the anchor being mutated) are checked explicitly
  and raise ``InternalConsistencyError`` rather than relying on a bare
  ``assert`` -- assertions can be stripped under ``python -O``, which must
  never silently disable a data-integrity check. ``InternalConsistencyError``
  is not mapped to any HTTP exception handler and must never become a
  user-facing 4xx response; it indicates a bug or data corruption, not an
  invalid request.
"""

from __future__ import annotations

import uuid
from collections.abc import Mapping, Sequence
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from intent_core_api.audit import service as audit_service
from intent_core_api.intent import execution_anchor_service
from intent_core_api.intent.core_anchor_lock import compare_and_swap_active_revision
from intent_core_api.intent.models import (
    AnchorReference,
    Constraint,
    CoreAnchor,
    CoreAnchorRevision,
    DriftRisk,
    OpenQuestion,
    VariationZone,
)
from intent_core_api.production_context.models import Shot
from intent_core_api.workflow import decision_service, transition_service
from intent_core_api.workflow.actors import (
    ActorContext,
    AgentType,
    require_can_confirm_or_reject,
    require_can_draft,
    require_can_update_draft,
)
from intent_core_api.workflow.exceptions import (
    ConflictError,
    InternalConsistencyError,
    NotFoundError,
)


def _utcnow() -> datetime:
    return datetime.now(UTC)


CORE_ANCHOR_CONTENT_FIELDS = (
    "shot_objective",
    "emotional_tone",
    "visual_focus",
    "rhythm_intensity",
    "character_relationship",
    "narrative_priority",
    "core_summary",
)

_DRAFT_CREATE_AGENT_TYPES: frozenset[AgentType] = frozenset({"core_agent"})

# Step 1A: the five Core Anchor semantic-child collections. Each tuple is
# (contract/relationship field name, ORM model, content field names) --
# the relationship attribute name on CoreAnchorRevision is deliberately
# identical to the contract field name for all five (see intent/models.py
# CoreAnchorRevision.references) so this one table drives both the
# replace helper below and the eager-load options.
_SEMANTIC_COLLECTIONS: tuple[tuple[str, type[Any], tuple[str, ...]], ...] = (
    ("constraints", Constraint, ("content",)),
    ("variation_zones", VariationZone, ("content",)),
    ("drift_risks", DriftRisk, ("description",)),
    ("references", AnchorReference, ("label", "uri", "note")),
    ("open_questions", OpenQuestion, ("question",)),
)

_SEMANTIC_RELATIONSHIP_LOAD_OPTIONS = (
    selectinload(CoreAnchorRevision.constraints),
    selectinload(CoreAnchorRevision.variation_zones),
    selectinload(CoreAnchorRevision.drift_risks),
    selectinload(CoreAnchorRevision.references),
    selectinload(CoreAnchorRevision.open_questions),
)


def _normalize_orm_rows_for_audit(
    rows: Sequence[Any], content_fields: tuple[str, ...]
) -> list[Any]:
    if len(content_fields) == 1:
        field = content_fields[0]
        return [getattr(row, field) for row in rows]
    return [{field: getattr(row, field) for field in content_fields} for row in rows]


def _normalize_dict_items_for_audit(
    items: Sequence[Mapping[str, Any]], content_fields: tuple[str, ...]
) -> list[Any]:
    if len(content_fields) == 1:
        field = content_fields[0]
        return [item[field] for item in items]
    return [{field: item[field] for field in content_fields} for item in items]


async def _replace_semantic_collection(
    session: AsyncSession,
    revision_id: uuid.UUID,
    model_cls: type[Any],
    new_items: Sequence[Mapping[str, Any]],
    content_fields: tuple[str, ...],
) -> tuple[list[Any], list[Any]]:
    """Delete-then-insert a single semantic-child collection for one
    revision, in the caller's existing transaction (no commit here).
    Returns ``(before, after)`` normalized content for the audit diff --
    the caller decides whether to actually record it.
    """
    existing_result = await session.execute(
        select(model_cls)
        .where(model_cls.core_anchor_revision_id == revision_id)
        .order_by(model_cls.order_index)
    )
    existing_rows = list(existing_result.scalars().all())
    before = _normalize_orm_rows_for_audit(existing_rows, content_fields)

    for row in existing_rows:
        await session.delete(row)

    for index, item in enumerate(new_items):
        session.add(
            model_cls(
                core_anchor_revision_id=revision_id,
                order_index=index,
                **{field: item[field] for field in content_fields},
            )
        )

    after = _normalize_dict_items_for_audit(new_items, content_fields)
    return before, after


async def _replace_semantic_collections_for_create(
    session: AsyncSession, revision_id: uuid.UUID, content: Mapping[str, Any]
) -> None:
    """Draft creation: every collection is written from scratch (there is
    nothing to diff against and, matching the existing convention that
    the 7 scalar content fields are not audited on creation either, no
    audit event is recorded here).
    """
    for field_name, model_cls, content_fields in _SEMANTIC_COLLECTIONS:
        await _replace_semantic_collection(
            session, revision_id, model_cls, content.get(field_name) or [], content_fields
        )


async def _replace_semantic_collections_for_update(
    session: AsyncSession, revision_id: uuid.UUID, changes: Mapping[str, Any]
) -> dict[str, dict[str, list[Any]]]:
    """Draft update: only collections present in ``changes`` are touched
    (omitted means unchanged); each replaced collection contributes a
    before/after entry the caller merges into its audit diff.
    """
    diff: dict[str, dict[str, list[Any]]] = {}
    for field_name, model_cls, content_fields in _SEMANTIC_COLLECTIONS:
        if field_name not in changes:
            continue
        before, after = await _replace_semantic_collection(
            session, revision_id, model_cls, changes[field_name] or [], content_fields
        )
        diff[field_name] = {"before": before, "after": after}
    return diff


async def _get_revision_with_semantic_children(
    session: AsyncSession, revision_id: uuid.UUID
) -> CoreAnchorRevision:
    # `populate_existing=True` is required, not cosmetic: this is always
    # called after a mutation on a revision that may already be sitting
    # in this session's identity map with its (now stale) semantic
    # collections eager-loaded from an earlier `session.get()` in the
    # same function -- without it SQLAlchemy would silently keep serving
    # those cached collections instead of the rows just written. Same
    # pitfall `confirm_revision` already documents for `anchor`.
    revision = await session.scalar(
        select(CoreAnchorRevision)
        .where(CoreAnchorRevision.id == revision_id)
        .options(*_SEMANTIC_RELATIONSHIP_LOAD_OPTIONS)
        .execution_options(populate_existing=True)
    )
    if revision is None:
        raise InternalConsistencyError(
            f"CoreAnchorRevision {revision_id} vanished immediately after being persisted"
        )
    return revision


async def get_or_create_core_anchor(session: AsyncSession, shot_id: uuid.UUID) -> CoreAnchor:
    existing: CoreAnchor | None = await session.scalar(
        select(CoreAnchor).where(CoreAnchor.shot_id == shot_id)
    )
    if existing is not None:
        return existing

    anchor = CoreAnchor(shot_id=shot_id)
    session.add(anchor)
    try:
        await session.flush()
    except IntegrityError:
        await session.rollback()
        existing = await session.scalar(select(CoreAnchor).where(CoreAnchor.shot_id == shot_id))
        if existing is None:
            raise
        return existing
    return anchor


async def _next_revision_number(session: AsyncSession, core_anchor_id: uuid.UUID) -> int:
    max_number = await session.scalar(
        select(func.coalesce(func.max(CoreAnchorRevision.revision_number), 0)).where(
            CoreAnchorRevision.core_anchor_id == core_anchor_id
        )
    )
    return int(max_number or 0) + 1


async def create_draft_revision(
    session: AsyncSession,
    actor: ActorContext,
    shot_id: uuid.UUID,
    content: dict[str, Any],
    *,
    context_snapshot_id: uuid.UUID | None = None,
    source_intent_decomposition_id: uuid.UUID | None = None,
) -> CoreAnchorRevision:
    require_can_draft(actor, "vfx_supervisor", allowed_agent_types=_DRAFT_CREATE_AGENT_TYPES)

    shot = await session.get(Shot, shot_id)
    if shot is None:
        raise NotFoundError("Shot not found")

    anchor = await get_or_create_core_anchor(session, shot_id)
    revision_number = await _next_revision_number(session, anchor.id)

    revision = CoreAnchorRevision(
        core_anchor_id=anchor.id,
        revision_number=revision_number,
        status="draft",
        created_by_actor_kind=actor.actor_kind,
        created_by_actor_id=actor.actor_id,
        created_by_human_role=actor.human_role,
        created_by_agent_type=actor.agent_type,
        created_by_agent_run_id=actor.agent_run_id,
        context_snapshot_id=context_snapshot_id,
        source_intent_decomposition_id=source_intent_decomposition_id,
        **{field: content.get(field) for field in CORE_ANCHOR_CONTENT_FIELDS},
    )
    session.add(revision)
    try:
        # Flush (not just add) before inserting semantic children: the
        # revision's client-side uuid4() default is only materialized
        # into `revision.id` once the flush runs, and the children's hard
        # FK needs a real id -- see intent/README.md.
        await session.flush()
        await _replace_semantic_collections_for_create(session, revision.id, content)
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise ConflictError(
            "A draft was created concurrently for this anchor; retry the request"
        ) from None
    return await _get_revision_with_semantic_children(session, revision.id)


async def get_core_anchor_for_shot(session: AsyncSession, shot_id: uuid.UUID) -> CoreAnchor | None:
    result: CoreAnchor | None = await session.scalar(
        select(CoreAnchor).where(CoreAnchor.shot_id == shot_id)
    )
    return result


async def get_revision(session: AsyncSession, revision_id: uuid.UUID) -> CoreAnchorRevision | None:
    result: CoreAnchorRevision | None = await session.scalar(
        select(CoreAnchorRevision)
        .where(CoreAnchorRevision.id == revision_id)
        .options(*_SEMANTIC_RELATIONSHIP_LOAD_OPTIONS)
    )
    return result


async def list_revisions_for_shot(
    session: AsyncSession, shot_id: uuid.UUID
) -> list[CoreAnchorRevision]:
    """All revisions of a Shot's CoreAnchor, oldest first.

    ``CoreAnchorRead.active_revision_id`` only ever names the *confirmed*
    revision, so a caller has no way to discover a draft revision's id from
    the shot alone without this. Read-only, mirrors
    ``brief_service.list_briefs_for_shot``: an unknown ``shot_id``, or a
    shot with no CoreAnchor yet, both just yield an empty list.
    """
    anchor = await session.scalar(select(CoreAnchor).where(CoreAnchor.shot_id == shot_id))
    if anchor is None:
        return []
    result = await session.execute(
        select(CoreAnchorRevision)
        .where(CoreAnchorRevision.core_anchor_id == anchor.id)
        .order_by(CoreAnchorRevision.revision_number)
        .options(*_SEMANTIC_RELATIONSHIP_LOAD_OPTIONS)
    )
    return list(result.scalars().all())


async def update_draft_revision(
    session: AsyncSession, actor: ActorContext, revision_id: uuid.UUID, changes: dict[str, Any]
) -> CoreAnchorRevision:
    require_can_update_draft(actor, "vfx_supervisor")

    revision = await session.get(CoreAnchorRevision, revision_id)
    if revision is None:
        raise NotFoundError("Core anchor revision not found")
    await session.refresh(revision)
    if revision.status != "draft":
        raise ConflictError("Revision is not in draft status")

    diff: dict[str, dict[str, Any]] = {}
    for field, new_value in changes.items():
        if field not in CORE_ANCHOR_CONTENT_FIELDS:
            continue
        old_value = getattr(revision, field)
        if old_value == new_value:
            continue
        diff[field] = {"before": old_value, "after": new_value}
        setattr(revision, field, new_value)

    try:
        # Only collections actually present in `changes` are touched --
        # omitted means unchanged (see _replace_semantic_collections_for_update).
        diff.update(await _replace_semantic_collections_for_update(session, revision.id, changes))

        if diff:
            await audit_service.record_audit_event(
                session,
                entity_type="core_anchor_revision",
                entity_id=revision.id,
                action="core_anchor_revision.updated",
                actor=actor,
                source_context={"changed_fields": diff},
            )
        await session.commit()
    except IntegrityError:
        # `record_audit_event`'s own internal flush can surface an
        # IntegrityError from this revision's pending changes just as
        # easily as the final commit can -- both must be caught here.
        await session.rollback()
        raise ConflictError("Concurrent update conflict") from None
    except Exception:
        await session.rollback()
        raise
    return await _get_revision_with_semantic_children(session, revision.id)


async def confirm_revision(
    session: AsyncSession,
    actor: ActorContext,
    revision_id: uuid.UUID,
    rationale: str | None = None,
    *,
    request_write_back: bool = False,
) -> CoreAnchorRevision:
    require_can_confirm_or_reject(actor, "vfx_supervisor")

    revision = await session.get(CoreAnchorRevision, revision_id)
    if revision is None:
        raise NotFoundError("Core anchor revision not found")

    anchor = await session.get(CoreAnchor, revision.core_anchor_id)
    if anchor is None:
        raise NotFoundError("Core anchor not found")

    # Postgres-only hardening: serializes concurrent confirms targeting the
    # same anchor (global lock order step 1) and gives read-then-decide
    # confidence. A no-op on SQLite. `populate_existing=True` is required:
    # `anchor` may already be present in this session's identity map from
    # the `session.get()` call above, and without it SQLAlchemy would
    # silently keep serving that earlier (potentially stale) object rather
    # than the freshly locked row's column values.
    lock_result = await session.execute(
        select(CoreAnchor)
        .where(CoreAnchor.id == anchor.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    anchor = lock_result.scalar_one()

    # Re-fetch live status: another transaction may have confirmed/rejected
    # this revision (or superseded the anchor's active revision) between
    # our initial read above and acquiring the lock.
    await session.refresh(revision)
    if revision.status != "draft":
        raise ConflictError("Revision is not in draft status")

    previous: CoreAnchorRevision | None = None
    expected_active_revision_id = anchor.active_revision_id
    if expected_active_revision_id is not None:
        previous = await session.get(CoreAnchorRevision, expected_active_revision_id)
        if previous is not None:
            await session.refresh(previous)

    if revision.core_anchor_id != anchor.id:
        raise InternalConsistencyError(
            "confirm_revision target revision does not belong to the resolved CoreAnchor"
        )
    if (
        previous is not None
        and previous.status == "confirmed"
        and previous.core_anchor_id != anchor.id
    ):
        raise InternalConsistencyError(
            "CoreAnchor.active_revision_id references a revision belonging to a "
            "different CoreAnchor"
        )

    # CAS: the actual, dialect-portable commit gate (a SELECT, even a
    # bare-scalar one, cannot be trusted to reflect a concurrently
    # committed value under SQLite/PostgreSQL snapshot isolation -- see
    # intent.core_anchor_lock). This is the first mutating operation in
    # this function, called before any other write below.
    await compare_and_swap_active_revision(
        session, anchor.id, expected_active_revision_id, revision.id
    )
    # A Core-level UPDATE does not sync the identity-mapped `anchor`
    # object's attributes -- refresh so later reads (e.g. anchor.shot_id
    # below, and the caller's use of the returned anchor state) are
    # consistent with what the CAS just wrote.
    await session.refresh(anchor)

    # Every write from here on is wrapped in one try/except: `record_transition`/
    # `record_decision`/`record_audit_event`/the stale cascade each call
    # `session.flush()` internally, and autoflush means ANY of those
    # flushes -- not just the final `commit()` below -- can be the one
    # that trips the partial unique index. All such failures must be
    # caught here, not just a failure at `commit()`.
    try:
        if previous is not None and previous.status == "confirmed":
            previous.status = "superseded"
            system_actor = ActorContext.system()
            await transition_service.record_transition(
                session,
                entity_type="core_anchor_revision",
                entity_id=previous.id,
                from_state="confirmed",
                to_state="superseded",
                actor=system_actor,
            )
            await audit_service.record_audit_event(
                session,
                entity_type="core_anchor_revision",
                entity_id=previous.id,
                action="core_anchor_revision.auto_superseded",
                actor=system_actor,
            )

        revision.status = "confirmed"
        revision.confirmed_by_human_role = actor.human_role
        revision.confirmed_by_actor_id = actor.actor_id
        revision.confirmed_at = _utcnow()
        revision.supersedes_revision_id = previous.id if previous is not None else None

        await transition_service.record_transition(
            session,
            entity_type="core_anchor_revision",
            entity_id=revision.id,
            from_state="draft",
            to_state="confirmed",
            actor=actor,
        )

        # anchor.active_revision_id was already set to revision.id by the
        # CAS above (and refreshed into this Python object) -- no
        # redundant assignment needed here.

        await decision_service.record_decision(
            session,
            decision_type="confirm_core_anchor",
            owning_human_role="vfx_supervisor",
            actor=actor,
            entity_type="core_anchor_revision",
            entity_id=revision.id,
            rationale=rationale,
            write_back_requested=request_write_back,
        )

        await audit_service.record_audit_event(
            session,
            entity_type="core_anchor_revision",
            entity_id=revision.id,
            action="core_anchor_revision.confirmed",
            actor=actor,
        )

        # Stale cascade: runs inside this same transaction, never commits
        # independently. Any exception it raises (including
        # InternalConsistencyError) propagates to this try/except, so a
        # cascade failure rolls back the entire confirm atomically.
        await execution_anchor_service.mark_stale_for_new_core_revision(
            session, anchor.shot_id, revision.id
        )

        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise ConflictError("Concurrent confirmation conflict") from None
    except Exception:
        # Anything else raised in this block (e.g. InternalConsistencyError
        # from the stale cascade) must still roll back before propagating --
        # otherwise the flushed-but-uncommitted status/pointer changes
        # above remain visible to further reads on this same session even
        # though they were never durably committed. The original exception
        # type and message are preserved (never converted to ConflictError).
        await session.rollback()
        raise

    return await _get_revision_with_semantic_children(session, revision.id)


async def reject_revision(
    session: AsyncSession, actor: ActorContext, revision_id: uuid.UUID, rationale: str | None = None
) -> CoreAnchorRevision:
    require_can_confirm_or_reject(actor, "vfx_supervisor")

    revision = await session.get(CoreAnchorRevision, revision_id)
    if revision is None:
        raise NotFoundError("Core anchor revision not found")
    await session.refresh(revision)
    if revision.status != "draft":
        raise ConflictError("Revision is not in draft status")

    revision.status = "rejected"

    try:
        await transition_service.record_transition(
            session,
            entity_type="core_anchor_revision",
            entity_id=revision.id,
            from_state="draft",
            to_state="rejected",
            actor=actor,
        )

        await decision_service.record_decision(
            session,
            decision_type="reject_core_anchor",
            owning_human_role="vfx_supervisor",
            actor=actor,
            entity_type="core_anchor_revision",
            entity_id=revision.id,
            rationale=rationale,
            write_back_requested=False,
        )

        await audit_service.record_audit_event(
            session,
            entity_type="core_anchor_revision",
            entity_id=revision.id,
            action="core_anchor_revision.rejected",
            actor=actor,
        )

        await session.commit()
    except IntegrityError:
        # Each `record_*` call above flushes internally; any of those
        # flushes -- not just the final commit -- can surface an
        # IntegrityError and must be caught here.
        await session.rollback()
        raise ConflictError("Concurrent rejection conflict") from None
    except Exception:
        await session.rollback()
        raise
    return await _get_revision_with_semantic_children(session, revision.id)
