from __future__ import annotations

import uuid
from typing import Any

from httpx import AsyncClient
from intent_core_api.audit.models import AuditEvent
from intent_core_api.intent.models import CoreAnchor, CoreAnchorRevision
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


async def _create_draft(client: AsyncClient, shot_id: str, **content: str) -> dict[str, Any]:
    response = await client.post(
        f"/intent/shots/{shot_id}/core-anchor/drafts", json=content, headers=VFX
    )
    assert response.status_code == 201
    result: dict[str, Any] = response.json()
    return result


async def test_create_draft_gets_or_creates_core_anchor(client: AsyncClient) -> None:
    shot_id = await _create_shot(client)
    draft = await _create_draft(client, shot_id, shot_objective="Keep the dread quiet")
    assert draft["status"] == "draft"
    assert draft["revision_number"] == 1
    assert draft["created_by_actor_kind"] == "human"
    assert draft["created_by_human_role"] == "vfx_supervisor"

    anchor_response = await client.get(f"/intent/shots/{shot_id}/core-anchor")
    assert anchor_response.status_code == 200
    anchor = anchor_response.json()
    assert anchor["shot_id"] == shot_id
    # not active until confirmed
    assert anchor["active_revision_id"] is None


async def test_non_vfx_roles_cannot_create_draft(client: AsyncClient) -> None:
    shot_id = await _create_shot(client)
    for headers in (CG, ARTIST):
        response = await client.post(
            f"/intent/shots/{shot_id}/core-anchor/drafts", json={}, headers=headers
        )
        assert response.status_code == 403


async def test_confirm_requires_vfx_supervisor(client: AsyncClient) -> None:
    shot_id = await _create_shot(client)
    draft = await _create_draft(client, shot_id)
    for headers in (CG, ARTIST):
        response = await client.post(
            f"/intent/core-anchor-revisions/{draft['id']}/confirm", json={}, headers=headers
        )
        assert response.status_code == 403


