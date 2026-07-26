from __future__ import annotations

import uuid
from typing import Any

import pytest
from httpx import AsyncClient
from intent_core_api.agents import context_reconstruction_service
from intent_core_api.agents.context_reconstruction_service import (
    ContextReconstructionGenerator,
    DeepSeekContextReconstructionGenerator,
    DeterministicContextReconstructionGenerator,
    generate_context_reconstruction,
)
from intent_core_api.agents.models import AgentRun
from intent_core_api.integrations.models import WritebackRecord
from intent_core_api.intent.models import (
    ContextReconstruction,
    CoreAnchor,
    CoreAnchorRevision,
    ExecutionAnchor,
    ExecutionAnchorRevision,
)
from intent_core_api.versions_and_feedback.models import AlignmentAssessment, ReviewNote, Version
from intent_core_api.workflow.actors import ActorContext
from intent_core_api.workflow.exceptions import AgentGenerationError, ForbiddenActionError
from intent_core_api.workflow.models import Decision
from intent_core_contracts.api.context_reconstruction import ContextReconstructionOutput
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

VFX = {"X-Actor-Role": "vfx_supervisor", "X-Actor-Id": "vfx-1"}
CG = {"X-Actor-Role": "cg_supervisor", "X-Actor-Id": "cg-1"}
ARTIST = {"X-Actor-Role": "artist", "X-Actor-Id": "artist-1"}

_SNAPSHOT_KEYS = {
    "project",
    "shot",
    "intent_brief",
    "intent_decompositions",
    "core_anchor",
    "execution_anchors",
    "decisions",
    "versions",
}


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


async def _create_shot_with_brief(
    client: AsyncClient, raw_text: str = "A restrained, cinematic chase scene."
) -> str:
    shot_id = await _create_shot(client)
    await _create_brief(client, shot_id, raw_text)
    return shot_id


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


async def _build_full_context_shot(client: AsyncClient) -> str:
    shot_id = await _create_shot_with_brief(client)
    await client.post(f"/intent/shots/{shot_id}/intent-decompositions/generate", headers=VFX)
    await _confirm_core_anchor(client, shot_id)
    task_id = await _create_task(client, shot_id)
    await _confirm_execution_anchor(client, task_id)
    await _create_version_with_note_and_accepted_assessment(client, shot_id)
    return shot_id


# --- generation + structured output ---


async def test_generate_creates_reconstruction_with_expected_shape(client: AsyncClient) -> None:
    shot_id = await _build_full_context_shot(client)

    response = await client.post(
        f"/intent/shots/{shot_id}/context-reconstructions/generate", headers=VFX
    )
    assert response.status_code == 201
    body = response.json()

    assert body["shot_id"] == shot_id
    context = body["reconstructed_context"]
    assert context["context_summary"]
    for item_key in (
        "original_intent",
        "current_creative_direction",
        "execution_context",
    ):
        item = context[item_key]
        assert item["summary"]
        assert item["rationale"]
        assert item["evidence"]
    for list_key in ("key_decisions", "active_constraints", "allowed_variations"):
        assert context[list_key]
        for item in context[list_key]:
            assert item["summary"]
            assert item["rationale"]
            assert item["evidence"]


