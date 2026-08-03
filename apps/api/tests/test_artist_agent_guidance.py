from __future__ import annotations

import uuid
from typing import Any

import pytest
from httpx import AsyncClient
from intent_core_api.agents import artist_guidance_service
from intent_core_api.agents.artist_guidance_service import (
    ArtistGuidanceGenerator,
    DeepSeekArtistGuidanceGenerator,
    DeterministicArtistGuidanceGenerator,
    generate_artist_agent_guidance,
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
from intent_core_contracts.api.artist_agent_guidance import (
    ArtistAgentGuidanceOutput,
    ArtistEvidenceReference,
    ArtistFeedbackTranslation,
    ArtistGuidanceItem,
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
    "decisions",
    "core_anchor_human_gate",
    "execution_anchor_human_gate",
}


def _evidence_ref() -> ArtistEvidenceReference:
    return ArtistEvidenceReference(source_type="task", source_id="t1", label="Task")


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
                "variation_zones": [{"content": "Camera speed may vary slightly."}],
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


async def _create_task(client: AsyncClient, shot_id: str, name: str = "Lighting Pass") -> str:
    task = (
        await client.post(
            "/tasks", json={"shot_id": shot_id, "name": name, "department": "lighting"}
        )
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


async def _build_ready_shot(client: AsyncClient) -> tuple[str, str, dict[str, Any], str]:
    """Shot + confirmed Core Anchor + Task with a confirmed Execution
    Anchor revision + one Version -- the minimum state Artist Agent
    guidance generation requires.
    """
    shot_id = await _create_shot(client)
    await _create_brief(client, shot_id)
    await _confirm_core_anchor(client, shot_id)
    task_id = await _create_task(client, shot_id)
    confirmed_revision = await _create_confirmed_execution_anchor(client, task_id)
    version_id = await _create_version(client, shot_id)
    return shot_id, task_id, confirmed_revision, version_id


async def _generate(
    client: AsyncClient, version_id: str, task_id: str, headers: dict[str, str] = ARTIST
) -> Any:
    return await client.post(
        f"/intent/versions/{version_id}/artist-guidances/generate",
        json={"task_id": task_id},
        headers=headers,
    )


# --- generation + structured output ---


async def test_generate_creates_guidance_with_expected_shape(client: AsyncClient) -> None:
    _, task_id, confirmed_revision, version_id = await _build_ready_shot(client)

    response = await _generate(client, version_id, task_id)
    assert response.status_code == 201
    body = response.json()

    assert body["task_id"] == task_id
    assert body["version_id"] == version_id
    assert body["execution_anchor_revision_id"] == confirmed_revision["id"]
    output = body["guidance_output"]
    assert output["executive_summary"]
    for key in ("creative_intent_read", "task_goal", "current_iteration_read"):
        item = output[key]
        assert item["summary"]
        assert item["why_it_matters"]
        assert item["priority"] in ("low", "medium", "high")
        assert item["evidence"]
    for list_key in ("non_negotiables", "allowed_variations", "iteration_priorities"):
        for item in output[list_key]:
            assert item["summary"]
            assert item["why_it_matters"]
            assert item["evidence"]
    for translation in output["feedback_translations"]:
        assert translation["feedback_or_issue"]
        assert translation["practical_action"]
        assert translation["underlying_intent"]
        assert translation["self_check"]
        assert translation["evidence"]
    assert output["evidence_gaps"]


async def test_generate_creates_succeeded_agent_run_with_expected_capability(
    client: AsyncClient, session: AsyncSession
) -> None:
    _, task_id, _, version_id = await _build_ready_shot(client)

    body = (await _generate(client, version_id, task_id)).json()

    run = (await client.get(f"/intent/agent-runs/{body['agent_run_id']}")).json()
    assert run["status"] == "succeeded"
    assert run["agent_type"] == "artist_agent"
    assert run["capability"] == "iteration_guidance"
    assert run["provider"] == "deterministic"
    assert run["model_name"] is None
    assert run["prompt_version"] is None
    assert run["error"] is None
    assert run["completed_at"] is not None

    runs = (
        (await session.execute(select(AgentRun).where(AgentRun.capability == "iteration_guidance")))
        .scalars()
        .all()
    )
    assert len(runs) == 1


def test_prompt_registry_entry_is_registered() -> None:
    from intent_core_api.agents import prompt_registry

    registration = prompt_registry.get_registration("iteration_guidance")
    assert registration.agent_type == "artist_agent"
    assert registration.capability == "iteration_guidance"
    assert registration.prompt_key == "artist_iteration_guidance"
    assert registration.version == "v2"
    assert registration.version_label == "artist_iteration_guidance.v2"
    assert registration.max_output_tokens == 6144


# --- confirmed Execution Anchor requirement ---


async def test_generate_returns_409_with_vfx_owned_core_prerequisite_when_anchors_missing(
    client: AsyncClient,
) -> None:
    shot_id = await _create_shot(client)
    task_id = await _create_task(client, shot_id)
    version_id = await _create_version(client, shot_id)

    response = await _generate(client, version_id, task_id)

    assert response.status_code == 409
    assert "confirmed Core Anchor" in response.json()["detail"]
    assert "VFX Supervisor" in response.json()["detail"]


async def test_generate_returns_409_when_no_execution_anchor_exists(client: AsyncClient) -> None:
    shot_id = await _create_shot(client)
    await _create_brief(client, shot_id)
    await _confirm_core_anchor(client, shot_id)
    task_id = await _create_task(client, shot_id)
    version_id = await _create_version(client, shot_id)

    response = await _generate(client, version_id, task_id)
    assert response.status_code == 409


async def test_generate_returns_409_when_execution_anchor_is_only_a_draft(
    client: AsyncClient,
) -> None:
    shot_id = await _create_shot(client)
    await _create_brief(client, shot_id)
    await _confirm_core_anchor(client, shot_id)
    task_id = await _create_task(client, shot_id)
    await client.post(
        f"/intent/tasks/{task_id}/execution-anchor/drafts",
        json={"technical_boundaries": "24fps."},
        headers=CG,
    )
    version_id = await _create_version(client, shot_id)

    response = await _generate(client, version_id, task_id)
    assert response.status_code == 409


async def test_generate_returns_409_when_execution_anchor_is_rejected(client: AsyncClient) -> None:
    shot_id = await _create_shot(client)
    await _create_brief(client, shot_id)
    await _confirm_core_anchor(client, shot_id)
    task_id = await _create_task(client, shot_id)
    draft = (
        await client.post(
            f"/intent/tasks/{task_id}/execution-anchor/drafts",
            json={"technical_boundaries": "24fps."},
            headers=CG,
        )
    ).json()
    await client.post(
        f"/intent/execution-anchor-revisions/{draft['id']}/reject", json={}, headers=CG
    )
    version_id = await _create_version(client, shot_id)

    response = await _generate(client, version_id, task_id)
    assert response.status_code == 409


async def test_409_path_creates_no_snapshot_run_or_guidance(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot_id = await _create_shot(client)
    await _create_brief(client, shot_id)
    await _confirm_core_anchor(client, shot_id)
    task_id = await _create_task(client, shot_id)
    version_id = await _create_version(client, shot_id)

    response = await _generate(client, version_id, task_id)
    assert response.status_code == 409

    assert (await session.execute(select(ContextSnapshot))).scalars().all() == []
    assert (await session.execute(select(AgentRun))).scalars().all() == []
    assert (await session.execute(select(ArtistAgentGuidance))).scalars().all() == []


async def test_generate_returns_404_for_task_belonging_to_a_different_shot(
    client: AsyncClient,
) -> None:
    _, _, _, version_id = await _build_ready_shot(client)
    other_shot_id = await _create_shot(client)
    other_task_id = await _create_task(client, other_shot_id)

    response = await _generate(client, version_id, other_task_id)
    assert response.status_code == 404


# --- snapshot compaction ---


async def test_context_snapshot_contains_only_target_version_and_relevant_evidence(
    client: AsyncClient,
) -> None:
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
    assert payload["core_anchor_human_gate"]["status"] == "confirmed"
    assert payload["execution_anchor_human_gate"]["status"] == "confirmed"
    payload_text = str(payload)
    for banned in ("api_key", "password", "Authorization"):
        assert banned not in payload_text


async def test_snapshot_excludes_unrelated_task_and_version(client: AsyncClient) -> None:
    shot_id, task_id, _, version_id = await _build_ready_shot(client)
    unrelated_task_id = await _create_task(client, shot_id, name="Comp Pass")
    unrelated_version_id = await _create_version(
        client, shot_id, name="SH010_unrelated", description="An unrelated pass."
    )

    body = (await _generate(client, version_id, task_id)).json()
    snapshot = (await client.get(f"/intent/context-snapshots/{body['context_snapshot_id']}")).json()
    payload_text = str(snapshot["payload"])

    assert unrelated_task_id not in payload_text
    assert unrelated_version_id not in payload_text


async def test_snapshot_omits_verbose_nested_evidence_trees(client: AsyncClient) -> None:
    shot_id, task_id, confirmed_revision, version_id = await _build_ready_shot(client)
    await client.post(f"/intent/shots/{shot_id}/context-reconstructions/generate", headers=VFX)
    await client.post(
        f"/versions/{version_id}/review-notes",
        json={"content": "Please slow the camera down."},
        headers=VFX,
    )
    vfx_review = (
        await client.post(
            f"/intent/versions/{version_id}/vfx-supervisor-reviews/generate", headers=VFX
        )
    ).json()
    assert vfx_review["id"]
    cg_review = (
        await client.post(
            f"/intent/execution-anchor-revisions/{confirmed_revision['id']}"
            "/cg-supervisor-reviews/generate",
            headers=CG,
        )
    ).json()
    assert cg_review["id"]

    body = (await _generate(client, version_id, task_id)).json()
    snapshot = (await client.get(f"/intent/context-snapshots/{body['context_snapshot_id']}")).json()
    payload = snapshot["payload"]

    assert set(payload["context_reconstruction"].keys()) == {
        "id",
        "context_summary",
        "current_creative_direction_summary",
        "execution_context_summary",
        "context_gaps",
    }
    assert set(payload["vfx_supervisor_review"].keys()) == {
        "id",
        "executive_summary",
        "creative_concerns",
        "review_priorities",
        "proposed_feedback",
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
        "evidence_gaps",
    }
    vfx_text = str(payload["vfx_supervisor_review"])
    assert "source_type" not in vfx_text
    assert "creative_direction_read" not in vfx_text
    cg_text = str(payload["cg_supervisor_review"])
    assert "source_type" not in cg_text
    assert "execution_direction_read" not in cg_text


async def test_missing_media_represented_honestly_in_evidence_gaps(client: AsyncClient) -> None:
    _, task_id, _, version_id = await _build_ready_shot(client)

    body = (await _generate(client, version_id, task_id)).json()

    evidence_gaps_text = " ".join(body["guidance_output"]["evidence_gaps"]).lower()
    assert "footage" in evidence_gaps_text or "render" in evidence_gaps_text


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
    for decision in payload["decisions"]:
        ids.add(decision["id"])
    return ids


async def test_evidence_references_point_to_ids_in_snapshot(client: AsyncClient) -> None:
    _, task_id, _, version_id = await _build_ready_shot(client)

    body = (await _generate(client, version_id, task_id)).json()
    snapshot = (await client.get(f"/intent/context-snapshots/{body['context_snapshot_id']}")).json()
    real_ids = _collect_real_ids(snapshot["payload"])

    output = body["guidance_output"]
    items = [
        output["creative_intent_read"],
        output["task_goal"],
        output["current_iteration_read"],
        *output["non_negotiables"],
        *output["allowed_variations"],
        *output["iteration_priorities"],
        *output["cross_department_dependencies"],
    ]
    for item in items:
        for evidence in item["evidence"]:
            assert evidence["source_id"] in real_ids
    for translation in output["feedback_translations"]:
        for evidence in translation["evidence"]:
            assert evidence["source_id"] in real_ids


# --- multiple runs / read endpoints ---


async def test_multiple_runs_create_multiple_immutable_guidances(client: AsyncClient) -> None:
    _, task_id, _, version_id = await _build_ready_shot(client)

    first = (await _generate(client, version_id, task_id)).json()
    second = (await _generate(client, version_id, task_id)).json()
    assert first["id"] != second["id"]

    listed = (await client.get(f"/intent/versions/{version_id}/artist-guidances")).json()
    assert len(listed) == 2


async def test_get_and_list_endpoints_newest_first(client: AsyncClient) -> None:
    _, task_id, _, version_id = await _build_ready_shot(client)
    first = (await _generate(client, version_id, task_id)).json()
    second = (await _generate(client, version_id, task_id)).json()

    fetched = (await client.get(f"/intent/artist-guidances/{first['id']}")).json()
    assert fetched["id"] == first["id"]

    listed = (await client.get(f"/intent/versions/{version_id}/artist-guidances")).json()
    assert [item["id"] for item in listed] == [second["id"], first["id"]]


async def test_get_unknown_guidance_returns_404(client: AsyncClient) -> None:
    response = await client.get("/intent/artist-guidances/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404


async def test_all_three_human_roles_may_read(client: AsyncClient) -> None:
    _, task_id, _, version_id = await _build_ready_shot(client)
    body = (await _generate(client, version_id, task_id)).json()

    for headers in (VFX, CG, ARTIST):
        response = await client.get(f"/intent/artist-guidances/{body['id']}", headers=headers)
        assert response.status_code == 200


# --- authority ---


async def test_vfx_and_cg_supervisor_cannot_generate(client: AsyncClient) -> None:
    _, task_id, _, version_id = await _build_ready_shot(client)

    for headers in (VFX, CG):
        response = await _generate(client, version_id, task_id, headers=headers)
        assert response.status_code == 403


async def test_generate_returns_404_for_unknown_version(client: AsyncClient) -> None:
    _, task_id, _, _ = await _build_ready_shot(client)
    response = await _generate(client, "00000000-0000-0000-0000-000000000000", task_id)
    assert response.status_code == 404


async def test_agent_actor_cannot_generate_at_service_level(session: AsyncSession) -> None:
    agent = build_agent_actor("artist_agent", uuid.uuid4())
    with pytest.raises(ForbiddenActionError):
        await generate_artist_agent_guidance(session, agent, uuid.uuid4(), uuid.uuid4())


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
    assert "artist_agent" in set(agent_types)
    assert "vfx_supervisor_agent" not in set(agent_types)
    assert "cg_supervisor_agent" not in set(agent_types)
    assert "core_agent" not in set(agent_types)

    guidances = (
        (
            await session.execute(
                select(ArtistAgentGuidance).where(
                    ArtistAgentGuidance.version_id == uuid.UUID(version_id)
                )
            )
        )
        .scalars()
        .all()
    )
    assert len(guidances) == 1
    assert str(guidances[0].shot_id) == shot_id
    assert str(guidances[0].task_id) == task_id
    assert str(guidances[0].execution_anchor_revision_id) == confirmed_revision["id"]


# --- failure handling ---


class _FailingGenerator:
    def generate(self, *, snapshot_payload: dict[str, Any]) -> ArtistAgentGuidanceOutput:
        raise RuntimeError("simulated provider timeout")


async def test_provider_failure_leaves_failed_run_and_no_guidance(
    client: AsyncClient, session: AsyncSession
) -> None:
    _, task_id, _, version_id = await _build_ready_shot(client)
    actor = ActorContext(actor_kind="human", actor_id="artist-1", human_role="artist")

    with pytest.raises(AgentGenerationError):
        await generate_artist_agent_guidance(
            session,
            actor,
            uuid.UUID(version_id),
            uuid.UUID(task_id),
            generator=_FailingGenerator(),
        )

    runs = (
        (await session.execute(select(AgentRun).where(AgentRun.capability == "iteration_guidance")))
        .scalars()
        .all()
    )
    assert len(runs) == 1
    assert runs[0].status == "failed"
    assert "simulated provider timeout" in (runs[0].error or "")
    assert (await session.execute(select(ArtistAgentGuidance))).scalars().all() == []


class _InventedEvidenceGenerator:
    def generate(self, *, snapshot_payload: dict[str, Any]) -> ArtistAgentGuidanceOutput:
        invented = [
            ArtistEvidenceReference(source_type="task", source_id="not-a-real-id", label="Invented")
        ]
        item = ArtistGuidanceItem(
            summary="Invented summary.",
            why_it_matters="Invented rationale.",
            priority="low",
            evidence=invented,
        )
        return ArtistAgentGuidanceOutput(
            executive_summary="Invented summary.",
            creative_intent_read=item,
            task_goal=item,
            current_iteration_read=item,
            non_negotiables=[],
            allowed_variations=[],
            feedback_translations=[],
            iteration_priorities=[],
            cross_department_dependencies=[],
            questions_for_human_supervisor=["A question."],
            evidence_gaps=[
                "ICAS has not directly inspected footage, rendered frames, or scene files."
            ],
        )


async def test_validation_failure_creates_no_partial_guidance(
    client: AsyncClient, session: AsyncSession
) -> None:
    _, task_id, _, version_id = await _build_ready_shot(client)
    actor = ActorContext(actor_kind="human", actor_id="artist-1", human_role="artist")

    with pytest.raises(AgentGenerationError, match="not present in this Version's ContextSnapshot"):
        await generate_artist_agent_guidance(
            session,
            actor,
            uuid.UUID(version_id),
            uuid.UUID(task_id),
            generator=_InventedEvidenceGenerator(),
        )

    runs = (
        (await session.execute(select(AgentRun).where(AgentRun.capability == "iteration_guidance")))
        .scalars()
        .all()
    )
    assert len(runs) == 1
    assert runs[0].status == "failed"
    assert (await session.execute(select(ArtistAgentGuidance))).scalars().all() == []


class _AnchorContentAdditionGenerator:
    """Returns an otherwise-valid, evidence-resolving output whose
    ``iteration_priorities`` instructs adding content to the Execution
    Anchor -- the exact class of real-provider failure the Step 5
    content-boundary hardening was written to catch (see AgentRun
    ``2cec22c3-9b07-4f12-bb04-ceddd0677747``). Must be rejected before
    any ArtistAgentGuidance row is persisted.
    """

    def __init__(self, execution_anchor_revision_id: str) -> None:
        self._execution_anchor_revision_id = execution_anchor_revision_id

    def generate(self, *, snapshot_payload: dict[str, Any]) -> ArtistAgentGuidanceOutput:
        evidence = [
            ArtistEvidenceReference(
                source_type="execution_anchor_revision",
                source_id=self._execution_anchor_revision_id,
                label="Execution Anchor revision",
            )
        ]
        base_item = ArtistGuidanceItem(
            summary="short", why_it_matters="short", priority="low", evidence=evidence
        )
        return ArtistAgentGuidanceOutput(
            executive_summary="short",
            creative_intent_read=base_item,
            task_goal=base_item,
            current_iteration_read=base_item,
            non_negotiables=[],
            allowed_variations=[],
            feedback_translations=[],
            iteration_priorities=[
                ArtistGuidanceItem(
                    summary="short",
                    why_it_matters=(
                        "Add the permitted contrast range to the Execution Anchor "
                        "before the next submission."
                    ),
                    priority="low",
                    evidence=evidence,
                )
            ],
            cross_department_dependencies=[],
            questions_for_human_supervisor=["A question."],
            evidence_gaps=_compliant_evidence_gaps(),
        )


async def test_anchor_content_addition_advice_preserves_snapshot_and_failed_run_no_partial_guidance(
    client: AsyncClient, session: AsyncSession
) -> None:
    _, task_id, confirmed_revision, version_id = await _build_ready_shot(client)
    actor = ActorContext(actor_kind="human", actor_id="artist-1", human_role="artist")

    with pytest.raises(AgentGenerationError, match="bounded advisory scope"):
        await generate_artist_agent_guidance(
            session,
            actor,
            uuid.UUID(version_id),
            uuid.UUID(task_id),
            generator=_AnchorContentAdditionGenerator(confirmed_revision["id"]),
        )

    # ContextSnapshot preserved.
    snapshots = (await session.execute(select(ContextSnapshot))).scalars().all()
    assert len(snapshots) == 1

    # AgentRun marked failed, with a sanitised reason only.
    runs = (
        (await session.execute(select(AgentRun).where(AgentRun.capability == "iteration_guidance")))
        .scalars()
        .all()
    )
    assert len(runs) == 1
    assert runs[0].status == "failed"
    assert runs[0].error == (
        "Artist Agent guidance exceeded its bounded advisory scope: "
        "instructs adding content to an Anchor"
    )
    assert "permitted contrast range" not in (runs[0].error or "")
    assert "test-key-never-a-real-secret" not in (runs[0].error or "")
    assert "Authorization" not in (runs[0].error or "")

    # No ArtistAgentGuidance persisted.
    assert (await session.execute(select(ArtistAgentGuidance))).scalars().all() == []


async def test_missing_confirmed_execution_anchor_raises_conflict_at_service_level(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot_id = await _create_shot(client)
    await _create_brief(client, shot_id)
    await _confirm_core_anchor(client, shot_id)
    task_id = await _create_task(client, shot_id)
    version_id = await _create_version(client, shot_id)

    actor = ActorContext(actor_kind="human", actor_id="artist-1", human_role="artist")
    with pytest.raises(ConflictError):
        await generate_artist_agent_guidance(
            session, actor, uuid.UUID(version_id), uuid.UUID(task_id)
        )


# --- deterministic generator unit test ---


def test_deterministic_generator_produces_valid_output() -> None:
    generator: ArtistGuidanceGenerator = DeterministicArtistGuidanceGenerator()
    payload: dict[str, Any] = {
        "task": {"id": "t1", "name": "Lighting Pass", "department": "lighting"},
        "shot": {"id": "s1", "name": "SH010", "source": "manual"},
        "version": {
            "id": "v1",
            "name": "SH010_v001",
            "description": "First pass.",
            "created_at": "2026-01-01T00:00:00+00:00",
            "task_id": "t1",
            "review_notes": [
                {
                    "id": "rn1",
                    "content": "Slow the camera.",
                    "created_by_human_role": "vfx_supervisor",
                }
            ],
        },
        "execution_anchor": {
            "target_revision": {
                "id": "ea1",
                "revision_number": 1,
                "status": "confirmed",
                "technical_boundaries": "24fps.",
                "parameter_ranges": None,
                "allowed_refinements": None,
                "delivery_conditions": None,
                "downstream_dependencies": None,
                "escalation_conditions": None,
            }
        },
        "core_anchor": {
            "id": "ca1",
            "confirmed_revision": {
                "id": "car1",
                "status": "confirmed",
                "core_summary": "A quiet, controlled chase.",
                "constraints": [{"id": "c1", "content": "No jump cuts."}],
                "variation_zones": [{"id": "vz1", "content": "Camera speed may vary."}],
                "drift_risks": [],
                "open_questions": [],
            },
        },
        "vfx_supervisor_review": {
            "id": "vr1",
            "executive_summary": "Looks consistent.",
            "creative_concerns": [],
            "review_priorities": [],
            "proposed_feedback": [],
            "evidence_gaps": [],
        },
        "cg_supervisor_review": None,
        "intent_brief": None,
        "intent_decomposition": None,
        "context_reconstruction": None,
        "decisions": [],
        "core_anchor_human_gate": None,
        "execution_anchor_human_gate": None,
    }

    output = generator.generate(snapshot_payload=payload)
    assert output.executive_summary
    assert output.non_negotiables
    assert output.allowed_variations
    assert output.feedback_translations
    assert output.evidence_gaps


def test_deterministic_generator_converts_missing_execution_anchor_guidance_to_a_question() -> None:
    """Step 5 content-boundary hardening: when the Execution Anchor
    revision has no recorded technical guidance, the deterministic
    generator must surface that gap as a question asking the Human
    Artist to seek clarification from the Human CG Supervisor -- never
    as an instruction to add content to the Anchor.
    """
    generator = DeterministicArtistGuidanceGenerator()
    payload: dict[str, Any] = {
        "task": {"id": "t1", "name": "Lighting Pass", "department": "lighting"},
        "shot": {"id": "s1", "name": "SH010", "source": "manual"},
        "version": {
            "id": "v1",
            "name": "SH010_v001",
            "description": "First pass.",
            "created_at": "2026-01-01T00:00:00+00:00",
            "task_id": "t1",
            "review_notes": [],
        },
        "execution_anchor": {
            "target_revision": {
                "id": "ea1",
                "revision_number": 1,
                "status": "confirmed",
                "technical_boundaries": None,
                "parameter_ranges": None,
                "allowed_refinements": None,
                "delivery_conditions": None,
                "downstream_dependencies": None,
                "escalation_conditions": None,
            }
        },
        "core_anchor": None,
        "vfx_supervisor_review": None,
        "cg_supervisor_review": None,
        "intent_brief": None,
        "intent_decomposition": None,
        "context_reconstruction": None,
        "decisions": [],
        "core_anchor_human_gate": None,
        "execution_anchor_human_gate": None,
    }

    output = generator.generate(snapshot_payload=payload)

    clarification_questions = [
        q for q in output.questions_for_human_supervisor if "Human CG Supervisor" in q
    ]
    assert clarification_questions
    # Never an instruction to edit the Anchor.
    for question in clarification_questions:
        assert artist_guidance_service._forbidden_authority_reason(question) is None
    gaps_text = " ".join(output.evidence_gaps)
    assert "technical" in gaps_text.lower() or "guidance" in gaps_text.lower()
    artist_guidance_service._validate_content_boundaries(output)  # no raise


# --- bounded output contract ---


def test_artist_guidance_item_rejects_overlong_summary() -> None:
    # v2 bound pass: summary max_length is 200 (was 280).
    with pytest.raises(Exception):  # noqa: B017, PT011 -- pydantic ValidationError
        ArtistGuidanceItem(
            summary="x" * 201,
            why_it_matters="short",
            priority="low",
            evidence=[_evidence_ref()],
        )


def test_artist_guidance_item_rejects_empty_evidence() -> None:
    with pytest.raises(Exception):  # noqa: B017, PT011
        ArtistGuidanceItem(summary="short", why_it_matters="short", priority="low", evidence=[])


def test_artist_guidance_item_rejects_more_than_one_evidence_reference() -> None:
    # v2 bound pass: evidence max_length is exactly 1 (was up to 2) --
    # the single most direct token-budget lever behind the Step 7C-5
    # truncation fix.
    with pytest.raises(Exception):  # noqa: B017, PT011
        ArtistGuidanceItem(
            summary="short",
            why_it_matters="short",
            priority="low",
            evidence=[_evidence_ref(), _evidence_ref()],
        )


def test_artist_evidence_reference_rejects_unbounded_label() -> None:
    # v2 bound pass: `label` previously had no max_length at all -- the
    # root cause of the Step 7C-5 truncation (a verbose response could
    # grow this field without limit). Now capped at 140 characters.
    with pytest.raises(Exception):  # noqa: B017, PT011
        ArtistEvidenceReference(source_type="task", source_id="t1", label="x" * 141)


def test_artist_feedback_translation_rejects_more_than_one_evidence_reference() -> None:
    with pytest.raises(Exception):  # noqa: B017, PT011
        ArtistFeedbackTranslation(
            feedback_or_issue="short",
            practical_action="short",
            underlying_intent="short",
            self_check="short",
            priority="low",
            evidence=[_evidence_ref(), _evidence_ref()],
        )


def _base_item() -> ArtistGuidanceItem:
    return ArtistGuidanceItem(
        summary="short", why_it_matters="short", priority="low", evidence=[_evidence_ref()]
    )


@pytest.mark.parametrize(
    "field,limit",
    [
        # v2 bound pass: non_negotiables/allowed_variations/
        # iteration_priorities/questions_for_human_supervisor 3 -> 2;
        # evidence_gaps 5 -> 4 (kept at 4, not 3: the mandatory
        # inspection-boundary disclosure plus up to three independent
        # real gap conditions can genuinely co-occur -- see
        # ArtistAgentGuidanceOutput.evidence_gaps's own comment).
        # cross_department_dependencies is unchanged at 2.
        ("non_negotiables", 2),
        ("allowed_variations", 2),
        ("iteration_priorities", 2),
        ("cross_department_dependencies", 2),
        ("questions_for_human_supervisor", 2),
        ("evidence_gaps", 4),
    ],
)
def test_artist_agent_guidance_output_rejects_too_many_list_items(field: str, limit: int) -> None:
    base_item = _base_item()
    kwargs: dict[str, Any] = {
        "executive_summary": "short",
        "creative_intent_read": base_item,
        "task_goal": base_item,
        "current_iteration_read": base_item,
        "non_negotiables": [],
        "allowed_variations": [],
        "feedback_translations": [],
        "iteration_priorities": [],
        "cross_department_dependencies": [],
        "questions_for_human_supervisor": ["A question."],
        "evidence_gaps": ["ICAS has not directly inspected footage."],
    }
    if field in ("questions_for_human_supervisor", "evidence_gaps"):
        kwargs[field] = ["item"] * (limit + 1)
    else:
        kwargs[field] = [base_item] * (limit + 1)
    with pytest.raises(Exception):  # noqa: B017, PT011
        ArtistAgentGuidanceOutput(**kwargs)


def test_artist_agent_guidance_output_rejects_too_many_feedback_translations() -> None:
    # v2 bound pass: feedback_translations max_length is 2 (was 3).
    base_item = _base_item()
    translation = ArtistFeedbackTranslation(
        feedback_or_issue="short",
        practical_action="short",
        underlying_intent="short",
        self_check="short",
        priority="low",
        evidence=[_evidence_ref()],
    )
    with pytest.raises(Exception):  # noqa: B017, PT011
        ArtistAgentGuidanceOutput(
            executive_summary="short",
            creative_intent_read=base_item,
            task_goal=base_item,
            current_iteration_read=base_item,
            non_negotiables=[],
            allowed_variations=[],
            feedback_translations=[translation, translation, translation],
            iteration_priorities=[],
            cross_department_dependencies=[],
            questions_for_human_supervisor=["A question."],
            evidence_gaps=["ICAS has not directly inspected footage."],
        )


# --- content-boundary hardening ---


def _compliant_evidence_gaps() -> list[str]:
    return [
        "ICAS has not directly inspected footage, rendered frames, scene files, or numeric "
        "parameters for this Task."
    ]


def _make_output(
    *,
    evidence_gaps: list[str] | None = None,
    non_negotiables: list[ArtistGuidanceItem] | None = None,
    allowed_variations: list[ArtistGuidanceItem] | None = None,
    feedback_translations: list[ArtistFeedbackTranslation] | None = None,
    iteration_priorities: list[ArtistGuidanceItem] | None = None,
    cross_department_dependencies: list[ArtistGuidanceItem] | None = None,
    questions_for_human_supervisor: list[str] | None = None,
) -> ArtistAgentGuidanceOutput:
    base_item = _base_item()
    return ArtistAgentGuidanceOutput(
        executive_summary="short",
        creative_intent_read=base_item,
        task_goal=base_item,
        current_iteration_read=base_item,
        non_negotiables=non_negotiables or [],
        allowed_variations=allowed_variations or [],
        feedback_translations=feedback_translations or [],
        iteration_priorities=iteration_priorities or [],
        cross_department_dependencies=cross_department_dependencies or [],
        questions_for_human_supervisor=questions_for_human_supervisor or ["A question."],
        evidence_gaps=evidence_gaps if evidence_gaps is not None else _compliant_evidence_gaps(),
    )


def test_validate_content_boundaries_accepts_compliant_output() -> None:
    output = _make_output()
    artist_guidance_service._validate_content_boundaries(output)  # no raise


def test_validate_content_boundaries_rejects_missing_inspection_disclosure() -> None:
    output = _make_output(evidence_gaps=["No numeric contrast values are recorded."])
    with pytest.raises(AgentGenerationError, match="inspection boundary"):
        artist_guidance_service._validate_content_boundaries(output)


@pytest.mark.parametrize(
    "text",
    [
        "Please update the Core Anchor to reflect this variation.",
        "The Execution Anchor should be updated to allow this.",
        "Recommend the team re-anchor the shot before proceeding.",
        "You should confirm the gate now that this is resolved.",
        "We recommend confirming the pending HumanGate.",
        "Create a decision to formalise this change.",
        "This should officially pass review as the best overall Version.",
        # Step 5 content-boundary hardening: bounded indirect/add-content
        # Anchor-edit variants, plus HumanGate/Decision/Version-judgment
        # advice repeated here for the same parametrized coverage.
        "Add this range to the Execution Anchor before the next pass.",
        "Include this rule in the Core Anchor for future reference.",
        "Document the variation in the Execution Anchor so it is recorded.",
        "The Execution Anchor should specify the value the Artist needs.",
        "Populate the allowed_refinements field with this range.",
        "Revise the Anchor before submission to reflect this change.",
        "The team should reject the pending HumanGate immediately.",
        "Issue an authoritative decision approving this direction.",
        "This Version should officially fail review compared to the others.",
    ],
)
def test_forbidden_authority_reason_rejects_out_of_scope_instructions(text: str) -> None:
    assert artist_guidance_service._forbidden_authority_reason(text) is not None


@pytest.mark.parametrize(
    "text",
    [
        "This constraint was recorded on the confirmed Core Anchor revision.",
        "The Execution Anchor states the delivery format must stay unchanged.",
        "Coordinate with the Human CG Supervisor about this dependency.",
        "Ask the Human CG Supervisor to coordinate with the Human VFX Supervisor.",
        # Step 5 content-boundary hardening: citing either Anchor as
        # evidence, describing an Anchor as incomplete, asking the Human
        # Artist to contact the Human CG Supervisor, and a practical
        # Artist action that does not touch production authority must
        # all remain allowed.
        "The confirmed Execution Anchor states the delivery format must stay unchanged.",
        "The Core Anchor is missing a measurable range.",
        "Ask the Human CG Supervisor to clarify the missing range.",
        "Ask the Human Artist to contact the Human CG Supervisor about this gap.",
        "Reduce the camera shake back toward the confirmed restrained direction.",
        "Before submitting, confirm this review note has been addressed.",
    ],
)
def test_forbidden_authority_reason_allows_evidence_mentions_and_coordination(text: str) -> None:
    assert artist_guidance_service._forbidden_authority_reason(text) is None


def test_validate_content_boundaries_rejects_anchor_update_in_feedback_translation() -> None:
    output = _make_output(
        feedback_translations=[
            ArtistFeedbackTranslation(
                feedback_or_issue="short",
                practical_action="Update the Core Anchor to allow this variation.",
                underlying_intent="short",
                self_check="short",
                priority="low",
                evidence=[_evidence_ref()],
            )
        ]
    )
    with pytest.raises(AgentGenerationError, match="bounded advisory scope"):
        artist_guidance_service._validate_content_boundaries(output)


def test_validate_content_boundaries_rejects_reanchor_in_iteration_priorities() -> None:
    output = _make_output(
        iteration_priorities=[
            ArtistGuidanceItem(
                summary="short",
                why_it_matters="Recommend the team re-anchor the shot before proceeding.",
                priority="low",
                evidence=[_evidence_ref()],
            )
        ]
    )
    with pytest.raises(AgentGenerationError, match="bounded advisory scope"):
        artist_guidance_service._validate_content_boundaries(output)


def test_validate_content_boundaries_rejects_humangate_advice_in_questions() -> None:
    output = _make_output(questions_for_human_supervisor=["Should we confirm the gate right away?"])
    with pytest.raises(AgentGenerationError, match="bounded advisory scope"):
        artist_guidance_service._validate_content_boundaries(output)


def test_validate_content_boundaries_rejects_version_ranking_in_dependencies() -> None:
    output = _make_output(
        cross_department_dependencies=[
            ArtistGuidanceItem(
                summary="short",
                why_it_matters="This should be treated as the best overall Version.",
                priority="low",
                evidence=[_evidence_ref()],
            )
        ]
    )
    with pytest.raises(AgentGenerationError, match="bounded advisory scope"):
        artist_guidance_service._validate_content_boundaries(output)


def test_validate_content_boundaries_rejects_anchor_field_addition_in_non_negotiables() -> None:
    output = _make_output(
        non_negotiables=[
            ArtistGuidanceItem(
                summary="Populate the allowed_refinements field with this range.",
                why_it_matters="short",
                priority="low",
                evidence=[_evidence_ref()],
            )
        ]
    )
    with pytest.raises(AgentGenerationError, match="bounded advisory scope"):
        artist_guidance_service._validate_content_boundaries(output)


def test_validate_content_boundaries_rejects_anchor_addition_in_allowed_variations() -> None:
    output = _make_output(
        allowed_variations=[
            ArtistGuidanceItem(
                summary="short",
                why_it_matters="Include this rule in the Core Anchor for future reference.",
                priority="low",
                evidence=[_evidence_ref()],
            )
        ]
    )
    with pytest.raises(AgentGenerationError, match="bounded advisory scope"):
        artist_guidance_service._validate_content_boundaries(output)


def test_validate_content_boundaries_rejects_anchor_addition_in_self_check() -> None:
    output = _make_output(
        feedback_translations=[
            ArtistFeedbackTranslation(
                feedback_or_issue="short",
                practical_action="short",
                underlying_intent="short",
                self_check="Document the variation in the Execution Anchor before submitting.",
                priority="low",
                evidence=[_evidence_ref()],
            )
        ]
    )
    with pytest.raises(AgentGenerationError, match="bounded advisory scope"):
        artist_guidance_service._validate_content_boundaries(output)


def test_deterministic_generator_output_satisfies_content_boundaries() -> None:
    payload: dict[str, Any] = {
        "task": {"id": "t1", "name": "Lighting Pass", "department": "lighting"},
        "shot": {"id": "s1", "name": "SH010", "source": "manual"},
        "version": {
            "id": "v1",
            "name": "SH010_v001",
            "description": "First pass.",
            "created_at": "2026-01-01T00:00:00+00:00",
            "task_id": "t1",
            "review_notes": [],
        },
        "execution_anchor": {
            "target_revision": {
                "id": "ea1",
                "revision_number": 1,
                "status": "confirmed",
                "technical_boundaries": "24fps.",
                "parameter_ranges": None,
                "allowed_refinements": None,
                "delivery_conditions": None,
                "downstream_dependencies": None,
                "escalation_conditions": None,
            }
        },
        "core_anchor": None,
        "vfx_supervisor_review": None,
        "cg_supervisor_review": None,
        "intent_brief": None,
        "intent_decomposition": None,
        "context_reconstruction": None,
        "decisions": [],
        "core_anchor_human_gate": None,
        "execution_anchor_human_gate": None,
    }
    output = DeterministicArtistGuidanceGenerator().generate(snapshot_payload=payload)
    artist_guidance_service._validate_content_boundaries(output)  # no raise


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


_DEEPSEEK_FAKE_OUTPUT = ArtistAgentGuidanceOutput.model_validate(
    {
        "executive_summary": "One recorded constraint, one review note considered.",
        "creative_intent_read": {
            "summary": "This Shot's confirmed direction is a quiet, controlled chase.",
            "why_it_matters": "This is the Shot's currently confirmed Core Anchor revision.",
            "priority": "high",
            "evidence": [
                {"source_type": "core_anchor_revision", "source_id": "car1", "label": "Core Anchor"}
            ],
        },
        "task_goal": {
            "summary": "Task delivers against the confirmed Execution Anchor revision.",
            "why_it_matters": "This is the confirmed Execution Anchor revision for this Task.",
            "priority": "high",
            "evidence": [
                {
                    "source_type": "execution_anchor_revision",
                    "source_id": "ea1",
                    "label": "Execution Anchor",
                }
            ],
        },
        "current_iteration_read": {
            "summary": "This Version is one iteration toward the Task's goal.",
            "why_it_matters": "This is the target Version this guidance was generated for.",
            "priority": "medium",
            "evidence": [{"source_type": "version", "source_id": "v1", "label": "Version"}],
        },
        "non_negotiables": [],
        "allowed_variations": [],
        "feedback_translations": [],
        "iteration_priorities": [],
        "cross_department_dependencies": [],
        "questions_for_human_supervisor": [
            "Does the actual submitted work match this description?"
        ],
        "evidence_gaps": [
            "ICAS has not directly inspected footage, rendered frames, or scene files "
            "for this Task."
        ],
    }
)


def test_deepseek_adapter_makes_one_non_streaming_json_mode_call(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import openai

    monkeypatch.setattr(openai, "OpenAI", _FakeOpenAIClient)

    generator = DeepSeekArtistGuidanceGenerator(
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
    assert calls[0]["max_tokens"] == 6144


def test_deepseek_adapter_raises_agent_generation_error_on_empty_content(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import openai

    class _EmptyClient(_FakeOpenAIClient):
        def __init__(self, *, api_key: str, base_url: str) -> None:
            super().__init__(api_key=api_key, base_url=base_url)
            self.chat = _FakeChat(None)

    monkeypatch.setattr(openai, "OpenAI", _EmptyClient)
    generator = DeepSeekArtistGuidanceGenerator(api_key="k", model_name="deepseek-v4-flash")
    with pytest.raises(AgentGenerationError):
        generator.generate(snapshot_payload={"task": {"id": "t1"}})


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
            artist_guidance_service._get_generator()
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

    _, task_id, confirmed_revision, version_id = await _build_ready_shot(client)

    fake_output = ArtistAgentGuidanceOutput.model_validate(
        {
            "executive_summary": "Draft revision under review.",
            "creative_intent_read": {
                "summary": "Review against the target Execution Anchor revision.",
                "why_it_matters": "Directly stated on the target Execution Anchor revision.",
                "priority": "high",
                "evidence": [
                    {
                        "source_type": "execution_anchor_revision",
                        "source_id": confirmed_revision["id"],
                        "label": "Execution Anchor revision",
                    }
                ],
            },
            "task_goal": {
                "summary": "Task goal read.",
                "why_it_matters": "Directly stated on the target Execution Anchor revision.",
                "priority": "high",
                "evidence": [
                    {
                        "source_type": "execution_anchor_revision",
                        "source_id": confirmed_revision["id"],
                        "label": "Execution Anchor revision",
                    }
                ],
            },
            "current_iteration_read": {
                "summary": "Current iteration read.",
                "why_it_matters": "Directly stated on the target Execution Anchor revision.",
                "priority": "medium",
                "evidence": [
                    {
                        "source_type": "execution_anchor_revision",
                        "source_id": confirmed_revision["id"],
                        "label": "Execution Anchor revision",
                    }
                ],
            },
            "non_negotiables": [],
            "allowed_variations": [],
            "feedback_translations": [],
            "iteration_priorities": [],
            "cross_department_dependencies": [],
            "questions_for_human_supervisor": [
                "Does the actual submitted work match this description?"
            ],
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
        actor = ActorContext(actor_kind="human", actor_id="artist-1", human_role="artist")
        guidance = await generate_artist_agent_guidance(
            session, actor, uuid.UUID(version_id), uuid.UUID(task_id)
        )
    finally:
        monkeypatch.delenv("MODEL_PROVIDER", raising=False)
        monkeypatch.delenv("MODEL_API_KEY", raising=False)
        monkeypatch.delenv("MODEL_NAME", raising=False)
        get_settings.cache_clear()

    run = await session.get(AgentRun, guidance.agent_run_id)
    assert run is not None
    assert run.provider == "deepseek"
    assert run.model_name == "deepseek-v4-flash"
    assert run.prompt_version == "artist_iteration_guidance.v2"
    assert run.status == "succeeded"


def test_artist_prompt_declares_bounded_output_size_limits() -> None:
    from intent_core_api.agents import prompt_registry

    prompt = prompt_registry.get_registration("iteration_guidance").system_prompt
    assert "400 characters" in prompt
    assert "at most 2 non_negotiables" in prompt
    assert "hard-bounded by the response schema itself" in prompt


def test_artist_prompt_v2_forbids_quoting_anchor_content_and_bounds_evidence() -> None:
    """Step 7C-5 fix: the two new v2 instructions directly targeting the
    root cause of the real-provider truncation -- never restate/quote
    full Anchor field text (the likeliest source of unbounded growth),
    and exactly one evidence reference per item (was up to two)."""
    from intent_core_api.agents import prompt_registry

    prompt = prompt_registry.get_registration("iteration_guidance").system_prompt
    assert "restate the full text" in prompt.lower()
    assert "cite exactly one piece of evidence" in prompt.lower()
    assert (
        prompt_registry.get_registration("iteration_guidance").version_label
        == "artist_iteration_guidance.v2"
    )
