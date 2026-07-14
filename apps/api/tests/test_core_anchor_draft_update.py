from __future__ import annotations

import uuid
from typing import Any

from httpx import AsyncClient
from intent_core_api.audit.models import AuditEvent
from intent_core_api.workflow.models import Decision, WorkflowTransition
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

VFX = {"X-Actor-Role": "vfx_supervisor", "X-Actor-Id": "vfx-1"}
CG = {"X-Actor-Role": "cg_supervisor", "X-Actor-Id": "cg-1"}
ARTIST = {"X-Actor-Role": "artist", "X-Actor-Id": "artist-1"}


async def _create_shot(client: AsyncClient) -> str:
    project = (await client.post("/projects", json={"name": "Demo Project"})).json()
    shot = (await client.post("/shots", json={"project_id": project["id"], "name": "SH010"})).json()
    return str(shot["id"])


async def _create_draft(client: AsyncClient, shot_id: str) -> dict[str, Any]:
    response = await client.post(
        f"/intent/shots/{shot_id}/core-anchor/drafts",
        json={"shot_objective": "Keep the dread quiet", "emotional_tone": None},
        headers=VFX,
    )
    assert response.status_code == 201
    result: dict[str, Any] = response.json()
    return result


async def test_vfx_can_patch_draft_and_only_audit_event_is_written(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot_id = await _create_shot(client)
    draft = await _create_draft(client, shot_id)

    response = await client.patch(
        f"/intent/core-anchor-revisions/{draft['id']}",
        json={"shot_objective": "Keep the dread palpable", "emotional_tone": "hopeful"},
        headers=VFX,
    )
    assert response.status_code == 200
    updated = response.json()
    assert updated["shot_objective"] == "Keep the dread palpable"
    assert updated["emotional_tone"] == "hopeful"
    assert updated["status"] == "draft"

    events = (
        (
            await session.execute(
                select(AuditEvent).where(
                    AuditEvent.entity_id == uuid.UUID(draft["id"]),
                    AuditEvent.action == "core_anchor_revision.updated",
                )
            )
        )
        .scalars()
        .all()
    )
    assert len(events) == 1
    diff = events[0].source_context["changed_fields"]
    assert diff["shot_objective"] == {
        "before": "Keep the dread quiet",
        "after": "Keep the dread palpable",
    }
    assert diff["emotional_tone"] == {"before": None, "after": "hopeful"}

    # A draft PATCH must not create a Decision or a WorkflowTransition.
    decisions = (
        (
            await session.execute(
                select(Decision).where(Decision.entity_id == uuid.UUID(draft["id"]))
            )
        )
        .scalars()
        .all()
    )
    assert decisions == []
    transitions = (
        (
            await session.execute(
                select(WorkflowTransition).where(
                    WorkflowTransition.entity_id == uuid.UUID(draft["id"])
                )
            )
        )
        .scalars()
        .all()
    )
    assert transitions == []


async def test_patch_with_no_actual_changes_writes_no_audit_event(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot_id = await _create_shot(client)
    draft = await _create_draft(client, shot_id)

    response = await client.patch(
        f"/intent/core-anchor-revisions/{draft['id']}",
        json={"shot_objective": "Keep the dread quiet"},  # identical to current value
        headers=VFX,
    )
    assert response.status_code == 200

    events = (
        (
            await session.execute(
                select(AuditEvent).where(
                    AuditEvent.entity_id == uuid.UUID(draft["id"]),
                    AuditEvent.action == "core_anchor_revision.updated",
                )
            )
        )
        .scalars()
        .all()
    )
    assert events == []


async def test_non_vfx_roles_cannot_patch_draft(client: AsyncClient) -> None:
    shot_id = await _create_shot(client)
    draft = await _create_draft(client, shot_id)

    for headers in (CG, ARTIST):
        response = await client.patch(
            f"/intent/core-anchor-revisions/{draft['id']}",
            json={"shot_objective": "hijacked"},
            headers=headers,
        )
        assert response.status_code == 403


async def test_patch_unknown_revision_returns_404(client: AsyncClient) -> None:
    response = await client.patch(
        "/intent/core-anchor-revisions/00000000-0000-0000-0000-000000000000",
        json={"shot_objective": "x"},
        headers=VFX,
    )
    assert response.status_code == 404
