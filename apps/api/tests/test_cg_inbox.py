"""GET /cg/inbox and GET /cg/inbox/{task_id} (Step 7C-4).

Builds real prerequisite chains through the real HTTP endpoints (same
pattern as test_vfx_inbox.py) rather than raw model construction.
"""

from __future__ import annotations

from typing import Any

from httpx import AsyncClient

VFX = {"X-Actor-Role": "vfx_supervisor", "X-Actor-Id": "vfx-1"}
CG = {"X-Actor-Role": "cg_supervisor", "X-Actor-Id": "cg-1"}
ARTIST = {"X-Actor-Role": "artist", "X-Actor-Id": "artist-1"}


async def _create_project_and_shot(
    client: AsyncClient, shot_name: str = "SH010"
) -> tuple[str, str]:
    project = (await client.post("/projects", json={"name": "Demo Project"})).json()
    shot = (
        await client.post("/shots", json={"project_id": project["id"], "name": shot_name})
    ).json()
    return str(project["id"]), str(shot["id"])


async def _confirm_core_anchor(client: AsyncClient, shot_id: str) -> None:
    draft = (
        await client.post(
            f"/intent/shots/{shot_id}/core-anchor/drafts",
            json={"core_summary": "A quiet, controlled chase."},
            headers=VFX,
        )
    ).json()
    await client.post(
        f"/intent/core-anchor-revisions/{draft['id']}/confirm", json={}, headers=VFX
    )


async def _create_task(client: AsyncClient, shot_id: str, name: str = "Lighting") -> str:
    task = (
        await client.post(
            "/tasks", json={"shot_id": shot_id, "name": name, "department": "lighting"}
        )
    ).json()
    return str(task["id"])


async def _create_draft_execution_anchor(client: AsyncClient, task_id: str) -> dict[str, Any]:
    response = await client.post(
        f"/intent/tasks/{task_id}/execution-anchor/drafts",
        json={"technical_boundaries": "24fps, no motion blur."},
        headers=CG,
    )
    assert response.status_code == 201
    return response.json()


async def _confirm_execution_anchor(client: AsyncClient, draft_id: str) -> None:
    response = await client.post(
        f"/intent/execution-anchor-revisions/{draft_id}/confirm", json={}, headers=CG
    )
    assert response.status_code == 200


async def _create_version(client: AsyncClient, shot_id: str, name: str = "SH010_v001") -> str:
    version = (
        await client.post(
            "/versions",
            json={"shot_id": shot_id, "name": name, "description": "First pass."},
            headers=VFX,
        )
    ).json()
    return str(version["id"])


async def test_returns_empty_when_no_tasks_exist(client: AsyncClient) -> None:
    response = await client.get("/cg/inbox")
    assert response.status_code == 200
    assert response.json()["items"] == []


async def test_none_focus_for_a_bare_task(client: AsyncClient) -> None:
    _project_id, shot_id = await _create_project_and_shot(client)
    await _create_task(client, shot_id)

    response = await client.get("/cg/inbox")
    item = response.json()["items"][0]
    assert item["current_focus"]["focus_type"] == "none"
    assert item["execution_anchor_state"] == "none"


async def test_execution_anchor_gate_pending_focus(client: AsyncClient) -> None:
    _project_id, shot_id = await _create_project_and_shot(client)
    await _confirm_core_anchor(client, shot_id)
    task_id = await _create_task(client, shot_id)
    await _create_draft_execution_anchor(client, task_id)

    response = await client.get(f"/cg/inbox/{task_id}")
    item = response.json()
    assert item["current_focus"]["focus_type"] == "execution_anchor_gate_pending"
    assert item["current_focus"]["target_route"] == f"/cg/tasks/{task_id}/execution"
    assert item["execution_anchor_state"] == "draft_pending"


async def test_execution_anchor_confirmed_state(client: AsyncClient) -> None:
    _project_id, shot_id = await _create_project_and_shot(client)
    await _confirm_core_anchor(client, shot_id)
    task_id = await _create_task(client, shot_id)
    draft = await _create_draft_execution_anchor(client, task_id)
    await _confirm_execution_anchor(client, draft["id"])

    response = await client.get(f"/cg/inbox/{task_id}")
    item = response.json()
    assert item["execution_anchor_state"] == "confirmed"
    # No pending gate, no draft, no dependency, and no Version yet -- so
    # a confirmed Execution Anchor alone is honestly "none", not
    # "version_review_available" (no Version exists to review).
    assert item["current_focus"]["focus_type"] == "none"


async def test_dependency_needs_attention_focus(client: AsyncClient) -> None:
    _project_id, shot_id = await _create_project_and_shot(client)
    await _confirm_core_anchor(client, shot_id)
    task_id = await _create_task(client, shot_id)
    draft = await _create_draft_execution_anchor(client, task_id)
    await _confirm_execution_anchor(client, draft["id"])
    await client.post(
        f"/tasks/{task_id}/dependencies",
        json={"kind": "dependency", "description": "Blocked on comp grade."},
        headers=CG,
    )

    response = await client.get(f"/cg/inbox/{task_id}")
    item = response.json()
    assert item["current_focus"]["focus_type"] == "dependency_needs_attention"
    assert item["open_dependency_count"] == 1
    assert item["current_focus"]["target_route"] == f"/cg/tasks/{task_id}/dependencies"


async def test_version_review_available_focus(client: AsyncClient) -> None:
    _project_id, shot_id = await _create_project_and_shot(client)
    await _confirm_core_anchor(client, shot_id)
    task_id = await _create_task(client, shot_id)
    draft = await _create_draft_execution_anchor(client, task_id)
    await _confirm_execution_anchor(client, draft["id"])
    version_id = await _create_version(client, shot_id)

    response = await client.get(f"/cg/inbox/{task_id}")
    item = response.json()
    assert item["current_focus"]["focus_type"] == "version_review_available"
    assert item["latest_version_id"] == version_id
    assert item["current_focus"]["target_route"] == f"/cg/tasks/{task_id}/version-review"


async def test_version_review_focus_clears_once_a_cg_review_exists(client: AsyncClient) -> None:
    _project_id, shot_id = await _create_project_and_shot(client)
    await _confirm_core_anchor(client, shot_id)
    task_id = await _create_task(client, shot_id)
    draft = await _create_draft_execution_anchor(client, task_id)
    await _confirm_execution_anchor(client, draft["id"])
    await _create_version(client, shot_id)

    response = await client.post(
        f"/intent/execution-anchor-revisions/{draft['id']}/cg-supervisor-reviews/generate",
        headers=CG,
    )
    assert response.status_code == 201

    item = (await client.get(f"/cg/inbox/{task_id}")).json()
    assert item["current_focus"]["focus_type"] == "none"


async def test_get_cg_inbox_item_404_for_missing_task(client: AsyncClient) -> None:
    response = await client.get("/cg/inbox/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404


async def test_no_duplicate_task_rows(client: AsyncClient) -> None:
    _project_id, shot_a = await _create_project_and_shot(client, "SH010")
    await _create_task(client, shot_a, "Comp")
    _project_id2, shot_b = await _create_project_and_shot(client, "SH020")
    await _create_task(client, shot_b, "FX")

    response = await client.get("/cg/inbox")
    body = response.json()
    task_ids = [item["task_id"] for item in body["items"]]
    assert len(task_ids) == len(set(task_ids))
    assert len(task_ids) == 2
