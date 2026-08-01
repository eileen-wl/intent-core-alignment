"""Step 7C-4 completion: the real DeepSeek ``execution_anchor_drafting``
capability adapter. Mirrors ``test_cg_supervisor_review.py``'s DeepSeek
coverage shape exactly (mocked SDK only -- never a real network request):
prompt registration, provider dispatch, one non-streaming JSON-mode call,
structured-output validation/failure handling, provenance recorded on the
AgentRun, draft-only persistence, and no silent fallback to the
deterministic generator when ``MODEL_PROVIDER=deepseek``.
"""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from httpx import AsyncClient
from intent_core_api.agents import cg_agent_service, prompt_registry
from intent_core_api.agents.cg_agent_service import (
    DeepSeekExecutionAnchorDraftGenerator,
    DeterministicExecutionAnchorDraftGenerator,
    ExecutionAnchorDraftGenerator,
    generate_execution_anchor_draft,
)
from intent_core_api.agents.models import AgentRun, ContextSnapshot
from intent_core_api.intent.models import ExecutionAnchorRevision
from intent_core_api.workflow.exceptions import AgentGenerationError
from intent_core_contracts.api.execution_anchor import ExecutionAnchorRevisionDraftCreate
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

VFX = {"X-Actor-Role": "vfx_supervisor", "X-Actor-Id": "vfx-1"}
CG = {"X-Actor-Role": "cg_supervisor", "X-Actor-Id": "cg-1"}


async def _build_task_with_confirmed_core_anchor(client: AsyncClient) -> tuple[str, str]:
    project = (await client.post("/projects", json={"name": "Demo Project"})).json()
    shot = (await client.post("/shots", json={"project_id": project["id"], "name": "SH010"})).json()
    task = (
        await client.post(
            "/tasks",
            json={"shot_id": shot["id"], "name": "Lighting Pass", "department": "lighting"},
        )
    ).json()
    core_draft = (
        await client.post(
            f"/intent/shots/{shot['id']}/core-anchor/drafts",
            json={
                "core_summary": "A restrained dusk confrontation.",
                "visual_focus": "Faces and stillness over movement.",
                "narrative_priority": "Preserve the restraint.",
                "emotional_tone": "Quiet, controlled tension.",
                "character_relationship": "Two people delaying the inevitable.",
                "rhythm_intensity": "Deliberate, unhurried.",
                "shot_objective": "Hold the confrontation restrained through to its climax.",
            },
            headers=VFX,
        )
    ).json()
    await client.post(
        f"/intent/core-anchor-revisions/{core_draft['id']}/confirm", json={}, headers=VFX
    )
    return shot["id"], task["id"]


# --- Prompt registration ----------------------------------------------------


def test_execution_anchor_drafting_prompt_is_registered() -> None:
    registration = prompt_registry.get_registration("execution_anchor_drafting")
    assert registration.agent_type == "cg_supervisor_agent"
    assert registration.prompt_key == "cg_execution_anchor_drafting"
    assert registration.version == "v1"
    assert registration.version_label == "cg_execution_anchor_drafting.v1"
    assert registration.output_model is ExecutionAnchorRevisionDraftCreate
    assert "technical_boundaries" in registration.system_prompt
    assert "escalation_conditions" in registration.system_prompt


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


_DEEPSEEK_FAKE_OUTPUT = ExecutionAnchorRevisionDraftCreate.model_validate(
    {
        "technical_boundaries": "24fps, contrast graded within the confirmed restrained range.",
        "parameter_ranges": "Contrast: -5% to +5% of the confirmed baseline grade.",
        "delivery_conditions": "Deliver at confirmed project resolution.",
        "production_ready_criteria": "Matches the confirmed Core Anchor's restrained direction.",
        "downstream_dependencies": "Final grade depends on this pass's contrast range.",
        "publish_requirements": "Requires VFX Supervisor review before publish.",
        "allowed_refinements": "Minor contrast trims within the stated range.",
        "escalation_conditions": "Escalate if contrast drift exceeds the stated range.",
    }
)

_DEEPSEEK_TEST_SNAPSHOT_PAYLOAD: dict[str, Any] = {
    "project": {"id": "p1", "name": "Demo"},
    "shot": {"id": "s1", "name": "SH010", "source": "manual"},
    "task": {"id": "t1", "name": "Lighting Pass", "source": "manual", "department": "lighting"},
    "core_anchor": {
        "id": "cr1",
        "revision_number": 1,
        "shot_objective": "Hold the confrontation restrained.",
        "emotional_tone": "Quiet, controlled tension.",
        "visual_focus": "Faces and stillness.",
        "rhythm_intensity": "Deliberate, unhurried.",
        "character_relationship": "Two people delaying the inevitable.",
        "narrative_priority": "Preserve the restraint.",
        "core_summary": "A restrained dusk confrontation.",
    },
}


