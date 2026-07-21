from __future__ import annotations

import uuid

from httpx import AsyncClient
from intent_core_api.intent import brief_service
from intent_core_api.workflow.actors import ActorContext
from intent_core_api.workflow.exceptions import ForbiddenActionError, NotFoundError
from sqlalchemy.ext.asyncio import AsyncSession

VFX = {"X-Actor-Role": "vfx_supervisor", "X-Actor-Id": "vfx-1"}
CG = {"X-Actor-Role": "cg_supervisor", "X-Actor-Id": "cg-1"}
ARTIST = {"X-Actor-Role": "artist", "X-Actor-Id": "artist-1"}


async def _create_shot(client: AsyncClient) -> str:
    project = (await client.post("/projects", json={"name": "Demo Project"})).json()
    shot = (await client.post("/shots", json={"project_id": project["id"], "name": "SH010"})).json()
    return str(shot["id"])


async def test_vfx_supervisor_can_create_brief(client: AsyncClient) -> None:
    shot_id = await _create_shot(client)
    response = await client.post(
        "/intent/briefs",
        json={"shot_id": shot_id, "raw_text": "Establish quiet dread."},
        headers=VFX,
    )
    assert response.status_code == 201
    body = response.json()
    assert body["shot_id"] == shot_id
    assert body["source"] == "manual"
    assert body["created_by_actor_kind"] == "human"
    assert body["created_by_human_role"] == "vfx_supervisor"
    assert body["source_external_id"] is None


async def test_cg_supervisor_cannot_create_brief(client: AsyncClient) -> None:
    shot_id = await _create_shot(client)
    response = await client.post(
        "/intent/briefs", json={"shot_id": shot_id, "raw_text": "..."}, headers=CG
    )
    assert response.status_code == 403


async def test_artist_cannot_create_brief(client: AsyncClient) -> None:
    shot_id = await _create_shot(client)
    response = await client.post(
        "/intent/briefs", json={"shot_id": shot_id, "raw_text": "..."}, headers=ARTIST
    )
    assert response.status_code == 403


async def test_missing_actor_headers_rejected(client: AsyncClient) -> None:
    shot_id = await _create_shot(client)
    response = await client.post("/intent/briefs", json={"shot_id": shot_id, "raw_text": "..."})
    assert response.status_code == 401


async def test_create_brief_for_unknown_shot_returns_404(client: AsyncClient) -> None:
    response = await client.post(
        "/intent/briefs",
        json={"shot_id": str(uuid.uuid4()), "raw_text": "..."},
        headers=VFX,
    )
    assert response.status_code == 404


async def test_get_and_list_briefs(client: AsyncClient) -> None:
    shot_id = await _create_shot(client)
    created = (
        await client.post(
            "/intent/briefs", json={"shot_id": shot_id, "raw_text": "Brief one"}, headers=VFX
        )
    ).json()

    get_response = await client.get(f"/intent/briefs/{created['id']}")
    assert get_response.status_code == 200
    assert get_response.json()["raw_text"] == "Brief one"

    list_response = await client.get(f"/intent/shots/{shot_id}/briefs")
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1


async def test_get_unknown_brief_returns_404(client: AsyncClient) -> None:
    response = await client.get(f"/intent/briefs/{uuid.uuid4()}")
    assert response.status_code == 404


async def test_service_layer_enforces_vfx_only_independent_of_router(session: AsyncSession) -> None:
    """Requirement: brief_service must enforce the role check itself, not
    rely on the router alone. Call the service function directly, bypassing
    any router-level logic entirely."""
    cg_actor = ActorContext(actor_kind="human", actor_id="cg-1", human_role="cg_supervisor")
    try:
        await brief_service.create_brief(session, cg_actor, uuid.uuid4(), "text")
    except ForbiddenActionError:
        pass
    else:
        raise AssertionError("expected ForbiddenActionError")


async def test_service_layer_raises_not_found_for_unknown_shot(session: AsyncSession) -> None:
    vfx_actor = ActorContext(actor_kind="human", actor_id="vfx-1", human_role="vfx_supervisor")
    try:
        await brief_service.create_brief(session, vfx_actor, uuid.uuid4(), "text")
    except NotFoundError:
        pass
    else:
        raise AssertionError("expected NotFoundError")
