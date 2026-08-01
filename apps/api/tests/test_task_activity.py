"""GET /tasks/{task_id}/activity (Step 7C-4 Task Activity) -- a real
chronological timeline built from already-persisted Execution Anchor /
Decision / CG Supervisor review / TaskDependency rows, never a
fabricated entry.
"""

from __future__ import annotations

from typing import Any

from httpx import AsyncClient

VFX = {"X-Actor-Role": "vfx_supervisor", "X-Actor-Id": "vfx-1"}
CG = {"X-Actor-Role": "cg_supervisor", "X-Actor-Id": "cg-1"}


async def _create_project_and_shot(client: AsyncClient) -> tuple[str, str]:
    project = (await client.post("/projects", json={"name": "Demo Project"})).json()
    shot = (
        await client.post("/shots", json={"project_id": project["id"], "name": "SH010"})
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
    await client.post(f"/intent/core-anchor-revisions/{draft['id']}/confirm", json={}, headers=VFX)


async def _create_task(client: AsyncClient, shot_id: str) -> str:
    task = (await client.post("/tasks", json={"shot_id": shot_id, "name": "Lighting"})).json()
    return str(task["id"])


async def _create_draft(client: AsyncClient, task_id: str) -> dict[str, Any]:
    response = await client.post(
        f"/intent/tasks/{task_id}/execution-anchor/drafts",
        json={"technical_boundaries": "24fps, no motion blur."},
        headers=CG,
    )
    assert response.status_code == 201
    return response.json()


async def test_returns_empty_events_for_a_task_with_no_recorded_activity(
    client: AsyncClient,
) -> None:
    _project_id, shot_id = await _create_project_and_shot(client)
    task_id = await _create_task(client, shot_id)

    response = await client.get(f"/tasks/{task_id}/activity")
    assert response.status_code == 200
    body = response.json()
    assert body["task_id"] == task_id
    assert body["events"] == []


async def test_a_confirmed_revision_produces_created_confirmed_and_decision_events(
    client: AsyncClient,
) -> None:
    _project_id, shot_id = await _create_project_and_shot(client)
    await _confirm_core_anchor(client, shot_id)
    task_id = await _create_task(client, shot_id)
    draft = await _create_draft(client, task_id)
    confirmed = (
        await client.post(
            f"/intent/execution-anchor-revisions/{draft['id']}/confirm",
            json={"rationale": "Matches the brief."},
            headers=CG,
        )
    ).json()
    assert confirmed["status"] == "confirmed"

    response = await client.get(f"/tasks/{task_id}/activity")
    events = response.json()["events"]
    event_types = [event["event_type"] for event in events]

    assert "execution_anchor_draft_created" in event_types
    assert "execution_anchor_confirmed" in event_types
    assert "human_decision_recorded" in event_types

    confirm_event = next(e for e in events if e["event_type"] == "execution_anchor_confirmed")
    assert confirm_event["actor_human_role"] == "cg_supervisor"
    assert confirm_event["route"] == f"/cg/tasks/{task_id}/execution"

    decision_event = next(e for e in events if e["event_type"] == "human_decision_recorded")
    assert decision_event["route"] == f"/cg/tasks/{task_id}/execution"
    # Distinct id from the execution_anchor_confirmed event for the same
    # underlying Decision row.
    assert decision_event["id"] != confirm_event["id"]


async def test_a_rejected_draft_produces_a_discarded_event(client: AsyncClient) -> None:
    _project_id, shot_id = await _create_project_and_shot(client)
    await _confirm_core_anchor(client, shot_id)
    task_id = await _create_task(client, shot_id)
    draft = await _create_draft(client, task_id)
    rejected = (
        await client.post(
            f"/intent/execution-anchor-revisions/{draft['id']}/reject", json={}, headers=CG
        )
    ).json()
    assert rejected["status"] == "rejected"

    events = (await client.get(f"/tasks/{task_id}/activity")).json()["events"]
    assert any(e["event_type"] == "execution_anchor_draft_discarded" for e in events)
    assert any(e["event_type"] == "human_decision_recorded" for e in events)


async def test_dependency_and_escalation_events_appear_newest_first(client: AsyncClient) -> None:
    _project_id, shot_id = await _create_project_and_shot(client)
    task_id = await _create_task(client, shot_id)

    dependency = (
        await client.post(
            f"/tasks/{task_id}/dependencies",
            json={"kind": "dependency", "description": "Blocked on comp grade."},
            headers=CG,
        )
    ).json()
    await client.post(f"/tasks/{task_id}/dependencies/{dependency['id']}/resolve", headers=CG)
    await client.post(
        f"/tasks/{task_id}/escalate", json={"description": "Needs VFX input."}, headers=CG
    )

    events = (await client.get(f"/tasks/{task_id}/activity")).json()["events"]
    event_types = {event["event_type"] for event in events}
    assert "dependency_recorded" in event_types
    assert "dependency_resolved" in event_types
    assert "escalation_recorded" in event_types

    timestamps = [event["occurred_at"] for event in events]
    assert timestamps == sorted(timestamps, reverse=True)

    dependency_event = next(e for e in events if e["event_type"] == "dependency_recorded")
    assert dependency_event["route"] == f"/cg/tasks/{task_id}/dependencies"


async def test_does_not_include_another_tasks_events(client: AsyncClient) -> None:
    _project_id, shot_id = await _create_project_and_shot(client)
    task_a = await _create_task(client, shot_id)
    task_b = (await client.post("/tasks", json={"shot_id": shot_id, "name": "Comp"})).json()["id"]

    await client.post(
        f"/tasks/{task_a}/dependencies",
        json={"kind": "dependency", "description": "x"},
        headers=CG,
    )

    events = (await client.get(f"/tasks/{task_b}/activity")).json()["events"]
    assert events == []
