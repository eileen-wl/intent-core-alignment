"""CG Supervisor Agent: the ``execution_review`` capability (Step 4) --
the second of three planned Role Agents (VFX Supervisor Agent, CG
Supervisor Agent, Artist Agent), independent from the Core Agent and
from the VFX Supervisor Agent.

Produces an immutable, advisory ``CGSupervisorReview`` of one
``ExecutionAnchorRevision`` -- helping translate confirmed creative
direction into department/task-level executable guidance -- for a Human
CG Supervisor to read. Mirrors
``agents.vfx_supervisor_review_service``'s exact shape: a
``ContextSnapshot``/``AgentRun`` pair, a ``Protocol`` + deterministic +
real-provider adapter seam, and a single service function owning the
full snapshot -> run -> generate -> validate -> persist -> finalize
flow, routed through the Step 2 shared runtime
(``agents.runtime.execute_agent``).

Mandatory distinctions (see docs/AGENT_CONTRACTS.md §6): the CG
Supervisor Agent is not the Core Agent, not the human CG Supervisor, and
not the VFX Supervisor Agent. It never establishes or modifies Core
Anchor or Execution Anchor content, never confirms or rejects an
Execution Anchor, never resolves a HumanGate, never creates an
authoritative Decision, and never creates a ReviewNote or writes to
ftrack -- the only domain-mutating calls this module makes are creating
a ContextSnapshot/AgentRun/CGSupervisorReview row. Its output is
advisory evidence only.

This repository does not inspect footage, frames, renders, scene files,
or DCC project files -- every structured conclusion this capability
produces must cite real evidence already present in the snapshot, and
``evidence_gaps`` must honestly record the missing-media/technical-
evidence limitation; see ``DeterministicCGSupervisorReviewGenerator`` and
the registered system prompt (``agents.prompt_registry``, capability
``execution_review``) for exactly how that boundary is enforced.
"""

from __future__ import annotations

import json
import re
import uuid
from typing import Any, Final, Protocol

