"""Core Agent: the ``intent_decomposition`` capability (Step 1B) --
structures an ``IntentBrief`` into the seven Design Concept dimensions
plus candidate Anchor content, for Human VFX Supervisor review *before*
Core Anchor drafting (docs/PRODUCT_SCOPE.md §6.1, docs/AGENT_CONTRACTS.md
§4 "Intent Decomposition").

Mirrors ``agents.alignment_assessment_service``'s exact shape: a
``ContextSnapshot``/``AgentRun`` pair, a ``Protocol`` + deterministic +
real-provider adapter seam, and a single service function owning the
full snapshot -> run -> generate -> persist -> finalize flow.

This capability never touches a Core Anchor, a Decision, or ftrack --
the only domain-mutating calls this module makes are creating a
ContextSnapshot/AgentRun/IntentDecomposition row. Applying a chosen
decomposition to a new Core Anchor draft is a *separate*, explicitly
human-triggered action implemented in ``agents.core_agent_service``
(``create_core_anchor_draft_from_decomposition``), not here.
"""

from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime
from typing import Any, Final, Protocol

from intent_core_contracts.api.intent_decomposition import (
    IntentDecompositionDimensions,
    IntentDecompositionOutput,
    IntentDimensionAnalysis,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.agents.models import AgentRun, ContextSnapshot
from intent_core_api.config import get_settings
from intent_core_api.integrations import external_link_service
from intent_core_api.intent import brief_service
from intent_core_api.intent.models import IntentDecomposition
from intent_core_api.production_context.models import Project, Shot, Task
from intent_core_api.workflow.actors import ActorContext, AgentType, HumanRole, require_human_role
from intent_core_api.workflow.exceptions import (
    AgentGenerationError,
    InternalConsistencyError,
    NotFoundError,
)

_CAPABILITY_INTENT_DECOMPOSITION = "intent_decomposition"
_AGENT_TYPE_CORE_AGENT: Final[AgentType] = "core_agent"
_GENERATE_ROLES: frozenset[HumanRole] = frozenset({"vfx_supervisor"})

# DeepSeek's OpenAI-compatible endpoint; see agents.alignment_assessment_service
# / docs/decisions/ADR-0013 for why (no separate official DeepSeek SDK exists).
_DEEPSEEK_BASE_URL = "https://api.deepseek.com"

_DEEPSEEK_SYSTEM_PROMPT = """\
You are the Core Agent's intent-decomposition capability for a VFX \
production tool. You read exactly one IntentBrief (plus its Shot and \
Project identity) and structure it into a decomposition that a Human \
VFX Supervisor will review before drafting a Core Anchor. Nothing else \
exists in your context -- do not invent visual details, camera work, \
timing, or content not described in the supplied brief text.

You are strictly advisory, and this happens before any Anchor exists: \
never judge alignment or drift, never compare Versions, never propose an \
Intent Signal, a re-anchor action, or a Human Gate resolution -- none of \
that is available to you at this stage.

Distinguish candidate_constraints (Must-preserve items -- only \
technical or visual-detail requirements that genuinely need to become \
non-negotiable) from candidate_variation_zones (Allowed-variation items) \
from contextual_information (useful background that should stay visible \
but must never become a constraint). List missing or ambiguous context \
in uncertainties -- an empty list means the brief was sufficient; do not \
invent a confidence score.

Respond with a single JSON object only, no text outside of it, matching \
exactly this JSON shape (all fields required):
{
  "core_intent_summary": "<string>",
  "anchor_relevant_content": "<string>",
  "dimensions": {
    "emotional_tone": {"summary": "<string>", "rationale": "<string>"},
    "visual_focus": {"summary": "<string>", "rationale": "<string>"},
    "rhythm_and_intensity": {"summary": "<string>", "rationale": "<string>"},
    "character_relationships": {"summary": "<string>", "rationale": "<string>"},
    "narrative_priority": {"summary": "<string>", "rationale": "<string>"},
    "technical_execution_requirements": {"summary": "<string>", "rationale": "<string>"},
    "visual_detail_constraints": {"summary": "<string>", "rationale": "<string>"}
  },
  "candidate_constraints": ["<string>", ...],
  "candidate_variation_zones": ["<string>", ...],
  "contextual_information": ["<string>", ...],
  "uncertainties": ["<string>", ...]
}"""


def _utcnow() -> datetime:
    return datetime.now(UTC)


class IntentDecompositionGenerator(Protocol):
    """Pure input -> output: no DB/session access, no ftrack access, no
    ability to touch a Core Anchor or create a Decision. Whatever it
    returns is persisted as-is into an immutable IntentDecomposition row.
    """

    def generate(self, *, snapshot_payload: dict[str, Any]) -> IntentDecompositionOutput: ...


class DeterministicIntentDecompositionGenerator:
    """Offline, deterministic dev/test adapter: no network call, no API
    key, same output for the same input every time. Each of the seven
    dimensions is a distinctly-labeled reading of the brief (not seven
    identical placeholders) -- honest about being a placeholder that
    needs human review, same convention as
    ``DeterministicCoreAnchorDraftGenerator``.
    """

    def generate(self, *, snapshot_payload: dict[str, Any]) -> IntentDecompositionOutput:
        brief = snapshot_payload["intent_brief"]
        shot = snapshot_payload["shot"]
        excerpt = brief["raw_text"].strip()
        label = "[Core Agent intent decomposition - deterministic placeholder, review required]"

        def dimension(focus: str) -> IntentDimensionAnalysis:
            return IntentDimensionAnalysis(
                summary=f"{label} {focus.capitalize()}, per the intent brief: {excerpt}",
                rationale=(
                    f"{label} Derived directly from the brief text for {shot['name']}; "
                    "a human must confirm this reading is correct."
                ),
            )

        dimensions = IntentDecompositionDimensions(
            emotional_tone=dimension("the emotional register implied by the brief"),
            visual_focus=dimension("what should visually anchor the audience's attention"),
            rhythm_and_intensity=dimension("the pacing and intensity curve implied by the brief"),
            character_relationships=dimension(
                "how characters are positioned relative to each other"
            ),
            narrative_priority=dimension("which story beat the brief foregrounds"),
            technical_execution_requirements=dimension(
                "technical constraints implied by the brief's language"
            ),
            visual_detail_constraints=dimension("specific visual details the brief calls out"),
        )

        # Deterministic "insufficient context" heuristic: a very short
        # brief cannot honestly support real decomposition. A normal-length
        # brief reports no uncertainty -- an explicit empty list, not a
        # missing field or a confidence score (see module contract).
        uncertainties: list[str] = []
        if len(excerpt) < 20:
            uncertainties.append(
                f"{label} The intent brief is very short; a human should confirm there is "
                "enough context to draft a Core Anchor from it."
            )

        return IntentDecompositionOutput(
            core_intent_summary=(
                f"{label} Summary of the intent brief for {shot['name']}: {excerpt}"
            ),
            anchor_relevant_content=(
                f"{label} Anchor-relevant content extracted from the brief: {excerpt}"
            ),
            dimensions=dimensions,
            candidate_constraints=[
                f"{label} Preserve the core direction described in the brief: {excerpt}",
            ],
            candidate_variation_zones=[
                f"{label} Allow interpretation flexibility on details the brief does not specify.",
            ],
            contextual_information=[
                f"{label} Brief source: {brief['source']}, recorded at {brief['created_at']}.",
            ],
            uncertainties=uncertainties,
        )


class DeepSeekIntentDecompositionGenerator:
    """Same DeepSeek integration path as
    ``DeepSeekAlignmentAssessmentGenerator`` (official ``openai`` package
    pointed at DeepSeek's OpenAI-compatible endpoint; see ADR-0013) --
    one non-streaming JSON-mode call, validated against
    ``IntentDecompositionOutput`` explicitly. Model name comes from
    ``Settings.model_name`` (never hardcoded).
    """

    def __init__(self, *, api_key: str, model_name: str) -> None:
        self._api_key = api_key
        self._model_name = model_name

    def generate(self, *, snapshot_payload: dict[str, Any]) -> IntentDecompositionOutput:
        from openai import OpenAI

        client = OpenAI(api_key=self._api_key, base_url=_DEEPSEEK_BASE_URL)
        response = client.chat.completions.create(
            model=self._model_name,
            max_tokens=2048,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": _DEEPSEEK_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": (
                        "Decompose this intent brief. Respond with the JSON object described "
                        "in the system prompt. Context (JSON):\n"
                        + json.dumps(snapshot_payload, indent=2)
                    ),
                },
            ],
        )
        content = response.choices[0].message.content
        if not content:
            # Same "one explicit failure, not a retry system" convention as
            # the alignment_assessment adapter -- see ADR-0013.
            raise AgentGenerationError(
                "DeepSeek response had empty content "
                f"(finish_reason={response.choices[0].finish_reason!r})"
            )
        return IntentDecompositionOutput.model_validate_json(content)