async def test_generate_creates_succeeded_agent_run_with_expected_capability(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot_id = await _create_shot_with_brief(client)

    body = (
        await client.post(f"/intent/shots/{shot_id}/context-reconstructions/generate", headers=VFX)
    ).json()

    run = (await client.get(f"/intent/agent-runs/{body['agent_run_id']}")).json()
    assert run["status"] == "succeeded"
    assert run["agent_type"] == "core_agent"
    assert run["capability"] == "context_reconstruction"
    assert run["provider"] == "deterministic"
    assert run["result_revision_id"] is None
    assert run["error"] is None
    assert run["completed_at"] is not None

    capability_query = select(AgentRun).where(AgentRun.capability == "context_reconstruction")
    runs = (await session.execute(capability_query)).scalars().all()
    assert len(runs) == 1


async def test_context_snapshot_exact_input_scope(client: AsyncClient) -> None:
    shot_id = await _build_full_context_shot(client)

    body = (
        await client.post(f"/intent/shots/{shot_id}/context-reconstructions/generate", headers=VFX)
    ).json()

    snapshot = (await client.get(f"/intent/context-snapshots/{body['context_snapshot_id']}")).json()
    payload = snapshot["payload"]

    assert set(payload.keys()) == _SNAPSHOT_KEYS
    assert payload["shot"]["id"] == shot_id
    assert payload["intent_brief"] is not None
    assert len(payload["intent_decompositions"]) == 1
    assert payload["core_anchor"]["confirmed_revision"] is not None
    assert len(payload["execution_anchors"]) == 1
    assert len(payload["versions"]) == 1
    assert payload["versions"][0]["review_notes"]
    assert payload["decisions"]


def _collect_real_ids(payload: dict[str, Any]) -> set[str]:
    ids: set[str] = {payload["project"]["id"], payload["shot"]["id"]}
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
    for anchor in payload["execution_anchors"]:
        ids.add(anchor["id"])
        if anchor["active_revision"] is not None:
            ids.add(anchor["active_revision"]["id"])
    for decision in payload["decisions"]:
        ids.add(decision["id"])
    for version in payload["versions"]:
        ids.add(version["id"])
        for note in version["review_notes"]:
            ids.add(note["id"])
    return ids


async def test_evidence_references_point_to_ids_in_snapshot(client: AsyncClient) -> None:
    shot_id = await _build_full_context_shot(client)

    body = (
        await client.post(f"/intent/shots/{shot_id}/context-reconstructions/generate", headers=VFX)
    ).json()
    snapshot = (await client.get(f"/intent/context-snapshots/{body['context_snapshot_id']}")).json()
    real_ids = _collect_real_ids(snapshot["payload"])

    context = body["reconstructed_context"]
    items = [
        context["original_intent"],
        context["current_creative_direction"],
        context["execution_context"],
        *context["key_decisions"],
        *context["active_constraints"],
        *context["allowed_variations"],
        *context["unresolved_questions"],
    ]
    for item in items:
        for evidence in item["evidence"]:
            assert evidence["source_id"] in real_ids


async def test_missing_optional_facts_represented_honestly(client: AsyncClient) -> None:
    shot_id = await _create_shot(client)

    body = (
        await client.post(f"/intent/shots/{shot_id}/context-reconstructions/generate", headers=VFX)
    ).json()
    context = body["reconstructed_context"]

    assert context["context_gaps"]
    assert "no core anchor" in context["current_creative_direction"]["summary"].lower()
    assert context["key_decisions"] == []
    assert context["active_constraints"] == []
    assert context["allowed_variations"] == []


# --- multiple runs / read endpoints ---


async def test_multiple_runs_create_multiple_immutable_reconstructions(
    client: AsyncClient,
) -> None:
    shot_id = await _create_shot_with_brief(client)

    first = (
        await client.post(f"/intent/shots/{shot_id}/context-reconstructions/generate", headers=VFX)
    ).json()
    second = (
        await client.post(f"/intent/shots/{shot_id}/context-reconstructions/generate", headers=VFX)
    ).json()

    assert first["id"] != second["id"]
    assert first["agent_run_id"] != second["agent_run_id"]
    assert first["context_snapshot_id"] != second["context_snapshot_id"]


async def test_get_and_list_endpoints_newest_first(client: AsyncClient) -> None:
    shot_id = await _create_shot_with_brief(client)

    first = (
        await client.post(f"/intent/shots/{shot_id}/context-reconstructions/generate", headers=VFX)
    ).json()
    second = (
        await client.post(f"/intent/shots/{shot_id}/context-reconstructions/generate", headers=VFX)
    ).json()

    get_response = await client.get(f"/intent/context-reconstructions/{first['id']}")
    assert get_response.status_code == 200
    assert get_response.json() == first

    list_response = await client.get(f"/intent/shots/{shot_id}/context-reconstructions")
    assert list_response.status_code == 200
    listed = list_response.json()
    assert [r["id"] for r in listed] == [second["id"], first["id"]]


async def test_get_unknown_reconstruction_returns_404(client: AsyncClient) -> None:
    response = await client.get(
        "/intent/context-reconstructions/00000000-0000-0000-0000-000000000000"
    )
    assert response.status_code == 404


async def test_all_three_human_roles_may_read(client: AsyncClient) -> None:
    shot_id = await _create_shot_with_brief(client)
    generated = (
        await client.post(f"/intent/shots/{shot_id}/context-reconstructions/generate", headers=VFX)
    ).json()

    for headers in (VFX, CG, ARTIST):
        get_response = await client.get(
            f"/intent/context-reconstructions/{generated['id']}", headers=headers
        )
        assert get_response.status_code == 200
        list_response = await client.get(
            f"/intent/shots/{shot_id}/context-reconstructions", headers=headers
        )
        assert list_response.status_code == 200


# --- authority ---


async def test_cg_supervisor_and_artist_cannot_generate(client: AsyncClient) -> None:
    shot_id = await _create_shot_with_brief(client)

    for headers in (CG, ARTIST):
        response = await client.post(
            f"/intent/shots/{shot_id}/context-reconstructions/generate", headers=headers
        )
        assert response.status_code == 403


async def test_generate_returns_404_for_unknown_shot(client: AsyncClient) -> None:
    response = await client.post(
        "/intent/shots/00000000-0000-0000-0000-000000000000/context-reconstructions/generate",
        headers=VFX,
    )
    assert response.status_code == 404


async def test_agent_actor_cannot_generate_at_service_level(session: AsyncSession) -> None:
    from intent_core_api.workflow.actors import build_agent_actor

    agent = build_agent_actor("core_agent", uuid.uuid4())
    with pytest.raises(ForbiddenActionError):
        await generate_context_reconstruction(session, agent, uuid.uuid4())


# --- no side effects ---


async def test_generation_creates_no_side_effects_on_other_domain_objects(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot_id = await _build_full_context_shot(client)

    async def _counts() -> dict[str, int]:
        counts: dict[str, int] = {}
        for label, model in (
            ("core_anchors", CoreAnchor),
            ("core_anchor_revisions", CoreAnchorRevision),
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
        f"/intent/shots/{shot_id}/context-reconstructions/generate", headers=VFX
    )
    assert response.status_code == 201

    after = await _counts()
    assert before == after

    agent_types = (await session.execute(select(AgentRun.agent_type).distinct())).scalars().all()
    assert set(agent_types) == {"core_agent"}


# --- failure handling ---


class _FailingGenerator:
    def generate(self, *, snapshot_payload: dict[str, Any]) -> ContextReconstructionOutput:
        raise RuntimeError("simulated provider timeout")


async def test_provider_failure_leaves_failed_run_and_no_reconstruction(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot_id = await _create_shot_with_brief(client)
    actor = ActorContext(actor_kind="human", actor_id="vfx-1", human_role="vfx_supervisor")

    with pytest.raises(AgentGenerationError):
        await generate_context_reconstruction(
            session, actor, uuid.UUID(shot_id), generator=_FailingGenerator()
        )

    capability_query = select(AgentRun).where(AgentRun.capability == "context_reconstruction")
    runs = (await session.execute(capability_query)).scalars().all()
    assert len(runs) == 1
    assert runs[0].status == "failed"
    assert "simulated provider timeout" in (runs[0].error or "")

    assert (await session.execute(select(ContextReconstruction))).scalars().all() == []


# --- deterministic generator unit test ---


def test_deterministic_generator_produces_valid_output() -> None:
    generator: ContextReconstructionGenerator = DeterministicContextReconstructionGenerator()
    payload: dict[str, Any] = {
        "project": {"id": "p1", "name": "Demo"},
        "shot": {"id": "s1", "name": "SH010", "source": "manual"},
        "intent_brief": {"id": "b1", "raw_text": "A restrained, cinematic chase scene."},
        "intent_decompositions": [],
        "core_anchor": None,
        "execution_anchors": [],
        "decisions": [],
        "versions": [],
    }
    first = generator.generate(snapshot_payload=payload)
    second = generator.generate(snapshot_payload=payload)
    assert first == second
    assert first.original_intent.evidence[0].source_id == "b1"


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


_DEEPSEEK_FAKE_OUTPUT = ContextReconstructionOutput.model_validate(
    {
        "context_summary": "A restrained chase, no confirmed Anchor yet.",
        "original_intent": {
            "summary": "Restrained, character-led chase.",
            "rationale": "Directly stated in the Intent Brief.",
            "evidence": [{"source_type": "intent_brief", "source_id": "b1", "label": "Brief"}],
        },
        "current_creative_direction": {
            "summary": "No Core Anchor direction established yet.",
            "rationale": "No CoreAnchor row exists for this Shot.",
            "evidence": [{"source_type": "shot", "source_id": "s1", "label": "Shot"}],
        },
        "execution_context": {
            "summary": "No Execution Anchor context recorded yet.",
            "rationale": "No ExecutionAnchor rows exist.",
            "evidence": [{"source_type": "shot", "source_id": "s1", "label": "Shot"}],
        },
        "key_decisions": [],
        "active_constraints": [],
        "allowed_variations": [],
        "unresolved_questions": [],
        "context_gaps": ["No Core Anchor has been established for this Shot."],
    }
)

_DEEPSEEK_TEST_SNAPSHOT_PAYLOAD: dict[str, Any] = {
    "project": {"id": "p1", "name": "Demo"},
    "shot": {"id": "s1", "name": "SH010", "source": "manual"},
    "intent_brief": {"id": "b1", "raw_text": "A restrained, cinematic chase scene."},
    "intent_decompositions": [],
    "core_anchor": None,
    "execution_anchors": [],
    "decisions": [],
    "versions": [],
}


def test_deepseek_adapter_makes_one_non_streaming_json_mode_call(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import openai

    monkeypatch.setattr(openai, "OpenAI", _FakeOpenAIClient)

    generator = DeepSeekContextReconstructionGenerator(
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

    generator = DeepSeekContextReconstructionGenerator(api_key="k", model_name="deepseek-v4-flash")

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
            context_reconstruction_service._get_generator()
    finally:
        monkeypatch.delenv("MODEL_PROVIDER", raising=False)
        monkeypatch.delenv("MODEL_API_KEY", raising=False)
        monkeypatch.delenv("MODEL_NAME", raising=False)
        get_settings.cache_clear()
