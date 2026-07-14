"""Concurrency and database-invariant tests for CoreAnchor/CoreAnchorRevision.

Two kinds of coverage:

- Deterministic, model-level tests (using the shared in-memory `session`
  fixture) that directly prove the database-level invariants exist: the
  partial unique index allows at most one confirmed revision per anchor,
  and UNIQUE(core_anchor_id, revision_number) rejects a duplicate number.
- Genuine `asyncio.gather`-driven concurrency tests against a file-based
  SQLite database (not the in-memory/StaticPool `session` fixture, which
  shares a single connection and cannot exhibit real interleaving), using
  two independent sessions from the same engine's connection pool. These
  assert the *invariant* holds (no duplicate revision numbers, exactly one
  CoreAnchor per shot) rather than a specific interleaving outcome, since
  exact timing under asyncio is not guaranteed.
"""

from __future__ import annotations

import asyncio
import uuid
from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from intent_core_api.audit.models import AuditEvent
from intent_core_api.db import Base
from intent_core_api.intent import core_anchor_service
from intent_core_api.intent.models import CoreAnchor, CoreAnchorRevision
from intent_core_api.production_context.models import Project, Shot
from intent_core_api.workflow.actors import ActorContext
from intent_core_api.workflow.exceptions import ConflictError, InternalConsistencyError
from intent_core_api.workflow.models import Decision, WorkflowTransition
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

VFX_ACTOR = ActorContext(actor_kind="human", actor_id="vfx-1", human_role="vfx_supervisor")


def _revision_kwargs(
    core_anchor_id: object, revision_number: int, status: str
) -> dict[str, object]:
    return {
        "core_anchor_id": core_anchor_id,
        "revision_number": revision_number,
        "status": status,
        "created_by_actor_kind": "human",
        "created_by_actor_id": "vfx-1",
        "created_by_human_role": "vfx_supervisor",
    }


async def test_partial_unique_index_prevents_two_confirmed_revisions(session: AsyncSession) -> None:
    project = Project(name="Demo")
    session.add(project)
    await session.flush()
    shot = Shot(project_id=project.id, name="SH010")
    session.add(shot)
    await session.flush()
    anchor = CoreAnchor(shot_id=shot.id)
    session.add(anchor)
    await session.flush()

    session.add(CoreAnchorRevision(**_revision_kwargs(anchor.id, 1, "confirmed")))
    await session.flush()

    session.add(CoreAnchorRevision(**_revision_kwargs(anchor.id, 2, "confirmed")))
    with pytest.raises(IntegrityError):
        await session.commit()
    await session.rollback()


async def test_unique_revision_number_prevents_duplicate(session: AsyncSession) -> None:
    project = Project(name="Demo")
    session.add(project)
    await session.flush()
    shot = Shot(project_id=project.id, name="SH010")
    session.add(shot)
    await session.flush()
    anchor = CoreAnchor(shot_id=shot.id)
    session.add(anchor)
    await session.flush()

    session.add(CoreAnchorRevision(**_revision_kwargs(anchor.id, 1, "draft")))
    await session.flush()

    session.add(CoreAnchorRevision(**_revision_kwargs(anchor.id, 1, "draft")))
    with pytest.raises(IntegrityError):
        await session.commit()
    await session.rollback()


async def test_confirm_revision_cross_anchor_assertion_guard(session: AsyncSession) -> None:
    """Simulates a data-integrity bug (not reachable through the public
    API) where a CoreAnchor's active_revision_id points at a revision
    belonging to a *different* anchor. confirm_revision must refuse to
    proceed rather than silently mixing state across anchors.
    """
    project = Project(name="Demo")
    session.add(project)
    await session.flush()
    shot1 = Shot(project_id=project.id, name="SH010")
    shot2 = Shot(project_id=project.id, name="SH020")
    session.add_all([shot1, shot2])
    await session.flush()
    anchor1 = CoreAnchor(shot_id=shot1.id)
    anchor2 = CoreAnchor(shot_id=shot2.id)
    session.add_all([anchor1, anchor2])
    await session.flush()

    foreign_revision = CoreAnchorRevision(**_revision_kwargs(anchor2.id, 1, "confirmed"))
    session.add(foreign_revision)
    await session.flush()

    anchor1.active_revision_id = foreign_revision.id
    await session.flush()

    draft = CoreAnchorRevision(**_revision_kwargs(anchor1.id, 1, "draft"))
    session.add(draft)
    await session.flush()

    with pytest.raises(InternalConsistencyError):
        await core_anchor_service.confirm_revision(session, VFX_ACTOR, draft.id)


