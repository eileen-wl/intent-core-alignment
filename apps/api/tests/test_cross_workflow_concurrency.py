"""Cross-workflow concurrency/atomicity tests: CoreAnchor confirmation
racing ExecutionAnchor draft creation/confirmation, and the Core-confirm
stale cascade's atomicity and determinism.

Races use explicit asyncio.Event barriers to force the intended
interleaving deterministically, rather than relying on asyncio.gather
scheduler timing (per the approved WP-A2 concurrency addendum, item 7).
"""

from __future__ import annotations

import asyncio
import uuid
from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from intent_core_api.audit import service as audit_service
from intent_core_api.audit.models import AuditEvent
from intent_core_api.db import Base
from intent_core_api.intent import core_anchor_service, execution_anchor_service
from intent_core_api.intent.core_anchor_lock import compare_and_swap_active_revision as real_cas
from intent_core_api.intent.models import (
    CoreAnchor,
    CoreAnchorRevision,
    ExecutionAnchor,
    ExecutionAnchorRevision,
)
from intent_core_api.production_context.models import Project, Shot, Task
from intent_core_api.workflow.actors import ActorContext
from intent_core_api.workflow.exceptions import ConflictError, InternalConsistencyError
from intent_core_api.workflow.models import Decision, WorkflowTransition
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

VFX_ACTOR = ActorContext(actor_kind="human", actor_id="vfx-1", human_role="vfx_supervisor")
CG_ACTOR = ActorContext(actor_kind="human", actor_id="cg-1", human_role="cg_supervisor")


@pytest.fixture
async def file_db_session_factory(
    tmp_path: Path,
) -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    db_path = tmp_path / "cross_workflow.db"
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


