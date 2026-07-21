"""Direct tests for intent.core_anchor_lock.compare_and_swap_active_revision:
both successful CAS forms (NULL -> id, verify-only id -> same id) and the
error-recognition dispatch (recognised retriable lock/busy/serialization
errors -> 409; anything else re-raised unchanged, never misreported).
"""

from __future__ import annotations

import uuid
from pathlib import Path

import pytest
from intent_core_api.db import Base
from intent_core_api.intent.core_anchor_lock import compare_and_swap_active_revision
from intent_core_api.intent.models import CoreAnchor, CoreAnchorRevision
from intent_core_api.production_context.models import Project, Shot
from intent_core_api.workflow.exceptions import ConflictError
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine


async def _create_anchor_and_confirmed_revision(
    session: AsyncSession,
) -> tuple[CoreAnchor, CoreAnchorRevision]:
    project = Project(name="Demo")
    session.add(project)
    await session.flush()
    shot = Shot(project_id=project.id, name="SH010")
    session.add(shot)
    await session.flush()
    anchor = CoreAnchor(shot_id=shot.id)
    session.add(anchor)
    await session.flush()
    revision = CoreAnchorRevision(
        core_anchor_id=anchor.id,
        revision_number=1,
        status="confirmed",
        created_by_actor_kind="human",
        created_by_actor_id="vfx-1",
        created_by_human_role="vfx_supervisor",
    )
    session.add(revision)
    await session.flush()
    return anchor, revision


async def test_cas_first_confirm_from_null(session: AsyncSession) -> None:
    anchor, revision = await _create_anchor_and_confirmed_revision(session)
    assert anchor.active_revision_id is None

    await compare_and_swap_active_revision(session, anchor.id, None, revision.id)
    await session.commit()

    await session.refresh(anchor)
    assert anchor.active_revision_id == revision.id


async def test_cas_verify_only_same_value_succeeds_on_file_sqlite(tmp_path: Path) -> None:
    db_path = tmp_path / "cas_test.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with factory() as file_session:
            anchor, revision = await _create_anchor_and_confirmed_revision(file_session)
            anchor.active_revision_id = revision.id
            await file_session.commit()

            # Verify-only CAS: expected == new == the already-current value.
            await compare_and_swap_active_revision(
                file_session, anchor.id, revision.id, revision.id
            )
            await file_session.commit()

            await file_session.refresh(anchor)
            assert anchor.active_revision_id == revision.id
    finally:
        await engine.dispose()


async def test_cas_wrong_expected_value_returns_conflict_and_leaves_row_unchanged(
    session: AsyncSession,
) -> None:
    anchor, revision = await _create_anchor_and_confirmed_revision(session)
    anchor.active_revision_id = revision.id
    await session.commit()
    anchor_id = anchor.id
    revision_id = revision.id

    wrong_expected = uuid.uuid4()
    with pytest.raises(ConflictError):
        await compare_and_swap_active_revision(session, anchor_id, wrong_expected, uuid.uuid4())

    anchor_after = await session.get(CoreAnchor, anchor_id)
    assert anchor_after is not None
    await session.refresh(anchor_after)
    assert anchor_after.active_revision_id == revision_id


class _FakeSqliteBusyError:
    sqlite_errorname = "SQLITE_BUSY"


class _FakeSqliteLockedError:
    sqlite_errorname = "SQLITE_LOCKED"


class _FakePostgresSerializationError:
    sqlstate = "40001"


class _FakePostgresDeadlockError:
    sqlstate = "40P01"


class _FakeUnrelatedError:
    """No sqlite_errorname, no sqlstate, generic message -- must never be
    treated as a retriable concurrency conflict."""

    def __str__(self) -> str:
        return "no such table: core_anchors"


@pytest.mark.parametrize(
    "fake_orig",
    [
        _FakeSqliteBusyError(),
        _FakeSqliteLockedError(),
        _FakePostgresSerializationError(),
        _FakePostgresDeadlockError(),
    ],
)
async def test_cas_recognized_retriable_error_maps_to_409(
    session: AsyncSession, fake_orig: object
) -> None:
    error = OperationalError("UPDATE core_anchors ...", {}, fake_orig)  # type: ignore[arg-type]

    async def fake_execute(*args: object, **kwargs: object) -> None:
        raise error

    session.execute = fake_execute  # type: ignore[method-assign]

    with pytest.raises(ConflictError):
        await compare_and_swap_active_revision(session, uuid.uuid4(), None, uuid.uuid4())


async def test_cas_unrecognized_operational_error_is_not_swallowed(session: AsyncSession) -> None:
    error = OperationalError("UPDATE core_anchors ...", {}, _FakeUnrelatedError())  # type: ignore[arg-type]

    async def fake_execute(*args: object, **kwargs: object) -> None:
        raise error

    session.execute = fake_execute  # type: ignore[method-assign]

    with pytest.raises(OperationalError):
        await compare_and_swap_active_revision(session, uuid.uuid4(), None, uuid.uuid4())
