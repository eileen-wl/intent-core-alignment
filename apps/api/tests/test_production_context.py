from httpx import AsyncClient


async def test_create_project_shot_task_flow(client: AsyncClient) -> None:
    project_resp = await client.post("/projects", json={"name": "Demo Project"})
    assert project_resp.status_code == 201
    project = project_resp.json()
    assert project["source"] == "manual"

    shot_resp = await client.post("/shots", json={"project_id": project["id"], "name": "SH010"})
    assert shot_resp.status_code == 201
    shot = shot_resp.json()

    task_resp = await client.post(
        "/tasks",
        json={"shot_id": shot["id"], "name": "Lighting Pass", "department": "lighting"},
    )
    assert task_resp.status_code == 201
    task = task_resp.json()
    assert task["department"] == "lighting"

    list_resp = await client.get("/shots")
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 1

    detail_resp = await client.get(f"/shots/{shot['id']}")
    assert detail_resp.status_code == 200
    assert detail_resp.json()["id"] == shot["id"]


async def test_create_shot_with_unknown_project_returns_404(client: AsyncClient) -> None:
    response = await client.post(
        "/shots",
        json={"project_id": "00000000-0000-0000-0000-000000000000", "name": "SH020"},
    )
    assert response.status_code == 404


async def test_create_task_with_unknown_shot_returns_404(client: AsyncClient) -> None:
    response = await client.post(
        "/tasks",
        json={"shot_id": "00000000-0000-0000-0000-000000000000", "name": "Comp Pass"},
    )
    assert response.status_code == 404
