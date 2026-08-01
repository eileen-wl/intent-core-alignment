"""GET /shots/{shot_id}/activity (Step 7C-3 Activity Workspace) -- a
real chronological timeline built from already-persisted Core Anchor /
Decision / Version / Review Note / Cross-role Assessment / Re-anchor
Proposal / ExternalEntityLink rows, never a fabricated entry.
"""

from __future__ import annotations

from typing import Any

from httpx import AsyncClient

VFX = {"X-Actor-Role": "vfx_supervisor", "X-Actor-Id": "vfx-1"}


async def _create_project_and_shot(
    client: AsyncClient, shot_name: str = "SH010"
) -> tuple[str, str]:
    project = (await client.post("/projects", json={"name": "Demo Project"})).json()
    shot = (
        await client.post("/shots", json={"project_id": project["id"], "name": shot_name})
    ).json()
    return str(project["id"]), str(shot["id"])


async def _create_draft(client: AsyncClient, shot_id: str) -> dict[str, Any]:
    response = await client.post(
        f"/intent/shots/{shot_id}/core-anchor/drafts",
        json={"core_summary": "A quiet, controlled chase."},
        headers=VFX,
    )
    assert response.status_code == 201
    return response.json()


async def test_returns_empty_events_for_a_shot_with_no_recorded_activity(
    client: AsyncClient,
) -> None:
    _, shot_id = await _create_project_and_shot(client)
    response = await client.get(f"/shots/{shot_id}/activity")
    assert response.status_code == 200
    body = response.json()
    assert body["shot_id"] == shot_id
    assert body["events"] == []


async def test_a_confirmed_revision_produces_a_created_and_a_decision_event(
    client: AsyncClient,
) -> None:
    _, shot_id = await _create_project_and_shot(client)
    draft = await _create_draft(client, shot_id)
    confirmed = (
        await client.post(
            f"/intent/core-anchor-revisions/{draft['id']}/confirm",
            json={"rationale": "Matches the brief."},
            headers=VFX,
        )
    ).json()
    assert confirmed["status"] == "confirmed"

    response = await client.get(f"/shots/{shot_id}/activity")
    assert response.status_code == 200
    events = response.json()["events"]

    event_types = [event["event_type"] for event in events]
    assert "core_anchor_draft_created" in event_types
    assert "core_anchor_confirmed" in event_types

    confirm_event = next(e for e in events if e["event_type"] == "core_anchor_confirmed")
    assert confirm_event["actor_human_role"] == "vfx_supervisor"
    assert confirm_event["related_entity_type"] == "decision"
    assert confirm_event["route"] == f"/vfx/shots/{shot_id}/intent"

    # Decisions belong in the Activity timeline (never a separate route).
    assert all("/activity" not in e["route"] for e in events)


async def test_a_confirmed_revision_also_produces_a_separate_decision_recorded_event(
    client: AsyncClient,
) -> None:
    """`core_anchor_confirmed` describes what happened to the Revision;
    `human_decision_recorded` describes the real persisted Decision
    itself -- both must exist for the same confirm action, never one in
    place of the other (Step 7C-3 completion pass).
    """
    _, shot_id = await _create_project_and_shot(client)
    draft = await _create_draft(client, shot_id)
    await client.post(
        f"/intent/core-anchor-revisions/{draft['id']}/confirm",
        json={"rationale": "Matches the brief."},
        headers=VFX,
    )

    response = await client.get(f"/shots/{shot_id}/activity")
    events = response.json()["events"]

    event_types = [event["event_type"] for event in events]
    assert "core_anchor_confirmed" in event_types
    assert "human_decision_recorded" in event_types

    decision_event = next(e for e in events if e["event_type"] == "human_decision_recorded")
    assert decision_event["actor_human_role"] == "vfx_supervisor"
    assert decision_event["related_entity_type"] == "decision"
    assert decision_event["route"] == f"/vfx/shots/{shot_id}/intent"
    # Distinct id from the core_anchor_confirmed event for the same
    # underlying Decision row -- never a duplicate/colliding id.
    confirm_event = next(e for e in events if e["event_type"] == "core_anchor_confirmed")
    assert decision_event["id"] != confirm_event["id"]
    assert decision_event["related_entity_id"] == confirm_event["related_entity_id"]


async def test_a_rejected_draft_produces_a_discarded_event(client: AsyncClient) -> None:
    _, shot_id = await _create_project_and_shot(client)
    draft = await _create_draft(client, shot_id)
    rejected = (
        await client.post(
            f"/intent/core-anchor-revisions/{draft['id']}/reject", json={}, headers=VFX
        )
    ).json()
    assert rejected["status"] == "rejected"

    response = await client.get(f"/shots/{shot_id}/activity")
    events = response.json()["events"]
    assert any(e["event_type"] == "core_anchor_draft_discarded" for e in events)
    assert any(e["event_type"] == "human_decision_recorded" for e in events)


async def test_events_are_ordered_newest_first_across_different_real_object_types(
    client: AsyncClient,
) -> None:
    _, shot_id = await _create_project_and_shot(client)
    await _create_draft(client, shot_id)

    version = (
        await client.post(
            "/versions",
            json={"shot_id": shot_id, "name": "SH010_v001", "description": "First pass."},
            headers=VFX,
        )
    ).json()
    await client.post(
        f"/versions/{version['id']}/review-notes",
        json={"content": "Looks close, tighten the timing."},
        headers=VFX,
    )

    response = await client.get(f"/shots/{shot_id}/activity")
    events = response.json()["events"]

    timestamps = [event["occurred_at"] for event in events]
    assert timestamps == sorted(timestamps, reverse=True)

    event_types = {event["event_type"] for event in events}
    assert "production_version_recorded" in event_types
    assert "review_note_recorded" in event_types

    version_event = next(e for e in events if e["event_type"] == "production_version_recorded")
    assert version_event["route"] == f"/vfx/shots/{shot_id}/versions"
    note_event = next(e for e in events if e["event_type"] == "review_note_recorded")
    assert note_event["route"] == f"/vfx/shots/{shot_id}/versions"


async def test_does_not_include_another_shots_events(client: AsyncClient) -> None:
    _, shot_a = await _create_project_and_shot(client, "SH010")
    await _create_draft(client, shot_a)

    _, shot_b = await _create_project_and_shot(client, "SH020")

    response = await client.get(f"/shots/{shot_b}/activity")
    assert response.json()["events"] == []
