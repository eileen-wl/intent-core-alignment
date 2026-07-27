from __future__ import annotations

import uuid
from typing import Any

import pytest
from httpx import AsyncClient
from intent_core_api.agents import cg_supervisor_review_service
from intent_core_api.agents.cg_supervisor_review_service import (
    CGSupervisorReviewGenerator,
    DeepSeekCGSupervisorReviewGenerator,
    DeterministicCGSupervisorReviewGenerator,
    generate_cg_supervisor_review,
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
    ReviewNote,
    Version,
)
from intent_core_api.workflow.actors import ActorContext, build_agent_actor
from intent_core_api.workflow.exceptions import AgentGenerationError, ForbiddenActionError
from intent_core_api.workflow.models import Decision
from intent_core_contracts.api.cg_supervisor_review import (
    CGProposedExecutionGuidance,
    CGReviewEvidenceReference,
    CGReviewItem,
    CGSupervisorReviewOutput,
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
    "intent_brief",
    "intent_decomposition",
    "core_anchor",
    "context_reconstruction",
    "execution_anchor",
    "version",
    "alignment_assessment",
    "vfx_supervisor_review",
    "decisions",
    "core_anchor_human_gate",
    "execution_anchor_human_gate",
}

_FORBIDDEN_TECHNICAL_TERMS = (
    "render defect",
    "animation defect",
    "lighting value",
    "camera parameter",
    "simulation setting",
    "compositing parameter",
)


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


async def _create_task(client: AsyncClient, shot_id: str) -> str:
    task = (
        await client.post(
            "/tasks",
            json={"shot_id": shot_id, "name": "Lighting Pass", "department": "lighting"},
        )
    ).json()
    return str(task["id"])


async def _create_execution_anchor_draft(client: AsyncClient, task_id: str) -> dict[str, Any]:
    draft: dict[str, Any] = (
        await client.post(
            f"/intent/tasks/{task_id}/execution-anchor/drafts",
            json={"technical_boundaries": "24fps, no motion blur."},
            headers=CG,
        )
    ).json()
    assert draft["status"] == "draft"
    return draft


async def _build_shot_task_and_draft_revision(
    client: AsyncClient,
) -> tuple[str, str, dict[str, Any]]:
    shot_id = await _create_shot(client)
    await _create_brief(client, shot_id)
    await _confirm_core_anchor(client, shot_id)
    task_id = await _create_task(client, shot_id)
    draft = await _create_execution_anchor_draft(client, task_id)
    return shot_id, task_id, draft


# --- generation + structured output ---


async def test_generate_creates_review_with_expected_shape(client: AsyncClient) -> None:
    shot_id, task_id, draft = await _build_shot_task_and_draft_revision(client)

    response = await client.post(
        f"/intent/execution-anchor-revisions/{draft['id']}/cg-supervisor-reviews/generate",
        headers=CG,
    )
    assert response.status_code == 201
    body = response.json()

    assert body["shot_id"] == shot_id
    assert body["task_id"] == task_id
    assert body["execution_anchor_revision_id"] == draft["id"]
    output = body["review_output"]
    assert output["executive_summary"]
    direction = output["execution_direction_read"]
    assert direction["summary"]
    assert direction["rationale"]
    assert direction["priority"] in ("low", "medium", "high")
    assert direction["evidence"]
    for list_key in (
        "actionable_requirements",
        "technical_concerns",
        "coordination_concerns",
        "implementation_priorities",
    ):
        for item in output[list_key]:
            assert item["summary"]
            assert item["rationale"]
            assert item["priority"] in ("low", "medium", "high")
            assert item["evidence"]
    for item in output["proposed_execution_guidance"]:
        assert item["guidance"]
        assert item["underlying_intent"]
        assert item["priority"] in ("low", "medium", "high")
        assert item["evidence"]
    assert output["evidence_gaps"]


async def test_generate_creates_succeeded_agent_run_with_expected_capability(
    client: AsyncClient, session: AsyncSession
) -> None:
    _, _, draft = await _build_shot_task_and_draft_revision(client)

    body = (
        await client.post(
            f"/intent/execution-anchor-revisions/{draft['id']}/cg-supervisor-reviews/generate",
            headers=CG,
        )
    ).json()

    run = (await client.get(f"/intent/agent-runs/{body['agent_run_id']}")).json()
    assert run["status"] == "succeeded"
    assert run["agent_type"] == "cg_supervisor_agent"
    assert run["capability"] == "execution_review"
    assert run["provider"] == "deterministic"
    assert run["model_name"] is None
    assert run["prompt_version"] is None
    assert run["result_revision_id"] is None
    assert run["error"] is None
    assert run["completed_at"] is not None

    capability_query = select(AgentRun).where(AgentRun.capability == "execution_review")
    runs = (await session.execute(capability_query)).scalars().all()
    assert len(runs) == 1


def test_prompt_registry_entry_is_registered() -> None:
    from intent_core_api.agents import prompt_registry

    registration = prompt_registry.get_registration("execution_review")
    assert registration.agent_type == "cg_supervisor_agent"
    assert registration.capability == "execution_review"
    assert registration.prompt_key == "cg_supervisor_execution_review"
    assert registration.version == "v1"
    assert registration.version_label == "cg_supervisor_execution_review.v1"
    assert registration.output_model is CGSupervisorReviewOutput


async def test_context_snapshot_contains_only_target_revision_and_relevant_evidence(
    client: AsyncClient,
) -> None:
    shot_id, task_id, draft = await _build_shot_task_and_draft_revision(client)

    body = (
        await client.post(
            f"/intent/execution-anchor-revisions/{draft['id']}/cg-supervisor-reviews/generate",
            headers=CG,
        )
    ).json()

    snapshot = (await client.get(f"/intent/context-snapshots/{body['context_snapshot_id']}")).json()
    payload = snapshot["payload"]

    assert set(payload.keys()) == _SNAPSHOT_KEYS
    assert payload["shot"]["id"] == shot_id
    assert payload["task"]["id"] == task_id
    assert payload["execution_anchor"]["target_revision"]["id"] == draft["id"]
    assert payload["intent_brief"] is not None
    assert payload["core_anchor"]["confirmed_revision"] is not None
    assert payload["core_anchor_human_gate"] is not None
    assert payload["core_anchor_human_gate"]["status"] == "confirmed"
    assert payload["execution_anchor_human_gate"] is not None
    assert payload["execution_anchor_human_gate"]["status"] == "pending"
    # no binary media, no raw ftrack payloads, no secrets
    payload_text = str(payload)
    for banned in ("api_key", "password", "Authorization"):
        assert banned not in payload_text


