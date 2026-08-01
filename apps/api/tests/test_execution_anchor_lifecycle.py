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


async def _confirm_core_anchor(client: AsyncClient, shot_id: str, **content: str) -> dict[str, Any]:
    draft = (
        await client.post(f"/intent/shots/{shot_id}/core-anchor/drafts", json=content, headers=VFX)
    ).json()
    confirmed = (
        await client.post(
            f"/intent/core-anchor-revisions/{draft['id']}/confirm", json={}, headers=VFX
        )
    ).json()
    assert confirmed["status"] == "confirmed"
    return confirmed


async def _create_execution_draft(
    client: AsyncClient, task_id: str, **content: str
) -> dict[str, Any]:
    response = await client.post(
        f"/intent/tasks/{task_id}/execution-anchor/drafts", json=content, headers=CG
    )
    assert response.status_code == 201
    result: dict[str, Any] = response.json()
    return result


async def test_create_execution_draft_resolves_current_confirmed_core_revision(
    client: AsyncClient,
) -> None:
    shot_id, task_id = await _create_shot_and_task(client)
    core_revision = await _confirm_core_anchor(client, shot_id, shot_objective="quiet dread")

    draft = await _create_execution_draft(client, task_id, technical_boundaries="24fps")
    assert draft["status"] == "draft"
    assert draft["revision_number"] == 1
    assert draft["core_anchor_revision_id"] == core_revision["id"]
    assert draft["created_by_actor_kind"] == "human"
    assert draft["created_by_human_role"] == "cg_supervisor"

    anchor = (await client.get(f"/intent/tasks/{task_id}/execution-anchor")).json()
    assert anchor["task_id"] == task_id
    assert anchor["active_revision_id"] is None
    assert anchor["is_stale"] is False


async def test_create_execution_draft_without_confirmed_core_returns_409(
    client: AsyncClient,
) -> None:
    _shot_id, task_id = await _create_shot_and_task(client)
    response = await client.post(
        f"/intent/tasks/{task_id}/execution-anchor/drafts", json={}, headers=CG
    )
    assert response.status_code == 409


async def test_create_execution_draft_for_unknown_task_returns_404(client: AsyncClient) -> None:
    response = await client.post(
        "/intent/tasks/00000000-0000-0000-0000-000000000000/execution-anchor/drafts",
        json={},
        headers=CG,
    )
    assert response.status_code == 404


async def test_non_cg_roles_cannot_create_execution_draft(client: AsyncClient) -> None:
    shot_id, task_id = await _create_shot_and_task(client)
    await _confirm_core_anchor(client, shot_id)
    for headers in (VFX, ARTIST):
        response = await client.post(
            f"/intent/tasks/{task_id}/execution-anchor/drafts", json={}, headers=headers
        )
        assert response.status_code == 403


async def test_confirm_requires_cg_supervisor(client: AsyncClient) -> None:
    shot_id, task_id = await _create_shot_and_task(client)
    await _confirm_core_anchor(client, shot_id)
    draft = await _create_execution_draft(client, task_id)
    for headers in (VFX, ARTIST):
        response = await client.post(
            f"/intent/execution-anchor-revisions/{draft['id']}/confirm", json={}, headers=headers
        )
        assert response.status_code == 403