def _resolve_provider_name() -> str:
    settings = get_settings()
    # Same blank-.env-value footgun as core_agent_service._resolve_provider_name.
    return settings.model_provider or "deterministic"


def _get_generator() -> IntentDecompositionGenerator:
    provider = _resolve_provider_name()
    if provider == "deterministic":
        return DeterministicIntentDecompositionGenerator()
    if provider == "deepseek":
        settings = get_settings()
        if not settings.model_api_key:
            raise AgentGenerationError("model_provider='deepseek' requires MODEL_API_KEY to be set")
        if not settings.model_name:
            raise AgentGenerationError("model_provider='deepseek' requires MODEL_NAME to be set")
        return DeepSeekIntentDecompositionGenerator(
            api_key=settings.model_api_key, model_name=settings.model_name
        )
    raise AgentGenerationError(
        f"model_provider={provider!r} is not implemented; only 'deterministic' "
        "and 'deepseek' exist in this slice"
    )


async def _build_context_snapshot_payload(
    session: AsyncSession,
    *,
    shot: Shot,
    project: Project,
    intent_brief: Any,
    tasks: list[Task],
) -> dict[str, Any]:
    """Only upstream, anchor-setting-preparation facts -- Project/Shot
    identity, the current IntentBrief, and lightweight Task names. No
    Core Anchor, Execution Anchor, Version, ReviewNote, AlignmentAssessment,
    Decision, or HumanGate data: including any of that would make this
    Context Reconstruction (Step 1C), not Intent Decomposition.
    """
    project_payload: dict[str, Any] = {
        "id": str(project.id),
        "name": project.name,
        "source": project.source,
    }
    external_id = await external_link_service.find_external_id_for_entity(
        session, entity_type="project", entity_id=project.id, source="ftrack"
    )
    if external_id is not None:
        project_payload["external_id"] = external_id

    shot_payload: dict[str, Any] = {
        "id": str(shot.id),
        "name": shot.name,
        "source": shot.source,
    }
    external_id = await external_link_service.find_external_id_for_entity(
        session, entity_type="shot", entity_id=shot.id, source="ftrack"
    )
    if external_id is not None:
        shot_payload["external_id"] = external_id

    task_payloads = [
        {"id": str(task.id), "name": task.name, "department": task.department} for task in tasks
    ]

    return {
        "project": project_payload,
        "shot": shot_payload,
        "intent_brief": {
            "id": str(intent_brief.id),
            "raw_text": intent_brief.raw_text,
            "source": intent_brief.source,
            "created_at": intent_brief.created_at.isoformat(),
        },
        "tasks": task_payloads,
    }