def _collect_real_ids(payload: dict[str, Any]) -> set[str]:
    ids: set[str] = {payload["project"]["id"], payload["shot"]["id"], payload["task"]["id"]}
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
    execution_anchor = payload["execution_anchor"]
    ids.add(execution_anchor["id"])
    ids.add(execution_anchor["target_revision"]["id"])
    if payload["version"] is not None:
        ids.add(payload["version"]["id"])
        for note in payload["version"]["review_notes"]:
            ids.add(note["id"])
    if payload["alignment_assessment"] is not None:
        ids.add(payload["alignment_assessment"]["id"])
    if payload["vfx_supervisor_review"] is not None:
        ids.add(payload["vfx_supervisor_review"]["id"])
    for decision in payload["decisions"]:
        ids.add(decision["id"])
    return ids


async def test_evidence_references_point_to_ids_in_snapshot(client: AsyncClient) -> None:
    _, _, draft = await _build_shot_task_and_draft_revision(client)

    body = (
        await client.post(
            f"/intent/execution-anchor-revisions/{draft['id']}/cg-supervisor-reviews/generate",
            headers=CG,
        )
    ).json()
    snapshot = (await client.get(f"/intent/context-snapshots/{body['context_snapshot_id']}")).json()
    real_ids = _collect_real_ids(snapshot["payload"])

    output = body["review_output"]
    items = [
        output["execution_direction_read"],
        *output["actionable_requirements"],
        *output["technical_concerns"],
        *output["coordination_concerns"],
        *output["implementation_priorities"],
    ]
    for item in items:
        for evidence in item["evidence"]:
            assert evidence["source_id"] in real_ids
    for item in output["proposed_execution_guidance"]:
        for evidence in item["evidence"]:
            assert evidence["source_id"] in real_ids


async def _create_version(client: AsyncClient, shot_id: str, name: str, description: str) -> str:
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
    result: dict[str, Any] = response.json()
    return result


async def test_snapshot_includes_only_the_relevant_version_not_unrelated_versions(
    client: AsyncClient,
) -> None:
    """Step 4 compaction: the CG snapshot must carry the single Version
    its newest VFX Supervisor Agent review is actually about, never
    every Version recorded under the Shot.
    """
    shot_id, _, draft = await _build_shot_task_and_draft_revision(client)

    unrelated_version_id = await _create_version(
        client, shot_id, "SH010_unrelated_v001", "An unrelated earlier pass."
    )
    relevant_version_id = await _create_version(
        client, shot_id, "SH010_relevant_v002", "The relevant, most recent pass."
    )
    await client.post(
        f"/versions/{relevant_version_id}/review-notes",
        json={"content": "Please slow the camera down."},
        headers=VFX,
    )
    await _generate_vfx_review(client, relevant_version_id)

    body = (
        await client.post(
            f"/intent/execution-anchor-revisions/{draft['id']}/cg-supervisor-reviews/generate",
            headers=CG,
        )
    ).json()
    snapshot = (await client.get(f"/intent/context-snapshots/{body['context_snapshot_id']}")).json()
    payload = snapshot["payload"]

    assert payload["version"] is not None
    assert payload["version"]["id"] == relevant_version_id
    assert len(payload["version"]["review_notes"]) == 1

    payload_text = str(payload)
    assert unrelated_version_id not in payload_text


async def test_snapshot_omits_verbose_nested_evidence_trees(client: AsyncClient) -> None:
    """Step 4 compaction: the context reconstruction and VFX review
    projections must not carry their own full nested evidence/rationale
    trees -- only the concise fields the CG capability actually needs.
    """
    shot_id, _, draft = await _build_shot_task_and_draft_revision(client)
    await client.post(f"/intent/shots/{shot_id}/context-reconstructions/generate", headers=VFX)

    version_id = await _create_version(client, shot_id, "SH010_v001", "First pass.")
    await client.post(
        f"/versions/{version_id}/review-notes",
        json={"content": "Please slow the camera down."},
        headers=VFX,
    )
    await _generate_vfx_review(client, version_id)

    body = (
        await client.post(
            f"/intent/execution-anchor-revisions/{draft['id']}/cg-supervisor-reviews/generate",
            headers=CG,
        )
    ).json()
    snapshot = (await client.get(f"/intent/context-snapshots/{body['context_snapshot_id']}")).json()
    payload = snapshot["payload"]

    assert payload["context_reconstruction"] is not None
    assert set(payload["context_reconstruction"].keys()) == {
        "id",
        "context_summary",
        "current_creative_direction_summary",
        "execution_context_summary",
        "context_gaps",
    }

    assert payload["vfx_supervisor_review"] is not None
    assert set(payload["vfx_supervisor_review"].keys()) == {
        "id",
        "executive_summary",
        "creative_concerns",
        "review_priorities",
        "proposed_feedback",
        "evidence_gaps",
    }
    # The old, verbose shape's nested evidence/rationale trees must be gone
    # -- these keys only ever appeared inside that removed nested shape.
    vfx_text = str(payload["vfx_supervisor_review"])
    assert "source_type" not in vfx_text
    assert "creative_direction_read" not in vfx_text
    assert "strengths" not in vfx_text


async def test_missing_media_represented_honestly_in_evidence_gaps(client: AsyncClient) -> None:
    _, _, draft = await _build_shot_task_and_draft_revision(client)

    body = (
        await client.post(
            f"/intent/execution-anchor-revisions/{draft['id']}/cg-supervisor-reviews/generate",
            headers=CG,
        )
    ).json()

    evidence_gaps_text = " ".join(body["review_output"]["evidence_gaps"]).lower()
    assert "footage" in evidence_gaps_text or "render" in evidence_gaps_text


async def test_no_unsupported_technical_observation(client: AsyncClient) -> None:
    _, _, draft = await _build_shot_task_and_draft_revision(client)

    body = (
        await client.post(
            f"/intent/execution-anchor-revisions/{draft['id']}/cg-supervisor-reviews/generate",
            headers=CG,
        )
    ).json()

    output_text = str(body["review_output"]).lower()
    for banned in _FORBIDDEN_TECHNICAL_TERMS:
        assert banned not in output_text


# --- multiple runs / read endpoints ---


