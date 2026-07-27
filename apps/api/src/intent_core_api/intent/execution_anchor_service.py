"""ExecutionAnchor / ExecutionAnchorRevision lifecycle: draft, update,
confirm, reject -- plus the CoreAnchor-confirm stale cascade (called from
``core_anchor_service.confirm_revision``, never independently).

This module does not import ``core_anchor_service`` (and vice versa,
``core_anchor_service`` imports this module only, never the reverse) --
CoreAnchor/CoreAnchorRevision lookups needed here are done directly
against the models, not by calling into the other service's business
logic. See the approved WP-A2 plan §8 for why.

Concurrency strategy (see the approved WP-A2 plan, concurrency addendum):

- ``compare_and_swap_active_revision`` (intent.core_anchor_lock) is the
  single, dialect-portable serialization mechanism shared by CoreAnchor
  confirmation, ``create_draft_revision``, and ``confirm_revision`` here.
  It is always the *first mutating operation* in each -- called before any
  ``session.add()``, attribute mutation, or ``record_*()`` flush -- so a
  CAS failure never needs to unwind partial application-level state.
- ``create_draft_revision`` and ``confirm_revision`` additionally take the
  global lock order CoreAnchor -> ExecutionAnchor -> revisions/lineage:
  CoreAnchor state is read, locked (Postgres), CAS-verified, and only
  then is ExecutionAnchor touched.
- Every mutating function performs all of its writes on one session and
  commits exactly once; any ``IntegrityError`` at that point (including
  from a ``record_*()`` flush, not just the terminal commit) is caught,
  the session is rolled back, and a ``ConflictError`` (-> 409) is raised.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.audit import service as audit_service
from intent_core_api.intent import human_gate_service
from intent_core_api.intent.core_anchor_lock import compare_and_swap_active_revision
from intent_core_api.intent.models import (
    CoreAnchor,
    CoreAnchorRevision,
    ExecutionAnchor,
    ExecutionAnchorRevision,
)
from intent_core_api.production_context.models import Task
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


EXECUTION_ANCHOR_CONTENT_FIELDS = (
    "technical_boundaries",
    "parameter_ranges",
    "delivery_conditions",
    "production_ready_criteria",
    "downstream_dependencies",
    "publish_requirements",
    "allowed_refinements",
    "escalation_conditions",
)

_DRAFT_CREATE_AGENT_TYPES: frozenset[AgentType] = frozenset({"cg_supervisor_agent"})


async def get_or_create_execution_anchor(
    session: AsyncSession, task_id: uuid.UUID
) -> ExecutionAnchor:
    existing: ExecutionAnchor | None = await session.scalar(
        select(ExecutionAnchor).where(ExecutionAnchor.task_id == task_id)
    )
    if existing is not None:
        return existing

    anchor = ExecutionAnchor(task_id=task_id)
    session.add(anchor)
    try:
        await session.flush()
    except IntegrityError:
        await session.rollback()
        existing = await session.scalar(
            select(ExecutionAnchor).where(ExecutionAnchor.task_id == task_id)
        )
        if existing is None:
            raise
        return existing
    return anchor


async def _next_execution_revision_number(
    session: AsyncSession, execution_anchor_id: uuid.UUID
) -> int:
    max_number = await session.scalar(
        select(func.coalesce(func.max(ExecutionAnchorRevision.revision_number), 0)).where(
            ExecutionAnchorRevision.execution_anchor_id == execution_anchor_id
        )
    )
    return int(max_number or 0) + 1


async def create_draft_revision(
    session: AsyncSession, actor: ActorContext, task_id: uuid.UUID, content: dict[str, Any]
) -> ExecutionAnchorRevision:
    require_can_draft(actor, "cg_supervisor", allowed_agent_types=_DRAFT_CREATE_AGENT_TYPES)

    task = await session.get(Task, task_id)
    if task is None:
        raise NotFoundError("Task not found")

    core_anchor = await session.scalar(select(CoreAnchor).where(CoreAnchor.shot_id == task.shot_id))
    if core_anchor is None or core_anchor.active_revision_id is None:
        raise ConflictError(
            "No confirmed CoreAnchorRevision exists for this Task's Shot; an Execution "
            "Anchor cannot be drafted until the Primary Anchor is confirmed"
        )

    core_revision = await session.get(CoreAnchorRevision, core_anchor.active_revision_id)
    if core_revision is None or core_revision.status != "confirmed":
        raise InternalConsistencyError(
            "CoreAnchor.active_revision_id does not reference a confirmed revision"
        )
    if core_revision.core_anchor_id != core_anchor.id or core_anchor.shot_id != task.shot_id:
        raise InternalConsistencyError(
            "resolved CoreAnchorRevision does not belong to the Task's Shot"
        )

    # CAS: the first mutating operation. No ExecutionAnchor row has been
    # read, created, or touched yet, so nothing pending could autoflush
    # ahead of this call. Verify-only: expected == new.
    await compare_and_swap_active_revision(
        session, core_anchor.id, core_revision.id, core_revision.id
    )

    execution_anchor = await get_or_create_execution_anchor(session, task.id)
    revision_number = await _next_execution_revision_number(session, execution_anchor.id)

    revision = ExecutionAnchorRevision(
        execution_anchor_id=execution_anchor.id,
        core_anchor_revision_id=core_revision.id,
        revision_number=revision_number,
        status="draft",
        created_by_actor_kind=actor.actor_kind,
        created_by_actor_id=actor.actor_id,
        created_by_human_role=actor.human_role,
        created_by_agent_type=actor.agent_type,
        created_by_agent_run_id=actor.agent_run_id,
        **{field: content.get(field) for field in EXECUTION_ANCHOR_CONTENT_FIELDS},
    )
    session.add(revision)
    try:
        # Flush (not just add) so the revision's client-side uuid4()
        # default is materialized into revision.id before the gate's
        # hard FK needs it -- same pattern as
        # core_anchor_service.create_draft_revision.
        await session.flush()

        # Step 4: exactly one pending HumanGate is opened per draft, in
        # this same transaction -- a draft and its gate always succeed or
        # fail together (see intent.human_gate_service module docstring).
        gate = await human_gate_service.create_pending_gate(
            session, shot_id=task.shot_id, execution_anchor_revision_id=revision.id
        )
        await audit_service.record_audit_event(
            session,
            entity_type="human_gate",
            entity_id=gate.id,
            action="human_gate.opened",
            actor=actor,
            source_context={"gate_type": gate.gate_type, "required_role": gate.required_role},
            related_entity_type="execution_anchor_revision",
            related_entity_id=revision.id,
        )

        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise ConflictError(
            "A draft was created concurrently for this Task; retry the request"
        ) from None
    except Exception:
        # A draft and its pending gate must succeed or fail together --
        # any failure past the flush above (including one from gate/audit
        # persistence) must roll back the revision too, not just an
        # IntegrityError.
        await session.rollback()
        raise
    await session.refresh(revision)
    return revision


async def list_revisions_for_task(
    session: AsyncSession, task_id: uuid.UUID
) -> list[ExecutionAnchorRevision]:
    execution_anchor = await get_execution_anchor_for_task(session, task_id)
    if execution_anchor is None:
        return []
    result = await session.execute(
        select(ExecutionAnchorRevision)
        .where(ExecutionAnchorRevision.execution_anchor_id == execution_anchor.id)
        .order_by(ExecutionAnchorRevision.revision_number)
    )
    return list(result.scalars().all())


async def get_execution_anchor_for_task(
    session: AsyncSession, task_id: uuid.UUID
) -> ExecutionAnchor | None:
    result: ExecutionAnchor | None = await session.scalar(
        select(ExecutionAnchor).where(ExecutionAnchor.task_id == task_id)
    )
    return result


async def get_execution_revision(
    session: AsyncSession, revision_id: uuid.UUID
) -> ExecutionAnchorRevision | None:
    return await session.get(ExecutionAnchorRevision, revision_id)


async def update_draft_revision(
    session: AsyncSession, actor: ActorContext, revision_id: uuid.UUID, changes: dict[str, Any]
) -> ExecutionAnchorRevision:
    require_can_update_draft(actor, "cg_supervisor")

    revision = await session.get(ExecutionAnchorRevision, revision_id)
    if revision is None:
        raise NotFoundError("Execution anchor revision not found")
    await session.refresh(revision)
    if revision.status != "draft":
        raise ConflictError("Revision is not in draft status")

    diff: dict[str, dict[str, Any]] = {}
    for field, new_value in changes.items():
        if field not in EXECUTION_ANCHOR_CONTENT_FIELDS:
            continue
        old_value = getattr(revision, field)
        if old_value == new_value:
            continue
        diff[field] = {"before": old_value, "after": new_value}
        setattr(revision, field, new_value)

    try:
        if diff:
            await audit_service.record_audit_event(
                session,
                entity_type="execution_anchor_revision",
                entity_id=revision.id,
                action="execution_anchor_revision.updated",
                actor=actor,
                source_context={"changed_fields": diff},
            )
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise ConflictError("Concurrent update conflict") from None
    except Exception:
        await session.rollback()
        raise
    await session.refresh(revision)
    return revision


async def confirm_revision(
    session: AsyncSession, actor: ActorContext, revision_id: uuid.UUID, rationale: str | None = None
) -> ExecutionAnchorRevision:
    require_can_confirm_or_reject(actor, "cg_supervisor")

    revision = await session.get(ExecutionAnchorRevision, revision_id)
    if revision is None:
        raise NotFoundError("Execution anchor revision not found")

    execution_anchor = await session.get(ExecutionAnchor, revision.execution_anchor_id)
    if execution_anchor is None:
        raise NotFoundError("Execution anchor not found")

    task = await session.get(Task, execution_anchor.task_id)
    if task is None:
        raise InternalConsistencyError("ExecutionAnchor references a Task that no longer exists")

    core_anchor = await session.scalar(select(CoreAnchor).where(CoreAnchor.shot_id == task.shot_id))
    if core_anchor is None:
        raise InternalConsistencyError(
            "No CoreAnchor exists for this ExecutionAnchor's Task's Shot"
        )

    # Lock CoreAnchor first (global lock order step 1) -- Postgres
    # hardening; a no-op on SQLite.
    lock_result = await session.execute(
        select(CoreAnchor)
        .where(CoreAnchor.id == core_anchor.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    core_anchor = lock_result.scalar_one()

    # Confirm-time re-validation (approved product choice): the draft's
    # Core reference must still be the shot's current confirmed revision.
    if core_anchor.active_revision_id != revision.core_anchor_revision_id:
        raise ConflictError(
            "The referenced CoreAnchorRevision is no longer the current confirmed "
            "revision for this Task's Shot; update the draft against the latest "
            "Core Anchor before confirming"
        )

    # CAS: the first mutating operation -- verify-only (Execution confirm
    # never changes CoreAnchor.active_revision_id itself). Nothing
    # ExecutionAnchor-side has been locked or mutated yet.
    await compare_and_swap_active_revision(
        session, core_anchor.id, revision.core_anchor_revision_id, revision.core_anchor_revision_id
    )

    # Lock ExecutionAnchor second (global lock order step 2).
    lock_result2 = await session.execute(
        select(ExecutionAnchor)
        .where(ExecutionAnchor.id == execution_anchor.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    execution_anchor = lock_result2.scalar_one()

    await session.refresh(revision)
    if revision.status != "draft":
        raise ConflictError("Revision is not in draft status")

    previous: ExecutionAnchorRevision | None = None
    if execution_anchor.active_revision_id is not None:
        previous = await session.get(ExecutionAnchorRevision, execution_anchor.active_revision_id)
        if previous is not None:
            await session.refresh(previous)

    if revision.execution_anchor_id != execution_anchor.id:
        raise InternalConsistencyError(
            "confirm_revision target revision does not belong to the resolved ExecutionAnchor"
        )
    if (
        previous is not None
        and previous.status == "confirmed"
        and previous.execution_anchor_id != execution_anchor.id
    ):
        raise InternalConsistencyError(
            "ExecutionAnchor.active_revision_id references a revision belonging to a "
            "different ExecutionAnchor"
        )

    try:
        # Step 4: load the persisted gate, or -- for a legacy,
        # pre-Step-4 draft -- create the missing pending one inside this
        # same transaction, so it is resolved atomically with everything
        # below rather than ever being left pending on its own.
        gate = await human_gate_service.get_or_create_pending_gate_for_resolution(
            session, shot_id=task.shot_id, execution_anchor_revision_id=revision.id
        )

        if previous is not None and previous.status == "confirmed":
            previous.status = "superseded"
            system_actor = ActorContext.system()
            await transition_service.record_transition(
                session,
                entity_type="execution_anchor_revision",
                entity_id=previous.id,
                from_state="confirmed",
                to_state="superseded",
                actor=system_actor,
            )
            await audit_service.record_audit_event(
                session,
                entity_type="execution_anchor_revision",
                entity_id=previous.id,
                action="execution_anchor_revision.auto_superseded",
                actor=system_actor,
            )

        revision.status = "confirmed"
        revision.confirmed_by_human_role = actor.human_role
        revision.confirmed_by_actor_id = actor.actor_id
        revision.confirmed_at = _utcnow()
        revision.supersedes_revision_id = previous.id if previous is not None else None

        await transition_service.record_transition(
            session,
            entity_type="execution_anchor_revision",
            entity_id=revision.id,
            from_state="draft",
            to_state="confirmed",
            actor=actor,
        )

        execution_anchor.active_revision_id = revision.id

        # Automatic only -- clearing is a direct consequence of the human's
        # own confirm action on this same anchor, so it is human-attributed
        # (unlike the cross-entity stale-marking cascade, which is system-
        # attributed -- see core_anchor_service.confirm_revision).
        if execution_anchor.is_stale:
            execution_anchor.is_stale = False
            await audit_service.record_audit_event(
                session,
                entity_type="execution_anchor",
                entity_id=execution_anchor.id,
                action="execution_anchor.stale_cleared",
                actor=actor,
            )

        decision = await decision_service.record_decision(
            session,
            decision_type="confirm_execution_anchor",
            owning_human_role="cg_supervisor",
            actor=actor,
            entity_type="execution_anchor_revision",
            entity_id=revision.id,
            rationale=rationale,
            write_back_requested=False,
        )

        await audit_service.record_audit_event(
            session,
            entity_type="execution_anchor_revision",
            entity_id=revision.id,
            action="execution_anchor_revision.confirmed",
            actor=actor,
        )

        # Step 4: the gate is resolved atomically alongside the Decision
        # it links to -- never confirmed/rejected independently.
        human_gate_service.resolve_gate(
            gate, status="confirmed", actor=actor, rationale=rationale, decision_id=decision.id
        )
        await audit_service.record_audit_event(
            session,
            entity_type="human_gate",
            entity_id=gate.id,
            action="human_gate.confirmed",
            actor=actor,
            source_context={"decision_id": str(decision.id)},
            related_entity_type="execution_anchor_revision",
            related_entity_id=revision.id,
        )

        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise ConflictError("Concurrent confirmation conflict") from None
    except Exception:
        await session.rollback()
        raise

    await session.refresh(revision)
    return revision


async def reject_revision(
    session: AsyncSession, actor: ActorContext, revision_id: uuid.UUID, rationale: str | None = None
) -> ExecutionAnchorRevision:
    require_can_confirm_or_reject(actor, "cg_supervisor")

    revision = await session.get(ExecutionAnchorRevision, revision_id)
    if revision is None:
        raise NotFoundError("Execution anchor revision not found")
    await session.refresh(revision)
    if revision.status != "draft":
        raise ConflictError("Revision is not in draft status")

    execution_anchor = await session.get(ExecutionAnchor, revision.execution_anchor_id)
    if execution_anchor is None:
        raise InternalConsistencyError("ExecutionAnchor referenced by revision no longer exists")
    task = await session.get(Task, execution_anchor.task_id)
    if task is None:
        raise InternalConsistencyError("ExecutionAnchor references a Task that no longer exists")

    revision.status = "rejected"

    try:
        # Step 4: load the persisted gate, or -- for a legacy, pre-Step-4
        # draft -- create the missing pending one inside this same
        # transaction (see confirm_revision's identical pattern).
        gate = await human_gate_service.get_or_create_pending_gate_for_resolution(
            session, shot_id=task.shot_id, execution_anchor_revision_id=revision.id
        )

        await transition_service.record_transition(
            session,
            entity_type="execution_anchor_revision",
            entity_id=revision.id,
            from_state="draft",
            to_state="rejected",
            actor=actor,
        )
        decision = await decision_service.record_decision(
            session,
            decision_type="reject_execution_anchor",
            owning_human_role="cg_supervisor",
            actor=actor,
            entity_type="execution_anchor_revision",
            entity_id=revision.id,
            rationale=rationale,
            write_back_requested=False,
        )
        await audit_service.record_audit_event(
            session,
            entity_type="execution_anchor_revision",
            entity_id=revision.id,
            action="execution_anchor_revision.rejected",
            actor=actor,
        )

        # Step 4: the gate is resolved atomically alongside the Decision
        # it links to -- never confirmed/rejected independently.
        human_gate_service.resolve_gate(
            gate, status="rejected", actor=actor, rationale=rationale, decision_id=decision.id
        )
        await audit_service.record_audit_event(
            session,
            entity_type="human_gate",
            entity_id=gate.id,
            action="human_gate.rejected",
            actor=actor,
            source_context={"decision_id": str(decision.id)},
            related_entity_type="execution_anchor_revision",
            related_entity_id=revision.id,
        )

        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise ConflictError("Concurrent rejection conflict") from None
    except Exception:
        await session.rollback()
        raise
    await session.refresh(revision)
    return revision


async def mark_stale_for_new_core_revision(
    session: AsyncSession, shot_id: uuid.UUID, new_core_anchor_revision_id: uuid.UUID
) -> None:
    """Called only from ``core_anchor_service.confirm_revision``, inside
    its existing transaction (which already holds the CoreAnchor lock --
    global lock order step 1 is already satisfied by the caller). Never
    commits, never opens an independent transaction: any exception raised
    here (including ``InternalConsistencyError``) propagates directly to
    the caller so the entire Core-confirm transaction rolls back
    atomically.
    """
    result = await session.execute(
        select(ExecutionAnchor)
        .join(Task, Task.id == ExecutionAnchor.task_id)
        .where(Task.shot_id == shot_id)
        .order_by(ExecutionAnchor.id)
        .with_for_update(of=ExecutionAnchor)
        .execution_options(populate_existing=True)
    )
    for execution_anchor in result.scalars().all():
        if execution_anchor.is_stale:
            continue  # already stale -- skipped completely, no duplicate AuditEvent
        if execution_anchor.active_revision_id is None:
            continue  # nothing confirmed yet -- nothing can be stale

        active_revision = await session.get(
            ExecutionAnchorRevision, execution_anchor.active_revision_id
        )
        if active_revision is None or active_revision.status != "confirmed":
            raise InternalConsistencyError(
                f"ExecutionAnchor {execution_anchor.id} active_revision_id references a "
                "revision that is missing or not confirmed"
            )
        if active_revision.core_anchor_revision_id == new_core_anchor_revision_id:
            continue  # already current

        execution_anchor.is_stale = True
        await audit_service.record_audit_event(
            session,
            entity_type="execution_anchor",
            entity_id=execution_anchor.id,
            action="execution_anchor.marked_stale",
            actor=ActorContext.system(),
        )
