"""Step 8C-1: the additive Version/ReviewNote sync-metadata columns
(docs/step-8/02_STEP_8B_VERSION_NOTE_SYNC_CONTRACT.md §13, ADR-0014).

This slice adds only nullable columns and a nullable FK -- no public
contract, router, or service change. Rows are therefore built directly
at the model layer (matching the existing precedent in
test_core_anchor_semantic_objects.py/test_core_anchor_concurrency.py for
model-layer-only scenarios), except where the point of the test is that
the existing manual HTTP creation path is untouched.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import pytest
from httpx import AsyncClient
from intent_core_api.production_context.models import Project, Shot, Task
from intent_core_api.versions_and_feedback.models import ReviewNote, Version
from sqlalchemy import event, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

VFX = {"X-Actor-Role": "vfx_supervisor", "X-Actor-Id": "vfx-1"}


async def _create_project_shot(session: AsyncSession) -> Shot:
    project = Project(name="Demo")
    session.add(project)
    await session.flush()
    shot = Shot(project_id=project.id, name="SH010")
    session.add(shot)
    await session.flush()
    return shot


def _version_kwargs(shot_id: uuid.UUID, **overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "shot_id": shot_id,
        "name": "v1",
        "version_number": 1,
        "description": "desc",
        "source": "manual",
        "created_by_actor_kind": "human",
        "created_by_actor_id": "vfx-1",
        "created_by_human_role": "vfx_supervisor",
    }
    base.update(overrides)
    return base


async def test_version_task_id_defaults_to_null(session: AsyncSession) -> None:
    shot = await _create_project_shot(session)
    version = Version(**_version_kwargs(shot.id))
    session.add(version)
    await session.commit()
    await session.refresh(version)

    assert version.task_id is None
    assert version.source_created_at is None
    assert version.external_author_id is None
    assert version.external_author_name is None


async def test_version_may_reference_a_real_task(session: AsyncSession) -> None:
    shot = await _create_project_shot(session)
    task = Task(shot_id=shot.id, name="Compositing")
    session.add(task)
    await session.flush()

    version = Version(**_version_kwargs(shot.id, task_id=task.id))
    session.add(version)
    await session.commit()
    await session.refresh(version)

    reloaded = await session.get(Version, version.id)
    assert reloaded is not None
    assert reloaded.task_id == task.id
    # shot_id remains required and unaffected by the optional task_id.
    assert reloaded.shot_id == shot.id


async def test_version_provenance_fields_accept_real_values(session: AsyncSession) -> None:
    shot = await _create_project_shot(session)
    source_created_at = datetime(2025, 5, 13, 13, 40, 52, tzinfo=UTC)
    version = Version(
        **_version_kwargs(
            shot.id,
            source_created_at=source_created_at,
            external_author_id="ftrack-user-42",
            external_author_name="Jane Reviewer",
        )
    )
    session.add(version)
    await session.commit()
    await session.refresh(version)

    reloaded = await session.get(Version, version.id)
    assert reloaded is not None
    assert reloaded.source_created_at is not None
    # SQLite (this fixture's dialect) has no distinct timezone-aware
    # storage type -- see 0010's own migration docstring -- so only the
    # wall-clock value round-trips here; real tz-preservation is already
    # confirmed at the Postgres migration layer (timestamptz column).
    assert reloaded.source_created_at.replace(tzinfo=UTC) == source_created_at
    assert reloaded.external_author_id == "ftrack-user-42"
    assert reloaded.external_author_name == "Jane Reviewer"
    # created_at keeps its existing ICAS-ingestion-time meaning -- never
    # overwritten or derived from source_created_at.
    assert reloaded.created_at is not None
    assert reloaded.created_at != source_created_at


async def test_review_note_provenance_fields_accept_values_and_may_be_null(
    session: AsyncSession,
) -> None:
    shot = await _create_project_shot(session)
    version = Version(**_version_kwargs(shot.id))
    session.add(version)
    await session.flush()

    note_with_provenance = ReviewNote(
        version_id=version.id,
        content="Client feedback synced from ftrack.",
        source="ftrack",
        source_created_at=datetime(2025, 5, 20, 9, 56, 12, tzinfo=UTC),
        external_author_id="ftrack-author-7",
        external_author_name="Mrs. Client",
        created_by_actor_kind="system",
        created_by_actor_id="ftrack-sync",
        created_by_human_role=None,
    )
    note_manual = ReviewNote(
        version_id=version.id,
        content="Manual note, no ftrack provenance.",
        source="manual",
        created_by_actor_kind="human",
        created_by_actor_id="vfx-1",
        created_by_human_role="vfx_supervisor",
    )
    session.add_all([note_with_provenance, note_manual])
    await session.commit()

    reloaded_with_provenance = await session.get(ReviewNote, note_with_provenance.id)
    assert reloaded_with_provenance is not None
    assert reloaded_with_provenance.external_author_id == "ftrack-author-7"
    assert reloaded_with_provenance.external_author_name == "Mrs. Client"
    assert reloaded_with_provenance.source_created_at is not None
    # Neither author field is, or grants, a human_role/authority.
    assert reloaded_with_provenance.created_by_human_role is None

    reloaded_manual = await session.get(ReviewNote, note_manual.id)
    assert reloaded_manual is not None
    assert reloaded_manual.source_created_at is None
    assert reloaded_manual.external_author_id is None
    assert reloaded_manual.external_author_name is None


async def test_review_note_still_requires_a_version(session: AsyncSession) -> None:
    note = ReviewNote(
        version_id=None,
        content="orphan note",
        source="manual",
        created_by_actor_kind="human",
        created_by_actor_id="vfx-1",
        created_by_human_role="vfx_supervisor",
    )
    session.add(note)
    with pytest.raises(IntegrityError):
        await session.commit()
    await session.rollback()


async def test_existing_manual_version_creation_via_api_unchanged(client: AsyncClient) -> None:
    """The public *create* path (request shape, service behavior) is
    untouched by this slice -- as of Step 8C-2, the *response* shape
    legitimately gains the new nullable read-only fields (that is Step
    8C-2's own explicit deliverable: extending VersionRead), all null
    here since this row was created manually, with no ftrack provenance."""
    project = (await client.post("/projects", json={"name": "Napo (Animation demo)"})).json()
    shot = (
        await client.post("/shots", json={"project_id": project["id"], "name": "bc0040"})
    ).json()

    response = await client.post(
        "/versions",
        json={
            "shot_id": shot["id"],
            "name": "SH010_anim_v001",
            "version_number": 1,
            "description": "First animation pass, blocking only.",
        },
        headers=VFX,
    )

    assert response.status_code == 201
    version = response.json()
    assert set(version.keys()) == {
        "id",
        "shot_id",
        "name",
        "version_number",
        "description",
        "source",
        "created_by_actor_kind",
        "created_by_actor_id",
        "created_by_human_role",
        "created_at",
        "task_id",
        "source_created_at",
        "external_author_id",
        "external_author_name",
    }
    assert version["source"] == "manual"
    assert version["task_id"] is None
    assert version["source_created_at"] is None
    assert version["external_author_id"] is None
    assert version["external_author_name"] is None


async def test_deleting_task_clears_version_task_id_without_deleting_version() -> None:
    """The FK's ondelete="SET NULL" policy: a Version created against a
    real Task must survive that Task being deleted, with only task_id
    cleared. SQLite does not enforce FK actions unless explicitly turned
    on per-connection, so this uses its own engine with `PRAGMA
    foreign_keys=ON` rather than the shared in-memory `session` fixture,
    to genuinely exercise the ondelete clause (not just document intent).
    """
    from intent_core_api.db import Base

    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine.sync_engine, "connect")
    def _enable_sqlite_fk(dbapi_connection, _connection_record) -> None:  # type: ignore[no-untyped-def]
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    try:
        async with factory() as session:
            shot = await _create_project_shot(session)
            task = Task(shot_id=shot.id, name="Rotoscoping")
            session.add(task)
            await session.flush()
            version = Version(**_version_kwargs(shot.id, task_id=task.id))
            session.add(version)
            await session.commit()
            version_id = version.id
            task_id = task.id

            await session.delete(task)
            await session.commit()
            # ON DELETE SET NULL happens DB-side; the ORM identity map's
            # already-loaded `version` object doesn't know about it until
            # explicitly refreshed (this factory uses expire_on_commit=False,
            # matching the repository's shared `session` fixture convention).
            session.expire_all()

            surviving_version = await session.get(Version, version_id)
            assert surviving_version is not None, "Version must survive its Task being deleted"
            assert surviving_version.task_id is None

            remaining_task = (
                await session.execute(select(Task).where(Task.id == task_id))
            ).scalar_one_or_none()
            assert remaining_task is None
    finally:
        await engine.dispose()
