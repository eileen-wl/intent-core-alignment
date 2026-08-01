from __future__ import annotations

import uuid

from httpx import AsyncClient
from intent_core_api.audit.models import AuditEvent
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

VFX = {"X-Actor-Role": "vfx_supervisor", "X-Actor-Id": "vfx-1"}
CG = {"X-Actor-Role": "cg_supervisor", "X-Actor-Id": "cg-1"}


async def _create_shot_and_task(
    client: AsyncClient, task_name: str = "Lighting Pass"
) -> tuple[str, str]:
    project = (await client.post("/projects", json={"name": "Demo Project"})).json()
    shot = (await client.post("/shots", json={"project_id": project["id"], "name": "SH010"})).json()
    task = (
        await client.post(
            "/tasks", json={"shot_id": shot["id"], "name": task_name, "department": "lighting"}
        )
    ).json()
    return shot["id"], task["id"]


async def _confirm_core_draft(client: AsyncClient, shot_id: str, **content: str) -> str:
    draft = (
        await client.post(f"/intent/shots/{shot_id}/core-anchor/drafts", json=content, headers=VFX)
    ).json()
    confirmed = (
        await client.post(
            f"/intent/core-anchor-revisions/{draft['id']}/confirm", json={}, headers=VFX
        )
    ).json()
    revision_id: str = confirmed["id"]
    return revision_id


async def _confirm_execution_draft(client: AsyncClient, task_id: str) -> dict:
    draft = (
        await client.post(
            f"/intent/tasks/{task_id}/execution-anchor/drafts",
            json={"technical_boundaries": "baseline"},
            headers=CG,
        )
    ).json()
    confirm_response = await client.post(
        f"/intent/execution-anchor-revisions/{draft['id']}/confirm", json={}, headers=CG
    )
    assert confirm_response.status_code == 200
    result: dict = confirm_response.json()
    return result


