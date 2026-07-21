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


async def test_ftrack_source_without_external_id_is_rejected(client: AsyncClient) -> None:
    response = await client.post("/projects", json={"name": "Napo", "source": "ftrack"})
    assert response.status_code == 422


async def test_manual_source_with_external_id_is_rejected(client: AsyncClient) -> None:
    response = await client.post(
        "/projects", json={"name": "Napo", "source": "manual", "external_id": "abc123"}
    )
    assert response.status_code == 422


async def test_repeat_ftrack_sync_upserts_instead_of_duplicating(client: AsyncClient) -> None:
    first = await client.post(
        "/projects",
        json={"name": "Napo (Animation demo)", "source": "ftrack", "external_id": "ftrack-proj-1"},
    )
    assert first.status_code == 201
    first_project = first.json()

    second = await client.post(
        "/projects",
        # Same external_id, changed name -- simulates a repeat sync after
        # a rename in ftrack.
        json={"name": "Napo (renamed)", "source": "ftrack", "external_id": "ftrack-proj-1"},
    )
    assert second.status_code == 201
    second_project = second.json()

    assert second_project["id"] == first_project["id"]
    assert second_project["name"] == "Napo (renamed)"

    list_resp = await client.get("/projects")
    matching = [p for p in list_resp.json() if p["id"] == first_project["id"]]
    assert len(matching) == 1


async def test_repeat_ftrack_sync_upserts_shot_and_task(client: AsyncClient) -> None:
    project_resp = await client.post(
        "/projects",
        json={"name": "Napo", "source": "ftrack", "external_id": "ftrack-proj-2"},
    )
    project = project_resp.json()

    shot_payload = {
        "project_id": project["id"],
        "name": "bc0030",
        "source": "ftrack",
        "external_id": "ftrack-shot-1",
    }
    first_shot = (await client.post("/shots", json=shot_payload)).json()
    second_shot = (await client.post("/shots", json=shot_payload)).json()
    assert first_shot["id"] == second_shot["id"]

    task_payload = {
        "shot_id": first_shot["id"],
        "name": "Comp",
        "source": "ftrack",
        "external_id": "ftrack-task-1",
    }
    first_task = (await client.post("/tasks", json=task_payload)).json()
    second_task = (await client.post("/tasks", json=task_payload)).json()
    assert first_task["id"] == second_task["id"]

    list_resp = await client.get("/tasks")
    matching = [t for t in list_resp.json() if t["id"] == first_task["id"]]
    assert len(matching) == 1
