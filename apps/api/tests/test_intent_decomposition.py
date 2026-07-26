from __future__ import annotations

import uuid
from typing import Any

import pytest
from httpx import AsyncClient
from intent_core_api.agents import intent_decomposition_service
from intent_core_api.agents.intent_decomposition_service import (
    DeepSeekIntentDecompositionGenerator,
    DeterministicIntentDecompositionGenerator,
    IntentDecompositionGenerator,
    generate_intent_decomposition,
)
from intent_core_api.agents.models import AgentRun
from intent_core_api.integrations.models import WritebackRecord
from intent_core_api.intent.models import CoreAnchor, IntentDecomposition
from intent_core_api.workflow.actors import ActorContext
from intent_core_api.workflow.exceptions import (
    AgentGenerationError,
    ForbiddenActionError,
    NotFoundError,
)
from intent_core_contracts.api.intent_decomposition import (
    IntentDecompositionDimensions,
    IntentDecompositionOutput,
    IntentDimensionAnalysis,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

VFX = {"X-Actor-Role": "vfx_supervisor", "X-Actor-Id": "vfx-1"}
CG = {"X-Actor-Role": "cg_supervisor", "X-Actor-Id": "cg-1"}
ARTIST = {"X-Actor-Role": "artist", "X-Actor-Id": "artist-1"}

_DIMENSION_KEYS = (
    "emotional_tone",
    "visual_focus",
    "rhythm_and_intensity",
    "character_relationships",
    "narrative_priority",
    "technical_execution_requirements",
    "visual_detail_constraints",
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


async def _create_shot_with_brief(
    client: AsyncClient, raw_text: str = "A restrained, cinematic chase scene."
) -> str:
    shot_id = await _create_shot(client)
    await _create_brief(client, shot_id, raw_text)
    return shot_id


async def test_generate_creates_decomposition_with_all_seven_dimensions(
    client: AsyncClient,
) -> None:
    shot_id = await _create_shot_with_brief(client)

    response = await client.post(
        f"/intent/shots/{shot_id}/intent-decompositions/generate", headers=VFX
    )
    assert response.status_code == 201
    body = response.json()

    assert body["shot_id"] == shot_id
    assert body["core_intent_summary"]
    assert body["anchor_relevant_content"]
    assert set(body["dimensions"].keys()) == set(_DIMENSION_KEYS)
    for key in _DIMENSION_KEYS:
        assert body["dimensions"][key]["summary"]
        assert body["dimensions"][key]["rationale"]


async def test_candidate_constraints_and_variation_zones_present(client: AsyncClient) -> None:
    shot_id = await _create_shot_with_brief(client)

    body = (
        await client.post(f"/intent/shots/{shot_id}/intent-decompositions/generate", headers=VFX)
    ).json()

    assert body["candidate_constraints"]
    assert body["candidate_variation_zones"]
    assert body["contextual_information"]
    # A normal-length brief has sufficient context -- explicit empty list.
    assert body["uncertainties"] == []


async def test_uncertainties_present_for_very_short_brief(client: AsyncClient) -> None:
    shot_id = await _create_shot_with_brief(client, raw_text="Quiet.")

    body = (
        await client.post(f"/intent/shots/{shot_id}/intent-decompositions/generate", headers=VFX)
    ).json()

    assert body["uncertainties"] != []


async def test_generate_creates_context_snapshot_with_upstream_facts_only(
    client: AsyncClient,
) -> None:
    shot_id = await _create_shot_with_brief(client)

    body = (
        await client.post(f"/intent/shots/{shot_id}/intent-decompositions/generate", headers=VFX)
    ).json()

    snapshot = (await client.get(f"/intent/context-snapshots/{body['context_snapshot_id']}")).json()
    payload = snapshot["payload"]

    assert set(payload.keys()) == {"project", "shot", "intent_brief", "tasks"}
    assert payload["shot"]["id"] == shot_id
    assert payload["intent_brief"]["raw_text"] == "A restrained, cinematic chase scene."
    # Must not drift into Context Reconstruction scope.
    forbidden_keys = (
        "core_anchor",
        "confirmed_core_anchor_revision",
        "version",
        "review_notes",
        "assessments",
        "decisions",
        "execution_anchor",
    )
    for key in forbidden_keys:
        assert key not in payload


async def test_generate_creates_succeeded_agent_run_with_expected_capability(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot_id = await _create_shot_with_brief(client)

    body = (
        await client.post(f"/intent/shots/{shot_id}/intent-decompositions/generate", headers=VFX)
    ).json()

    run = (await client.get(f"/intent/agent-runs/{body['agent_run_id']}")).json()
    assert run["status"] == "succeeded"
    assert run["agent_type"] == "core_agent"
    assert run["capability"] == "intent_decomposition"
    assert run["provider"] == "deterministic"
    assert run["result_revision_id"] is None
    assert run["error"] is None
    assert run["completed_at"] is not None

    capability_query = select(AgentRun).where(AgentRun.capability == "intent_decomposition")
    runs = (await session.execute(capability_query)).scalars().all()
    assert len(runs) == 1


async def test_get_and_list_endpoints_newest_first(client: AsyncClient) -> None:
    shot_id = await _create_shot_with_brief(client)

    first = (
        await client.post(f"/intent/shots/{shot_id}/intent-decompositions/generate", headers=VFX)
    ).json()
    second = (
        await client.post(f"/intent/shots/{shot_id}/intent-decompositions/generate", headers=VFX)
    ).json()

    get_response = await client.get(f"/intent/intent-decompositions/{first['id']}")
    assert get_response.status_code == 200
    assert get_response.json() == first

    list_response = await client.get(f"/intent/shots/{shot_id}/intent-decompositions")
    assert list_response.status_code == 200
    listed = list_response.json()
    assert [d["id"] for d in listed] == [second["id"], first["id"]]


async def test_get_unknown_decomposition_returns_404(client: AsyncClient) -> None:
    response = await client.get(
        "/intent/intent-decompositions/00000000-0000-0000-0000-000000000000"
    )
    assert response.status_code == 404


async def test_multiple_runs_create_multiple_immutable_decompositions(
    client: AsyncClient,
) -> None:
    shot_id = await _create_shot_with_brief(client)

    first = (
        await client.post(f"/intent/shots/{shot_id}/intent-decompositions/generate", headers=VFX)
    ).json()
    second = (
        await client.post(f"/intent/shots/{shot_id}/intent-decompositions/generate", headers=VFX)
    ).json()

    assert first["id"] != second["id"]
    assert first["agent_run_id"] != second["agent_run_id"]
    assert first["context_snapshot_id"] != second["context_snapshot_id"]


async def test_cg_supervisor_and_artist_cannot_generate(client: AsyncClient) -> None:
    shot_id = await _create_shot_with_brief(client)

    for headers in (CG, ARTIST):
        response = await client.post(
            f"/intent/shots/{shot_id}/intent-decompositions/generate", headers=headers
        )
        assert response.status_code == 403


async def test_generate_returns_404_for_unknown_shot(client: AsyncClient) -> None:
    response = await client.post(
        "/intent/shots/00000000-0000-0000-0000-000000000000/intent-decompositions/generate",
        headers=VFX,
    )
    assert response.status_code == 404


async def test_generate_returns_404_when_shot_has_no_brief(client: AsyncClient) -> None:
    shot_id = await _create_shot(client)

    response = await client.post(
        f"/intent/shots/{shot_id}/intent-decompositions/generate", headers=VFX
    )
    assert response.status_code == 404


async def test_generation_creates_no_core_anchor_decision_or_writeback(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot_id = await _create_shot_with_brief(client)

    await client.post(f"/intent/shots/{shot_id}/intent-decompositions/generate", headers=VFX)

    assert (await session.execute(select(CoreAnchor))).scalars().all() == []
    assert (await session.execute(select(WritebackRecord))).scalars().all() == []


def test_deterministic_generator_meaningfully_differs_per_dimension() -> None:
    generator: IntentDecompositionGenerator = DeterministicIntentDecompositionGenerator()
    payload = {
        "shot": {"id": "s1", "name": "SH010", "source": "manual"},
        "project": {"id": "p1", "name": "Demo", "source": "manual"},
        "intent_brief": {
            "id": "b1",
            "raw_text": "A restrained, cinematic chase scene.",
            "source": "manual",
            "created_at": "2026-01-01T00:00:00",
        },
        "tasks": [],
    }
    first = generator.generate(snapshot_payload=payload)
    second = generator.generate(snapshot_payload=payload)
    assert first == second

    summaries = {getattr(first.dimensions, key).summary for key in _DIMENSION_KEYS}
    # Seven distinct summaries -- not seven identical placeholders.
    assert len(summaries) == 7


class _FailingGenerator:
    def generate(self, *, snapshot_payload: dict[str, Any]) -> IntentDecompositionOutput:
        raise RuntimeError("simulated provider timeout")


async def test_provider_failure_leaves_failed_run_and_no_decomposition(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot_id = await _create_shot_with_brief(client)
    actor = ActorContext(actor_kind="human", actor_id="vfx-1", human_role="vfx_supervisor")

    with pytest.raises(AgentGenerationError):
        await generate_intent_decomposition(
            session, actor, uuid.UUID(shot_id), generator=_FailingGenerator()
        )

    capability_query = select(AgentRun).where(AgentRun.capability == "intent_decomposition")
    runs = (await session.execute(capability_query)).scalars().all()
    assert len(runs) == 1
    assert runs[0].status == "failed"
    assert "simulated provider timeout" in (runs[0].error or "")

    assert (await session.execute(select(IntentDecomposition))).scalars().all() == []


async def test_agent_actor_cannot_generate_at_service_level(session: AsyncSession) -> None:
    from intent_core_api.workflow.actors import build_agent_actor

    agent = build_agent_actor("core_agent", uuid.uuid4())
    with pytest.raises(ForbiddenActionError):
        await generate_intent_decomposition(session, agent, uuid.uuid4())


async def test_generate_raises_not_found_for_unknown_shot_at_service_level(
    session: AsyncSession,
) -> None:
    actor = ActorContext(actor_kind="human", actor_id="vfx-1", human_role="vfx_supervisor")
    with pytest.raises(NotFoundError):
        await generate_intent_decomposition(session, actor, uuid.uuid4())


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


_DEEPSEEK_FAKE_OUTPUT = IntentDecompositionOutput(
    core_intent_summary="A restrained chase that never tips into spectacle.",
    anchor_relevant_content="Keep the chase grounded and character-led throughout.",
    dimensions=IntentDecompositionDimensions(
        emotional_tone=IntentDimensionAnalysis(
            summary="Restrained tension.",
            rationale="Brief emphasises restraint.",
        ),
        visual_focus=IntentDimensionAnalysis(
            summary="Character over environment.",
            rationale="Chase framed around the lead.",
        ),
        rhythm_and_intensity=IntentDimensionAnalysis(
            summary="Building, not explosive.",
            rationale="No spectacle language in brief.",
        ),
        character_relationships=IntentDimensionAnalysis(
            summary="Pursuer and pursued stay legible.",
            rationale="Brief names both.",
        ),
        narrative_priority=IntentDimensionAnalysis(
            summary="Escalating dread.",
            rationale="Central story beat.",
        ),
        technical_execution_requirements=IntentDimensionAnalysis(
            summary="Stable camera work.",
            rationale="Restraint implies control.",
        ),
        visual_detail_constraints=IntentDimensionAnalysis(
            summary="No lens flares or speed ramps.",
            rationale="Would break restraint.",
        ),
    ),
    candidate_constraints=["Preserve restrained camera movement."],
    candidate_variation_zones=["Lighting contrast may vary within reason."],
    contextual_information=["Brief was authored by the VFX Supervisor."],
    uncertainties=[],
)

_DEEPSEEK_TEST_SNAPSHOT_PAYLOAD = {
    "project": {"id": "p1", "name": "Demo", "source": "manual"},
    "shot": {"id": "s1", "name": "SH010", "source": "manual"},
    "intent_brief": {
        "id": "b1",
        "raw_text": "A restrained, cinematic chase scene.",
        "source": "manual",
        "created_at": "2026-01-01T00:00:00",
    },
    "tasks": [],
}


def test_deepseek_adapter_makes_one_non_streaming_json_mode_call(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import openai

    monkeypatch.setattr(openai, "OpenAI", _FakeOpenAIClient)

    generator = DeepSeekIntentDecompositionGenerator(
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

    generator = DeepSeekIntentDecompositionGenerator(api_key="k", model_name="deepseek-v4-flash")

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
            intent_decomposition_service._get_generator()
    finally:
        monkeypatch.delenv("MODEL_PROVIDER", raising=False)
        monkeypatch.delenv("MODEL_API_KEY", raising=False)
        monkeypatch.delenv("MODEL_NAME", raising=False)
        get_settings.cache_clear()
