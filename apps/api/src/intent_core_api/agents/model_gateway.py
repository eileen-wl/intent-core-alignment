"""Shared structured-output Model Gateway (Step 2).

The one place every Core Agent capability's DeepSeek adapter routes
through for provider selection and the actual DeepSeek call -- before
this module existed, each of ``core_agent_service``,
``intent_decomposition_service``, ``context_reconstruction_service``,
and ``alignment_assessment_service`` duplicated its own
``_resolve_provider_name()`` and its own ``OpenAI(...)`` client
construction. Deterministic generation stays capability-specific (each
capability's own ``Deterministic*Generator``) -- this module only
covers what is genuinely shared: provider-name resolution and the one
non-streaming DeepSeek JSON-mode call shape.

DeepSeek has no separate official SDK and no equivalent of Anthropic's
``messages.parse(output_format=...)``, so this uses the official
``openai`` Python package pointed at DeepSeek's OpenAI-compatible
endpoint (DeepSeek's own documented integration path). See ADR-0013.

Provider response diagnostics (Step 4 real-provider truncation
root-cause fix): two real CG Supervisor Agent DeepSeek calls failed
with truncated JSON at two different output-token budgets (4096, then
8192), which rules out the budget alone as the explanation. Rather than
guessing further, ``DeepSeekResponseDiagnostics`` captures a small,
bounded set of non-secret facts about *why* a response failed to
validate -- the provider's own ``finish_reason``, the configured output
budget, whatever usage/token counts the provider returned, and the
response's character count -- so the next failure (of any capability,
not just CG) leaves the failed ``AgentRun`` with enough information to
tell an output-budget problem apart from something else, without ever
recording the raw response content, the prompt, or any credential. In
particular, pydantic's own ``ValidationError`` message on malformed
JSON embeds a snippet of the actual (possibly truncated) response text
via its ``input_value`` field -- that message is deliberately never
allowed to reach an ``AgentRun.error`` unsanitised.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final

from pydantic import BaseModel, ValidationError

from intent_core_api.config import get_settings
from intent_core_api.workflow.exceptions import AgentGenerationError

# DeepSeek's OpenAI-compatible endpoint; no separate official DeepSeek
# SDK exists -- this is DeepSeek's own documented integration path (the
# `openai` package with a custom `base_url`). See ADR-0013.
DEEPSEEK_BASE_URL = "https://api.deepseek.com"

# The output-token budget every capability used before Step 4's
# per-capability override existed (``PromptRegistration.
# max_output_tokens``) -- used whenever a caller does not pass an
# explicit ``max_tokens``, so every pre-existing capability's behaviour
# is unchanged (they all still pass their own literal value explicitly).
DEFAULT_MAX_OUTPUT_TOKENS: Final[int] = 4096


def resolve_provider_name() -> str:
    """The configured model provider, defaulting to "deterministic".

    An unset/blank ``MODEL_PROVIDER`` means "use the default", not "no
    provider configured" -- ``.env.example`` ships it blank on purpose
    (matches ``DATABASE_URL``'s own shape), and pydantic-settings treats
    an explicit blank in ``.env`` as set-to-empty-string rather than
    falling back to the field default, so that has to be handled here.
    """
    settings = get_settings()
    return settings.model_provider or "deterministic"


def require_deepseek_settings() -> tuple[str, str]:
    """Returns ``(api_key, model_name)`` for ``provider="deepseek"``, or
    raises ``AgentGenerationError`` -- never returns a partially valid
    pair. Callers never see the underlying settings object, so there is
    no path from this function to a credential leaking into a log or a
    response body.
    """
    settings = get_settings()
    if not settings.model_api_key:
        raise AgentGenerationError("model_provider='deepseek' requires MODEL_API_KEY to be set")
    if not settings.model_name:
        raise AgentGenerationError("model_provider='deepseek' requires MODEL_NAME to be set")
    return settings.model_api_key, settings.model_name


@dataclass(frozen=True)
class DeepSeekResponseDiagnostics:
    """Bounded, credential-free facts about one DeepSeek response --
    never the response content itself, never a prompt, never a
    credential. Exists only to build a short, safe string for
    ``AgentRun.error`` so a failure can be diagnosed (output-budget
    exhaustion vs. something else) without ever exposing what the model
    actually generated.
    """

    finish_reason: str | None
    configured_max_output_tokens: int
    prompt_tokens: int | None
    completion_tokens: int | None
    total_tokens: int | None
    response_characters: int
    content_was_empty: bool

    def __str__(self) -> str:
        return (
            f"finish_reason={self.finish_reason!r} "
            f"configured_max_output_tokens={self.configured_max_output_tokens} "
            f"prompt_tokens={self.prompt_tokens} "
            f"completion_tokens={self.completion_tokens} "
            f"total_tokens={self.total_tokens} "
            f"response_characters={self.response_characters} "
            f"content_was_empty={self.content_was_empty}"
        )


def _usage_field(usage: object, field: str) -> int | None:
    """Tolerates a missing/absent ``usage`` object entirely (some
    OpenAI-compatible providers omit it), or a present-but-unexpected
    field type -- diagnostics must never raise on their own account.
    """
    value = getattr(usage, field, None)
    return value if isinstance(value, int) else None


def generate_deepseek[OutputT: BaseModel](
    *,
    api_key: str,
    model_name: str,
    system_prompt: str,
    user_content: str,
    output_model: type[OutputT],
    max_tokens: int | None = None,
) -> OutputT:
    """One non-streaming DeepSeek JSON-mode call, validated against
    ``output_model``. Never logs or returns the API key, the
    ``Authorization`` header, or any other client configuration, the
    prompt, or the raw response content -- the only thing this can
    raise that reaches a caller is a short ``AgentGenerationError``
    message built from ``DeepSeekResponseDiagnostics``.

    ``max_tokens`` is the capability-specific value when the caller has
    one (typically ``PromptRegistration.max_output_tokens``), else
    ``None`` -- in which case ``DEFAULT_MAX_OUTPUT_TOKENS`` is used. The
    parameter keeps the name ``max_tokens`` here because that is the
    underlying ``openai`` SDK/DeepSeek API argument name; the
    capability-specific override is named more descriptively
    (``max_output_tokens``) on ``PromptRegistration`` itself.
    """
    from openai import OpenAI

    resolved_max_tokens = max_tokens if max_tokens is not None else DEFAULT_MAX_OUTPUT_TOKENS

    client = OpenAI(api_key=api_key, base_url=DEEPSEEK_BASE_URL)
    response = client.chat.completions.create(
        model=model_name,
        max_tokens=resolved_max_tokens,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
    )
    choice = response.choices[0]
    content = choice.message.content
    usage = getattr(response, "usage", None)
    diagnostics = DeepSeekResponseDiagnostics(
        finish_reason=choice.finish_reason,
        configured_max_output_tokens=resolved_max_tokens,
        prompt_tokens=_usage_field(usage, "prompt_tokens"),
        completion_tokens=_usage_field(usage, "completion_tokens"),
        total_tokens=_usage_field(usage, "total_tokens"),
        response_characters=len(content) if content else 0,
        content_was_empty=not content,
    )

    if not content:
        # DeepSeek's JSON-mode docs note the API may occasionally return
        # empty content. Treated as one explicit failure recorded on the
        # AgentRun -- not a reason to build a retry system.
        raise AgentGenerationError(f"DeepSeek response had empty content ({diagnostics})")

    try:
        return output_model.model_validate_json(content)
    except ValidationError as exc:
        # pydantic's own ValidationError message embeds a snippet of the
        # actual (possibly truncated) response text via its
        # `input_value` field -- deliberately not propagated. Only the
        # sanitised diagnostics reach the AgentRun.
        raise AgentGenerationError(
            f"DeepSeek response failed structured-output validation ({diagnostics})"
        ) from exc
