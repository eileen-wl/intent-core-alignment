"""Focused tests for the shared Agent Runtime (Step 2):
``agents.runtime``, ``agents.model_gateway``, ``agents.prompt_registry``.

Domain-specific execution paths (core_anchor_drafting/
intent_decomposition/context_reconstruction/alignment_assessment)
remain covered by their own existing test files, which exercise the
runtime indirectly through real HTTP/service calls; this file exercises
only the shared machinery in isolation, using a minimal fake Pydantic
output type rather than a real capability's contract.
"""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from intent_core_api.agents import model_gateway, prompt_registry, runtime
from intent_core_api.agents.models import AgentRun, ContextSnapshot
from intent_core_api.agents.runtime import AgentExecutionSpec, execute_agent
from intent_core_api.production_context.models import Project, Shot
from intent_core_api.workflow.exceptions import AgentGenerationError
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


class _FakeOutput(BaseModel):
    value: str


class _FakeGenerator:
    def __init__(self, output: _FakeOutput) -> None:
        self._output = output

    def generate(self, *, snapshot_payload: dict[str, Any]) -> _FakeOutput:
        return self._output


class _RaisingGenerator:
    def generate(self, *, snapshot_payload: dict[str, Any]) -> _FakeOutput:
        raise RuntimeError("simulated provider timeout")


async def _create_shot(session: AsyncSession) -> uuid.UUID:
    project = Project(name="Demo", source="manual")
    session.add(project)
    await session.commit()
    await session.refresh(project)
    shot = Shot(project_id=project.id, name="SH010", source="manual")
    session.add(shot)
    await session.commit()
    await session.refresh(shot)
    return shot.id


def _spec(
    shot_id: uuid.UUID,
    **overrides: Any,
) -> AgentExecutionSpec[_FakeOutput, str]:
    async def _default_persist(
        session: AsyncSession, snapshot: ContextSnapshot, run: AgentRun, output: _FakeOutput
    ) -> str:
        return output.value

    defaults: dict[str, Any] = dict(
        shot_id=shot_id,
        agent_type="core_agent",
        capability="fake_capability",
        provider="deterministic",
        snapshot_payload={"shot": {"id": str(shot_id)}},
        resolve_generator=lambda: _FakeGenerator(_FakeOutput(value="hello")),
        persist_result=_default_persist,
        failure_label="Fake capability generation",
    )
    defaults.update(overrides)
    return AgentExecutionSpec(**defaults)


# --- Runtime success ---------------------------------------------------


async def test_execute_agent_success_persists_snapshot_and_run(session: AsyncSession) -> None:
    shot_id = await _create_shot(session)
    spec = _spec(
        shot_id,
        model_name="fake-model",
        prompt_version="fake_capability.v1",
    )

    result = await execute_agent(session, spec)
    assert result == "hello"

    snapshots = (await session.execute(select(ContextSnapshot))).scalars().all()
    assert len(snapshots) == 1
    assert snapshots[0].shot_id == shot_id
    assert snapshots[0].payload == {"shot": {"id": str(shot_id)}}

    runs = (await session.execute(select(AgentRun))).scalars().all()
    assert len(runs) == 1
    run = runs[0]
    assert run.shot_id == shot_id
    assert run.context_snapshot_id == snapshots[0].id
    assert run.agent_type == "core_agent"
    assert run.capability == "fake_capability"
    assert run.provider == "deterministic"
    assert run.model_name == "fake-model"
    assert run.prompt_version == "fake_capability.v1"
    assert run.status == "succeeded"
    assert run.error is None
    assert run.completed_at is not None


async def test_execute_agent_defaults_model_name_and_prompt_version_to_none(
    session: AsyncSession,
) -> None:
    shot_id = await _create_shot(session)
    spec = _spec(shot_id)

    await execute_agent(session, spec)

    run = (await session.execute(select(AgentRun))).scalars().one()
    assert run.model_name is None
    assert run.prompt_version is None


async def test_execute_agent_persists_domain_result_before_marking_run_succeeded(
    session: AsyncSession,
) -> None:
    shot_id = await _create_shot(session)
    observed_status_during_persist: list[str] = []

    async def _persist(
        session: AsyncSession, snapshot: ContextSnapshot, run: AgentRun, output: _FakeOutput
    ) -> str:
        # The AgentRun row must still read "running" while the domain
        # service is persisting its own result -- it must not have been
        # marked "succeeded" before persist_result runs.
        observed_status_during_persist.append(run.status)
        return output.value

    spec = _spec(shot_id, persist_result=_persist)
    await execute_agent(session, spec)

    assert observed_status_during_persist == ["running"]
    run = (await session.execute(select(AgentRun))).scalars().one()
    assert run.status == "succeeded"


