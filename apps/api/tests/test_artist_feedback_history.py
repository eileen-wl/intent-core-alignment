"""GET /tasks/{task_id}/feedback-history (Step 7C-5).

Mirrors test_task_activity.py's real-prerequisite-chain pattern, Artist's
own event vocabulary (Review Notes, Artist guidance, Version references)
instead of CG's Execution Anchor draft/save mechanics.
"""

from __future__ import annotations

from httpx import AsyncClient

VFX = {"X-Actor-Role": "vfx_supervisor", "X-Actor-Id": "vfx-1"}
CG = {"X-Actor-Role": "cg_supervisor", "X-Actor-Id": "cg-1"}
ARTIST = {"X-Actor-Role": "artist", "X-Actor-Id": "artist-1"}


async def _create_project_and_shot(client: AsyncClient) -> tuple[str, str]:
    project = (await client.post("/projects", json={"name": "Demo Project"})).json()
    shot = (await client.post("/shots", json={"project_id": project["id"], "name": "SH010"})).json()
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
    task = (
        await client.post(
            "/tasks", json={"shot_id": shot_id, "name": "Lighting", "department": "lighting"}
        )
    ).json()
    return str(task["id"])


async def _confirm_execution_anchor(client: AsyncClient, task_id: str) -> str:
    draft = (
        await client.post(
            f"/intent/tasks/{task_id}/execution-anchor/drafts",
            json={"technical_boundaries": "24fps."},
            headers=CG,
        )
    ).json()
    confirmed = (
        await client.post(
            f"/intent/execution-anchor-revisions/{draft['id']}/confirm", json={}, headers=CG
        )
    ).json()
    return str(confirmed["id"])


async def _create_version(client: AsyncClient, shot_id: str) -> str:
    version = (
        await client.post(
            "/versions",
            json={"shot_id": shot_id, "name": "SH010_v001", "description": "First pass."},
            headers=VFX,
        )
    ).json()
    return str(version["id"])


async def test_empty_history_for_a_bare_task(client: AsyncClient) -> None:
    _project_id, shot_id = await _create_project_and_shot(client)
    task_id = await _create_task(client, shot_id)

    response = await client.get(f"/tasks/{task_id}/feedback-history")
    assert response.status_code == 200
    body = response.json()
    assert body["task_id"] == task_id
    assert body["events"] == []


async def test_version_and_review_note_events(client: AsyncClient) -> None:
    _project_id, shot_id = await _create_project_and_shot(client)
    task_id = await _create_task(client, shot_id)
    version_id = await _create_version(client, shot_id)
    await client.post(
        f"/versions/{version_id}/review-notes",
        json={"content": "Contrast reads hot."},
        headers=VFX,
    )

    response = await client.get(f"/tasks/{task_id}/feedback-history")
    events = response.json()["events"]
    event_types = {event["event_type"] for event in events}
    assert "version_recorded" in event_types
    assert "review_note_recorded" in event_types

    review_note_event = next(e for e in events if e["event_type"] == "review_note_recorded")
    assert review_note_event["related_version_id"] == version_id
    assert review_note_event["route"] == f"/artist/tasks/{task_id}/current-version"
    assert "Contrast reads hot." in review_note_event["summary"]


async def test_artist_guidance_generated_event(client: AsyncClient) -> None:
    _project_id, shot_id = await _create_project_and_shot(client)
    await _confirm_core_anchor(client, shot_id)
    task_id = await _create_task(client, shot_id)
    await _confirm_execution_anchor(client, task_id)
    version_id = await _create_version(client, shot_id)

    generate_response = await client.post(
        f"/intent/versions/{version_id}/artist-guidances/generate",
        json={"task_id": task_id},
        headers=ARTIST,
    )
    assert generate_response.status_code == 201

    response = await client.get(f"/tasks/{task_id}/feedback-history")
    events = response.json()["events"]
    guidance_event = next(e for e in events if e["event_type"] == "artist_guidance_generated")
    assert guidance_event["route"] == f"/artist/tasks/{task_id}"
    assert guidance_event["related_version_id"] == version_id
    assert guidance_event["actor_kind"] == "agent"


async def test_execution_anchor_confirmed_event(client: AsyncClient) -> None:
    _project_id, shot_id = await _create_project_and_shot(client)
    await _confirm_core_anchor(client, shot_id)
    task_id = await _create_task(client, shot_id)
    await _confirm_execution_anchor(client, task_id)

    response = await client.get(f"/tasks/{task_id}/feedback-history")
    events = response.json()["events"]
    confirm_event = next(e for e in events if e["event_type"] == "execution_anchor_confirmed")
    assert confirm_event["route"] == f"/artist/tasks/{task_id}"
    assert confirm_event["actor_human_role"] == "cg_supervisor"


async def test_dependency_events(client: AsyncClient) -> None:
    _project_id, shot_id = await _create_project_and_shot(client)
    await _confirm_core_anchor(client, shot_id)
    task_id = await _create_task(client, shot_id)
    await _confirm_execution_anchor(client, task_id)
    dependency = (
        await client.post(
            f"/tasks/{task_id}/dependencies",
            json={"kind": "dependency", "description": "Blocked on comp grade."},
            headers=CG,
        )
    ).json()
    await client.post(f"/tasks/{task_id}/dependencies/{dependency['id']}/resolve", headers=CG)

    response = await client.get(f"/tasks/{task_id}/feedback-history")
    events = response.json()["events"]
    event_types = {event["event_type"] for event in events}
    assert "dependency_recorded" in event_types
    assert "dependency_resolved" in event_types


async def test_events_are_newest_first(client: AsyncClient) -> None:
    _project_id, shot_id = await _create_project_and_shot(client)
    task_id = await _create_task(client, shot_id)
    await _create_version(client, shot_id)
    v2 = (
        await client.post(
            "/versions",
            json={"shot_id": shot_id, "name": "SH010_v002", "description": "Second pass."},
            headers=VFX,
        )
    ).json()

    response = await client.get(f"/tasks/{task_id}/feedback-history")
    events = response.json()["events"]
    occurred_ats = [event["occurred_at"] for event in events]
    assert occurred_ats == sorted(occurred_ats, reverse=True)
    assert events[0]["related_entity_id"] == v2["id"]


async def test_feedback_history_never_appears_on_cg_task_activity(client: AsyncClient) -> None:
    """Distinct capabilities: Feedback History and CG's Task Activity
    read the same underlying rows but are separate endpoints with
    separate event vocabularies -- proving neither regressed the other.
    """
    _project_id, shot_id = await _create_project_and_shot(client)
    await _confirm_core_anchor(client, shot_id)
    task_id = await _create_task(client, shot_id)
    await _confirm_execution_anchor(client, task_id)
    version_id = await _create_version(client, shot_id)
    await client.post(
        f"/versions/{version_id}/review-notes", json={"content": "Note."}, headers=VFX
    )

    feedback_history = (await client.get(f"/tasks/{task_id}/feedback-history")).json()
    cg_activity = (await client.get(f"/tasks/{task_id}/activity")).json()

    feedback_event_types = {event["event_type"] for event in feedback_history["events"]}
    cg_event_types = {event["event_type"] for event in cg_activity["events"]}

    # Feedback History includes Review Notes/Versions -- CG's Activity
    # never has, and must continue to never have, either.
    assert "review_note_recorded" in feedback_event_types
    assert "version_recorded" in feedback_event_types
    assert "review_note_recorded" not in cg_event_types
    assert "version_recorded" not in cg_event_types
