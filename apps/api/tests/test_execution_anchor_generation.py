"""Step 7C-4 Execution Anchor workflow completion:

- `POST /intent/tasks/{task_id}/execution-anchor/drafts/from-confirmed` --
  human-authored new draft copied from the Task's current confirmed
  Execution Anchor revision, mirroring
  `test_core_anchor_draft_from_confirmed.py`'s coverage shape.
- `POST /intent/tasks/{task_id}/execution-anchor/generate` -- CG Agent
  execution_anchor_drafting capability: reads the Task's Shot's active
  confirmed Core Anchor and translates it into a persisted Execution
  Anchor draft, advisory only, never auto-confirmed.
"""

from __future__ import annotations

import uuid
from typing import Any

from httpx import AsyncClient
from intent_core_api.agents.models import AgentRun
from intent_core_api.workflow.models import Decision
from sqlalchemy import func, select
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


async def _confirm_core_anchor(client: AsyncClient, shot_id: str, **content: Any) -> dict[str, Any]:
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


async def _confirm_execution_anchor(
    client: AsyncClient, task_id: str, **content: Any
) -> dict[str, Any]:
    draft = (
        await client.post(
            f"/intent/tasks/{task_id}/execution-anchor/drafts", json=content, headers=CG
        )
    ).json()
    confirmed = (
        await client.post(
            f"/intent/execution-anchor-revisions/{draft['id']}/confirm",
            json={"rationale": "baseline"},
            headers=CG,
        )
    ).json()
    assert confirmed["status"] == "confirmed"
    return confirmed


# --- draft-from-confirmed ---------------------------------------------------


async def test_from_confirmed_creates_draft_with_confirmed_content(client: AsyncClient) -> None:
    shot_id, task_id = await _create_shot_and_task(client)
    await _confirm_core_anchor(client, shot_id)
    await _confirm_execution_anchor(
        client,
        task_id,
        technical_boundaries="24fps, no motion blur.",
        escalation_conditions="Escalate on contrast drift.",
    )

    response = await client.post(
        f"/intent/tasks/{task_id}/execution-anchor/drafts/from-confirmed", headers=CG
    )
    assert response.status_code == 201
    draft = response.json()
    assert draft["status"] == "draft"
    assert draft["revision_number"] == 2
    assert draft["technical_boundaries"] == "24fps, no motion blur."
    assert draft["escalation_conditions"] == "Escalate on contrast drift."
    assert draft["created_by_actor_kind"] == "human"
    assert draft["created_by_human_role"] == "cg_supervisor"


async def test_from_confirmed_creates_pending_human_gate_atomically(client: AsyncClient) -> None:
    shot_id, task_id = await _create_shot_and_task(client)
    await _confirm_core_anchor(client, shot_id)
    await _confirm_execution_anchor(client, task_id, technical_boundaries="baseline")

    draft = (
        await client.post(
            f"/intent/tasks/{task_id}/execution-anchor/drafts/from-confirmed", headers=CG
        )
    ).json()

    gate_response = await client.get(
        f"/intent/execution-anchor-revisions/{draft['id']}/human-gate"
    )
    assert gate_response.status_code == 200
    gate = gate_response.json()
    assert gate["status"] == "pending"
    assert gate["gate_type"] == "execution_anchor_confirmation"