def test_deepseek_adapter_makes_one_non_streaming_json_mode_call(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import openai

    monkeypatch.setattr(openai, "OpenAI", _FakeOpenAIClient)

    generator = DeepSeekExecutionAnchorDraftGenerator(
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

    generator = DeepSeekExecutionAnchorDraftGenerator(api_key="k", model_name="deepseek-v4-flash")

    with pytest.raises(AgentGenerationError):
        generator.generate(snapshot_payload=_DEEPSEEK_TEST_SNAPSHOT_PAYLOAD)


def test_deepseek_adapter_raises_agent_generation_error_on_malformed_json(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A response cut off mid-JSON-string must fail cleanly with a
    sanitised AgentGenerationError -- never the raw pydantic
    ValidationError, whose message embeds a snippet of the actual
    (possibly truncated) response content.
    """
    import openai

    truncated_content = '{\n  "technical_boundaries": "24fps, contrast graded wit'

    class _TruncatedContentClient(_FakeOpenAIClient):
        def __init__(self, *, api_key: str, base_url: str) -> None:
            super().__init__(api_key=api_key, base_url=base_url)
            self.chat = _FakeChat(truncated_content)

    monkeypatch.setattr(openai, "OpenAI", _TruncatedContentClient)

    generator = DeepSeekExecutionAnchorDraftGenerator(api_key="k", model_name="deepseek-v4-flash")

    with pytest.raises(AgentGenerationError) as excinfo:
        generator.generate(snapshot_payload=_DEEPSEEK_TEST_SNAPSHOT_PAYLOAD)

    message = str(excinfo.value)
    assert "validation" in message
    assert "finish_reason=" in message
    assert truncated_content not in message
    assert "technical_boundaries" not in message


# --- Provider dispatch --------------------------------------------------


def test_get_generator_returns_deterministic_by_default() -> None:
    assert isinstance(cg_agent_service._get_generator(), DeterministicExecutionAnchorDraftGenerator)


async def test_deepseek_provider_selection_requires_api_key_and_model_name(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from intent_core_api.config import get_settings

    get_settings.cache_clear()
    monkeypatch.setenv("MODEL_PROVIDER", "deepseek")
    monkeypatch.setenv("MODEL_API_KEY", "")
    monkeypatch.setenv("MODEL_NAME", "")
    get_settings.cache_clear()
    try:
        with pytest.raises(AgentGenerationError):
            cg_agent_service._get_generator()
    finally:
        monkeypatch.delenv("MODEL_PROVIDER", raising=False)
        monkeypatch.delenv("MODEL_API_KEY", raising=False)
        monkeypatch.delenv("MODEL_NAME", raising=False)
        get_settings.cache_clear()


async def test_unimplemented_provider_never_silently_falls_back_to_deterministic(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from intent_core_api.config import get_settings

    get_settings.cache_clear()
    monkeypatch.setenv("MODEL_PROVIDER", "some-other-provider")
    get_settings.cache_clear()
    try:
        with pytest.raises(AgentGenerationError):
            cg_agent_service._get_generator()
    finally:
        monkeypatch.delenv("MODEL_PROVIDER", raising=False)
        get_settings.cache_clear()


# --- End-to-end through generate_execution_anchor_draft ---------------------


async def test_generate_records_model_name_and_prompt_version_via_deepseek(
    client: AsyncClient, session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    import openai
    from intent_core_api.config import get_settings

    _shot_id, task_id = await _build_task_with_confirmed_core_anchor(client)

    monkeypatch.setattr(openai, "OpenAI", _FakeOpenAIClient)
    get_settings.cache_clear()
    monkeypatch.setenv("MODEL_PROVIDER", "deepseek")
    monkeypatch.setenv("MODEL_API_KEY", "test-key-never-a-real-secret")
    monkeypatch.setenv("MODEL_NAME", "deepseek-v4-flash")
    get_settings.cache_clear()
    try:
        revision = await generate_execution_anchor_draft(session, uuid.UUID(task_id))
    finally:
        monkeypatch.delenv("MODEL_PROVIDER", raising=False)
        monkeypatch.delenv("MODEL_API_KEY", raising=False)
        monkeypatch.delenv("MODEL_NAME", raising=False)
        get_settings.cache_clear()

    # Structured output mapping: only the supported Execution Anchor
    # fields, exactly the DeepSeek-returned content.
    assert revision.technical_boundaries == _DEEPSEEK_FAKE_OUTPUT.technical_boundaries
    assert revision.parameter_ranges == _DEEPSEEK_FAKE_OUTPUT.parameter_ranges
    assert revision.escalation_conditions == _DEEPSEEK_FAKE_OUTPUT.escalation_conditions

    # Provenance: actor/source is the CG Agent, never a human role.
    assert revision.created_by_actor_kind == "agent"
    assert revision.created_by_agent_type == "cg_supervisor_agent"
    assert revision.created_by_human_role is None

    # Draft-only: never auto-confirmed -- Human CG Supervisor confirmation
    # is still required and the ExecutionAnchor's active_revision_id must
    # remain unset.
    assert revision.status == "draft"
    anchor_response = await client.get(f"/intent/tasks/{task_id}/execution-anchor")
    assert anchor_response.json()["active_revision_id"] is None

    # ContextSnapshot + AgentRun provenance.
    run = await session.get(AgentRun, revision.created_by_agent_run_id)
    assert run is not None
    assert run.agent_type == "cg_supervisor_agent"
    assert run.capability == "execution_anchor_drafting"
    assert run.provider == "deepseek"
    assert run.model_name == "deepseek-v4-flash"
    assert run.prompt_version == "cg_execution_anchor_drafting.v1"
    assert run.status == "succeeded"
    # AgentRun.result_revision_id is narrowly FK'd to CoreAnchorRevision
    # only (see agents.models.AgentRun) -- setting it to an
    # ExecutionAnchorRevision id would violate that FK against a real
    # database (confirmed live against Postgres; SQLite does not enforce
    # FKs by default, which is why this must be asserted explicitly
    # rather than merely relying on a passing test). Provenance runs the
    # other direction instead: revision.created_by_agent_run_id (already
    # asserted below via how `run` itself was looked up).
    assert run.result_revision_id is None
    snapshot = await session.get(ContextSnapshot, run.context_snapshot_id)
    assert snapshot is not None
    assert snapshot.payload["task"]["id"] == task_id
    assert snapshot.payload["core_anchor"]["core_summary"] == "A restrained dusk confrontation."

    # The confirmation authority is still exactly the same as any other
    # draft -- an agent actor can never confirm it, only a human
    # cg_supervisor can.
    forbidden = await client.post(
        f"/intent/execution-anchor-revisions/{revision.id}/confirm", json={}, headers=VFX
    )
    assert forbidden.status_code == 403


async def test_malformed_deepseek_output_creates_no_draft_and_preserves_snapshot(
    client: AsyncClient, session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A DeepSeek response cut off mid-JSON must still leave the
    ContextSnapshot in place, mark the AgentRun failed with no credential
    in the error, and persist no ExecutionAnchorRevision at all.
    """
    import openai
    from intent_core_api.config import get_settings

    _shot_id, task_id = await _build_task_with_confirmed_core_anchor(client)

    truncated_content = '{\n  "technical_boundaries": "24fps, contrast graded wit'

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
        with pytest.raises(AgentGenerationError):
            await generate_execution_anchor_draft(session, uuid.UUID(task_id))
    finally:
        monkeypatch.delenv("MODEL_PROVIDER", raising=False)
        monkeypatch.delenv("MODEL_API_KEY", raising=False)
        monkeypatch.delenv("MODEL_NAME", raising=False)
        get_settings.cache_clear()

    runs = (
        (
            await session.execute(
                select(AgentRun).where(
                    AgentRun.capability == "execution_anchor_drafting",
                    AgentRun.provider == "deepseek",
                )
            )
        )
        .scalars()
        .all()
    )
    assert len(runs) == 1
    run = runs[0]
    assert run.status == "failed"
    assert "test-key-never-a-real-secret" not in (run.error or "")
    assert run.context_snapshot_id is not None
    snapshot = await session.get(ContextSnapshot, run.context_snapshot_id)
    assert snapshot is not None

    revisions = (await session.execute(select(ExecutionAnchorRevision))).scalars().all()
    assert revisions == []

    anchor_response = await client.get(f"/intent/tasks/{task_id}/execution-anchor")
    assert anchor_response.status_code == 404


async def test_deepseek_provider_error_creates_no_draft(
    client: AsyncClient, session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A network/provider-level failure (not a malformed-output failure)
    must also fail the AgentRun honestly with no partial draft -- the
    same guarantee as the malformed-output case, exercised via a client
    whose `create()` call raises outright.
    """
    import openai
    from intent_core_api.config import get_settings

    _shot_id, task_id = await _build_task_with_confirmed_core_anchor(client)

    class _RaisingChatCompletions:
        def create(self, **kwargs: Any) -> Any:
            raise ConnectionError("simulated network failure")

    class _RaisingChat:
        def __init__(self) -> None:
            self.completions = _RaisingChatCompletions()

    class _RaisingClient:
        def __init__(self, *, api_key: str, base_url: str) -> None:
            self.chat = _RaisingChat()

    monkeypatch.setattr(openai, "OpenAI", _RaisingClient)
    get_settings.cache_clear()
    monkeypatch.setenv("MODEL_PROVIDER", "deepseek")
    monkeypatch.setenv("MODEL_API_KEY", "test-key-never-a-real-secret")
    monkeypatch.setenv("MODEL_NAME", "deepseek-v4-flash")
    get_settings.cache_clear()
    try:
        with pytest.raises(AgentGenerationError):
            await generate_execution_anchor_draft(session, uuid.UUID(task_id))
    finally:
        monkeypatch.delenv("MODEL_PROVIDER", raising=False)
        monkeypatch.delenv("MODEL_API_KEY", raising=False)
        monkeypatch.delenv("MODEL_NAME", raising=False)
        get_settings.cache_clear()

    revisions = (await session.execute(select(ExecutionAnchorRevision))).scalars().all()
    assert revisions == []
    runs = (
        (
            await session.execute(
                select(AgentRun).where(AgentRun.capability == "execution_anchor_drafting")
            )
        )
        .scalars()
        .all()
    )
    assert len(runs) == 1
    assert runs[0].status == "failed"


# --- Context includes real Version/dependency context when available ------


async def test_context_snapshot_includes_relevant_version_when_one_exists(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot_id, task_id = await _build_task_with_confirmed_core_anchor(client)
    await client.post(
        "/versions",
        json={
            "shot_id": shot_id,
            "name": "SH010_v001",
            "version_number": 1,
            "description": "First pass.",
        },
        headers=CG,
    )

    revision = await generate_execution_anchor_draft(
        session, uuid.UUID(task_id), generator=DeterministicExecutionAnchorDraftGenerator()
    )

    run = await session.get(AgentRun, revision.created_by_agent_run_id)
    assert run is not None
    snapshot = await session.get(ContextSnapshot, run.context_snapshot_id)
    assert snapshot is not None
    assert snapshot.payload["relevant_version"]["name"] == "SH010_v001"


async def test_context_snapshot_includes_existing_dependency_when_one_exists(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot_id, task_id = await _build_task_with_confirmed_core_anchor(client)
    await client.post(
        f"/tasks/{task_id}/dependencies",
        json={
            "kind": "dependency",
            "description": "Blocked on the comp pass.",
            "severity": "medium",
        },
        headers=CG,
    )

    revision = await generate_execution_anchor_draft(
        session, uuid.UUID(task_id), generator=DeterministicExecutionAnchorDraftGenerator()
    )

    run = await session.get(AgentRun, revision.created_by_agent_run_id)
    assert run is not None
    snapshot = await session.get(ContextSnapshot, run.context_snapshot_id)
    assert snapshot is not None
    assert len(snapshot.payload["existing_dependencies"]) == 1
    dependency_payload = snapshot.payload["existing_dependencies"][0]
    assert dependency_payload["description"] == "Blocked on the comp pass."


async def test_context_snapshot_omits_version_and_dependencies_when_none_exist(
    client: AsyncClient, session: AsyncSession
) -> None:
    _shot_id, task_id = await _build_task_with_confirmed_core_anchor(client)

    revision = await generate_execution_anchor_draft(
        session, uuid.UUID(task_id), generator=DeterministicExecutionAnchorDraftGenerator()
    )

    run = await session.get(AgentRun, revision.created_by_agent_run_id)
    assert run is not None
    snapshot = await session.get(ContextSnapshot, run.context_snapshot_id)
    assert snapshot is not None
    assert "relevant_version" not in snapshot.payload
    assert "existing_dependencies" not in snapshot.payload


def test_generator_protocol_is_satisfied_by_both_adapters() -> None:
    det: ExecutionAnchorDraftGenerator = DeterministicExecutionAnchorDraftGenerator()
    deep: ExecutionAnchorDraftGenerator = DeepSeekExecutionAnchorDraftGenerator(
        api_key="k", model_name="m"
    )
    assert callable(det.generate)
    assert callable(deep.generate)
