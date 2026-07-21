from __future__ import annotations

import uuid
from typing import Any

import pytest
from httpx import AsyncClient
from intent_core_api.agents.alignment_assessment_service import (
    DeepSeekAlignmentAssessmentGenerator,
    generate_alignment_assessment,
)
from intent_core_api.agents.models import AgentRun, ContextSnapshot
from intent_core_api.integrations.models import WritebackRecord
from intent_core_api.intent.models import CoreAnchor, ExecutionAnchor
from intent_core_api.versions_and_feedback.models import AlignmentAssessment
from intent_core_api.workflow.exceptions import AgentGenerationError
from intent_core_api.workflow.models import Decision, WorkflowTransition
from intent_core_contracts.api.alignment_assessment import AlignmentAssessmentOutput
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

VFX = {"X-Actor-Role": "vfx_supervisor", "X-Actor-Id": "vfx-1"}


async def _create_shot_with_confirmed_core_anchor(client: AsyncClient) -> dict[str, str]:
    project = (
        await client.post(
            "/projects",
            json={"name": "Napo (Animation demo)", "source": "ftrack", "external_id": "ft-p-1"},
        )
    ).json()
    shot = (
        await client.post(
            "/shots",
            json={
                "project_id": project["id"],
                "name": "bc0040",
                "source": "ftrack",
                "external_id": "ft-s-1",
            },
        )
    ).json()
    await client.post(
        "/intent/briefs",
        json={"shot_id": shot["id"], "raw_text": "A restrained, cinematic chase."},
        headers=VFX,
    )
    draft = (await client.post(f"/intent/shots/{shot['id']}/core-anchor/generate")).json()
    confirmed = (
        await client.post(
            f"/intent/core-anchor-revisions/{draft['id']}/confirm", json={}, headers=VFX
        )
    ).json()
    return {"shot_id": shot["id"], "core_anchor_revision_id": confirmed["id"]}


async def _create_version_with_review_note(
    client: AsyncClient, shot_id: str, *, note_content: str = "The shake feels too aggressive."
) -> str:
    version = (
        await client.post(
            "/versions",
            json={
                "shot_id": shot_id,
                "name": "bc0040_render_v002",
                "version_number": 2,
                "description": "Increases camera shake and contrast in the final section.",
            },
            headers=VFX,
        )
    ).json()
    await client.post(
        f"/versions/{version['id']}/review-notes", json={"content": note_content}, headers=VFX
    )
    return str(version["id"])


async def test_generate_creates_one_snapshot_containing_anchor_version_and_notes(
    client: AsyncClient, session: AsyncSession
) -> None:
    ids = await _create_shot_with_confirmed_core_anchor(client)
    version_id = await _create_version_with_review_note(client, ids["shot_id"])

    response = await client.post(f"/versions/{version_id}/assessments/generate")
    assert response.status_code == 201
    assessment = response.json()

    snapshot_response = await client.get(
        f"/intent/context-snapshots/{assessment['context_snapshot_id']}"
    )
    assert snapshot_response.status_code == 200
    payload = snapshot_response.json()["payload"]

    assert payload["confirmed_core_anchor_revision"]["id"] == ids["core_anchor_revision_id"]
    assert payload["confirmed_core_anchor_revision"]["revision_number"] == 1
    assert "core_summary" in payload["confirmed_core_anchor_revision"]
    assert payload["version"]["id"] == version_id
    assert payload["version"]["description"].startswith("Increases camera shake")
    assert len(payload["review_notes"]) == 1
    assert payload["review_notes"][0]["content"] == "The shake feels too aggressive."

    # Exactly one ContextSnapshot beyond the one _create_shot_with_confirmed_core_anchor's
    # own core_anchor_drafting call already created.
    snapshots = (await session.execute(select(ContextSnapshot))).scalars().all()
    assert len(snapshots) == 2


async def test_generate_creates_one_succeeded_agent_run_with_expected_capability(
    client: AsyncClient, session: AsyncSession
) -> None:
    ids = await _create_shot_with_confirmed_core_anchor(client)
    version_id = await _create_version_with_review_note(client, ids["shot_id"])

    assessment = (await client.post(f"/versions/{version_id}/assessments/generate")).json()

    run_response = await client.get(f"/intent/agent-runs/{assessment['agent_run_id']}")
    assert run_response.status_code == 200
    run = run_response.json()
    assert run["status"] == "succeeded"
    assert run["agent_type"] == "core_agent"
    assert run["capability"] == "alignment_assessment"
    assert run["provider"] == "deterministic"
    assert run["result_revision_id"] is None
    assert run["error"] is None
    assert run["completed_at"] is not None

    assessment_run_query = select(AgentRun).where(AgentRun.capability == "alignment_assessment")
    assessment_runs = (await session.execute(assessment_run_query)).scalars().all()
    assert len(assessment_runs) == 1