async def test_multiple_runs_create_multiple_immutable_reviews(client: AsyncClient) -> None:
    _, _, draft = await _build_shot_task_and_draft_revision(client)

    first = (
        await client.post(
            f"/intent/execution-anchor-revisions/{draft['id']}/cg-supervisor-reviews/generate",
            headers=CG,
        )
    ).json()
    second = (
        await client.post(
            f"/intent/execution-anchor-revisions/{draft['id']}/cg-supervisor-reviews/generate",
            headers=CG,
        )
    ).json()

    assert first["id"] != second["id"]
    assert first["agent_run_id"] != second["agent_run_id"]
    assert first["context_snapshot_id"] != second["context_snapshot_id"]


async def test_get_and_list_endpoints_newest_first(client: AsyncClient) -> None:
    _, _, draft = await _build_shot_task_and_draft_revision(client)

    first = (
        await client.post(
            f"/intent/execution-anchor-revisions/{draft['id']}/cg-supervisor-reviews/generate",
            headers=CG,
        )
    ).json()
    second = (
        await client.post(
            f"/intent/execution-anchor-revisions/{draft['id']}/cg-supervisor-reviews/generate",
            headers=CG,
        )
    ).json()

    get_response = await client.get(f"/intent/cg-supervisor-reviews/{first['id']}")
    assert get_response.status_code == 200
    assert get_response.json() == first

    list_response = await client.get(
        f"/intent/execution-anchor-revisions/{draft['id']}/cg-supervisor-reviews"
    )
    assert list_response.status_code == 200
    listed = list_response.json()
    assert [r["id"] for r in listed] == [second["id"], first["id"]]


async def test_get_unknown_review_returns_404(client: AsyncClient) -> None:
    response = await client.get(
        "/intent/cg-supervisor-reviews/00000000-0000-0000-0000-000000000000"
    )
    assert response.status_code == 404


async def test_all_three_human_roles_may_read(client: AsyncClient) -> None:
    _, _, draft = await _build_shot_task_and_draft_revision(client)
    generated = (
        await client.post(
            f"/intent/execution-anchor-revisions/{draft['id']}/cg-supervisor-reviews/generate",
            headers=CG,
        )
    ).json()

    for headers in (VFX, CG, ARTIST):
        get_response = await client.get(
            f"/intent/cg-supervisor-reviews/{generated['id']}", headers=headers
        )
        assert get_response.status_code == 200
        list_response = await client.get(
            f"/intent/execution-anchor-revisions/{draft['id']}/cg-supervisor-reviews",
            headers=headers,
        )
        assert list_response.status_code == 200


# --- authority ---


async def test_vfx_supervisor_and_artist_cannot_generate(client: AsyncClient) -> None:
    _, _, draft = await _build_shot_task_and_draft_revision(client)

    for headers in (VFX, ARTIST):
        response = await client.post(
            f"/intent/execution-anchor-revisions/{draft['id']}/cg-supervisor-reviews/generate",
            headers=headers,
        )
        assert response.status_code == 403


async def test_generate_returns_404_for_unknown_revision(client: AsyncClient) -> None:
    response = await client.post(
        "/intent/execution-anchor-revisions/00000000-0000-0000-0000-000000000000"
        "/cg-supervisor-reviews/generate",
        headers=CG,
    )
    assert response.status_code == 404


async def test_agent_actor_cannot_generate_at_service_level(session: AsyncSession) -> None:
    agent = build_agent_actor("cg_supervisor_agent", uuid.uuid4())
    with pytest.raises(ForbiddenActionError):
        await generate_cg_supervisor_review(session, agent, uuid.uuid4())


# --- no side effects ---


async def test_generation_creates_no_side_effects_on_other_domain_objects(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot_id, task_id, draft = await _build_shot_task_and_draft_revision(client)

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
            ("writeback_records", WritebackRecord),
        ):
            rows = (await session.execute(select(model))).scalars().all()
            counts[label] = len(rows)
        return counts

    before = await _counts()

    response = await client.post(
        f"/intent/execution-anchor-revisions/{draft['id']}/cg-supervisor-reviews/generate",
        headers=CG,
    )
    assert response.status_code == 201

    after = await _counts()
    assert before == after

    agent_types = (await session.execute(select(AgentRun.agent_type).distinct())).scalars().all()
    assert "cg_supervisor_agent" in set(agent_types)
    assert "vfx_supervisor_agent" not in set(agent_types)
    assert "artist_agent" not in set(agent_types)

    reviews = (
        (
            await session.execute(
                select(CGSupervisorReview).where(
                    CGSupervisorReview.execution_anchor_revision_id == uuid.UUID(draft["id"])
                )
            )
        )
        .scalars()
        .all()
    )
    assert len(reviews) == 1
    assert str(reviews[0].shot_id) == shot_id
    assert str(reviews[0].task_id) == task_id


# --- failure handling ---


class _FailingGenerator:
    def generate(self, *, snapshot_payload: dict[str, Any]) -> CGSupervisorReviewOutput:
        raise RuntimeError("simulated provider timeout")


async def test_provider_failure_leaves_failed_run_and_no_review(
    client: AsyncClient, session: AsyncSession
) -> None:
    _, _, draft = await _build_shot_task_and_draft_revision(client)
    actor = ActorContext(actor_kind="human", actor_id="cg-1", human_role="cg_supervisor")

    with pytest.raises(AgentGenerationError):
        await generate_cg_supervisor_review(
            session, actor, uuid.UUID(draft["id"]), generator=_FailingGenerator()
        )

    capability_query = select(AgentRun).where(AgentRun.capability == "execution_review")
    runs = (await session.execute(capability_query)).scalars().all()
    assert len(runs) == 1
    assert runs[0].status == "failed"
    assert "simulated provider timeout" in (runs[0].error or "")

    assert (await session.execute(select(CGSupervisorReview))).scalars().all() == []


class _InventedEvidenceGenerator:
    """Returns an otherwise-valid output whose evidence cites an id that
    does not exist in the supplied snapshot -- must be rejected before
    any CGSupervisorReview row is persisted.
    """

    def generate(self, *, snapshot_payload: dict[str, Any]) -> CGSupervisorReviewOutput:
        from intent_core_contracts.api.cg_supervisor_review import (
            CGReviewEvidenceReference,
            CGReviewItem,
        )

        invented_evidence = [
            CGReviewEvidenceReference(
                source_type="execution_anchor_revision", source_id="not-a-real-id", label="Invented"
            )
        ]
        item = CGReviewItem(
            summary="Invented summary.",
            rationale="Invented rationale.",
            priority="low",
            evidence=invented_evidence,
        )
        return CGSupervisorReviewOutput(
            executive_summary="Invented summary.",
            execution_direction_read=item,
            actionable_requirements=[],
            technical_concerns=[],
            coordination_concerns=[],
            implementation_priorities=[],
            proposed_execution_guidance=[],
            questions_for_human_cg_supervisor=["A question."],
            evidence_gaps=["No footage or render evidence is available."],
        )