async def test_failed_confirm_via_partial_index_leaves_no_partial_writes(
    session: AsyncSession,
) -> None:
    """Deterministically reproduces the partial-unique-index conflict path
    (rather than relying on true concurrency timing) by seeding a revision
    that is already `confirmed` without the CoreAnchor's `active_revision_id`
    pointer reflecting it -- i.e. exactly the race window the index exists
    to guard, reproduced without needing real interleaving. confirm_revision
    must fail with a 409-mapped ConflictError, leave the session usable, and
    leave zero new Decision/WorkflowTransition/AuditEvent rows and no
    partial status/pointer changes.
    """
    project = Project(name="Demo")
    session.add(project)
    await session.flush()
    shot = Shot(project_id=project.id, name="SH010")
    session.add(shot)
    await session.flush()
    anchor = CoreAnchor(shot_id=shot.id)
    session.add(anchor)
    await session.flush()

    # A genuinely confirmed row whose existence is not (yet) reflected via
    # anchor.active_revision_id -- the pointer is intentionally left None.
    already_confirmed = CoreAnchorRevision(**_revision_kwargs(anchor.id, 1, "confirmed"))
    session.add(already_confirmed)
    await session.flush()

    draft = CoreAnchorRevision(**_revision_kwargs(anchor.id, 2, "draft"))
    session.add(draft)
    await session.commit()

    before_decisions = len((await session.execute(select(Decision))).scalars().all())
    before_transitions = len((await session.execute(select(WorkflowTransition))).scalars().all())
    before_events = len((await session.execute(select(AuditEvent))).scalars().all())

    draft_id = draft.id
    anchor_id = anchor.id

    with pytest.raises(ConflictError):
        await core_anchor_service.confirm_revision(session, VFX_ACTOR, draft_id)

    # Session must remain usable immediately after the caught IntegrityError.
    after_decisions = (await session.execute(select(Decision))).scalars().all()
    after_transitions = (await session.execute(select(WorkflowTransition))).scalars().all()
    after_events = (await session.execute(select(AuditEvent))).scalars().all()
    assert len(after_decisions) == before_decisions
    assert len(after_transitions) == before_transitions
    assert len(after_events) == before_events

    draft_after = await session.get(CoreAnchorRevision, draft_id)
    anchor_after = await session.get(CoreAnchor, anchor_id)
    assert draft_after is not None
    assert anchor_after is not None
    await session.refresh(draft_after)
    await session.refresh(anchor_after)
    assert draft_after.status == "draft"
    assert anchor_after.active_revision_id is None


@pytest.fixture
async def file_db_session_factory(
    tmp_path: Path,
) -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    db_path = tmp_path / "concurrency.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.exec_driver_sql("PRAGMA journal_mode=WAL")
        await conn.exec_driver_sql("PRAGMA busy_timeout=5000")
    factory = async_sessionmaker(engine, expire_on_commit=False)
    try:
        yield factory
    finally:
        await engine.dispose()