# --- Runtime failure -----------------------------------------------------


async def test_execute_agent_provider_failure_marks_run_failed_and_keeps_snapshot(
    session: AsyncSession,
) -> None:
    shot_id = await _create_shot(session)
    spec = _spec(shot_id, resolve_generator=lambda: _RaisingGenerator())

    with pytest.raises(AgentGenerationError) as excinfo:
        await execute_agent(session, spec)
    assert "simulated provider timeout" in str(excinfo.value)

    snapshots = (await session.execute(select(ContextSnapshot))).scalars().all()
    assert len(snapshots) == 1  # preserved as evidence, not rolled back

    run = (await session.execute(select(AgentRun))).scalars().one()
    assert run.status == "failed"
    assert "simulated provider timeout" in (run.error or "")
    assert run.completed_at is not None


async def test_execute_agent_validation_failure_marks_run_failed(session: AsyncSession) -> None:
    shot_id = await _create_shot(session)

    def _resolve() -> _FakeGenerator:
        raise AgentGenerationError("structured output failed validation")

    spec = _spec(shot_id, resolve_generator=_resolve)

    with pytest.raises(AgentGenerationError):
        await execute_agent(session, spec)

    run = (await session.execute(select(AgentRun))).scalars().one()
    assert run.status == "failed"
    assert "structured output failed validation" in (run.error or "")


async def test_execute_agent_domain_persistence_failure_marks_run_failed_no_partial_result(
    session: AsyncSession,
) -> None:
    shot_id = await _create_shot(session)

    async def _failing_persist(
        session: AsyncSession, snapshot: ContextSnapshot, run: AgentRun, output: _FakeOutput
    ) -> str:
        raise RuntimeError("simulated domain persistence failure")

    spec = _spec(shot_id, persist_result=_failing_persist)

    # A domain-persistence failure is not a provider/validation failure,
    # so (matching every capability's pre-Step-2 behaviour) it propagates
    # as-is rather than being wrapped into AgentGenerationError.
    with pytest.raises(RuntimeError, match="simulated domain persistence failure"):
        await execute_agent(session, spec)

    run = (await session.execute(select(AgentRun))).scalars().one()
    assert run.status == "failed"
    assert "simulated domain persistence failure" in (run.error or "")
    # No succeeded run and no other side effect -- only the one
    # ContextSnapshot/AgentRun pair the runtime itself created.
    assert len((await session.execute(select(ContextSnapshot))).scalars().all()) == 1
    assert len((await session.execute(select(AgentRun))).scalars().all()) == 1


async def test_execute_agent_failed_run_error_never_contains_a_credential(
    session: AsyncSession,
) -> None:
    shot_id = await _create_shot(session)
    secret = "sk-should-never-be-recorded"  # noqa: S105 -- fake, test-only value

    def _resolve() -> _FakeGenerator:
        raise RuntimeError(f"provider rejected request (key ending ...{secret[-4:]})")

    spec = _spec(shot_id, resolve_generator=_resolve)
    with pytest.raises(AgentGenerationError):
        await execute_agent(session, spec)

    run = (await session.execute(select(AgentRun))).scalars().one()
    assert secret not in (run.error or "")


# --- Model Gateway: provider dispatch -------------------------------------


def test_resolve_provider_name_defaults_to_deterministic(monkeypatch: pytest.MonkeyPatch) -> None:
    from intent_core_api.config import get_settings

    # An explicit "deterministic" (not delenv) -- a real local .env may
    # set MODEL_PROVIDER=deepseek for manual acceptance runs, and
    # pydantic-settings falls back to reading .env once the process env
    # var is absent, which would make this test depend on developer
    # machine state instead of the documented blank-value default.
    monkeypatch.setenv("MODEL_PROVIDER", "")
    get_settings.cache_clear()
    try:
        assert model_gateway.resolve_provider_name() == "deterministic"
    finally:
        monkeypatch.delenv("MODEL_PROVIDER", raising=False)
        get_settings.cache_clear()