async def test_validation_failure_creates_no_partial_review(
    client: AsyncClient, session: AsyncSession
) -> None:
    _, _, draft = await _build_shot_task_and_draft_revision(client)
    actor = ActorContext(actor_kind="human", actor_id="cg-1", human_role="cg_supervisor")

    with pytest.raises(AgentGenerationError, match="not present in this Task's ContextSnapshot"):
        await generate_cg_supervisor_review(
            session, actor, uuid.UUID(draft["id"]), generator=_InventedEvidenceGenerator()
        )

    capability_query = select(AgentRun).where(AgentRun.capability == "execution_review")
    runs = (await session.execute(capability_query)).scalars().all()
    assert len(runs) == 1
    assert runs[0].status == "failed"
    assert (await session.execute(select(CGSupervisorReview))).scalars().all() == []


# --- deterministic generator unit test ---


def test_deterministic_generator_produces_valid_output() -> None:
    generator: CGSupervisorReviewGenerator = DeterministicCGSupervisorReviewGenerator()
    payload: dict[str, Any] = {
        "project": {"id": "p1", "name": "Demo"},
        "shot": {"id": "s1", "name": "SH010", "source": "manual"},
        "task": {"id": "t1", "name": "Lighting Pass", "department": "lighting"},
        "intent_brief": {"id": "b1", "raw_text": "A restrained, cinematic chase scene."},
        "intent_decomposition": None,
        "core_anchor": None,
        "context_reconstruction": None,
        "execution_anchor": {
            "id": "ea1",
            "task_id": "t1",
            "is_stale": False,
            "active_revision_id": None,
            "target_revision": {
                "id": "ear1",
                "revision_number": 1,
                "status": "draft",
                "technical_boundaries": "24fps, no motion blur.",
                "parameter_ranges": None,
                "delivery_conditions": None,
                "production_ready_criteria": None,
                "downstream_dependencies": None,
                "publish_requirements": None,
                "allowed_refinements": None,
                "escalation_conditions": None,
            },
        },
        "version": None,
        "alignment_assessment": None,
        "vfx_supervisor_review": None,
        "decisions": [],
        "core_anchor_human_gate": None,
        "execution_anchor_human_gate": None,
    }
    first = generator.generate(snapshot_payload=payload)
    second = generator.generate(snapshot_payload=payload)
    assert first == second
    assert first.execution_direction_read.evidence[0].source_id == "ear1"
    assert any("footage" in gap.lower() or "render" in gap.lower() for gap in first.evidence_gaps)


def test_deterministic_generator_respects_bounded_contract_with_excess_input_data() -> None:
    """All 8 Execution Anchor fields populated and 5 Core Anchor
    constraints recorded -- more than the bounded contract allows in any
    single list -- must still produce output that validates, by slicing
    to the smallest sufficient set rather than raising or silently
    exceeding the contract's own Field limits.
    """
    generator: CGSupervisorReviewGenerator = DeterministicCGSupervisorReviewGenerator()
    long_value = "A very long recorded field value. " * 10  # 350 chars
    payload: dict[str, Any] = {
        "project": {"id": "p1", "name": "Demo"},
        "shot": {"id": "s1", "name": "SH010", "source": "manual"},
        "task": {"id": "t1", "name": "Lighting Pass", "department": "lighting"},
        "intent_brief": {"id": "b1", "raw_text": "A restrained, cinematic chase scene."},
        "intent_decomposition": None,
        "core_anchor": {
            "id": "ca1",
            "confirmed_revision": {
                "id": "cr1",
                "status": "confirmed",
                "constraints": [{"id": f"c{i}", "content": long_value} for i in range(5)],
            },
        },
        "context_reconstruction": None,
        "execution_anchor": {
            "id": "ea1",
            "task_id": "t1",
            "is_stale": True,
            "active_revision_id": None,
            "target_revision": {
                "id": "ear1",
                "revision_number": 1,
                "status": "draft",
                "technical_boundaries": long_value,
                "parameter_ranges": long_value,
                "delivery_conditions": long_value,
                "production_ready_criteria": long_value,
                "downstream_dependencies": long_value,
                "publish_requirements": long_value,
                "allowed_refinements": long_value,
                "escalation_conditions": long_value,
            },
        },
        "version": None,
        "alignment_assessment": None,
        "vfx_supervisor_review": {"id": "vfx1"},
        "decisions": [],
        "core_anchor_human_gate": None,
        "execution_anchor_human_gate": None,
    }

    output = generator.generate(snapshot_payload=payload)

    assert len(output.actionable_requirements) <= 3
    assert len(output.implementation_priorities) <= 3
    assert len(output.proposed_execution_guidance) <= 3
    assert len(output.technical_concerns) <= 3
    assert len(output.coordination_concerns) <= 2
    assert len(output.evidence_gaps) <= 5
    assert len(output.executive_summary) <= 700
    for item in [
        output.execution_direction_read,
        *output.actionable_requirements,
        *output.technical_concerns,
        *output.coordination_concerns,
        *output.implementation_priorities,
    ]:
        assert len(item.summary) <= 280
        assert len(item.rationale) <= 420
        assert len(item.evidence) <= 2
    for guidance_item in output.proposed_execution_guidance:
        assert len(guidance_item.guidance) <= 320
        assert len(guidance_item.underlying_intent) <= 420
        assert len(guidance_item.evidence) <= 2


# --- bounded output contract (Step 4 truncation root-cause fix) ---


def _evidence_ref() -> CGReviewEvidenceReference:
    return CGReviewEvidenceReference(
        source_type="execution_anchor_revision", source_id="x1", label="X"
    )


def test_cg_review_item_rejects_overlong_summary() -> None:
    with pytest.raises(ValueError, match="at most 280"):
        CGReviewItem(
            summary="x" * 281,
            rationale="short",
            priority="low",
            evidence=[_evidence_ref()],
        )


def test_cg_review_item_rejects_overlong_rationale() -> None:
    with pytest.raises(ValueError, match="at most 420"):
        CGReviewItem(
            summary="short",
            rationale="x" * 421,
            priority="low",
            evidence=[_evidence_ref()],
        )