async def test_deterministic_output_links_correctly_and_requires_human_gate(
    client: AsyncClient,
) -> None:
    ids = await _create_shot_with_confirmed_core_anchor(client)
    version_id = await _create_version_with_review_note(client, ids["shot_id"])

    assessment = (await client.post(f"/versions/{version_id}/assessments/generate")).json()

    assert assessment["version_id"] == version_id
    assert assessment["core_anchor_revision_id"] == ids["core_anchor_revision_id"]
    assert assessment["alignment_state"] in (
        "aligned",
        "minor_drift",
        "significant_drift",
    )
    envelope = assessment["envelope"]
    assert envelope["requires_human_gate"] is True
    assert 0.0 <= envelope["confidence"] <= 1.0
    assert envelope["summary"]
    assert envelope["evidence"]

    get_response = await client.get(f"/assessments/{assessment['id']}")
    assert get_response.status_code == 200
    assert get_response.json() == assessment

    list_response = await client.get(f"/versions/{version_id}/assessments")
    assert list_response.status_code == 200
    assert [a["id"] for a in list_response.json()] == [assessment["id"]]


async def test_generate_fails_without_confirmed_core_anchor(client: AsyncClient) -> None:
    project = (await client.post("/projects", json={"name": "Demo"})).json()
    shot = (await client.post("/shots", json={"project_id": project["id"], "name": "SH010"})).json()
    version_id = await _create_version_with_review_note(client, shot["id"])

    response = await client.post(f"/versions/{version_id}/assessments/generate")
    assert response.status_code == 404


async def test_generate_fails_without_review_notes(client: AsyncClient) -> None:
    ids = await _create_shot_with_confirmed_core_anchor(client)
    version = (
        await client.post(
            "/versions",
            json={"shot_id": ids["shot_id"], "name": "v1", "description": "desc"},
            headers=VFX,
        )
    ).json()

    response = await client.post(f"/versions/{version['id']}/assessments/generate")
    assert response.status_code == 404


async def test_generate_for_unknown_version_returns_404(client: AsyncClient) -> None:
    unknown = "00000000-0000-0000-0000-000000000000"
    response = await client.post(f"/versions/{unknown}/assessments/generate")
    assert response.status_code == 404


class _FailingGenerator:
    def generate(self, *, snapshot_payload: dict[str, Any]) -> AlignmentAssessmentOutput:
        raise RuntimeError("simulated provider timeout")


async def test_provider_failure_leaves_failed_run_and_no_assessment(
    client: AsyncClient, session: AsyncSession
) -> None:
    ids = await _create_shot_with_confirmed_core_anchor(client)
    version_id = await _create_version_with_review_note(client, ids["shot_id"])

    with pytest.raises(AgentGenerationError):
        await generate_alignment_assessment(
            session, uuid.UUID(version_id), generator=_FailingGenerator()
        )

    assessment_run_query = select(AgentRun).where(AgentRun.capability == "alignment_assessment")
    runs = (await session.execute(assessment_run_query)).scalars().all()
    assert len(runs) == 1
    assert runs[0].status == "failed"
    assert "simulated provider timeout" in (runs[0].error or "")
    assert runs[0].completed_at is not None

    assessments = (await session.execute(select(AlignmentAssessment))).scalars().all()
    assert assessments == []


async def test_generating_again_creates_new_snapshot_run_and_assessment(
    client: AsyncClient, session: AsyncSession
) -> None:
    ids = await _create_shot_with_confirmed_core_anchor(client)
    version_id = await _create_version_with_review_note(client, ids["shot_id"])

    first = (await client.post(f"/versions/{version_id}/assessments/generate")).json()
    second = (await client.post(f"/versions/{version_id}/assessments/generate")).json()

    assert second["id"] != first["id"]
    assert second["context_snapshot_id"] != first["context_snapshot_id"]
    assert second["agent_run_id"] != first["agent_run_id"]

    assessment_run_query = select(AgentRun).where(AgentRun.capability == "alignment_assessment")
    assert len((await session.execute(assessment_run_query)).scalars().all()) == 2
    # One ContextSnapshot came from the setup helper's core_anchor_drafting
    # call; the other two from the two assessment-generation calls above.
    assert len((await session.execute(select(ContextSnapshot))).scalars().all()) == 3
    assert len((await session.execute(select(AlignmentAssessment))).scalars().all()) == 2


