"""Step 8C-3: trusted internal ftrack Version/ReviewNote sync endpoints
(docs/step-8/02_STEP_8B_VERSION_NOTE_SYNC_CONTRACT.md, ADR-0014).
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from httpx import AsyncClient
from intent_core_api.config import get_settings
from intent_core_api.integrations.external_link_service import record_external_link
from intent_core_api.integrations.models import ExternalEntityLink
from intent_core_api.production_context.models import Project, Shot, Task
from intent_core_api.versions_and_feedback.models import ReviewNote, Version
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

INTERNAL_TOKEN = "test-internal-sync-token"
INTERNAL_HEADERS = {"X-Internal-Sync-Token": INTERNAL_TOKEN}
VFX = {"X-Actor-Role": "vfx_supervisor", "X-Actor-Id": "vfx-1"}


async def _linked_shot(session: AsyncSession, *, external_id: str = "ftrack-shot-1") -> Shot:
    project = Project(name="Napo (Animation demo)")
    session.add(project)
    await session.flush()
    shot = Shot(project_id=project.id, name="bc0040")
    session.add(shot)
    await session.flush()
    await record_external_link(
        session, entity_type="shot", entity_id=shot.id, source="ftrack", external_id=external_id
    )
    await session.commit()
    return shot


async def _linked_task(
    session: AsyncSession, shot: Shot, *, external_id: str = "ftrack-task-1"
) -> Task:
    task = Task(shot_id=shot.id, name="Compositing")
    session.add(task)
    await session.flush()
    await record_external_link(
        session, entity_type="task", entity_id=task.id, source="ftrack", external_id=external_id
    )
    await session.commit()
    return task


async def _linked_version(
    session: AsyncSession, shot: Shot, *, external_id: str = "ftrack-version-1"
) -> Version:
    version = Version(
        shot_id=shot.id,
        name="bc0040_comp_v001",
        version_number=1,
        description="",
        source="ftrack",
        created_by_actor_kind="system",
        created_by_actor_id="ftrack-sync",
    )
    session.add(version)
    await session.flush()
    await record_external_link(
        session,
        entity_type="version",
        entity_id=version.id,
        source="ftrack",
        external_id=external_id,
    )
    await session.commit()
    return version


def _version_payload(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "external_id": "ftrack-version-1",
        "shot_external_id": "ftrack-shot-1",
        "name": "bc0040_comp_v001",
        "version_number": 1,
        "description": "",
        "source_created_at": "2025-05-13T13:40:52+00:00",
    }
    base.update(overrides)
    return base


def _note_payload(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "external_id": "ftrack-note-1",
        "version_external_id": "ftrack-version-1",
        "content": "Whats this hard line? Can probably be cropped out.",
        "source_created_at": "2025-05-20T09:56:12+00:00",
    }
    base.update(overrides)
    return base


# --- Authentication ---------------------------------------------------


async def test_valid_token_is_accepted(client: AsyncClient, session: AsyncSession) -> None:
    await _linked_shot(session)
    response = await client.post(
        "/internal/sync/versions", json=_version_payload(), headers=INTERNAL_HEADERS
    )
    assert response.status_code == 201


async def test_missing_token_is_rejected(client: AsyncClient, session: AsyncSession) -> None:
    await _linked_shot(session)
    response = await client.post("/internal/sync/versions", json=_version_payload())
    assert response.status_code == 401
    assert "test-internal-sync-token" not in response.text


async def test_incorrect_token_is_rejected(client: AsyncClient, session: AsyncSession) -> None:
    await _linked_shot(session)
    response = await client.post(
        "/internal/sync/versions",
        json=_version_payload(),
        headers={"X-Internal-Sync-Token": "wrong-token"},
    )
    assert response.status_code == 401
    assert "wrong-token" not in response.text
    assert INTERNAL_TOKEN not in response.text


async def test_missing_server_configuration_fails_closed(
    client: AsyncClient, session: AsyncSession, monkeypatch: object
) -> None:
    await _linked_shot(session)
    monkeypatch.setenv("INTERNAL_SYNC_TOKEN", "")  # type: ignore[attr-defined]
    get_settings.cache_clear()
    try:
        response = await client.post(
            "/internal/sync/versions",
            json=_version_payload(),
            headers=INTERNAL_HEADERS,
        )
        assert response.status_code == 503
        assert INTERNAL_TOKEN not in response.text
    finally:
        get_settings.cache_clear()


async def test_human_role_headers_alone_are_insufficient(
    client: AsyncClient, session: AsyncSession
) -> None:
    await _linked_shot(session)
    response = await client.post("/internal/sync/versions", json=_version_payload(), headers=VFX)
    assert response.status_code == 401


async def test_token_is_not_echoed_in_a_response_or_error(
    client: AsyncClient, session: AsyncSession
) -> None:
    await _linked_shot(session)
    ok = await client.post(
        "/internal/sync/versions", json=_version_payload(), headers=INTERNAL_HEADERS
    )
    assert INTERNAL_TOKEN not in ok.text
    bad = await client.post(
        "/internal/sync/versions",
        json=_version_payload(external_id="ftrack-version-2"),
        headers={"X-Internal-Sync-Token": "nope"},
    )
    assert INTERNAL_TOKEN not in bad.text
    assert "nope" not in bad.text


# --- Linked-Shot enumeration (Step 8C-4/8C-5) ------------------------------


async def test_linked_shots_requires_internal_token(
    client: AsyncClient, session: AsyncSession
) -> None:
    response = await client.get("/internal/sync/linked-shots")
    assert response.status_code == 401


async def test_linked_shots_returns_only_shot_id_and_external_id(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot = await _linked_shot(session)
    response = await client.get("/internal/sync/linked-shots", headers=INTERNAL_HEADERS)
    assert response.status_code == 200
    body = response.json()
    assert body == [{"shot_id": str(shot.id), "shot_external_id": "ftrack-shot-1"}]


async def test_linked_shots_excludes_unrelated_links(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot = await _linked_shot(session)
    # A Task link and a non-"ftrack" source link must never appear.
    await _linked_task(session, shot)
    other_shot = Shot(project_id=shot.project_id, name="other")
    session.add(other_shot)
    await session.flush()
    await record_external_link(
        session,
        entity_type="shot",
        entity_id=other_shot.id,
        source="demo",
        external_id="demo-shot-1",
    )
    await session.commit()

    response = await client.get("/internal/sync/linked-shots", headers=INTERNAL_HEADERS)
    body = response.json()
    assert body == [{"shot_id": str(shot.id), "shot_external_id": "ftrack-shot-1"}]


async def test_linked_shots_empty_when_none_linked(
    client: AsyncClient, session: AsyncSession
) -> None:
    response = await client.get("/internal/sync/linked-shots", headers=INTERNAL_HEADERS)
    assert response.status_code == 200
    assert response.json() == []


# --- Version sync -------------------------------------------------------


async def test_version_sync_creates_with_resolved_shot_and_task(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot = await _linked_shot(session)
    await _linked_task(session, shot)

    response = await client.post(
        "/internal/sync/versions",
        json=_version_payload(task_external_id="ftrack-task-1"),
        headers=INTERNAL_HEADERS,
    )
    assert response.status_code == 201
    body = response.json()
    assert body["outcome"] == "created"
    assert body["reason"] is None

    version = await session.get(Version, uuid.UUID(body["entity_id"]))
    assert version is not None
    assert version.shot_id == shot.id
    assert version.task_id is not None


async def test_version_sync_creates_with_task_external_id_absent(
    client: AsyncClient, session: AsyncSession
) -> None:
    await _linked_shot(session)
    response = await client.post(
        "/internal/sync/versions", json=_version_payload(), headers=INTERNAL_HEADERS
    )
    assert response.status_code == 201
    body = response.json()
    assert body["outcome"] == "created"
    version = await session.get(Version, uuid.UUID(body["entity_id"]))
    assert version is not None
    assert version.task_id is None


async def test_version_sync_unresolved_task_produces_null_task_id(
    client: AsyncClient, session: AsyncSession
) -> None:
    await _linked_shot(session)
    response = await client.post(
        "/internal/sync/versions",
        json=_version_payload(task_external_id="ftrack-task-does-not-exist"),
        headers=INTERNAL_HEADERS,
    )
    assert response.status_code == 201
    body = response.json()
    assert body["outcome"] == "created"
    assert body["reason"] == "task_not_linked"
    version = await session.get(Version, uuid.UUID(body["entity_id"]))
    assert version is not None
    assert version.task_id is None


async def test_version_sync_unresolved_shot_is_skipped_and_writes_nothing(
    client: AsyncClient, session: AsyncSession
) -> None:
    response = await client.post(
        "/internal/sync/versions",
        json=_version_payload(shot_external_id="ftrack-shot-does-not-exist"),
        headers=INTERNAL_HEADERS,
    )
    assert response.status_code == 201
    body = response.json()
    assert body["outcome"] == "skipped"
    assert body["entity_id"] is None
    assert body["reason"] == "shot_not_linked"

    assert (await session.execute(select(Version))).scalars().all() == []
    assert (await session.execute(select(ExternalEntityLink))).scalars().all() == []


async def test_version_sync_repeat_request_returns_already_exists_and_mutates_nothing(
    client: AsyncClient, session: AsyncSession
) -> None:
    await _linked_shot(session)
    first = await client.post(
        "/internal/sync/versions", json=_version_payload(), headers=INTERNAL_HEADERS
    )
    assert first.json()["outcome"] == "created"
    first_entity_id = first.json()["entity_id"]

    second = await client.post(
        "/internal/sync/versions",
        json=_version_payload(name="renamed", description="changed"),
        headers=INTERNAL_HEADERS,
    )
    assert second.status_code == 201
    body = second.json()
    assert body["outcome"] == "already_exists"
    assert body["entity_id"] == first_entity_id

    versions = (await session.execute(select(Version))).scalars().all()
    assert len(versions) == 1
    assert versions[0].name == "bc0040_comp_v001"  # unchanged, not "renamed"


async def test_version_sync_link_failure_leaves_no_version_row(
    client: AsyncClient, session: AsyncSession
) -> None:
    await _linked_shot(session)
    # Pre-occupy the (source, external_id) slot with an unrelated entity
    # type -- find_linked_entity_id(entity_type="version", ...) won't
    # find it (idempotency check passes), but ExternalEntityLink's own
    # UNIQUE(source, external_id) constraint still collides at commit
    # time, simulating a genuine concurrent-duplicate race.
    other_task = Task(shot_id=(await _linked_shot(session, external_id="other-shot")).id, name="x")
    session.add(other_task)
    await session.flush()
    await record_external_link(
        session,
        entity_type="task",
        entity_id=other_task.id,
        source="ftrack",
        external_id="ftrack-version-1",
    )
    await session.commit()

    response = await client.post(
        "/internal/sync/versions", json=_version_payload(), headers=INTERNAL_HEADERS
    )
    assert response.status_code == 409
    assert (await session.execute(select(Version))).scalars().all() == []


async def test_version_sync_hardcodes_source_and_actor_provenance(
    client: AsyncClient, session: AsyncSession
) -> None:
    await _linked_shot(session)
    response = await client.post(
        "/internal/sync/versions",
        json=_version_payload(external_author_id="ftrack-user-42", external_author_name="Jane"),
        headers=INTERNAL_HEADERS,
    )
    body = response.json()
    version = await session.get(Version, uuid.UUID(body["entity_id"]))
    assert version is not None
    assert version.source == "ftrack"
    assert version.created_by_actor_kind == "system"
    assert version.created_by_actor_id == "ftrack-sync"
    assert version.created_by_human_role is None


async def test_version_sync_persists_source_created_at_and_external_author(
    client: AsyncClient, session: AsyncSession
) -> None:
    await _linked_shot(session)
    response = await client.post(
        "/internal/sync/versions",
        json=_version_payload(
            external_author_id="ftrack-user-42", external_author_name="Jane Reviewer"
        ),
        headers=INTERNAL_HEADERS,
    )
    body = response.json()
    version = await session.get(Version, uuid.UUID(body["entity_id"]))
    assert version is not None
    # SQLite (this fixture's dialect) has no distinct timezone-aware
    # storage type (see migration 0010's own docstring), so only the
    # wall-clock value round-trips here.
    assert version.source_created_at is not None
    assert version.source_created_at.replace(tzinfo=UTC) == datetime(
        2025, 5, 13, 13, 40, 52, tzinfo=UTC
    )
    assert version.external_author_id == "ftrack-user-42"
    assert version.external_author_name == "Jane Reviewer"
    # created_at stays ICAS ingestion time -- never overwritten with
    # source_created_at.
    assert version.created_at is not None
    assert version.created_at.replace(tzinfo=UTC) != version.source_created_at


async def test_version_sync_leaves_existing_manual_versions_untouched(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot = await _linked_shot(session)
    manual = Version(
        shot_id=shot.id,
        name="manual-v1",
        description="d",
        source="manual",
        created_by_actor_kind="human",
        created_by_actor_id="vfx-1",
        created_by_human_role="vfx_supervisor",
    )
    session.add(manual)
    await session.commit()

    await client.post("/internal/sync/versions", json=_version_payload(), headers=INTERNAL_HEADERS)

    reloaded = await session.get(Version, manual.id)
    assert reloaded is not None
    assert reloaded.source == "manual"
    assert reloaded.name == "manual-v1"


# --- ReviewNote sync ------------------------------------------------------


async def test_review_note_sync_creates_against_linked_version(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot = await _linked_shot(session)
    version = await _linked_version(session, shot)

    response = await client.post(
        "/internal/sync/review-notes", json=_note_payload(), headers=INTERNAL_HEADERS
    )
    assert response.status_code == 201
    body = response.json()
    assert body["outcome"] == "created"

    note = await session.get(ReviewNote, uuid.UUID(body["entity_id"]))
    assert note is not None
    assert note.version_id == version.id


async def test_review_note_sync_unresolved_version_is_skipped_and_writes_nothing(
    client: AsyncClient, session: AsyncSession
) -> None:
    response = await client.post(
        "/internal/sync/review-notes",
        json=_note_payload(version_external_id="ftrack-version-does-not-exist"),
        headers=INTERNAL_HEADERS,
    )
    assert response.status_code == 201
    body = response.json()
    assert body["outcome"] == "skipped"
    assert body["entity_id"] is None
    assert body["reason"] == "version_not_linked"
    assert (await session.execute(select(ReviewNote))).scalars().all() == []


async def test_review_note_sync_repeat_request_returns_already_exists_and_mutates_nothing(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot = await _linked_shot(session)
    await _linked_version(session, shot)

    first = await client.post(
        "/internal/sync/review-notes", json=_note_payload(), headers=INTERNAL_HEADERS
    )
    first_entity_id = first.json()["entity_id"]

    second = await client.post(
        "/internal/sync/review-notes",
        json=_note_payload(content="edited content"),
        headers=INTERNAL_HEADERS,
    )
    assert second.status_code == 201
    body = second.json()
    assert body["outcome"] == "already_exists"
    assert body["entity_id"] == first_entity_id

    notes = (await session.execute(select(ReviewNote))).scalars().all()
    assert len(notes) == 1
    assert notes[0].content != "edited content"


async def test_review_note_sync_link_failure_leaves_no_review_note_row(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot = await _linked_shot(session)
    await _linked_version(session, shot)

    other_task = Task(shot_id=shot.id, name="x")
    session.add(other_task)
    await session.flush()
    await record_external_link(
        session,
        entity_type="task",
        entity_id=other_task.id,
        source="ftrack",
        external_id="ftrack-note-1",
    )
    await session.commit()

    response = await client.post(
        "/internal/sync/review-notes", json=_note_payload(), headers=INTERNAL_HEADERS
    )
    assert response.status_code == 409
    assert (await session.execute(select(ReviewNote))).scalars().all() == []


async def test_review_note_sync_hardcodes_source_and_actor_provenance(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot = await _linked_shot(session)
    await _linked_version(session, shot)

    response = await client.post(
        "/internal/sync/review-notes", json=_note_payload(), headers=INTERNAL_HEADERS
    )
    body = response.json()
    note = await session.get(ReviewNote, uuid.UUID(body["entity_id"]))
    assert note is not None
    assert note.source == "ftrack"
    assert note.created_by_actor_kind == "system"
    assert note.created_by_actor_id == "ftrack-sync"
    assert note.created_by_human_role is None


async def test_review_note_sync_persists_source_created_at_and_external_author(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot = await _linked_shot(session)
    await _linked_version(session, shot)

    response = await client.post(
        "/internal/sync/review-notes",
        json=_note_payload(
            external_author_id="ftrack-author-7", external_author_name="Mrs. Client"
        ),
        headers=INTERNAL_HEADERS,
    )
    body = response.json()
    note = await session.get(ReviewNote, uuid.UUID(body["entity_id"]))
    assert note is not None
    assert note.source_created_at is not None
    assert note.source_created_at.replace(tzinfo=UTC) == datetime(
        2025, 5, 20, 9, 56, 12, tzinfo=UTC
    )
    assert note.external_author_id == "ftrack-author-7"
    assert note.external_author_name == "Mrs. Client"


async def test_review_note_sync_leaves_existing_manual_notes_untouched(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot = await _linked_shot(session)
    version = await _linked_version(session, shot)
    manual = ReviewNote(
        version_id=version.id,
        content="manual note",
        source="manual",
        created_by_actor_kind="human",
        created_by_actor_id="vfx-1",
        created_by_human_role="vfx_supervisor",
    )
    session.add(manual)
    await session.commit()

    await client.post("/internal/sync/review-notes", json=_note_payload(), headers=INTERNAL_HEADERS)

    reloaded = await session.get(ReviewNote, manual.id)
    assert reloaded is not None
    assert reloaded.source == "manual"
    assert reloaded.content == "manual note"


# --- Contract / public-boundary regression --------------------------------


async def test_public_version_create_still_rejects_source(client: AsyncClient) -> None:
    project = (await client.post("/projects", json={"name": "Demo"})).json()
    shot = (await client.post("/shots", json={"project_id": project["id"], "name": "SH010"})).json()
    response = await client.post(
        "/versions",
        json={
            "shot_id": shot["id"],
            "name": "v1",
            "description": "d",
            "source": "ftrack",
        },
        headers=VFX,
    )
    assert response.status_code == 422


async def test_public_review_note_create_still_rejects_source(client: AsyncClient) -> None:
    project = (await client.post("/projects", json={"name": "Demo"})).json()
    shot = (await client.post("/shots", json={"project_id": project["id"], "name": "SH010"})).json()
    version = (
        await client.post(
            "/versions",
            json={"shot_id": shot["id"], "name": "v1", "description": "d"},
            headers=VFX,
        )
    ).json()
    response = await client.post(
        f"/versions/{version['id']}/review-notes",
        json={"content": "note", "source": "ftrack"},
        headers=VFX,
    )
    assert response.status_code == 422


async def test_internal_version_sync_rejects_supplied_source(
    client: AsyncClient, session: AsyncSession
) -> None:
    await _linked_shot(session)
    response = await client.post(
        "/internal/sync/versions",
        json=_version_payload(source="ftrack"),
        headers=INTERNAL_HEADERS,
    )
    assert response.status_code == 422


async def test_internal_version_sync_rejects_naive_source_created_at(
    client: AsyncClient, session: AsyncSession
) -> None:
    await _linked_shot(session)
    response = await client.post(
        "/internal/sync/versions",
        json=_version_payload(source_created_at="2025-05-13T13:40:52"),
        headers=INTERNAL_HEADERS,
    )
    assert response.status_code == 422


async def test_internal_review_note_sync_rejects_malformed_source_created_at(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot = await _linked_shot(session)
    await _linked_version(session, shot)
    response = await client.post(
        "/internal/sync/review-notes",
        json=_note_payload(source_created_at="not-a-timestamp"),
        headers=INTERNAL_HEADERS,
    )
    assert response.status_code == 422
