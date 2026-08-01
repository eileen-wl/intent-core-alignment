from __future__ import annotations

import uuid
from typing import Any

import pytest
from httpx import AsyncClient
from intent_core_api.intent import core_anchor_service, execution_anchor_service, human_gate_service
from intent_core_api.intent.models import ExecutionAnchorRevision, HumanGate
from intent_core_api.production_context.models import Project, Shot, Task
from intent_core_api.workflow import decision_service
from intent_core_api.workflow.actors import ActorContext, build_agent_actor
from intent_core_api.workflow.exceptions import ForbiddenActionError
from intent_core_api.workflow.models import Decision
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

VFX = {"X-Actor-Role": "vfx_supervisor", "X-Actor-Id": "vfx-1"}
CG = {"X-Actor-Role": "cg_supervisor", "X-Actor-Id": "cg-1"}
ARTIST = {"X-Actor-Role": "artist", "X-Actor-Id": "artist-1"}

CG_ACTOR = ActorContext(actor_kind="human", actor_id="cg-1", human_role="cg_supervisor")


async def _create_shot_with_confirmed_core_anchor(client: AsyncClient) -> str:
    project = (await client.post("/projects", json={"name": "Demo Project"})).json()
    shot = (await client.post("/shots", json={"project_id": project["id"], "name": "SH010"})).json()
    shot_id = str(shot["id"])
    await client.post(
        "/intent/briefs",
        json={"shot_id": shot_id, "raw_text": "A restrained, cinematic chase scene."},
        headers=VFX,
    )
    draft = (
        await client.post(
            f"/intent/shots/{shot_id}/core-anchor/drafts",
            json={"shot_objective": "Keep it restrained."},
            headers=VFX,
        )
    ).json()
    confirmed = (
        await client.post(
            f"/intent/core-anchor-revisions/{draft['id']}/confirm", json={}, headers=VFX
        )
    ).json()
    assert confirmed["status"] == "confirmed"
    return shot_id


async def _create_task(client: AsyncClient, shot_id: str) -> str:
    task = (
        await client.post(
            "/tasks",
            json={"shot_id": shot_id, "name": "Lighting Pass", "department": "lighting"},
        )
    ).json()
    return str(task["id"])


async def _create_draft(client: AsyncClient, task_id: str, **content: Any) -> dict[str, Any]:
    response = await client.post(
        f"/intent/tasks/{task_id}/execution-anchor/drafts", json=content, headers=CG
    )
    assert response.status_code == 201
    result: dict[str, Any] = response.json()
    return result


async def _get_gate(client: AsyncClient, revision_id: str) -> dict[str, Any]:
    response = await client.get(f"/intent/execution-anchor-revisions/{revision_id}/human-gate")
    assert response.status_code == 200
    result: dict[str, Any] = response.json()
    return result


async def _shot_and_task(client: AsyncClient) -> tuple[str, str]:
    shot_id = await _create_shot_with_confirmed_core_anchor(client)
    task_id = await _create_task(client, shot_id)
    return shot_id, task_id


# --- gate creation ---


async def test_draft_creates_exactly_one_pending_gate(client: AsyncClient) -> None:
    shot_id, task_id = await _shot_and_task(client)
    draft = await _create_draft(client, task_id, technical_boundaries="24fps.")

    gate = await _get_gate(client, draft["id"])
    assert gate["shot_id"] == shot_id
    assert gate["core_anchor_revision_id"] is None
    assert gate["execution_anchor_revision_id"] == draft["id"]
    assert gate["gate_type"] == "execution_anchor_confirmation"
    assert gate["required_role"] == "cg_supervisor"
    assert gate["status"] == "pending"
    assert gate["opened_at"]
    assert gate["resolved_at"] is None
    assert gate["decision_id"] is None


