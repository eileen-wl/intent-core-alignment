"""Core Agent: the ``cross_role_assessment`` capability (Step 6) -- a
fifth Core Agent capability, not a fifth Agent and not a Role Agent.

Synthesises the complete recorded evidence chain for one Version's
explicit Task context -- the confirmed Core Anchor, the confirmed
Execution Anchor, the newest VFX Supervisor Agent review, the newest CG
Supervisor Agent review, and the newest Artist Agent guidance -- into an
immutable, advisory ``CrossRoleAssessment``: where the three recorded
role perspectives agree, where they differ, where one department's
recorded position may optimise locally at the expense of the shared
creative intent, which dependencies remain unresolved, and whether the
current Core Anchor looks sufficiently clear for the evidence now
available. Every successful assessment also creates exactly one
deterministic, explainable ``IntentSignal`` (never itself an Agent run)
and, only when a bounded set of evidence-diversity rules are satisfied,
an advisory ``ReAnchorProposal`` (never a ``CoreAnchorRevision``, never
an automatic write) -- see ``derive_intent_signal`` and
``_validate_re_anchor_proposal`` respectively.

Mandatory distinctions (see docs/AGENT_CONTRACTS.md): this is the same
Core Agent that already performs core-anchor-drafting, intent-
decomposition, context-reconstruction, and alignment-assessment -- not a
new Agent type, not the VFX Supervisor Agent, not the CG Supervisor
Agent, and not the Artist Agent. It never establishes, modifies,
confirms, rejects, replaces, or supersedes either Anchor, never resolves
a HumanGate, never creates an authoritative Decision, and never triggers
a Role Agent or writes to ftrack -- the only domain-mutating calls this
module makes are creating a ContextSnapshot/AgentRun/CrossRoleAssessment
row and, atomically alongside it, an optional ReAnchorProposal row and a
required IntentSignal row. Its output is advisory evidence only.

``Version`` has no ``task_id`` of its own (same Step 5 domain decision:
a Shot may have several Tasks and several Versions with no join between
them), so the caller supplies ``task_id`` explicitly at generation time.
Generation requires a confirmed CoreAnchorRevision, a confirmed
ExecutionAnchorRevision for the supplied Task, a VFXSupervisorReview for
the target Version, a CGSupervisorReview for that confirmed Execution
Anchor revision, and an ArtistAgentGuidance for the target Version and
supplied Task -- any missing prerequisite is rejected before any
ContextSnapshot or AgentRun is created.

This repository does not inspect footage, frames, renders, scene/DCC
files, or numeric production parameters -- every structured conclusion
this capability produces must cite real evidence already present in the
snapshot, and ``evidence_gaps`` must honestly record the missing-
evidence limitation; see ``DeterministicCrossRoleAssessmentGenerator``
and the registered system prompt (``agents.prompt_registry``, capability
``cross_role_assessment``) for exactly how that boundary is enforced.
"""

from __future__ import annotations

import json
import re
import uuid
from typing import Any, Final, Protocol

