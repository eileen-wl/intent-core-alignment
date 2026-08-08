from __future__ import annotations

import uuid

from httpx import AsyncClient
from intent_core_api.agents.models import AgentRun, ContextSnapshot
from intent_core_api.integrations.models import ExternalEntityLink, WritebackRecord
from intent_core_api.intent.models import CoreAnchor, ExecutionAnchor
from intent_core_api.workflow.models import Decision
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

VFX = {"X-Actor-Role": "vfx_supervisor", "X-Actor-Id": "vfx-1"}
CG = {"X-Actor-Role": "cg_supervisor", "X-Actor-Id": "cg-1"}
ARTIST = {"X-Actor-Role": "artist", "X-Actor-Id": "artist-1"}


async def _create_ftrack_shot(client: AsyncClient) -> str:
    project = (
        await client.post(
            "/projects",
            json={
                "name": "Napo (Animation demo)",
                "source": "ftrack",
                "external_id": "ftrack-project-1",
            },
        )
    ).json()
    shot = (
        await client.post(
            "/shots",
            json={
                "project_id": project["id"],
                "name": "bc0040",
                "source": "ftrack",
                "external_id": "ftrack-shot-1",
            },
        )
    ).json()
    return str(shot["id"])


async def test_vfx_supervisor_can_create_version_for_ftrack_sourced_shot(
    client: AsyncClient,
) -> None:
    shot_id = await _create_ftrack_shot(client)

    response = await client.post(
        "/versions",
        json={
            "shot_id": shot_id,
            "name": "SH010_anim_v001",
            "version_number": 1,
            "description": "First animation pass, blocking only.",
        },
        headers=VFX,
    )

    assert response.status_code == 201
    version = response.json()
    assert version["shot_id"] == shot_id
    assert version["name"] == "SH010_anim_v001"
    assert version["version_number"] == 1
    assert version["description"] == "First animation pass, blocking only."
    assert version["source"] == "manual"
    assert version["created_by_actor_kind"] == "human"
    assert version["created_by_actor_id"] == "vfx-1"
    assert version["created_by_human_role"] == "vfx_supervisor"


async def test_create_version_requires_description(client: AsyncClient) -> None:
    shot_id = await _create_ftrack_shot(client)

    response = await client.post(
        "/versions",
        json={"shot_id": shot_id, "name": "SH010_anim_v001", "description": ""},
        headers=VFX,
    )
    assert response.status_code == 422


async def test_create_version_for_unknown_shot_returns_404(client: AsyncClient) -> None:
    response = await client.post(
        "/versions",
        json={
            "shot_id": "00000000-0000-0000-0000-000000000000",
            "name": "v1",
            "description": "desc",
        },
        headers=VFX,
    )
    assert response.status_code == 404


# Package C follow-up (ADR-0014 Decision 3 amendment, J3 -> J4 Version-
# publish): `task_id` is a plain, optional domain association -- any of
# the three human roles may submit a manually-created Version that
# belongs to one specific Task, mirroring the real "Publish next Version
# from Execution Anchor R2" product action.


async def test_artist_can_publish_version_scoped_to_a_task(client: AsyncClient) -> None:
    shot_id = await _create_ftrack_shot(client)
    task = (
        await client.post(
            "/tasks",
            json={"shot_id": shot_id, "name": "Animation Pass", "source": "manual"},
        )
    ).json()

    response = await client.post(
        "/versions",
        json={
            "shot_id": shot_id,
            "task_id": task["id"],
            "name": "Animation Resolved V2",
            "version_number": 2,
            "description": "Resolved version responding to the confirmed Execution Anchor R2.",
        },
        headers=ARTIST,
    )

    assert response.status_code == 201, response.text
    version = response.json()
    assert version["task_id"] == task["id"]
    assert version["shot_id"] == shot_id
    assert version["source"] == "manual"
    assert version["created_by_human_role"] == "artist"


async def test_create_version_with_task_from_a_different_shot_is_rejected(
    client: AsyncClient,
) -> None:
    shot_id = await _create_ftrack_shot(client)
    other_project = (
        await client.post(
            "/projects",
            json={
                "name": "Other Project",
                "source": "ftrack",
                "external_id": "ftrack-project-other",
            },
        )
    ).json()
    other_shot = (
        await client.post(
            "/shots",
            json={
                "project_id": other_project["id"],
                "name": "bc0099",
                "source": "ftrack",
                "external_id": "ftrack-shot-other",
            },
        )
    ).json()
    other_shot_id = str(other_shot["id"])
    task_on_other_shot = (
        await client.post(
            "/tasks",
            json={"shot_id": other_shot_id, "name": "Lighting Pass", "source": "manual"},
        )
    ).json()

    response = await client.post(
        "/versions",
        json={
            "shot_id": shot_id,
            "task_id": task_on_other_shot["id"],
            "name": "v1",
            "description": "desc",
        },
        headers=ARTIST,
    )

    assert response.status_code == 422, response.text