async def test_core_confirm_racing_execution_draft_creation(
    file_db_session_factory: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async with file_db_session_factory() as setup_session:
        project = Project(name="Demo")
        setup_session.add(project)
        await setup_session.flush()
        shot = Shot(project_id=project.id, name="SH010")
        setup_session.add(shot)
        await setup_session.flush()
        task = Task(shot_id=shot.id, name="Lighting Pass", department="lighting")
        setup_session.add(task)
        await setup_session.flush()
        core_draft1 = await core_anchor_service.create_draft_revision(
            setup_session, VFX_ACTOR, shot.id, {}
        )
        await core_anchor_service.confirm_revision(setup_session, VFX_ACTOR, core_draft1.id)
        shot_id, task_id = shot.id, task.id

    reached_checkpoint = asyncio.Event()
    proceed = asyncio.Event()

    async def barriered_cas(
        session: AsyncSession,
        core_anchor_id: uuid.UUID,
        expected_active_revision_id: uuid.UUID | None,
        new_active_revision_id: uuid.UUID | None,
    ) -> None:
        reached_checkpoint.set()
        await proceed.wait()
        await real_cas(session, core_anchor_id, expected_active_revision_id, new_active_revision_id)

    monkeypatch.setattr(
        "intent_core_api.intent.execution_anchor_service.compare_and_swap_active_revision",
        barriered_cas,
    )

    async def draft_creation() -> ExecutionAnchorRevision | ConflictError:
        async with file_db_session_factory() as task_session:
            try:
                return await execution_anchor_service.create_draft_revision(
                    task_session, CG_ACTOR, task_id, {}
                )
            except ConflictError as exc:
                return exc

    draft_task = asyncio.create_task(draft_creation())
    await reached_checkpoint.wait()

    # While draft creation is paused (having already resolved Core revision
    # v1 as "current"), fully confirm a NEW Core revision (v2) on a
    # separate session/connection.
    async with file_db_session_factory() as core_session:
        core_draft2 = await core_anchor_service.create_draft_revision(
            core_session, VFX_ACTOR, shot_id, {}
        )
        core_draft2_id = core_draft2.id
    async with file_db_session_factory() as confirm_session:
        await core_anchor_service.confirm_revision(confirm_session, VFX_ACTOR, core_draft2_id)

    proceed.set()
    result = await draft_task

    # Draft creation must never commit a draft against the now-obsolete v1
    # revision -- its own CAS (resumed after v2 was already committed) must
    # detect the change and fail.
    assert isinstance(result, ConflictError)

    async with file_db_session_factory() as verify_session:
        anchors = (
            (
                await verify_session.execute(
                    select(ExecutionAnchor).where(ExecutionAnchor.task_id == task_id)
                )
            )
            .scalars()
            .all()
        )
        # No partial ExecutionAnchor/Revision was left behind by the failed attempt.
        if anchors:
            revisions = (
                (
                    await verify_session.execute(
                        select(ExecutionAnchorRevision).where(
                            ExecutionAnchorRevision.execution_anchor_id == anchors[0].id
                        )
                    )
                )
                .scalars()
                .all()
            )
            assert revisions == []


async def test_core_confirm_racing_execution_confirm(
    file_db_session_factory: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async with file_db_session_factory() as setup_session:
        project = Project(name="Demo")
        setup_session.add(project)
        await setup_session.flush()
        shot = Shot(project_id=project.id, name="SH010")
        setup_session.add(shot)
        await setup_session.flush()
        task = Task(shot_id=shot.id, name="Lighting Pass", department="lighting")
        setup_session.add(task)
        await setup_session.flush()

        core_draft1 = await core_anchor_service.create_draft_revision(
            setup_session, VFX_ACTOR, shot.id, {}
        )
        core_v1 = await core_anchor_service.confirm_revision(
            setup_session, VFX_ACTOR, core_draft1.id
        )

        # A first Execution revision, confirmed against v1 -- gives the
        # anchor real "already confirmed" state whose staleness matters.
        exec_draft1 = await execution_anchor_service.create_draft_revision(
            setup_session, CG_ACTOR, task.id, {}
        )
        exec_confirmed1 = await execution_anchor_service.confirm_revision(
            setup_session, CG_ACTOR, exec_draft1.id
        )

        # A second Execution draft, ALSO against v1 (created before Core
        # moves on) -- this is the one we'll race against Core's v2 confirm.
        exec_draft2 = await execution_anchor_service.create_draft_revision(
            setup_session, CG_ACTOR, task.id, {}
        )

        shot_id, task_id = shot.id, task.id
        core_v1_id = core_v1.id
        exec_draft1_id = exec_confirmed1.id
        exec_draft2_id = exec_draft2.id

    reached_checkpoint = asyncio.Event()
    proceed = asyncio.Event()

    async def barriered_cas(
        session: AsyncSession,
        core_anchor_id: uuid.UUID,
        expected_active_revision_id: uuid.UUID | None,
        new_active_revision_id: uuid.UUID | None,
    ) -> None:
        reached_checkpoint.set()
        await proceed.wait()
        await real_cas(session, core_anchor_id, expected_active_revision_id, new_active_revision_id)

    monkeypatch.setattr(
        "intent_core_api.intent.execution_anchor_service.compare_and_swap_active_revision",
        barriered_cas,
    )

    async def execution_confirm() -> ExecutionAnchorRevision | ConflictError:
        async with file_db_session_factory() as task_session:
            try:
                return await execution_anchor_service.confirm_revision(
                    task_session, CG_ACTOR, exec_draft2_id
                )
            except ConflictError as exc:
                return exc

    confirm_task = asyncio.create_task(execution_confirm())
    await reached_checkpoint.wait()

    # While the Execution confirm is paused (already past its "Core
    # reference is current" check, having observed v1), fully confirm a
    # NEW Core revision (v2). This triggers the stale cascade, which finds
    # the anchor's CURRENTLY confirmed revision (exec_draft1, still v1) and
    # marks it stale.
    async with file_db_session_factory() as core_session:
        core_draft2 = await core_anchor_service.create_draft_revision(
            core_session, VFX_ACTOR, shot_id, {}
        )
        core_draft2_id = core_draft2.id
    async with file_db_session_factory() as confirm_session:
        await core_anchor_service.confirm_revision(confirm_session, VFX_ACTOR, core_draft2_id)

    proceed.set()
    result = await confirm_task

    # exec_draft2's confirm, resumed after v2 was already committed, must
    # fail -- it can never commit against the now-obsolete v1 reference.
    assert isinstance(result, ConflictError)

    async with file_db_session_factory() as verify_session:
        anchor = await verify_session.scalar(
            select(ExecutionAnchor).where(ExecutionAnchor.task_id == task_id)
        )
        assert anchor is not None
        exec_draft1_after = await verify_session.get(ExecutionAnchorRevision, exec_draft1_id)
        exec_draft2_after = await verify_session.get(ExecutionAnchorRevision, exec_draft2_id)
        assert exec_draft1_after is not None
        assert exec_draft2_after is not None

        # The literal invariant: never "old core_anchor_revision_id +
        # is_stale=False" simultaneously for the anchor's confirmed revision.
        if anchor.active_revision_id == exec_draft1_after.id:
            assert exec_draft1_after.core_anchor_revision_id == core_v1_id
            assert anchor.is_stale is True

        # exec_draft2's failed confirm left it exactly as it was -- still draft.
        assert exec_draft2_after.status == "draft"
        assert anchor.active_revision_id != exec_draft2_after.id


async def test_stale_cascade_failure_rolls_back_everything(
    session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    project = Project(name="Demo")
    session.add(project)
    await session.flush()
    shot = Shot(project_id=project.id, name="SH010")
    session.add(shot)
    await session.flush()
    task = Task(shot_id=shot.id, name="Lighting Pass", department="lighting")
    session.add(task)
    await session.flush()

    core_draft1 = await core_anchor_service.create_draft_revision(session, VFX_ACTOR, shot.id, {})
    core_v1 = await core_anchor_service.confirm_revision(session, VFX_ACTOR, core_draft1.id)

    exec_draft = await execution_anchor_service.create_draft_revision(
        session, CG_ACTOR, task.id, {}
    )
    await execution_anchor_service.confirm_revision(session, CG_ACTOR, exec_draft.id)

    core_draft2 = await core_anchor_service.create_draft_revision(session, VFX_ACTOR, shot.id, {})

    real_record_audit_event = audit_service.record_audit_event

    async def failing_record_audit_event(session_arg: AsyncSession, **kwargs: object) -> object:
        if kwargs.get("action") == "execution_anchor.marked_stale":
            raise IntegrityError("INSERT INTO audit_events ...", {}, Exception("forced failure"))
        return await real_record_audit_event(session_arg, **kwargs)  # type: ignore[arg-type]

    monkeypatch.setattr(
        "intent_core_api.audit.service.record_audit_event", failing_record_audit_event
    )

    before_decisions = len((await session.execute(select(Decision))).scalars().all())
    before_transitions = len((await session.execute(select(WorkflowTransition))).scalars().all())
    before_events = len((await session.execute(select(AuditEvent))).scalars().all())

    core_draft2_id = core_draft2.id
    core_v1_id = core_v1.id
    shot_id = shot.id
    task_id = task.id

    with pytest.raises(ConflictError):
        await core_anchor_service.confirm_revision(session, VFX_ACTOR, core_draft2_id)

    after_decisions = (await session.execute(select(Decision))).scalars().all()
    after_transitions = (await session.execute(select(WorkflowTransition))).scalars().all()
    after_events = (await session.execute(select(AuditEvent))).scalars().all()
    assert len(after_decisions) == before_decisions
    assert len(after_transitions) == before_transitions
    assert len(after_events) == before_events

    core_draft2_after = await session.get(CoreAnchorRevision, core_draft2_id)
    core_v1_after = await session.get(CoreAnchorRevision, core_v1_id)
    core_anchor_after = await session.scalar(
        select(CoreAnchor).where(CoreAnchor.shot_id == shot_id)
    )
    exec_anchor_after = await session.scalar(
        select(ExecutionAnchor).where(ExecutionAnchor.task_id == task_id)
    )
    assert core_draft2_after is not None
    assert core_v1_after is not None
    assert core_anchor_after is not None
    assert exec_anchor_after is not None
    await session.refresh(core_draft2_after)
    await session.refresh(core_v1_after)
    await session.refresh(core_anchor_after)
    await session.refresh(exec_anchor_after)

    assert core_draft2_after.status == "draft"
    assert core_v1_after.status == "confirmed"
    assert core_anchor_after.active_revision_id == core_v1_id
    assert exec_anchor_after.is_stale is False


async def test_stale_cascade_processes_deterministically_without_duplicates(
    session: AsyncSession,
) -> None:
    project = Project(name="Demo")
    session.add(project)
    await session.flush()
    shot = Shot(project_id=project.id, name="SH010")
    session.add(shot)
    await session.flush()

    core_draft1 = await core_anchor_service.create_draft_revision(session, VFX_ACTOR, shot.id, {})
    core_v1 = await core_anchor_service.confirm_revision(session, VFX_ACTOR, core_draft1.id)

    anchors = []
    for i in range(3):
        task = Task(shot_id=shot.id, name=f"Task {i}", department="lighting")
        session.add(task)
        await session.flush()
        draft = await execution_anchor_service.create_draft_revision(session, CG_ACTOR, task.id, {})
        await execution_anchor_service.confirm_revision(session, CG_ACTOR, draft.id)
        anchor = await execution_anchor_service.get_execution_anchor_for_task(session, task.id)
        assert anchor is not None
        anchors.append(anchor)

    # Confirm a new Core revision -- marks all three stale.
    core_draft2 = await core_anchor_service.create_draft_revision(session, VFX_ACTOR, shot.id, {})
    await core_anchor_service.confirm_revision(session, VFX_ACTOR, core_draft2.id)

    for anchor in anchors:
        refreshed = await session.get(ExecutionAnchor, anchor.id)
        assert refreshed is not None
        await session.refresh(refreshed)
        assert refreshed.is_stale is True

    # Confirm a THIRD Core revision -- all three anchors are already
    # stale, so no duplicate marked_stale events may be written.
    core_draft3 = await core_anchor_service.create_draft_revision(session, VFX_ACTOR, shot.id, {})
    await core_anchor_service.confirm_revision(session, VFX_ACTOR, core_draft3.id)

    for anchor in anchors:
        events = (
            (
                await session.execute(
                    select(AuditEvent).where(
                        AuditEvent.entity_id == anchor.id,
                        AuditEvent.action == "execution_anchor.marked_stale",
                    )
                )
            )
            .scalars()
            .all()
        )
        assert len(events) == 1

    assert core_v1.id  # keep reference alive for readability of the setup


async def test_cascade_raises_internal_consistency_error_for_unconfirmed_active_revision(
    session: AsyncSession,
) -> None:
    project = Project(name="Demo")
    session.add(project)
    await session.flush()
    shot = Shot(project_id=project.id, name="SH010")
    session.add(shot)
    await session.flush()
    task = Task(shot_id=shot.id, name="Lighting Pass", department="lighting")
    session.add(task)
    await session.flush()

    core_draft1 = await core_anchor_service.create_draft_revision(session, VFX_ACTOR, shot.id, {})
    core_v1 = await core_anchor_service.confirm_revision(session, VFX_ACTOR, core_draft1.id)

    exec_anchor = ExecutionAnchor(task_id=task.id)
    session.add(exec_anchor)
    await session.flush()
    # A revision that is NOT confirmed, referenced directly by
    # active_revision_id -- a data-integrity bug, not reachable through the
    # public API (confirm_revision only ever points active_revision_id at
    # a revision it just confirmed).
    unconfirmed_revision = ExecutionAnchorRevision(
        execution_anchor_id=exec_anchor.id,
        core_anchor_revision_id=core_v1.id,
        revision_number=1,
        status="draft",
        created_by_actor_kind="human",
        created_by_actor_id="cg-1",
        created_by_human_role="cg_supervisor",
    )
    session.add(unconfirmed_revision)
    await session.flush()
    exec_anchor.active_revision_id = unconfirmed_revision.id
    await session.commit()

    core_draft2 = await core_anchor_service.create_draft_revision(session, VFX_ACTOR, shot.id, {})
    core_draft2_id = core_draft2.id

    with pytest.raises(InternalConsistencyError):
        await core_anchor_service.confirm_revision(session, VFX_ACTOR, core_draft2_id)

    # Rollback-safe: the attempted Core confirm left no partial state.
    core_draft2_after = await session.get(CoreAnchorRevision, core_draft2_id)
    assert core_draft2_after is not None
    await session.refresh(core_draft2_after)
    assert core_draft2_after.status == "draft"