def test_cg_review_item_rejects_more_than_two_evidence_references() -> None:
    with pytest.raises(ValueError, match="at most 2"):
        CGReviewItem(
            summary="short",
            rationale="short",
            priority="low",
            evidence=[_evidence_ref(), _evidence_ref(), _evidence_ref()],
        )


def test_cg_review_item_rejects_empty_evidence() -> None:
    with pytest.raises(ValueError, match="at least 1"):
        CGReviewItem(summary="short", rationale="short", priority="low", evidence=[])


def test_cg_proposed_execution_guidance_rejects_overlong_guidance() -> None:
    with pytest.raises(ValueError, match="at most 320"):
        CGProposedExecutionGuidance(
            guidance="x" * 321,
            underlying_intent="short",
            priority="low",
            evidence=[_evidence_ref()],
        )


def test_cg_supervisor_review_output_rejects_overlong_executive_summary() -> None:
    with pytest.raises(ValueError, match="at most 700"):
        CGSupervisorReviewOutput(
            executive_summary="x" * 701,
            execution_direction_read=CGReviewItem(
                summary="short", rationale="short", priority="low", evidence=[_evidence_ref()]
            ),
            actionable_requirements=[],
            technical_concerns=[],
            coordination_concerns=[],
            implementation_priorities=[],
            proposed_execution_guidance=[],
            questions_for_human_cg_supervisor=["A question."],
            evidence_gaps=["A gap."],
        )


@pytest.mark.parametrize(
    ("field", "limit"),
    [
        ("actionable_requirements", 3),
        ("technical_concerns", 3),
        ("coordination_concerns", 2),
        ("implementation_priorities", 3),
        ("proposed_execution_guidance", 3),
        ("questions_for_human_cg_supervisor", 3),
        ("evidence_gaps", 5),
    ],
)
def test_cg_supervisor_review_output_rejects_too_many_list_items(field: str, limit: int) -> None:
    base_item = CGReviewItem(
        summary="short", rationale="short", priority="low", evidence=[_evidence_ref()]
    )
    base_guidance = CGProposedExecutionGuidance(
        guidance="short", underlying_intent="short", priority="low", evidence=[_evidence_ref()]
    )
    overflowing_values: dict[str, list[Any]] = {
        "actionable_requirements": [base_item] * (limit + 1),
        "technical_concerns": [base_item] * (limit + 1),
        "coordination_concerns": [base_item] * (limit + 1),
        "implementation_priorities": [base_item] * (limit + 1),
        "proposed_execution_guidance": [base_guidance] * (limit + 1),
        "questions_for_human_cg_supervisor": ["A question."] * (limit + 1),
        "evidence_gaps": ["A gap."] * (limit + 1),
    }
    kwargs: dict[str, Any] = {
        "executive_summary": "short",
        "execution_direction_read": base_item,
        "actionable_requirements": [],
        "technical_concerns": [],
        "coordination_concerns": [],
        "implementation_priorities": [],
        "proposed_execution_guidance": [],
        "questions_for_human_cg_supervisor": ["A question."],
        "evidence_gaps": ["A gap."],
    }
    kwargs[field] = overflowing_values[field]

    with pytest.raises(ValueError, match="at most"):
        CGSupervisorReviewOutput(**kwargs)


# --- content-boundary hardening (Step 4 real-provider acceptance gaps) ---


def _compliant_evidence_gaps() -> list[str]:
    return [
        "ICAS has not directly inspected footage, rendered frames, or scene files for this Task."
    ]


def _make_output(
    *,
    evidence_gaps: list[str] | None = None,
    proposed_execution_guidance: list[CGProposedExecutionGuidance] | None = None,
    implementation_priorities: list[CGReviewItem] | None = None,
    questions_for_human_cg_supervisor: list[str] | None = None,
) -> CGSupervisorReviewOutput:
    base_item = CGReviewItem(
        summary="short", rationale="short", priority="low", evidence=[_evidence_ref()]
    )
    return CGSupervisorReviewOutput(
        executive_summary="short",
        execution_direction_read=base_item,
        actionable_requirements=[],
        technical_concerns=[],
        coordination_concerns=[],
        implementation_priorities=implementation_priorities or [],
        proposed_execution_guidance=proposed_execution_guidance or [],
        questions_for_human_cg_supervisor=questions_for_human_cg_supervisor or ["A question."],
        evidence_gaps=evidence_gaps if evidence_gaps is not None else _compliant_evidence_gaps(),
    )


def test_validate_content_boundaries_accepts_compliant_output() -> None:
    output = _make_output()
    cg_supervisor_review_service._validate_content_boundaries(output)  # no raise


def test_validate_content_boundaries_rejects_missing_inspection_disclosure() -> None:
    output = _make_output(evidence_gaps=["No numeric contrast values are recorded."])
    with pytest.raises(AgentGenerationError, match="inspection boundary"):
        cg_supervisor_review_service._validate_content_boundaries(output)


@pytest.mark.parametrize(
    "text",
    [
        "Please update the Core Anchor to reflect this variation.",
        "The Core Anchor should be updated to allow this.",
        "Recommend the team re-anchor the shot before proceeding.",
        "You should confirm the gate now that this is resolved.",
        "We recommend confirming the pending HumanGate.",
        "Create a decision to formalise this change.",
    ],
)
def test_forbidden_authority_reason_rejects_out_of_scope_instructions(text: str) -> None:
    assert cg_supervisor_review_service._forbidden_authority_reason(text) is not None


@pytest.mark.parametrize(
    "text",
    [
        "This constraint was recorded on the confirmed Core Anchor revision.",
        "The Core Anchor states the tone must stay restrained.",
        "Escalate this ambiguity and coordinate with the Human VFX Supervisor.",
        "Clarify with the Human VFX Supervisor whether the push-in is intentional.",
    ],
)
def test_forbidden_authority_reason_allows_evidence_mentions_and_coordination(text: str) -> None:
    assert cg_supervisor_review_service._forbidden_authority_reason(text) is None


def test_validate_content_boundaries_rejects_core_anchor_update_in_proposed_guidance() -> None:
    output = _make_output(
        proposed_execution_guidance=[
            CGProposedExecutionGuidance(
                guidance="Update the Core Anchor to allow this variation.",
                underlying_intent="short",
                priority="low",
                evidence=[_evidence_ref()],
            )
        ]
    )
    with pytest.raises(AgentGenerationError, match="bounded advisory scope"):
        cg_supervisor_review_service._validate_content_boundaries(output)