async def test_confirm_activates_revision_and_records_lineage(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot_id = await _create_shot(client)
    draft = await _create_draft(client, shot_id, shot_objective="Quiet dread")

    confirm_response = await client.post(
        f"/intent/core-anchor-revisions/{draft['id']}/confirm",
        json={"rationale": "matches the brief"},
        headers=VFX,
    )
    assert confirm_response.status_code == 200
    confirmed = confirm_response.json()
    assert confirmed["status"] == "confirmed"
    assert confirmed["confirmed_by_human_role"] == "vfx_supervisor"
    assert confirmed["confirmed_at"] is not None

    anchor = (await client.get(f"/intent/shots/{shot_id}/core-anchor")).json()
    assert anchor["active_revision_id"] == draft["id"]

    decisions = (
        (
            await session.execute(
                select(Decision).where(Decision.entity_id == uuid.UUID(draft["id"]))
            )
        )
        .scalars()
        .all()
    )
    assert len(decisions) == 1
    assert decisions[0].decision_type == "confirm_core_anchor"
    assert decisions[0].owning_human_role == "vfx_supervisor"
    assert decisions[0].actor_kind == "human"

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
    assert len(transitions) == 1
    assert transitions[0].from_state == "draft"
    assert transitions[0].to_state == "confirmed"

    events = (
        (
            await session.execute(
                select(AuditEvent).where(AuditEvent.entity_id == uuid.UUID(draft["id"]))
            )
        )
        .scalars()
        .all()
    )
    assert any(event.action == "core_anchor_revision.confirmed" for event in events)


async def test_confirming_new_draft_supersedes_previous_with_own_audit_event(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot_id = await _create_shot(client)
    draft1 = await _create_draft(client, shot_id, shot_objective="v1")
    await client.post(f"/intent/core-anchor-revisions/{draft1['id']}/confirm", json={}, headers=VFX)

    draft2 = await _create_draft(client, shot_id, shot_objective="v2")
    confirm2 = await client.post(
        f"/intent/core-anchor-revisions/{draft2['id']}/confirm", json={}, headers=VFX
    )
    assert confirm2.status_code == 200
    assert confirm2.json()["supersedes_revision_id"] == draft1["id"]

    draft1_after = (await client.get(f"/intent/core-anchor-revisions/{draft1['id']}")).json()
    assert draft1_after["status"] == "superseded"

    anchor = (await client.get(f"/intent/shots/{shot_id}/core-anchor")).json()
    assert anchor["active_revision_id"] == draft2["id"]

    # The auto-supersede of draft1 must produce its OWN WorkflowTransition
    # and its OWN AuditEvent (system-attributed), distinct from draft2's
    # own confirm-attributed AuditEvent.
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
    # draft1 has two transitions over its lifetime: its own draft->confirmed
    # (human-attributed), and the confirmed->superseded cascade triggered by
    # draft2's confirm (system-attributed) -- assert the latter specifically.
    assert len(all_draft1_transitions) == 2
    supersede_transitions = [t for t in all_draft1_transitions if t.to_state == "superseded"]
    assert len(supersede_transitions) == 1
    assert supersede_transitions[0].from_state == "confirmed"
    assert supersede_transitions[0].actor_kind == "system"
    assert supersede_transitions[0].actor_id == "system"

    supersede_events = (
        (
            await session.execute(
                select(AuditEvent).where(
                    AuditEvent.entity_id == uuid.UUID(draft1["id"]),
                    AuditEvent.action == "core_anchor_revision.auto_superseded",
                )
            )
        )
        .scalars()
        .all()
    )
    assert len(supersede_events) == 1
    assert supersede_events[0].actor_kind == "system"
    assert supersede_events[0].actor_id == "system"

    confirm_events_draft2 = (
        (
            await session.execute(
                select(AuditEvent).where(
                    AuditEvent.entity_id == uuid.UUID(draft2["id"]),
                    AuditEvent.action == "core_anchor_revision.confirmed",
                )
            )
        )
        .scalars()
        .all()
    )
    assert len(confirm_events_draft2) == 1
    assert confirm_events_draft2[0].actor_kind == "human"


async def test_reject_requires_vfx_and_leaves_revision_rejected(client: AsyncClient) -> None:
    shot_id = await _create_shot(client)
    draft = await _create_draft(client, shot_id)

    for headers in (CG, ARTIST):
        response = await client.post(
            f"/intent/core-anchor-revisions/{draft['id']}/reject", json={}, headers=headers
        )
        assert response.status_code == 403

    response = await client.post(
        f"/intent/core-anchor-revisions/{draft['id']}/reject",
        json={"rationale": "does not match the brief"},
        headers=VFX,
    )
    assert response.status_code == 200
    assert response.json()["status"] == "rejected"


async def test_confirmed_revision_is_immutable(client: AsyncClient) -> None:
    shot_id = await _create_shot(client)
    draft = await _create_draft(client, shot_id)
    await client.post(f"/intent/core-anchor-revisions/{draft['id']}/confirm", json={}, headers=VFX)

    # Confirming again must fail with a conflict, not silently succeed.
    response = await client.post(
        f"/intent/core-anchor-revisions/{draft['id']}/confirm", json={}, headers=VFX
    )
    assert response.status_code == 409

    # Rejecting an already-confirmed revision must also fail.
    response = await client.post(
        f"/intent/core-anchor-revisions/{draft['id']}/reject", json={}, headers=VFX
    )
    assert response.status_code == 409

    # PATCH-ing an already-confirmed revision must also fail.
    response = await client.patch(
        f"/intent/core-anchor-revisions/{draft['id']}",
        json={"shot_objective": "changed after confirm"},
        headers=VFX,
    )
    assert response.status_code == 409


async def test_failed_operations_on_confirmed_revision_leave_no_partial_writes(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot_id = await _create_shot(client)
    draft = await _create_draft(client, shot_id, shot_objective="v1")
    confirm_response = await client.post(
        f"/intent/core-anchor-revisions/{draft['id']}/confirm", json={}, headers=VFX
    )
    assert confirm_response.status_code == 200
    revision_id = uuid.UUID(draft["id"])

    async def snapshot() -> tuple[int, int, int, str, uuid.UUID | None]:
        decisions = (await session.execute(select(Decision))).scalars().all()
        transitions = (await session.execute(select(WorkflowTransition))).scalars().all()
        events = (await session.execute(select(AuditEvent))).scalars().all()
        revision = await session.get(CoreAnchorRevision, revision_id)
        assert revision is not None
        await session.refresh(revision)
        anchor = await session.scalar(
            select(CoreAnchor).where(CoreAnchor.shot_id == uuid.UUID(shot_id))
        )
        assert anchor is not None
        await session.refresh(anchor)
        return (
            len(decisions),
            len(transitions),
            len(events),
            revision.status,
            anchor.active_revision_id,
        )

    before = await snapshot()

    # Every one of these must fail (409) on an already-confirmed revision,
    # and none may leave a partial Decision/WorkflowTransition/AuditEvent,
    # a partial status change, or an incorrect active_revision_id update.
    failing_calls = [
        ("post", f"/intent/core-anchor-revisions/{draft['id']}/confirm", {}),
        ("post", f"/intent/core-anchor-revisions/{draft['id']}/reject", {}),
        ("patch", f"/intent/core-anchor-revisions/{draft['id']}", {"shot_objective": "hijacked"}),
    ]
    for method, path, payload in failing_calls:
        response = await getattr(client, method)(path, json=payload, headers=VFX)
        assert response.status_code == 409, (
            f"{method} {path} expected 409, got {response.status_code}"
        )

        after = await snapshot()
        assert after == before, (
            f"{method} {path} left partial writes: before={before} after={after}"
        )


async def test_superseded_revision_is_immutable(client: AsyncClient) -> None:
    shot_id = await _create_shot(client)
    draft1 = await _create_draft(client, shot_id, shot_objective="original")
    await client.post(f"/intent/core-anchor-revisions/{draft1['id']}/confirm", json={}, headers=VFX)

    draft2 = await _create_draft(client, shot_id, shot_objective="v2")
    await client.post(f"/intent/core-anchor-revisions/{draft2['id']}/confirm", json={}, headers=VFX)

    draft1_after = (await client.get(f"/intent/core-anchor-revisions/{draft1['id']}")).json()
    assert draft1_after["status"] == "superseded"

    patch_response = await client.patch(
        f"/intent/core-anchor-revisions/{draft1['id']}",
        json={"shot_objective": "hijacked"},
        headers=VFX,
    )
    assert patch_response.status_code == 409

    confirm_response = await client.post(
        f"/intent/core-anchor-revisions/{draft1['id']}/confirm", json={}, headers=VFX
    )
    assert confirm_response.status_code == 409

    reject_response = await client.post(
        f"/intent/core-anchor-revisions/{draft1['id']}/reject", json={}, headers=VFX
    )
    assert reject_response.status_code == 409

    draft1_final = (await client.get(f"/intent/core-anchor-revisions/{draft1['id']}")).json()
    assert draft1_final["shot_objective"] == "original"
    assert draft1_final["status"] == "superseded"


async def test_rejected_revision_cannot_be_confirmed(client: AsyncClient) -> None:
    shot_id = await _create_shot(client)
    draft = await _create_draft(client, shot_id)
    await client.post(f"/intent/core-anchor-revisions/{draft['id']}/reject", json={}, headers=VFX)

    response = await client.post(
        f"/intent/core-anchor-revisions/{draft['id']}/confirm", json={}, headers=VFX
    )
    assert response.status_code == 409


async def test_get_unknown_revision_returns_404(client: AsyncClient) -> None:
    response = await client.get(
        "/intent/core-anchor-revisions/00000000-0000-0000-0000-000000000000"
    )
    assert response.status_code == 404


async def test_create_draft_for_unknown_shot_returns_404(client: AsyncClient) -> None:
    response = await client.post(
        "/intent/shots/00000000-0000-0000-0000-000000000000/core-anchor/drafts",
        json={},
        headers=VFX,
    )
    assert response.status_code == 404