async def test_from_confirmed_no_decision_until_confirm_or_reject(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot_id, task_id = await _create_shot_and_task(client)
    await _confirm_core_anchor(client, shot_id)
    await _confirm_execution_anchor(client, task_id, technical_boundaries="baseline")

    draft = (
        await client.post(
            f"/intent/tasks/{task_id}/execution-anchor/drafts/from-confirmed", headers=CG
        )
    ).json()

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


async def test_from_confirmed_conflict_when_draft_already_exists(client: AsyncClient) -> None:
    shot_id, task_id = await _create_shot_and_task(client)
    await _confirm_core_anchor(client, shot_id)
    await _confirm_execution_anchor(client, task_id, technical_boundaries="baseline")

    first = await client.post(
        f"/intent/tasks/{task_id}/execution-anchor/drafts/from-confirmed", headers=CG
    )
    assert first.status_code == 201

    second = await client.post(
        f"/intent/tasks/{task_id}/execution-anchor/drafts/from-confirmed", headers=CG
    )
    assert second.status_code == 409


async def test_from_confirmed_not_found_when_no_confirmed_execution_anchor_yet(
    client: AsyncClient,
) -> None:
    shot_id, task_id = await _create_shot_and_task(client)
    await _confirm_core_anchor(client, shot_id)

    response = await client.post(
        f"/intent/tasks/{task_id}/execution-anchor/drafts/from-confirmed", headers=CG
    )
    assert response.status_code == 404


async def test_from_confirmed_not_found_when_only_a_draft_exists(client: AsyncClient) -> None:
    shot_id, task_id = await _create_shot_and_task(client)
    await _confirm_core_anchor(client, shot_id)
    await client.post(
        f"/intent/tasks/{task_id}/execution-anchor/drafts",
        json={"technical_boundaries": "draft only"},
        headers=CG,
    )

    response = await client.post(
        f"/intent/tasks/{task_id}/execution-anchor/drafts/from-confirmed", headers=CG
    )
    assert response.status_code == 404


async def test_from_confirmed_wrong_role_is_forbidden(client: AsyncClient) -> None:
    shot_id, task_id = await _create_shot_and_task(client)
    await _confirm_core_anchor(client, shot_id)
    await _confirm_execution_anchor(client, task_id, technical_boundaries="baseline")

    for headers in (VFX, ARTIST):
        response = await client.post(
            f"/intent/tasks/{task_id}/execution-anchor/drafts/from-confirmed", headers=headers
        )
        assert response.status_code == 403


async def test_from_confirmed_active_revision_never_overwritten(client: AsyncClient) -> None:
    shot_id, task_id = await _create_shot_and_task(client)
    await _confirm_core_anchor(client, shot_id)
    confirmed = await _confirm_execution_anchor(client, task_id, technical_boundaries="baseline")

    await client.post(
        f"/intent/tasks/{task_id}/execution-anchor/drafts/from-confirmed", headers=CG
    )

    anchor = (await client.get(f"/intent/tasks/{task_id}/execution-anchor")).json()
    assert anchor["active_revision_id"] == confirmed["id"]


# --- Agent-assisted generation -----------------------------------------------


async def test_generate_translates_confirmed_core_anchor_into_a_persisted_draft(
    client: AsyncClient,
) -> None:
    shot_id, task_id = await _create_shot_and_task(client)
    await _confirm_core_anchor(
        client,
        shot_id,
        core_summary="A restrained dusk confrontation.",
        visual_focus="Faces and stillness.",
    )

    response = await client.post(f"/intent/tasks/{task_id}/execution-anchor/generate")
    assert response.status_code == 201
    draft = response.json()
    assert draft["status"] == "draft"
    assert draft["created_by_actor_kind"] == "agent"
    assert draft["created_by_agent_type"] == "cg_supervisor_agent"
    assert draft["created_by_human_role"] is None
    # Real, non-fabricated derivation of the confirmed Core Anchor's own
    # content -- not static placeholder UI text.
    assert "restrained dusk confrontation" in draft["technical_boundaries"]
    assert "Faces and stillness" in draft["parameter_ranges"]


async def test_generate_never_auto_confirms(client: AsyncClient) -> None:
    shot_id, task_id = await _create_shot_and_task(client)
    await _confirm_core_anchor(client, shot_id, core_summary="Baseline")

    draft = (
        await client.post(f"/intent/tasks/{task_id}/execution-anchor/generate")
    ).json()
    assert draft["status"] == "draft"

    anchor = (await client.get(f"/intent/tasks/{task_id}/execution-anchor")).json()
    assert anchor["active_revision_id"] is None


async def test_generate_creates_pending_human_gate_atomically(client: AsyncClient) -> None:
    shot_id, task_id = await _create_shot_and_task(client)
    await _confirm_core_anchor(client, shot_id, core_summary="Baseline")

    draft = (
        await client.post(f"/intent/tasks/{task_id}/execution-anchor/generate")
    ).json()

    gate_response = await client.get(
        f"/intent/execution-anchor-revisions/{draft['id']}/human-gate"
    )
    assert gate_response.status_code == 200
    assert gate_response.json()["status"] == "pending"


async def test_generate_records_a_real_agent_run(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot_id, task_id = await _create_shot_and_task(client)
    await _confirm_core_anchor(client, shot_id, core_summary="Baseline")

    draft = (
        await client.post(f"/intent/tasks/{task_id}/execution-anchor/generate")
    ).json()

    runs = (
        (
            await session.execute(
                select(AgentRun).where(AgentRun.agent_type == "cg_supervisor_agent")
            )
        )
        .scalars()
        .all()
    )
    assert len(runs) == 1
    assert runs[0].capability == "execution_anchor_drafting"
    assert runs[0].status == "succeeded"
    assert runs[0].result_revision_id == uuid.UUID(draft["id"])


async def test_generate_conflict_when_draft_already_exists(client: AsyncClient) -> None:
    shot_id, task_id = await _create_shot_and_task(client)
    await _confirm_core_anchor(client, shot_id, core_summary="Baseline")

    first = await client.post(f"/intent/tasks/{task_id}/execution-anchor/generate")
    assert first.status_code == 201

    second = await client.post(f"/intent/tasks/{task_id}/execution-anchor/generate")
    assert second.status_code == 409


async def test_generate_conflict_when_no_confirmed_core_anchor(client: AsyncClient) -> None:
    _shot_id, task_id = await _create_shot_and_task(client)

    response = await client.post(f"/intent/tasks/{task_id}/execution-anchor/generate")
    assert response.status_code == 409


async def test_generate_not_found_for_unknown_task(client: AsyncClient) -> None:
    response = await client.post(
        "/intent/tasks/00000000-0000-0000-0000-000000000000/execution-anchor/generate"
    )
    assert response.status_code == 404


async def test_generate_no_write_back_record_created(
    client: AsyncClient, session: AsyncSession
) -> None:
    from intent_core_api.integrations.models import WritebackRecord

    shot_id, task_id = await _create_shot_and_task(client)
    await _confirm_core_anchor(client, shot_id, core_summary="Baseline")

    await client.post(f"/intent/tasks/{task_id}/execution-anchor/generate")

    count = (
        await session.execute(select(func.count()).select_from(WritebackRecord))
    ).scalar_one()
    assert count == 0