def test_validate_content_boundaries_rejects_reanchor_in_implementation_priorities() -> None:
    output = _make_output(
        implementation_priorities=[
            CGReviewItem(
                summary="short",
                rationale="Recommend the team re-anchor the shot before proceeding.",
                priority="low",
                evidence=[_evidence_ref()],
            )
        ]
    )
    with pytest.raises(AgentGenerationError, match="bounded advisory scope"):
        cg_supervisor_review_service._validate_content_boundaries(output)


def test_validate_content_boundaries_rejects_humangate_advice_in_questions() -> None:
    output = _make_output(
        questions_for_human_cg_supervisor=["Should we confirm the gate right away?"]
    )
    with pytest.raises(AgentGenerationError, match="bounded advisory scope"):
        cg_supervisor_review_service._validate_content_boundaries(output)


def test_validate_content_boundaries_rejects_decision_authority_advice() -> None:
    output = _make_output(
        proposed_execution_guidance=[
            CGProposedExecutionGuidance(
                guidance="Create a decision to formalise this change.",
                underlying_intent="short",
                priority="low",
                evidence=[_evidence_ref()],
            )
        ]
    )
    with pytest.raises(AgentGenerationError, match="bounded advisory scope"):
        cg_supervisor_review_service._validate_content_boundaries(output)


def test_validate_content_boundaries_allows_core_anchor_mentioned_as_evidence() -> None:
    output = _make_output(
        implementation_priorities=[
            CGReviewItem(
                summary="Preserve the constraint recorded on the confirmed Core Anchor.",
                rationale="This constraint was recorded on the confirmed Core Anchor revision.",
                priority="high",
                evidence=[_evidence_ref()],
            )
        ],
        questions_for_human_cg_supervisor=[
            "Should this ambiguity be escalated to the Human VFX Supervisor for coordination?"
        ],
    )
    cg_supervisor_review_service._validate_content_boundaries(output)  # no raise


def _real_evidence_ref(snapshot_payload: dict[str, Any]) -> CGReviewEvidenceReference:
    """Cites the one id every real ContextSnapshot in these tests is
    guaranteed to contain -- the target Execution Anchor revision --
    so these end-to-end tests fail on the content boundary they mean
    to exercise, not on the unrelated evidence-id check that runs first.
    """
    revision_id = snapshot_payload["execution_anchor"]["target_revision"]["id"]
    return CGReviewEvidenceReference(
        source_type="execution_anchor_revision", source_id=revision_id, label="Revision"
    )


class _MissingInspectionDisclosureGenerator:
    """Otherwise-valid output that omits the mandatory explicit
    footage/rendered-frame/scene-file inspection disclosure.
    """

    def generate(self, *, snapshot_payload: dict[str, Any]) -> CGSupervisorReviewOutput:
        base_item = CGReviewItem(
            summary="short",
            rationale="short",
            priority="low",
            evidence=[_real_evidence_ref(snapshot_payload)],
        )
        return CGSupervisorReviewOutput(
            executive_summary="short",
            execution_direction_read=base_item,
            actionable_requirements=[],
            technical_concerns=[],
            coordination_concerns=[],
            implementation_priorities=[],
            proposed_execution_guidance=[],
            questions_for_human_cg_supervisor=["A question."],
            evidence_gaps=["No numeric contrast values are recorded."],
        )


async def test_missing_inspection_disclosure_preserves_snapshot_and_failed_run_no_partial_review(
    client: AsyncClient, session: AsyncSession
) -> None:
    _, _, draft = await _build_shot_task_and_draft_revision(client)
    actor = ActorContext(actor_kind="human", actor_id="cg-1", human_role="cg_supervisor")

    with pytest.raises(AgentGenerationError, match="inspection boundary"):
        await generate_cg_supervisor_review(
            session,
            actor,
            uuid.UUID(draft["id"]),
            generator=_MissingInspectionDisclosureGenerator(),
        )

    capability_query = select(AgentRun).where(AgentRun.capability == "execution_review")
    runs = (await session.execute(capability_query)).scalars().all()
    assert len(runs) == 1
    assert runs[0].status == "failed"
    assert "inspection boundary" in (runs[0].error or "")
    assert (await session.execute(select(CGSupervisorReview))).scalars().all() == []
    # ContextSnapshot is preserved, not rolled back.
    snapshot = await session.get(ContextSnapshot, runs[0].context_snapshot_id)
    assert snapshot is not None


class _CoreAnchorUpdateGuidanceGenerator:
    """Otherwise-valid output whose proposed guidance instructs updating
    the Core Anchor -- outside this capability's bounded advisory scope.
    """

    def generate(self, *, snapshot_payload: dict[str, Any]) -> CGSupervisorReviewOutput:
        ref = _real_evidence_ref(snapshot_payload)
        base_item = CGReviewItem(summary="short", rationale="short", priority="low", evidence=[ref])
        return CGSupervisorReviewOutput(
            executive_summary="short",
            execution_direction_read=base_item,
            actionable_requirements=[],
            technical_concerns=[],
            coordination_concerns=[],
            implementation_priorities=[],
            proposed_execution_guidance=[
                CGProposedExecutionGuidance(
                    guidance="Update the Core Anchor to document this as an allowed variation.",
                    underlying_intent="short",
                    priority="low",
                    evidence=[ref],
                )
            ],
            questions_for_human_cg_supervisor=["A question."],
            evidence_gaps=_compliant_evidence_gaps(),
        )


async def test_core_anchor_update_guidance_preserves_snapshot_and_failed_run_no_partial_review(
    client: AsyncClient, session: AsyncSession
) -> None:
    _, _, draft = await _build_shot_task_and_draft_revision(client)
    actor = ActorContext(actor_kind="human", actor_id="cg-1", human_role="cg_supervisor")

    with pytest.raises(AgentGenerationError, match="bounded advisory scope"):
        await generate_cg_supervisor_review(
            session,
            actor,
            uuid.UUID(draft["id"]),
            generator=_CoreAnchorUpdateGuidanceGenerator(),
        )

    capability_query = select(AgentRun).where(AgentRun.capability == "execution_review")
    runs = (await session.execute(capability_query)).scalars().all()
    assert len(runs) == 1
    run = runs[0]
    assert run.status == "failed"
    error = run.error or ""
    assert "bounded advisory scope" in error
    # Never the offending text itself, and never a credential.
    assert "Update the Core Anchor to document" not in error
    assert (await session.execute(select(CGSupervisorReview))).scalars().all() == []
    snapshot = await session.get(ContextSnapshot, run.context_snapshot_id)
    assert snapshot is not None


