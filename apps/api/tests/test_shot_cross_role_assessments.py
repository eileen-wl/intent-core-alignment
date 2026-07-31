"""GET /intent/shots/{shot_id}/cross-role-assessments (Step 7C-3
Alignment Workspace) -- the Shot-scoped listing used by the real
Alignment page, distinct from the existing Version+Task-scoped
GET /intent/versions/{version_id}/cross-role-assessments.
"""

from __future__ import annotations

from typing import Any

from httpx import AsyncClient

VFX = {"X-Actor-Role": "vfx_supervisor", "X-Actor-Id": "vfx-1"}
CG = {"X-Actor-Role": "cg_supervisor", "X-Actor-Id": "cg-1"}
ARTIST = {"X-Actor-Role": "artist", "X-Actor-Id": "artist-1"}


async def _create_shot(client: AsyncClient, shot_name: str = "SH010") -> str:
    project = (await client.post("/projects", json={"name": "Demo Project"})).json()
    shot = (
        await client.post("/shots", json={"project_id": project["id"], "name": shot_name})
    ).json()
    return str(shot["id"])


async def _confirm_core_anchor(client: AsyncClient, shot_id: str) -> None:
    draft = (
        await client.post(
            f"/intent/shots/{shot_id}/core-anchor/drafts",
            json={"core_summary": "A quiet, controlled chase."},
            headers=VFX,
        )
    ).json()
    confirmed = (
        await client.post(
            f"/intent/core-anchor-revisions/{draft['id']}/confirm", json={}, headers=VFX
        )
    ).json()
    assert confirmed["status"] == "confirmed"


async def _create_task(client: AsyncClient, shot_id: str, name: str = "Compositing") -> str:
    task = (
        await client.post("/tasks", json={"shot_id": shot_id, "name": name, "department": "comp"})
    ).json()
    return str(task["id"])


async def _confirm_execution_anchor(client: AsyncClient, task_id: str) -> dict[str, Any]:
    draft = (
        await client.post(
            f"/intent/tasks/{task_id}/execution-anchor/drafts",
            json={"technical_boundaries": "24fps, no motion blur."},
            headers=CG,
        )
    ).json()
    confirmed: dict[str, Any] = (
        await client.post(
            f"/intent/execution-anchor-revisions/{draft['id']}/confirm", json={}, headers=CG
        )
    ).json()
    assert confirmed["status"] == "confirmed"
    return confirmed


async def _create_version(client: AsyncClient, shot_id: str, name: str) -> str:
    version = (
        await client.post(
            "/versions",
            json={"shot_id": shot_id, "name": name, "description": "First pass."},
            headers=VFX,
        )
    ).json()
    return str(version["id"])


async def _generate_ready_assessment(
    client: AsyncClient, shot_id: str, version_name: str
) -> dict[str, Any]:
    """Real end-to-end path to one persisted CrossRoleAssessment: confirmed
    Core Anchor, confirmed Execution Anchor, one Version with all three
    Role Agent outputs, then a real assessment generation call (the
    deterministic provider, forced for the whole suite).
    """
    task_id = await _create_task(client, shot_id)
    confirmed_revision = await _confirm_execution_anchor(client, task_id)
    version_id = await _create_version(client, shot_id, version_name)

    assert (
        await client.post(
            f"/intent/versions/{version_id}/vfx-supervisor-reviews/generate", headers=VFX
        )
    ).status_code == 201
    assert (
        await client.post(
            f"/intent/execution-anchor-revisions/{confirmed_revision['id']}/cg-supervisor-reviews/generate",
            headers=CG,
        )
    ).status_code == 201
    assert (
        await client.post(
            f"/intent/versions/{version_id}/artist-guidances/generate",
            json={"task_id": task_id},
            headers=ARTIST,
        )
    ).status_code == 201

    response = await client.post(
        f"/intent/versions/{version_id}/cross-role-assessments/generate",
        json={"task_id": task_id},
        headers=VFX,
    )
    assert response.status_code == 201
    return response.json()


async def test_returns_empty_list_for_a_shot_with_no_assessment(client: AsyncClient) -> None:
    shot_id = await _create_shot(client)
    response = await client.get(f"/intent/shots/{shot_id}/cross-role-assessments")
    assert response.status_code == 200
    assert response.json() == []


async def test_lists_real_assessments_for_the_shot_newest_first_with_signal_and_proposal_attached(
    client: AsyncClient,
) -> None:
    shot_id = await _create_shot(client)
    await _confirm_core_anchor(client, shot_id)

    first = await _generate_ready_assessment(client, shot_id, "SH010_v001")
    second = await _generate_ready_assessment(client, shot_id, "SH010_v002")

    response = await client.get(f"/intent/shots/{shot_id}/cross-role-assessments")
    assert response.status_code == 200
    body = response.json()

    assert [row["id"] for row in body] == [second["id"], first["id"]]
    for row in body:
        assert row["shot_id"] == shot_id
        assert "intent_signal" in row and row["intent_signal"]["attention_level"] in (
            "low",
            "medium",
            "high",
        )
        # re_anchor_proposal is always present as a key, null or a real object
        # -- never fabricated (matches the per-version+task endpoint's shape).
        assert "re_anchor_proposal" in row


async def test_does_not_include_another_shots_assessment(client: AsyncClient) -> None:
    shot_a = await _create_shot(client, "SH010")
    await _confirm_core_anchor(client, shot_a)
    await _generate_ready_assessment(client, shot_a, "SH010_v001")

    shot_b = await _create_shot(client, "SH020")

    response = await client.get(f"/intent/shots/{shot_b}/cross-role-assessments")
    assert response.status_code == 200
    assert response.json() == []
