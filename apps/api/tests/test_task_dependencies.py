"""TaskDependency lifecycle (Step 7C-4) -- record dependency/conflict,
acknowledge, resolve, and escalate to VFX. Real persistence for the
Cross-department Conflict / Escalation concepts confirmed absent before
this Step (see intent_core_api.cross_department's module docstring)."""

from __future__ import annotations

from httpx import AsyncClient

CG = {"X-Actor-Role": "cg_supervisor", "X-Actor-Id": "cg-1"}
VFX = {"X-Actor-Role": "vfx_supervisor", "X-Actor-Id": "vfx-1"}


async def _create_project_shot_task(client: AsyncClient) -> tuple[str, str, str]:
    project = (await client.post("/projects", json={"name": "Demo Project"})).json()
    shot = (
        await client.post("/shots", json={"project_id": project["id"], "name": "SH010"})
    ).json()
    task = (
        await client.post("/tasks", json={"shot_id": shot["id"], "name": "Lighting"})
    ).json()
    return str(project["id"]), str(shot["id"]), str(task["id"])


async def test_create_dependency_requires_cg_supervisor(client: AsyncClient) -> None:
    _p, _s, task_id = await _create_project_shot_task(client)
    response = await client.post(
        f"/tasks/{task_id}/dependencies",
        json={"kind": "dependency", "description": "Blocked on comp grade."},
        headers=VFX,
    )
    assert response.status_code == 403


async def test_create_and_list_dependency(client: AsyncClient) -> None:
    _p, _s, task_id = await _create_project_shot_task(client)
    response = await client.post(
        f"/tasks/{task_id}/dependencies",
        json={"kind": "dependency", "description": "Blocked on comp grade.", "severity": "medium"},
        headers=CG,
    )
    assert response.status_code == 201
    dependency = response.json()
    assert dependency["kind"] == "dependency"
    assert dependency["status"] == "open"
    assert dependency["severity"] == "medium"
    assert dependency["escalated_to_role"] is None

    listed = (await client.get(f"/tasks/{task_id}/dependencies")).json()
    assert len(listed) == 1
    assert listed[0]["id"] == dependency["id"]


async def test_acknowledge_then_resolve_dependency(client: AsyncClient) -> None:
    _p, _s, task_id = await _create_project_shot_task(client)
    dependency = (
        await client.post(
            f"/tasks/{task_id}/dependencies",
            json={"kind": "conflict", "description": "Cross-role conflict."},
            headers=CG,
        )
    ).json()

    acknowledged = (
        await client.post(
            f"/tasks/{task_id}/dependencies/{dependency['id']}/acknowledge", headers=CG
        )
    ).json()
    assert acknowledged["status"] == "acknowledged"

    resolved = (
        await client.post(f"/tasks/{task_id}/dependencies/{dependency['id']}/resolve", headers=CG)
    ).json()
    assert resolved["status"] == "resolved"
    assert resolved["resolved_by_human_role"] == "cg_supervisor"
    assert resolved["resolved_at"] is not None


async def test_resolving_an_already_resolved_dependency_conflicts(client: AsyncClient) -> None:
    _p, _s, task_id = await _create_project_shot_task(client)
    dependency = (
        await client.post(
            f"/tasks/{task_id}/dependencies",
            json={"kind": "dependency", "description": "x"},
            headers=CG,
        )
    ).json()
    await client.post(f"/tasks/{task_id}/dependencies/{dependency['id']}/resolve", headers=CG)

    response = await client.post(
        f"/tasks/{task_id}/dependencies/{dependency['id']}/resolve", headers=CG
    )
    assert response.status_code == 409


async def test_escalate_creates_a_real_open_escalation_targeting_vfx(client: AsyncClient) -> None:
    _p, _s, task_id = await _create_project_shot_task(client)
    response = await client.post(
        f"/tasks/{task_id}/escalate",
        json={"description": "Dusk tone reads too bright, needs VFX input."},
        headers=CG,
    )
    assert response.status_code == 201
    escalation = response.json()
    assert escalation["kind"] == "escalation"
    assert escalation["status"] == "open"
    assert escalation["escalated_to_role"] == "vfx_supervisor"


async def test_escalate_requires_cg_supervisor(client: AsyncClient) -> None:
    _p, _s, task_id = await _create_project_shot_task(client)
    response = await client.post(
        f"/tasks/{task_id}/escalate", json={"description": "x"}, headers=VFX
    )
    assert response.status_code == 403
