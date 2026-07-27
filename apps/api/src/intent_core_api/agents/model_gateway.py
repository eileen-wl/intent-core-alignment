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
"""

from __future__ import annotations

from pydantic import BaseModel

from intent_core_api.config import get_settings
from intent_core_api.workflow.exceptions import AgentGenerationError

# DeepSeek's OpenAI-compatible endpoint; no separate official DeepSeek
# SDK exists -- this is DeepSeek's own documented integration path (the
# `openai` package with a custom `base_url`). See ADR-0013.
DEEPSEEK_BASE_URL = "https://api.deepseek.com"


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


def generate_deepseek[OutputT: BaseModel](
    *,
    api_key: str,
    model_name: str,
    system_prompt: str,
    user_content: str,
    output_model: type[OutputT],
    max_tokens: int,
) -> OutputT:
    """One non-streaming DeepSeek JSON-mode call, validated against
    ``output_model``. Never logs or returns the API key, the
    ``Authorization`` header, or any other client configuration -- the
    only thing this can raise that reaches a caller is a short
    ``AgentGenerationError`` message.
    """
    from openai import OpenAI

    client = OpenAI(api_key=api_key, base_url=DEEPSEEK_BASE_URL)
    response = client.chat.completions.create(
        model=model_name,
        max_tokens=max_tokens,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
    )
    content = response.choices[0].message.content
    if not content:
        # DeepSeek's JSON-mode docs note the API may occasionally return
        # empty content. Treated as one explicit failure recorded on the
        # AgentRun -- not a reason to build a retry system.
        raise AgentGenerationError(
            "DeepSeek response had empty content "
            f"(finish_reason={response.choices[0].finish_reason!r})"
        )
    return output_model.model_validate_json(content)
