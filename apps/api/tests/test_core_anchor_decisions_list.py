from __future__ import annotations

from typing import Any

from httpx import AsyncClient

VFX = {"X-Actor-Role": "vfx_supervisor", "X-Actor-Id": "vfx-1"}
CG = {"X-Actor-Role": "cg_supervisor", "X-Actor-Id": "cg-1"}


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


async def test_list_decisions_is_empty_for_a_draft_with_no_decision_yet(
    client: AsyncClient,
) -> None:
    shot_id = await _create_shot(client)
    draft = await _create_draft(client, shot_id)

    response = await client.get(f"/intent/core-anchor-revisions/{draft['id']}/decisions")
    assert response.status_code == 200
    assert response.json() == []


async def test_list_decisions_is_empty_for_an_unknown_revision(client: AsyncClient) -> None:
    response = await client.get(
        "/intent/core-anchor-revisions/00000000-0000-0000-0000-000000000000/decisions"
    )
    assert response.status_code == 200
    assert response.json() == []


async def test_list_decisions_returns_the_confirm_decision_with_rationale(
    client: AsyncClient,
) -> None:
    shot_id = await _create_shot(client)
    draft = await _create_draft(client, shot_id)

    confirm = await client.post(
        f"/intent/core-anchor-revisions/{draft['id']}/confirm",
        json={"rationale": "matches the brief"},
        headers=VFX,
    )
    assert confirm.status_code == 200

    response = await client.get(f"/intent/core-anchor-revisions/{draft['id']}/decisions")
    assert response.status_code == 200
    decisions = response.json()
    assert len(decisions) == 1
    decision = decisions[0]
    assert decision["decision_type"] == "confirm_core_anchor"
    assert decision["owning_human_role"] == "vfx_supervisor"
    assert decision["actor_kind"] == "human"
    assert decision["actor_id"] == "vfx-1"
    assert decision["actor_human_role"] == "vfx_supervisor"
    assert decision["rationale"] == "matches the brief"
    assert decision["entity_type"] == "core_anchor_revision"
    assert decision["entity_id"] == draft["id"]
    assert decision["write_back_requested"] is False
    assert decision["supersedes_decision_id"] is None


async def test_list_decisions_returns_the_reject_decision_with_rationale(
    client: AsyncClient,
) -> None:
    shot_id = await _create_shot(client)
    draft = await _create_draft(client, shot_id)

    reject = await client.post(
        f"/intent/core-anchor-revisions/{draft['id']}/reject",
        json={"rationale": "does not match the brief"},
        headers=VFX,
    )
    assert reject.status_code == 200

    response = await client.get(f"/intent/core-anchor-revisions/{draft['id']}/decisions")
    decisions = response.json()
    assert len(decisions) == 1
    assert decisions[0]["decision_type"] == "reject_core_anchor"
    assert decisions[0]["rationale"] == "does not match the brief"


async def test_list_decisions_does_not_leak_decisions_from_other_revisions(
    client: AsyncClient,
) -> None:
    shot_id = await _create_shot(client)
    draft1 = await _create_draft(client, shot_id, shot_objective="v1")
    await client.post(f"/intent/core-anchor-revisions/{draft1['id']}/confirm", json={}, headers=VFX)
    draft2 = await _create_draft(client, shot_id, shot_objective="v2")
    await client.post(
        f"/intent/core-anchor-revisions/{draft2['id']}/reject",
        json={"rationale": "v2 rejected"},
        headers=VFX,
    )

    draft1_decisions = (
        await client.get(f"/intent/core-anchor-revisions/{draft1['id']}/decisions")
    ).json()
    draft2_decisions = (
        await client.get(f"/intent/core-anchor-revisions/{draft2['id']}/decisions")
    ).json()

    assert len(draft1_decisions) == 1
    assert draft1_decisions[0]["decision_type"] == "confirm_core_anchor"
    assert len(draft2_decisions) == 1
    assert draft2_decisions[0]["decision_type"] == "reject_core_anchor"
    assert draft2_decisions[0]["rationale"] == "v2 rejected"
