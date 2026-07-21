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


async def _create_shot_and_task(client: AsyncClient) -> tuple[str, str]:
    project = (await client.post("/projects", json={"name": "Demo Project"})).json()
    shot = (await client.post("/shots", json={"project_id": project["id"], "name": "SH010"})).json()
    task = (
        await client.post(
            "/tasks",
            json={"shot_id": shot["id"], "name": "Lighting Pass", "department": "lighting"},
        )
    ).json()
    return shot["id"], task["id"]


async def _confirm_core_anchor(client: AsyncClient, shot_id: str) -> None:
    draft = (
        await client.post(f"/intent/shots/{shot_id}/core-anchor/drafts", json={}, headers=VFX)
    ).json()
    await client.post(f"/intent/core-anchor-revisions/{draft['id']}/confirm", json={}, headers=VFX)


async def _create_draft(client: AsyncClient, task_id: str) -> dict[str, Any]:
    response = await client.post(
        f"/intent/tasks/{task_id}/execution-anchor/drafts",
        json={"technical_boundaries": "24fps", "parameter_ranges": None},
        headers=CG,
    )
    assert response.status_code == 201
    result: dict[str, Any] = response.json()
    return result


async def test_cg_can_patch_draft_and_only_audit_event_is_written(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot_id, task_id = await _create_shot_and_task(client)
    await _confirm_core_anchor(client, shot_id)
    draft = await _create_draft(client, task_id)

    response = await client.patch(
        f"/intent/execution-anchor-revisions/{draft['id']}",
        json={"technical_boundaries": "30fps", "parameter_ranges": "0-100"},
        headers=CG,
    )
    assert response.status_code == 200
    updated = response.json()
    assert updated["technical_boundaries"] == "30fps"
    assert updated["parameter_ranges"] == "0-100"
    assert updated["status"] == "draft"

    revision_id = uuid.UUID(draft["id"])
    events = (
        (
            await session.execute(
                select(AuditEvent).where(
                    AuditEvent.entity_id == revision_id,
                    AuditEvent.action == "execution_anchor_revision.updated",
                )
            )
        )
        .scalars()
        .all()
    )
    assert len(events) == 1
    diff = events[0].source_context["changed_fields"]
    assert diff["technical_boundaries"] == {"before": "24fps", "after": "30fps"}
    assert diff["parameter_ranges"] == {"before": None, "after": "0-100"}

    decisions = (
        (await session.execute(select(Decision).where(Decision.entity_id == revision_id)))
        .scalars()
        .all()
    )
    assert decisions == []
    transitions = (
        (
            await session.execute(
                select(WorkflowTransition).where(WorkflowTransition.entity_id == revision_id)
            )
        )
        .scalars()
        .all()
    )
    assert transitions == []


async def test_patch_with_no_actual_changes_writes_no_audit_event(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot_id, task_id = await _create_shot_and_task(client)
    await _confirm_core_anchor(client, shot_id)
    draft = await _create_draft(client, task_id)

    response = await client.patch(
        f"/intent/execution-anchor-revisions/{draft['id']}",
        json={"technical_boundaries": "24fps"},
        headers=CG,
    )
    assert response.status_code == 200

    revision_id = uuid.UUID(draft["id"])
    events = (
        (
            await session.execute(
                select(AuditEvent).where(
                    AuditEvent.entity_id == revision_id,
                    AuditEvent.action == "execution_anchor_revision.updated",
                )
            )
        )
        .scalars()
        .all()
    )
    assert events == []


async def test_non_cg_roles_cannot_patch_draft(client: AsyncClient) -> None:
    shot_id, task_id = await _create_shot_and_task(client)
    await _confirm_core_anchor(client, shot_id)
    draft = await _create_draft(client, task_id)

    for headers in (VFX, ARTIST):
        response = await client.patch(
            f"/intent/execution-anchor-revisions/{draft['id']}",
            json={"technical_boundaries": "hijacked"},
            headers=headers,
        )
        assert response.status_code == 403


async def test_patch_unknown_revision_returns_404(client: AsyncClient) -> None:
    response = await client.patch(
        "/intent/execution-anchor-revisions/00000000-0000-0000-0000-000000000000",
        json={"technical_boundaries": "x"},
        headers=CG,
    )
    assert response.status_code == 404
