"""Artist Agent: the ``iteration_guidance`` capability (Step 5) -- the
third of three planned Role Agents (VFX Supervisor Agent, CG Supervisor
Agent, Artist Agent), independent from the Core Agent and from the other
two Role Agents.

Produces an immutable, advisory ``ArtistAgentGuidance`` for one Version --
translating upstream creative/technical intent and existing feedback
into practical, Artist-facing terms -- for a Human Artist to read.
Mirrors ``agents.cg_supervisor_review_service``'s exact shape: a
``ContextSnapshot``/``AgentRun`` pair, a ``Protocol`` + deterministic +
real-provider adapter seam, and a single service function owning the
full snapshot -> run -> generate -> validate -> persist -> finalize
flow, routed through the Step 2 shared runtime
(``agents.runtime.execute_agent``).

Mandatory distinctions (see docs/AGENT_CONTRACTS.md): the Artist Agent
is not the Core Agent, not the VFX Supervisor Agent, not the CG
Supervisor Agent, and not the human Artist. It never establishes,
modifies, confirms, rejects, replaces, or supersedes a Core Anchor or
Execution Anchor, never resolves a HumanGate, never creates an
authoritative Decision, never creates a ReviewNote, and never writes to
ftrack -- the only domain-mutating calls this module makes are creating
a ContextSnapshot/AgentRun/ArtistAgentGuidance row. Its output is
advisory evidence only.

``Version`` has no ``task_id`` of its own (see
``versions_and_feedback.models.Version``'s own module docstring -- a
Shot may have several Tasks and several Versions with no join between
them), so the caller supplies ``task_id`` explicitly at generation time
rather than this service guessing it. Generation requires the Shot's
confirmed ``CoreAnchorRevision`` and that Task's confirmed
``ExecutionAnchorRevision`` to already exist; a draft or rejected
revision is never silently used.

This repository does not inspect footage, frames, renders, scene/DCC
files, or numeric production parameters -- every structured conclusion
this capability produces must cite real evidence already present in the
snapshot, and ``evidence_gaps`` must honestly record the missing-
evidence limitation; see ``DeterministicArtistGuidanceGenerator`` and
the registered system prompt (``agents.prompt_registry``, capability
``iteration_guidance``) for exactly how that boundary is enforced.
"""

from __future__ import annotations

import json
import re
import uuid
from typing import Any, Final, Protocol

