from __future__ import annotations

from typing import Any

from httpx import AsyncClient

VFX = {"X-Actor-Role": "vfx_supervisor", "X-Actor-Id": "vfx-1"}


async def _create_shot(client: AsyncClient) -> str:
    project = (await client.post("/projects", json={"name": "Demo Project"})).json()
    shot = (await client.post("/shots", json={"project_id": project["id"], "name": "SH010"})).json()
    return str(shot["id"])


async def _create_draft(client: AsyncClient, shot_id: str, **content: str) -> dict[str, Any]:
    response = await client.post(
        f"/intent/shots/{shot_id}/core-anchor/drafts", json=content, headers=VFX
    )
    assert response.status_code == 201
    result: dict[str, Any] = response.json()
    return result


async def test_list_revisions_returns_empty_for_shot_with_no_core_anchor(
    client: AsyncClient,
) -> None:
    shot_id = await _create_shot(client)
    response = await client.get(f"/intent/shots/{shot_id}/core-anchor/revisions")
    assert response.status_code == 200
    assert response.json() == []


async def test_list_revisions_returns_empty_for_unknown_shot(client: AsyncClient) -> None:
    response = await client.get(
        "/intent/shots/00000000-0000-0000-0000-000000000000/core-anchor/revisions"
    )
    assert response.status_code == 200
    assert response.json() == []


async def test_list_revisions_returns_all_revisions_oldest_first(client: AsyncClient) -> None:
    shot_id = await _create_shot(client)
    draft1 = await _create_draft(client, shot_id, shot_objective="v1")
    await client.post(f"/intent/core-anchor-revisions/{draft1['id']}/confirm", json={}, headers=VFX)
    draft2 = await _create_draft(client, shot_id, shot_objective="v2")

    response = await client.get(f"/intent/shots/{shot_id}/core-anchor/revisions")
    assert response.status_code == 200
    revisions = response.json()
    assert [r["id"] for r in revisions] == [draft1["id"], draft2["id"]]
    assert revisions[0]["status"] == "confirmed"
    assert revisions[1]["status"] == "draft"