async def test_no_duplicate_gate_across_multiple_drafts_for_one_task(
    client: AsyncClient, session: AsyncSession
) -> None:
    _, task_id = await _shot_and_task(client)
    first = await _create_draft(client, task_id)
    await client.post(
        f"/intent/execution-anchor-revisions/{first['id']}/reject", json={}, headers=CG
    )
    second = await _create_draft(client, task_id)

    all_gates = (
        (
            await session.execute(
                select(HumanGate).where(HumanGate.execution_anchor_revision_id.isnot(None))
            )
        )
        .scalars()
        .all()
    )
    assert len(all_gates) == 2
    revision_ids = {g.execution_anchor_revision_id for g in all_gates}
    assert revision_ids == {uuid.UUID(first["id"]), uuid.UUID(second["id"])}


# --- confirm ---


async def test_cg_supervisor_confirms_pending_gate(
    client: AsyncClient, session: AsyncSession
) -> None:
    _, task_id = await _shot_and_task(client)
    draft = await _create_draft(client, task_id, technical_boundaries="24fps.")

    confirmed = (
        await client.post(
            f"/intent/execution-anchor-revisions/{draft['id']}/confirm",
            json={"rationale": "Looks right."},
            headers=CG,
        )
    ).json()
    assert confirmed["status"] == "confirmed"

    gate = await _get_gate(client, draft["id"])
    assert gate["status"] == "confirmed"
    assert gate["resolved_at"] is not None
    assert gate["resolved_by_actor_id"] == "cg-1"
    assert gate["resolved_by_role"] == "cg_supervisor"
    assert gate["resolved_by_actor_type"] == "human"
    assert gate["rationale"] == "Looks right."
    assert gate["decision_id"] is not None

    decision = await session.get(Decision, uuid.UUID(gate["decision_id"]))
    assert decision is not None
    assert decision.decision_type == "confirm_execution_anchor"
    assert decision.entity_id == uuid.UUID(draft["id"])


