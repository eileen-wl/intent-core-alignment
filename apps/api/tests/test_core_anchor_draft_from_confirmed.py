"""`POST /intent/shots/{shot_id}/core-anchor/drafts/from-confirmed`
(Step 7C-2 VFX Intent Workspace): starts a new, human-authored draft
Core Anchor revision by copying the Shot's current confirmed revision's
own content -- the smallest honest supported path for "begin a new
proposed revision" when no suitable API previously existed for a plain
human (non-decomposition, non-Agent-generated) copy-and-edit start.
"""

from __future__ import annotations

import uuid
from typing import Any

from httpx import AsyncClient
from intent_core_api.workflow.models import Decision
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

VFX = {"X-Actor-Role": "vfx_supervisor", "X-Actor-Id": "vfx-1"}
CG = {"X-Actor-Role": "cg_supervisor", "X-Actor-Id": "cg-1"}
ARTIST = {"X-Actor-Role": "artist", "X-Actor-Id": "artist-1"}


async def _create_shot(client: AsyncClient) -> str:
    project = (await client.post("/projects", json={"name": "Demo Project"})).json()
    shot = (await client.post("/shots", json={"project_id": project["id"], "name": "SH010"})).json()
    return str(shot["id"])


async def _create_and_confirm_revision(
    client: AsyncClient, shot_id: str, **content: Any
) -> dict[str, Any]:
    draft = (
        await client.post(
            f"/intent/shots/{shot_id}/core-anchor/drafts", json=content, headers=VFX
        )
    ).json()
    confirmed = (
        await client.post(
            f"/intent/core-anchor-revisions/{draft['id']}/confirm",
            json={"rationale": "baseline"},
            headers=VFX,
        )
    ).json()
    assert confirmed["status"] == "confirmed"
    return confirmed


async def test_creates_draft_from_confirmed_content(client: AsyncClient) -> None:
    shot_id = await _create_shot(client)
    await _create_and_confirm_revision(
        client,
        shot_id,
        shot_objective="A restrained confrontation",
        core_summary="Quiet dread",
        constraints=[{"content": "No jump cuts"}],
        open_questions=[{"question": "Long take or cut?"}],
    )

    response = await client.post(
        f"/intent/shots/{shot_id}/core-anchor/drafts/from-confirmed", headers=VFX
    )
    assert response.status_code == 201
    draft = response.json()
    assert draft["status"] == "draft"
    assert draft["revision_number"] == 2
    assert draft["shot_objective"] == "A restrained confrontation"
    assert draft["core_summary"] == "Quiet dread"
    assert [c["content"] for c in draft["constraints"]] == ["No jump cuts"]
    assert [q["question"] for q in draft["open_questions"]] == ["Long take or cut?"]
    assert draft["created_by_actor_kind"] == "human"
    assert draft["created_by_human_role"] == "vfx_supervisor"
    # Pure human copy-and-edit action -- never Agent-attributed content.
    assert draft["source_intent_decomposition_id"] is None
    assert draft["context_snapshot_id"] is None


async def test_creates_pending_human_gate_atomically(client: AsyncClient) -> None:
    shot_id = await _create_shot(client)
    await _create_and_confirm_revision(client, shot_id, core_summary="Baseline")

    draft = (
        await client.post(
            f"/intent/shots/{shot_id}/core-anchor/drafts/from-confirmed", headers=VFX
        )
    ).json()

    gate_response = await client.get(f"/intent/core-anchor-revisions/{draft['id']}/human-gate")
    assert gate_response.status_code == 200
    gate = gate_response.json()
    assert gate["status"] == "pending"
    assert gate["gate_type"] == "core_anchor_confirmation"


async def test_no_decision_created_until_confirm_or_reject(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot_id = await _create_shot(client)
    await _create_and_confirm_revision(client, shot_id, core_summary="Baseline")

    draft = (
        await client.post(
            f"/intent/shots/{shot_id}/core-anchor/drafts/from-confirmed", headers=VFX
        )
    ).json()

    decisions = (
        await session.execute(
            select(Decision).where(Decision.entity_id == uuid.UUID(draft["id"]))
        )
    ).scalars().all()
    assert decisions == []


async def test_conflict_when_draft_already_exists(client: AsyncClient) -> None:
    shot_id = await _create_shot(client)
    await _create_and_confirm_revision(client, shot_id, core_summary="Baseline")

    first = await client.post(
        f"/intent/shots/{shot_id}/core-anchor/drafts/from-confirmed", headers=VFX
    )
    assert first.status_code == 201

    second = await client.post(
        f"/intent/shots/{shot_id}/core-anchor/drafts/from-confirmed", headers=VFX
    )
    assert second.status_code == 409


async def test_not_found_when_no_confirmed_core_anchor_yet(client: AsyncClient) -> None:
    shot_id = await _create_shot(client)

    response = await client.post(
        f"/intent/shots/{shot_id}/core-anchor/drafts/from-confirmed", headers=VFX
    )
    assert response.status_code == 404


async def test_not_found_when_only_a_draft_exists_no_confirmation_yet(client: AsyncClient) -> None:
    shot_id = await _create_shot(client)
    await client.post(
        f"/intent/shots/{shot_id}/core-anchor/drafts",
        json={"core_summary": "Draft only"},
        headers=VFX,
    )

    response = await client.post(
        f"/intent/shots/{shot_id}/core-anchor/drafts/from-confirmed", headers=VFX
    )
    assert response.status_code == 404


async def test_wrong_role_is_forbidden(client: AsyncClient) -> None:
    shot_id = await _create_shot(client)
    await _create_and_confirm_revision(client, shot_id, core_summary="Baseline")

    for headers in (CG, ARTIST):
        response = await client.post(
            f"/intent/shots/{shot_id}/core-anchor/drafts/from-confirmed", headers=headers
        )
        assert response.status_code == 403


async def test_no_write_back_record_created(client: AsyncClient, session: AsyncSession) -> None:
    from intent_core_api.integrations.models import WritebackRecord

    shot_id = await _create_shot(client)
    await _create_and_confirm_revision(client, shot_id, core_summary="Baseline")

    await client.post(f"/intent/shots/{shot_id}/core-anchor/drafts/from-confirmed", headers=VFX)

    count = (
        await session.execute(select(func.count()).select_from(WritebackRecord))
    ).scalar_one()
    assert count == 0
