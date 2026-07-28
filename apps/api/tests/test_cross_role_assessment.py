from __future__ import annotations

import uuid
from typing import Any

import pytest
from httpx import AsyncClient
from intent_core_api.agents import cross_role_assessment_service
from intent_core_api.agents.cross_role_assessment_service import (
    CrossRoleAssessmentGenerator,
    DeepSeekCrossRoleAssessmentGenerator,
    DeterministicCrossRoleAssessmentGenerator,
    derive_intent_signal,
    generate_cross_role_assessment,
)
from intent_core_api.agents.models import AgentRun, ContextSnapshot
from intent_core_api.integrations.models import WritebackRecord
from intent_core_api.intent.models import (
    CGSupervisorReview,
    CoreAnchor,
    CoreAnchorRevision,
    ExecutionAnchor,
    ExecutionAnchorRevision,
    HumanGate,
)
from intent_core_api.versions_and_feedback.models import (
    AlignmentAssessment,
    ArtistAgentGuidance,
    CrossRoleAssessment,
    IntentSignal,
    ReAnchorProposal,
    ReviewNote,
    Version,
    VFXSupervisorReview,
)
from intent_core_api.workflow.actors import ActorContext, build_agent_actor
from intent_core_api.workflow.exceptions import (
    AgentGenerationError,
    ConflictError,
    ForbiddenActionError,
)
from intent_core_api.workflow.models import Decision
from intent_core_contracts.api.cross_role_assessment import (
    CrossRoleAssessmentOutput,
    CrossRoleEvidenceReference,
    CrossRoleFinding,
    ReAnchorFieldProposal,
    ReAnchorProposalOutput,
    RolePerspectiveRead,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

VFX = {"X-Actor-Role": "vfx_supervisor", "X-Actor-Id": "vfx-1"}
CG = {"X-Actor-Role": "cg_supervisor", "X-Actor-Id": "cg-1"}
ARTIST = {"X-Actor-Role": "artist", "X-Actor-Id": "artist-1"}

_SNAPSHOT_KEYS = {
    "project",
    "shot",
    "task",
    "version",
    "intent_brief",
    "intent_decomposition",
    "core_anchor",
    "context_reconstruction",
    "execution_anchor",
    "vfx_supervisor_review",
    "cg_supervisor_review",
    "artist_agent_guidance",
    "decisions",
    "core_anchor_human_gate",
    "execution_anchor_human_gate",
}


def _evidence_ref(source_type: str = "shot") -> CrossRoleEvidenceReference:
    return CrossRoleEvidenceReference(source_type=source_type, source_id="t1", label="Task")


def _base_perspectives() -> list[RolePerspectiveRead]:
    return [
        RolePerspectiveRead(
            role=role,
            current_position="p",
            protected_intent="p",
            main_concerns="m",
            evidence=[_evidence_ref()],
        )
        for role in ("vfx_supervisor", "cg_supervisor", "artist")
    ]


def _base_finding(**overrides: Any) -> CrossRoleFinding:
    defaults: dict[str, Any] = {
        "summary": "short",
        "why_it_matters": "short",
        "affected_roles": ["vfx_supervisor"],
        "priority": "low",
        "evidence": [_evidence_ref()],
    }
    defaults.update(overrides)
    return CrossRoleFinding(**defaults)


def _compliant_evidence_gaps() -> list[str]:
    return [
        "ICAS has not directly inspected footage, rendered frames, scene files, or numeric "
        "parameters for this Task."
    ]


def _make_output(**overrides: Any) -> CrossRoleAssessmentOutput:
    defaults: dict[str, Any] = {
        "executive_summary": "short",
        "shared_intent_read": _base_finding(),
        "role_perspectives": _base_perspectives(),
        "agreements": [],
        "cross_role_tensions": [],
        "local_optimum_risks": [],
        "unresolved_dependencies": [],
        "human_coordination_priorities": [],
        "re_anchor_proposal": None,
        "evidence_gaps": _compliant_evidence_gaps(),
    }
    defaults.update(overrides)
    return CrossRoleAssessmentOutput(**defaults)


async def _create_shot(client: AsyncClient) -> str:
    project = (await client.post("/projects", json={"name": "Demo Project"})).json()
    shot = (await client.post("/shots", json={"project_id": project["id"], "name": "SH010"})).json()
    return str(shot["id"])


async def _create_brief(
    client: AsyncClient, shot_id: str, raw_text: str = "A restrained, cinematic chase scene."
) -> None:
    response = await client.post(
        "/intent/briefs", json={"shot_id": shot_id, "raw_text": raw_text}, headers=VFX
    )
    assert response.status_code == 201


async def _confirm_core_anchor(client: AsyncClient, shot_id: str) -> dict[str, Any]:
    draft = (
        await client.post(
            f"/intent/shots/{shot_id}/core-anchor/drafts",
            json={
                "shot_objective": "Keep it restrained.",
                "core_summary": "A quiet, controlled chase.",
                "constraints": [{"content": "No jump cuts."}],
                "open_questions": [{"question": "Is push-in speed fixed?"}],
            },
            headers=VFX,
        )
    ).json()
    confirmed: dict[str, Any] = (
        await client.post(
            f"/intent/core-anchor-revisions/{draft['id']}/confirm", json={}, headers=VFX
        )
    ).json()
    assert confirmed["status"] == "confirmed"
    return confirmed


async def _create_task(client: AsyncClient, shot_id: str, name: str = "Compositing") -> str:
    task = (
        await client.post("/tasks", json={"shot_id": shot_id, "name": name, "department": "comp"})
    ).json()
    return str(task["id"])


async def _create_confirmed_execution_anchor(client: AsyncClient, task_id: str) -> dict[str, Any]:
    draft = (
        await client.post(
            f"/intent/tasks/{task_id}/execution-anchor/drafts",
            json={"technical_boundaries": "24fps, no motion blur."},
            headers=CG,
        )
    ).json()
    confirmed: dict[str, Any] = (
        await client.post(
            f"/intent/execution-anchor-revisions/{draft['id']}/confirm", json={}, headers=CG
        )
    ).json()
    assert confirmed["status"] == "confirmed"
    return confirmed


async def _create_version(
    client: AsyncClient, shot_id: str, name: str = "SH010_v001", description: str = "First pass."
) -> str:
    version = (
        await client.post(
            "/versions",
            json={"shot_id": shot_id, "name": name, "description": description},
            headers=VFX,
        )
    ).json()
    return str(version["id"])


async def _generate_vfx_review(client: AsyncClient, version_id: str) -> dict[str, Any]:
    response = await client.post(
        f"/intent/versions/{version_id}/vfx-supervisor-reviews/generate", headers=VFX
    )
    assert response.status_code == 201
    return response.json()


async def _generate_cg_review(client: AsyncClient, revision_id: str) -> dict[str, Any]:
    response = await client.post(
        f"/intent/execution-anchor-revisions/{revision_id}/cg-supervisor-reviews/generate",
        headers=CG,
    )
    assert response.status_code == 201
    return response.json()


async def _generate_artist_guidance(
    client: AsyncClient, version_id: str, task_id: str
) -> dict[str, Any]:
    response = await client.post(
        f"/intent/versions/{version_id}/artist-guidances/generate",
        json={"task_id": task_id},
        headers=ARTIST,
    )
    assert response.status_code == 201
    return response.json()


async def _build_ready_shot(client: AsyncClient) -> tuple[str, str, dict[str, Any], str]:
    """Shot + confirmed Core Anchor + Task with a confirmed Execution
    Anchor revision + one Version with all three prerequisite Role Agent
    outputs generated -- the minimum state cross-role assessment
    generation requires.
    """
    shot_id = await _create_shot(client)
    await _create_brief(client, shot_id)
    await _confirm_core_anchor(client, shot_id)
    task_id = await _create_task(client, shot_id)
    confirmed_revision = await _create_confirmed_execution_anchor(client, task_id)
    version_id = await _create_version(client, shot_id)
    await _generate_vfx_review(client, version_id)
    await _generate_cg_review(client, confirmed_revision["id"])
    await _generate_artist_guidance(client, version_id, task_id)
    return shot_id, task_id, confirmed_revision, version_id


async def _generate(
    client: AsyncClient, version_id: str, task_id: str, headers: dict[str, str] = VFX
) -> Any:
    return await client.post(
        f"/intent/versions/{version_id}/cross-role-assessments/generate",
        json={"task_id": task_id},
        headers=headers,
    )


# --- generation + structured output ---


async def test_generate_creates_assessment_with_expected_shape(client: AsyncClient) -> None:
    _, task_id, confirmed_revision, version_id = await _build_ready_shot(client)

    response = await _generate(client, version_id, task_id)
    assert response.status_code == 201
    body = response.json()

    assert body["task_id"] == task_id
    assert body["version_id"] == version_id
    assert body["execution_anchor_revision_id"] == confirmed_revision["id"]
    output = body["assessment_output"]
    assert output["executive_summary"]
    assert output["shared_intent_read"]["summary"]
    assert len(output["role_perspectives"]) == 3
    assert {p["role"] for p in output["role_perspectives"]} == {
        "vfx_supervisor",
        "cg_supervisor",
        "artist",
    }
    assert output["evidence_gaps"]
    assert body["intent_signal"]["attention_level"] in ("low", "medium", "high")
    assert "re_anchor_proposal" in body


async def test_generate_creates_succeeded_agent_run_with_expected_capability(
    client: AsyncClient, session: AsyncSession
) -> None:
    _, task_id, _, version_id = await _build_ready_shot(client)

    body = (await _generate(client, version_id, task_id)).json()

    run = (await client.get(f"/intent/agent-runs/{body['agent_run_id']}")).json()
    assert run["status"] == "succeeded"
    assert run["agent_type"] == "core_agent"
    assert run["capability"] == "cross_role_assessment"
    assert run["provider"] == "deterministic"
    assert run["model_name"] is None
    assert run["prompt_version"] is None
    assert run["result_revision_id"] is None
    assert run["error"] is None
    assert run["completed_at"] is not None

    runs = (
        (
            await session.execute(
                select(AgentRun).where(AgentRun.capability == "cross_role_assessment")
            )
        )
        .scalars()
        .all()
    )
    assert len(runs) == 1


def test_prompt_registry_entry_is_registered() -> None:
    from intent_core_api.agents import prompt_registry

    registration = prompt_registry.get_registration("cross_role_assessment")
    assert registration.agent_type == "core_agent"
    assert registration.capability == "cross_role_assessment"
    assert registration.prompt_key == "core_cross_role_assessment"
    assert registration.version == "v1"
    assert registration.version_label == "core_cross_role_assessment.v1"
    assert registration.max_output_tokens == 8192


# --- prerequisites ---


async def test_generate_returns_409_when_no_confirmed_core_anchor(client: AsyncClient) -> None:
    shot_id = await _create_shot(client)
    task_id = await _create_task(client, shot_id)
    version_id = await _create_version(client, shot_id)

    response = await _generate(client, version_id, task_id)
    assert response.status_code == 409


async def test_generate_returns_409_when_no_confirmed_execution_anchor(
    client: AsyncClient,
) -> None:
    shot_id = await _create_shot(client)
    await _create_brief(client, shot_id)
    await _confirm_core_anchor(client, shot_id)
    task_id = await _create_task(client, shot_id)
    version_id = await _create_version(client, shot_id)

    response = await _generate(client, version_id, task_id)
    assert response.status_code == 409


async def test_generate_returns_409_when_no_vfx_review(client: AsyncClient) -> None:
    shot_id = await _create_shot(client)
    await _create_brief(client, shot_id)
    await _confirm_core_anchor(client, shot_id)
    task_id = await _create_task(client, shot_id)
    confirmed_revision = await _create_confirmed_execution_anchor(client, task_id)
    version_id = await _create_version(client, shot_id)
    await _generate_cg_review(client, confirmed_revision["id"])
    await _generate_artist_guidance(client, version_id, task_id)

    response = await _generate(client, version_id, task_id)
    assert response.status_code == 409


async def test_generate_returns_409_when_no_cg_review(client: AsyncClient) -> None:
    shot_id = await _create_shot(client)
    await _create_brief(client, shot_id)
    await _confirm_core_anchor(client, shot_id)
    task_id = await _create_task(client, shot_id)
    await _create_confirmed_execution_anchor(client, task_id)
    version_id = await _create_version(client, shot_id)
    await _generate_vfx_review(client, version_id)
    await _generate_artist_guidance(client, version_id, task_id)

    response = await _generate(client, version_id, task_id)
    assert response.status_code == 409


async def test_generate_returns_409_when_no_artist_guidance(client: AsyncClient) -> None:
    shot_id = await _create_shot(client)
    await _create_brief(client, shot_id)
    await _confirm_core_anchor(client, shot_id)
    task_id = await _create_task(client, shot_id)
    confirmed_revision = await _create_confirmed_execution_anchor(client, task_id)
    version_id = await _create_version(client, shot_id)
    await _generate_vfx_review(client, version_id)
    await _generate_cg_review(client, confirmed_revision["id"])

    response = await _generate(client, version_id, task_id)
    assert response.status_code == 409


async def test_generate_returns_404_for_task_belonging_to_a_different_shot(
    client: AsyncClient,
) -> None:
    _, _, _, version_id = await _build_ready_shot(client)
    other_shot_id = await _create_shot(client)
    other_task_id = await _create_task(client, other_shot_id)

    response = await _generate(client, version_id, other_task_id)
    assert response.status_code == 404


async def test_prerequisite_failure_creates_no_snapshot_run_or_assessment(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot_id = await _create_shot(client)
    task_id = await _create_task(client, shot_id)
    version_id = await _create_version(client, shot_id)

    response = await _generate(client, version_id, task_id)
    assert response.status_code == 409

    assert (await session.execute(select(ContextSnapshot))).scalars().all() == []
    assert (await session.execute(select(AgentRun))).scalars().all() == []
    assert (await session.execute(select(CrossRoleAssessment))).scalars().all() == []
    assert (await session.execute(select(IntentSignal))).scalars().all() == []
    assert (await session.execute(select(ReAnchorProposal))).scalars().all() == []


# --- snapshot compaction ---


async def test_context_snapshot_contains_expected_keys_and_targets(client: AsyncClient) -> None:
    shot_id, task_id, confirmed_revision, version_id = await _build_ready_shot(client)

    body = (await _generate(client, version_id, task_id)).json()
    snapshot = (await client.get(f"/intent/context-snapshots/{body['context_snapshot_id']}")).json()
    payload = snapshot["payload"]

    assert set(payload.keys()) == _SNAPSHOT_KEYS
    assert payload["shot"]["id"] == shot_id
    assert payload["task"]["id"] == task_id
    assert payload["version"]["id"] == version_id
    assert payload["execution_anchor"]["target_revision"]["id"] == confirmed_revision["id"]
    assert payload["core_anchor"]["confirmed_revision"] is not None
    assert payload["vfx_supervisor_review"] is not None
    assert payload["cg_supervisor_review"] is not None
    assert payload["artist_agent_guidance"] is not None
    payload_text = str(payload)
    for banned in ("api_key", "password", "Authorization"):
        assert banned not in payload_text


async def test_snapshot_excludes_unrelated_task_and_version(client: AsyncClient) -> None:
    shot_id, task_id, _, version_id = await _build_ready_shot(client)
    unrelated_task_id = await _create_task(client, shot_id, name="Lighting")
    unrelated_version_id = await _create_version(
        client, shot_id, name="SH010_unrelated", description="An unrelated pass."
    )

    body = (await _generate(client, version_id, task_id)).json()
    snapshot = (await client.get(f"/intent/context-snapshots/{body['context_snapshot_id']}")).json()
    payload_text = str(snapshot["payload"])

    assert unrelated_task_id not in payload_text
    assert unrelated_version_id not in payload_text


async def test_snapshot_omits_verbose_nested_evidence_trees(client: AsyncClient) -> None:
    _, task_id, _, version_id = await _build_ready_shot(client)

    body = (await _generate(client, version_id, task_id)).json()
    snapshot = (await client.get(f"/intent/context-snapshots/{body['context_snapshot_id']}")).json()
    payload = snapshot["payload"]

    assert set(payload["vfx_supervisor_review"].keys()) == {
        "id",
        "executive_summary",
        "creative_concerns",
        "review_priorities",
        "proposed_feedback",
        "questions_for_human_supervisor",
        "evidence_gaps",
    }
    assert set(payload["cg_supervisor_review"].keys()) == {
        "id",
        "executive_summary",
        "actionable_requirements",
        "technical_concerns",
        "coordination_concerns",
        "implementation_priorities",
        "proposed_execution_guidance",
        "questions_for_human_cg_supervisor",
        "evidence_gaps",
    }
    assert set(payload["artist_agent_guidance"].keys()) == {
        "id",
        "executive_summary",
        "creative_intent_summary",
        "task_goal_summary",
        "current_iteration_summary",
        "non_negotiables",
        "allowed_variations",
        "feedback_translations",
        "iteration_priorities",
        "cross_department_dependencies",
        "questions_for_human_supervisor",
        "evidence_gaps",
    }
    vfx_text = str(payload["vfx_supervisor_review"])
    assert "source_type" not in vfx_text
    assert "creative_direction_read" not in vfx_text


def _collect_real_ids(payload: dict[str, Any]) -> set[str]:
    ids: set[str] = {payload["project"]["id"], payload["shot"]["id"], payload["task"]["id"]}
    ids.add(payload["version"]["id"])
    for note in payload["version"]["review_notes"]:
        ids.add(note["id"])
    if payload["intent_brief"] is not None:
        ids.add(payload["intent_brief"]["id"])
    if payload["intent_decomposition"] is not None:
        ids.add(payload["intent_decomposition"]["id"])
    core_anchor = payload["core_anchor"]
    if core_anchor is not None:
        ids.add(core_anchor["id"])
        revision = core_anchor["confirmed_revision"]
        if revision is not None:
            ids.add(revision["id"])
            for collection in ("constraints", "variation_zones", "drift_risks", "open_questions"):
                for item in revision[collection]:
                    ids.add(item["id"])
    if payload["context_reconstruction"] is not None:
        ids.add(payload["context_reconstruction"]["id"])
    ids.add(payload["execution_anchor"]["target_revision"]["id"])
    if payload["vfx_supervisor_review"] is not None:
        ids.add(payload["vfx_supervisor_review"]["id"])
    if payload["cg_supervisor_review"] is not None:
        ids.add(payload["cg_supervisor_review"]["id"])
    if payload["artist_agent_guidance"] is not None:
        ids.add(payload["artist_agent_guidance"]["id"])
    for decision in payload["decisions"]:
        ids.add(decision["id"])
    return ids


async def test_evidence_references_point_to_ids_in_snapshot(client: AsyncClient) -> None:
    _, task_id, _, version_id = await _build_ready_shot(client)

    body = (await _generate(client, version_id, task_id)).json()
    snapshot = (await client.get(f"/intent/context-snapshots/{body['context_snapshot_id']}")).json()
    real_ids = _collect_real_ids(snapshot["payload"])

    output = body["assessment_output"]
    items = [
        output["shared_intent_read"],
        *output["role_perspectives"],
        *output["agreements"],
        *output["cross_role_tensions"],
        *output["local_optimum_risks"],
        *output["unresolved_dependencies"],
        *output["human_coordination_priorities"],
    ]
    for item in items:
        for evidence in item["evidence"]:
            assert evidence["source_id"] in real_ids


# --- multiple runs / read endpoints ---


async def test_multiple_runs_create_multiple_immutable_assessments(client: AsyncClient) -> None:
    _, task_id, _, version_id = await _build_ready_shot(client)

    first = (await _generate(client, version_id, task_id)).json()
    second = (await _generate(client, version_id, task_id)).json()
    assert first["id"] != second["id"]

    listed = (
        await client.get(
            f"/intent/versions/{version_id}/cross-role-assessments",
            params={"task_id": task_id},
        )
    ).json()
    assert len(listed) == 2


async def test_get_and_list_endpoints_newest_first(client: AsyncClient) -> None:
    _, task_id, _, version_id = await _build_ready_shot(client)
    first = (await _generate(client, version_id, task_id)).json()
    second = (await _generate(client, version_id, task_id)).json()

    fetched = (await client.get(f"/intent/cross-role-assessments/{first['id']}")).json()
    assert fetched["id"] == first["id"]

    listed = (
        await client.get(
            f"/intent/versions/{version_id}/cross-role-assessments",
            params={"task_id": task_id},
        )
    ).json()
    assert [item["id"] for item in listed] == [second["id"], first["id"]]


async def test_get_unknown_assessment_returns_404(client: AsyncClient) -> None:
    response = await client.get(
        "/intent/cross-role-assessments/00000000-0000-0000-0000-000000000000"
    )
    assert response.status_code == 404


async def test_get_unknown_re_anchor_proposal_and_intent_signal_return_404(
    client: AsyncClient,
) -> None:
    zero = "00000000-0000-0000-0000-000000000000"
    assert (await client.get(f"/intent/re-anchor-proposals/{zero}")).status_code == 404
    assert (await client.get(f"/intent/intent-signals/{zero}")).status_code == 404


async def test_get_intent_signal_directly(client: AsyncClient, session: AsyncSession) -> None:
    _, task_id, _, version_id = await _build_ready_shot(client)
    body = (await _generate(client, version_id, task_id)).json()

    signal_id = body["intent_signal"]["id"]
    response = await client.get(f"/intent/intent-signals/{signal_id}")
    assert response.status_code == 200
    assert response.json()["cross_role_assessment_id"] == body["id"]


async def test_all_three_human_roles_may_read(client: AsyncClient) -> None:
    _, task_id, _, version_id = await _build_ready_shot(client)
    body = (await _generate(client, version_id, task_id)).json()

    for headers in (VFX, CG, ARTIST):
        response = await client.get(f"/intent/cross-role-assessments/{body['id']}", headers=headers)
        assert response.status_code == 200


# --- authority ---


async def test_cg_and_artist_cannot_generate(client: AsyncClient) -> None:
    _, task_id, _, version_id = await _build_ready_shot(client)

    for headers in (CG, ARTIST):
        response = await _generate(client, version_id, task_id, headers=headers)
        assert response.status_code == 403


async def test_generate_returns_404_for_unknown_version(client: AsyncClient) -> None:
    _, task_id, _, _ = await _build_ready_shot(client)
    response = await _generate(client, "00000000-0000-0000-0000-000000000000", task_id)
    assert response.status_code == 404


async def test_agent_actor_cannot_generate_at_service_level(session: AsyncSession) -> None:
    agent = build_agent_actor("core_agent", uuid.uuid4())
    with pytest.raises(ForbiddenActionError):
        await generate_cross_role_assessment(session, agent, uuid.uuid4(), uuid.uuid4())


# --- no side effects ---


async def test_generation_creates_no_side_effects_on_other_domain_objects(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot_id, task_id, confirmed_revision, version_id = await _build_ready_shot(client)

    async def _counts() -> dict[str, int]:
        counts: dict[str, int] = {}
        for label, model in (
            ("core_anchors", CoreAnchor),
            ("core_anchor_revisions", CoreAnchorRevision),
            ("human_gates", HumanGate),
            ("execution_anchors", ExecutionAnchor),
            ("execution_anchor_revisions", ExecutionAnchorRevision),
            ("decisions", Decision),
            ("alignment_assessments", AlignmentAssessment),
            ("versions", Version),
            ("review_notes", ReviewNote),
            ("vfx_supervisor_reviews", VFXSupervisorReview),
            ("cg_supervisor_reviews", CGSupervisorReview),
            ("artist_agent_guidances", ArtistAgentGuidance),
            ("writeback_records", WritebackRecord),
        ):
            rows = (await session.execute(select(model))).scalars().all()
            counts[label] = len(rows)
        return counts

    before = await _counts()

    response = await _generate(client, version_id, task_id)
    assert response.status_code == 201

    after = await _counts()
    assert before == after

    agent_types = (await session.execute(select(AgentRun.agent_type).distinct())).scalars().all()
    assert set(agent_types) == {
        "core_agent",
        "vfx_supervisor_agent",
        "cg_supervisor_agent",
        "artist_agent",
    }

    assessments = (
        (
            await session.execute(
                select(CrossRoleAssessment).where(
                    CrossRoleAssessment.version_id == uuid.UUID(version_id)
                )
            )
        )
        .scalars()
        .all()
    )
    assert len(assessments) == 1
    assert str(assessments[0].shot_id) == shot_id
    assert str(assessments[0].task_id) == task_id
    assert str(assessments[0].execution_anchor_revision_id) == confirmed_revision["id"]

    signals = (await session.execute(select(IntentSignal))).scalars().all()
    assert len(signals) == 1
    assert signals[0].cross_role_assessment_id == assessments[0].id

    proposals = (await session.execute(select(ReAnchorProposal))).scalars().all()
    assert len(proposals) == 0


# --- failure handling / atomicity ---


class _FailingGenerator:
    def generate(self, *, snapshot_payload: dict[str, Any]) -> CrossRoleAssessmentOutput:
        raise RuntimeError("simulated provider timeout")


async def test_provider_failure_leaves_failed_run_and_no_result_objects(
    client: AsyncClient, session: AsyncSession
) -> None:
    _, task_id, _, version_id = await _build_ready_shot(client)
    actor = ActorContext(actor_kind="human", actor_id="vfx-1", human_role="vfx_supervisor")

    with pytest.raises(AgentGenerationError):
        await generate_cross_role_assessment(
            session,
            actor,
            uuid.UUID(version_id),
            uuid.UUID(task_id),
            generator=_FailingGenerator(),
        )

    runs = (
        (
            await session.execute(
                select(AgentRun).where(AgentRun.capability == "cross_role_assessment")
            )
        )
        .scalars()
        .all()
    )
    assert len(runs) == 1
    assert runs[0].status == "failed"
    assert "simulated provider timeout" in (runs[0].error or "")
    assert (await session.execute(select(CrossRoleAssessment))).scalars().all() == []
    assert (await session.execute(select(IntentSignal))).scalars().all() == []
    assert (await session.execute(select(ReAnchorProposal))).scalars().all() == []
    assert (await session.execute(select(ContextSnapshot))).scalars().all() != []


class _InventedEvidenceGenerator:
    def generate(self, *, snapshot_payload: dict[str, Any]) -> CrossRoleAssessmentOutput:
        invented = [
            CrossRoleEvidenceReference(
                source_type="shot", source_id="not-a-real-id", label="Invented"
            )
        ]
        finding = _base_finding(evidence=invented)
        return _make_output(shared_intent_read=finding)


async def test_validation_failure_creates_no_partial_result(
    client: AsyncClient, session: AsyncSession
) -> None:
    _, task_id, _, version_id = await _build_ready_shot(client)
    actor = ActorContext(actor_kind="human", actor_id="vfx-1", human_role="vfx_supervisor")

    with pytest.raises(AgentGenerationError, match="not present in this Version's ContextSnapshot"):
        await generate_cross_role_assessment(
            session,
            actor,
            uuid.UUID(version_id),
            uuid.UUID(task_id),
            generator=_InventedEvidenceGenerator(),
        )

    runs = (
        (
            await session.execute(
                select(AgentRun).where(AgentRun.capability == "cross_role_assessment")
            )
        )
        .scalars()
        .all()
    )
    assert len(runs) == 1
    assert runs[0].status == "failed"
    assert (await session.execute(select(CrossRoleAssessment))).scalars().all() == []


async def test_missing_confirmed_core_anchor_raises_conflict_at_service_level(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot_id = await _create_shot(client)
    task_id = await _create_task(client, shot_id)
    version_id = await _create_version(client, shot_id)

    actor = ActorContext(actor_kind="human", actor_id="vfx-1", human_role="vfx_supervisor")
    with pytest.raises(ConflictError):
        await generate_cross_role_assessment(
            session, actor, uuid.UUID(version_id), uuid.UUID(task_id)
        )


# --- deterministic generator unit test ---


def _sample_snapshot_payload() -> dict[str, Any]:
    return {
        "shot": {"id": "s1", "name": "SH010", "source": "manual"},
        "core_anchor": {
            "id": "ca1",
            "confirmed_revision": {
                "id": "car1",
                "revision_number": 1,
                "status": "confirmed",
                "core_summary": "A quiet, controlled chase.",
                "constraints": [{"id": "c1", "content": "No jump cuts."}],
                "variation_zones": [],
                "drift_risks": [],
                "open_questions": [{"id": "oq1", "question": "Is push-in speed fixed?"}],
            },
        },
        "vfx_supervisor_review": {
            "id": "vr1",
            "executive_summary": "Looks mostly consistent.",
            "creative_concerns": ["Final beat may be too aggressive."],
            "review_priorities": ["Check contrast."],
            "proposed_feedback": [],
            "questions_for_human_supervisor": [],
            "evidence_gaps": ["No media inspected."],
        },
        "cg_supervisor_review": {
            "id": "cr1",
            "executive_summary": "Technically deliverable.",
            "actionable_requirements": [],
            "technical_concerns": ["Contrast curve undefined."],
            "coordination_concerns": ["Needs camera dept input."],
            "implementation_priorities": ["Confirm push-in speed."],
            "proposed_execution_guidance": [],
            "questions_for_human_cg_supervisor": [],
            "evidence_gaps": ["No render inspected."],
        },
        "artist_agent_guidance": {
            "id": "ag1",
            "executive_summary": "One iteration considered.",
            "creative_intent_summary": "x",
            "task_goal_summary": "y",
            "current_iteration_summary": "z",
            "non_negotiables": [],
            "allowed_variations": [],
            "feedback_translations": [],
            "iteration_priorities": [],
            "cross_department_dependencies": [],
            "questions_for_human_supervisor": ["Is push-in intentional?"],
            "evidence_gaps": ["No footage inspected."],
        },
        "task": {"id": "t1", "name": "Compositing", "department": "comp"},
        "version": {"id": "v1", "name": "SH010_v001"},
        "intent_brief": None,
        "intent_decomposition": None,
        "context_reconstruction": None,
        "decisions": [],
        "core_anchor_human_gate": None,
        "execution_anchor_human_gate": None,
    }


def test_deterministic_generator_produces_valid_output() -> None:
    generator: CrossRoleAssessmentGenerator = DeterministicCrossRoleAssessmentGenerator()
    output = generator.generate(snapshot_payload=_sample_snapshot_payload())
    assert output.executive_summary
    assert len(output.role_perspectives) == 3
    assert output.agreements
    assert output.evidence_gaps
    assert output.re_anchor_proposal is None


def test_deterministic_generator_output_satisfies_content_boundaries() -> None:
    payload = _sample_snapshot_payload()
    output = DeterministicCrossRoleAssessmentGenerator().generate(snapshot_payload=payload)
    cross_role_assessment_service._validate_content_boundaries(output, payload)  # no raise


# --- bounded output contract ---


def test_cross_role_finding_rejects_overlong_summary() -> None:
    with pytest.raises(Exception):  # noqa: B017, PT011
        CrossRoleFinding(
            summary="x" * 281,
            why_it_matters="short",
            affected_roles=["vfx_supervisor"],
            priority="low",
            evidence=[_evidence_ref()],
        )


def test_cross_role_finding_rejects_duplicate_affected_roles() -> None:
    with pytest.raises(Exception):  # noqa: B017, PT011
        CrossRoleFinding(
            summary="s",
            why_it_matters="w",
            affected_roles=["vfx_supervisor", "vfx_supervisor"],
            priority="low",
            evidence=[_evidence_ref()],
        )


def test_cross_role_finding_rejects_empty_evidence() -> None:
    with pytest.raises(Exception):  # noqa: B017, PT011
        CrossRoleFinding(
            summary="s", why_it_matters="w", affected_roles=["artist"], priority="low", evidence=[]
        )


def test_cross_role_finding_rejects_more_than_three_evidence_references() -> None:
    with pytest.raises(Exception):  # noqa: B017, PT011
        CrossRoleFinding(
            summary="s",
            why_it_matters="w",
            affected_roles=["artist"],
            priority="low",
            evidence=[_evidence_ref(), _evidence_ref(), _evidence_ref(), _evidence_ref()],
        )


def test_re_anchor_field_proposal_requires_at_least_two_evidence_references() -> None:
    with pytest.raises(Exception):  # noqa: B017, PT011
        ReAnchorFieldProposal(
            field="open_questions",
            current_problem="p",
            proposed_direction="d",
            why_it_may_help="w",
            evidence=[_evidence_ref()],
        )


def test_re_anchor_proposal_requires_at_least_three_evidence_references() -> None:
    with pytest.raises(Exception):  # noqa: B017, PT011
        ReAnchorProposalOutput(
            reason_for_consideration="r",
            preserved_elements=[],
            proposed_fields=[
                ReAnchorFieldProposal(
                    field="open_questions",
                    current_problem="p",
                    proposed_direction="d",
                    why_it_may_help="w",
                    evidence=[_evidence_ref(), _evidence_ref()],
                )
            ],
            adoption_risks=[],
            questions_for_human_vfx_supervisor=[],
            evidence=[_evidence_ref(), _evidence_ref()],
        )


@pytest.mark.parametrize(
    "field,limit",
    [
        ("agreements", 3),
        ("cross_role_tensions", 3),
        ("local_optimum_risks", 3),
        ("unresolved_dependencies", 3),
        ("human_coordination_priorities", 3),
        ("evidence_gaps", 6),
    ],
)
def test_cross_role_assessment_output_rejects_too_many_list_items(field: str, limit: int) -> None:
    kwargs: dict[str, Any] = {}
    if field == "evidence_gaps":
        kwargs[field] = ["item"] * (limit + 1)
    else:
        kwargs[field] = [_base_finding()] * (limit + 1)
    with pytest.raises(Exception):  # noqa: B017, PT011
        _make_output(**kwargs)


def test_role_perspectives_rejects_missing_role() -> None:
    perspectives = _base_perspectives()[:2]
    with pytest.raises(Exception):  # noqa: B017, PT011
        _make_output(role_perspectives=perspectives)


def test_role_perspectives_rejects_duplicate_role() -> None:
    perspectives = _base_perspectives()
    perspectives[2] = perspectives[0].model_copy()
    with pytest.raises(Exception):  # noqa: B017, PT011
        _make_output(role_perspectives=perspectives)


# --- content-boundary hardening ---


def test_validate_content_boundaries_accepts_compliant_output() -> None:
    output = _make_output()
    cross_role_assessment_service._validate_content_boundaries(output, {})  # no raise


def test_validate_content_boundaries_rejects_missing_inspection_disclosure() -> None:
    output = _make_output(evidence_gaps=["No numeric contrast values are recorded."])
    with pytest.raises(AgentGenerationError, match="inspection boundary"):
        cross_role_assessment_service._validate_content_boundaries(output, {})


@pytest.mark.parametrize(
    "text",
    [
        "Please update the Core Anchor to reflect this variation.",
        "The Execution Anchor should be updated to allow this.",
        "Recommend the team re-anchor the shot before proceeding.",
        "You should confirm the gate now that this is resolved.",
        "We recommend confirming the pending HumanGate.",
        "Create a decision to formalise this change.",
        "This should pass review.",
        "The Artist is to blame for this outcome.",
        "This is the best overall Version.",
        "I visually inspected the footage and it looks fine.",
        "Add this range to the Execution Anchor.",
        "Include this rule in the Core Anchor.",
    ],
)
def test_forbidden_authority_reason_rejects_out_of_scope_instructions(text: str) -> None:
    assert cross_role_assessment_service._forbidden_authority_reason(text) is not None


@pytest.mark.parametrize(
    "text",
    [
        "This constraint was recorded on the confirmed Core Anchor revision.",
        "The Execution Anchor states the delivery format must stay unchanged.",
        "Coordinate with the Human CG Supervisor about this dependency.",
        "The Core Anchor is missing a measurable range.",
        "Ask the Human VFX Supervisor to clarify the missing range.",
    ],
)
def test_forbidden_authority_reason_allows_evidence_mentions_and_coordination(text: str) -> None:
    assert cross_role_assessment_service._forbidden_authority_reason(text) is None


def test_validate_content_boundaries_rejects_anchor_advice_in_tension() -> None:
    output = _make_output(
        cross_role_tensions=[
            _base_finding(why_it_matters="Update the Core Anchor to resolve this tension.")
        ]
    )
    with pytest.raises(AgentGenerationError, match="bounded advisory scope"):
        cross_role_assessment_service._validate_content_boundaries(output, {})


def test_validate_content_boundaries_rejects_pass_fail_in_role_perspective() -> None:
    perspectives = _base_perspectives()
    perspectives[0] = perspectives[0].model_copy(
        update={"main_concerns": "This should pass review."}
    )
    output = _make_output(role_perspectives=perspectives)
    with pytest.raises(AgentGenerationError, match="bounded advisory scope"):
        cross_role_assessment_service._validate_content_boundaries(output, {})


def test_validate_content_boundaries_allows_re_anchor_proposal_anchor_language() -> None:
    """Outside re_anchor_proposal, Anchor-modification language is
    forbidden; inside it, it is the entire point -- the top-level
    content-boundary scan must never scan re_anchor_proposal's own text.
    """
    proposal = ReAnchorProposalOutput(
        reason_for_consideration="The Core Anchor is ambiguous about push-in speed.",
        preserved_elements=["Keep the restrained tone."],
        proposed_fields=[
            ReAnchorFieldProposal(
                field="open_questions",
                current_problem="No recorded push-in speed limit.",
                proposed_direction="Add a push-in speed range to the Core Anchor.",
                why_it_may_help="Removes ambiguity for future iterations.",
                evidence=[
                    _evidence_ref("vfx_supervisor_review"),
                    _evidence_ref("cg_supervisor_review"),
                ],
            )
        ],
        adoption_risks=["May be too restrictive."],
        questions_for_human_vfx_supervisor=["Is this ambiguity real?"],
        evidence=[
            _evidence_ref("core_anchor_revision"),
            _evidence_ref("vfx_supervisor_review"),
            _evidence_ref("cg_supervisor_review"),
        ],
    )
    output = _make_output(cross_role_tensions=[_base_finding()], re_anchor_proposal=proposal)
    cross_role_assessment_service._validate_content_boundaries(output, {})  # no raise


# --- re-anchor proposal evidence-diversity validation ---


def _valid_proposal(**overrides: Any) -> ReAnchorProposalOutput:
    defaults: dict[str, Any] = {
        "reason_for_consideration": "Ambiguous constraint.",
        "preserved_elements": ["Keep restrained tone."],
        "proposed_fields": [
            ReAnchorFieldProposal(
                field="open_questions",
                current_problem="p",
                proposed_direction="d",
                why_it_may_help="w",
                evidence=[
                    _evidence_ref("vfx_supervisor_review"),
                    _evidence_ref("cg_supervisor_review"),
                ],
            )
        ],
        "adoption_risks": ["May confuse artists."],
        "questions_for_human_vfx_supervisor": ["Is this ambiguity real?"],
        "evidence": [
            _evidence_ref("core_anchor_revision"),
            _evidence_ref("vfx_supervisor_review"),
            _evidence_ref("cg_supervisor_review"),
        ],
    }
    defaults.update(overrides)
    return ReAnchorProposalOutput(**defaults)


def test_validate_re_anchor_proposal_accepts_compliant_proposal() -> None:
    proposal = _valid_proposal()
    output = _make_output(cross_role_tensions=[_base_finding()], re_anchor_proposal=proposal)
    cross_role_assessment_service._validate_re_anchor_proposal(proposal, output, {})  # no raise


def test_validate_re_anchor_proposal_rejects_single_role_only() -> None:
    proposal = _valid_proposal(
        evidence=[
            _evidence_ref("core_anchor_revision"),
            _evidence_ref("vfx_supervisor_review"),
            _evidence_ref("vfx_supervisor_review"),
        ],
        proposed_fields=[
            ReAnchorFieldProposal(
                field="open_questions",
                current_problem="p",
                proposed_direction="d",
                why_it_may_help="w",
                evidence=[
                    _evidence_ref("vfx_supervisor_review"),
                    _evidence_ref("vfx_supervisor_review"),
                ],
            )
        ],
    )
    output = _make_output(cross_role_tensions=[_base_finding()], re_anchor_proposal=proposal)
    with pytest.raises(AgentGenerationError, match="fewer than two distinct role"):
        cross_role_assessment_service._validate_re_anchor_proposal(proposal, output, {})


def test_validate_re_anchor_proposal_rejects_missing_core_anchor_evidence() -> None:
    proposal = _valid_proposal(
        evidence=[
            _evidence_ref("vfx_supervisor_review"),
            _evidence_ref("cg_supervisor_review"),
            _evidence_ref("vfx_supervisor_review"),
        ]
    )
    output = _make_output(cross_role_tensions=[_base_finding()], re_anchor_proposal=proposal)
    with pytest.raises(AgentGenerationError, match="does not cite the current confirmed"):
        cross_role_assessment_service._validate_re_anchor_proposal(proposal, output, {})


def test_validate_re_anchor_proposal_rejects_no_supporting_tension_or_risk() -> None:
    proposal = _valid_proposal()
    output = _make_output(re_anchor_proposal=proposal)  # no tensions, no risks
    with pytest.raises(AgentGenerationError, match="not supported by any"):
        cross_role_assessment_service._validate_re_anchor_proposal(proposal, output, {})


def test_validate_re_anchor_proposal_accepts_local_optimum_risk_as_support() -> None:
    proposal = _valid_proposal()
    output = _make_output(local_optimum_risks=[_base_finding()], re_anchor_proposal=proposal)
    cross_role_assessment_service._validate_re_anchor_proposal(proposal, output, {})  # no raise


def test_validate_re_anchor_proposal_rejects_blame() -> None:
    proposal = _valid_proposal(reason_for_consideration="The CG Supervisor is to blame here.")
    output = _make_output(cross_role_tensions=[_base_finding()], re_anchor_proposal=proposal)
    with pytest.raises(AgentGenerationError, match="assigns blame to a role"):
        cross_role_assessment_service._validate_re_anchor_proposal(proposal, output, {})


def test_validate_re_anchor_proposal_rejects_already_approved_framing() -> None:
    proposal = _valid_proposal(reason_for_consideration="This proposal is already approved.")
    output = _make_output(cross_role_tensions=[_base_finding()], re_anchor_proposal=proposal)
    with pytest.raises(AgentGenerationError, match="already approved"):
        cross_role_assessment_service._validate_re_anchor_proposal(proposal, output, {})


def test_validate_re_anchor_proposal_rejects_automatic_replacement() -> None:
    proposal = _valid_proposal(
        reason_for_consideration="The Core Anchor will automatically replace the old wording."
    )
    output = _make_output(cross_role_tensions=[_base_finding()], re_anchor_proposal=proposal)
    with pytest.raises(AgentGenerationError, match="automatic replacement"):
        cross_role_assessment_service._validate_re_anchor_proposal(proposal, output, {})


def test_validate_re_anchor_proposal_rejects_decision_already_made_claim() -> None:
    proposal = _valid_proposal(
        reason_for_consideration="A decision has already been made to change this."
    )
    output = _make_output(cross_role_tensions=[_base_finding()], re_anchor_proposal=proposal)
    with pytest.raises(AgentGenerationError, match="authoritative Decision"):
        cross_role_assessment_service._validate_re_anchor_proposal(proposal, output, {})


def test_validate_re_anchor_proposal_rejects_humangate_advice() -> None:
    proposal = _valid_proposal(
        questions_for_human_vfx_supervisor=["Should we confirm the gate right away?"]
    )
    output = _make_output(cross_role_tensions=[_base_finding()], re_anchor_proposal=proposal)
    with pytest.raises(AgentGenerationError, match="resolving a HumanGate"):
        cross_role_assessment_service._validate_re_anchor_proposal(proposal, output, {})


# --- Intent Signal: every deterministic rule branch ---


def test_intent_signal_high_on_high_priority_tension() -> None:
    output = _make_output(cross_role_tensions=[_base_finding(priority="high")])
    signal = derive_intent_signal(output)
    assert signal.attention_level == "high"
    assert signal.label == "human_review_required"
    assert any(d.code == "cross_role_tension" for d in signal.drivers)


def test_intent_signal_high_on_high_priority_local_optimum_risk() -> None:
    output = _make_output(local_optimum_risks=[_base_finding(priority="high")])
    signal = derive_intent_signal(output)
    assert signal.attention_level == "high"
    assert any(d.code == "local_optimum_risk" for d in signal.drivers)


def test_intent_signal_high_when_re_anchor_proposal_present() -> None:
    proposal = _valid_proposal()
    output = _make_output(cross_role_tensions=[_base_finding()], re_anchor_proposal=proposal)
    signal = derive_intent_signal(output)
    assert signal.attention_level == "high"
    assert signal.re_anchor_proposal_present is True
    assert any(d.code == "anchor_clarity_gap" for d in signal.drivers)


def test_intent_signal_medium_on_medium_priority_tension() -> None:
    output = _make_output(cross_role_tensions=[_base_finding(priority="medium")])
    signal = derive_intent_signal(output)
    assert signal.attention_level == "medium"
    assert signal.label == "attention_needed"


def test_intent_signal_medium_on_unresolved_dependency() -> None:
    output = _make_output(unresolved_dependencies=[_base_finding(priority="low")])
    signal = derive_intent_signal(output)
    assert signal.attention_level == "medium"
    assert any(d.code == "unresolved_dependency" for d in signal.drivers)


def test_intent_signal_medium_on_material_evidence_gap() -> None:
    output = _make_output(evidence_gaps=[*_compliant_evidence_gaps(), "Another real gap."])
    signal = derive_intent_signal(output)
    assert signal.attention_level == "medium"
    assert any(d.code == "missing_evidence" for d in signal.drivers)


def test_intent_signal_low_otherwise() -> None:
    output = _make_output()
    signal = derive_intent_signal(output)
    assert signal.attention_level == "low"
    assert signal.label == "low_attention"
    assert signal.drivers == []


def test_intent_signal_driver_indices_resolve_to_assessment_sections() -> None:
    findings = [_base_finding(priority="high"), _base_finding(priority="medium")]
    output = _make_output(cross_role_tensions=findings)
    signal = derive_intent_signal(output)
    tension_drivers = [d for d in signal.drivers if d.code == "cross_role_tension"]
    assert tension_drivers
    for driver in tension_drivers:
        assert driver.assessment_section == "cross_role_tensions"
        assert 0 <= driver.assessment_item_index < len(findings)


def test_intent_signal_role_coverage_always_true() -> None:
    output = _make_output()
    signal = derive_intent_signal(output)
    assert signal.role_coverage.vfx_supervisor is True
    assert signal.role_coverage.cg_supervisor is True
    assert signal.role_coverage.artist is True


def test_intent_signal_drivers_bounded_by_output_list_limits() -> None:
    """The Intent Signal has no separate driver cap of its own -- the
    number of possible drivers is implicitly bounded by
    CrossRoleAssessmentOutput's own hard list-length limits (at most 3
    cross_role_tensions).
    """
    findings = [_base_finding(priority="high") for _ in range(3)]
    output = _make_output(cross_role_tensions=findings)
    signal = derive_intent_signal(output)
    assert len(signal.drivers) == 3


def test_intent_signal_caveats_state_not_a_verdict() -> None:
    output = _make_output()
    signal = derive_intent_signal(output)
    assert any("not an alignment verdict" in c for c in signal.caveats)


def test_intent_signal_never_mutates_production_state() -> None:
    """derive_intent_signal is pure -- calling it repeatedly on the same
    output must never create any row anywhere; it takes no session.
    """
    output = _make_output(cross_role_tensions=[_base_finding(priority="high")])
    signal_one = derive_intent_signal(output)
    signal_two = derive_intent_signal(output)
    assert signal_one.attention_level == signal_two.attention_level == "high"


# --- DeepSeek adapter (mocked SDK only -- never a real network request) ---


class _FakeChatMessage:
    def __init__(self, content: str | None) -> None:
        self.content = content


class _FakeChatChoice:
    def __init__(self, content: str | None, finish_reason: str = "stop") -> None:
        self.message = _FakeChatMessage(content)
        self.finish_reason = finish_reason


class _FakeChatCompletion:
    def __init__(self, content: str | None, finish_reason: str = "stop") -> None:
        self.choices = [_FakeChatChoice(content, finish_reason)]


class _FakeChatCompletions:
    def __init__(self, content: str | None) -> None:
        self._content = content
        self.calls: list[dict[str, Any]] = []

    def create(self, **kwargs: Any) -> _FakeChatCompletion:
        self.calls.append(kwargs)
        return _FakeChatCompletion(self._content)


class _FakeChat:
    def __init__(self, content: str | None) -> None:
        self.completions = _FakeChatCompletions(content)


class _FakeOpenAIClient:
    last_instance: _FakeOpenAIClient | None = None

    def __init__(self, *, api_key: str, base_url: str) -> None:
        self.api_key = api_key
        self.base_url = base_url
        self.chat = _FakeChat(_DEEPSEEK_FAKE_OUTPUT.model_dump_json())
        _FakeOpenAIClient.last_instance = self


_DEEPSEEK_FAKE_OUTPUT = _make_output()


def test_deepseek_adapter_makes_one_non_streaming_json_mode_call(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import openai

    monkeypatch.setattr(openai, "OpenAI", _FakeOpenAIClient)

    generator = DeepSeekCrossRoleAssessmentGenerator(
        api_key="test-key-never-a-real-secret", model_name="deepseek-v4-flash"
    )
    output = generator.generate(snapshot_payload={"task": {"id": "t1"}})

    assert output.executive_summary
    client_instance = _FakeOpenAIClient.last_instance
    assert client_instance is not None
    calls = client_instance.chat.completions.calls
    assert len(calls) == 1
    assert "stream" not in calls[0]
    assert calls[0]["response_format"] == {"type": "json_object"}
    assert calls[0]["max_tokens"] == 8192


def test_deepseek_adapter_raises_agent_generation_error_on_empty_content(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import openai

    class _EmptyClient(_FakeOpenAIClient):
        def __init__(self, *, api_key: str, base_url: str) -> None:
            super().__init__(api_key=api_key, base_url=base_url)
            self.chat = _FakeChat(None)

    monkeypatch.setattr(openai, "OpenAI", _EmptyClient)
    generator = DeepSeekCrossRoleAssessmentGenerator(api_key="k", model_name="deepseek-v4-flash")
    with pytest.raises(AgentGenerationError):
        generator.generate(snapshot_payload={"task": {"id": "t1"}})


def test_deepseek_adapter_raises_agent_generation_error_on_schema_invalid_content(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Reproduces the real Step 6 acceptance failure shape: a complete,
    non-empty, non-truncated response (finish_reason="stop") that still
    does not conform to CrossRoleAssessmentOutput -- here, a third
    role_perspectives entry using an invalid role string. Must fail with
    the new schema-validation diagnostics, never the raw response.
    """
    import json

    import openai

    invalid_payload = json.loads(_DEEPSEEK_FAKE_OUTPUT.model_dump_json())
    invalid_payload["role_perspectives"][2]["role"] = "not_a_role"

    class _SchemaInvalidClient(_FakeOpenAIClient):
        def __init__(self, *, api_key: str, base_url: str) -> None:
            super().__init__(api_key=api_key, base_url=base_url)
            self.chat = _FakeChat(json.dumps(invalid_payload))

    monkeypatch.setattr(openai, "OpenAI", _SchemaInvalidClient)
    generator = DeepSeekCrossRoleAssessmentGenerator(api_key="k", model_name="deepseek-v4-flash")

    with pytest.raises(AgentGenerationError) as excinfo:
        generator.generate(snapshot_payload={"task": {"id": "t1"}})

    message = str(excinfo.value)
    assert "validation_stage=schema_validation" in message
    assert "role_perspectives.2.role:literal_error" in message
    assert "not_a_role" not in message


async def test_deepseek_schema_validation_failure_preserves_context_snapshot_and_failed_run(
    client: AsyncClient, session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """End-to-end reproduction of the real Step 6 acceptance failure
    through the full ``generate_cross_role_assessment`` path (not just
    the generator in isolation): a schema-non-conforming DeepSeek
    response must leave a failed AgentRun with sanitised
    schema-validation diagnostics, a preserved ContextSnapshot, and zero
    CrossRoleAssessment/ReAnchorProposal/IntentSignal rows.
    """
    import json

    import openai

    _, task_id, _, version_id = await _build_ready_shot(client)

    invalid_payload = json.loads(_DEEPSEEK_FAKE_OUTPUT.model_dump_json())
    del invalid_payload["evidence_gaps"]

    class _SchemaInvalidClient(_FakeOpenAIClient):
        def __init__(self, *, api_key: str, base_url: str) -> None:
            super().__init__(api_key=api_key, base_url=base_url)
            self.chat = _FakeChat(json.dumps(invalid_payload))

    monkeypatch.setattr(openai, "OpenAI", _SchemaInvalidClient)
    generator = DeepSeekCrossRoleAssessmentGenerator(api_key="k", model_name="deepseek-v4-flash")
    actor = ActorContext(actor_kind="human", actor_id="vfx-1", human_role="vfx_supervisor")

    with pytest.raises(AgentGenerationError, match="validation_stage=schema_validation"):
        await generate_cross_role_assessment(
            session,
            actor,
            uuid.UUID(version_id),
            uuid.UUID(task_id),
            generator=generator,
        )

    runs = (
        (
            await session.execute(
                select(AgentRun).where(AgentRun.capability == "cross_role_assessment")
            )
        )
        .scalars()
        .all()
    )
    assert len(runs) == 1
    assert runs[0].status == "failed"
    assert "evidence_gaps:missing" in (runs[0].error or "")
    assert (await session.execute(select(ContextSnapshot))).scalars().all() != []
    assert (await session.execute(select(CrossRoleAssessment))).scalars().all() == []
    assert (await session.execute(select(ReAnchorProposal))).scalars().all() == []
    assert (await session.execute(select(IntentSignal))).scalars().all() == []


# --- prompt schema-conformance hardening (Step 6 real-provider fix) ---


def test_prompt_requires_exact_top_level_key_set() -> None:
    from intent_core_api.agents import prompt_registry

    prompt = prompt_registry.get_registration("cross_role_assessment").system_prompt

    assert "exactly these ten top-level keys" in prompt
    for key in (
        "executive_summary",
        "shared_intent_read",
        "role_perspectives",
        "agreements",
        "cross_role_tensions",
        "local_optimum_risks",
        "unresolved_dependencies",
        "human_coordination_priorities",
        "re_anchor_proposal",
        "evidence_gaps",
    ):
        assert key in prompt


def test_prompt_requires_no_markdown_or_surrounding_prose() -> None:
    from intent_core_api.agents import prompt_registry

    prompt = prompt_registry.get_registration("cross_role_assessment").system_prompt

    assert "no Markdown" in prompt
    assert "no code fences" in prompt
    assert "no text before the opening brace or after the closing brace" in prompt


def test_prompt_requires_fixed_three_role_order() -> None:
    from intent_core_api.agents import prompt_registry

    prompt = prompt_registry.get_registration("cross_role_assessment").system_prompt

    assert '"vfx_supervisor" first, "cg_supervisor" second, "artist" third' in prompt
    assert "never a different order" in prompt


def test_prompt_requires_exact_role_and_priority_enum_strings() -> None:
    from intent_core_api.agents import prompt_registry

    prompt = prompt_registry.get_registration("cross_role_assessment").system_prompt

    assert "never a different spelling or casing" in prompt
    assert "affected_roles must be a non-empty JSON array" in prompt
    assert 'priority of exactly "low", "medium", or "high"' in prompt


def test_prompt_requires_empty_list_and_null_fallback() -> None:
    from intent_core_api.agents import prompt_registry

    prompt = prompt_registry.get_registration("cross_role_assessment").system_prompt

    assert "an empty list is a valid, honest answer" in prompt
    assert "output null rather than a weak or partial proposal" in prompt


def test_prompt_requires_complete_or_null_re_anchor_proposal() -> None:
    from intent_core_api.agents import prompt_registry

    prompt = prompt_registry.get_registration("cross_role_assessment").system_prompt

    assert "either the JSON literal null, or one complete object" in prompt
    assert "never a partial object with one or more of those fields missing" in prompt


def test_prompt_requires_concise_below_maximum_guidance() -> None:
    from intent_core_api.agents import prompt_registry

    prompt = prompt_registry.get_registration("cross_role_assessment").system_prompt

    assert "stay comfortably below every maximum" in prompt
    assert "Prefer 1-2 items per list" in prompt
    assert "Prefer 1-2 evidence references per finding" in prompt
    assert "do not treat a maximum as a target" in prompt


def test_prompt_registration_metadata_unchanged() -> None:
    """The prompt content was hardened, but the public registration
    metadata (capability identity, prompt key, version, token budget)
    must stay exactly what real-provider evidence already references.
    """
    from intent_core_api.agents import prompt_registry

    registration = prompt_registry.get_registration("cross_role_assessment")
    assert registration.agent_type == "core_agent"
    assert registration.capability == "cross_role_assessment"
    assert registration.prompt_key == "core_cross_role_assessment"
    assert registration.version == "v1"
    assert registration.version_label == "core_cross_role_assessment.v1"
    assert registration.max_output_tokens == 8192


async def test_deepseek_provider_selection_requires_api_key_and_model_name(
    session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    from intent_core_api.config import get_settings

    get_settings.cache_clear()
    monkeypatch.setenv("MODEL_PROVIDER", "deepseek")
    monkeypatch.setenv("MODEL_API_KEY", "")
    monkeypatch.setenv("MODEL_NAME", "")
    get_settings.cache_clear()
    try:
        with pytest.raises(AgentGenerationError):
            cross_role_assessment_service._get_generator()
    finally:
        monkeypatch.delenv("MODEL_PROVIDER", raising=False)
        monkeypatch.delenv("MODEL_API_KEY", raising=False)
        monkeypatch.delenv("MODEL_NAME", raising=False)
        get_settings.cache_clear()


# --- evidence source_type enum conformance (Step 6 real-provider fix #2) ---
#
# The second real DeepSeek call returned complete, non-truncated JSON that
# failed schema validation on exactly two fields:
# agreements.0.evidence.1.source_type and
# re_anchor_proposal.evidence.3.source_type, both "literal_error" -- the
# model used an invalid alias (observed: "vfx_review") instead of one of
# CrossRoleEvidenceSourceType's exact contract values. These tests cover
# the fix: a single contract-derived catalogue placed immediately beside
# every evidence object's shape in the prompt, never a second
# hand-maintained list.


def test_cross_role_evidence_source_types_matches_contract_literal() -> None:
    """The prompt's catalogue-building function must introspect the
    actual contract Literal, never hand-maintain a parallel list that
    could silently drift from it.
    """
    from typing import get_args

    from intent_core_api.agents import prompt_registry
    from intent_core_contracts.api.cross_role_assessment import CrossRoleEvidenceSourceType

    assert prompt_registry.cross_role_evidence_source_types() == get_args(
        CrossRoleEvidenceSourceType
    )


def test_cross_role_evidence_source_types_is_deterministic_and_side_effect_free() -> None:
    from intent_core_api.agents import prompt_registry

    first = prompt_registry.cross_role_evidence_source_types()
    second = prompt_registry.cross_role_evidence_source_types()
    assert first == second
    assert len(first) == 17


def test_prompt_source_type_catalogue_exactly_matches_contract_no_extra_no_missing() -> None:
    """Parses the exact quoted catalogue embedded in the rendered prompt
    (not just "somewhere in the prompt") and checks it against the
    contract's own Literal values -- catches both a missing value and an
    invented extra value, so the prompt catalogue and the contract can
    never silently drift apart.
    """
    import re
    from typing import get_args

    from intent_core_api.agents import prompt_registry
    from intent_core_contracts.api.cross_role_assessment import CrossRoleEvidenceSourceType

    prompt = prompt_registry.get_registration("cross_role_assessment").system_prompt
    marker = "these values and only these values -- is: "
    start = prompt.index(marker) + len(marker)
    end = prompt.index(". This exact rule applies", start)
    catalogue_text = prompt[start:end]

    found = tuple(re.findall(r'"([a-z_]+)"', catalogue_text))
    assert found == get_args(CrossRoleEvidenceSourceType)


def test_prompt_places_source_type_catalogue_beside_evidence_shape_definition() -> None:
    """The catalogue must appear immediately beside the evidence object
    shape requirements, not only in a later general paragraph -- and must
    explicitly name all four evidence-bearing consumer types.
    """
    from intent_core_api.agents import prompt_registry

    prompt = prompt_registry.get_registration("cross_role_assessment").system_prompt

    idx_shape = prompt.index("Every evidence object anywhere in this response")
    idx_role_perspectives = prompt.index("role_perspectives must contain exactly three entries")
    assert idx_shape < idx_role_perspectives, (
        "the evidence-object shape rule must be defined before role_perspectives, "
        "not several paragraphs after it"
    )

    for consumer in (
        "CrossRoleFinding.evidence",
        "RolePerspectiveRead.evidence",
        "ReAnchorFieldProposal.evidence",
        "ReAnchorProposalOutput.evidence",
    ):
        assert consumer in prompt


def test_prompt_evidence_glossary_shape_also_shows_the_full_enum() -> None:
    """The ``<evidence>`` shape definition right before the final JSON
    example -- the closest instruction to actual generation -- must show
    the real enum, not a generic ``<string>`` placeholder (this was the
    likely actual failure site: the model's last-read shape hint showed
    ``"source_type": "<string>"`` with no enum at all).
    """
    from intent_core_api.agents import prompt_registry

    prompt = prompt_registry.get_registration("cross_role_assessment").system_prompt

    idx = prompt.index("An <evidence> is {")
    glossary_shape = prompt[idx : idx + 400]
    assert '"source_type": "<string>"' not in glossary_shape
    assert '"vfx_supervisor_review"' in glossary_shape
    assert '"core_anchor_revision"' in glossary_shape


def test_prompt_forbids_generic_source_type_aliases() -> None:
    from intent_core_api.agents import prompt_registry

    prompt = prompt_registry.get_registration("cross_role_assessment").system_prompt

    for forbidden in (
        '"review"',
        '"agent_review"',
        '"supervisor_review"',
        '"role_output"',
        '"anchor"',
        '"guidance"',
        '"production_context"',
    ):
        assert forbidden in prompt


def test_prompt_re_anchor_proposal_uses_exact_core_anchor_and_role_source_types() -> None:
    from intent_core_api.agents import prompt_registry

    prompt = prompt_registry.get_registration("cross_role_assessment").system_prompt

    assert 'source_type "core_anchor_revision" for the current Core Anchor citation' in prompt
    assert (
        'source_type "vfx_supervisor_review", "cg_supervisor_review", or '
        '"artist_agent_guidance"' in prompt
    )
    assert (
        'never a role name such as "vfx_supervisor", "cg_supervisor", or "artist" used as '
        "a source_type" in prompt
    )


def test_prompt_requires_null_proposal_when_source_type_uncertain() -> None:
    from intent_core_api.agents import prompt_registry

    prompt = prompt_registry.get_registration("cross_role_assessment").system_prompt

    assert (
        "When you cannot confidently identify these exact source types in the supplied "
        "evidence, set re_anchor_proposal to null" in prompt
    )


def test_prompt_includes_valid_and_invalid_source_type_examples() -> None:
    from intent_core_api.agents import prompt_registry

    prompt = prompt_registry.get_registration("cross_role_assessment").system_prompt

    assert "Example of a valid finding evidence object" in prompt
    assert "Example of a valid re_anchor_proposal evidence array" in prompt
    assert "illustrating enum usage only" in prompt
    for invalid_alias in ('"vfx_review"', '"supervisor_review"', '"core_anchor"', '"artist"'):
        assert invalid_alias in prompt
    assert "any other human-readable label" in prompt


def _output_with_invalid_source_type_alias(alias: str) -> dict[str, Any]:
    import json

    output = _make_output(agreements=[_base_finding()])
    payload = json.loads(output.model_dump_json())
    payload["agreements"][0]["evidence"][0]["source_type"] = alias
    return payload


@pytest.mark.parametrize(
    "alias",
    ["vfx_review", "supervisor_review", "core_anchor", "artist", "Recorded on the VFX review"],
)
def test_deepseek_adapter_rejects_plausible_source_type_aliases(
    alias: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Reproduces the exact real-provider failure shape with several
    plausible-but-invalid aliases (including the observed "vfx_review"),
    plus a human-readable-label case -- every one must fail with safe
    field-level diagnostics, never be silently accepted or repaired.
    """
    import json

    import openai

    invalid_payload = _output_with_invalid_source_type_alias(alias)

    class _AliasClient(_FakeOpenAIClient):
        def __init__(self, *, api_key: str, base_url: str) -> None:
            super().__init__(api_key=api_key, base_url=base_url)
            self.chat = _FakeChat(json.dumps(invalid_payload))

    monkeypatch.setattr(openai, "OpenAI", _AliasClient)
    generator = DeepSeekCrossRoleAssessmentGenerator(api_key="k", model_name="deepseek-v4-flash")

    with pytest.raises(AgentGenerationError) as excinfo:
        generator.generate(snapshot_payload={"task": {"id": "t1"}})

    message = str(excinfo.value)
    assert "validation_stage=schema_validation" in message
    assert "agreements.0.evidence.0.source_type:literal_error" in message
    assert alias not in message


def test_deepseek_adapter_caps_and_sanitises_multiple_source_type_errors(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Reproduces the real failure's exact shape -- two simultaneous
    invalid source_type values in different sections (one in a plain
    finding's evidence, one in re_anchor_proposal's own evidence) -- and
    confirms both are reported, capped, and sanitised.
    """
    import json

    import openai

    output = _make_output(agreements=[_base_finding()])
    invalid_payload = json.loads(output.model_dump_json())
    invalid_payload["agreements"][0]["evidence"][0]["source_type"] = "vfx_review"
    invalid_payload["re_anchor_proposal"] = _valid_proposal().model_dump(mode="json")
    invalid_payload["re_anchor_proposal"]["evidence"][0]["source_type"] = "supervisor_review"
    invalid_payload["cross_role_tensions"] = [_base_finding().model_dump(mode="json")]

    secret_api_key = "sk-should-never-be-recorded"  # noqa: S105 -- fake, test-only value

    class _MultiAliasClient(_FakeOpenAIClient):
        def __init__(self, *, api_key: str, base_url: str) -> None:
            super().__init__(api_key=api_key, base_url=base_url)
            self.chat = _FakeChat(json.dumps(invalid_payload))

    monkeypatch.setattr(openai, "OpenAI", _MultiAliasClient)
    generator = DeepSeekCrossRoleAssessmentGenerator(
        api_key=secret_api_key, model_name="deepseek-v4-flash"
    )

    with pytest.raises(AgentGenerationError) as excinfo:
        generator.generate(snapshot_payload={"task": {"id": "t1"}})

    message = str(excinfo.value)
    assert "agreements.0.evidence.0.source_type:literal_error" in message
    assert "re_anchor_proposal.evidence.0.source_type:literal_error" in message
    assert "vfx_review" not in message
    assert "supervisor_review" not in message
    assert secret_api_key not in message


async def test_deepseek_source_type_alias_failure_preserves_snapshot_and_no_partial_result(
    client: AsyncClient, session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """End-to-end reproduction through the full
    ``generate_cross_role_assessment`` path: an invalid source_type alias
    must leave a failed AgentRun with sanitised diagnostics, a preserved
    ContextSnapshot, and zero CrossRoleAssessment/ReAnchorProposal/
    IntentSignal rows -- no coercion, no repair, no silent drop.
    """
    import json

    import openai

    _, task_id, _, version_id = await _build_ready_shot(client)

    invalid_payload = _output_with_invalid_source_type_alias("vfx_review")

    class _AliasClient(_FakeOpenAIClient):
        def __init__(self, *, api_key: str, base_url: str) -> None:
            super().__init__(api_key=api_key, base_url=base_url)
            self.chat = _FakeChat(json.dumps(invalid_payload))

    monkeypatch.setattr(openai, "OpenAI", _AliasClient)
    generator = DeepSeekCrossRoleAssessmentGenerator(api_key="k", model_name="deepseek-v4-flash")
    actor = ActorContext(actor_kind="human", actor_id="vfx-1", human_role="vfx_supervisor")

    with pytest.raises(AgentGenerationError, match="validation_stage=schema_validation"):
        await generate_cross_role_assessment(
            session,
            actor,
            uuid.UUID(version_id),
            uuid.UUID(task_id),
            generator=generator,
        )

    runs = (
        (
            await session.execute(
                select(AgentRun).where(AgentRun.capability == "cross_role_assessment")
            )
        )
        .scalars()
        .all()
    )
    assert len(runs) == 1
    assert runs[0].status == "failed"
    assert "agreements.0.evidence.0.source_type:literal_error" in (runs[0].error or "")
    assert "vfx_review" not in (runs[0].error or "")
    assert (await session.execute(select(ContextSnapshot))).scalars().all() != []
    assert (await session.execute(select(CrossRoleAssessment))).scalars().all() == []
    assert (await session.execute(select(ReAnchorProposal))).scalars().all() == []
    assert (await session.execute(select(IntentSignal))).scalars().all() == []


def test_deepseek_adapter_accepts_output_using_exact_contract_enum_values(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The positive control: output built entirely from
    ``cross_role_evidence_source_types()`` (the same contract-derived
    values the hardened prompt now instructs the model to use) must
    succeed -- confirms the fix narrows behaviour toward compliant
    output without weakening the contract itself.
    """
    import json

    import openai
    from intent_core_api.agents import prompt_registry

    canonical_source_type = prompt_registry.cross_role_evidence_source_types()[9]
    assert canonical_source_type == "vfx_supervisor_review"

    output = _make_output(agreements=[_base_finding()])
    payload = json.loads(output.model_dump_json())
    payload["agreements"][0]["evidence"][0]["source_type"] = canonical_source_type

    class _ValidClient(_FakeOpenAIClient):
        def __init__(self, *, api_key: str, base_url: str) -> None:
            super().__init__(api_key=api_key, base_url=base_url)
            self.chat = _FakeChat(json.dumps(payload))

    monkeypatch.setattr(openai, "OpenAI", _ValidClient)
    generator = DeepSeekCrossRoleAssessmentGenerator(api_key="k", model_name="deepseek-v4-flash")

    output = generator.generate(snapshot_payload={"task": {"id": "t1"}})
    assert output.agreements[0].evidence[0].source_type == "vfx_supervisor_review"


# --- unsupported production-numeric-value hardening ---
#
# A real persisted assessment's (correctly advisory) re_anchor_proposal
# invented two production thresholds -- "push-in speed must not exceed 0.5x
# normal conversation pace" and "contrast may increase up to 15% above
# baseline" -- that did not exist anywhere in the cited evidence. Advisory
# framing does not make an invented production number evidence-grounded.


def test_prompt_prohibits_invented_numeric_production_values() -> None:
    from intent_core_api.agents import prompt_registry

    prompt = prompt_registry.get_registration("cross_role_assessment").system_prompt

    assert "Never invent a production-specific numeric value" in prompt


def test_prompt_permits_repeating_evidence_supported_value() -> None:
    from intent_core_api.agents import prompt_registry

    prompt = prompt_registry.get_registration("cross_role_assessment").system_prompt

    assert (
        "You may repeat a production-specific number only when that exact value and "
        "unit already appear in the evidence you cite for that same item" in prompt
    )


def test_prompt_distinguishes_proposing_boundary_from_inventing_value() -> None:
    from intent_core_api.agents import prompt_registry

    prompt = prompt_registry.get_registration("cross_role_assessment").system_prompt

    assert "re_anchor_proposal may propose that a measurable boundary" in prompt
    assert "it may never invent what that boundary's number should be" in prompt


def test_prompt_includes_concise_invalid_numeric_examples() -> None:
    from intent_core_api.agents import prompt_registry

    prompt = prompt_registry.get_registration("cross_role_assessment").system_prompt

    for example in ('"must not exceed 0.5x"', '"increase up to 15%"'):
        assert example in prompt


def test_prompt_directs_missing_values_to_human_supervisor_confirmation() -> None:
    from intent_core_api.agents import prompt_registry

    prompt = prompt_registry.get_registration("cross_role_assessment").system_prompt

    assert "ask the Human CG Supervisor to establish a tested push-in" in prompt
    assert "a Human Supervisor must confirm the measurable limit" in prompt
    assert "a Human Supervisor establishes any unsupported production value, never you" in prompt


def test_prompt_metadata_unaffected_by_numeric_hardening() -> None:
    from intent_core_api.agents import prompt_registry

    registration = prompt_registry.get_registration("cross_role_assessment")
    assert registration.version_label == "core_cross_role_assessment.v1"
    assert registration.max_output_tokens == 8192


@pytest.mark.parametrize(
    "text",
    [
        "0.5x",
        "1.2×",
        "15%",
        "15 percent",
        "12 frames",
        "24 fps",
        "2 seconds",
        "250 ms",
        "2 stops",
        "1 EV",
        "500 nits",
        "40 IRE",
        "20 px",
        "15 degrees",
        "10–15%",
        "12 to 16 frames",
    ],
)
def test_detects_production_numeric_expressions(text: str) -> None:
    assert cross_role_assessment_service._detect_production_numeric_expressions(text)


@pytest.mark.parametrize(
    "text",
    [
        "5a6d16d5-2c85-4f22-8057-cbebc77ecc66",
        "2026-07-28 01:00:28.086023+00",
        "revision #1",
        "all three roles",
        "high",
        "item 1 of the list",
        "confirmed revision number 2",
    ],
)
def test_does_not_falsely_detect_non_production_numerics(text: str) -> None:
    assert cross_role_assessment_service._detect_production_numeric_expressions(text) == []


def test_detects_the_exact_originally_invented_phrases() -> None:
    """The two phrases actually observed in the real, technically
    successful assessment's ReAnchorProposal that motivated this fix.
    """
    for text in (
        "push-in speed must not exceed 0.5x normal conversation pace",
        "contrast may increase up to 15% above baseline",
    ):
        assert cross_role_assessment_service._detect_production_numeric_expressions(text)


def _snapshot_with_note(source_type_id: str, note: str) -> dict[str, Any]:
    return {"record": {"id": source_type_id, "note": note}}


def _evidence_ref_with_id(source_type: str, source_id: str) -> CrossRoleEvidenceReference:
    """Unlike ``_evidence_ref`` (always ``source_id="t1"``), lets these
    evidence-support tests control the exact id being resolved against
    the fake snapshot.
    """
    return CrossRoleEvidenceReference(
        source_type=source_type, source_id=source_id, label="evidence"
    )


def test_evidence_support_accepts_exact_value_and_unit_in_cited_source() -> None:
    snapshot = _snapshot_with_note("cg1", "hold for 12 frames per the recorded requirement")
    output = _make_output(
        agreements=[
            _base_finding(
                summary="CG review confirms hold for 12 frames",
                evidence=[_evidence_ref_with_id("cg_supervisor_review", "cg1")],
            )
        ]
    )
    cross_role_assessment_service._validate_no_unsupported_production_numerics(
        output, snapshot
    )  # no raise


def test_evidence_support_rejects_value_found_only_in_unrelated_source() -> None:
    snapshot = {
        "cg": {"id": "cg1", "note": "no numeric values recorded here"},
        "unrelated": {"id": "other1", "note": "contrast may increase up to 15%"},
    }
    output = _make_output(
        agreements=[
            _base_finding(
                summary="contrast may increase up to 15%",
                evidence=[_evidence_ref_with_id("cg_supervisor_review", "cg1")],
            )
        ]
    )
    with pytest.raises(AgentGenerationError, match="unsupported production-specific numeric"):
        cross_role_assessment_service._validate_no_unsupported_production_numerics(output, snapshot)


def test_evidence_support_rejects_same_value_with_different_unit() -> None:
    snapshot = _snapshot_with_note("cg1", "hold for 12 seconds")
    output = _make_output(
        agreements=[
            _base_finding(
                summary="hold for 12 frames",
                evidence=[_evidence_ref_with_id("cg_supervisor_review", "cg1")],
            )
        ]
    )
    with pytest.raises(AgentGenerationError, match="unsupported production-specific numeric"):
        cross_role_assessment_service._validate_no_unsupported_production_numerics(output, snapshot)


def test_evidence_support_does_not_infer_transformed_equivalent_values() -> None:
    """The evidence records 50%; the output claims the semantically-
    adjacent-sounding "0.5x" -- no arithmetic/semantic equivalence may
    be inferred, so this is still rejected.
    """
    snapshot = _snapshot_with_note("cg1", "increase by 50%")
    output = _make_output(
        agreements=[
            _base_finding(
                summary="push-in at 0.5x",
                evidence=[_evidence_ref_with_id("cg_supervisor_review", "cg1")],
            )
        ]
    )
    with pytest.raises(AgentGenerationError, match="unsupported production-specific numeric"):
        cross_role_assessment_service._validate_no_unsupported_production_numerics(output, snapshot)


def test_evidence_support_checks_proposed_field_against_its_own_evidence() -> None:
    snapshot = {
        "core": {"id": "core1", "note": "core anchor"},
        "vfx": {"id": "vfx1", "note": "vfx review"},
        "cg": {"id": "cg1", "note": "cg review, hold for 12 frames"},
    }
    proposal = _valid_proposal(
        proposed_fields=[
            ReAnchorFieldProposal(
                field="open_questions",
                current_problem="p",
                proposed_direction="hold for 12 frames",
                why_it_may_help="w",
                evidence=[
                    _evidence_ref_with_id("cg_supervisor_review", "cg1"),
                    _evidence_ref_with_id("vfx_supervisor_review", "vfx1"),
                ],
            )
        ],
        evidence=[
            _evidence_ref_with_id("core_anchor_revision", "core1"),
            _evidence_ref_with_id("vfx_supervisor_review", "vfx1"),
            _evidence_ref_with_id("cg_supervisor_review", "cg1"),
        ],
    )
    output = _make_output(cross_role_tensions=[_base_finding()], re_anchor_proposal=proposal)
    cross_role_assessment_service._validate_no_unsupported_production_numerics(
        output, snapshot
    )  # no raise


def test_evidence_support_isolates_proposal_level_from_field_level_evidence() -> None:
    """A numeric value supported only by a proposed_field's own evidence
    must not be accepted for proposal-*level* text, even though the
    field-level citation genuinely supports the field's own claim --
    the two evidence pools must never leak into each other.
    """
    snapshot = {
        "core": {"id": "core1", "note": "core anchor"},
        "vfx": {"id": "vfx1", "note": "vfx review"},
        "cg": {"id": "cg1", "note": "cg review, hold for 12 frames"},
        "artist": {"id": "artist1", "note": "artist guidance, no numbers here"},
    }
    proposal = _valid_proposal(
        reason_for_consideration="hold for 12 frames per requirement",
        proposed_fields=[
            ReAnchorFieldProposal(
                field="open_questions",
                current_problem="p",
                proposed_direction="hold for 12 frames",
                why_it_may_help="w",
                evidence=[
                    _evidence_ref_with_id("cg_supervisor_review", "cg1"),
                    _evidence_ref_with_id("vfx_supervisor_review", "vfx1"),
                ],
            )
        ],
        # Note: proposal-level evidence deliberately excludes "cg1".
        evidence=[
            _evidence_ref_with_id("core_anchor_revision", "core1"),
            _evidence_ref_with_id("vfx_supervisor_review", "vfx1"),
            _evidence_ref_with_id("artist_agent_guidance", "artist1"),
        ],
    )
    output = _make_output(cross_role_tensions=[_base_finding()], re_anchor_proposal=proposal)
    with pytest.raises(AgentGenerationError, match="unsupported production-specific numeric"):
        cross_role_assessment_service._validate_no_unsupported_production_numerics(output, snapshot)


def test_validate_content_boundaries_rejects_the_originally_observed_invented_values() -> None:
    """Direct reproduction of the real incident: both invented phrases,
    in the exact fields where they actually appeared.
    """
    proposal = _valid_proposal(
        reason_for_consideration=("push-in speed must not exceed 0.5x normal conversation pace")
    )
    output = _make_output(cross_role_tensions=[_base_finding()], re_anchor_proposal=proposal)
    with pytest.raises(AgentGenerationError, match="unsupported production-specific numeric"):
        cross_role_assessment_service._validate_content_boundaries(output, {})

    proposal2 = _valid_proposal(
        proposed_fields=[
            ReAnchorFieldProposal(
                field="constraints",
                current_problem="p",
                proposed_direction="contrast may increase up to 15% above baseline",
                why_it_may_help="w",
                evidence=[
                    _evidence_ref_with_id("vfx_supervisor_review", "vfx1"),
                    _evidence_ref_with_id("cg_supervisor_review", "cg1"),
                ],
            )
        ]
    )
    output2 = _make_output(cross_role_tensions=[_base_finding()], re_anchor_proposal=proposal2)
    with pytest.raises(AgentGenerationError, match="unsupported production-specific numeric"):
        cross_role_assessment_service._validate_content_boundaries(output2, {})


async def _build_ready_shot_with_role_ids(client: AsyncClient) -> dict[str, str]:
    """Same prerequisite chain as ``_build_ready_shot``, but also returns
    the confirmed Core Anchor revision id and the VFX/CG/Artist output
    ids -- needed here (unlike elsewhere in this file) because this
    test's fake generator must satisfy real evidence-id resolution *and*
    the ReAnchorProposal role-diversity validator so execution reaches
    the production-numeric check instead of failing earlier.
    """
    shot_id = await _create_shot(client)
    await _create_brief(client, shot_id)
    core_confirmed = await _confirm_core_anchor(client, shot_id)
    task_id = await _create_task(client, shot_id)
    confirmed_revision = await _create_confirmed_execution_anchor(client, task_id)
    version_id = await _create_version(client, shot_id)
    vfx_review = await _generate_vfx_review(client, version_id)
    cg_review = await _generate_cg_review(client, confirmed_revision["id"])
    artist_guidance = await _generate_artist_guidance(client, version_id, task_id)
    return {
        "shot_id": shot_id,
        "task_id": task_id,
        "version_id": version_id,
        "core_anchor_revision_id": core_confirmed["id"],
        "vfx_review_id": vfx_review["id"],
        "cg_review_id": cg_review["id"],
        "artist_guidance_id": artist_guidance["id"],
    }


class _InventedProductionNumericGenerator:
    def __init__(self, ids: dict[str, str]) -> None:
        self._ids = ids

    def generate(self, *, snapshot_payload: dict[str, Any]) -> CrossRoleAssessmentOutput:
        def ref(source_type: str, source_id: str) -> CrossRoleEvidenceReference:
            return CrossRoleEvidenceReference(
                source_type=source_type, source_id=source_id, label="evidence"
            )

        shared_intent_read = _base_finding(evidence=[ref("shot", self._ids["shot_id"])])
        role_perspectives = [
            RolePerspectiveRead(
                role=role,
                current_position="p",
                protected_intent="p",
                main_concerns="m",
                evidence=[ref(source_type, source_id)],
            )
            for role, source_type, source_id in (
                ("vfx_supervisor", "vfx_supervisor_review", self._ids["vfx_review_id"]),
                ("cg_supervisor", "cg_supervisor_review", self._ids["cg_review_id"]),
                ("artist", "artist_agent_guidance", self._ids["artist_guidance_id"]),
            )
        ]
        proposal = _valid_proposal(
            reason_for_consideration="push-in speed must not exceed 0.5x normal conversation pace",
            proposed_fields=[
                ReAnchorFieldProposal(
                    field="open_questions",
                    current_problem="p",
                    proposed_direction="d",
                    why_it_may_help="w",
                    evidence=[
                        ref("vfx_supervisor_review", self._ids["vfx_review_id"]),
                        ref("cg_supervisor_review", self._ids["cg_review_id"]),
                    ],
                )
            ],
            evidence=[
                ref("core_anchor_revision", self._ids["core_anchor_revision_id"]),
                ref("vfx_supervisor_review", self._ids["vfx_review_id"]),
                ref("cg_supervisor_review", self._ids["cg_review_id"]),
            ],
        )
        tension = _base_finding(evidence=[ref("shot", self._ids["shot_id"])])
        return _make_output(
            shared_intent_read=shared_intent_read,
            role_perspectives=role_perspectives,
            cross_role_tensions=[tension],
            re_anchor_proposal=proposal,
        )


async def test_unsupported_numeric_value_preserves_snapshot_and_no_partial_result(
    client: AsyncClient, session: AsyncSession
) -> None:
    ids = await _build_ready_shot_with_role_ids(client)
    actor = ActorContext(actor_kind="human", actor_id="vfx-1", human_role="vfx_supervisor")

    with pytest.raises(AgentGenerationError, match="unsupported production-specific numeric"):
        await generate_cross_role_assessment(
            session,
            actor,
            uuid.UUID(ids["version_id"]),
            uuid.UUID(ids["task_id"]),
            generator=_InventedProductionNumericGenerator(ids),
        )

    runs = (
        (
            await session.execute(
                select(AgentRun).where(AgentRun.capability == "cross_role_assessment")
            )
        )
        .scalars()
        .all()
    )
    assert len(runs) == 1
    assert runs[0].status == "failed"
    error_text = runs[0].error or ""
    assert "unsupported production-specific numeric" in error_text
    # Sanitised: the actual invented value/text must never reach AgentRun.error.
    assert "0.5x" not in error_text
    assert "conversation pace" not in error_text
    assert (await session.execute(select(ContextSnapshot))).scalars().all() != []
    assert (await session.execute(select(CrossRoleAssessment))).scalars().all() == []
    assert (await session.execute(select(ReAnchorProposal))).scalars().all() == []
    assert (await session.execute(select(IntentSignal))).scalars().all() == []


def test_deterministic_generator_never_invents_production_numerics() -> None:
    """The deterministic generator must already demonstrate the desired
    compliant behaviour: it may say measurable limits are missing, but
    must never itself invent a percentage/multiplier/frame count/
    duration/exposure value/etc.
    """
    payload = _sample_snapshot_payload()
    output = cross_role_assessment_service.DeterministicCrossRoleAssessmentGenerator().generate(
        snapshot_payload=payload
    )
    cross_role_assessment_service._validate_no_unsupported_production_numerics(
        output, payload
    )  # no raise

    texts = [output.executive_summary, *output.evidence_gaps]
    for finding in (
        output.shared_intent_read,
        *output.agreements,
        *output.cross_role_tensions,
        *output.local_optimum_risks,
        *output.unresolved_dependencies,
        *output.human_coordination_priorities,
    ):
        texts.extend([finding.summary, finding.why_it_matters])
    for perspective in output.role_perspectives:
        texts.extend(
            [perspective.current_position, perspective.protected_intent, perspective.main_concerns]
        )
    for text in texts:
        assert cross_role_assessment_service._detect_production_numeric_expressions(text) == []