async def test_create_version_with_unknown_task_id_returns_404(client: AsyncClient) -> None:
    shot_id = await _create_ftrack_shot(client)

    response = await client.post(
        "/versions",
        json={
            "shot_id": shot_id,
            "task_id": "00000000-0000-0000-0000-000000000000",
            "name": "v1",
            "description": "desc",
        },
        headers=ARTIST,
    )

    assert response.status_code == 404


async def test_create_version_without_task_id_still_defaults_to_null(client: AsyncClient) -> None:
    shot_id = await _create_ftrack_shot(client)

    response = await client.post(
        "/versions",
        json={"shot_id": shot_id, "name": "v1", "description": "desc"},
        headers=ARTIST,
    )

    assert response.status_code == 201, response.text
    assert response.json()["task_id"] is None


async def test_human_actor_can_create_review_note_linked_to_correct_version(
    client: AsyncClient,
) -> None:
    shot_id = await _create_ftrack_shot(client)
    version = (
        await client.post(
            "/versions",
            json={"shot_id": shot_id, "name": "v1", "description": "desc"},
            headers=VFX,
        )
    ).json()

    response = await client.post(
        f"/versions/{version['id']}/review-notes",
        json={"content": "Timing on the second beat feels rushed."},
        headers=CG,
    )

    assert response.status_code == 201
    note = response.json()
    assert note["version_id"] == version["id"]
    assert note["content"] == "Timing on the second beat feels rushed."
    assert note["source"] == "manual"
    assert note["created_by_actor_kind"] == "human"
    assert note["created_by_human_role"] == "cg_supervisor"


async def test_create_review_note_for_unknown_version_returns_404(client: AsyncClient) -> None:
    response = await client.post(
        "/versions/00000000-0000-0000-0000-000000000000/review-notes",
        json={"content": "note"},
        headers=VFX,
    )
    assert response.status_code == 404


async def test_create_version_requires_actor_headers(client: AsyncClient) -> None:
    shot_id = await _create_ftrack_shot(client)

    response = await client.post(
        "/versions", json={"shot_id": shot_id, "name": "v1", "description": "desc"}
    )
    assert response.status_code == 401


async def test_create_review_note_rejects_invalid_actor_role(client: AsyncClient) -> None:
    shot_id = await _create_ftrack_shot(client)
    version = (
        await client.post(
            "/versions",
            json={"shot_id": shot_id, "name": "v1", "description": "desc"},
            headers=VFX,
        )
    ).json()

    response = await client.post(
        f"/versions/{version['id']}/review-notes",
        json={"content": "note"},
        headers={"X-Actor-Role": "not_a_role", "X-Actor-Id": "x"},
    )
    assert response.status_code == 401


async def test_list_versions_for_shot(client: AsyncClient) -> None:
    shot_id = await _create_ftrack_shot(client)
    await client.post(
        "/versions", json={"shot_id": shot_id, "name": "v1", "description": "d1"}, headers=VFX
    )
    await client.post(
        "/versions", json={"shot_id": shot_id, "name": "v2", "description": "d2"}, headers=VFX
    )

    response = await client.get(f"/shots/{shot_id}/versions")
    assert response.status_code == 200
    assert [v["name"] for v in response.json()] == ["v1", "v2"]


async def test_list_review_notes_for_version(client: AsyncClient) -> None:
    shot_id = await _create_ftrack_shot(client)
    version = (
        await client.post(
            "/versions",
            json={"shot_id": shot_id, "name": "v1", "description": "d1"},
            headers=VFX,
        )
    ).json()
    await client.post(
        f"/versions/{version['id']}/review-notes", json={"content": "note 1"}, headers=VFX
    )
    await client.post(
        f"/versions/{version['id']}/review-notes", json={"content": "note 2"}, headers=ARTIST
    )

    response = await client.get(f"/versions/{version['id']}/review-notes")
    assert response.status_code == 200
    assert [n["content"] for n in response.json()] == ["note 1", "note 2"]


async def test_manual_version_creates_no_external_entity_link(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot_id = await _create_ftrack_shot(client)
    version = (
        await client.post(
            "/versions",
            json={"shot_id": shot_id, "name": "v1", "description": "d1"},
            headers=VFX,
        )
    ).json()

    links = (
        (
            await session.execute(
                select(ExternalEntityLink).where(
                    ExternalEntityLink.entity_id == uuid.UUID(version["id"])
                )
            )
        )
        .scalars()
        .all()
    )
    assert links == []


async def test_version_and_review_note_creation_touches_no_other_domain_state(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot_id = await _create_ftrack_shot(client)
    version = (
        await client.post(
            "/versions",
            json={"shot_id": shot_id, "name": "v1", "description": "d1"},
            headers=VFX,
        )
    ).json()
    await client.post(
        f"/versions/{version['id']}/review-notes", json={"content": "note"}, headers=VFX
    )

    assert (await session.execute(select(CoreAnchor))).scalars().all() == []
    assert (await session.execute(select(ExecutionAnchor))).scalars().all() == []
    assert (await session.execute(select(Decision))).scalars().all() == []
    assert (await session.execute(select(AgentRun))).scalars().all() == []
    assert (await session.execute(select(ContextSnapshot))).scalars().all() == []
    assert (await session.execute(select(WritebackRecord))).scalars().all() == []
