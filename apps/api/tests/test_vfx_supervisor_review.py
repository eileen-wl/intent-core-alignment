from __future__ import annotations

import uuid
from typing import Any

import pytest
from httpx import AsyncClient
from intent_core_api.agents import vfx_supervisor_review_service
from intent_core_api.agents.models import AgentRun
from intent_core_api.agents.vfx_supervisor_review_service import (
    DeepSeekVFXSupervisorReviewGenerator,
    DeterministicVFXSupervisorReviewGenerator,
    VFXSupervisorReviewGenerator,
    generate_vfx_supervisor_review,
)
from intent_core_api.integrations.models import WritebackRecord
from intent_core_api.intent.models import (
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
    VFXSupervisorReview,
)
from intent_core_api.workflow.actors import ActorContext, build_agent_actor
from intent_core_api.workflow.exceptions import AgentGenerationError, ForbiddenActionError
from intent_core_api.workflow.models import Decision
from intent_core_contracts.api.vfx_supervisor_review import VFXSupervisorReviewOutput
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

VFX = {"X-Actor-Role": "vfx_supervisor", "X-Actor-Id": "vfx-1"}
CG = {"X-Actor-Role": "cg_supervisor", "X-Actor-Id": "cg-1"}
ARTIST = {"X-Actor-Role": "artist", "X-Actor-Id": "artist-1"}

_SNAPSHOT_KEYS = {
    "project",
    "shot",
    "version",
    "intent_brief",
    "intent_decompositions",
    "core_anchor",
    "context_reconstruction",
    "alignment_assessment",
    "review_notes",
    "decisions",
    "tasks",
    "human_gate",
}

