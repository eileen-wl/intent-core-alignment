"""GET /tasks/{task_id} and GET /shots/{shot_id}/tasks (Step 7C-4) --
the two real Task read endpoints the CG Workspace needs, previously
absent from the domain."""

from __future__ import annotations

from httpx import AsyncClient


async def _create_project_and_shot(
    client: AsyncClient, shot_name: str = "SH010"
) -> tuple[str, str]:
    project = (await client.post("/projects", json={"name": "Demo Project"})).json()
    shot = (
        await client.post("/shots", json={"project_id": project["id"], "name": shot_name})
    ).json()
    return str(project["id"]), str(shot["id"])


async def test_get_task_returns_the_real_task(client: AsyncClient) -> None:
    _project_id, shot_id = await _create_project_and_shot(client)
    task = (
        await client.post(
            "/tasks", json={"shot_id": shot_id, "name": "Lighting", "department": "lighting"}
        )
    ).json()

    response = await client.get(f"/tasks/{task['id']}")
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == task["id"]
    assert body["name"] == "Lighting"
    assert body["department"] == "lighting"


async def test_get_task_404_for_missing_task(client: AsyncClient) -> None:
    response = await client.get("/tasks/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404


async def test_list_tasks_for_shot_returns_only_that_shots_tasks(client: AsyncClient) -> None:
    _project_id, shot_a = await _create_project_and_shot(client, "SH010")
    _project_id2, shot_b = await _create_project_and_shot(client, "SH020")

    await client.post("/tasks", json={"shot_id": shot_a, "name": "Comp"})
    await client.post("/tasks", json={"shot_id": shot_a, "name": "Lighting"})
    await client.post("/tasks", json={"shot_id": shot_b, "name": "FX"})

    response = await client.get(f"/shots/{shot_a}/tasks")
    assert response.status_code == 200
    names = {task["name"] for task in response.json()}
    assert names == {"Comp", "Lighting"}


async def test_list_tasks_for_shot_honest_empty(client: AsyncClient) -> None:
    _project_id, shot_id = await _create_project_and_shot(client)
    response = await client.get(f"/shots/{shot_id}/tasks")
    assert response.status_code == 200
    assert response.json() == []