from intent_core_contracts.api.artist_agent_guidance import (
    ArtistAgentGuidanceOutput,
    ArtistEvidenceReference,
    ArtistEvidenceSourceType,
    ArtistFeedbackTranslation,
    ArtistGuidanceItem,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.agents import (
    cg_supervisor_review_service,
    context_reconstruction_service,
    model_gateway,
    prompt_registry,
    vfx_supervisor_review_service,
)
from intent_core_api.agents import intent_decomposition_service as decomposition_service
from intent_core_api.agents.models import AgentRun, ContextSnapshot
from intent_core_api.agents.runtime import AgentExecutionSpec, execute_agent
from intent_core_api.intent import brief_service, core_anchor_service, human_gate_service
from intent_core_api.intent.core_anchor_service import CORE_ANCHOR_CONTENT_FIELDS
from intent_core_api.intent.execution_anchor_service import (
    get_execution_anchor_for_task,
    list_revisions_for_task,
)
from intent_core_api.intent.models import CoreAnchorRevision, ExecutionAnchorRevision
from intent_core_api.production_context.models import Project, Shot, Task
from intent_core_api.versions_and_feedback import service as versions_service
from intent_core_api.versions_and_feedback.models import ArtistAgentGuidance, Version
from intent_core_api.workflow.actors import ActorContext, AgentType, HumanRole, require_human_role
from intent_core_api.workflow.exceptions import (
    AgentGenerationError,
    ConflictError,
    InternalConsistencyError,
    NotFoundError,
)
from intent_core_api.workflow.models import Decision

_CAPABILITY_ITERATION_GUIDANCE = "iteration_guidance"
_AGENT_TYPE_ARTIST_AGENT: Final[AgentType] = "artist_agent"
_GENERATE_ROLES: frozenset[HumanRole] = frozenset({"artist"})

_EXECUTION_ANCHOR_SNAPSHOT_FIELDS: Final = (
    "technical_boundaries",
    "parameter_ranges",
    "allowed_refinements",
    "delivery_conditions",
    "downstream_dependencies",
    "escalation_conditions",
)


class ArtistGuidanceGenerator(Protocol):
    """Pure input -> output: no DB/session access, no ftrack access, no
    ability to touch a Core Anchor, an Execution Anchor, a HumanGate, a
    Decision, or a ReviewNote. Whatever it returns is persisted as-is
    into an immutable ArtistAgentGuidance row.
    """

    def generate(self, *, snapshot_payload: dict[str, Any]) -> ArtistAgentGuidanceOutput: ...


def _evidence(
    source_type: ArtistEvidenceSourceType, source_id: str, label: str
) -> ArtistEvidenceReference:
    return ArtistEvidenceReference(source_type=source_type, source_id=source_id, label=label)


# Mirrors intent_core_contracts.api.artist_agent_guidance's Field length
# limits exactly -- kept here as plain constants rather than introspected
# from the pydantic model so the deterministic generator's intent stays
# readable; if the contract's bounds ever change, update both together.
# Step 7C-5 fix (v2): tightened together with the contract's own v2
# bound pass (see that module's docstring) -- same numbers.
_SUMMARY_LIMIT: Final = 200
_WHY_LIMIT: Final = 240
_PRACTICAL_ACTION_LIMIT: Final = 220
_SELF_CHECK_LIMIT: Final = 200
_NOTE_LIMIT: Final = 220
_EXECUTIVE_SUMMARY_LIMIT: Final = 400
_MAX_NON_NEGOTIABLES: Final = 2
_MAX_ALLOWED_VARIATIONS: Final = 2
_MAX_FEEDBACK_TRANSLATIONS: Final = 2


def _bounded(text: str, *, limit: int) -> str:
    """Keeps deterministic output within the bounded contract's string
    limits regardless of how long the underlying recorded text is --
    never silently drops the field, just shortens it with a visible
    marker rather than letting Pydantic reject the whole guidance.
    """
    if len(text) <= limit:
        return text
    ellipsis = "…"
    return text[: limit - len(ellipsis)] + ellipsis


class DeterministicArtistGuidanceGenerator:
    """Offline, deterministic dev/test adapter: no network call, no API
    key, same output for the same input every time. Reads the actual
    supplied snapshot structure and cites real ids from it, honestly
    reporting the missing-media/technical-evidence limitation and never
    inventing a render/scene-level observation -- same convention as
    ``DeterministicCGSupervisorReviewGenerator``.
    """

    def generate(self, *, snapshot_payload: dict[str, Any]) -> ArtistAgentGuidanceOutput:
        task = snapshot_payload["task"]
        shot = snapshot_payload["shot"]
        version = snapshot_payload["version"]
        execution_anchor = snapshot_payload["execution_anchor"]
        target_revision = execution_anchor["target_revision"]
        core_anchor = snapshot_payload["core_anchor"]
        vfx_review = snapshot_payload["vfx_supervisor_review"]
        cg_review = snapshot_payload["cg_supervisor_review"]
        label = "[Artist deterministic]"

        confirmed_core_revision = (
            core_anchor["confirmed_revision"] if core_anchor is not None else None
        )

        if confirmed_core_revision is not None:
            creative_intent_read = ArtistGuidanceItem(
                summary=_bounded(
                    f"{label} This Shot's confirmed creative direction: "
                    f"{confirmed_core_revision['core_summary']}",
                    limit=_SUMMARY_LIMIT,
                ),
                why_it_matters=_bounded(
                    f"{label} This is the Shot's currently confirmed Core Anchor revision.",
                    limit=_WHY_LIMIT,
                ),
                priority="high",
                evidence=[
                    _evidence(
                        "core_anchor_revision",
                        confirmed_core_revision["id"],
                        f"Confirmed Core Anchor revision {confirmed_core_revision['id']}",
                    )
                ],
            )
        else:
            creative_intent_read = ArtistGuidanceItem(
                summary=_bounded(
                    f"{label} No confirmed Core Anchor direction exists yet for this Shot.",
                    limit=_SUMMARY_LIMIT,
                ),
                why_it_matters=_bounded(
                    f"{label} No confirmed CoreAnchorRevision row exists for this Shot.",
                    limit=_WHY_LIMIT,
                ),
                priority="high",
                evidence=[_evidence("shot", shot["id"], f"Shot {shot['name']}")],
            )

        task_goal = ArtistGuidanceItem(
            summary=_bounded(
                f"{label} Task {task['name']} "
                f"({task['department'] or 'unspecified department'}) is responsible for "
                "delivering against Execution Anchor revision "
                f"#{target_revision['revision_number']}.",
                limit=_SUMMARY_LIMIT,
            ),
            why_it_matters=_bounded(
                f"{label} This is the confirmed Execution Anchor revision for this Task.",
                limit=_WHY_LIMIT,
            ),
            priority="high",
            evidence=[
                _evidence(
                    "execution_anchor_revision",
                    target_revision["id"],
                    f"Execution Anchor revision {target_revision['id']}",
                )
            ],
        )

        current_iteration_read = ArtistGuidanceItem(
            summary=_bounded(
                f"{label} Version {version['name']} is one recorded iteration toward this "
                "Task's goal; it is not evaluated here as officially best or final.",
                limit=_SUMMARY_LIMIT,
            ),
            why_it_matters=_bounded(
                f"{label} This is the target Version this guidance was generated for.",
                limit=_WHY_LIMIT,
            ),
            priority="medium",
            evidence=[_evidence("version", version["id"], f"Version {version['name']}")],
        )

        constraints = confirmed_core_revision["constraints"] if confirmed_core_revision else []
        non_negotiables = [
            ArtistGuidanceItem(
                summary=_bounded(f"{label} Must preserve: {item['content']}", limit=_SUMMARY_LIMIT),
                why_it_matters=_bounded(
                    f"{label} Recorded Constraint on the confirmed Core Anchor revision.",
                    limit=_WHY_LIMIT,
                ),
                priority="high",
                evidence=[_evidence("constraint", item["id"], f"Constraint {item['id']}")],
            )
            for item in constraints[:_MAX_NON_NEGOTIABLES]
        ]

        variation_zones = (
            confirmed_core_revision["variation_zones"] if confirmed_core_revision else []
        )
        allowed_variations = [
            ArtistGuidanceItem(
                summary=_bounded(
                    f"{label} Open to variation: {item['content']}", limit=_SUMMARY_LIMIT
                ),
                why_it_matters=_bounded(
                    f"{label} Recorded VariationZone on the confirmed Core Anchor revision.",
                    limit=_WHY_LIMIT,
                ),
                priority="low",
                evidence=[_evidence("variation_zone", item["id"], f"Variation zone {item['id']}")],
            )
            for item in variation_zones[:_MAX_ALLOWED_VARIATIONS]
        ]

        review_notes = version["review_notes"]
        feedback_translations: list[ArtistFeedbackTranslation] = []
        for note in review_notes[:_MAX_FEEDBACK_TRANSLATIONS]:
            feedback_translations.append(
                ArtistFeedbackTranslation(
                    feedback_or_issue=_bounded(
                        f"{label} Review note: {note['content']}", limit=_SUMMARY_LIMIT
                    ),
                    practical_action=_bounded(
                        f"{label} Address this recorded review note in the next iteration.",
                        limit=_PRACTICAL_ACTION_LIMIT,
                    ),
                    underlying_intent=_bounded(
                        f"{label} This feedback was recorded by a human reviewer for this Version.",
                        limit=_WHY_LIMIT,
                    ),
                    self_check=_bounded(
                        f"{label} Before submitting, confirm this note has been addressed.",
                        limit=_SELF_CHECK_LIMIT,
                    ),
                    priority="medium",
                    evidence=[_evidence("review_note", note["id"], f"Review note {note['id']}")],
                )
            )
        if vfx_review is not None:
            feedback_translations = feedback_translations[: _MAX_FEEDBACK_TRANSLATIONS - 1] + [
                ArtistFeedbackTranslation(
                    feedback_or_issue=_bounded(
                        f"{label} VFX Supervisor Agent concern: {vfx_review['executive_summary']}",
                        limit=_SUMMARY_LIMIT,
                    ),
                    practical_action=_bounded(
                        f"{label} Review the VFX Supervisor Agent's review before the next "
                        "submission.",
                        limit=_PRACTICAL_ACTION_LIMIT,
                    ),
                    underlying_intent=_bounded(
                        f"{label} This is an AI Agent's advisory review, not an authoritative "
                        "human judgment.",
                        limit=_WHY_LIMIT,
                    ),
                    self_check=_bounded(
                        f"{label} Confirm with the Human VFX Supervisor if unclear.",
                        limit=_SELF_CHECK_LIMIT,
                    ),
                    priority="medium",
                    evidence=[
                        _evidence(
                            "vfx_supervisor_review",
                            vfx_review["id"],
                            f"VFX Supervisor Agent review {vfx_review['id']}",
                        )
                    ],
                )
            ]

        iteration_priorities = [
            ArtistGuidanceItem(
                summary=_bounded(
                    f"{label} Confirm the next iteration preserves: {item['content']}",
                    limit=_SUMMARY_LIMIT,
                ),
                why_it_matters=_bounded(
                    f"{label} Recorded Constraint on the confirmed Core Anchor revision.",
                    limit=_WHY_LIMIT,
                ),
                priority="high",
                evidence=[_evidence("constraint", item["id"], f"Constraint {item['id']}")],
            )
            for item in constraints[:_MAX_NON_NEGOTIABLES]
        ]

        cross_department_dependencies: list[ArtistGuidanceItem] = []
        if cg_review is not None:
            cross_department_dependencies.append(
                ArtistGuidanceItem(
                    summary=_bounded(
                        f"{label} A CG Supervisor Agent review exists for this Task; coordinate "
                        "with the Human CG Supervisor on its execution guidance.",
                        limit=_SUMMARY_LIMIT,
                    ),
                    why_it_matters=_bounded(
                        f"{label} A CGSupervisorReview was recorded for this Task's Execution "
                        "Anchor revision.",
                        limit=_WHY_LIMIT,
                    ),
                    priority="medium",
                    evidence=[
                        _evidence(
                            "cg_supervisor_review",
                            cg_review["id"],
                            f"CG Supervisor Agent review {cg_review['id']}",
                        )
                    ],
                )
            )

        # Missing/ambiguous Execution Anchor guidance never becomes an
        # instruction to edit the Anchor -- it is surfaced as a question
        # asking the Human Artist to seek clarification from the Human CG
        # Supervisor instead (Step 5 content-boundary hardening).
        populated_execution_fields = [
            field for field in _EXECUTION_ANCHOR_SNAPSHOT_FIELDS if target_revision.get(field)
        ]
        questions_for_human_supervisor = [
            _bounded(
                f"{label} Does the actual submitted work for {version['name']} match the "
                "recorded Execution Anchor content, given this Agent has not inspected it?",
                limit=_NOTE_LIMIT,
            )
        ]
        if not populated_execution_fields:
            questions_for_human_supervisor.append(
                _bounded(
                    f"{label} The Execution Anchor revision for Task {task['name']} has no "
                    "recorded technical guidance yet; ask the Human CG Supervisor to clarify "
                    "the missing guidance before the next submission.",
                    limit=_NOTE_LIMIT,
                )
            )

        # Mandatory disclosure (see _validate_content_boundaries, which
        # this generator's output must also satisfy).
        evidence_gaps = [
            _bounded(
                f"{label} ICAS has not directly inspected footage, moving-image media, "
                "rendered frames, still images, scene/project/DCC files, or numeric or "
                "pipeline-specific production parameters; this guidance is based solely on "
                "recorded text metadata.",
                limit=_NOTE_LIMIT,
            ),
        ]
        if not populated_execution_fields:
            evidence_gaps.append(
                _bounded(
                    f"{label} No technical boundaries, parameter ranges, or refinement "
                    "guidance are recorded on this Execution Anchor revision.",
                    limit=_NOTE_LIMIT,
                )
            )
        if not review_notes:
            evidence_gaps.append(
                _bounded(
                    f"{label} No Review Notes have been recorded yet for this Version.",
                    limit=_NOTE_LIMIT,
                )
            )
        if vfx_review is None:
            evidence_gaps.append(
                _bounded(
                    f"{label} No VFX Supervisor Agent review exists yet for this Version.",
                    limit=_NOTE_LIMIT,
                )
            )

        executive_summary = _bounded(
            f"{label} {len(constraints)} non-negotiable(s), {len(variation_zones)} allowed "
            f"variation(s), and {len(review_notes)} review note(s) considered for Version "
            f"{version['name']} in Shot {shot['name']}.",
            limit=_EXECUTIVE_SUMMARY_LIMIT,
        )

        return ArtistAgentGuidanceOutput(
            executive_summary=executive_summary,
            creative_intent_read=creative_intent_read,
            task_goal=task_goal,
            current_iteration_read=current_iteration_read,
            non_negotiables=non_negotiables,
            allowed_variations=allowed_variations,
            feedback_translations=feedback_translations,
            iteration_priorities=iteration_priorities,
            cross_department_dependencies=cross_department_dependencies,
            questions_for_human_supervisor=questions_for_human_supervisor,
            evidence_gaps=evidence_gaps,
        )


class DeepSeekArtistGuidanceGenerator:
    """Same DeepSeek integration path as every other capability's
    real-provider adapter (official ``openai`` package pointed at
    DeepSeek's OpenAI-compatible endpoint, via the shared
    ``agents.model_gateway`` -- see ADR-0013) -- one non-streaming
    JSON-mode call, validated against ``ArtistAgentGuidanceOutput``
    explicitly. Model name comes from ``Settings.model_name`` (never
    hardcoded).
    """

    def __init__(self, *, api_key: str, model_name: str) -> None:
        self._api_key = api_key
        self._model_name = model_name

    def generate(self, *, snapshot_payload: dict[str, Any]) -> ArtistAgentGuidanceOutput:
        registration = prompt_registry.get_registration(_CAPABILITY_ITERATION_GUIDANCE)
        return model_gateway.generate_deepseek(
            api_key=self._api_key,
            model_name=self._model_name,
            system_prompt=registration.system_prompt,
            user_content=(
                "Produce iteration guidance for this Version. Respond with the JSON object "
                "described in the system prompt. Context (JSON):\n"
                + json.dumps(snapshot_payload, indent=2)
            ),
            output_model=ArtistAgentGuidanceOutput,
            max_tokens=registration.max_output_tokens,
            # Step 7C-5 fix: a real call was observed to hit
            # finish_reason="length" with fully empty content --
            # `model_gateway`'s own docstring confirms the configured
            # model's internal reasoning phase can consume the entire
            # completion-token budget on this capability's content-rich
            # ContextSnapshot before any visible JSON is produced.
            # Disabling reasoning for this capability only (every other
            # capability keeps its default, unchanged behaviour) frees
            # the whole budget for the required structured output.
            disable_reasoning=True,
        )


def _get_generator() -> ArtistGuidanceGenerator:
    provider = model_gateway.resolve_provider_name()
    if provider == "deterministic":
        return DeterministicArtistGuidanceGenerator()
    if provider == "deepseek":
        api_key, model_name = model_gateway.require_deepseek_settings()
        return DeepSeekArtistGuidanceGenerator(api_key=api_key, model_name=model_name)
    raise AgentGenerationError(
        f"model_provider={provider!r} is not implemented; only 'deterministic' "
        "and 'deepseek' exist in this slice"
    )


def _core_revision_payload(revision: CoreAnchorRevision) -> dict[str, Any]:
    """Compact projection (same discipline as the CG Supervisor Agent's
    Step 4 truncation-fix): drops ``references`` (not needed by this
    capability) and de-duplicates scalar fields that hold the exact same
    text.
    """
    scalar_fields: dict[str, str] = {}
    seen_values: set[str] = set()
    for field in CORE_ANCHOR_CONTENT_FIELDS:
        value = getattr(revision, field)
        if not value or value in seen_values:
            continue
        seen_values.add(value)
        scalar_fields[field] = value

    return {
        "id": str(revision.id),
        "status": revision.status,
        **scalar_fields,
        "constraints": [
            {"id": str(item.id), "content": item.content} for item in revision.constraints
        ],
        "variation_zones": [
            {"id": str(item.id), "content": item.content} for item in revision.variation_zones
        ],
        "drift_risks": [
            {"id": str(item.id), "description": item.description} for item in revision.drift_risks
        ],
        "open_questions": [
            {"id": str(item.id), "question": item.question} for item in revision.open_questions
        ],
    }


def _decomposition_payload(decomposition: Any) -> dict[str, Any]:
    return {
        "id": str(decomposition.id),
        "core_intent_summary": decomposition.core_intent_summary,
        "candidate_constraints": decomposition.candidate_constraints,
        "candidate_variation_zones": decomposition.candidate_variation_zones,
        "uncertainties": decomposition.uncertainties,
    }


def _execution_revision_payload(revision: ExecutionAnchorRevision) -> dict[str, Any]:
    return {
        "id": str(revision.id),
        "revision_number": revision.revision_number,
        "status": revision.status,
        **{field: getattr(revision, field) for field in _EXECUTION_ANCHOR_SNAPSHOT_FIELDS},
    }


def _decision_payload(decision: Decision) -> dict[str, Any]:
    return {
        "id": str(decision.id),
        "decision_type": decision.decision_type,
        "entity_type": decision.entity_type,
        "entity_id": str(decision.entity_id),
        "owning_human_role": decision.owning_human_role,
        "actor_human_role": decision.actor_human_role,
        "rationale": decision.rationale,
        "created_at": decision.created_at.isoformat(),
    }


async def _decisions_for(
    session: AsyncSession, entity_type: str, entity_ids: list[uuid.UUID]
) -> list[Decision]:
    if not entity_ids:
        return []
    result = await session.execute(
        select(Decision)
        .where(Decision.entity_type == entity_type, Decision.entity_id.in_(entity_ids))
        .order_by(Decision.created_at)
    )
    return list(result.scalars().all())


async def _build_context_snapshot_payload(
    session: AsyncSession,
    *,
    version: Version,
    task: Task,
    execution_revision: ExecutionAnchorRevision,
    shot: Shot,
    project: Project,
) -> dict[str, Any]:
    """Only locally persisted facts relevant to guiding one Artist
    through one Version -- no binary media, no thumbnails, no scene/
    project/DCC files, no raw/network-fetched ftrack payloads, no
    secrets, no unrelated Tasks or Versions. No ftrack sync is ever run
    to build this. Deliberately compact: newest-only where several
    records exist, summary-only where a nested record carries its own
    long evidence/rationale tree -- same discipline as the CG Supervisor
    Agent's Step 4 truncation-fix snapshot.
    """
    project_payload: dict[str, Any] = {"id": str(project.id), "name": project.name}
    shot_payload: dict[str, Any] = {"id": str(shot.id), "name": shot.name, "source": shot.source}
    task_payload: dict[str, Any] = {
        "id": str(task.id),
        "name": task.name,
        "department": task.department,
    }

    briefs = await brief_service.list_briefs_for_shot(session, shot.id)
    latest_brief = briefs[-1] if briefs else None
    brief_payload = (
        {"id": str(latest_brief.id), "raw_text": latest_brief.raw_text}
        if latest_brief is not None
        else None
    )

    decompositions = await decomposition_service.list_intent_decompositions_for_shot(
        session, shot.id
    )
    newest_decomposition = decompositions[0] if decompositions else None
    decomposition_payload = (
        _decomposition_payload(newest_decomposition) if newest_decomposition is not None else None
    )

    core_anchor = await core_anchor_service.get_core_anchor_for_shot(session, shot.id)
    core_anchor_payload: dict[str, Any] | None = None
    confirmed_core_revision: CoreAnchorRevision | None = None
    if core_anchor is not None:
        all_core_revisions = await core_anchor_service.list_revisions_for_shot(session, shot.id)
        confirmed_core_revision = next(
            (r for r in all_core_revisions if r.status == "confirmed"), None
        )
        core_anchor_payload = {
            "id": str(core_anchor.id),
            "confirmed_revision": (
                _core_revision_payload(confirmed_core_revision)
                if confirmed_core_revision is not None
                else None
            ),
        }

    reconstructions = await context_reconstruction_service.list_context_reconstructions_for_shot(
        session, shot.id
    )
    newest_reconstruction = reconstructions[0] if reconstructions else None
    reconstruction_payload = (
        {
            "id": str(newest_reconstruction.id),
            "context_summary": newest_reconstruction.reconstructed_context["context_summary"],
            "current_creative_direction_summary": newest_reconstruction.reconstructed_context[
                "current_creative_direction"
            ]["summary"],
            "execution_context_summary": newest_reconstruction.reconstructed_context[
                "execution_context"
            ]["summary"],
            "context_gaps": newest_reconstruction.reconstructed_context["context_gaps"],
        }
        if newest_reconstruction is not None
        else None
    )

    execution_anchor_payload: dict[str, Any] = {
        "target_revision": _execution_revision_payload(execution_revision),
    }

    review_notes = await versions_service.list_review_notes_for_version(session, version.id)
    version_payload: dict[str, Any] = {
        "id": str(version.id),
        "name": version.name,
        "description": version.description,
        "created_at": version.created_at.isoformat(),
        "task_id": str(task.id),
        "review_notes": [
            {
                "id": str(note.id),
                "content": note.content,
                "created_by_human_role": note.created_by_human_role,
            }
            for note in review_notes
        ],
    }

    vfx_reviews = await vfx_supervisor_review_service.list_vfx_supervisor_reviews_for_version(
        session, version.id
    )
    newest_vfx_review = vfx_reviews[0] if vfx_reviews else None
    vfx_review_payload: dict[str, Any] | None = None
    if newest_vfx_review is not None:
        output = newest_vfx_review.review_output
        vfx_review_payload = {
            "id": str(newest_vfx_review.id),
            "executive_summary": output["executive_summary"],
            "creative_concerns": [item["summary"] for item in output["creative_concerns"]],
            "review_priorities": [item["summary"] for item in output["review_priorities"]],
            "proposed_feedback": [
                {"feedback": note["feedback"], "underlying_intent": note["underlying_intent"]}
                for note in output["proposed_feedback_notes"]
            ],
            "evidence_gaps": output["evidence_gaps"],
        }

    cg_reviews = (
        await cg_supervisor_review_service.list_cg_supervisor_reviews_for_execution_anchor_revision(
            session, execution_revision.id
        )
    )
    newest_cg_review = cg_reviews[0] if cg_reviews else None
    cg_review_payload: dict[str, Any] | None = None
    if newest_cg_review is not None:
        output = newest_cg_review.review_output
        cg_review_payload = {
            "id": str(newest_cg_review.id),
            "executive_summary": output["executive_summary"],
            "actionable_requirements": [
                item["summary"] for item in output["actionable_requirements"]
            ],
            "technical_concerns": [item["summary"] for item in output["technical_concerns"]],
            "coordination_concerns": [item["summary"] for item in output["coordination_concerns"]],
            "implementation_priorities": [
                item["summary"] for item in output["implementation_priorities"]
            ],
            "proposed_execution_guidance": [
                {"guidance": item["guidance"], "underlying_intent": item["underlying_intent"]}
                for item in output["proposed_execution_guidance"]
            ],
            "evidence_gaps": output["evidence_gaps"],
        }

    decisions: list[Decision] = []
    if confirmed_core_revision is not None:
        decisions.extend(
            await _decisions_for(session, "core_anchor_revision", [confirmed_core_revision.id])
        )
    decisions.extend(
        await _decisions_for(session, "execution_anchor_revision", [execution_revision.id])
    )
    decisions_payload = [_decision_payload(d) for d in decisions]

    # HumanGate resolution facts, informational only -- not a citable
    # evidence source_type of their own (see contract module docstring);
    # the underlying Decision each produced is what may be cited.
    core_human_gate_payload: dict[str, Any] | None = None
    if confirmed_core_revision is not None:
        core_gate = await human_gate_service.get_gate_for_revision(
            session, confirmed_core_revision.id
        )
        if core_gate is not None:
            core_human_gate_payload = {
                "gate_type": core_gate.gate_type,
                "status": core_gate.status,
                "resolved_by_role": core_gate.resolved_by_role,
                "decision_id": (
                    str(core_gate.decision_id) if core_gate.decision_id is not None else None
                ),
            }

    execution_human_gate_payload: dict[str, Any] | None = None
    execution_gate = await human_gate_service.get_gate_for_execution_anchor_revision(
        session, execution_revision.id
    )
    if execution_gate is not None:
        execution_human_gate_payload = {
            "gate_type": execution_gate.gate_type,
            "status": execution_gate.status,
            "resolved_by_role": execution_gate.resolved_by_role,
            "decision_id": (
                str(execution_gate.decision_id) if execution_gate.decision_id is not None else None
            ),
        }

    return {
        "project": project_payload,
        "shot": shot_payload,
        "task": task_payload,
        "version": version_payload,
        "intent_brief": brief_payload,
        "intent_decomposition": decomposition_payload,
        "core_anchor": core_anchor_payload,
        "context_reconstruction": reconstruction_payload,
        "execution_anchor": execution_anchor_payload,
        "vfx_supervisor_review": vfx_review_payload,
        "cg_supervisor_review": cg_review_payload,
        "decisions": decisions_payload,
        "core_anchor_human_gate": core_human_gate_payload,
        "execution_anchor_human_gate": execution_human_gate_payload,
    }


def _collect_known_ids(node: Any) -> set[str]:
    ids: set[str] = set()
    if isinstance(node, dict):
        for key, value in node.items():
            if key == "id" and isinstance(value, str):
                ids.add(value)
            else:
                ids.update(_collect_known_ids(value))
    elif isinstance(node, list):
        for item in node:
            ids.update(_collect_known_ids(item))
    return ids


def _validate_evidence_resolves_to_snapshot(
    output: ArtistAgentGuidanceOutput, snapshot_payload: dict[str, Any]
) -> None:
    """Every evidence reference the generator produced must cite an id
    genuinely present in this run's own ContextSnapshot -- never an
    invented id or one from a different Shot/Task/Version/run.
    """
    known_ids = _collect_known_ids(snapshot_payload)
    items: list[ArtistGuidanceItem | ArtistFeedbackTranslation] = [
        output.creative_intent_read,
        output.task_goal,
        output.current_iteration_read,
        *output.non_negotiables,
        *output.allowed_variations,
        *output.feedback_translations,
        *output.iteration_priorities,
        *output.cross_department_dependencies,
    ]
    for item in items:
        for reference in item.evidence:
            if reference.source_id not in known_ids:
                raise AgentGenerationError(
                    "Artist Agent guidance cited an id not present in this Version's "
                    f"ContextSnapshot (source_type={reference.source_type!r})"
                )


# Content-boundary hardening -- same bounded, testable vocabulary
# discipline established for the CG Supervisor Agent (Step 4), extended
# to also cover the Execution Anchor and Version pass/fail/ranking,
# since the Artist Agent's authority is bounded even further than the CG
# Supervisor Agent's. Scoped to this capability only.
_INSPECTION_UNAVAILABLE_TERMS: Final = (
    "no direct",
    "not directly inspected",
    "not been inspected",
    "not inspected",
    "no access",
    "unavailable",
    "not available",
    "cannot inspect",
    "does not inspect",
    "no inspection",
)
_MEDIA_SCENE_TERMS: Final = (
    "footage",
    "moving image",
    "moving-image",
    "frame",
    "render",
    "scene file",
    "scene/project",
    "project file",
    "dcc file",
    "dcc project",
    "media",
    "parameter",
)
# Anchor-phrase fragment shared by every pattern below -- matches "Core
# Anchor", "Execution Anchor", or a bare "the Anchor"/"an Anchor" (real
# generated text and the required test phrases both use the bare form
# at times, e.g. "revise the Anchor before submission").
_ANCHOR_PHRASE = r"(?:core\s+|execution\s+)?anchor"
# Precise inflections of "revise" only -- a bare `revis\w*` stem would
# also match "revision" (as in "the confirmed Core Anchor revision"),
# which is an explicitly allowed evidence statement, not an instruction.
_REVISE_VERB = r"revis(?:e|ed|es|ing)"

# Direct-object modification verbs: "update the Core Anchor", "the
# Execution Anchor should be updated", "revise the Anchor before
# submission" -- no preposition required, matched bidirectionally (verb
# before or after the Anchor phrase) since real generated text uses both
# orders.
_ANCHOR_DIRECT_MODIFICATION_PATTERN: Final = re.compile(
    rf"\b(?:update|modify|chang|replac|supersed|{_REVISE_VERB})\w*\b[^.]{{0,40}}\b{_ANCHOR_PHRASE}\b"
    rf"|\b{_ANCHOR_PHRASE}\b[^.]{{0,40}}\b(?:update|modify|chang|replac|supersed|{_REVISE_VERB})\w*\b",
    re.IGNORECASE,
)
# Content-addition verbs are only forbidden when paired with their
# natural preposition ("to"/"in" the Anchor) -- matching them
# unconstrained would reject a legitimate evidence statement like "This
# constraint was recorded on the confirmed Core Anchor revision" (citing
# where evidence already lives, not instructing new content), which
# remains explicitly allowed.
_ANCHOR_CONTENT_ADDITION_PATTERN: Final = re.compile(
    r"\b(add|includ|record|document|encod|formalis|formaliz|captur|populat)\w*\b"
    rf"[^.]{{0,40}}?\b(?:to|in)\s+(?:the\s+|an\s+)?{_ANCHOR_PHRASE}\b",
    re.IGNORECASE,
)
# "the Anchor should include...", "needs to specify...", "must define..."
_ANCHOR_DIRECTIVE_PATTERN: Final = re.compile(
    rf"\b{_ANCHOR_PHRASE}\b\s+(?:should|needs?\s+to|must)\s+(?:includ|specify|specif|defin)\w*\b",
    re.IGNORECASE,
)
# "populate an Anchor field", "revise the allowed_refinements field" --
# covers both a bare Anchor-field reference and any known Core/Execution
# Anchor field name (underscore or space form).
_ANCHOR_FIELD_NAME_ALTERNATION: Final = "|".join(
    field.replace("_", "[ _]")
    for field in (*CORE_ANCHOR_CONTENT_FIELDS, *_EXECUTION_ANCHOR_SNAPSHOT_FIELDS)
)
_ANCHOR_FIELD_MODIFICATION_PATTERN: Final = re.compile(
    rf"\b(?:add|includ|record|document|encod|formalis|formaliz|captur|populat|{_REVISE_VERB})\w*\b"
    rf"[^.]{{0,40}}?\b(?:{_ANCHOR_PHRASE}\s+field|{_ANCHOR_FIELD_NAME_ALTERNATION})\b",
    re.IGNORECASE,
)
_REANCHOR_PATTERN: Final = re.compile(r"\bre[\s-]?anchor\b", re.IGNORECASE)
_HUMANGATE_RESOLUTION_TERMS: Final = (
    "confirm the humangate",
    "confirm this humangate",
    "reject the humangate",
    "reject this humangate",
    "confirm the human gate",
    "reject the human gate",
    "confirm the gate",
    "reject the gate",
    "should confirm the",
    "should reject the",
    "recommend confirming",
    "recommend rejecting",
)
_DECISION_AUTHORITY_TERMS: Final = (
    "create a decision",
    "issue a decision",
    "create an authoritative decision",
    "issue an authoritative decision",
    "make the decision",
    "authoritative decision should",
)
_VERSION_JUDGMENT_TERMS: Final = (
    "officially approve",
    "officially reject",
    "officially pass",
    "officially fail",
    "should pass review",
    "should fail review",
    "best overall",
    "definitive best",
    "best version",
    "ranks highest",
    "the winning version",
)


def _forbidden_authority_reason(text: str) -> str | None:
    """Returns a short, sanitised reason if `text` instructs the reader
    to modify an Anchor (directly, by adding/recording/documenting
    content into it, by directive phrasing, or by naming one of its
    fields), re-anchor, resolve a HumanGate, issue an authoritative
    Decision, or officially judge/rank a Version -- all outside this
    capability's bounded advisory scope -- else ``None``. Merely
    mentioning an Anchor as evidence, describing it as incomplete or
    ambiguous, or suggesting coordination with a Human Supervisor, does
    not match any of these patterns.
    """
    lowered = text.lower()
    if _ANCHOR_DIRECT_MODIFICATION_PATTERN.search(lowered):
        return "instructs modifying an Anchor"
    if _ANCHOR_CONTENT_ADDITION_PATTERN.search(lowered):
        return "instructs adding content to an Anchor"
    if _ANCHOR_DIRECTIVE_PATTERN.search(lowered):
        return "instructs adding content to an Anchor"
    if _ANCHOR_FIELD_MODIFICATION_PATTERN.search(lowered):
        return "instructs adding content to an Anchor"
    if _REANCHOR_PATTERN.search(lowered):
        return "instructs a re-anchor action"
    if any(term in lowered for term in _HUMANGATE_RESOLUTION_TERMS):
        return "instructs resolving a HumanGate"
    if any(term in lowered for term in _DECISION_AUTHORITY_TERMS):
        return "instructs creating an authoritative Decision"
    if any(term in lowered for term in _VERSION_JUDGMENT_TERMS):
        return "instructs an official Version pass/fail/ranking judgment"
    return None


def _validate_content_boundaries(output: ArtistAgentGuidanceOutput) -> None:
    """Step 5 content-boundary hardening, run after
    ``ArtistAgentGuidanceOutput`` parsing/evidence validation and before
    ``ArtistAgentGuidance`` persistence:

    A. ``evidence_gaps`` must explicitly disclose the missing direct
       footage/rendered-frame/scene-or-project-file/parameter inspection
       boundary.
    B. ``non_negotiables``, ``allowed_variations``,
       ``feedback_translations`` (including ``self_check``),
       ``iteration_priorities``, ``cross_department_dependencies``, and
       ``questions_for_human_supervisor`` must never instruct modifying
       an Anchor, re-anchoring, resolving a HumanGate, issuing an
       authoritative Decision, or officially judging/ranking a Version.

    Raises ``AgentGenerationError`` with a short, sanitised reason on
    violation -- never the offending text itself, matching
    ``_validate_evidence_resolves_to_snapshot``'s own convention.
    """
    gaps_text = " ".join(output.evidence_gaps).lower()
    has_unavailable_concept = any(term in gaps_text for term in _INSPECTION_UNAVAILABLE_TERMS)
    has_media_concept = any(term in gaps_text for term in _MEDIA_SCENE_TERMS)
    if not (has_unavailable_concept and has_media_concept):
        raise AgentGenerationError(
            "Artist Agent guidance did not explicitly disclose the missing direct "
            "footage/rendered-frame/scene-or-project-file/parameter inspection boundary in "
            "evidence_gaps"
        )

    checked_texts: list[str] = []
    for item in (*output.non_negotiables, *output.allowed_variations):
        checked_texts.append(item.summary)
        checked_texts.append(item.why_it_matters)
    for translation in output.feedback_translations:
        checked_texts.append(translation.feedback_or_issue)
        checked_texts.append(translation.practical_action)
        checked_texts.append(translation.underlying_intent)
        checked_texts.append(translation.self_check)
    for priority_item in output.iteration_priorities:
        checked_texts.append(priority_item.summary)
        checked_texts.append(priority_item.why_it_matters)
    for dependency_item in output.cross_department_dependencies:
        checked_texts.append(dependency_item.summary)
        checked_texts.append(dependency_item.why_it_matters)
    checked_texts.extend(output.questions_for_human_supervisor)

    for text in checked_texts:
        reason = _forbidden_authority_reason(text)
        if reason is not None:
            raise AgentGenerationError(
                f"Artist Agent guidance exceeded its bounded advisory scope: {reason}"
            )


async def generate_artist_agent_guidance(
    session: AsyncSession,
    actor: ActorContext,
    version_id: uuid.UUID,
    task_id: uuid.UUID,
    *,
    generator: ArtistGuidanceGenerator | None = None,
) -> ArtistAgentGuidance:
    # Authoritative check: enforced here regardless of what the router
    # does. Generating Artist Agent guidance is explicitly Human Artist
    # only -- no agent actor is ever accepted here.
    require_human_role(actor, _GENERATE_ROLES)

    version = await session.get(Version, version_id)
    if version is None:
        raise NotFoundError("Version not found")

    shot = await session.get(Shot, version.shot_id)
    if shot is None:
        raise InternalConsistencyError(
            f"Version {version_id} references missing Shot {version.shot_id}"
        )

    task = await session.get(Task, task_id)
    if task is None or task.shot_id != shot.id:
        raise NotFoundError(
            "Task not found for this Version's Shot -- Version has no task_id of its own, "
            "so the supplied task_id must belong to the same Shot as the Version"
        )

    project = await session.get(Project, shot.project_id)
    if project is None:
        raise InternalConsistencyError(
            f"Shot {shot.id} references missing Project {shot.project_id}"
        )

    core_anchor = await core_anchor_service.get_core_anchor_for_shot(session, shot.id)
    all_core_revisions = (
        await core_anchor_service.list_revisions_for_shot(session, shot.id)
        if core_anchor is not None
        else []
    )
    confirmed_core_revision = next(
        (
            revision
            for revision in all_core_revisions
            if core_anchor is not None
            and revision.id == core_anchor.active_revision_id
            and revision.status == "confirmed"
        ),
        None,
    )
    if confirmed_core_revision is None:
        raise ConflictError(
            "Artist Agent guidance requires a confirmed Core Anchor revision for this "
            "Shot; the VFX Supervisor must confirm shared direction first"
        )

    execution_anchor = await get_execution_anchor_for_task(session, task_id)
    all_execution_revisions = (
        await list_revisions_for_task(session, task_id) if execution_anchor is not None else []
    )
    confirmed_execution_revision = next(
        (r for r in all_execution_revisions if r.status == "confirmed"), None
    )
    if confirmed_execution_revision is None:
        raise ConflictError(
            "Artist Agent guidance requires a confirmed Execution Anchor revision for this "
            "Task; none exists yet (a draft or rejected revision is never used)"
        )

    payload = await _build_context_snapshot_payload(
        session,
        version=version,
        task=task,
        execution_revision=confirmed_execution_revision,
        shot=shot,
        project=project,
    )

    resolved_generator = generator
    if resolved_generator is None:
        # Package C follow-up (owner-flow generator audit): a late-
        # bound, function-local import -- `demo_seed.d1_scenario`
        # already imports this module at its own top level, so a
        # module-level import here would be circular. Returns non-None
        # only for the exact canonical Package C D1 Journey Project/
        # Shot/Task identity -- deliberately regardless of the ambient
        # configured provider, exactly mirroring `cg_supervisor_review_
        # service.generate_cg_supervisor_review`'s own dispatch rule.
        from intent_core_api.demo_seed.d1_scenario import (
            resolve_canonical_d1_artist_guidance_generator,
        )

        resolved_generator = await resolve_canonical_d1_artist_guidance_generator(
            session, project_id=project.id, shot_id=shot.id, task_id=task.id
        )

    async def _persist(
        session: AsyncSession,
        snapshot: ContextSnapshot,
        run: AgentRun,
        output: ArtistAgentGuidanceOutput,
    ) -> ArtistAgentGuidance:
        _validate_evidence_resolves_to_snapshot(output, payload)
        _validate_content_boundaries(output)
        guidance = ArtistAgentGuidance(
            project_id=project.id,
            shot_id=shot.id,
            task_id=task.id,
            version_id=version.id,
            execution_anchor_revision_id=confirmed_execution_revision.id,
            context_snapshot_id=snapshot.id,
            agent_run_id=run.id,
            guidance_output=output.model_dump(mode="json"),
        )
        session.add(guidance)
        await session.commit()
        await session.refresh(guidance)
        return guidance

    provider, model_name, prompt_version = prompt_registry.execution_metadata(
        _CAPABILITY_ITERATION_GUIDANCE
    )
    spec = AgentExecutionSpec(
        shot_id=shot.id,
        agent_type=_AGENT_TYPE_ARTIST_AGENT,
        capability=_CAPABILITY_ITERATION_GUIDANCE,
        provider=provider,
        model_name=model_name,
        prompt_version=prompt_version,
        snapshot_payload=payload,
        resolve_generator=lambda: (
            resolved_generator if resolved_generator is not None else _get_generator()
        ),
        persist_result=_persist,
        failure_label="Artist Agent iteration guidance generation",
    )
    return await execute_agent(session, spec)


async def get_artist_agent_guidance(
    session: AsyncSession, guidance_id: uuid.UUID
) -> ArtistAgentGuidance | None:
    return await session.get(ArtistAgentGuidance, guidance_id)


async def list_artist_agent_guidances_for_version(
    session: AsyncSession, version_id: uuid.UUID
) -> list[ArtistAgentGuidance]:
    result = await session.execute(
        select(ArtistAgentGuidance)
        .where(ArtistAgentGuidance.version_id == version_id)
        .order_by(ArtistAgentGuidance.created_at.desc())
    )
    return list(result.scalars().all())