async def test_core_confirm_marks_execution_anchor_stale_with_system_audit_event(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot_id, task_id = await _create_shot_and_task(client)
    await _confirm_core_draft(client, shot_id, shot_objective="v1")
    await _confirm_execution_draft(client, task_id)

    anchor_before = (await client.get(f"/intent/tasks/{task_id}/execution-anchor")).json()
    assert anchor_before["is_stale"] is False

    core_draft2 = (
        await client.post(
            f"/intent/shots/{shot_id}/core-anchor/drafts",
            json={"shot_objective": "v2"},
            headers=VFX,
        )
    ).json()
    await client.post(
        f"/intent/core-anchor-revisions/{core_draft2['id']}/confirm", json={}, headers=VFX
    )

    anchor_after = (await client.get(f"/intent/tasks/{task_id}/execution-anchor")).json()
    assert anchor_after["is_stale"] is True

    anchor_id = uuid.UUID(anchor_after["id"])
    events = (
        (
            await session.execute(
                select(AuditEvent).where(
                    AuditEvent.entity_id == anchor_id,
                    AuditEvent.action == "execution_anchor.marked_stale",
                )
            )
        )
        .scalars()
        .all()
    )
    assert len(events) == 1
    assert events[0].actor_kind == "system"
    assert events[0].actor_id == "system"


async def test_second_core_confirm_while_already_stale_writes_no_duplicate_event(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot_id, task_id = await _create_shot_and_task(client)
    await _confirm_core_draft(client, shot_id, shot_objective="v1")
    await _confirm_execution_draft(client, task_id)

    core_draft2 = (
        await client.post(
            f"/intent/shots/{shot_id}/core-anchor/drafts",
            json={"shot_objective": "v2"},
            headers=VFX,
        )
    ).json()
    await client.post(
        f"/intent/core-anchor-revisions/{core_draft2['id']}/confirm", json={}, headers=VFX
    )

    anchor = (await client.get(f"/intent/tasks/{task_id}/execution-anchor")).json()
    assert anchor["is_stale"] is True

    # A further Core confirm while this ExecutionAnchor is already stale
    # must not write a second marked_stale event.
    core_draft3 = (
        await client.post(
            f"/intent/shots/{shot_id}/core-anchor/drafts",
            json={"shot_objective": "v3"},
            headers=VFX,
        )
    ).json()
    await client.post(
        f"/intent/core-anchor-revisions/{core_draft3['id']}/confirm", json={}, headers=VFX
    )

    anchor_id = uuid.UUID(anchor["id"])
    events = (
        (
            await session.execute(
                select(AuditEvent).where(
                    AuditEvent.entity_id == anchor_id,
                    AuditEvent.action == "execution_anchor.marked_stale",
                )
            )
        )
        .scalars()
        .all()
    )
    assert len(events) == 1


async def test_confirming_new_execution_revision_clears_stale_with_human_audit_event(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot_id, task_id = await _create_shot_and_task(client)
    await _confirm_core_draft(client, shot_id, shot_objective="v1")
    await _confirm_execution_draft(client, task_id)

    core_draft2 = (
        await client.post(
            f"/intent/shots/{shot_id}/core-anchor/drafts",
            json={"shot_objective": "v2"},
            headers=VFX,
        )
    ).json()
    await client.post(
        f"/intent/core-anchor-revisions/{core_draft2['id']}/confirm", json={}, headers=VFX
    )

    anchor = (await client.get(f"/intent/tasks/{task_id}/execution-anchor")).json()
    assert anchor["is_stale"] is True

    new_exec_draft = (
        await client.post(
            f"/intent/tasks/{task_id}/execution-anchor/drafts",
            json={"technical_boundaries": "updated"},
            headers=CG,
        )
    ).json()
    confirm_response = await client.post(
        f"/intent/execution-anchor-revisions/{new_exec_draft['id']}/confirm", json={}, headers=CG
    )
    assert confirm_response.status_code == 200

    anchor_after = (await client.get(f"/intent/tasks/{task_id}/execution-anchor")).json()
    assert anchor_after["is_stale"] is False

    anchor_id = uuid.UUID(anchor["id"])
    clear_events = (
        (
            await session.execute(
                select(AuditEvent).where(
                    AuditEvent.entity_id == anchor_id,
                    AuditEvent.action == "execution_anchor.stale_cleared",
                )
            )
        )
        .scalars()
        .all()
    )
    assert len(clear_events) == 1
    assert clear_events[0].actor_kind == "human"
    assert clear_events[0].actor_human_role == "cg_supervisor"


async def test_execution_anchor_with_no_confirmed_revision_is_never_marked_stale(
    client: AsyncClient,
) -> None:
    shot_id, task_id = await _create_shot_and_task(client)
    await _confirm_core_draft(client, shot_id, shot_objective="v1")

    # Draft an Execution Anchor revision but never confirm it.
    await client.post(f"/intent/tasks/{task_id}/execution-anchor/drafts", json={}, headers=CG)

    core_draft2 = (
        await client.post(
            f"/intent/shots/{shot_id}/core-anchor/drafts",
            json={"shot_objective": "v2"},
            headers=VFX,
        )
    ).json()
    await client.post(
        f"/intent/core-anchor-revisions/{core_draft2['id']}/confirm", json={}, headers=VFX
    )

    anchor = (await client.get(f"/intent/tasks/{task_id}/execution-anchor")).json()
    assert anchor["is_stale"] is False


async def test_no_endpoint_accepts_is_stale_directly(client: AsyncClient) -> None:
    shot_id, task_id = await _create_shot_and_task(client)
    await _confirm_core_draft(client, shot_id)

    # The draft-create and update payloads silently ignore unknown fields
    # rather than accepting is_stale -- confirm the created/updated anchor
    # is never influenced by a client-supplied is_stale value.
    response = await client.post(
        f"/intent/tasks/{task_id}/execution-anchor/drafts",
        json={"is_stale": True, "technical_boundaries": "x"},
        headers=CG,
    )
    assert response.status_code == 201
    anchor = (await client.get(f"/intent/tasks/{task_id}/execution-anchor")).json()
    assert anchor["is_stale"] is False