async def generate_intent_decomposition(
    session: AsyncSession,
    actor: ActorContext,
    shot_id: uuid.UUID,
    *,
    generator: IntentDecompositionGenerator | None = None,
) -> IntentDecomposition:
    # Authoritative check: enforced here regardless of what the router
    # does, matching every other service in this module. Unlike the plain
    # Core Anchor draft-generate endpoint, generating an anchor-setting
    # decomposition is explicitly Human VFX Supervisor only (no agent
    # actor is ever accepted here -- there is no allowlist parameter).
    require_human_role(actor, _GENERATE_ROLES)

    shot = await session.get(Shot, shot_id)
    if shot is None:
        raise NotFoundError("Shot not found")

    briefs = await brief_service.list_briefs_for_shot(session, shot_id)
    if not briefs:
        raise NotFoundError(
            "No Intent Brief exists for this Shot; cannot generate an intent decomposition"
        )
    latest_brief = briefs[-1]

    project = await session.get(Project, shot.project_id)
    if project is None:
        raise InternalConsistencyError(
            f"Shot {shot_id} references missing Project {shot.project_id}"
        )

    task_rows = await session.execute(
        select(Task).where(Task.shot_id == shot_id).order_by(Task.created_at)
    )
    tasks = list(task_rows.scalars().all())

    payload = await _build_context_snapshot_payload(
        session, shot=shot, project=project, intent_brief=latest_brief, tasks=tasks
    )
    snapshot = ContextSnapshot(shot_id=shot_id, payload=payload)
    session.add(snapshot)
    await session.commit()
    await session.refresh(snapshot)

    run = AgentRun(
        shot_id=shot_id,
        context_snapshot_id=snapshot.id,
        agent_type=_AGENT_TYPE_CORE_AGENT,
        capability=_CAPABILITY_INTENT_DECOMPOSITION,
        provider=_resolve_provider_name(),
        status="running",
    )
    session.add(run)
    await session.commit()
    await session.refresh(run)

    try:
        active_generator = generator if generator is not None else _get_generator()
        try:
            output = active_generator.generate(snapshot_payload=payload)
        except AgentGenerationError:
            raise
        except Exception as exc:  # noqa: BLE001 -- any provider/runtime failure becomes a clear 502
            raise AgentGenerationError(f"Intent decomposition generation failed: {exc}") from exc

        decomposition = IntentDecomposition(
            shot_id=shot_id,
            intent_brief_id=latest_brief.id,
            context_snapshot_id=snapshot.id,
            agent_run_id=run.id,
            core_intent_summary=output.core_intent_summary,
            anchor_relevant_content=output.anchor_relevant_content,
            dimensions=output.dimensions.model_dump(mode="json"),
            candidate_constraints=output.candidate_constraints,
            candidate_variation_zones=output.candidate_variation_zones,
            contextual_information=output.contextual_information,
            uncertainties=output.uncertainties,
        )
        session.add(decomposition)
        await session.commit()
        await session.refresh(decomposition)
    except Exception as exc:
        # result_revision_id stays null -- this capability never creates
        # a CoreAnchorRevision (same convention as Alignment Assessment).
        run.status = "failed"
        run.error = str(exc)
        run.completed_at = _utcnow()
        await session.commit()
        raise

    run.status = "succeeded"
    run.completed_at = _utcnow()
    await session.commit()

    return decomposition


async def get_intent_decomposition(
    session: AsyncSession, decomposition_id: uuid.UUID
) -> IntentDecomposition | None:
    return await session.get(IntentDecomposition, decomposition_id)


async def list_intent_decompositions_for_shot(
    session: AsyncSession, shot_id: uuid.UUID
) -> list[IntentDecomposition]:
    result = await session.execute(
        select(IntentDecomposition)
        .where(IntentDecomposition.shot_id == shot_id)
        .order_by(IntentDecomposition.created_at.desc())
    )
    return list(result.scalars().all())
