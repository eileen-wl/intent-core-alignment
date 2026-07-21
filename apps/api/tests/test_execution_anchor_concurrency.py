"""Concurrency and database-invariant tests for ExecutionAnchor/
ExecutionAnchorRevision, mirroring test_core_anchor_concurrency.py.
"""

from __future__ import annotations

import asyncio
import uuid
from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from intent_core_api.db import Base
from intent_core_api.intent import core_anchor_service, execution_anchor_service
from intent_core_api.intent.models import ExecutionAnchor, ExecutionAnchorRevision
from intent_core_api.production_context.models import Project, Shot, Task
from intent_core_api.workflow.actors import ActorContext
from intent_core_api.workflow.exceptions import ConflictError, InternalConsistencyError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

VFX_ACTOR = ActorContext(actor_kind="human", actor_id="vfx-1", human_role="vfx_supervisor")
CG_ACTOR = ActorContext(actor_kind="human", actor_id="cg-1", human_role="cg_supervisor")


def _revision_kwargs(
    execution_anchor_id: object, core_anchor_revision_id: object, revision_number: int, status: str
) -> dict[str, object]:
    return {
        "execution_anchor_id": execution_anchor_id,
        "core_anchor_revision_id": core_anchor_revision_id,
        "revision_number": revision_number,
        "status": status,
        "created_by_actor_kind": "human",
        "created_by_actor_id": "cg-1",
        "created_by_human_role": "cg_supervisor",
    }


async def _setup_confirmed_core_revision(session: AsyncSession) -> tuple[uuid.UUID, uuid.UUID]:
    """Returns (shot_id, confirmed CoreAnchorRevision id)."""
    project = Project(name="Demo")
    session.add(project)
    await session.flush()
    shot = Shot(project_id=project.id, name="SH010")
    session.add(shot)
    await session.flush()
    core_draft = await core_anchor_service.create_draft_revision(session, VFX_ACTOR, shot.id, {})
    confirmed = await core_anchor_service.confirm_revision(session, VFX_ACTOR, core_draft.id)
    return shot.id, confirmed.id


async def _create_task(
    session: AsyncSession, shot_id: uuid.UUID, name: str = "Lighting Pass"
) -> uuid.UUID:
    task = Task(shot_id=shot_id, name=name, department="lighting")
    session.add(task)
    await session.flush()
    return task.id


async def test_partial_unique_index_prevents_two_confirmed_revisions(session: AsyncSession) -> None:
    shot_id, core_revision_id = await _setup_confirmed_core_revision(session)
    task_id = await _create_task(session, shot_id)
    anchor = ExecutionAnchor(task_id=task_id)
    session.add(anchor)
    await session.flush()

    session.add(
        ExecutionAnchorRevision(**_revision_kwargs(anchor.id, core_revision_id, 1, "confirmed"))
    )
    await session.flush()

    session.add(
        ExecutionAnchorRevision(**_revision_kwargs(anchor.id, core_revision_id, 2, "confirmed"))
    )
    with pytest.raises(IntegrityError):
        await session.commit()
    await session.rollback()


async def test_unique_revision_number_prevents_duplicate(session: AsyncSession) -> None:
    shot_id, core_revision_id = await _setup_confirmed_core_revision(session)
    task_id = await _create_task(session, shot_id)
    anchor = ExecutionAnchor(task_id=task_id)
    session.add(anchor)
    await session.flush()

    session.add(
        ExecutionAnchorRevision(**_revision_kwargs(anchor.id, core_revision_id, 1, "draft"))
    )
    await session.flush()

    session.add(
        ExecutionAnchorRevision(**_revision_kwargs(anchor.id, core_revision_id, 1, "draft"))
    )
    with pytest.raises(IntegrityError):
        await session.commit()
    await session.rollback()


async def test_confirm_revision_cross_anchor_assertion_guard(session: AsyncSession) -> None:
    shot_id, core_revision_id = await _setup_confirmed_core_revision(session)
    task1_id = await _create_task(session, shot_id, name="Lighting Pass")
    task2_id = await _create_task(session, shot_id, name="Comp Pass")

    anchor1 = ExecutionAnchor(task_id=task1_id)
    anchor2 = ExecutionAnchor(task_id=task2_id)
    session.add_all([anchor1, anchor2])
    await session.flush()

    foreign_revision = ExecutionAnchorRevision(
        **_revision_kwargs(anchor2.id, core_revision_id, 1, "confirmed")
    )
    session.add(foreign_revision)
    await session.flush()

    # Corrupt anchor1 to point at anchor2's revision as its "active" one --
    # simulates a data-integrity bug, not reachable through the public API.
    anchor1.active_revision_id = foreign_revision.id
    await session.flush()

    draft = ExecutionAnchorRevision(**_revision_kwargs(anchor1.id, core_revision_id, 1, "draft"))
    session.add(draft)
    await session.flush()

    with pytest.raises(InternalConsistencyError):
        await execution_anchor_service.confirm_revision(session, CG_ACTOR, draft.id)


async def test_failed_confirm_via_partial_index_leaves_no_partial_writes(
    session: AsyncSession,
) -> None:
    shot_id, core_revision_id = await _setup_confirmed_core_revision(session)
    task_id = await _create_task(session, shot_id)
    anchor = ExecutionAnchor(task_id=task_id)
    session.add(anchor)
    await session.flush()

    already_confirmed = ExecutionAnchorRevision(
        **_revision_kwargs(anchor.id, core_revision_id, 1, "confirmed")
    )
    session.add(already_confirmed)
    await session.flush()

    draft = ExecutionAnchorRevision(**_revision_kwargs(anchor.id, core_revision_id, 2, "draft"))
    session.add(draft)
    await session.commit()

    draft_id = draft.id
    anchor_id = anchor.id

    with pytest.raises(ConflictError):
        await execution_anchor_service.confirm_revision(session, CG_ACTOR, draft_id)

    draft_after = await session.get(ExecutionAnchorRevision, draft_id)
    anchor_after = await session.get(ExecutionAnchor, anchor_id)
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
    db_path = tmp_path / "execution_concurrency.db"
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
        shot_id, _core_revision_id = await _setup_confirmed_core_revision(setup_session)
        task_id = await _create_task(setup_session, shot_id)
        await setup_session.commit()

    async def attempt() -> ExecutionAnchorRevision | ConflictError:
        async with file_db_session_factory() as task_session:
            try:
                return await execution_anchor_service.create_draft_revision(
                    task_session, CG_ACTOR, task_id, {}
                )
            except ConflictError as exc:
                return exc

    results = await asyncio.gather(attempt(), attempt())

    successes = [r for r in results if isinstance(r, ExecutionAnchorRevision)]
    conflicts = [r for r in results if isinstance(r, ConflictError)]
    assert len(successes) + len(conflicts) == 2
    revision_numbers = [s.revision_number for s in successes]
    assert len(revision_numbers) == len(set(revision_numbers))

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
        assert len(anchors) == 1


async def test_concurrent_get_or_create_execution_anchor_returns_same_row(
    file_db_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    async with file_db_session_factory() as setup_session:
        shot_id, _core_revision_id = await _setup_confirmed_core_revision(setup_session)
        task_id = await _create_task(setup_session, shot_id)
        await setup_session.commit()

    async def attempt() -> object:
        async with file_db_session_factory() as task_session:
            anchor = await execution_anchor_service.get_or_create_execution_anchor(
                task_session, task_id
            )
            await task_session.commit()
            return anchor.id

    anchor_ids = await asyncio.gather(attempt(), attempt())
    assert anchor_ids[0] == anchor_ids[1]

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
        assert len(anchors) == 1