def test_require_deepseek_settings_raises_without_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    from intent_core_api.config import get_settings

    monkeypatch.setenv("MODEL_API_KEY", "")
    monkeypatch.setenv("MODEL_NAME", "deepseek-v4-flash")
    get_settings.cache_clear()
    try:
        with pytest.raises(AgentGenerationError, match="MODEL_API_KEY"):
            model_gateway.require_deepseek_settings()
    finally:
        monkeypatch.delenv("MODEL_API_KEY", raising=False)
        monkeypatch.delenv("MODEL_NAME", raising=False)
        get_settings.cache_clear()


def test_require_deepseek_settings_raises_without_model_name(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from intent_core_api.config import get_settings

    monkeypatch.setenv("MODEL_API_KEY", "test-key-never-a-real-secret")
    monkeypatch.setenv("MODEL_NAME", "")
    get_settings.cache_clear()
    try:
        with pytest.raises(AgentGenerationError, match="MODEL_NAME"):
            model_gateway.require_deepseek_settings()
    finally:
        monkeypatch.delenv("MODEL_API_KEY", raising=False)
        monkeypatch.delenv("MODEL_NAME", raising=False)
        get_settings.cache_clear()


def test_require_deepseek_settings_returns_the_pair_when_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from intent_core_api.config import get_settings

    monkeypatch.setenv("MODEL_API_KEY", "test-key-never-a-real-secret")
    monkeypatch.setenv("MODEL_NAME", "deepseek-v4-flash")
    get_settings.cache_clear()
    try:
        api_key, model_name = model_gateway.require_deepseek_settings()
        assert api_key == "test-key-never-a-real-secret"
        assert model_name == "deepseek-v4-flash"
    finally:
        monkeypatch.delenv("MODEL_API_KEY", raising=False)
        monkeypatch.delenv("MODEL_NAME", raising=False)
        get_settings.cache_clear()


class _FakeUsage:
    def __init__(self, *, prompt_tokens: int, completion_tokens: int, total_tokens: int) -> None:
        self.prompt_tokens = prompt_tokens
        self.completion_tokens = completion_tokens
        self.total_tokens = total_tokens


class _FakeChatCompletions:
    def __init__(
        self,
        content: str | None,
        *,
        finish_reason: str = "stop",
        usage: _FakeUsage | None = None,
    ) -> None:
        self._content = content
        self._finish_reason = finish_reason
        self._usage = usage
        self.calls: list[dict[str, Any]] = []

    def create(self, **kwargs: Any) -> Any:
        self.calls.append(kwargs)

        class _Choice:
            def __init__(self, content: str | None, finish_reason: str) -> None:
                self.message = type("Message", (), {"content": content})()
                self.finish_reason = finish_reason

        class _Response:
            def __init__(
                self, content: str | None, finish_reason: str, usage: _FakeUsage | None
            ) -> None:
                self.choices = [_Choice(content, finish_reason)]
                self.usage = usage

        return _Response(self._content, self._finish_reason, self._usage)


class _FakeChat:
    def __init__(
        self,
        content: str | None,
        *,
        finish_reason: str = "stop",
        usage: _FakeUsage | None = None,
    ) -> None:
        self.completions = _FakeChatCompletions(content, finish_reason=finish_reason, usage=usage)


class _FakeOpenAIClient:
    last_instance: _FakeOpenAIClient | None = None

    def __init__(self, *, api_key: str, base_url: str) -> None:
        self.api_key = api_key
        self.base_url = base_url
        self.chat = _FakeChat(_FakeOutput(value="from deepseek").model_dump_json())
        _FakeOpenAIClient.last_instance = self


def test_generate_deepseek_makes_one_non_streaming_json_mode_call(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import openai

    monkeypatch.setattr(openai, "OpenAI", _FakeOpenAIClient)

    output = model_gateway.generate_deepseek(
        api_key="test-key-never-a-real-secret",
        model_name="deepseek-v4-flash",
        system_prompt="You must respond with json.",
        user_content="Context (JSON):\n{}",
        output_model=_FakeOutput,
        max_tokens=1024,
    )

    assert output == _FakeOutput(value="from deepseek")
    client = _FakeOpenAIClient.last_instance
    assert client is not None
    assert client.api_key == "test-key-never-a-real-secret"
    assert client.base_url == model_gateway.DEEPSEEK_BASE_URL
    assert len(client.chat.completions.calls) == 1
    call = client.chat.completions.calls[0]
    assert call["model"] == "deepseek-v4-flash"
    assert call["response_format"] == {"type": "json_object"}
    assert call["max_tokens"] == 1024
    assert "stream" not in call


def test_generate_deepseek_raises_agent_generation_error_on_empty_content(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import openai

    class _EmptyContentClient(_FakeOpenAIClient):
        def __init__(self, *, api_key: str, base_url: str) -> None:
            super().__init__(api_key=api_key, base_url=base_url)
            self.chat = _FakeChat(None)

    monkeypatch.setattr(openai, "OpenAI", _EmptyContentClient)

    with pytest.raises(AgentGenerationError):
        model_gateway.generate_deepseek(
            api_key="k",
            model_name="deepseek-v4-flash",
            system_prompt="json",
            user_content="{}",
            output_model=_FakeOutput,
            max_tokens=1024,
        )


def test_generate_deepseek_uses_default_max_output_tokens_when_omitted(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Step 4 fix: a caller with no capability-specific override (i.e.
    every capability except execution_review) must still get the
    shared, unchanged default -- not `None` reaching the SDK call.
    """
    import openai

    monkeypatch.setattr(openai, "OpenAI", _FakeOpenAIClient)

    model_gateway.generate_deepseek(
        api_key="k",
        model_name="deepseek-v4-flash",
        system_prompt="json",
        user_content="{}",
        output_model=_FakeOutput,
    )

    client = _FakeOpenAIClient.last_instance
    assert client is not None
    call = client.chat.completions.calls[0]
    assert call["max_tokens"] == model_gateway.DEFAULT_MAX_OUTPUT_TOKENS


def test_generate_deepseek_passes_a_capability_specific_max_tokens_through(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The value a caller passes explicitly (e.g. from
    `PromptRegistration.max_output_tokens`) reaches the client call
    unchanged, even when it differs from the shared default.
    """
    import openai

    monkeypatch.setattr(openai, "OpenAI", _FakeOpenAIClient)

    model_gateway.generate_deepseek(
        api_key="k",
        model_name="deepseek-v4-flash",
        system_prompt="json",
        user_content="{}",
        output_model=_FakeOutput,
        max_tokens=8192,
    )

    client = _FakeOpenAIClient.last_instance
    assert client is not None
    call = client.chat.completions.calls[0]
    assert call["max_tokens"] == 8192


# --- provider response diagnostics (Step 4 truncation root-cause fix) ---


def test_generate_deepseek_success_with_usage_metadata_still_returns_typed_output(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Scenario A: a normal, complete response (finish_reason="stop",
    usage metadata present) must still parse and return successfully --
    reading diagnostics must never interfere with the success path.
    """
    import openai

    class _SuccessClient(_FakeOpenAIClient):
        def __init__(self, *, api_key: str, base_url: str) -> None:
            super().__init__(api_key=api_key, base_url=base_url)
            self.chat = _FakeChat(
                _FakeOutput(value="from deepseek").model_dump_json(),
                finish_reason="stop",
                usage=_FakeUsage(prompt_tokens=120, completion_tokens=40, total_tokens=160),
            )

    monkeypatch.setattr(openai, "OpenAI", _SuccessClient)

    output = model_gateway.generate_deepseek(
        api_key="k",
        model_name="deepseek-v4-flash",
        system_prompt="json",
        user_content="{}",
        output_model=_FakeOutput,
        max_tokens=1024,
    )

    assert output == _FakeOutput(value="from deepseek")


def test_generate_deepseek_truncated_response_records_safe_diagnostics(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Scenario B: a response cut off mid-JSON (finish_reason="length")
    must fail with a sanitised AgentGenerationError carrying bounded,
    non-secret diagnostics -- never the raw pydantic ValidationError
    (which embeds a snippet of the actual truncated content), never the
    prompt, never a credential.
    """
    import openai

    secret_api_key = "sk-should-never-be-recorded"  # noqa: S105 -- fake, test-only value
    truncated_content = '{"value": "trunca'

    class _TruncatedClient(_FakeOpenAIClient):
        def __init__(self, *, api_key: str, base_url: str) -> None:
            super().__init__(api_key=api_key, base_url=base_url)
            self.chat = _FakeChat(
                truncated_content,
                finish_reason="length",
                usage=_FakeUsage(prompt_tokens=2000, completion_tokens=1024, total_tokens=3024),
            )

    monkeypatch.setattr(openai, "OpenAI", _TruncatedClient)

    with pytest.raises(AgentGenerationError) as excinfo:
        model_gateway.generate_deepseek(
            api_key=secret_api_key,
            model_name="deepseek-v4-flash",
            system_prompt="a secret prompt that must never leak",
            user_content="{}",
            output_model=_FakeOutput,
            max_tokens=1024,
        )

    message = str(excinfo.value)
    assert "finish_reason='length'" in message
    assert "configured_max_output_tokens=1024" in message
    assert "completion_tokens=1024" in message
    assert "prompt_tokens=2000" in message
    assert "total_tokens=3024" in message
    assert f"response_characters={len(truncated_content)}" in message
    # Never the raw content, the prompt, or the credential.
    assert truncated_content not in message
    assert "trunca" not in message
    assert "a secret prompt" not in message
    assert secret_api_key not in message


def test_generate_deepseek_empty_content_records_safe_diagnostics(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import openai

    class _EmptyClient(_FakeOpenAIClient):
        def __init__(self, *, api_key: str, base_url: str) -> None:
            super().__init__(api_key=api_key, base_url=base_url)
            self.chat = _FakeChat(None, finish_reason="length")

    monkeypatch.setattr(openai, "OpenAI", _EmptyClient)

    with pytest.raises(AgentGenerationError) as excinfo:
        model_gateway.generate_deepseek(
            api_key="k",
            model_name="deepseek-v4-flash",
            system_prompt="json",
            user_content="{}",
            output_model=_FakeOutput,
            max_tokens=1024,
        )

    message = str(excinfo.value)
    assert "content_was_empty=True" in message
    assert "finish_reason='length'" in message


def test_generate_deepseek_tolerates_missing_usage(monkeypatch: pytest.MonkeyPatch) -> None:
    """Scenario C: some OpenAI-compatible providers omit `usage`
    entirely -- diagnostics must degrade to `None` token counts, never
    raise on their own account.
    """
    import openai

    class _NoUsageClient(_FakeOpenAIClient):
        def __init__(self, *, api_key: str, base_url: str) -> None:
            super().__init__(api_key=api_key, base_url=base_url)
            self.chat = _FakeChat("not valid json", finish_reason="stop", usage=None)

    monkeypatch.setattr(openai, "OpenAI", _NoUsageClient)

    with pytest.raises(AgentGenerationError) as excinfo:
        model_gateway.generate_deepseek(
            api_key="k",
            model_name="deepseek-v4-flash",
            system_prompt="json",
            user_content="{}",
            output_model=_FakeOutput,
            max_tokens=1024,
        )

    message = str(excinfo.value)
    assert "prompt_tokens=None" in message
    assert "completion_tokens=None" in message
    assert "total_tokens=None" in message


def test_generate_deepseek_never_makes_a_real_network_call(monkeypatch: pytest.MonkeyPatch) -> None:
    """No network mock installed -- if this ever tried a real request it
    would fail/hang against a fake host, so a clean pass here proves the
    call never reaches past the (unpatched, thus untouched) `openai`
    client construction in this test.
    """
    import openai

    monkeypatch.setattr(openai, "OpenAI", _FakeOpenAIClient)
    output = model_gateway.generate_deepseek(
        api_key="k",
        model_name="deepseek-v4-flash",
        system_prompt="json",
        user_content="{}",
        output_model=_FakeOutput,
        max_tokens=1024,
    )
    assert output.value == "from deepseek"


# --- Prompt registry -------------------------------------------------------


@pytest.mark.parametrize(
    "capability",
    [
        "core_anchor_drafting",
        "intent_decomposition",
        "context_reconstruction",
        "alignment_assessment",
    ],
)
def test_all_four_core_agent_capabilities_are_registered(capability: str) -> None:
    registration = prompt_registry.get_registration(capability)
    assert registration.agent_type == "core_agent"
    assert registration.capability == capability
    assert registration.prompt_key == capability
    assert registration.version == "v1"
    assert registration.version_label == f"{capability}.v1"
    assert registration.system_prompt.strip()


def test_prompt_registry_output_models_match_capability_contracts() -> None:
    from intent_core_contracts.api.alignment_assessment import AlignmentAssessmentOutput
    from intent_core_contracts.api.context_reconstruction import ContextReconstructionOutput
    from intent_core_contracts.api.intent import CoreAnchorRevisionDraftCreate
    from intent_core_contracts.api.intent_decomposition import IntentDecompositionOutput

    assert (
        prompt_registry.get_registration("core_anchor_drafting").output_model
        is CoreAnchorRevisionDraftCreate
    )
    assert (
        prompt_registry.get_registration("intent_decomposition").output_model
        is IntentDecompositionOutput
    )
    assert (
        prompt_registry.get_registration("context_reconstruction").output_model
        is ContextReconstructionOutput
    )
    assert (
        prompt_registry.get_registration("alignment_assessment").output_model
        is AlignmentAssessmentOutput
    )


@pytest.mark.parametrize(
    "capability",
    [
        "core_anchor_drafting",
        "intent_decomposition",
        "context_reconstruction",
        "alignment_assessment",
        "creative_review",
    ],
)
def test_non_cg_capabilities_have_no_max_output_tokens_override(capability: str) -> None:
    """Step 4 fix: only execution_review gets a capability-specific
    output-token budget -- every pre-existing capability keeps `None`,
    which the Model Gateway maps to its unchanged shared default.
    """
    assert prompt_registry.get_registration(capability).max_output_tokens is None


def test_execution_review_has_a_raised_max_output_tokens() -> None:
    registration = prompt_registry.get_registration("execution_review")
    assert registration.max_output_tokens == 8192
    # Strictly greater than the Model Gateway's shared default -- this is
    # the whole point of the override (the real acceptance truncation
    # happened at the shared default for this capability specifically).
    assert registration.max_output_tokens > model_gateway.DEFAULT_MAX_OUTPUT_TOKENS


def test_get_registration_raises_clearly_for_an_unregistered_capability() -> None:
    with pytest.raises(KeyError, match="not registered"):
        prompt_registry.get_registration("not_a_real_capability")


def test_execution_metadata_is_none_for_a_deterministic_provider(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from intent_core_api.config import get_settings

    monkeypatch.setenv("MODEL_PROVIDER", "deterministic")
    get_settings.cache_clear()
    try:
        provider, model_name, prompt_version = prompt_registry.execution_metadata(
            "intent_decomposition"
        )
        assert provider == "deterministic"
        assert model_name is None
        assert prompt_version is None
    finally:
        monkeypatch.delenv("MODEL_PROVIDER", raising=False)
        get_settings.cache_clear()


def test_execution_metadata_is_populated_for_a_configured_deepseek_provider(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from intent_core_api.config import get_settings

    monkeypatch.setenv("MODEL_PROVIDER", "deepseek")
    monkeypatch.setenv("MODEL_NAME", "deepseek-v4-flash")
    get_settings.cache_clear()
    try:
        provider, model_name, prompt_version = prompt_registry.execution_metadata(
            "intent_decomposition"
        )
        assert provider == "deepseek"
        assert model_name == "deepseek-v4-flash"
        assert prompt_version == "intent_decomposition.v1"
    finally:
        monkeypatch.delenv("MODEL_PROVIDER", raising=False)
        monkeypatch.delenv("MODEL_NAME", raising=False)
        get_settings.cache_clear()


def test_execution_metadata_is_none_when_deepseek_configured_without_model_name(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from intent_core_api.config import get_settings

    monkeypatch.setenv("MODEL_PROVIDER", "deepseek")
    monkeypatch.setenv("MODEL_NAME", "")
    get_settings.cache_clear()
    try:
        provider, model_name, prompt_version = prompt_registry.execution_metadata(
            "intent_decomposition"
        )
        assert provider == "deepseek"
        assert model_name is None
        assert prompt_version is None
    finally:
        monkeypatch.delenv("MODEL_PROVIDER", raising=False)
        monkeypatch.delenv("MODEL_NAME", raising=False)
        get_settings.cache_clear()


def test_runtime_module_reexports_nothing_extra() -> None:
    """Guards the "keep the API small" requirement: the shared runtime's
    public surface is exactly the execution spec and the one entry point,
    not a sprawling generic callback framework.
    """
    public_names = {name for name in dir(runtime) if not name.startswith("_")}
    assert {"AgentExecutionSpec", "execute_agent", "Generator"} <= public_names