async def test_confirm_activates_revision_and_records_lineage(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot_id, task_id = await _create_shot_and_task(client)
    await _confirm_core_anchor(client, shot_id)
    draft = await _create_execution_draft(client, task_id, technical_boundaries="24fps")

    confirm_response = await client.post(
        f"/intent/execution-anchor-revisions/{draft['id']}/confirm",
        json={"rationale": "matches the brief"},
        headers=CG,
    )
    assert confirm_response.status_code == 200
    confirmed = confirm_response.json()
    assert confirmed["status"] == "confirmed"
    assert confirmed["confirmed_by_human_role"] == "cg_supervisor"
    assert confirmed["confirmed_at"] is not None

    anchor = (await client.get(f"/intent/tasks/{task_id}/execution-anchor")).json()
    assert anchor["active_revision_id"] == draft["id"]

    revision_id = uuid.UUID(draft["id"])
    decisions = (
        (await session.execute(select(Decision).where(Decision.entity_id == revision_id)))
        .scalars()
        .all()
    )
    assert len(decisions) == 1
    assert decisions[0].decision_type == "confirm_execution_anchor"
    assert decisions[0].owning_human_role == "cg_supervisor"

    transitions = (
        (
            await session.execute(
                select(WorkflowTransition).where(WorkflowTransition.entity_id == revision_id)
            )
        )
        .scalars()
        .all()
    )
    assert len(transitions) == 1
    assert transitions[0].from_state == "draft"
    assert transitions[0].to_state == "confirmed"

    events = (
        (await session.execute(select(AuditEvent).where(AuditEvent.entity_id == revision_id)))
        .scalars()
        .all()
    )
    assert any(event.action == "execution_anchor_revision.confirmed" for event in events)


async def test_confirm_rejects_draft_whose_core_reference_is_no_longer_current(
    client: AsyncClient,
) -> None:
    shot_id, task_id = await _create_shot_and_task(client)
    await _confirm_core_anchor(client, shot_id, shot_objective="v1")
    exec_draft = await _create_execution_draft(client, task_id)

    # Confirm a NEW CoreAnchorRevision, superseding the one exec_draft
    # referenced -- the draft is now stale-at-birth.
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

    response = await client.post(
        f"/intent/execution-anchor-revisions/{exec_draft['id']}/confirm", json={}, headers=CG
    )
    assert response.status_code == 409


async def test_confirming_new_draft_supersedes_previous_with_own_audit_event(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot_id, task_id = await _create_shot_and_task(client)
    await _confirm_core_anchor(client, shot_id, shot_objective="v1")

    draft1 = await _create_execution_draft(client, task_id, technical_boundaries="v1")
    await client.post(
        f"/intent/execution-anchor-revisions/{draft1['id']}/confirm", json={}, headers=CG
    )

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

    draft2 = await _create_execution_draft(client, task_id, technical_boundaries="v2")
    confirm2 = await client.post(
        f"/intent/execution-anchor-revisions/{draft2['id']}/confirm", json={}, headers=CG
    )
    assert confirm2.status_code == 200
    assert confirm2.json()["supersedes_revision_id"] == draft1["id"]

    draft1_after = (await client.get(f"/intent/execution-anchor-revisions/{draft1['id']}")).json()
    assert draft1_after["status"] == "superseded"

    draft1_id = uuid.UUID(draft1["id"])
    all_draft1_transitions = (
        (
            await session.execute(
                select(WorkflowTransition).where(WorkflowTransition.entity_id == draft1_id)
            )
        )
        .scalars()
        .all()
    )
    supersede_transitions = [t for t in all_draft1_transitions if t.to_state == "superseded"]
    assert len(supersede_transitions) == 1
    assert supersede_transitions[0].actor_kind == "system"
    assert supersede_transitions[0].actor_id == "system"

    supersede_events = (
        (
            await session.execute(
                select(AuditEvent).where(
                    AuditEvent.entity_id == draft1_id,
                    AuditEvent.action == "execution_anchor_revision.auto_superseded",
                )
            )
        )
        .scalars()
        .all()
    )
    assert len(supersede_events) == 1
    assert supersede_events[0].actor_kind == "system"


async def test_reject_requires_cg_and_leaves_revision_rejected(client: AsyncClient) -> None:
    shot_id, task_id = await _create_shot_and_task(client)
    await _confirm_core_anchor(client, shot_id)
    draft = await _create_execution_draft(client, task_id)

    for headers in (VFX, ARTIST):
        response = await client.post(
            f"/intent/execution-anchor-revisions/{draft['id']}/reject", json={}, headers=headers
        )
        assert response.status_code == 403

    response = await client.post(
        f"/intent/execution-anchor-revisions/{draft['id']}/reject",
        json={"rationale": "wrong department"},
        headers=CG,
    )
    assert response.status_code == 200
    assert response.json()["status"] == "rejected"


async def test_confirmed_revision_is_immutable(client: AsyncClient) -> None:
    shot_id, task_id = await _create_shot_and_task(client)
    await _confirm_core_anchor(client, shot_id)
    draft = await _create_execution_draft(client, task_id, technical_boundaries="24fps")
    await client.post(
        f"/intent/execution-anchor-revisions/{draft['id']}/confirm", json={}, headers=CG
    )

    response = await client.post(
        f"/intent/execution-anchor-revisions/{draft['id']}/confirm", json={}, headers=CG
    )
    assert response.status_code == 409

    response = await client.post(
        f"/intent/execution-anchor-revisions/{draft['id']}/reject", json={}, headers=CG
    )
    assert response.status_code == 409

    response = await client.patch(
        f"/intent/execution-anchor-revisions/{draft['id']}",
        json={"technical_boundaries": "changed after confirm"},
        headers=CG,
    )
    assert response.status_code == 409


async def test_rejected_revision_cannot_be_confirmed(client: AsyncClient) -> None:
    shot_id, task_id = await _create_shot_and_task(client)
    await _confirm_core_anchor(client, shot_id)
    draft = await _create_execution_draft(client, task_id)
    await client.post(
        f"/intent/execution-anchor-revisions/{draft['id']}/reject", json={}, headers=CG
    )

    response = await client.post(
        f"/intent/execution-anchor-revisions/{draft['id']}/confirm", json={}, headers=CG
    )
    assert response.status_code == 409


async def test_superseded_revision_is_immutable(client: AsyncClient) -> None:
    shot_id, task_id = await _create_shot_and_task(client)
    await _confirm_core_anchor(client, shot_id, shot_objective="v1")

    draft1 = await _create_execution_draft(client, task_id, technical_boundaries="original")
    await client.post(
        f"/intent/execution-anchor-revisions/{draft1['id']}/confirm", json={}, headers=CG
    )

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

    draft2 = await _create_execution_draft(client, task_id, technical_boundaries="v2")
    await client.post(
        f"/intent/execution-anchor-revisions/{draft2['id']}/confirm", json={}, headers=CG
    )

    draft1_after = (await client.get(f"/intent/execution-anchor-revisions/{draft1['id']}")).json()
    assert draft1_after["status"] == "superseded"

    patch_response = await client.patch(
        f"/intent/execution-anchor-revisions/{draft1['id']}",
        json={"technical_boundaries": "hijacked"},
        headers=CG,
    )
    assert patch_response.status_code == 409

    confirm_response = await client.post(
        f"/intent/execution-anchor-revisions/{draft1['id']}/confirm", json={}, headers=CG
    )
    assert confirm_response.status_code == 409

    reject_response = await client.post(
        f"/intent/execution-anchor-revisions/{draft1['id']}/reject", json={}, headers=CG
    )
    assert reject_response.status_code == 409

    draft1_final = (await client.get(f"/intent/execution-anchor-revisions/{draft1['id']}")).json()
    assert draft1_final["technical_boundaries"] == "original"
    assert draft1_final["status"] == "superseded"


async def test_get_unknown_revision_returns_404(client: AsyncClient) -> None:
    response = await client.get(
        "/intent/execution-anchor-revisions/00000000-0000-0000-0000-000000000000"
    )
    assert response.status_code == 404


async def test_get_unknown_task_execution_anchor_returns_404(client: AsyncClient) -> None:
    response = await client.get(
        "/intent/tasks/00000000-0000-0000-0000-000000000000/execution-anchor"
    )
    assert response.status_code == 404


# --- empty-content confirm validation -------------------------------------


async def test_confirming_an_all_empty_draft_is_rejected(client: AsyncClient) -> None:
    shot_id, task_id = await _create_shot_and_task(client)
    await _confirm_core_anchor(client, shot_id)
    draft = await _create_execution_draft(client, task_id)

    response = await client.post(
        f"/intent/execution-anchor-revisions/{draft['id']}/confirm", json={}, headers=CG
    )
    assert response.status_code == 422
    assert "before confirming" in response.json()["detail"]

    unchanged = (await client.get(f"/intent/execution-anchor-revisions/{draft['id']}")).json()
    assert unchanged["status"] == "draft"


async def test_confirming_a_whitespace_only_draft_is_rejected(client: AsyncClient) -> None:
    shot_id, task_id = await _create_shot_and_task(client)
    await _confirm_core_anchor(client, shot_id)
    draft = await _create_execution_draft(
        client,
        task_id,
        technical_boundaries="   ",
        parameter_ranges="\t\n",
        delivery_conditions="",
    )

    response = await client.post(
        f"/intent/execution-anchor-revisions/{draft['id']}/confirm", json={}, headers=CG
    )
    assert response.status_code == 422


async def test_confirming_a_draft_with_one_meaningful_field_succeeds(client: AsyncClient) -> None:
    shot_id, task_id = await _create_shot_and_task(client)
    await _confirm_core_anchor(client, shot_id)
    draft = await _create_execution_draft(
        client, task_id, escalation_conditions="Escalate if the dusk tone reads too bright."
    )

    response = await client.post(
        f"/intent/execution-anchor-revisions/{draft['id']}/confirm", json={}, headers=CG
    )
    assert response.status_code == 200
    assert response.json()["status"] == "confirmed"


async def test_saving_an_all_empty_draft_remains_allowed(client: AsyncClient) -> None:
    shot_id, task_id = await _create_shot_and_task(client)
    await _confirm_core_anchor(client, shot_id)

    # Creating (saving) a completely blank working draft is allowed --
    # the 201 itself proves it; only Confirm is blocked for empty content.
    draft = await _create_execution_draft(client, task_id)
    assert draft["technical_boundaries"] is None

    response = await client.patch(
        f"/intent/execution-anchor-revisions/{draft['id']}",
        json={"technical_boundaries": "   "},
        headers=CG,
    )
    assert response.status_code == 200
    assert response.json()["technical_boundaries"] == "   "