_FORBIDDEN_VISUAL_TERMS = (
    "lighting quality",
    "facial performance",
    "camera motion",
    "composition quality",
    "animation quality",
    "colour defect",
    "color defect",
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
                "variation_zones": [{"content": "Camera speed may vary slightly."}],
                "open_questions": [{"question": "Is the antagonist visible in frame?"}],
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


async def _confirm_execution_anchor(client: AsyncClient, task_id: str) -> dict[str, Any]:
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


async def _create_version_with_note_and_accepted_assessment(
    client: AsyncClient, shot_id: str
) -> str:
    version = (
        await client.post(
            "/versions",
            json={"shot_id": shot_id, "name": "SH010_v001", "description": "First pass."},
            headers=VFX,
        )
    ).json()
    version_id = str(version["id"])
    await client.post(
        f"/versions/{version_id}/review-notes",
        json={"content": "Please slow the camera down."},
        headers=VFX,
    )
    assessment = (
        await client.post(f"/versions/{version_id}/assessments/generate", headers=VFX)
    ).json()
    accept = await client.post(f"/assessments/{assessment['id']}/accept", json={}, headers=VFX)
    assert accept.status_code == 201
    return version_id


async def _build_full_context_shot_and_version(client: AsyncClient) -> tuple[str, str]:
    shot_id = await _create_shot(client)
    await _create_brief(client, shot_id)
    await client.post(f"/intent/shots/{shot_id}/intent-decompositions/generate", headers=VFX)
    await _confirm_core_anchor(client, shot_id)
    task_id = await _create_task(client, shot_id)
    await _confirm_execution_anchor(client, task_id)
    version_id = await _create_version_with_note_and_accepted_assessment(client, shot_id)
    return shot_id, version_id


# --- generation + structured output ---


async def test_generate_creates_review_with_expected_shape(client: AsyncClient) -> None:
    shot_id, version_id = await _build_full_context_shot_and_version(client)

    response = await client.post(
        f"/intent/versions/{version_id}/vfx-supervisor-reviews/generate", headers=VFX
    )
    assert response.status_code == 201
    body = response.json()

    assert body["version_id"] == version_id
    assert body["shot_id"] == shot_id
    output = body["review_output"]
    assert output["executive_summary"]
    direction = output["creative_direction_read"]
    assert direction["summary"]
    assert direction["rationale"]
    assert direction["priority"] in ("low", "medium", "high")
    assert direction["evidence"]
    for list_key in ("strengths", "creative_concerns", "review_priorities"):
        for item in output[list_key]:
            assert item["summary"]
            assert item["rationale"]
            assert item["priority"] in ("low", "medium", "high")
            assert item["evidence"]
    for note in output["proposed_feedback_notes"]:
        assert note["feedback"]
        assert note["underlying_intent"]
        assert note["priority"] in ("low", "medium", "high")
        assert note["evidence"]
    assert output["evidence_gaps"]


async def test_generate_creates_succeeded_agent_run_with_expected_capability(
    client: AsyncClient, session: AsyncSession
) -> None:
    _, version_id = await _build_full_context_shot_and_version(client)

    body = (
        await client.post(
            f"/intent/versions/{version_id}/vfx-supervisor-reviews/generate", headers=VFX
        )
    ).json()

    run = (await client.get(f"/intent/agent-runs/{body['agent_run_id']}")).json()
    assert run["status"] == "succeeded"
    assert run["agent_type"] == "vfx_supervisor_agent"
    assert run["capability"] == "creative_review"
    assert run["provider"] == "deterministic"
    assert run["model_name"] is None
    assert run["prompt_version"] is None
    assert run["result_revision_id"] is None
    assert run["error"] is None
    assert run["completed_at"] is not None

    capability_query = select(AgentRun).where(AgentRun.capability == "creative_review")
    runs = (await session.execute(capability_query)).scalars().all()
    assert len(runs) == 1


def test_prompt_registry_entry_is_registered() -> None:
    from intent_core_api.agents import prompt_registry

    registration = prompt_registry.get_registration("creative_review")
    assert registration.agent_type == "vfx_supervisor_agent"
    assert registration.capability == "creative_review"
    assert registration.prompt_key == "vfx_supervisor_creative_review"
    assert registration.version == "v1"
    assert registration.version_label == "vfx_supervisor_creative_review.v1"
    assert registration.output_model is VFXSupervisorReviewOutput


async def test_context_snapshot_contains_only_target_version_and_relevant_evidence(
    client: AsyncClient,
) -> None:
    shot_id, version_id = await _build_full_context_shot_and_version(client)

    body = (
        await client.post(
            f"/intent/versions/{version_id}/vfx-supervisor-reviews/generate", headers=VFX
        )
    ).json()

    snapshot = (await client.get(f"/intent/context-snapshots/{body['context_snapshot_id']}")).json()
    payload = snapshot["payload"]

    assert set(payload.keys()) == _SNAPSHOT_KEYS
    assert payload["shot"]["id"] == shot_id
    assert payload["version"]["id"] == version_id
    assert payload["intent_brief"] is not None
    assert len(payload["intent_decompositions"]) == 1
    assert payload["core_anchor"]["confirmed_revision"] is not None
    assert payload["alignment_assessment"] is not None
    assert payload["review_notes"]
    assert payload["decisions"]
    assert len(payload["tasks"]) == 1
    assert payload["human_gate"] is not None
    assert payload["human_gate"]["status"] == "confirmed"
    # no binary media, no raw ftrack payloads, no secrets
    payload_text = str(payload)
    for banned in ("api_key", "password", "Authorization"):
        assert banned not in payload_text


def _collect_real_ids(payload: dict[str, Any]) -> set[str]:
    ids: set[str] = {payload["project"]["id"], payload["shot"]["id"], payload["version"]["id"]}
    if payload["intent_brief"] is not None:
        ids.add(payload["intent_brief"]["id"])
    for decomposition in payload["intent_decompositions"]:
        ids.add(decomposition["id"])
    core_anchor = payload["core_anchor"]
    if core_anchor is not None:
        ids.add(core_anchor["id"])
        for key in ("confirmed_revision", "draft_revision"):
            revision = core_anchor[key]
            if revision is None:
                continue
            ids.add(revision["id"])
            for collection in (
                "constraints",
                "variation_zones",
                "drift_risks",
                "references",
                "open_questions",
            ):
                for item in revision[collection]:
                    ids.add(item["id"])
    if payload["context_reconstruction"] is not None:
        ids.add(payload["context_reconstruction"]["id"])
    if payload["alignment_assessment"] is not None:
        ids.add(payload["alignment_assessment"]["id"])
    for note in payload["review_notes"]:
        ids.add(note["id"])
    for decision in payload["decisions"]:
        ids.add(decision["id"])
    for task in payload["tasks"]:
        ids.add(task["id"])
        if task["active_execution_anchor_revision"] is not None:
            ids.add(task["active_execution_anchor_revision"]["id"])
    return ids


async def test_evidence_references_point_to_ids_in_snapshot(client: AsyncClient) -> None:
    _, version_id = await _build_full_context_shot_and_version(client)

    body = (
        await client.post(
            f"/intent/versions/{version_id}/vfx-supervisor-reviews/generate", headers=VFX
        )
    ).json()
    snapshot = (await client.get(f"/intent/context-snapshots/{body['context_snapshot_id']}")).json()
    real_ids = _collect_real_ids(snapshot["payload"])

    output = body["review_output"]
    items = [
        output["creative_direction_read"],
        *output["strengths"],
        *output["creative_concerns"],
        *output["review_priorities"],
    ]
    for item in items:
        for evidence in item["evidence"]:
            assert evidence["source_id"] in real_ids
    for note in output["proposed_feedback_notes"]:
        for evidence in note["evidence"]:
            assert evidence["source_id"] in real_ids


async def test_missing_media_represented_honestly_in_evidence_gaps(client: AsyncClient) -> None:
    _, version_id = await _build_full_context_shot_and_version(client)

    body = (
        await client.post(
            f"/intent/versions/{version_id}/vfx-supervisor-reviews/generate", headers=VFX
        )
    ).json()

    evidence_gaps_text = " ".join(body["review_output"]["evidence_gaps"]).lower()
    assert "media" in evidence_gaps_text or "image" in evidence_gaps_text


async def test_no_unsupported_visual_observation(client: AsyncClient) -> None:
    _, version_id = await _build_full_context_shot_and_version(client)

    body = (
        await client.post(
            f"/intent/versions/{version_id}/vfx-supervisor-reviews/generate", headers=VFX
        )
    ).json()

    output_text = str(body["review_output"]).lower()
    for banned in _FORBIDDEN_VISUAL_TERMS:
        assert banned not in output_text


# --- multiple runs / read endpoints ---


async def test_multiple_runs_create_multiple_immutable_reviews(client: AsyncClient) -> None:
    _, version_id = await _build_full_context_shot_and_version(client)

    first = (
        await client.post(
            f"/intent/versions/{version_id}/vfx-supervisor-reviews/generate", headers=VFX
        )
    ).json()
    second = (
        await client.post(
            f"/intent/versions/{version_id}/vfx-supervisor-reviews/generate", headers=VFX
        )
    ).json()

    assert first["id"] != second["id"]
    assert first["agent_run_id"] != second["agent_run_id"]
    assert first["context_snapshot_id"] != second["context_snapshot_id"]


async def test_get_and_list_endpoints_newest_first(client: AsyncClient) -> None:
    _, version_id = await _build_full_context_shot_and_version(client)

    first = (
        await client.post(
            f"/intent/versions/{version_id}/vfx-supervisor-reviews/generate", headers=VFX
        )
    ).json()
    second = (
        await client.post(
            f"/intent/versions/{version_id}/vfx-supervisor-reviews/generate", headers=VFX
        )
    ).json()

    get_response = await client.get(f"/intent/vfx-supervisor-reviews/{first['id']}")
    assert get_response.status_code == 200
    assert get_response.json() == first

    list_response = await client.get(f"/intent/versions/{version_id}/vfx-supervisor-reviews")
    assert list_response.status_code == 200
    listed = list_response.json()
    assert [r["id"] for r in listed] == [second["id"], first["id"]]


async def test_get_unknown_review_returns_404(client: AsyncClient) -> None:
    response = await client.get(
        "/intent/vfx-supervisor-reviews/00000000-0000-0000-0000-000000000000"
    )
    assert response.status_code == 404


async def test_all_three_human_roles_may_read(client: AsyncClient) -> None:
    _, version_id = await _build_full_context_shot_and_version(client)
    generated = (
        await client.post(
            f"/intent/versions/{version_id}/vfx-supervisor-reviews/generate", headers=VFX
        )
    ).json()

    for headers in (VFX, CG, ARTIST):
        get_response = await client.get(
            f"/intent/vfx-supervisor-reviews/{generated['id']}", headers=headers
        )
        assert get_response.status_code == 200
        list_response = await client.get(
            f"/intent/versions/{version_id}/vfx-supervisor-reviews", headers=headers
        )
        assert list_response.status_code == 200


# --- authority ---


async def test_cg_supervisor_and_artist_cannot_generate(client: AsyncClient) -> None:
    _, version_id = await _build_full_context_shot_and_version(client)

    for headers in (CG, ARTIST):
        response = await client.post(
            f"/intent/versions/{version_id}/vfx-supervisor-reviews/generate", headers=headers
        )
        assert response.status_code == 403


async def test_generate_returns_404_for_unknown_version(client: AsyncClient) -> None:
    response = await client.post(
        "/intent/versions/00000000-0000-0000-0000-000000000000/vfx-supervisor-reviews/generate",
        headers=VFX,
    )
    assert response.status_code == 404


async def test_agent_actor_cannot_generate_at_service_level(session: AsyncSession) -> None:
    agent = build_agent_actor("vfx_supervisor_agent", uuid.uuid4())
    with pytest.raises(ForbiddenActionError):
        await generate_vfx_supervisor_review(session, agent, uuid.uuid4())


# --- no side effects ---


async def test_generation_creates_no_side_effects_on_other_domain_objects(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot_id, version_id = await _build_full_context_shot_and_version(client)

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
        f"/intent/versions/{version_id}/vfx-supervisor-reviews/generate", headers=VFX
    )
    assert response.status_code == 201

    after = await _counts()
    assert before == after

    agent_types = (await session.execute(select(AgentRun.agent_type).distinct())).scalars().all()
    # core_agent AgentRuns already exist from the decomposition/assessment
    # fixture setup above -- the new run must add vfx_supervisor_agent
    # without ever creating a cg_supervisor_agent or artist_agent run.
    assert "vfx_supervisor_agent" in set(agent_types)
    assert "cg_supervisor_agent" not in set(agent_types)
    assert "artist_agent" not in set(agent_types)

    reviews = (
        (
            await session.execute(
                select(VFXSupervisorReview).where(
                    VFXSupervisorReview.version_id == uuid.UUID(version_id)
                )
            )
        )
        .scalars()
        .all()
    )
    assert len(reviews) == 1
    assert str(reviews[0].shot_id) == shot_id


# --- failure handling ---


class _FailingGenerator:
    def generate(self, *, snapshot_payload: dict[str, Any]) -> VFXSupervisorReviewOutput:
        raise RuntimeError("simulated provider timeout")


async def test_provider_failure_leaves_failed_run_and_no_review(
    client: AsyncClient, session: AsyncSession
) -> None:
    _, version_id = await _build_full_context_shot_and_version(client)
    actor = ActorContext(actor_kind="human", actor_id="vfx-1", human_role="vfx_supervisor")

    with pytest.raises(AgentGenerationError):
        await generate_vfx_supervisor_review(
            session, actor, uuid.UUID(version_id), generator=_FailingGenerator()
        )

    capability_query = select(AgentRun).where(AgentRun.capability == "creative_review")
    runs = (await session.execute(capability_query)).scalars().all()
    assert len(runs) == 1
    assert runs[0].status == "failed"
    assert "simulated provider timeout" in (runs[0].error or "")

    assert (await session.execute(select(VFXSupervisorReview))).scalars().all() == []


class _InventedEvidenceGenerator:
    """Returns an otherwise-valid output whose evidence cites an id that
    does not exist in the supplied snapshot -- must be rejected before
    any VFXSupervisorReview row is persisted.
    """

    def generate(self, *, snapshot_payload: dict[str, Any]) -> VFXSupervisorReviewOutput:
        from intent_core_contracts.api.vfx_supervisor_review import (
            VFXReviewEvidenceReference,
            VFXReviewItem,
        )

        invented_evidence = [
            VFXReviewEvidenceReference(
                source_type="version", source_id="not-a-real-id", label="Invented"
            )
        ]
        item = VFXReviewItem(
            summary="Invented summary.",
            rationale="Invented rationale.",
            priority="low",
            evidence=invented_evidence,
        )
        return VFXSupervisorReviewOutput(
            executive_summary="Invented summary.",
            creative_direction_read=item,
            strengths=[],
            creative_concerns=[],
            review_priorities=[],
            proposed_feedback_notes=[],
            questions_for_human_supervisor=["A question."],
            evidence_gaps=["No media evidence is available."],
        )


async def test_validation_failure_creates_no_partial_review(
    client: AsyncClient, session: AsyncSession
) -> None:
    _, version_id = await _build_full_context_shot_and_version(client)
    actor = ActorContext(actor_kind="human", actor_id="vfx-1", human_role="vfx_supervisor")

    with pytest.raises(AgentGenerationError, match="not present in this Version's ContextSnapshot"):
        await generate_vfx_supervisor_review(
            session, actor, uuid.UUID(version_id), generator=_InventedEvidenceGenerator()
        )

    capability_query = select(AgentRun).where(AgentRun.capability == "creative_review")
    runs = (await session.execute(capability_query)).scalars().all()
    assert len(runs) == 1
    assert runs[0].status == "failed"
    assert (await session.execute(select(VFXSupervisorReview))).scalars().all() == []


# --- deterministic generator unit test ---


def test_deterministic_generator_produces_valid_output() -> None:
    generator: VFXSupervisorReviewGenerator = DeterministicVFXSupervisorReviewGenerator()
    payload: dict[str, Any] = {
        "project": {"id": "p1", "name": "Demo"},
        "shot": {"id": "s1", "name": "SH010", "source": "manual"},
        "version": {
            "id": "v1",
            "name": "SH010_v001",
            "version_number": 1,
            "description": "First pass.",
            "source": "manual",
            "created_at": "2026-01-01T00:00:00",
        },
        "intent_brief": {"id": "b1", "raw_text": "A restrained, cinematic chase scene."},
        "intent_decompositions": [],
        "core_anchor": None,
        "context_reconstruction": None,
        "alignment_assessment": None,
        "review_notes": [],
        "decisions": [],
        "tasks": [],
        "human_gate": None,
    }
    first = generator.generate(snapshot_payload=payload)
    second = generator.generate(snapshot_payload=payload)
    assert first == second
    assert first.creative_direction_read.evidence[0].source_id == "s1"
    assert first.strengths == []
    assert any("media" in gap.lower() for gap in first.evidence_gaps)


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


_DEEPSEEK_FAKE_OUTPUT = VFXSupervisorReviewOutput.model_validate(
    {
        "executive_summary": "A restrained chase, one constraint to verify.",
        "creative_direction_read": {
            "summary": "Review against the confirmed Core Anchor.",
            "rationale": "Directly stated in the confirmed Core Anchor.",
            "priority": "high",
            "evidence": [
                {"source_type": "core_anchor_revision", "source_id": "r1", "label": "Anchor"}
            ],
        },
        "strengths": [],
        "creative_concerns": [],
        "review_priorities": [],
        "proposed_feedback_notes": [],
        "questions_for_human_supervisor": ["Does the media match the recorded description?"],
        "evidence_gaps": ["No image, video, or frame evidence is available to this Agent."],
    }
)

_DEEPSEEK_TEST_SNAPSHOT_PAYLOAD: dict[str, Any] = {
    "project": {"id": "p1", "name": "Demo"},
    "shot": {"id": "s1", "name": "SH010", "source": "manual"},
    "version": {"id": "v1", "name": "SH010_v001"},
    "intent_brief": {"id": "b1", "raw_text": "A restrained, cinematic chase scene."},
    "intent_decompositions": [],
    "core_anchor": None,
    "context_reconstruction": None,
    "alignment_assessment": None,
    "review_notes": [],
    "decisions": [],
    "tasks": [],
    "human_gate": None,
}


def test_deepseek_adapter_makes_one_non_streaming_json_mode_call(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import openai

    monkeypatch.setattr(openai, "OpenAI", _FakeOpenAIClient)

    generator = DeepSeekVFXSupervisorReviewGenerator(
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

    generator = DeepSeekVFXSupervisorReviewGenerator(api_key="k", model_name="deepseek-v4-flash")

    with pytest.raises(AgentGenerationError):
        generator.generate(snapshot_payload=_DEEPSEEK_TEST_SNAPSHOT_PAYLOAD)


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
            vfx_supervisor_review_service._get_generator()
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

    shot_id = await _create_shot(client)
    await _create_brief(client, shot_id)
    version = (
        await client.post(
            "/versions",
            json={"shot_id": shot_id, "name": "SH010_v001", "description": "First pass."},
            headers=VFX,
        )
    ).json()
    version_id = str(version["id"])

    # Evidence must resolve to this specific run's own snapshot -- cite
    # the one real id this test actually knows ahead of time (the
    # Version itself), rather than the shared cross-test fake constant.
    fake_output = VFXSupervisorReviewOutput.model_validate(
        {
            "executive_summary": "First pass under review.",
            "creative_direction_read": {
                "summary": "Review against the intent brief; no confirmed Core Anchor yet.",
                "rationale": "No confirmed Core Anchor revision exists for this Shot.",
                "priority": "high",
                "evidence": [
                    {"source_type": "version", "source_id": version_id, "label": "Version"}
                ],
            },
            "strengths": [],
            "creative_concerns": [],
            "review_priorities": [],
            "proposed_feedback_notes": [],
            "questions_for_human_supervisor": ["Does the media match the recorded description?"],
            "evidence_gaps": ["No image, video, or frame evidence is available to this Agent."],
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
        actor = ActorContext(actor_kind="human", actor_id="vfx-1", human_role="vfx_supervisor")
        review = await generate_vfx_supervisor_review(session, actor, uuid.UUID(version_id))
    finally:
        monkeypatch.delenv("MODEL_PROVIDER", raising=False)
        monkeypatch.delenv("MODEL_API_KEY", raising=False)
        monkeypatch.delenv("MODEL_NAME", raising=False)
        get_settings.cache_clear()

    run = await session.get(AgentRun, review.agent_run_id)
    assert run is not None
    assert run.provider == "deepseek"
    assert run.model_name == "deepseek-v4-flash"
    assert run.prompt_version == "vfx_supervisor_creative_review.v1"
    assert run.status == "succeeded"