async def test_concurrent_draft_creation_produces_distinct_revision_numbers(
    file_db_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    async with file_db_session_factory() as setup_session:
        project = Project(name="Demo")
        setup_session.add(project)
        await setup_session.flush()
        shot = Shot(project_id=project.id, name="SH010")
        setup_session.add(shot)
        await setup_session.commit()
        shot_id = shot.id

    async def attempt() -> CoreAnchorRevision | ConflictError:
        async with file_db_session_factory() as task_session:
            try:
                return await core_anchor_service.create_draft_revision(
                    task_session, VFX_ACTOR, shot_id, {}
                )
            except ConflictError as exc:
                return exc

    results = await asyncio.gather(attempt(), attempt())

    successes = [r for r in results if isinstance(r, CoreAnchorRevision)]
    conflicts = [r for r in results if isinstance(r, ConflictError)]
    assert len(successes) + len(conflicts) == 2
    # The invariant that must hold regardless of exact interleaving: no two
    # successful drafts ever share a revision_number.
    revision_numbers = [s.revision_number for s in successes]
    assert len(revision_numbers) == len(set(revision_numbers))

    async with file_db_session_factory() as verify_session:
        anchors = (
            (await verify_session.execute(select(CoreAnchor).where(CoreAnchor.shot_id == shot_id)))
            .scalars()
            .all()
        )
        assert len(anchors) == 1


async def test_concurrent_get_or_create_core_anchor_returns_same_row(
    file_db_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    async with file_db_session_factory() as setup_session:
        project = Project(name="Demo")
        setup_session.add(project)
        await setup_session.flush()
        shot = Shot(project_id=project.id, name="SH010")
        setup_session.add(shot)
        await setup_session.commit()
        shot_id = shot.id

    async def attempt() -> object:
        async with file_db_session_factory() as task_session:
            anchor = await core_anchor_service.get_or_create_core_anchor(task_session, shot_id)
            await task_session.commit()
            return anchor.id

    anchor_ids = await asyncio.gather(attempt(), attempt())
    assert anchor_ids[0] == anchor_ids[1]

    async with file_db_session_factory() as verify_session:
        anchors = (
            (await verify_session.execute(select(CoreAnchor).where(CoreAnchor.shot_id == shot_id)))
            .scalars()
            .all()
        )
        assert len(anchors) == 1


async def test_concurrent_confirm_of_two_drafts_on_same_anchor(
    file_db_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    """True asyncio.gather concurrency, two separate sessions, two draft
    revisions under the same CoreAnchor, both confirmed at the same time.

    Depending on exact interleaving (not guaranteed under asyncio, and not
    guaranteed identically across SQLite/PostgreSQL), either both attempts
    succeed (the second correctly detects and supersedes the first), or the
    second loses a race against the partial unique index and gets a 409.
    Both outcomes are dialect-valid. What must always hold regardless of
    which happens is asserted below.
    """
    async with file_db_session_factory() as setup_session:
        project = Project(name="Demo")
        setup_session.add(project)
        await setup_session.flush()
        shot = Shot(project_id=project.id, name="SH010")
        setup_session.add(shot)
        await setup_session.commit()
        shot_id = shot.id

    async with file_db_session_factory() as setup_session:
        draft1 = await core_anchor_service.create_draft_revision(
            setup_session, VFX_ACTOR, shot_id, {}
        )
        draft1_id = draft1.id
    async with file_db_session_factory() as setup_session:
        draft2 = await core_anchor_service.create_draft_revision(
            setup_session, VFX_ACTOR, shot_id, {}
        )
        draft2_id = draft2.id

    async def confirm(revision_id: uuid.UUID) -> CoreAnchorRevision | ConflictError:
        async with file_db_session_factory() as task_session:
            try:
                return await core_anchor_service.confirm_revision(
                    task_session, VFX_ACTOR, revision_id
                )
            except ConflictError as exc:
                return exc

    results = await asyncio.gather(confirm(draft1_id), confirm(draft2_id))

    # Never an unhandled exception (no 500s) -- only a successful confirm or
    # a dialect-valid 409 conflict.
    for result in results:
        assert isinstance(result, CoreAnchorRevision | ConflictError)

    async with file_db_session_factory() as verify_session:
        anchor = await verify_session.scalar(
            select(CoreAnchor).where(CoreAnchor.shot_id == shot_id)
        )
        assert anchor is not None
        revisions = (
            (
                await verify_session.execute(
                    select(CoreAnchorRevision).where(CoreAnchorRevision.core_anchor_id == anchor.id)
                )
            )
            .scalars()
            .all()
        )

        # At most (and, since one of the two must win, exactly) one
        # revision is confirmed -- never zero, never both.
        confirmed = [r for r in revisions if r.status == "confirmed"]
        assert len(confirmed) == 1, f"expected exactly one confirmed revision, got {confirmed}"

        # active_revision_id points to the confirmed revision.
        assert anchor.active_revision_id == confirmed[0].id

        # The other revision is never left in a corrupted/duplicate-confirmed
        # state: it is either still `draft` (its confirm attempt lost to the
        # partial unique index and rolled back) or `superseded` (the winner
        # correctly detected and superseded it).
        other = next(r for r in revisions if r.id != confirmed[0].id)
        assert other.status in ("draft", "superseded")
        assert other.status != "confirmed"