from intent_core_contracts.api.cross_role_assessment import (
    CrossRoleAssessmentOutput,
    CrossRoleEvidenceReference,
    CrossRoleEvidenceSourceType,
    CrossRoleFinding,
    IntentSignalDriver,
    IntentSignalOutput,
    ReAnchorProposalOutput,
    RoleCoverage,
    RolePerspectiveRead,
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
from intent_core_api.versions_and_feedback.models import (
    ArtistAgentGuidance,
    CrossRoleAssessment,
    IntentSignal,
    ReAnchorProposal,
    Version,
)
from intent_core_api.workflow.actors import ActorContext, AgentType, HumanRole, require_human_role
from intent_core_api.workflow.exceptions import (
    AgentGenerationError,
    ConflictError,
    InternalConsistencyError,
    NotFoundError,
)
from intent_core_api.workflow.models import Decision

_CAPABILITY_CROSS_ROLE_ASSESSMENT = "cross_role_assessment"
_AGENT_TYPE_CORE_AGENT: Final[AgentType] = "core_agent"
_GENERATE_ROLES: frozenset[HumanRole] = frozenset({"vfx_supervisor"})

_EXECUTION_ANCHOR_SNAPSHOT_FIELDS: Final = (
    "technical_boundaries",
    "parameter_ranges",
    "allowed_refinements",
    "delivery_conditions",
    "downstream_dependencies",
    "escalation_conditions",
)
_ROLE_CATEGORY_SOURCE_TYPES: Final = (
    "vfx_supervisor_review",
    "cg_supervisor_review",
    "artist_agent_guidance",
)


class CrossRoleAssessmentGenerator(Protocol):
    """Pure input -> output: no DB/session access, no ftrack access, no
    ability to touch either Anchor, a HumanGate, a Decision, or a Role
    Agent. Whatever it returns is persisted as-is into an immutable
    CrossRoleAssessment row (plus its derived IntentSignal and optional
    ReAnchorProposal).
    """

    def generate(self, *, snapshot_payload: dict[str, Any]) -> CrossRoleAssessmentOutput: ...


def _evidence(
    source_type: CrossRoleEvidenceSourceType, source_id: str, label: str
) -> CrossRoleEvidenceReference:
    return CrossRoleEvidenceReference(source_type=source_type, source_id=source_id, label=label)


# Mirrors intent_core_contracts.api.cross_role_assessment's Field length
# limits exactly -- kept here as plain constants rather than introspected
# from the pydantic model so the deterministic generator's intent stays
# readable; if the contract's bounds ever change, update both together.
_SUMMARY_LIMIT: Final = 280
_WHY_LIMIT: Final = 420
_PERSPECTIVE_TEXT_LIMIT: Final = 360
_PROPOSAL_TEXT_LIMIT: Final = 420
_NOTE_LIMIT: Final = 280
_EXECUTIVE_SUMMARY_LIMIT: Final = 700


def _bounded(text: str, *, limit: int) -> str:
    """Keeps deterministic output within the bounded contract's string
    limits regardless of how long the underlying recorded text is --
    never silently drops the field, just shortens it with a visible
    marker rather than letting Pydantic reject the whole assessment.
    """
    if len(text) <= limit:
        return text
    ellipsis = "…"
    return text[: limit - len(ellipsis)] + ellipsis


class DeterministicCrossRoleAssessmentGenerator:
    """Offline, deterministic dev/test adapter: no network call, no API
    key, same output for the same input every time. Reads the actual
    supplied snapshot structure and cites real ids from it, honestly
    reporting the missing-media/technical-evidence limitation and never
    inventing a render/scene-level observation -- same convention as
    ``DeterministicArtistGuidanceGenerator``. Deliberately keeps every
    finding at "low"/"medium" priority and never proposes a re-anchor --
    the "high"-attention and re-anchor-proposal code paths are exercised
    by dedicated fixtures in the test suite, not by this generator.
    """

    def generate(self, *, snapshot_payload: dict[str, Any]) -> CrossRoleAssessmentOutput:
        shot = snapshot_payload["shot"]
        core_anchor = snapshot_payload["core_anchor"]
        confirmed_core_revision = core_anchor["confirmed_revision"]
        vfx_review = snapshot_payload["vfx_supervisor_review"]
        cg_review = snapshot_payload["cg_supervisor_review"]
        artist_guidance = snapshot_payload["artist_agent_guidance"]
        label = "[Cross-role deterministic]"

        shared_intent_read = CrossRoleFinding(
            summary=_bounded(
                f"{label} Shared intent: {confirmed_core_revision['core_summary']}",
                limit=_SUMMARY_LIMIT,
            ),
            why_it_matters=_bounded(
                f"{label} This is the Shot's currently confirmed Core Anchor revision, which "
                "all three recorded role outputs are expected to serve.",
                limit=_WHY_LIMIT,
            ),
            affected_roles=["vfx_supervisor", "cg_supervisor", "artist"],
            priority="high",
            evidence=[
                _evidence(
                    "core_anchor_revision",
                    confirmed_core_revision["id"],
                    f"Confirmed Core Anchor revision {confirmed_core_revision['id']}",
                )
            ],
        )

        role_perspectives = [
            RolePerspectiveRead(
                role="vfx_supervisor",
                current_position=_bounded(
                    f"{label} {vfx_review['executive_summary']}", limit=_PERSPECTIVE_TEXT_LIMIT
                ),
                protected_intent=_bounded(
                    f"{label} Preserve the confirmed creative direction: "
                    f"{confirmed_core_revision['core_summary']}",
                    limit=_PERSPECTIVE_TEXT_LIMIT,
                ),
                main_concerns=_bounded(
                    f"{label} "
                    + (
                        vfx_review["creative_concerns"][0]
                        if vfx_review["creative_concerns"]
                        else "No recorded creative concerns for this Version."
                    ),
                    limit=_PERSPECTIVE_TEXT_LIMIT,
                ),
                evidence=[
                    _evidence(
                        "vfx_supervisor_review", vfx_review["id"], f"VFX review {vfx_review['id']}"
                    )
                ],
            ),
            RolePerspectiveRead(
                role="cg_supervisor",
                current_position=_bounded(
                    f"{label} {cg_review['executive_summary']}", limit=_PERSPECTIVE_TEXT_LIMIT
                ),
                protected_intent=_bounded(
                    f"{label} Deliver a technically executable result for this Task.",
                    limit=_PERSPECTIVE_TEXT_LIMIT,
                ),
                main_concerns=_bounded(
                    f"{label} "
                    + (
                        cg_review["technical_concerns"][0]
                        if cg_review["technical_concerns"]
                        else "No recorded technical concerns for this Execution Anchor revision."
                    ),
                    limit=_PERSPECTIVE_TEXT_LIMIT,
                ),
                evidence=[
                    _evidence(
                        "cg_supervisor_review", cg_review["id"], f"CG review {cg_review['id']}"
                    )
                ],
            ),
            RolePerspectiveRead(
                role="artist",
                current_position=_bounded(
                    f"{label} {artist_guidance['executive_summary']}",
                    limit=_PERSPECTIVE_TEXT_LIMIT,
                ),
                protected_intent=_bounded(
                    f"{label} Complete the current iteration without breaking recorded "
                    "non-negotiables.",
                    limit=_PERSPECTIVE_TEXT_LIMIT,
                ),
                main_concerns=_bounded(
                    f"{label} "
                    + (
                        artist_guidance["questions_for_human_supervisor"][0]
                        if artist_guidance["questions_for_human_supervisor"]
                        else "No recorded open questions from the Artist Agent guidance."
                    ),
                    limit=_PERSPECTIVE_TEXT_LIMIT,
                ),
                evidence=[
                    _evidence(
                        "artist_agent_guidance",
                        artist_guidance["id"],
                        f"Artist guidance {artist_guidance['id']}",
                    )
                ],
            ),
        ]

        agreements = [
            CrossRoleFinding(
                summary=_bounded(
                    f"{label} All three recorded role outputs reference the same confirmed "
                    "Core Anchor revision.",
                    limit=_SUMMARY_LIMIT,
                ),
                why_it_matters=_bounded(
                    f"{label} A shared point of reference reduces the risk of independently "
                    "drifting interpretations.",
                    limit=_WHY_LIMIT,
                ),
                affected_roles=["vfx_supervisor", "cg_supervisor", "artist"],
                priority="low",
                evidence=[
                    _evidence(
                        "core_anchor_revision",
                        confirmed_core_revision["id"],
                        f"Confirmed Core Anchor revision {confirmed_core_revision['id']}",
                    )
                ],
            )
        ]

        cross_role_tensions: list[CrossRoleFinding] = []
        if cg_review["coordination_concerns"]:
            cross_role_tensions.append(
                CrossRoleFinding(
                    summary=_bounded(
                        f"{label} CG Supervisor Agent recorded a coordination concern that may "
                        "affect the Artist's current iteration.",
                        limit=_SUMMARY_LIMIT,
                    ),
                    why_it_matters=_bounded(
                        f"{label} {cg_review['coordination_concerns'][0]}", limit=_WHY_LIMIT
                    ),
                    affected_roles=["cg_supervisor", "artist"],
                    priority="medium",
                    evidence=[
                        _evidence(
                            "cg_supervisor_review", cg_review["id"], f"CG review {cg_review['id']}"
                        ),
                        _evidence(
                            "artist_agent_guidance",
                            artist_guidance["id"],
                            f"Artist guidance {artist_guidance['id']}",
                        ),
                    ],
                )
            )

        local_optimum_risks: list[CrossRoleFinding] = []
        if cg_review["technical_concerns"] and vfx_review["creative_concerns"]:
            local_optimum_risks.append(
                CrossRoleFinding(
                    summary=_bounded(
                        f"{label} Technical execution concerns and creative concerns are both "
                        "recorded independently; resolving one alone risks the other.",
                        limit=_SUMMARY_LIMIT,
                    ),
                    why_it_matters=_bounded(
                        f"{label} Optimising the Execution Anchor for technical delivery without "
                        "checking the VFX Supervisor Agent's creative concerns could satisfy one "
                        "department at the expense of the shared intent.",
                        limit=_WHY_LIMIT,
                    ),
                    affected_roles=["vfx_supervisor", "cg_supervisor"],
                    priority="medium",
                    evidence=[
                        _evidence(
                            "vfx_supervisor_review",
                            vfx_review["id"],
                            f"VFX review {vfx_review['id']}",
                        ),
                        _evidence(
                            "cg_supervisor_review", cg_review["id"], f"CG review {cg_review['id']}"
                        ),
                    ],
                )
            )

        unresolved_dependencies: list[CrossRoleFinding] = []
        if artist_guidance["evidence_gaps"] and cg_review["evidence_gaps"]:
            unresolved_dependencies.append(
                CrossRoleFinding(
                    summary=_bounded(
                        f"{label} Both the CG Supervisor Agent review and the Artist Agent "
                        "guidance record unresolved evidence gaps for this Task.",
                        limit=_SUMMARY_LIMIT,
                    ),
                    why_it_matters=_bounded(
                        f"{label} Neither role has the missing evidence, so resolving it likely "
                        "requires human coordination rather than either role acting alone.",
                        limit=_WHY_LIMIT,
                    ),
                    affected_roles=["cg_supervisor", "artist"],
                    priority="low",
                    evidence=[
                        _evidence(
                            "cg_supervisor_review", cg_review["id"], f"CG review {cg_review['id']}"
                        ),
                        _evidence(
                            "artist_agent_guidance",
                            artist_guidance["id"],
                            f"Artist guidance {artist_guidance['id']}",
                        ),
                    ],
                )
            )

        human_coordination_priorities: list[CrossRoleFinding] = []
        if cg_review["implementation_priorities"]:
            human_coordination_priorities.append(
                CrossRoleFinding(
                    summary=_bounded(
                        f"{label} Confirm the CG Supervisor Agent's top implementation priority "
                        "with the Human Artist before the next iteration.",
                        limit=_SUMMARY_LIMIT,
                    ),
                    why_it_matters=_bounded(
                        f"{label} {cg_review['implementation_priorities'][0]}", limit=_WHY_LIMIT
                    ),
                    affected_roles=["cg_supervisor", "artist"],
                    priority="medium",
                    evidence=[
                        _evidence(
                            "cg_supervisor_review", cg_review["id"], f"CG review {cg_review['id']}"
                        )
                    ],
                )
            )

        evidence_gaps = [
            _bounded(
                f"{label} ICAS has not directly inspected footage, moving-image media, "
                "rendered frames, still images, scene/project/DCC files, or numeric or "
                "pipeline-specific production parameters; this assessment is based solely on "
                "recorded text metadata and upstream Agent output.",
                limit=_NOTE_LIMIT,
            )
        ]
        if not confirmed_core_revision["open_questions"]:
            pass  # an empty list is a valid, honest state -- no gap to record
        else:
            evidence_gaps.append(
                _bounded(
                    f"{label} The confirmed Core Anchor still has open questions recorded "
                    f"({shot['name']}).",
                    limit=_NOTE_LIMIT,
                )
            )

        executive_summary = _bounded(
            f"{label} {len(cross_role_tensions)} cross-role tension(s), "
            f"{len(local_optimum_risks)} local-optimum risk(s), and "
            f"{len(unresolved_dependencies)} unresolved dependency(ies) considered across the "
            "VFX Supervisor Agent, CG Supervisor Agent, and Artist Agent recorded output.",
            limit=_EXECUTIVE_SUMMARY_LIMIT,
        )

        return CrossRoleAssessmentOutput(
            executive_summary=executive_summary,
            shared_intent_read=shared_intent_read,
            role_perspectives=role_perspectives,
            agreements=agreements,
            cross_role_tensions=cross_role_tensions,
            local_optimum_risks=local_optimum_risks,
            unresolved_dependencies=unresolved_dependencies,
            human_coordination_priorities=human_coordination_priorities,
            re_anchor_proposal=None,
            evidence_gaps=evidence_gaps,
        )


class DeepSeekCrossRoleAssessmentGenerator:
    """Same DeepSeek integration path as every other capability's
    real-provider adapter (official ``openai`` package pointed at
    DeepSeek's OpenAI-compatible endpoint, via the shared
    ``agents.model_gateway`` -- see ADR-0013) -- one non-streaming
    JSON-mode call, validated against ``CrossRoleAssessmentOutput``
    explicitly. Model name comes from ``Settings.model_name`` (never
    hardcoded).
    """

    def __init__(self, *, api_key: str, model_name: str) -> None:
        self._api_key = api_key
        self._model_name = model_name

    def generate(self, *, snapshot_payload: dict[str, Any]) -> CrossRoleAssessmentOutput:
        registration = prompt_registry.get_registration(_CAPABILITY_CROSS_ROLE_ASSESSMENT)
        return model_gateway.generate_deepseek(
            api_key=self._api_key,
            model_name=self._model_name,
            system_prompt=registration.system_prompt,
            user_content=(
                "Produce a cross-role assessment for this Version's Task context. Respond with "
                "the JSON object described in the system prompt. Context (JSON):\n"
                + json.dumps(snapshot_payload, indent=2)
            ),
            output_model=CrossRoleAssessmentOutput,
            max_tokens=registration.max_output_tokens,
        )


def _get_generator() -> CrossRoleAssessmentGenerator:
    provider = model_gateway.resolve_provider_name()
    if provider == "deterministic":
        return DeterministicCrossRoleAssessmentGenerator()
    if provider == "deepseek":
        api_key, model_name = model_gateway.require_deepseek_settings()
        return DeepSeekCrossRoleAssessmentGenerator(api_key=api_key, model_name=model_name)
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
        "revision_number": revision.revision_number,
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


async def _newest_artist_guidance_for_version_and_task(
    session: AsyncSession, version_id: uuid.UUID, task_id: uuid.UUID
) -> ArtistAgentGuidance | None:
    result = await session.execute(
        select(ArtistAgentGuidance)
        .where(
            ArtistAgentGuidance.version_id == version_id,
            ArtistAgentGuidance.task_id == task_id,
        )
        .order_by(ArtistAgentGuidance.created_at.desc())
        .limit(1)
    )
    return result.scalars().first()


async def _build_context_snapshot_payload(
    session: AsyncSession,
    *,
    version: Version,
    task: Task,
    core_revision: CoreAnchorRevision,
    execution_revision: ExecutionAnchorRevision,
    vfx_review: Any,
    cg_review: Any,
    artist_guidance: ArtistAgentGuidance,
    shot: Shot,
    project: Project,
) -> dict[str, Any]:
    """Only locally persisted facts relevant to assessing the complete
    role chain for one Version/Task context -- no binary media, no
    thumbnails, no scene/project/DCC files, no raw/network-fetched
    ftrack payloads, no secrets, no unrelated Tasks or Versions. No
    ftrack sync is ever run to build this. Deliberately compact:
    newest-only where several records exist, summary-only where a
    nested record carries its own long evidence/rationale tree -- same
    discipline as the CG Supervisor Agent's and Artist Agent's snapshot
    builders.
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

    core_anchor_payload = {
        "id": str(core_revision.id),
        "confirmed_revision": _core_revision_payload(core_revision),
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

    vfx_output = vfx_review.review_output
    vfx_review_payload: dict[str, Any] = {
        "id": str(vfx_review.id),
        "executive_summary": vfx_output["executive_summary"],
        "creative_concerns": [item["summary"] for item in vfx_output["creative_concerns"]],
        "review_priorities": [item["summary"] for item in vfx_output["review_priorities"]],
        "proposed_feedback": [
            {"feedback": note["feedback"], "underlying_intent": note["underlying_intent"]}
            for note in vfx_output["proposed_feedback_notes"]
        ],
        "questions_for_human_supervisor": vfx_output["questions_for_human_supervisor"],
        "evidence_gaps": vfx_output["evidence_gaps"],
    }

    cg_output = cg_review.review_output
    cg_review_payload: dict[str, Any] = {
        "id": str(cg_review.id),
        "executive_summary": cg_output["executive_summary"],
        "actionable_requirements": [
            item["summary"] for item in cg_output["actionable_requirements"]
        ],
        "technical_concerns": [item["summary"] for item in cg_output["technical_concerns"]],
        "coordination_concerns": [item["summary"] for item in cg_output["coordination_concerns"]],
        "implementation_priorities": [
            item["summary"] for item in cg_output["implementation_priorities"]
        ],
        "proposed_execution_guidance": [
            {"guidance": item["guidance"], "underlying_intent": item["underlying_intent"]}
            for item in cg_output["proposed_execution_guidance"]
        ],
        "questions_for_human_cg_supervisor": cg_output["questions_for_human_cg_supervisor"],
        "evidence_gaps": cg_output["evidence_gaps"],
    }

    artist_output = artist_guidance.guidance_output
    artist_guidance_payload: dict[str, Any] = {
        "id": str(artist_guidance.id),
        "executive_summary": artist_output["executive_summary"],
        "creative_intent_summary": artist_output["creative_intent_read"]["summary"],
        "task_goal_summary": artist_output["task_goal"]["summary"],
        "current_iteration_summary": artist_output["current_iteration_read"]["summary"],
        "non_negotiables": [item["summary"] for item in artist_output["non_negotiables"]],
        "allowed_variations": [item["summary"] for item in artist_output["allowed_variations"]],
        "feedback_translations": [
            {
                "feedback_or_issue": t["feedback_or_issue"],
                "practical_action": t["practical_action"],
                "underlying_intent": t["underlying_intent"],
                "self_check": t["self_check"],
            }
            for t in artist_output["feedback_translations"]
        ],
        "iteration_priorities": [item["summary"] for item in artist_output["iteration_priorities"]],
        "cross_department_dependencies": [
            item["summary"] for item in artist_output["cross_department_dependencies"]
        ],
        "questions_for_human_supervisor": artist_output["questions_for_human_supervisor"],
        "evidence_gaps": artist_output["evidence_gaps"],
    }

    decisions = await _decisions_for(session, "core_anchor_revision", [core_revision.id])
    decisions.extend(
        await _decisions_for(session, "execution_anchor_revision", [execution_revision.id])
    )
    decisions_payload = [_decision_payload(d) for d in decisions]

    # HumanGate resolution facts, informational only -- not a citable
    # evidence source_type of their own (see contract module docstring);
    # the underlying Decision each produced is what may be cited.
    core_gate = await human_gate_service.get_gate_for_revision(session, core_revision.id)
    core_human_gate_payload = (
        {
            "gate_type": core_gate.gate_type,
            "status": core_gate.status,
            "resolved_by_role": core_gate.resolved_by_role,
            "decision_id": (
                str(core_gate.decision_id) if core_gate.decision_id is not None else None
            ),
        }
        if core_gate is not None
        else None
    )

    execution_gate = await human_gate_service.get_gate_for_execution_anchor_revision(
        session, execution_revision.id
    )
    execution_human_gate_payload = (
        {
            "gate_type": execution_gate.gate_type,
            "status": execution_gate.status,
            "resolved_by_role": execution_gate.resolved_by_role,
            "decision_id": (
                str(execution_gate.decision_id) if execution_gate.decision_id is not None else None
            ),
        }
        if execution_gate is not None
        else None
    )

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
        "artist_agent_guidance": artist_guidance_payload,
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
    output: CrossRoleAssessmentOutput, snapshot_payload: dict[str, Any]
) -> None:
    """Every evidence reference the generator produced must cite an id
    genuinely present in this run's own ContextSnapshot -- never an
    invented id or one from a different Shot/Task/Version/run.
    """
    known_ids = _collect_known_ids(snapshot_payload)
    items: list[CrossRoleFinding | RolePerspectiveRead] = [
        output.shared_intent_read,
        *output.role_perspectives,
        *output.agreements,
        *output.cross_role_tensions,
        *output.local_optimum_risks,
        *output.unresolved_dependencies,
        *output.human_coordination_priorities,
    ]
    for item in items:
        for reference in item.evidence:
            if reference.source_id not in known_ids:
                raise AgentGenerationError(
                    "Cross-role assessment cited an id not present in this Version's "
                    f"ContextSnapshot (source_type={reference.source_type!r})"
                )
    if output.re_anchor_proposal is not None:
        proposal = output.re_anchor_proposal
        for reference in proposal.evidence:
            if reference.source_id not in known_ids:
                raise AgentGenerationError(
                    "Cross-role assessment's re_anchor_proposal cited an id not present in "
                    f"this Version's ContextSnapshot (source_type={reference.source_type!r})"
                )
        for field_proposal in proposal.proposed_fields:
            for reference in field_proposal.evidence:
                if reference.source_id not in known_ids:
                    raise AgentGenerationError(
                        "Cross-role assessment's re_anchor_proposal cited an id not present "
                        f"in this Version's ContextSnapshot (source_type={reference.source_type!r})"
                    )


# Content-boundary hardening -- same bounded, testable vocabulary
# discipline established for the CG Supervisor Agent (Step 4) and the
# Artist Agent (Step 5). Scoped to this capability only.
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
_DIRECT_INSPECTION_CLAIM_TERMS: Final = (
    "i inspected",
    "i visually inspected",
    "i viewed the footage",
    "i watched the",
    "having inspected the footage",
    "after inspecting the render",
    "upon visual inspection",
)
_PASS_FAIL_VERDICT_TERMS: Final = (
    "officially passes",
    "officially fails",
    "officially approved",
    "officially rejected",
    "definitively aligned",
    "definitively misaligned",
    "definitively drifting",
    "is definitively",
    "should pass review",
    "should fail review",
)
_ROLE_BLAME_TERMS: Final = (
    "is to blame",
    "is at fault",
    "failed to do their job",
    "the fault lies with",
    "blame the",
)
_VERSION_RANKING_TERMS: Final = (
    "best overall",
    "definitive best",
    "best version",
    "ranks highest",
    "the winning version",
    "officially the best",
)
_ANCHOR_PHRASE = r"(?:core\s+|execution\s+)?anchor"
# Precise inflections of "revise" only -- a bare `revis\w*` stem would
# also match "revision" (as in "the confirmed Core Anchor revision"),
# which is an explicitly allowed evidence statement, not an instruction.
_REVISE_VERB = r"revis(?:e|ed|es|ing)"
_ANCHOR_DIRECT_MODIFICATION_PATTERN: Final = re.compile(
    rf"\b(?:update|modify|chang|replac|supersed|{_REVISE_VERB})\w*\b[^.]{{0,40}}\b{_ANCHOR_PHRASE}\b"
    rf"|\b{_ANCHOR_PHRASE}\b[^.]{{0,40}}\b(?:update|modify|chang|replac|supersed|{_REVISE_VERB})\w*\b",
    re.IGNORECASE,
)
_ANCHOR_CONTENT_ADDITION_PATTERN: Final = re.compile(
    r"\b(add|includ|record|document|encod|formalis|formaliz|captur|populat)\w*\b"
    rf"[^.]{{0,40}}?\b(?:to|in)\s+(?:the\s+|an\s+)?{_ANCHOR_PHRASE}\b",
    re.IGNORECASE,
)
_ANCHOR_DIRECTIVE_PATTERN: Final = re.compile(
    rf"\b{_ANCHOR_PHRASE}\b\s+(?:should|needs?\s+to|must)\s+(?:includ|specify|specif|defin)\w*\b",
    re.IGNORECASE,
)
_ANCHOR_FIELD_NAME_ALTERNATION: Final = "|".join(
    field.replace("_", "[ _]") for field in CORE_ANCHOR_CONTENT_FIELDS
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
    "a decision has already been made",
    "the decision has been made",
)


def _forbidden_authority_reason(text: str) -> str | None:
    """Returns a short, sanitised reason if `text` instructs the reader
    to modify an Anchor, re-anchor, resolve a HumanGate, issue an
    authoritative Decision, declare an official pass/fail verdict, blame
    a role, or rank a Version -- all outside this capability's bounded
    advisory scope -- else ``None``. Merely mentioning an Anchor as
    evidence, describing it as incomplete or ambiguous, or suggesting
    coordination with a Human Supervisor, does not match any of these
    patterns. This is the same check applied to ``re_anchor_proposal``'s
    own text, where anchor-modification phrasing is naturally expected
    but blame/gate/decision-authority phrasing is not.
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
        return "instructs or claims an authoritative Decision"
    if any(term in lowered for term in _PASS_FAIL_VERDICT_TERMS):
        return "declares an official pass/fail or definitive verdict"
    if any(term in lowered for term in _ROLE_BLAME_TERMS):
        return "assigns blame to a role"
    if any(term in lowered for term in _VERSION_RANKING_TERMS):
        return "ranks a Version as definitively best"
    if any(term in lowered for term in _DIRECT_INSPECTION_CLAIM_TERMS):
        return "claims direct media inspection"
    return None


def _validate_re_anchor_proposal(
    proposal: ReAnchorProposalOutput,
    output: CrossRoleAssessmentOutput,
    snapshot_payload: dict[str, Any],
) -> None:
    """Step 6 re-anchor evidence-diversity boundary (see §6 of the
    implementation spec): a proposal may be persisted only when its
    evidence spans at least two of the three role categories, also
    cites the current confirmed core_anchor_revision, and is supported
    by at least one cross_role_tension or local_optimum_risk elsewhere
    in this same response. Raises ``AgentGenerationError`` with a short,
    sanitised reason on violation -- never the offending text itself.
    """
    all_evidence: list[CrossRoleEvidenceReference] = list(proposal.evidence)
    for field_proposal in proposal.proposed_fields:
        all_evidence.extend(field_proposal.evidence)

    role_categories_cited = {
        ref.source_type for ref in all_evidence if ref.source_type in _ROLE_CATEGORY_SOURCE_TYPES
    }
    if len(role_categories_cited) < 2:
        raise AgentGenerationError(
            "Cross-role assessment's re_anchor_proposal relies on fewer than two distinct "
            "role evidence categories"
        )

    if not any(ref.source_type == "core_anchor_revision" for ref in all_evidence):
        raise AgentGenerationError(
            "Cross-role assessment's re_anchor_proposal does not cite the current confirmed "
            "Core Anchor revision as evidence"
        )

    if not (output.cross_role_tensions or output.local_optimum_risks):
        raise AgentGenerationError(
            "Cross-role assessment's re_anchor_proposal is not supported by any "
            "cross_role_tension or local_optimum_risk in this same response"
        )

    checked_texts: list[str] = [proposal.reason_for_consideration]
    checked_texts.extend(proposal.preserved_elements)
    checked_texts.extend(proposal.adoption_risks)
    checked_texts.extend(proposal.questions_for_human_vfx_supervisor)
    for field_proposal in proposal.proposed_fields:
        checked_texts.append(field_proposal.current_problem)
        checked_texts.append(field_proposal.proposed_direction)
        checked_texts.append(field_proposal.why_it_may_help)

    for text in checked_texts:
        lowered = text.lower()
        if any(term in lowered for term in _HUMANGATE_RESOLUTION_TERMS):
            raise AgentGenerationError(
                "Cross-role assessment's re_anchor_proposal exceeded its bounded advisory "
                "scope: instructs resolving a HumanGate"
            )
        if any(term in lowered for term in _DECISION_AUTHORITY_TERMS):
            raise AgentGenerationError(
                "Cross-role assessment's re_anchor_proposal exceeded its bounded advisory "
                "scope: instructs or claims an authoritative Decision"
            )
        if any(term in lowered for term in _ROLE_BLAME_TERMS):
            raise AgentGenerationError(
                "Cross-role assessment's re_anchor_proposal exceeded its bounded advisory "
                "scope: assigns blame to a role"
            )
        if "already approved" in lowered or "has been approved" in lowered:
            raise AgentGenerationError(
                "Cross-role assessment's re_anchor_proposal exceeded its bounded advisory "
                "scope: presents the proposal as already approved"
            )
        if "automatically replac" in lowered or "will automatically" in lowered:
            raise AgentGenerationError(
                "Cross-role assessment's re_anchor_proposal exceeded its bounded advisory "
                "scope: recommends automatic replacement"
            )


# Unsupported-production-numeric-value hardening: a real persisted assessment
# once had its (correctly advisory) re_anchor_proposal invent two production
# thresholds ("push-in speed must not exceed 0.5x normal conversation pace",
# "contrast may increase up to 15% above baseline") that did not exist
# anywhere in the cited evidence. Advisory framing does not make an invented
# production number evidence-grounded -- a numeric production value may only
# be *repeated* when the exact value and unit already appear in evidence the
# same output item cites, never independently invented, even as a
# recommendation. This is a narrow, targeted detector (percentages,
# multipliers/ratios, frame/timing values, exposure/lighting values, and
# spatial measurements, including simple ranges of each) -- it never fires on
# bare numbers with no such unit, so UUIDs, timestamps, revision numbers, and
# ordinary prose are unaffected.
_PRODUCTION_NUMERIC_PATTERNS: Final[tuple[re.Pattern[str], ...]] = tuple(
    re.compile(pattern)
    for pattern in (
        # "%" is not a word character, so a trailing `\b` never matches
        # right after it -- only "percent" (a word) needs the boundary.
        r"\d+(?:\.\d+)?\s*(?:-|to)\s*\d+(?:\.\d+)?\s*(?:%|percent\b)",
        r"\d+(?:\.\d+)?\s*(?:%|percent\b)",
        r"\d+(?:\.\d+)?x\s*(?:-|to)\s*\d+(?:\.\d+)?x\b",
        r"\d+(?:\.\d+)?x\b",
        r"\d+(?:\.\d+)?\s*(?:-|to)\s*\d+(?:\.\d+)?\s*frames?\b",
        r"\d+(?:\.\d+)?\s*frames?\b",
        r"\d+(?:\.\d+)?\s*fps\b",
        r"\d+(?:\.\d+)?\s*(?:milliseconds?|ms)\b",
        r"\d+(?:\.\d+)?\s*(?:seconds?|secs?)\b",
        r"\d+(?:\.\d+)?\s*stops?\b",
        r"\d+(?:\.\d+)?\s*ev\b",
        r"\d+(?:\.\d+)?\s*nits?\b",
        r"\d+(?:\.\d+)?\s*ire\b",
        r"\d+(?:\.\d+)?\s*px\b",
        r"\d+(?:\.\d+)?\s*pixels?\b",
        # "°" is likewise not a word character.
        r"\d+(?:\.\d+)?\s*(?:degrees?\b|°)",
    )
)

_UNSUPPORTED_PRODUCTION_NUMERIC_ERROR: Final = (
    "Cross-role assessment contained unsupported production-specific numeric values"
)


def _normalize_numeric_text(text: str) -> str:
    """Conservative normalisation only -- lowercase, unify the two
    "times" spellings and the two dash glyphs, and collapse whitespace.
    Never a semantic/unit conversion (see module docstring: 0.5 seconds
    is never treated as equivalent to 12 frames, 50% is never treated as
    equivalent to 0.5x).
    """
    normalized = text.lower().replace("×", "x").replace("–", "-").replace("—", "-")
    return re.sub(r"\s+", " ", normalized)


def _detect_production_numeric_expressions(text: str) -> list[str]:
    normalized = _normalize_numeric_text(text)
    return [
        match.group(0)
        for pattern in _PRODUCTION_NUMERIC_PATTERNS
        for match in pattern.finditer(normalized)
    ]


def _find_objects_by_id(node: Any, target_id: str) -> list[dict[str, Any]]:
    found: list[dict[str, Any]] = []
    if isinstance(node, dict):
        if node.get("id") == target_id:
            found.append(node)
        for value in node.values():
            found.extend(_find_objects_by_id(value, target_id))
    elif isinstance(node, list):
        for item in node:
            found.extend(_find_objects_by_id(item, target_id))
    return found


def _leaf_strings(node: Any) -> list[str]:
    if isinstance(node, str):
        return [node]
    if isinstance(node, dict):
        return [s for value in node.values() for s in _leaf_strings(value)]
    if isinstance(node, list):
        return [s for item in node for s in _leaf_strings(item)]
    return []


def _evidence_supporting_text(snapshot_payload: dict[str, Any], evidence: list[Any]) -> str:
    """The normalised, concatenated text of every snapshot object cited
    by `evidence` -- the only pool a numeric expression in the same
    output item may be checked against. A number that exists only in a
    *different*, uncited snapshot object never counts as support.
    """
    strings: list[str] = []
    for reference in evidence:
        for obj in _find_objects_by_id(snapshot_payload, reference.source_id):
            strings.extend(_leaf_strings(obj))
    return _normalize_numeric_text(" ".join(strings))


def _check_no_unsupported_production_numerics(
    text: str, evidence: list[Any], snapshot_payload: dict[str, Any]
) -> None:
    expressions = _detect_production_numeric_expressions(text)
    if not expressions:
        return
    supporting_text = _evidence_supporting_text(snapshot_payload, evidence)
    for expression in expressions:
        if expression not in supporting_text:
            raise AgentGenerationError(_UNSUPPORTED_PRODUCTION_NUMERIC_ERROR)


def _validate_no_unsupported_production_numerics(
    output: CrossRoleAssessmentOutput, snapshot_payload: dict[str, Any]
) -> None:
    """A numeric production value (percentage, multiplier/ratio, frame
    count, fps, duration, exposure/lighting value, or spatial
    measurement, including simple ranges of each) may appear in
    generated text only when the exact same expression already appears
    in the text of an evidence object the *same output item* cites.
    ``executive_summary`` and ``evidence_gaps`` entries have no
    per-item evidence of their own, so any such expression there is
    always unsupported. ``re_anchor_proposal``'s own top-level text is
    checked against the proposal's own top-level evidence;
    ``proposed_fields`` entries are checked against that entry's own
    evidence, never the proposal's or another entry's. Raises
    ``AgentGenerationError`` with one fixed, sanitised message -- never
    the offending value, field, or raw text.
    """

    def check(text: str, evidence: list[Any]) -> None:
        _check_no_unsupported_production_numerics(text, evidence, snapshot_payload)

    check(output.executive_summary, [])
    for finding in (
        output.shared_intent_read,
        *output.agreements,
        *output.cross_role_tensions,
        *output.local_optimum_risks,
        *output.unresolved_dependencies,
        *output.human_coordination_priorities,
    ):
        check(finding.summary, finding.evidence)
        check(finding.why_it_matters, finding.evidence)
    for perspective in output.role_perspectives:
        check(perspective.current_position, perspective.evidence)
        check(perspective.protected_intent, perspective.evidence)
        check(perspective.main_concerns, perspective.evidence)
    for gap in output.evidence_gaps:
        check(gap, [])

    if output.re_anchor_proposal is not None:
        proposal = output.re_anchor_proposal
        check(proposal.reason_for_consideration, proposal.evidence)
        for element in proposal.preserved_elements:
            check(element, proposal.evidence)
        for risk in proposal.adoption_risks:
            check(risk, proposal.evidence)
        for question in proposal.questions_for_human_vfx_supervisor:
            check(question, proposal.evidence)
        for field_proposal in proposal.proposed_fields:
            check(field_proposal.current_problem, field_proposal.evidence)
            check(field_proposal.proposed_direction, field_proposal.evidence)
            check(field_proposal.why_it_may_help, field_proposal.evidence)


def _validate_content_boundaries(
    output: CrossRoleAssessmentOutput, snapshot_payload: dict[str, Any]
) -> None:
    """Step 6 content-boundary hardening, run after
    ``CrossRoleAssessmentOutput`` parsing/evidence validation and before
    any result row is persisted:

    A. ``evidence_gaps`` must explicitly disclose the missing direct
       footage/rendered-frame/scene-or-project-file/parameter inspection
       boundary.
    B. Outside ``re_anchor_proposal``, no field may instruct modifying
       an Anchor, re-anchoring, resolving a HumanGate, issuing an
       authoritative Decision, declaring an official pass/fail or
       definitive verdict, assigning role blame, ranking a Version, or
       claiming direct media inspection.
    C. When present, ``re_anchor_proposal`` must satisfy the bounded
       evidence-diversity rules in ``_validate_re_anchor_proposal``.
    D. No field may contain a numeric production value (percentage,
       multiplier, frame count, fps, duration, exposure/lighting value,
       or spatial measurement) unless the exact same expression is
       already present in evidence that same output item cites -- see
       ``_validate_no_unsupported_production_numerics``.

    Raises ``AgentGenerationError`` with a short, sanitised reason on
    violation -- never the offending text itself, matching
    ``_validate_evidence_resolves_to_snapshot``'s own convention.
    """
    gaps_text = " ".join(output.evidence_gaps).lower()
    has_unavailable_concept = any(term in gaps_text for term in _INSPECTION_UNAVAILABLE_TERMS)
    has_media_concept = any(term in gaps_text for term in _MEDIA_SCENE_TERMS)
    if not (has_unavailable_concept and has_media_concept):
        raise AgentGenerationError(
            "Cross-role assessment did not explicitly disclose the missing direct "
            "footage/rendered-frame/scene-or-project-file/parameter inspection boundary in "
            "evidence_gaps"
        )

    checked_texts: list[str] = [output.executive_summary]
    for finding in (
        output.shared_intent_read,
        *output.agreements,
        *output.cross_role_tensions,
        *output.local_optimum_risks,
        *output.unresolved_dependencies,
        *output.human_coordination_priorities,
    ):
        checked_texts.append(finding.summary)
        checked_texts.append(finding.why_it_matters)
    for perspective in output.role_perspectives:
        checked_texts.append(perspective.current_position)
        checked_texts.append(perspective.protected_intent)
        checked_texts.append(perspective.main_concerns)

    for text in checked_texts:
        reason = _forbidden_authority_reason(text)
        if reason is not None:
            raise AgentGenerationError(
                f"Cross-role assessment exceeded its bounded advisory scope: {reason}"
            )

    if output.re_anchor_proposal is not None:
        _validate_re_anchor_proposal(output.re_anchor_proposal, output, snapshot_payload)

    _validate_no_unsupported_production_numerics(output, snapshot_payload)


def derive_intent_signal(output: CrossRoleAssessmentOutput) -> IntentSignalOutput:
    """Deterministic, explainable projection from an already-validated
    ``CrossRoleAssessmentOutput`` -- not an Agent, not itself model-
    generated, never an alignment verdict, quality score, Decision, or
    approval recommendation (Step 6 §7). Rule order below encodes the
    exact locked precedence: high, then medium, then low.
    """
    high_tension_idxs = [
        i for i, f in enumerate(output.cross_role_tensions) if f.priority == "high"
    ]
    high_risk_idxs = [i for i, f in enumerate(output.local_optimum_risks) if f.priority == "high"]
    proposal_present = output.re_anchor_proposal is not None

    drivers: list[IntentSignalDriver] = []
    for i in high_tension_idxs:
        drivers.append(
            IntentSignalDriver(
                code="cross_role_tension",
                summary=_bounded(output.cross_role_tensions[i].summary, limit=_SUMMARY_LIMIT),
                priority="high",
                assessment_section="cross_role_tensions",
                assessment_item_index=i,
            )
        )
    for i in high_risk_idxs:
        drivers.append(
            IntentSignalDriver(
                code="local_optimum_risk",
                summary=_bounded(output.local_optimum_risks[i].summary, limit=_SUMMARY_LIMIT),
                priority="high",
                assessment_section="local_optimum_risks",
                assessment_item_index=i,
            )
        )
    if proposal_present:
        drivers.append(
            IntentSignalDriver(
                code="anchor_clarity_gap",
                summary=_bounded(
                    output.re_anchor_proposal.reason_for_consideration
                    if output.re_anchor_proposal is not None
                    else "A re-anchor proposal was generated.",
                    limit=_SUMMARY_LIMIT,
                ),
                priority="high",
                assessment_section="re_anchor_proposal",
                assessment_item_index=0,
            )
        )

    if high_tension_idxs or high_risk_idxs or proposal_present:
        attention_level: str = "high"
        label: str = "human_review_required"
        summary = (
            "At least one high-priority cross-role tension or local-optimum risk was "
            "identified, or a re-anchor proposal was generated -- human review is warranted."
        )
    else:
        medium_tension_idxs = [
            i for i, f in enumerate(output.cross_role_tensions) if f.priority == "medium"
        ]
        medium_risk_idxs = [
            i for i, f in enumerate(output.local_optimum_risks) if f.priority == "medium"
        ]
        dependency_idxs = list(range(len(output.unresolved_dependencies)))
        # More than the one mandatory inspection-boundary disclosure
        # entry means a real, additional evidence limitation was
        # recorded -- a bounded, testable proxy for "evidence gaps
        # materially limit the assessment".
        material_evidence_gap = len(output.evidence_gaps) > 1

        for i in medium_tension_idxs:
            drivers.append(
                IntentSignalDriver(
                    code="cross_role_tension",
                    summary=_bounded(output.cross_role_tensions[i].summary, limit=_SUMMARY_LIMIT),
                    priority="medium",
                    assessment_section="cross_role_tensions",
                    assessment_item_index=i,
                )
            )
        for i in medium_risk_idxs:
            drivers.append(
                IntentSignalDriver(
                    code="local_optimum_risk",
                    summary=_bounded(output.local_optimum_risks[i].summary, limit=_SUMMARY_LIMIT),
                    priority="medium",
                    assessment_section="local_optimum_risks",
                    assessment_item_index=i,
                )
            )
        for i in dependency_idxs:
            drivers.append(
                IntentSignalDriver(
                    code="unresolved_dependency",
                    summary=_bounded(
                        output.unresolved_dependencies[i].summary, limit=_SUMMARY_LIMIT
                    ),
                    priority=output.unresolved_dependencies[i].priority,
                    assessment_section="unresolved_dependencies",
                    assessment_item_index=i,
                )
            )
        if material_evidence_gap:
            drivers.append(
                IntentSignalDriver(
                    code="missing_evidence",
                    summary=_bounded(output.evidence_gaps[-1], limit=_SUMMARY_LIMIT),
                    priority="medium",
                    assessment_section="evidence_gaps",
                    assessment_item_index=len(output.evidence_gaps) - 1,
                )
            )

        if medium_tension_idxs or medium_risk_idxs or dependency_idxs or material_evidence_gap:
            attention_level = "medium"
            label = "attention_needed"
            summary = (
                "A medium-priority cross-role tension or local-optimum risk, an unresolved "
                "dependency, or a material evidence gap was identified -- attention is needed."
            )
        else:
            attention_level = "low"
            label = "low_attention"
            summary = (
                "No cross-role tension, local-optimum risk, unresolved dependency, or "
                "material evidence gap was identified beyond the mandatory disclosure."
            )

    caveats = [
        "This is a derived attention signal, not an alignment verdict, quality score, "
        "Decision, or approval recommendation.",
    ]
    if proposal_present:
        caveats.append(
            "A re-anchor proposal exists but is advisory only and does not modify the Core Anchor."
        )

    return IntentSignalOutput(
        attention_level=attention_level,  # type: ignore[arg-type]
        label=label,  # type: ignore[arg-type]
        summary=summary,
        drivers=drivers[:5],
        # Generation requires all three role outputs to already exist
        # (see generate_cross_role_assessment) -- role_coverage is
        # therefore always fully true by construction, not a guess.
        role_coverage=RoleCoverage(vfx_supervisor=True, cg_supervisor=True, artist=True),
        re_anchor_proposal_present=proposal_present,
        caveats=caveats,
    )


async def generate_cross_role_assessment(
    session: AsyncSession,
    actor: ActorContext,
    version_id: uuid.UUID,
    task_id: uuid.UUID,
    *,
    generator: CrossRoleAssessmentGenerator | None = None,
) -> CrossRoleAssessment:
    # Authoritative check: enforced here regardless of what the router
    # does. Generating a cross-role assessment is explicitly Human VFX
    # Supervisor only -- no agent actor is ever accepted here.
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
    confirmed_core_revision: CoreAnchorRevision | None = None
    if core_anchor is not None:
        all_core_revisions = await core_anchor_service.list_revisions_for_shot(session, shot.id)
        confirmed_core_revision = next(
            (r for r in all_core_revisions if r.status == "confirmed"), None
        )
    if confirmed_core_revision is None:
        raise ConflictError(
            "Cross-role assessment requires a confirmed Core Anchor revision for this Shot; "
            "none exists yet"
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
            "Cross-role assessment requires a confirmed Execution Anchor revision for this "
            "Task; none exists yet (a draft or rejected revision is never used)"
        )

    vfx_reviews = await vfx_supervisor_review_service.list_vfx_supervisor_reviews_for_version(
        session, version.id
    )
    newest_vfx_review = vfx_reviews[0] if vfx_reviews else None
    if newest_vfx_review is None:
        raise ConflictError(
            "Cross-role assessment requires a VFX Supervisor Agent review for this Version; "
            "none exists yet"
        )

    cg_reviews = (
        await cg_supervisor_review_service.list_cg_supervisor_reviews_for_execution_anchor_revision(
            session, confirmed_execution_revision.id
        )
    )
    newest_cg_review = cg_reviews[0] if cg_reviews else None
    if newest_cg_review is None:
        raise ConflictError(
            "Cross-role assessment requires a CG Supervisor Agent review for this Task's "
            "confirmed Execution Anchor revision; none exists yet"
        )

    newest_artist_guidance = await _newest_artist_guidance_for_version_and_task(
        session, version.id, task_id
    )
    if newest_artist_guidance is None:
        raise ConflictError(
            "Cross-role assessment requires Artist Agent guidance for this Version and Task; "
            "none exists yet"
        )

    payload = await _build_context_snapshot_payload(
        session,
        version=version,
        task=task,
        core_revision=confirmed_core_revision,
        execution_revision=confirmed_execution_revision,
        vfx_review=newest_vfx_review,
        cg_review=newest_cg_review,
        artist_guidance=newest_artist_guidance,
        shot=shot,
        project=project,
    )

    async def _persist(
        session: AsyncSession,
        snapshot: ContextSnapshot,
        run: AgentRun,
        output: CrossRoleAssessmentOutput,
    ) -> CrossRoleAssessment:
        _validate_evidence_resolves_to_snapshot(output, payload)
        _validate_content_boundaries(output, payload)

        assessment = CrossRoleAssessment(
            project_id=project.id,
            shot_id=shot.id,
            task_id=task.id,
            version_id=version.id,
            core_anchor_revision_id=confirmed_core_revision.id,
            execution_anchor_revision_id=confirmed_execution_revision.id,
            vfx_supervisor_review_id=newest_vfx_review.id,
            cg_supervisor_review_id=newest_cg_review.id,
            artist_agent_guidance_id=newest_artist_guidance.id,
            context_snapshot_id=snapshot.id,
            agent_run_id=run.id,
            assessment_output=output.model_dump(mode="json"),
        )
        session.add(assessment)
        await session.flush()

        proposal: ReAnchorProposal | None = None
        if output.re_anchor_proposal is not None:
            proposal = ReAnchorProposal(
                cross_role_assessment_id=assessment.id,
                project_id=project.id,
                shot_id=shot.id,
                current_core_anchor_revision_id=confirmed_core_revision.id,
                proposal_output=output.re_anchor_proposal.model_dump(mode="json"),
            )
            session.add(proposal)

        signal_output = derive_intent_signal(output)
        signal = IntentSignal(
            cross_role_assessment_id=assessment.id,
            project_id=project.id,
            shot_id=shot.id,
            task_id=task.id,
            version_id=version.id,
            attention_level=signal_output.attention_level,
            signal_output=signal_output.model_dump(mode="json"),
        )
        session.add(signal)

        # Single commit: CrossRoleAssessment, optional ReAnchorProposal,
        # and IntentSignal are persisted atomically -- a failure at any
        # point rolls back all three and leaves no partial result (the
        # shared execute_agent runtime then marks the AgentRun failed
        # with the ContextSnapshot preserved).
        await session.commit()
        await session.refresh(assessment)
        if proposal is not None:
            await session.refresh(proposal)
        await session.refresh(signal)

        # Attached for the read response only (CrossRoleAssessmentRead
        # requires a linked intent_signal and an optional
        # re_anchor_proposal) -- no ORM relationship is declared, to
        # avoid async lazy-loading pitfalls; Pydantic's
        # `from_attributes=True` reads these plain instance attributes
        # directly. See also `_attach_related`.
        assessment.intent_signal = signal  # type: ignore[attr-defined]
        assessment.re_anchor_proposal = proposal  # type: ignore[attr-defined]
        return assessment

    resolved_generator = generator
    if resolved_generator is None:
        # Package C explicit-transition fix (ICAS_PACKAGE_C_JOURNEY_
        # REBASE_CLAUDE_HANDOFF.md): a late-bound, function-local import
        # -- `demo_seed.d1_scenario` already imports this module at its
        # own top level, so a module-level import here would be
        # circular. Returns non-None only for the exact canonical
        # Package C D1 Journey Project/Shot identity -- deliberately
        # regardless of the ambient configured provider, so this one
        # reproducible demo fixture's locked transition never depends on
        # environment configuration; every other Shot/Project keeps
        # using whatever provider is actually configured, completely
        # unaffected, and falls through to `_get_generator()` exactly as
        # before. See that function's own docstring for the full
        # dispatch rule.
        from intent_core_api.demo_seed.d1_scenario import (
            resolve_canonical_d1_assessment_generator,
        )

        resolved_generator = await resolve_canonical_d1_assessment_generator(
            session, project_id=project.id, shot_id=shot.id
        )

    provider, model_name, prompt_version = prompt_registry.execution_metadata(
        _CAPABILITY_CROSS_ROLE_ASSESSMENT
    )
    spec = AgentExecutionSpec(
        shot_id=shot.id,
        agent_type=_AGENT_TYPE_CORE_AGENT,
        capability=_CAPABILITY_CROSS_ROLE_ASSESSMENT,
        provider=provider,
        model_name=model_name,
        prompt_version=prompt_version,
        snapshot_payload=payload,
        resolve_generator=(
            lambda: resolved_generator if resolved_generator is not None else _get_generator()
        ),
        persist_result=_persist,
        failure_label="Core Agent cross-role assessment generation",
    )
    return await execute_agent(session, spec)


async def _attach_related(session: AsyncSession, assessment: CrossRoleAssessment) -> None:
    """Loads and attaches this assessment's required IntentSignal and
    optional ReAnchorProposal as plain instance attributes, matching
    exactly what ``generate_cross_role_assessment`` attaches on the
    success path -- used by the read/list paths so every returned
    ``CrossRoleAssessment`` object satisfies ``CrossRoleAssessmentRead``.
    """
    signal_result = await session.execute(
        select(IntentSignal).where(IntentSignal.cross_role_assessment_id == assessment.id)
    )
    signal = signal_result.scalar_one()
    proposal_result = await session.execute(
        select(ReAnchorProposal).where(ReAnchorProposal.cross_role_assessment_id == assessment.id)
    )
    proposal = proposal_result.scalar_one_or_none()
    assessment.intent_signal = signal  # type: ignore[attr-defined]
    assessment.re_anchor_proposal = proposal  # type: ignore[attr-defined]


async def get_cross_role_assessment(
    session: AsyncSession, assessment_id: uuid.UUID
) -> CrossRoleAssessment | None:
    assessment = await session.get(CrossRoleAssessment, assessment_id)
    if assessment is None:
        return None
    await _attach_related(session, assessment)
    return assessment


async def get_re_anchor_proposal(
    session: AsyncSession, proposal_id: uuid.UUID
) -> ReAnchorProposal | None:
    return await session.get(ReAnchorProposal, proposal_id)


async def get_intent_signal(session: AsyncSession, signal_id: uuid.UUID) -> IntentSignal | None:
    return await session.get(IntentSignal, signal_id)


async def list_cross_role_assessments_for_version_and_task(
    session: AsyncSession, version_id: uuid.UUID, task_id: uuid.UUID
) -> list[CrossRoleAssessment]:
    result = await session.execute(
        select(CrossRoleAssessment)
        .where(
            CrossRoleAssessment.version_id == version_id,
            CrossRoleAssessment.task_id == task_id,
        )
        .order_by(CrossRoleAssessment.created_at.desc())
    )
    assessments = list(result.scalars().all())
    for assessment in assessments:
        await _attach_related(session, assessment)
    return assessments


async def list_cross_role_assessments_for_shot(
    session: AsyncSession, shot_id: uuid.UUID
) -> list[CrossRoleAssessment]:
    """Every Cross-role Assessment ever generated for a Shot (Step 7C-3
    Alignment Workspace), newest first -- not scoped to one Task/Version
    pair like ``list_cross_role_assessments_for_version_and_task``, since
    the Alignment page shows the Shot's full assessment history. Reuses
    the exact ``shot_id`` query ``vfx_inbox.service._load_shot_related_data``
    already relies on for "latest assessment for this Shot", generalized
    from "latest one" to "all of them".
    """
    result = await session.execute(
        select(CrossRoleAssessment)
        .where(CrossRoleAssessment.shot_id == shot_id)
        .order_by(CrossRoleAssessment.created_at.desc(), CrossRoleAssessment.id.desc())
    )
    assessments = list(result.scalars().all())
    for assessment in assessments:
        await _attach_related(session, assessment)
    return assessments