async def test_generation_touches_no_other_domain_state(
    client: AsyncClient, session: AsyncSession
) -> None:
    ids = await _create_shot_with_confirmed_core_anchor(client)
    version_id = await _create_version_with_review_note(client, ids["shot_id"])

    # Baseline: the setup helper itself confirms a Core Anchor revision,
    # which legitimately creates one Decision and one WorkflowTransition.
    # Assessment generation must add none of its own.
    decisions_before = (await session.execute(select(Decision))).scalars().all()
    transitions_before = (await session.execute(select(WorkflowTransition))).scalars().all()

    await client.post(f"/versions/{version_id}/assessments/generate")

    assert (await session.execute(select(ExecutionAnchor))).scalars().all() == []
    assert (await session.execute(select(WritebackRecord))).scalars().all() == []
    assert len((await session.execute(select(Decision))).scalars().all()) == len(decisions_before)
    assert len((await session.execute(select(WorkflowTransition))).scalars().all()) == len(
        transitions_before
    )

    # The one CoreAnchor created by _create_shot_with_confirmed_core_anchor,
    # and its confirmed revision, must be untouched by assessment generation.
    anchors = (await session.execute(select(CoreAnchor))).scalars().all()
    assert len(anchors) == 1
    assert str(anchors[0].active_revision_id) == ids["core_anchor_revision_id"]


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


_DEEPSEEK_FAKE_OUTPUT = AlignmentAssessmentOutput(
    alignment_state="significant_drift",
    summary="The added camera shake contradicts the confirmed restrained tone.",
    observations=["Review note flags the shake as too aggressive."],
    inferences=["The Version likely departs from the confirmed emotional tone."],
    evidence=["Review note: The shake feels too aggressive."],
    confidence=0.8,
    open_questions=[],
    recommended_actions=["Reduce camera shake to match the confirmed tone."],
    requires_human_gate=True,
)

_DEEPSEEK_TEST_SNAPSHOT_PAYLOAD = {
    "shot": {"id": "s1", "name": "bc0040", "source": "ftrack"},
    "confirmed_core_anchor_revision": {
        "id": "r1",
        "revision_number": 1,
        "core_summary": "A restrained, cinematic chase.",
    },
    "version": {
        "id": "v1",
        "name": "bc0040_render_v002",
        "description": "Increases camera shake.",
    },
    "review_notes": [{"id": "n1", "content": "The shake feels too aggressive."}],
}


def test_deepseek_adapter_makes_one_non_streaming_json_mode_call(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import openai

    monkeypatch.setattr(openai, "OpenAI", _FakeOpenAIClient)

    generator = DeepSeekAlignmentAssessmentGenerator(
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

    generator = DeepSeekAlignmentAssessmentGenerator(api_key="k", model_name="deepseek-v4-flash")

    with pytest.raises(AgentGenerationError):
        generator.generate(snapshot_payload=_DEEPSEEK_TEST_SNAPSHOT_PAYLOAD)


async def test_deepseek_provider_selection_requires_api_key_and_model_name(
    session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    from intent_core_api.agents import alignment_assessment_service
    from intent_core_api.config import get_settings

    get_settings.cache_clear()
    monkeypatch.setenv("MODEL_PROVIDER", "deepseek")
    monkeypatch.setenv("MODEL_API_KEY", "")
    monkeypatch.setenv("MODEL_NAME", "")
    get_settings.cache_clear()
    try:
        with pytest.raises(AgentGenerationError):
            alignment_assessment_service._get_generator()
    finally:
        monkeypatch.delenv("MODEL_PROVIDER", raising=False)
        monkeypatch.delenv("MODEL_API_KEY", raising=False)
        monkeypatch.delenv("MODEL_NAME", raising=False)
        get_settings.cache_clear()


async def test_unimplemented_provider_raises_agent_generation_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from intent_core_api.agents import alignment_assessment_service
    from intent_core_api.config import get_settings

    monkeypatch.setenv("MODEL_PROVIDER", "some_other_provider")
    get_settings.cache_clear()
    try:
        with pytest.raises(AgentGenerationError):
            alignment_assessment_service._get_generator()
    finally:
        monkeypatch.delenv("MODEL_PROVIDER", raising=False)
        get_settings.cache_clear()
