from __future__ import annotations

import uuid
from typing import Any

import pytest
from httpx import AsyncClient
from intent_core_api.intent import core_anchor_service, human_gate_service
from intent_core_api.intent.models import CoreAnchorRevision, HumanGate
from intent_core_api.workflow import decision_service
from intent_core_api.workflow.actors import ActorContext, build_agent_actor
from intent_core_api.workflow.exceptions import ForbiddenActionError
from intent_core_api.workflow.models import Decision
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

VFX = {"X-Actor-Role": "vfx_supervisor", "X-Actor-Id": "vfx-1"}
CG = {"X-Actor-Role": "cg_supervisor", "X-Actor-Id": "cg-1"}
ARTIST = {"X-Actor-Role": "artist", "X-Actor-Id": "artist-1"}

VFX_ACTOR = ActorContext(actor_kind="human", actor_id="vfx-1", human_role="vfx_supervisor")


async def _create_shot(client: AsyncClient) -> str:
    project = (await client.post("/projects", json={"name": "Demo Project"})).json()
    shot = (await client.post("/shots", json={"project_id": project["id"], "name": "SH010"})).json()
    return str(shot["id"])


async def _create_shot_with_brief(
    client: AsyncClient, raw_text: str = "A restrained, cinematic chase scene."
) -> str:
    shot_id = await _create_shot(client)
    response = await client.post(
        "/intent/briefs", json={"shot_id": shot_id, "raw_text": raw_text}, headers=VFX
    )
    assert response.status_code == 201
    return shot_id


async def _create_draft(client: AsyncClient, shot_id: str, **content: Any) -> dict[str, Any]:
    response = await client.post(
        f"/intent/shots/{shot_id}/core-anchor/drafts", json=content, headers=VFX
    )
    assert response.status_code == 201
    result: dict[str, Any] = response.json()
    return result


async def _get_gate(client: AsyncClient, revision_id: str) -> dict[str, Any]:
    response = await client.get(f"/intent/core-anchor-revisions/{revision_id}/human-gate")
    assert response.status_code == 200
    result: dict[str, Any] = response.json()
    return result


# --- gate creation ---


async def test_direct_draft_creates_exactly_one_pending_gate(client: AsyncClient) -> None:
    shot_id = await _create_shot_with_brief(client)
    draft = await _create_draft(client, shot_id, shot_objective="Keep it quiet.")

    gate = await _get_gate(client, draft["id"])
    assert gate["shot_id"] == shot_id
    assert gate["core_anchor_revision_id"] == draft["id"]
    assert gate["gate_type"] == "core_anchor_confirmation"
    assert gate["required_role"] == "vfx_supervisor"
    assert gate["status"] == "pending"
    assert gate["opened_at"]
    assert gate["resolved_at"] is None
    assert gate["resolved_by_actor_id"] is None
    assert gate["resolved_by_role"] is None
    assert gate["resolved_by_actor_type"] is None
    assert gate["rationale"] is None
    assert gate["decision_id"] is None