def test_deterministic_generator_output_satisfies_content_boundaries() -> None:
    """The deterministic generator's own output must pass the exact
    validator every real provider response is also held to.
    """
    generator: CGSupervisorReviewGenerator = DeterministicCGSupervisorReviewGenerator()
    payload: dict[str, Any] = {
        "project": {"id": "p1", "name": "Demo"},
        "shot": {"id": "s1", "name": "SH010", "source": "manual"},
        "task": {"id": "t1", "name": "Lighting Pass", "department": "lighting"},
        "intent_brief": {"id": "b1", "raw_text": "A restrained, cinematic chase scene."},
        "intent_decomposition": None,
        "core_anchor": {
            "id": "ca1",
            "confirmed_revision": {
                "id": "cr1",
                "status": "confirmed",
                "constraints": [{"id": "c1", "content": "No jump cuts."}],
            },
        },
        "context_reconstruction": None,
        "execution_anchor": {
            "id": "ea1",
            "task_id": "t1",
            "is_stale": True,
            "active_revision_id": None,
            "target_revision": {
                "id": "ear1",
                "revision_number": 1,
                "status": "draft",
                "technical_boundaries": "24fps, no motion blur.",
                "parameter_ranges": None,
                "delivery_conditions": None,
                "production_ready_criteria": None,
                "downstream_dependencies": None,
                "publish_requirements": None,
                "allowed_refinements": None,
                "escalation_conditions": None,
            },
        },
        "version": None,
        "alignment_assessment": None,
        "vfx_supervisor_review": {"id": "vfx1"},
        "decisions": [],
        "core_anchor_human_gate": None,
        "execution_anchor_human_gate": None,
    }
    output = generator.generate(snapshot_payload=payload)
    cg_supervisor_review_service._validate_content_boundaries(output)  # no raise


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


_DEEPSEEK_FAKE_OUTPUT = CGSupervisorReviewOutput.model_validate(
    {
        "executive_summary": "One recorded field, one constraint to verify.",
        "execution_direction_read": {
            "summary": "Review against the target Execution Anchor revision.",
            "rationale": "Directly stated on the target Execution Anchor revision.",
            "priority": "high",
            "evidence": [
                {"source_type": "execution_anchor_revision", "source_id": "r1", "label": "Anchor"}
            ],
        },
        "actionable_requirements": [],
        "technical_concerns": [],
        "coordination_concerns": [],
        "implementation_priorities": [],
        "proposed_execution_guidance": [],
        "questions_for_human_cg_supervisor": ["Does the actual render match this description?"],
        "evidence_gaps": [
            "ICAS has not directly inspected footage, rendered frames, or scene files "
            "for this Task."
        ],
    }
)

_DEEPSEEK_TEST_SNAPSHOT_PAYLOAD: dict[str, Any] = {
    "project": {"id": "p1", "name": "Demo"},
    "shot": {"id": "s1", "name": "SH010", "source": "manual"},
    "task": {"id": "t1", "name": "Lighting Pass"},
    "intent_brief": {"id": "b1", "raw_text": "A restrained, cinematic chase scene."},
    "intent_decompositions": [],
    "core_anchor": None,
    "context_reconstruction": None,
    "execution_anchor": {
        "id": "ea1",
        "task_id": "t1",
        "is_stale": False,
        "active_revision_id": None,
    },
    "versions": [],
    "alignment_assessment": None,
    "vfx_supervisor_review": None,
    "decisions": [],
    "core_anchor_human_gate": None,
    "execution_anchor_human_gate": None,
}