async def test_confirm_does_not_create_a_second_resolution_or_decision(
    client: AsyncClient, session: AsyncSession
) -> None:
    _, task_id = await _shot_and_task(client)
    draft = await _create_draft(client, task_id, technical_boundaries="24fps.")
    await client.post(
        f"/intent/execution-anchor-revisions/{draft['id']}/confirm", json={}, headers=CG
    )

    second_attempt = await client.post(
        f"/intent/execution-anchor-revisions/{draft['id']}/confirm", json={}, headers=CG
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


async def test_cg_supervisor_rejects_pending_gate(client: AsyncClient) -> None:
    _, task_id = await _shot_and_task(client)
    draft = await _create_draft(client, task_id)

    rejected = (
        await client.post(
            f"/intent/execution-anchor-revisions/{draft['id']}/reject",
            json={"rationale": "Not aligned."},
            headers=CG,
        )
    ).json()
    assert rejected["status"] == "rejected"

    gate = await _get_gate(client, draft["id"])
    assert gate["status"] == "rejected"
    assert gate["resolved_by_actor_id"] == "cg-1"
    assert gate["rationale"] == "Not aligned."
    assert gate["decision_id"] is not None


async def test_reject_does_not_create_a_second_resolution(client: AsyncClient) -> None:
    _, task_id = await _shot_and_task(client)
    draft = await _create_draft(client, task_id)
    await client.post(
        f"/intent/execution-anchor-revisions/{draft['id']}/reject", json={}, headers=CG
    )

    second_attempt = await client.post(
        f"/intent/execution-anchor-revisions/{draft['id']}/reject", json={}, headers=CG
    )
    assert second_attempt.status_code == 409

    gate = await _get_gate(client, draft["id"])
    assert gate["status"] == "rejected"


# --- authority ---


async def test_vfx_supervisor_and_artist_cannot_confirm_or_reject(client: AsyncClient) -> None:
    _, task_id = await _shot_and_task(client)
    for headers in (VFX, ARTIST):
        draft = await _create_draft(client, task_id)
        confirm_response = await client.post(
            f"/intent/execution-anchor-revisions/{draft['id']}/confirm", json={}, headers=headers
        )
        assert confirm_response.status_code == 403
        reject_response = await client.post(
            f"/intent/execution-anchor-revisions/{draft['id']}/reject", json={}, headers=headers
        )
        assert reject_response.status_code == 403
        gate = await _get_gate(client, draft["id"])
        assert gate["status"] == "pending"


async def test_agent_actor_cannot_resolve_a_gate(session: AsyncSession) -> None:
    agent = build_agent_actor("cg_supervisor_agent", uuid.uuid4())
    with pytest.raises(ForbiddenActionError):
        await execution_anchor_service.confirm_revision(session, agent, uuid.uuid4())
    with pytest.raises(ForbiddenActionError):
        await execution_anchor_service.reject_revision(session, agent, uuid.uuid4())


async def test_vfx_supervisor_and_artist_cannot_create_draft(client: AsyncClient) -> None:
    _, task_id = await _shot_and_task(client)
    for headers in (VFX, ARTIST):
        response = await client.post(
            f"/intent/tasks/{task_id}/execution-anchor/drafts", json={}, headers=headers
        )
        assert response.status_code == 403


# --- Core Anchor gate remains unchanged ---


async def test_core_anchor_gate_still_has_null_execution_target(client: AsyncClient) -> None:
    shot_id = await _create_shot_with_confirmed_core_anchor(client)
    revisions = (await client.get(f"/intent/shots/{shot_id}/core-anchor/revisions")).json()
    confirmed_revision = next(r for r in revisions if r["status"] == "confirmed")

    gate = (
        await client.get(f"/intent/core-anchor-revisions/{confirmed_revision['id']}/human-gate")
    ).json()
    assert gate["gate_type"] == "core_anchor_confirmation"
    assert gate["core_anchor_revision_id"] == confirmed_revision["id"]
    assert gate["execution_anchor_revision_id"] is None
    assert gate["required_role"] == "vfx_supervisor"


# --- legacy compatibility ---


async def _create_legacy_draft_without_gate(
    session: AsyncSession, task_id: uuid.UUID, core_revision_id: uuid.UUID
) -> ExecutionAnchorRevision:
    """Bypasses execution_anchor_service.create_draft_revision entirely --
    simulates an ExecutionAnchorRevision created before migration 0020,
    when no HumanGate row could have existed for it.
    """
    execution_anchor = await execution_anchor_service.get_or_create_execution_anchor(
        session, task_id
    )
    revision = ExecutionAnchorRevision(
        execution_anchor_id=execution_anchor.id,
        core_anchor_revision_id=core_revision_id,
        revision_number=99,
        status="draft",
        technical_boundaries="Legacy execution boundaries.",
        created_by_actor_kind="human",
        created_by_actor_id="cg-1",
        created_by_human_role="cg_supervisor",
    )
    session.add(revision)
    await session.commit()
    await session.refresh(revision)
    return revision


async def _confirmed_core_revision_id(client: AsyncClient, shot_id: str) -> str:
    revisions = (await client.get(f"/intent/shots/{shot_id}/core-anchor/revisions")).json()
    confirmed_revision = next(r for r in revisions if r["status"] == "confirmed")
    return str(confirmed_revision["id"])


async def test_legacy_draft_without_gate_remains_readable(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot_id, task_id = await _shot_and_task(client)
    core_revision_id = await _confirmed_core_revision_id(client, shot_id)
    legacy = await _create_legacy_draft_without_gate(
        session, uuid.UUID(task_id), uuid.UUID(core_revision_id)
    )

    revision_response = await client.get(f"/intent/execution-anchor-revisions/{legacy.id}")
    assert revision_response.status_code == 200

    gate_response = await client.get(f"/intent/execution-anchor-revisions/{legacy.id}/human-gate")
    assert gate_response.status_code == 404


async def test_confirming_legacy_draft_creates_and_resolves_one_gate_atomically(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot_id, task_id = await _shot_and_task(client)
    core_revision_id = await _confirmed_core_revision_id(client, shot_id)
    legacy = await _create_legacy_draft_without_gate(
        session, uuid.UUID(task_id), uuid.UUID(core_revision_id)
    )

    confirmed = (
        await client.post(
            f"/intent/execution-anchor-revisions/{legacy.id}/confirm",
            json={"rationale": "Legacy approval."},
            headers=CG,
        )
    ).json()
    assert confirmed["status"] == "confirmed"

    gate = await _get_gate(client, str(legacy.id))
    assert gate["status"] == "confirmed"
    assert gate["resolved_by_actor_id"] == "cg-1"
    assert gate["rationale"] == "Legacy approval."
    assert gate["decision_id"] is not None

    all_gates_for_revision = (
        (
            await session.execute(
                select(HumanGate).where(HumanGate.execution_anchor_revision_id == legacy.id)
            )
        )
        .scalars()
        .all()
    )
    assert len(all_gates_for_revision) == 1


async def test_rejecting_legacy_draft_creates_and_resolves_one_gate_atomically(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot_id, task_id = await _shot_and_task(client)
    core_revision_id = await _confirmed_core_revision_id(client, shot_id)
    legacy = await _create_legacy_draft_without_gate(
        session, uuid.UUID(task_id), uuid.UUID(core_revision_id)
    )

    rejected = (
        await client.post(
            f"/intent/execution-anchor-revisions/{legacy.id}/reject", json={}, headers=CG
        )
    ).json()
    assert rejected["status"] == "rejected"

    gate = await _get_gate(client, str(legacy.id))
    assert gate["status"] == "rejected"


# --- atomicity ---


async def test_simulated_decision_failure_leaves_gate_pending_and_revision_draft(
    client: AsyncClient, session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    _, task_id = await _shot_and_task(client)
    draft = await _create_draft(client, task_id, technical_boundaries="24fps.")

    async def _failing_record_decision(*args: Any, **kwargs: Any) -> Decision:
        raise RuntimeError("simulated decision failure")

    monkeypatch.setattr(decision_service, "record_decision", _failing_record_decision)

    with pytest.raises(RuntimeError):
        await execution_anchor_service.confirm_revision(session, CG_ACTOR, uuid.UUID(draft["id"]))

    monkeypatch.undo()

    revision = await session.get(ExecutionAnchorRevision, uuid.UUID(draft["id"]))
    assert revision is not None
    await session.refresh(revision)
    assert revision.status == "draft"

    gate = await human_gate_service.get_gate_for_execution_anchor_revision(
        session, uuid.UUID(draft["id"])
    )
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
    _, task_id = await _shot_and_task(client)
    draft = await _create_draft(client, task_id, technical_boundaries="24fps.")

    def _failing_resolve_gate(*args: Any, **kwargs: Any) -> None:
        raise RuntimeError("simulated gate resolution failure")

    monkeypatch.setattr(human_gate_service, "resolve_gate", _failing_resolve_gate)

    with pytest.raises(RuntimeError):
        await execution_anchor_service.confirm_revision(session, CG_ACTOR, uuid.UUID(draft["id"]))

    monkeypatch.undo()

    revision = await session.get(ExecutionAnchorRevision, uuid.UUID(draft["id"]))
    assert revision is not None
    await session.refresh(revision)
    assert revision.status == "draft"

    gate = await human_gate_service.get_gate_for_execution_anchor_revision(
        session, uuid.UUID(draft["id"])
    )
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
    shot_id, task_id = await _shot_and_task(client)

    async def _failing_create_pending_gate(*args: Any, **kwargs: Any) -> HumanGate:
        raise RuntimeError("simulated gate persistence failure")

    monkeypatch.setattr(human_gate_service, "create_pending_gate", _failing_create_pending_gate)

    with pytest.raises(RuntimeError):
        await execution_anchor_service.create_draft_revision(
            session, CG_ACTOR, uuid.UUID(task_id), {}
        )

    monkeypatch.undo()

    revisions = (await session.execute(select(ExecutionAnchorRevision))).scalars().all()
    assert revisions == []
    gates = (
        (
            await session.execute(
                select(HumanGate).where(HumanGate.execution_anchor_revision_id.isnot(None))
            )
        )
        .scalars()
        .all()
    )
    assert gates == []


# --- exactly-one-target DB constraint ---


async def test_human_gate_cannot_have_both_targets_populated(session: AsyncSession) -> None:
    shot_id, task_id = await _shot_and_task_via_session(session)
    core_revision_id, execution_revision_id = await _core_and_execution_revision_ids(
        session, shot_id, task_id
    )

    gate = HumanGate(
        shot_id=shot_id,
        core_anchor_revision_id=core_revision_id,
        execution_anchor_revision_id=execution_revision_id,
        gate_type="core_anchor_confirmation",
        required_role="vfx_supervisor",
        status="pending",
    )
    session.add(gate)
    with pytest.raises(IntegrityError):
        await session.flush()
    await session.rollback()


async def test_human_gate_cannot_have_neither_target_populated(session: AsyncSession) -> None:
    shot_id, _ = await _shot_and_task_via_session(session)

    gate = HumanGate(
        shot_id=shot_id,
        core_anchor_revision_id=None,
        execution_anchor_revision_id=None,
        gate_type="core_anchor_confirmation",
        required_role="vfx_supervisor",
        status="pending",
    )
    session.add(gate)
    with pytest.raises(IntegrityError):
        await session.flush()
    await session.rollback()


async def _shot_and_task_via_session(session: AsyncSession) -> tuple[uuid.UUID, uuid.UUID]:
    project = Project(name="Demo Project")
    session.add(project)
    await session.flush()
    shot = Shot(project_id=project.id, name="SH010")
    session.add(shot)
    await session.flush()
    task = Task(shot_id=shot.id, name="Lighting Pass", department="lighting")
    session.add(task)
    await session.flush()
    await session.commit()
    return shot.id, task.id


async def _core_and_execution_revision_ids(
    session: AsyncSession, shot_id: uuid.UUID, task_id: uuid.UUID
) -> tuple[uuid.UUID, uuid.UUID]:
    core_actor = ActorContext(actor_kind="human", actor_id="vfx-1", human_role="vfx_supervisor")
    core_draft = await core_anchor_service.create_draft_revision(
        session, core_actor, shot_id, {"shot_objective": "Keep it restrained."}
    )
    core_confirmed = await core_anchor_service.confirm_revision(session, core_actor, core_draft.id)

    execution_draft = await execution_anchor_service.create_draft_revision(
        session, CG_ACTOR, task_id, {}
    )
    return core_confirmed.id, execution_draft.id


# --- side effects ---


async def test_confirm_produces_no_side_effects_on_other_domain_objects(
    client: AsyncClient, session: AsyncSession
) -> None:
    from intent_core_api.agents.models import AgentRun
    from intent_core_api.integrations.models import WritebackRecord
    from intent_core_api.intent.models import ContextReconstruction, IntentDecomposition
    from intent_core_api.versions_and_feedback.models import AlignmentAssessment

    _, task_id = await _shot_and_task(client)
    draft = await _create_draft(client, task_id, technical_boundaries="24fps.")

    before_decompositions = len(
        (await session.execute(select(IntentDecomposition))).scalars().all()
    )
    before_reconstructions = len(
        (await session.execute(select(ContextReconstruction))).scalars().all()
    )
    before_assessments = len((await session.execute(select(AlignmentAssessment))).scalars().all())
    before_writebacks = len((await session.execute(select(WritebackRecord))).scalars().all())

    await client.post(
        f"/intent/execution-anchor-revisions/{draft['id']}/confirm", json={}, headers=CG
    )

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
    _, task_id = await _shot_and_task(client)
    draft = await _create_draft(client, task_id)

    response = await client.get(f"/intent/execution-anchor-revisions/{draft['id']}/human-gate")
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
        "/intent/execution-anchor-revisions/00000000-0000-0000-0000-000000000000/human-gate"
    )
    assert response.status_code == 404


async def test_get_gate_readable_by_all_three_human_roles(client: AsyncClient) -> None:
    _, task_id = await _shot_and_task(client)
    draft = await _create_draft(client, task_id)

    for headers in (VFX, CG, ARTIST):
        response = await client.get(
            f"/intent/execution-anchor-revisions/{draft['id']}/human-gate", headers=headers
        )
        assert response.status_code == 200


async def test_list_revisions_for_task_endpoint(client: AsyncClient) -> None:
    _, task_id = await _shot_and_task(client)
    draft = await _create_draft(client, task_id)

    response = await client.get(f"/intent/tasks/{task_id}/execution-anchor/revisions")
    assert response.status_code == 200
    revisions = response.json()
    assert [r["id"] for r in revisions] == [draft["id"]]