from intent_core_contracts.api.cg_supervisor_review import (
    CGProposedExecutionGuidance,
    CGReviewEvidenceReference,
    CGReviewEvidenceSourceType,
    CGReviewItem,
    CGSupervisorReviewOutput,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.agents import (
    alignment_assessment_service,
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
from intent_core_api.intent.execution_anchor_service import EXECUTION_ANCHOR_CONTENT_FIELDS
from intent_core_api.intent.models import (
    CGSupervisorReview,
    CoreAnchorRevision,
    ExecutionAnchor,
    ExecutionAnchorRevision,
    IntentDecomposition,
)
from intent_core_api.production_context.models import Project, Shot, Task
from intent_core_api.versions_and_feedback import service as versions_service
from intent_core_api.versions_and_feedback.models import Version
from intent_core_api.workflow.actors import ActorContext, AgentType, HumanRole, require_human_role
from intent_core_api.workflow.exceptions import (
    AgentGenerationError,
    InternalConsistencyError,
    NotFoundError,
)
from intent_core_api.workflow.models import Decision

_CAPABILITY_EXECUTION_REVIEW = "execution_review"
_AGENT_TYPE_CG_SUPERVISOR_AGENT: Final[AgentType] = "cg_supervisor_agent"
_GENERATE_ROLES: frozenset[HumanRole] = frozenset({"cg_supervisor"})


class CGSupervisorReviewGenerator(Protocol):
    """Pure input -> output: no DB/session access, no ftrack access, no
    ability to touch the Core Anchor, an Execution Anchor, a HumanGate,
    a Decision, or a ReviewNote. Whatever it returns is persisted as-is
    into an immutable CGSupervisorReview row.
    """

    def generate(self, *, snapshot_payload: dict[str, Any]) -> CGSupervisorReviewOutput: ...


def _evidence(
    source_type: CGReviewEvidenceSourceType, source_id: str, label: str
) -> CGReviewEvidenceReference:
    return CGReviewEvidenceReference(source_type=source_type, source_id=source_id, label=label)


# Mirrors intent_core_contracts.api.cg_supervisor_review's Field length
# limits exactly (Step 4 truncation root-cause fix) -- kept here as
# plain constants rather than introspected from the pydantic model so
# the deterministic generator's intent stays readable; if the contract's
# bounds ever change, update both together.
_SUMMARY_LIMIT: Final = 280
_RATIONALE_LIMIT: Final = 420
_GUIDANCE_LIMIT: Final = 320
_NOTE_LIMIT: Final = 260
_EXECUTIVE_SUMMARY_LIMIT: Final = 700
_MAX_ACTIONABLE_REQUIREMENTS: Final = 3
_MAX_IMPLEMENTATION_PRIORITIES: Final = 3
_MAX_PROPOSED_EXECUTION_GUIDANCE: Final = 3


def _bounded(text: str, *, limit: int) -> str:
    """Keeps deterministic output within the bounded contract's string
    limits regardless of how long the underlying recorded text is --
    never silently drops the field, just shortens it with a visible
    marker rather than letting Pydantic reject the whole review.
    """
    if len(text) <= limit:
        return text
    ellipsis = "…"
    return text[: limit - len(ellipsis)] + ellipsis


class DeterministicCGSupervisorReviewGenerator:
    """Offline, deterministic dev/test adapter: no network call, no API
    key, same output for the same input every time. Reads the actual
    supplied snapshot structure and cites real ids from it, honestly
    reporting the missing-media/technical-evidence limitation and never
    inventing a render/scene-level observation -- same convention as
    ``DeterministicVFXSupervisorReviewGenerator``.
    """

    def generate(self, *, snapshot_payload: dict[str, Any]) -> CGSupervisorReviewOutput:
        task = snapshot_payload["task"]
        shot = snapshot_payload["shot"]
        execution_anchor = snapshot_payload["execution_anchor"]
        target_revision = execution_anchor["target_revision"]
        core_anchor = snapshot_payload["core_anchor"]
        vfx_review = snapshot_payload["vfx_supervisor_review"]
        assessment = snapshot_payload["alignment_assessment"]
        label = "[CG deterministic]"

        confirmed_core_revision = (
            core_anchor["confirmed_revision"] if core_anchor is not None else None
        )

        populated_fields = [
            (field, target_revision[field])
            for field in EXECUTION_ANCHOR_CONTENT_FIELDS
            if target_revision.get(field)
        ]

        if populated_fields:
            execution_direction_read = CGReviewItem(
                summary=_bounded(
                    f"{label} Review Execution Anchor revision "
                    f"#{target_revision['revision_number']} for Task {task['name']}: "
                    f"{len(populated_fields)} field(s) recorded.",
                    limit=_SUMMARY_LIMIT,
                ),
                rationale=_bounded(
                    f"{label} This is the target Execution Anchor revision under review.",
                    limit=_RATIONALE_LIMIT,
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
        else:
            execution_direction_read = CGReviewItem(
                summary=_bounded(
                    f"{label} Execution Anchor revision #{target_revision['revision_number']} "
                    "for this Task has no recorded content yet.",
                    limit=_SUMMARY_LIMIT,
                ),
                rationale=_bounded(
                    f"{label} All Execution Anchor content fields are blank.",
                    limit=_RATIONALE_LIMIT,
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

        # Bounded contract: at most 3 actionable_requirements -- the
        # smallest sufficient set, not one entry per populated field.
        actionable_requirements: list[CGReviewItem] = [
            CGReviewItem(
                summary=_bounded(
                    f"{label} Actionable requirement ({field}): {value}", limit=_SUMMARY_LIMIT
                ),
                rationale=_bounded(
                    f"{label} Recorded directly on the target Execution Anchor revision.",
                    limit=_RATIONALE_LIMIT,
                ),
                priority="medium",
                evidence=[
                    _evidence(
                        "execution_anchor_revision",
                        target_revision["id"],
                        f"Execution Anchor revision {target_revision['id']} ({field})",
                    )
                ],
            )
            for field, value in populated_fields[:_MAX_ACTIONABLE_REQUIREMENTS]
        ]

        technical_concerns: list[CGReviewItem] = []
        if not populated_fields:
            technical_concerns.append(
                CGReviewItem(
                    summary=_bounded(
                        f"{label} No technical boundaries, parameters, or delivery "
                        "conditions have been recorded for this Execution Anchor revision.",
                        limit=_SUMMARY_LIMIT,
                    ),
                    rationale=_bounded(
                        f"{label} The revision's content fields are all blank.",
                        limit=_RATIONALE_LIMIT,
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
            )
        if execution_anchor["is_stale"]:
            technical_concerns.append(
                CGReviewItem(
                    summary=_bounded(
                        f"{label} This Execution Anchor is marked stale relative to the "
                        "current confirmed Core Anchor.",
                        limit=_SUMMARY_LIMIT,
                    ),
                    rationale=_bounded(
                        f"{label} The ExecutionAnchor's is_stale flag is true.",
                        limit=_RATIONALE_LIMIT,
                    ),
                    priority="high",
                    evidence=[_evidence("task", task["id"], f"Task {task['name']}")],
                )
            )

        coordination_concerns: list[CGReviewItem] = []
        if vfx_review is not None:
            coordination_concerns.append(
                CGReviewItem(
                    summary=_bounded(
                        f"{label} A VFX Supervisor Agent review exists for this Shot; "
                        "confirm its creative concerns do not affect this Task's execution.",
                        limit=_SUMMARY_LIMIT,
                    ),
                    rationale=_bounded(
                        f"{label} A VFXSupervisorReview was recorded for a Version under "
                        "this Shot.",
                        limit=_RATIONALE_LIMIT,
                    ),
                    priority="medium",
                    evidence=[
                        _evidence(
                            "vfx_supervisor_review",
                            vfx_review["id"],
                            f"VFX review {vfx_review['id']}",
                        )
                    ],
                )
            )

        # Bounded contract: at most 3 implementation_priorities / 3
        # proposed_execution_guidance entries -- the smallest sufficient
        # set of constraints, not every recorded constraint.
        constraints = confirmed_core_revision["constraints"] if confirmed_core_revision else []
        bounded_constraints = constraints[:_MAX_IMPLEMENTATION_PRIORITIES]
        implementation_priorities: list[CGReviewItem] = [
            CGReviewItem(
                summary=_bounded(
                    f"{label} Confirm execution preserves Core Anchor constraint: "
                    f"{item['content']}",
                    limit=_SUMMARY_LIMIT,
                ),
                rationale=_bounded(
                    f"{label} Recorded Constraint on the confirmed Core Anchor revision.",
                    limit=_RATIONALE_LIMIT,
                ),
                priority="high",
                evidence=[_evidence("constraint", item["id"], f"Constraint {item['id']}")],
            )
            for item in bounded_constraints
        ]

        proposed_execution_guidance: list[CGProposedExecutionGuidance] = [
            CGProposedExecutionGuidance(
                guidance=_bounded(
                    f"{label} Ensure the Artist's work satisfies: {item['content']}",
                    limit=_GUIDANCE_LIMIT,
                ),
                underlying_intent=_bounded(
                    f"{label} This constraint was recorded on the confirmed Core Anchor "
                    "revision and represents a must-preserve element of the creative direction.",
                    limit=_RATIONALE_LIMIT,
                ),
                priority="high",
                evidence=[_evidence("constraint", item["id"], f"Constraint {item['id']}")],
            )
            for item in constraints[:_MAX_PROPOSED_EXECUTION_GUIDANCE]
        ]

        questions_for_human_cg_supervisor = [
            _bounded(
                f"{label} Does the actual scene/render output for Task {task['name']} match "
                "the recorded Execution Anchor content, given this Agent has not inspected it?",
                limit=_NOTE_LIMIT,
            )
        ]

        # Step 4 content-boundary hardening: this exact disclosure (not
        # directly inspected + a media/scene term) is mandatory on every
        # response -- see _validate_content_boundaries, which this
        # generator's output must also satisfy.
        evidence_gaps = [
            _bounded(
                f"{label} ICAS has not directly inspected footage, rendered frames, scene "
                "files, project files, or DCC files, and has not inspected numeric or "
                "pipeline-specific parameters; this review is based solely on recorded "
                "text metadata.",
                limit=_NOTE_LIMIT,
            ),
        ]
        if assessment is None:
            evidence_gaps.append(
                _bounded(
                    f"{label} No Core Agent Alignment Assessment exists yet for this Shot.",
                    limit=_NOTE_LIMIT,
                )
            )
        if vfx_review is None:
            evidence_gaps.append(
                _bounded(
                    f"{label} No VFX Supervisor Agent review exists yet for this Shot.",
                    limit=_NOTE_LIMIT,
                )
            )
        if not populated_fields:
            evidence_gaps.append(
                _bounded(
                    f"{label} No technical parameters are recorded on this Execution Anchor "
                    "revision.",
                    limit=_NOTE_LIMIT,
                )
            )

        executive_summary = _bounded(
            f"{label} {len(populated_fields)} recorded field(s), {len(bounded_constraints)} "
            f"Core Anchor constraint(s) considered for Task {task['name']} in Shot "
            f"{shot['name']}.",
            limit=_EXECUTIVE_SUMMARY_LIMIT,
        )

        return CGSupervisorReviewOutput(
            executive_summary=executive_summary,
            execution_direction_read=execution_direction_read,
            actionable_requirements=actionable_requirements,
            technical_concerns=technical_concerns,
            coordination_concerns=coordination_concerns,
            implementation_priorities=implementation_priorities,
            proposed_execution_guidance=proposed_execution_guidance,
            questions_for_human_cg_supervisor=questions_for_human_cg_supervisor,
            evidence_gaps=evidence_gaps,
        )


class DeepSeekCGSupervisorReviewGenerator:
    """Same DeepSeek integration path as every other capability's
    real-provider adapter (official ``openai`` package pointed at
    DeepSeek's OpenAI-compatible endpoint, via the shared
    ``agents.model_gateway`` -- see ADR-0013) -- one non-streaming
    JSON-mode call, validated against ``CGSupervisorReviewOutput``
    explicitly. Model name comes from ``Settings.model_name`` (never
    hardcoded).
    """

    def __init__(self, *, api_key: str, model_name: str) -> None:
        self._api_key = api_key
        self._model_name = model_name

    def generate(self, *, snapshot_payload: dict[str, Any]) -> CGSupervisorReviewOutput:
        registration = prompt_registry.get_registration(_CAPABILITY_EXECUTION_REVIEW)
        return model_gateway.generate_deepseek(
            api_key=self._api_key,
            model_name=self._model_name,
            system_prompt=registration.system_prompt,
            user_content=(
                "Produce an execution review for this Task's Execution Anchor revision. "
                "Respond with the JSON object described in the system prompt. Context (JSON):\n"
                + json.dumps(snapshot_payload, indent=2)
            ),
            output_model=CGSupervisorReviewOutput,
            max_tokens=registration.max_output_tokens,
        )


def _get_generator() -> CGSupervisorReviewGenerator:
    provider = model_gateway.resolve_provider_name()
    if provider == "deterministic":
        return DeterministicCGSupervisorReviewGenerator()
    if provider == "deepseek":
        api_key, model_name = model_gateway.require_deepseek_settings()
        return DeepSeekCGSupervisorReviewGenerator(api_key=api_key, model_name=model_name)
    raise AgentGenerationError(
        f"model_provider={provider!r} is not implemented; only 'deterministic' "
        "and 'deepseek' exist in this slice"
    )


def _core_revision_payload(revision: CoreAnchorRevision) -> dict[str, Any]:
    """Compact projection (Step 4 truncation root-cause fix): drops
    ``references`` (not needed by this capability) and de-duplicates
    scalar fields that hold the exact same text -- a deterministic
    fixture's placeholder content sometimes repeats one sentence across
    every one of the seven scalar fields, which the earlier, verbose
    snapshot sent seven times over.
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


def _decomposition_payload(decomposition: IntentDecomposition) -> dict[str, Any]:
    return {
        "id": str(decomposition.id),
        "core_intent_summary": decomposition.core_intent_summary,
        "anchor_relevant_content": decomposition.anchor_relevant_content,
        "candidate_constraints": decomposition.candidate_constraints,
        "candidate_variation_zones": decomposition.candidate_variation_zones,
        "uncertainties": decomposition.uncertainties,
    }


def _execution_revision_payload(revision: ExecutionAnchorRevision) -> dict[str, Any]:
    return {
        "id": str(revision.id),
        "revision_number": revision.revision_number,
        "status": revision.status,
        **{field: getattr(revision, field) for field in EXECUTION_ANCHOR_CONTENT_FIELDS},
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
    execution_revision: ExecutionAnchorRevision,
    execution_anchor: ExecutionAnchor,
    task: Task,
    shot: Shot,
    project: Project,
    selected_version: Version | None = None,
) -> dict[str, Any]:
    """Only locally persisted facts relevant to reviewing this one
    Execution Anchor revision -- no binary media, no scene/project files,
    no raw/network-fetched ftrack payloads, no secrets, no unrelated
    Tasks or Versions. No ftrack sync is ever run to build this.

    Deliberately compact (Step 4 real-provider truncation root-cause
    fix): the same product evidence categories as before, but projected
    down to concise fields -- newest-only where several records exist,
    summary-only where a nested record carries its own long evidence/
    rationale tree. This is still the exact payload persisted as the
    ContextSnapshot and the exact payload sent to the model; nothing
    reaches the model that is not also saved here.
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
        "id": str(execution_anchor.id),
        "task_id": str(execution_anchor.task_id),
        "is_stale": execution_anchor.is_stale,
        "active_revision_id": (
            str(execution_anchor.active_revision_id)
            if execution_anchor.active_revision_id is not None
            else None
        ),
        "target_revision": _execution_revision_payload(execution_revision),
    }

    versions_result = await session.execute(
        select(Version).where(Version.shot_id == shot.id).order_by(Version.created_at.desc())
    )
    versions = list(versions_result.scalars().all())

    vfx_reviews = []
    for version in versions:
        vfx_reviews.extend(
            await vfx_supervisor_review_service.list_vfx_supervisor_reviews_for_version(
                session, version.id
            )
        )
    newest_vfx_review = max(vfx_reviews, key=lambda r: r.created_at) if vfx_reviews else None

    # The one Version relevant to this review -- the Version the newest
    # VFX Supervisor Agent review is actually about, when one exists,
    # else simply the newest Version for the Shot. Never every Version:
    # that was the previous snapshot's largest source of unnecessary
    # bulk (an unrelated Version's own full description/notes contribute
    # nothing to an Execution Anchor review).
    relevant_version: Version | None
    if selected_version is not None:
        relevant_version = selected_version
    elif newest_vfx_review is not None:
        relevant_version = next((v for v in versions if v.id == newest_vfx_review.version_id), None)
    else:
        relevant_version = versions[0] if versions else None

    version_payload: dict[str, Any] | None = None
    if relevant_version is not None:
        review_notes = await versions_service.list_review_notes_for_version(
            session, relevant_version.id
        )
        version_payload = {
            "id": str(relevant_version.id),
            "name": relevant_version.name,
            "version_number": relevant_version.version_number,
            "description": relevant_version.description,
            "review_notes": [
                {
                    "id": str(note.id),
                    "content": note.content,
                    "created_by_human_role": note.created_by_human_role,
                }
                for note in review_notes
            ],
        }

    assessments = []
    for version in versions:
        assessments.extend(
            await alignment_assessment_service.list_alignment_assessments_for_version(
                session, version.id
            )
        )
    newest_assessment = max(assessments, key=lambda a: a.created_at) if assessments else None
    assessment_payload = (
        {
            "id": str(newest_assessment.id),
            "alignment_state": newest_assessment.alignment_state,
            # Machine-generated, advisory only -- see
            # agents.alignment_assessment_service's own module docstring;
            # not an authoritative pass/fail judgment.
            "advisory_summary": newest_assessment.envelope.get("summary"),
        }
        if newest_assessment is not None
        else None
    )

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
        "intent_brief": brief_payload,
        "intent_decomposition": decomposition_payload,
        "core_anchor": core_anchor_payload,
        "context_reconstruction": reconstruction_payload,
        "execution_anchor": execution_anchor_payload,
        "version": version_payload,
        "alignment_assessment": assessment_payload,
        "vfx_supervisor_review": vfx_review_payload,
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
    output: CGSupervisorReviewOutput, snapshot_payload: dict[str, Any]
) -> None:
    """Every evidence reference the generator produced must cite an id
    genuinely present in this run's own ContextSnapshot -- never an
    invented id or one from a different Shot/Task/run.
    """
    known_ids = _collect_known_ids(snapshot_payload)
    items: list[CGReviewItem | CGProposedExecutionGuidance] = [
        output.execution_direction_read,
        *output.actionable_requirements,
        *output.technical_concerns,
        *output.coordination_concerns,
        *output.implementation_priorities,
        *output.proposed_execution_guidance,
    ]
    for item in items:
        for reference in item.evidence:
            if reference.source_id not in known_ids:
                raise AgentGenerationError(
                    "CG Supervisor Agent review cited an id not present in this Task's "
                    f"ContextSnapshot (source_type={reference.source_type!r})"
                )


# Step 4 content-boundary hardening: a bounded, testable vocabulary --
# not generic policy infrastructure -- for the two real-provider gaps
# observed in acceptance (missing explicit inspection disclosure, a
# proposed guidance item that read as a Core Anchor edit instruction).
# Scoped to this capability only; VFX Supervisor Agent and Core Agent
# behaviour is untouched.
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
)
# Matches "update the Core Anchor" and "the Core Anchor should be
# updated" (either order, bounded to the same sentence) for each of the
# five forbidden modification verbs.
_CORE_ANCHOR_MODIFICATION_PATTERN: Final = re.compile(
    r"\b(update|modify|change|replace|supersede)\w*\b[^.]{0,40}\bcore anchor\b"
    r"|\bcore anchor\b[^.]{0,40}\b(update|modify|chang|replac|supersed)\w*\b",
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
    "should confirm the execution anchor",
    "should reject the execution anchor",
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


def _forbidden_authority_reason(text: str) -> str | None:
    """Returns a short, sanitised reason if `text` instructs the reader
    to modify the Core Anchor, re-anchor, resolve a HumanGate, or issue
    an authoritative Decision -- all outside this capability's bounded
    advisory scope -- else ``None``. Merely mentioning the Core Anchor
    as evidence, or suggesting escalation/coordination with the Human
    VFX Supervisor, does not match any of these patterns.
    """
    lowered = text.lower()
    if _CORE_ANCHOR_MODIFICATION_PATTERN.search(lowered):
        return "instructs modifying the Core Anchor"
    if _REANCHOR_PATTERN.search(lowered):
        return "instructs a re-anchor action"
    if any(term in lowered for term in _HUMANGATE_RESOLUTION_TERMS):
        return "instructs resolving a HumanGate"
    if any(term in lowered for term in _DECISION_AUTHORITY_TERMS):
        return "instructs creating an authoritative Decision"
    return None


def _validate_content_boundaries(output: CGSupervisorReviewOutput) -> None:
    """Step 4 content-boundary hardening, run after
    ``CGSupervisorReviewOutput`` parsing/evidence validation and before
    ``CGSupervisorReview`` persistence:

    A. ``evidence_gaps`` must explicitly disclose the missing direct
       footage/rendered-frame/scene-or-project-file inspection boundary
       -- not merely a missing-numeric-parameter gap.
    B. ``proposed_execution_guidance``, ``implementation_priorities``,
       and ``questions_for_human_cg_supervisor`` must never instruct
       modifying the Core Anchor, re-anchoring, resolving a HumanGate,
       or issuing an authoritative Decision.

    Raises ``AgentGenerationError`` with a short, sanitised reason on
    violation -- never the offending text itself, matching
    ``_validate_evidence_resolves_to_snapshot``'s own convention.
    """
    gaps_text = " ".join(output.evidence_gaps).lower()
    has_unavailable_concept = any(term in gaps_text for term in _INSPECTION_UNAVAILABLE_TERMS)
    has_media_concept = any(term in gaps_text for term in _MEDIA_SCENE_TERMS)
    if not (has_unavailable_concept and has_media_concept):
        raise AgentGenerationError(
            "CG Supervisor Agent review did not explicitly disclose the missing direct "
            "footage/rendered-frame/scene-or-project-file inspection boundary in "
            "evidence_gaps"
        )

    checked_texts: list[str] = []
    for guidance_item in output.proposed_execution_guidance:
        checked_texts.append(guidance_item.guidance)
        checked_texts.append(guidance_item.underlying_intent)
    for priority_item in output.implementation_priorities:
        checked_texts.append(priority_item.summary)
        checked_texts.append(priority_item.rationale)
    checked_texts.extend(output.questions_for_human_cg_supervisor)

    for text in checked_texts:
        reason = _forbidden_authority_reason(text)
        if reason is not None:
            raise AgentGenerationError(
                f"CG Supervisor Agent review exceeded its bounded advisory scope: {reason}"
            )


async def generate_cg_supervisor_review(
    session: AsyncSession,
    actor: ActorContext,
    execution_anchor_revision_id: uuid.UUID,
    *,
    version_id: uuid.UUID | None = None,
    generator: CGSupervisorReviewGenerator | None = None,
) -> CGSupervisorReview:
    # Authoritative check: enforced here regardless of what the router
    # does. Generating a CG Supervisor review is explicitly Human CG
    # Supervisor only -- no agent actor is ever accepted here.
    require_human_role(actor, _GENERATE_ROLES)

    execution_revision = await session.get(ExecutionAnchorRevision, execution_anchor_revision_id)
    if execution_revision is None:
        raise NotFoundError("Execution anchor revision not found")

    execution_anchor = await session.get(ExecutionAnchor, execution_revision.execution_anchor_id)
    if execution_anchor is None:
        raise InternalConsistencyError(
            f"ExecutionAnchorRevision {execution_anchor_revision_id} references missing "
            f"ExecutionAnchor {execution_revision.execution_anchor_id}"
        )

    task = await session.get(Task, execution_anchor.task_id)
    if task is None:
        raise InternalConsistencyError(
            f"ExecutionAnchor {execution_anchor.id} references missing Task "
            f"{execution_anchor.task_id}"
        )

    shot = await session.get(Shot, task.shot_id)
    if shot is None:
        raise InternalConsistencyError(f"Task {task.id} references missing Shot {task.shot_id}")

    project = await session.get(Project, shot.project_id)
    if project is None:
        raise InternalConsistencyError(
            f"Shot {shot.id} references missing Project {shot.project_id}"
        )

    selected_version = None
    if version_id is not None:
        selected_version = await session.get(Version, version_id)
        if selected_version is None or selected_version.shot_id != shot.id:
            raise NotFoundError("Selected Version not found for this Shot")

    payload = await _build_context_snapshot_payload(
        session,
        execution_revision=execution_revision,
        execution_anchor=execution_anchor,
        task=task,
        shot=shot,
        project=project,
        selected_version=selected_version,
    )

    resolved_generator = generator
    if resolved_generator is None:
        # Package C follow-up (owner-runtime DeepSeek `finish_reason=
        # 'length'` failure): a late-bound, function-local import --
        # `demo_seed.d1_scenario` already imports this module at its
        # own top level, so a module-level import here would be
        # circular. Returns non-None only for the exact canonical
        # Package C D1 Journey Project/Shot/Task identity --
        # deliberately regardless of the ambient configured provider,
        # exactly mirroring `cg_agent_service.generate_execution_
        # anchor_draft`'s own dispatch rule; every other Task/Shot/
        # Project keeps using whatever provider is actually configured,
        # completely unaffected. See that function's own docstring for
        # the full rule.
        from intent_core_api.demo_seed.d1_scenario import (
            resolve_canonical_d1_cg_review_generator,
        )

        resolved_generator = await resolve_canonical_d1_cg_review_generator(
            session, project_id=project.id, shot_id=shot.id, task_id=task.id
        )

    async def _persist(
        session: AsyncSession,
        snapshot: ContextSnapshot,
        run: AgentRun,
        output: CGSupervisorReviewOutput,
    ) -> CGSupervisorReview:
        _validate_evidence_resolves_to_snapshot(output, payload)
        _validate_content_boundaries(output)
        review = CGSupervisorReview(
            project_id=project.id,
            shot_id=shot.id,
            task_id=task.id,
            execution_anchor_revision_id=execution_revision.id,
            version_id=selected_version.id if selected_version is not None else None,
            context_snapshot_id=snapshot.id,
            agent_run_id=run.id,
            review_output=output.model_dump(mode="json"),
        )
        session.add(review)
        await session.commit()
        await session.refresh(review)
        return review

    provider, model_name, prompt_version = prompt_registry.execution_metadata(
        _CAPABILITY_EXECUTION_REVIEW
    )
    spec = AgentExecutionSpec(
        shot_id=shot.id,
        agent_type=_AGENT_TYPE_CG_SUPERVISOR_AGENT,
        capability=_CAPABILITY_EXECUTION_REVIEW,
        provider=provider,
        model_name=model_name,
        prompt_version=prompt_version,
        snapshot_payload=payload,
        resolve_generator=lambda: (
            resolved_generator if resolved_generator is not None else _get_generator()
        ),
        persist_result=_persist,
        failure_label="CG Supervisor Agent execution review generation",
    )
    return await execute_agent(session, spec)


async def get_cg_supervisor_review(
    session: AsyncSession, review_id: uuid.UUID
) -> CGSupervisorReview | None:
    return await session.get(CGSupervisorReview, review_id)


async def list_cg_supervisor_reviews_for_execution_anchor_revision(
    session: AsyncSession, execution_anchor_revision_id: uuid.UUID
) -> list[CGSupervisorReview]:
    result = await session.execute(
        select(CGSupervisorReview)
        .where(CGSupervisorReview.execution_anchor_revision_id == execution_anchor_revision_id)
        .order_by(CGSupervisorReview.created_at.desc())
    )
    return list(result.scalars().all())