def test_deepseek_adapter_makes_one_non_streaming_json_mode_call(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import openai

    monkeypatch.setattr(openai, "OpenAI", _FakeOpenAIClient)

    generator = DeepSeekCGSupervisorReviewGenerator(
        api_key="test-key-never-a-real-secret", model_name="deepseek-v4-flash"
    )

    output = generator.generate(snapshot_payload=_DEEPSEEK_TEST_SNAPSHOT_PAYLOAD)

    assert output == _DEEPSEEK_FAKE_OUTPUT
    client = _FakeOpenAIClient.last_instance
    assert client is not None
    assert client.api_key == "test-key-never-a-real-secret"
    assert client.base_url == "https://api.deepseek.com"
    assert len(client.chat.completions.calls) == 1
    call = client.chat.completions.calls[0]
    assert call["model"] == "deepseek-v4-flash"
    assert call["response_format"] == {"type": "json_object"}
    # Step 4 real-provider truncation fix: this capability's registered
    # max_output_tokens (8192) must actually reach the client call, not
    # the Model Gateway's shared 4096 default.
    assert call["max_tokens"] == 8192
    assert "json" in call["messages"][0]["content"].lower()
    assert "stream" not in call


def test_deepseek_adapter_raises_agent_generation_error_on_empty_content(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import openai

    class _EmptyContentClient(_FakeOpenAIClient):
        def __init__(self, *, api_key: str, base_url: str) -> None:
            super().__init__(api_key=api_key, base_url=base_url)
            self.chat = _FakeChat(None)

    monkeypatch.setattr(openai, "OpenAI", _EmptyContentClient)

    generator = DeepSeekCGSupervisorReviewGenerator(api_key="k", model_name="deepseek-v4-flash")

    with pytest.raises(AgentGenerationError):
        generator.generate(snapshot_payload=_DEEPSEEK_TEST_SNAPSHOT_PAYLOAD)


def test_deepseek_adapter_raises_agent_generation_error_on_truncated_json(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Reproduces the real Step 4 acceptance failure: a response cut off
    mid-JSON-string (the shape DeepSeek returns when it hits its output
    token budget) must fail cleanly with a sanitised AgentGenerationError
    -- never the raw pydantic ValidationError, whose message embeds a
    snippet of the actual (possibly truncated) response content.
    """
    import openai

    truncated_content = '{\n  "executive_summary": "One recorded field, one const'

    class _TruncatedContentClient(_FakeOpenAIClient):
        def __init__(self, *, api_key: str, base_url: str) -> None:
            super().__init__(api_key=api_key, base_url=base_url)
            self.chat = _FakeChat(truncated_content)

    monkeypatch.setattr(openai, "OpenAI", _TruncatedContentClient)

    generator = DeepSeekCGSupervisorReviewGenerator(api_key="k", model_name="deepseek-v4-flash")

    with pytest.raises(AgentGenerationError) as excinfo:
        generator.generate(snapshot_payload=_DEEPSEEK_TEST_SNAPSHOT_PAYLOAD)

    message = str(excinfo.value)
    assert "structured-output validation" in message
    # Safe diagnostics only -- the actual (truncated) response text must
    # never reach this message.
    assert "finish_reason=" in message
    assert "configured_max_output_tokens=8192" in message
    assert "response_characters=" in message
    assert truncated_content not in message
    assert "executive_summary" not in message


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
            cg_supervisor_review_service._get_generator()
    finally:
        monkeypatch.delenv("MODEL_PROVIDER", raising=False)
        monkeypatch.delenv("MODEL_API_KEY", raising=False)
        monkeypatch.delenv("MODEL_NAME", raising=False)
        get_settings.cache_clear()


async def test_generate_records_model_name_and_prompt_version_via_deepseek(
    client: AsyncClient, session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    import openai
    from intent_core_api.config import get_settings

    _, _, draft = await _build_shot_task_and_draft_revision(client)

    # Evidence must resolve to this specific run's own snapshot -- cite
    # the one real id this test actually knows ahead of time (the target
    # Execution Anchor revision itself), rather than the shared
    # cross-test fake constant.
    fake_output = CGSupervisorReviewOutput.model_validate(
        {
            "executive_summary": "Draft revision under review.",
            "execution_direction_read": {
                "summary": "Review against the target Execution Anchor revision.",
                "rationale": "Directly stated on the target Execution Anchor revision.",
                "priority": "high",
                "evidence": [
                    {
                        "source_type": "execution_anchor_revision",
                        "source_id": draft["id"],
                        "label": "Execution Anchor revision",
                    }
                ],
            },
            "actionable_requirements": [],
            "technical_concerns": [],
            "coordination_concerns": [],
            "implementation_priorities": [],
            "proposed_execution_guidance": [],
            "questions_for_human_cg_supervisor": ["Does the actual render match this description?"],
            "evidence_gaps": [
                "ICAS has not directly inspected footage, rendered frames, or scene files "
                "for this Task."
            ],
        }
    )

    class _RealIdFakeClient(_FakeOpenAIClient):
        def __init__(self, *, api_key: str, base_url: str) -> None:
            super().__init__(api_key=api_key, base_url=base_url)
            self.chat = _FakeChat(fake_output.model_dump_json())

    monkeypatch.setattr(openai, "OpenAI", _RealIdFakeClient)
    get_settings.cache_clear()
    monkeypatch.setenv("MODEL_PROVIDER", "deepseek")
    monkeypatch.setenv("MODEL_API_KEY", "test-key-never-a-real-secret")
    monkeypatch.setenv("MODEL_NAME", "deepseek-v4-flash")
    get_settings.cache_clear()
    try:
        actor = ActorContext(actor_kind="human", actor_id="cg-1", human_role="cg_supervisor")
        review = await generate_cg_supervisor_review(session, actor, uuid.UUID(draft["id"]))
    finally:
        monkeypatch.delenv("MODEL_PROVIDER", raising=False)
        monkeypatch.delenv("MODEL_API_KEY", raising=False)
        monkeypatch.delenv("MODEL_NAME", raising=False)
        get_settings.cache_clear()

    run = await session.get(AgentRun, review.agent_run_id)
    assert run is not None
    assert run.provider == "deepseek"
    assert run.model_name == "deepseek-v4-flash"
    assert run.prompt_version == "cg_supervisor_execution_review.v1"
    assert run.status == "succeeded"


async def test_truncated_deepseek_json_preserves_snapshot_and_failed_run_no_partial_review(
    client: AsyncClient, session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Reproduces the real Step 4 acceptance failure end-to-end through
    the full service path: a DeepSeek response cut off mid-JSON must
    still leave the ContextSnapshot in place, mark the AgentRun failed
    with no credential in the error, and persist no CGSupervisorReview.
    """
    import openai
    from intent_core_api.config import get_settings

    _, _, draft = await _build_shot_task_and_draft_revision(client)

    truncated_content = '{\n  "executive_summary": "One recorded field, one const'

    class _TruncatedContentClient(_FakeOpenAIClient):
        def __init__(self, *, api_key: str, base_url: str) -> None:
            super().__init__(api_key=api_key, base_url=base_url)
            self.chat = _FakeChat(truncated_content)

    monkeypatch.setattr(openai, "OpenAI", _TruncatedContentClient)
    get_settings.cache_clear()
    monkeypatch.setenv("MODEL_PROVIDER", "deepseek")
    monkeypatch.setenv("MODEL_API_KEY", "test-key-never-a-real-secret")
    monkeypatch.setenv("MODEL_NAME", "deepseek-v4-flash")
    get_settings.cache_clear()
    try:
        actor = ActorContext(actor_kind="human", actor_id="cg-1", human_role="cg_supervisor")
        with pytest.raises(AgentGenerationError):
            await generate_cg_supervisor_review(session, actor, uuid.UUID(draft["id"]))
    finally:
        monkeypatch.delenv("MODEL_PROVIDER", raising=False)
        monkeypatch.delenv("MODEL_API_KEY", raising=False)
        monkeypatch.delenv("MODEL_NAME", raising=False)
        get_settings.cache_clear()

    capability_query = select(AgentRun).where(
        AgentRun.capability == "execution_review", AgentRun.provider == "deepseek"
    )
    runs = (await session.execute(capability_query)).scalars().all()
    assert len(runs) == 1
    run = runs[0]
    assert run.status == "failed"
    assert "test-key-never-a-real-secret" not in (run.error or "")
    # The ContextSnapshot the failed run points at was preserved, not
    # rolled back -- it remains evidence of what the model actually saw.
    assert run.context_snapshot_id is not None
    snapshot = await session.get(ContextSnapshot, run.context_snapshot_id)
    assert snapshot is not None

    reviews = (await session.execute(select(CGSupervisorReview))).scalars().all()
    assert reviews == []


def test_cg_prompt_declares_bounded_output_size_limits() -> None:
    """Not a verbatim-prompt-comparison test -- just checks that the
    Step 4 bounded-output instructions this fix added are present, so a
    future edit can't silently drop them without a failing test.
    """
    from intent_core_api.agents import prompt_registry

    system_prompt = prompt_registry.get_registration("execution_review").system_prompt

    for expected in (
        "at most 3 actionable_requirements",
        "at most 3 technical_concerns",
        "at most 2 coordination_concerns",
        "at most 3 implementation_priorities",
        "proposed_execution_guidance entries",
        "at most 3 questions_for_human_cg_supervisor",
        "at most 5 evidence_gaps",
    ):
        assert expected in system_prompt, expected