async def test_core_agent_direct_generate_creates_exactly_one_pending_gate(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot_id = await _create_shot_with_brief(client)

    draft = (await client.post(f"/intent/shots/{shot_id}/core-anchor/generate")).json()

    gate = await _get_gate(client, draft["id"])
    assert gate["status"] == "pending"

    all_gates = (await session.execute(select(HumanGate))).scalars().all()
    assert len(all_gates) == 1


async def test_decomposition_to_draft_creates_exactly_one_pending_gate(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot_id = await _create_shot_with_brief(client)
    decomposition = (
        await client.post(f"/intent/shots/{shot_id}/intent-decompositions/generate", headers=VFX)
    ).json()

    draft = (
        await client.post(
            f"/intent/intent-decompositions/{decomposition['id']}/core-anchor-draft",
            json={},
            headers=VFX,
        )
    ).json()

    gate = await _get_gate(client, draft["id"])
    assert gate["status"] == "pending"
    assert draft["source_intent_decomposition_id"] == decomposition["id"]

    all_gates = (await session.execute(select(HumanGate))).scalars().all()
    assert len(all_gates) == 1


async def test_no_duplicate_gate_across_multiple_drafts_for_one_shot(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot_id = await _create_shot_with_brief(client)
    first = await _create_draft(client, shot_id)
    await client.post(f"/intent/core-anchor-revisions/{first['id']}/reject", json={}, headers=VFX)
    second = await _create_draft(client, shot_id)

    all_gates = (await session.execute(select(HumanGate))).scalars().all()
    assert len(all_gates) == 2
    revision_ids = {g.core_anchor_revision_id for g in all_gates}
    assert revision_ids == {uuid.UUID(first["id"]), uuid.UUID(second["id"])}


async def test_unrelated_agent_capabilities_create_no_gate(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot_id = await _create_shot_with_brief(client)

    await client.post(f"/intent/shots/{shot_id}/intent-decompositions/generate", headers=VFX)
    await client.post(f"/intent/shots/{shot_id}/context-reconstructions/generate", headers=VFX)

    all_gates = (await session.execute(select(HumanGate))).scalars().all()
    assert all_gates == []


# --- confirm ---


async def test_vfx_supervisor_confirms_pending_gate(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot_id = await _create_shot_with_brief(client)
    draft = await _create_draft(client, shot_id, shot_objective="Keep it quiet.")

    confirmed = (
        await client.post(
            f"/intent/core-anchor-revisions/{draft['id']}/confirm",
            json={"rationale": "Looks right."},
            headers=VFX,
        )
    ).json()
    assert confirmed["status"] == "confirmed"

    gate = await _get_gate(client, draft["id"])
    assert gate["status"] == "confirmed"
    assert gate["resolved_at"] is not None
    assert gate["resolved_by_actor_id"] == "vfx-1"
    assert gate["resolved_by_role"] == "vfx_supervisor"
    assert gate["resolved_by_actor_type"] == "human"
    assert gate["rationale"] == "Looks right."
    assert gate["decision_id"] is not None

    decision = await session.get(Decision, uuid.UUID(gate["decision_id"]))
    assert decision is not None
    assert decision.decision_type == "confirm_core_anchor"
    assert decision.entity_id == uuid.UUID(draft["id"])


async def test_confirm_does_not_create_a_second_resolution_or_decision(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot_id = await _create_shot_with_brief(client)
    draft = await _create_draft(client, shot_id)
    await client.post(f"/intent/core-anchor-revisions/{draft['id']}/confirm", json={}, headers=VFX)

    second_attempt = await client.post(
        f"/intent/core-anchor-revisions/{draft['id']}/confirm", json={}, headers=VFX
    )
    assert second_attempt.status_code == 409

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


# --- reject ---


async def test_vfx_supervisor_rejects_pending_gate(client: AsyncClient) -> None:
    shot_id = await _create_shot_with_brief(client)
    draft = await _create_draft(client, shot_id)

    rejected = (
        await client.post(
            f"/intent/core-anchor-revisions/{draft['id']}/reject",
            json={"rationale": "Not aligned."},
            headers=VFX,
        )
    ).json()
    assert rejected["status"] == "rejected"

    gate = await _get_gate(client, draft["id"])
    assert gate["status"] == "rejected"
    assert gate["resolved_by_actor_id"] == "vfx-1"
    assert gate["rationale"] == "Not aligned."
    assert gate["decision_id"] is not None


async def test_reject_does_not_create_a_second_resolution(client: AsyncClient) -> None:
    shot_id = await _create_shot_with_brief(client)
    draft = await _create_draft(client, shot_id)
    await client.post(f"/intent/core-anchor-revisions/{draft['id']}/reject", json={}, headers=VFX)

    second_attempt = await client.post(
        f"/intent/core-anchor-revisions/{draft['id']}/reject", json={}, headers=VFX
    )
    assert second_attempt.status_code == 409

    gate = await _get_gate(client, draft["id"])
    assert gate["status"] == "rejected"


async def test_confirming_a_rejected_gate_conflicts(client: AsyncClient) -> None:
    shot_id = await _create_shot_with_brief(client)
    draft = await _create_draft(client, shot_id)
    await client.post(f"/intent/core-anchor-revisions/{draft['id']}/reject", json={}, headers=VFX)

    response = await client.post(
        f"/intent/core-anchor-revisions/{draft['id']}/confirm", json={}, headers=VFX
    )
    assert response.status_code == 409


# --- authority ---


async def test_cg_supervisor_and_artist_cannot_confirm_or_reject(client: AsyncClient) -> None:
    shot_id = await _create_shot_with_brief(client)
    for headers in (CG, ARTIST):
        draft = await _create_draft(client, shot_id)
        confirm_response = await client.post(
            f"/intent/core-anchor-revisions/{draft['id']}/confirm", json={}, headers=headers
        )
        assert confirm_response.status_code == 403
        reject_response = await client.post(
            f"/intent/core-anchor-revisions/{draft['id']}/reject", json={}, headers=headers
        )
        assert reject_response.status_code == 403
        gate = await _get_gate(client, draft["id"])
        assert gate["status"] == "pending"


async def test_agent_actor_cannot_resolve_a_gate(session: AsyncSession) -> None:
    agent = build_agent_actor("core_agent", uuid.uuid4())
    with pytest.raises(ForbiddenActionError):
        await core_anchor_service.confirm_revision(session, agent, uuid.uuid4())
    with pytest.raises(ForbiddenActionError):
        await core_anchor_service.reject_revision(session, agent, uuid.uuid4())


# --- legacy compatibility ---


async def _create_legacy_draft_without_gate(
    session: AsyncSession, shot_id: uuid.UUID
) -> CoreAnchorRevision:
    """Bypasses core_anchor_service.create_draft_revision entirely --
    simulates a CoreAnchorRevision created before migration 0017, when no
    HumanGate row could have existed.
    """
    from intent_core_api.intent.core_anchor_service import get_or_create_core_anchor

    anchor = await get_or_create_core_anchor(session, shot_id)
    revision = CoreAnchorRevision(
        core_anchor_id=anchor.id,
        revision_number=99,
        status="draft",
        created_by_actor_kind="human",
        created_by_actor_id="vfx-1",
        created_by_human_role="vfx_supervisor",
    )
    session.add(revision)
    await session.commit()
    await session.refresh(revision)
    return revision


async def test_legacy_draft_without_gate_remains_readable(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot_id = await _create_shot_with_brief(client)
    legacy = await _create_legacy_draft_without_gate(session, uuid.UUID(shot_id))

    revision_response = await client.get(f"/intent/core-anchor-revisions/{legacy.id}")
    assert revision_response.status_code == 200

    gate_response = await client.get(f"/intent/core-anchor-revisions/{legacy.id}/human-gate")
    assert gate_response.status_code == 404


async def test_confirming_legacy_draft_creates_and_resolves_one_gate_atomically(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot_id = await _create_shot_with_brief(client)
    legacy = await _create_legacy_draft_without_gate(session, uuid.UUID(shot_id))

    confirmed = (
        await client.post(
            f"/intent/core-anchor-revisions/{legacy.id}/confirm",
            json={"rationale": "Legacy approval."},
            headers=VFX,
        )
    ).json()
    assert confirmed["status"] == "confirmed"

    gate = await _get_gate(client, str(legacy.id))
    assert gate["status"] == "confirmed"
    assert gate["resolved_by_actor_id"] == "vfx-1"
    assert gate["rationale"] == "Legacy approval."
    assert gate["decision_id"] is not None

    all_gates_for_revision = (
        (
            await session.execute(
                select(HumanGate).where(HumanGate.core_anchor_revision_id == legacy.id)
            )
        )
        .scalars()
        .all()
    )
    assert len(all_gates_for_revision) == 1


async def test_rejecting_legacy_draft_creates_and_resolves_one_gate_atomically(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot_id = await _create_shot_with_brief(client)
    legacy = await _create_legacy_draft_without_gate(session, uuid.UUID(shot_id))

    rejected = (
        await client.post(f"/intent/core-anchor-revisions/{legacy.id}/reject", json={}, headers=VFX)
    ).json()
    assert rejected["status"] == "rejected"

    gate = await _get_gate(client, str(legacy.id))
    assert gate["status"] == "rejected"


async def test_historical_confirmed_revision_without_gate_is_not_backfilled_by_a_read(
    client: AsyncClient, session: AsyncSession
) -> None:
    """A legacy revision that was already confirmed/rejected *before*
    Step 1D (so it never went through the confirm/reject compatibility
    path at all) has no gate and reading it must not create one.
    """
    shot_id = await _create_shot_with_brief(client)
    anchor = await core_anchor_service.get_or_create_core_anchor(session, uuid.UUID(shot_id))
    revision = CoreAnchorRevision(
        core_anchor_id=anchor.id,
        revision_number=99,
        status="confirmed",
        created_by_actor_kind="human",
        created_by_actor_id="vfx-1",
        created_by_human_role="vfx_supervisor",
        confirmed_by_human_role="vfx_supervisor",
        confirmed_by_actor_id="vfx-1",
    )
    session.add(revision)
    await session.commit()
    await session.refresh(revision)

    for _ in range(2):
        response = await client.get(f"/intent/core-anchor-revisions/{revision.id}/human-gate")
        assert response.status_code == 404

    all_gates = (
        (
            await session.execute(
                select(HumanGate).where(HumanGate.core_anchor_revision_id == revision.id)
            )
        )
        .scalars()
        .all()
    )
    assert all_gates == []


# --- atomicity ---


async def test_simulated_decision_failure_leaves_gate_pending_and_revision_draft(
    client: AsyncClient, session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    shot_id = await _create_shot_with_brief(client)
    draft = await _create_draft(client, shot_id)

    async def _failing_record_decision(*args: Any, **kwargs: Any) -> Decision:
        raise RuntimeError("simulated decision failure")

    monkeypatch.setattr(decision_service, "record_decision", _failing_record_decision)

    with pytest.raises(RuntimeError):
        await core_anchor_service.confirm_revision(session, VFX_ACTOR, uuid.UUID(draft["id"]))

    monkeypatch.undo()

    revision = await session.get(CoreAnchorRevision, uuid.UUID(draft["id"]))
    assert revision is not None
    await session.refresh(revision)
    assert revision.status == "draft"

    gate = await human_gate_service.get_gate_for_revision(session, uuid.UUID(draft["id"]))
    assert gate is not None
    await session.refresh(gate)
    assert gate.status == "pending"

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


async def test_simulated_gate_resolution_failure_leaves_no_confirmed_revision_or_orphan_decision(
    client: AsyncClient, session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    shot_id = await _create_shot_with_brief(client)
    draft = await _create_draft(client, shot_id)

    def _failing_resolve_gate(*args: Any, **kwargs: Any) -> None:
        raise RuntimeError("simulated gate resolution failure")

    monkeypatch.setattr(human_gate_service, "resolve_gate", _failing_resolve_gate)

    with pytest.raises(RuntimeError):
        await core_anchor_service.confirm_revision(session, VFX_ACTOR, uuid.UUID(draft["id"]))

    monkeypatch.undo()

    revision = await session.get(CoreAnchorRevision, uuid.UUID(draft["id"]))
    assert revision is not None
    await session.refresh(revision)
    assert revision.status == "draft"

    gate = await human_gate_service.get_gate_for_revision(session, uuid.UUID(draft["id"]))
    assert gate is not None
    await session.refresh(gate)
    assert gate.status == "pending"

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


async def test_gate_creation_failure_leaves_no_successful_draft_result(
    client: AsyncClient, session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    shot_id = await _create_shot_with_brief(client)

    async def _failing_create_pending_gate(*args: Any, **kwargs: Any) -> HumanGate:
        raise RuntimeError("simulated gate persistence failure")

    monkeypatch.setattr(human_gate_service, "create_pending_gate", _failing_create_pending_gate)

    with pytest.raises(RuntimeError):
        await core_anchor_service.create_draft_revision(
            session, VFX_ACTOR, uuid.UUID(shot_id), {"shot_objective": "x"}
        )

    monkeypatch.undo()

    revisions = (await session.execute(select(CoreAnchorRevision))).scalars().all()
    assert revisions == []
    gates = (await session.execute(select(HumanGate))).scalars().all()
    assert gates == []


async def test_draft_creation_failure_leaves_no_gate(
    client: AsyncClient, session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    shot_id = await _create_shot_with_brief(client)

    async def _failing_replace_semantic_collections(*args: Any, **kwargs: Any) -> None:
        raise RuntimeError("simulated semantic-collection persistence failure")

    monkeypatch.setattr(
        core_anchor_service,
        "_replace_semantic_collections_for_create",
        _failing_replace_semantic_collections,
    )

    with pytest.raises(RuntimeError):
        await core_anchor_service.create_draft_revision(
            session, VFX_ACTOR, uuid.UUID(shot_id), {"shot_objective": "x"}
        )

    monkeypatch.undo()

    revisions = (await session.execute(select(CoreAnchorRevision))).scalars().all()
    assert revisions == []
    gates = (await session.execute(select(HumanGate))).scalars().all()
    assert gates == []


# --- side effects ---


async def test_confirm_produces_no_side_effects_on_other_domain_objects(
    client: AsyncClient, session: AsyncSession
) -> None:
    from intent_core_api.agents.models import AgentRun
    from intent_core_api.integrations.models import WritebackRecord
    from intent_core_api.intent.models import ContextReconstruction, IntentDecomposition
    from intent_core_api.versions_and_feedback.models import AlignmentAssessment

    shot_id = await _create_shot_with_brief(client)
    draft = await _create_draft(client, shot_id)

    before_decompositions = len(
        (await session.execute(select(IntentDecomposition))).scalars().all()
    )
    before_reconstructions = len(
        (await session.execute(select(ContextReconstruction))).scalars().all()
    )
    before_assessments = len((await session.execute(select(AlignmentAssessment))).scalars().all())
    before_writebacks = len((await session.execute(select(WritebackRecord))).scalars().all())

    await client.post(f"/intent/core-anchor-revisions/{draft['id']}/confirm", json={}, headers=VFX)

    assert (
        len((await session.execute(select(IntentDecomposition))).scalars().all())
        == before_decompositions
    )
    assert (
        len((await session.execute(select(ContextReconstruction))).scalars().all())
        == before_reconstructions
    )
    assert (
        len((await session.execute(select(AlignmentAssessment))).scalars().all())
        == before_assessments
    )
    assert (
        len((await session.execute(select(WritebackRecord))).scalars().all()) == before_writebacks
    )

    agent_types = set((await session.execute(select(AgentRun.agent_type))).scalars().all())
    assert agent_types <= {"core_agent"}


# --- API ---


async def test_get_gate_success(client: AsyncClient) -> None:
    shot_id = await _create_shot_with_brief(client)
    draft = await _create_draft(client, shot_id)

    response = await client.get(f"/intent/core-anchor-revisions/{draft['id']}/human-gate")
    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {
        "id",
        "shot_id",
        "core_anchor_revision_id",
        "execution_anchor_revision_id",
        "gate_type",
        "required_role",
        "status",
        "opened_at",
        "resolved_at",
        "resolved_by_actor_id",
        "resolved_by_role",
        "resolved_by_actor_type",
        "rationale",
        "decision_id",
        "created_at",
        "updated_at",
    }


async def test_get_gate_for_unknown_revision_returns_404(client: AsyncClient) -> None:
    response = await client.get(
        "/intent/core-anchor-revisions/00000000-0000-0000-0000-000000000000/human-gate"
    )
    assert response.status_code == 404


async def test_get_gate_readable_by_all_three_human_roles(client: AsyncClient) -> None:
    shot_id = await _create_shot_with_brief(client)
    draft = await _create_draft(client, shot_id)

    for headers in (VFX, CG, ARTIST):
        response = await client.get(
            f"/intent/core-anchor-revisions/{draft['id']}/human-gate", headers=headers
        )
        assert response.status_code == 200
