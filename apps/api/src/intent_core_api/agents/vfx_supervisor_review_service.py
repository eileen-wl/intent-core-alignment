"""VFX Supervisor Agent: the ``creative_review`` capability (Step 3) --
the first of three planned Role Agents (VFX Supervisor Agent, CG
Supervisor Agent, Artist Agent), independent from the Core Agent.

Produces an immutable, advisory ``VFXSupervisorReview`` of one Version
from a high-level creative and intent-preservation perspective, for a
Human VFX Supervisor to read. Mirrors
``agents.context_reconstruction_service``'s exact shape: a
``ContextSnapshot``/``AgentRun`` pair, a ``Protocol`` + deterministic +
real-provider adapter seam, and a single service function owning the
full snapshot -> run -> generate -> validate -> persist -> finalize
flow, now routed through the Step 2 shared runtime
(``agents.runtime.execute_agent``).

Mandatory distinctions (see docs/AGENT_CONTRACTS.md §5): the VFX
Supervisor Agent is not the Core Agent and not the human VFX Supervisor.
It never establishes or modifies the Core Anchor, never resolves a
HumanGate, never creates an authoritative Decision, and never confirms,
rejects, passes, fails, approves, or publishes a Version -- the only
domain-mutating calls this module makes are creating a
ContextSnapshot/AgentRun/VFXSupervisorReview row. Its output is advisory
evidence only.

This repository performs no image, video, frame, or media analysis --
every structured conclusion this capability produces must cite real
evidence already present in the snapshot, and ``evidence_gaps`` must
honestly record the missing-media limitation; see
``DeterministicVFXSupervisorReviewGenerator`` and the registered system
prompt (``agents.prompt_registry``, capability ``creative_review``) for
exactly how that boundary is enforced.
"""

from __future__ import annotations

import json
import uuid
from typing import Any, Final, Protocol

from intent_core_contracts.api.vfx_supervisor_review import (
    VFXProposedFeedbackNote,
    VFXReviewEvidenceReference,
    VFXReviewEvidenceSourceType,
    VFXReviewItem,
    VFXSupervisorReviewOutput,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.agents import (
    alignment_assessment_service,
    context_reconstruction_service,
    model_gateway,
    prompt_registry,
)
from intent_core_api.agents import intent_decomposition_service as decomposition_service
from intent_core_api.agents.models import AgentRun, ContextSnapshot
from intent_core_api.agents.runtime import AgentExecutionSpec, execute_agent
from intent_core_api.intent import (
    brief_service,
    core_anchor_service,
    execution_anchor_service,
    human_gate_service,
)
from intent_core_api.intent.core_anchor_service import CORE_ANCHOR_CONTENT_FIELDS
from intent_core_api.intent.models import (
    CoreAnchorRevision,
    ExecutionAnchorRevision,
    IntentDecomposition,
)
from intent_core_api.production_context.models import Project, Shot, Task
from intent_core_api.versions_and_feedback import service as versions_service
from intent_core_api.versions_and_feedback.models import Version, VFXSupervisorReview
from intent_core_api.workflow.actors import ActorContext, AgentType, HumanRole, require_human_role
from intent_core_api.workflow.exceptions import (
    AgentGenerationError,
    InternalConsistencyError,
    NotFoundError,
)
from intent_core_api.workflow.models import Decision

_CAPABILITY_CREATIVE_REVIEW = "creative_review"
_AGENT_TYPE_VFX_SUPERVISOR_AGENT: Final[AgentType] = "vfx_supervisor_agent"
_GENERATE_ROLES: frozenset[HumanRole] = frozenset({"vfx_supervisor"})


class VFXSupervisorReviewGenerator(Protocol):
    """Pure input -> output: no DB/session access, no ftrack access, no
    ability to touch the Core Anchor, a HumanGate, a Decision, or the
    Version itself. Whatever it returns is persisted as-is into an
    immutable VFXSupervisorReview row.
    """

    def generate(self, *, snapshot_payload: dict[str, Any]) -> VFXSupervisorReviewOutput: ...


def _evidence(
    source_type: VFXReviewEvidenceSourceType, source_id: str, label: str
) -> VFXReviewEvidenceReference:
    return VFXReviewEvidenceReference(source_type=source_type, source_id=source_id, label=label)


class DeterministicVFXSupervisorReviewGenerator:
    """Offline, deterministic dev/test adapter: no network call, no API
    key, same output for the same input every time. Reads the actual
    supplied snapshot structure and cites real ids from it, honestly
    reporting the missing-media limitation and never inventing a
    frame-level observation -- same convention as
    ``DeterministicContextReconstructionGenerator``.
    """

    def generate(self, *, snapshot_payload: dict[str, Any]) -> VFXSupervisorReviewOutput:
        version = snapshot_payload["version"]
        shot = snapshot_payload["shot"]
        core_anchor = snapshot_payload["core_anchor"]
        review_notes = snapshot_payload["review_notes"]
        assessment = snapshot_payload["alignment_assessment"]
        label = (
            "[VFX Supervisor Agent creative review - deterministic placeholder, review required]"
        )

        confirmed_revision = core_anchor["confirmed_revision"] if core_anchor is not None else None

        if confirmed_revision is not None:
            creative_direction_read = VFXReviewItem(
                summary=(
                    f"{label} Review this Version against the confirmed Core Anchor "
                    f"revision #{confirmed_revision['revision_number']}: "
                    f"{confirmed_revision['core_summary']}"
                ),
                rationale=f"{label} This is the Shot's currently confirmed Core Anchor revision.",
                priority="high",
                evidence=[
                    _evidence(
                        "core_anchor_revision",
                        confirmed_revision["id"],
                        f"Confirmed Core Anchor revision {confirmed_revision['id']}",
                    )
                ],
            )
        else:
            creative_direction_read = VFXReviewItem(
                summary=(
                    f"{label} No confirmed Core Anchor direction exists yet for this Shot; "
                    "review against the intent brief only."
                ),
                rationale=f"{label} No confirmed CoreAnchorRevision row exists for this Shot.",
                priority="high",
                evidence=[_evidence("shot", shot["id"], f"Shot {shot['name']}")],
            )

        strengths: list[VFXReviewItem] = []
        if confirmed_revision is not None and version["description"].strip():
            strengths.append(
                VFXReviewItem(
                    summary=(
                        f"{label} The submitted Version has a recorded description that can be "
                        "compared directly against the confirmed creative direction."
                    ),
                    rationale=(
                        f"{label} A stated description exists, so a like-for-like textual "
                        "comparison is possible."
                    ),
                    priority="low",
                    evidence=[
                        _evidence(
                            "version", version["id"], f"Version {version['name']} description"
                        ),
                        _evidence(
                            "core_anchor_revision",
                            confirmed_revision["id"],
                            f"Confirmed Core Anchor revision {confirmed_revision['id']}",
                        ),
                    ],
                )
            )

        open_questions = (
            confirmed_revision["open_questions"] if confirmed_revision is not None else []
        )
        creative_concerns: list[VFXReviewItem] = [
            VFXReviewItem(
                summary=(
                    f"{label} Unresolved open question on the confirmed Core Anchor: "
                    f"{item['question']}"
                ),
                rationale=(
                    f"{label} An OpenQuestion remains recorded on the confirmed Core Anchor "
                    "revision and has not been resolved."
                ),
                priority="medium",
                evidence=[_evidence("open_question", item["id"], f"Open question {item['id']}")],
            )
            for item in open_questions
        ]
        if not review_notes:
            creative_concerns.append(
                VFXReviewItem(
                    summary=f"{label} No Review Notes have been recorded yet for this Version.",
                    rationale=f"{label} The review_notes list in the snapshot is empty.",
                    priority="medium",
                    evidence=[_evidence("version", version["id"], f"Version {version['name']}")],
                )
            )

        constraints = confirmed_revision["constraints"] if confirmed_revision is not None else []
        review_priorities: list[VFXReviewItem] = [
            VFXReviewItem(
                summary=f"{label} Confirm the submission preserves: {item['content']}",
                rationale=f"{label} Recorded Constraint on the confirmed Core Anchor revision.",
                priority="high",
                evidence=[_evidence("constraint", item["id"], f"Constraint {item['id']}")],
            )
            for item in constraints
        ]

        proposed_feedback_notes: list[VFXProposedFeedbackNote] = [
            VFXProposedFeedbackNote(
                feedback=f"{label} Confirm this submission does not violate: {item['content']}",
                underlying_intent=(
                    f"{label} This constraint was recorded on the confirmed Core Anchor "
                    "revision and represents a must-preserve element of the creative direction."
                ),
                priority="high",
                evidence=[_evidence("constraint", item["id"], f"Constraint {item['id']}")],
            )
            for item in constraints
        ]

        questions_for_human_supervisor = [
            f"{label} Does the actual submitted media match {version['name']}'s recorded "
            "description, given this Agent has not visually inspected it?"
        ]

        evidence_gaps = [
            f"{label} No image, video, frame, or media analysis is available to this Agent; "
            "this review is based solely on recorded text metadata.",
        ]
        if assessment is None:
            evidence_gaps.append(
                f"{label} No Core Agent Alignment Assessment exists yet for this Version."
            )
        if not review_notes:
            evidence_gaps.append(
                f"{label} No Review Notes have been recorded yet for this Version."
            )

        executive_summary = (
            f"{label} {len(constraints)} constraint(s), {len(open_questions)} open question(s), "
            f"and {len(review_notes)} review note(s) considered for Version {version['name']}."
        )

        return VFXSupervisorReviewOutput(
            executive_summary=executive_summary,
            creative_direction_read=creative_direction_read,
            strengths=strengths,
            creative_concerns=creative_concerns,
            review_priorities=review_priorities,
            proposed_feedback_notes=proposed_feedback_notes,
            questions_for_human_supervisor=questions_for_human_supervisor,
            evidence_gaps=evidence_gaps,
        )


class DeepSeekVFXSupervisorReviewGenerator:
    """Same DeepSeek integration path as every other capability's
    real-provider adapter (official ``openai`` package pointed at
    DeepSeek's OpenAI-compatible endpoint, via the shared
    ``agents.model_gateway`` -- see ADR-0013) -- one non-streaming
    JSON-mode call, validated against ``VFXSupervisorReviewOutput``
    explicitly. Model name comes from ``Settings.model_name`` (never
    hardcoded).
    """

    def __init__(self, *, api_key: str, model_name: str) -> None:
        self._api_key = api_key
        self._model_name = model_name

    def generate(self, *, snapshot_payload: dict[str, Any]) -> VFXSupervisorReviewOutput:
        return model_gateway.generate_deepseek(
            api_key=self._api_key,
            model_name=self._model_name,
            system_prompt=prompt_registry.get_registration("creative_review").system_prompt,
            user_content=(
                "Produce a creative review for this Version. Respond with the JSON object "
                "described in the system prompt. Context (JSON):\n"
                + json.dumps(snapshot_payload, indent=2)
            ),
            output_model=VFXSupervisorReviewOutput,
            max_tokens=4096,
        )


def _get_generator() -> VFXSupervisorReviewGenerator:
    provider = model_gateway.resolve_provider_name()
    if provider == "deterministic":
        return DeterministicVFXSupervisorReviewGenerator()
    if provider == "deepseek":
        api_key, model_name = model_gateway.require_deepseek_settings()
        return DeepSeekVFXSupervisorReviewGenerator(api_key=api_key, model_name=model_name)
    raise AgentGenerationError(
        f"model_provider={provider!r} is not implemented; only 'deterministic' "
        "and 'deepseek' exist in this slice"
    )


def _revision_payload(revision: CoreAnchorRevision) -> dict[str, Any]:
    return {
        "id": str(revision.id),
        "revision_number": revision.revision_number,
        "status": revision.status,
        "source_intent_decomposition_id": (
            str(revision.source_intent_decomposition_id)
            if revision.source_intent_decomposition_id is not None
            else None
        ),
        **{field: getattr(revision, field) for field in CORE_ANCHOR_CONTENT_FIELDS},
        "constraints": [
            {"id": str(item.id), "content": item.content} for item in revision.constraints
        ],
        "variation_zones": [
            {"id": str(item.id), "content": item.content} for item in revision.variation_zones
        ],
        "drift_risks": [
            {"id": str(item.id), "description": item.description} for item in revision.drift_risks
        ],
        "references": [
            {"id": str(item.id), "label": item.label, "uri": item.uri, "note": item.note}
            for item in revision.references
        ],
        "open_questions": [
            {"id": str(item.id), "question": item.question} for item in revision.open_questions
        ],
    }


def _decomposition_payload(decomposition: IntentDecomposition) -> dict[str, Any]:
    return {
        "id": str(decomposition.id),
        "created_at": decomposition.created_at.isoformat(),
        "core_intent_summary": decomposition.core_intent_summary,
        "anchor_relevant_content": decomposition.anchor_relevant_content,
        "dimensions": decomposition.dimensions,
        "candidate_constraints": decomposition.candidate_constraints,
        "candidate_variation_zones": decomposition.candidate_variation_zones,
        "contextual_information": decomposition.contextual_information,
        "uncertainties": decomposition.uncertainties,
    }


def _execution_revision_payload(revision: ExecutionAnchorRevision) -> dict[str, Any]:
    content_fields = (
        "technical_boundaries",
        "parameter_ranges",
        "delivery_conditions",
        "production_ready_criteria",
        "downstream_dependencies",
        "publish_requirements",
        "allowed_refinements",
        "escalation_conditions",
    )
    return {
        "id": str(revision.id),
        "revision_number": revision.revision_number,
        "status": revision.status,
        **{field: getattr(revision, field) for field in content_fields},
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
        "supersedes_decision_id": (
            str(decision.supersedes_decision_id)
            if decision.supersedes_decision_id is not None
            else None
        ),
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
    session: AsyncSession, *, version: Version, shot: Shot, project: Project
) -> dict[str, Any]:
    """Only locally persisted facts relevant to reviewing this one
    Version -- no binary media, no thumbnails, no raw/network-fetched
    ftrack payloads, no secrets, no unrelated Versions. No ftrack sync is
    ever run to build this.
    """
    project_payload: dict[str, Any] = {"id": str(project.id), "name": project.name}
    shot_payload: dict[str, Any] = {"id": str(shot.id), "name": shot.name, "source": shot.source}
    version_payload: dict[str, Any] = {
        "id": str(version.id),
        "name": version.name,
        "version_number": version.version_number,
        "description": version.description,
        "source": version.source,
        "created_at": version.created_at.isoformat(),
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
    decompositions_payload = [_decomposition_payload(d) for d in decompositions]

    core_anchor = await core_anchor_service.get_core_anchor_for_shot(session, shot.id)
    core_anchor_payload: dict[str, Any] | None = None
    confirmed_revision: CoreAnchorRevision | None = None
    if core_anchor is not None:
        all_core_revisions = await core_anchor_service.list_revisions_for_shot(session, shot.id)
        confirmed_revision = next((r for r in all_core_revisions if r.status == "confirmed"), None)
        draft_revision = next(
            (r for r in reversed(all_core_revisions) if r.status == "draft"), None
        )
        core_anchor_payload = {
            "id": str(core_anchor.id),
            "confirmed_revision": (
                _revision_payload(confirmed_revision) if confirmed_revision is not None else None
            ),
            "draft_revision": (
                _revision_payload(draft_revision) if draft_revision is not None else None
            ),
        }

    reconstructions = await context_reconstruction_service.list_context_reconstructions_for_shot(
        session, shot.id
    )
    newest_reconstruction = reconstructions[0] if reconstructions else None
    reconstruction_payload = (
        {
            "id": str(newest_reconstruction.id),
            "reconstructed_context": newest_reconstruction.reconstructed_context,
        }
        if newest_reconstruction is not None
        else None
    )

    assessments = await alignment_assessment_service.list_alignment_assessments_for_version(
        session, version.id
    )
    newest_assessment = assessments[-1] if assessments else None
    assessment_payload = (
        {
            "id": str(newest_assessment.id),
            "alignment_state": newest_assessment.alignment_state,
            "envelope": newest_assessment.envelope,
        }
        if newest_assessment is not None
        else None
    )

    review_notes = await versions_service.list_review_notes_for_version(session, version.id)
    review_notes_payload = [
        {
            "id": str(note.id),
            "content": note.content,
            "created_by_human_role": note.created_by_human_role,
            "created_at": note.created_at.isoformat(),
        }
        for note in review_notes
    ]

    decisions: list[Decision] = []
    if confirmed_revision is not None:
        decisions.extend(
            await _decisions_for(session, "core_anchor_revision", [confirmed_revision.id])
        )
    if assessments:
        decisions.extend(
            await _decisions_for(session, "alignment_assessment", [a.id for a in assessments])
        )
    decisions_payload = [_decision_payload(d) for d in decisions]

    tasks_result = await session.execute(select(Task).where(Task.shot_id == shot.id))
    tasks = list(tasks_result.scalars().all())
    tasks_payload: list[dict[str, Any]] = []
    for task in tasks:
        anchor = await execution_anchor_service.get_execution_anchor_for_task(session, task.id)
        active_revision_payload = None
        if anchor is not None and anchor.active_revision_id is not None:
            active_revision = await execution_anchor_service.get_execution_revision(
                session, anchor.active_revision_id
            )
            if active_revision is not None:
                active_revision_payload = _execution_revision_payload(active_revision)
        tasks_payload.append(
            {
                "id": str(task.id),
                "name": task.name,
                "department": task.department,
                "active_execution_anchor_revision": active_revision_payload,
            }
        )

    # HumanGate resolution facts, informational only -- not a citable
    # evidence source_type of their own (see contract module docstring);
    # the underlying Decision it produced is what may be cited.
    human_gate_payload: dict[str, Any] | None = None
    if confirmed_revision is not None:
        gate = await human_gate_service.get_gate_for_revision(session, confirmed_revision.id)
        if gate is not None:
            human_gate_payload = {
                "status": gate.status,
                "decision_id": str(gate.decision_id) if gate.decision_id is not None else None,
            }

    return {
        "project": project_payload,
        "shot": shot_payload,
        "version": version_payload,
        "intent_brief": brief_payload,
        "intent_decompositions": decompositions_payload,
        "core_anchor": core_anchor_payload,
        "context_reconstruction": reconstruction_payload,
        "alignment_assessment": assessment_payload,
        "review_notes": review_notes_payload,
        "decisions": decisions_payload,
        "tasks": tasks_payload,
        "human_gate": human_gate_payload,
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
    output: VFXSupervisorReviewOutput, snapshot_payload: dict[str, Any]
) -> None:
    """Every evidence reference the generator produced must cite an id
    genuinely present in this run's own ContextSnapshot -- never an
    invented id or one from a different Shot/Version/run.
    """
    known_ids = _collect_known_ids(snapshot_payload)
    items: list[VFXReviewItem | VFXProposedFeedbackNote] = [
        output.creative_direction_read,
        *output.strengths,
        *output.creative_concerns,
        *output.review_priorities,
        *output.proposed_feedback_notes,
    ]
    for item in items:
        for reference in item.evidence:
            if reference.source_id not in known_ids:
                raise AgentGenerationError(
                    "VFX Supervisor Agent review cited an id not present in this Version's "
                    f"ContextSnapshot (source_type={reference.source_type!r})"
                )


async def generate_vfx_supervisor_review(
    session: AsyncSession,
    actor: ActorContext,
    version_id: uuid.UUID,
    *,
    generator: VFXSupervisorReviewGenerator | None = None,
) -> VFXSupervisorReview:
    # Authoritative check: enforced here regardless of what the router
    # does. Generating a VFX Supervisor review is explicitly Human VFX
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

    project = await session.get(Project, shot.project_id)
    if project is None:
        raise InternalConsistencyError(
            f"Shot {shot.id} references missing Project {shot.project_id}"
        )

    payload = await _build_context_snapshot_payload(
        session, version=version, shot=shot, project=project
    )

    async def _persist(
        session: AsyncSession,
        snapshot: ContextSnapshot,
        run: AgentRun,
        output: VFXSupervisorReviewOutput,
    ) -> VFXSupervisorReview:
        _validate_evidence_resolves_to_snapshot(output, payload)
        review = VFXSupervisorReview(
            project_id=project.id,
            shot_id=shot.id,
            version_id=version.id,
            context_snapshot_id=snapshot.id,
            agent_run_id=run.id,
            review_output=output.model_dump(mode="json"),
        )
        session.add(review)
        await session.commit()
        await session.refresh(review)
        return review

    provider, model_name, prompt_version = prompt_registry.execution_metadata(
        _CAPABILITY_CREATIVE_REVIEW
    )
    spec = AgentExecutionSpec(
        shot_id=shot.id,
        agent_type=_AGENT_TYPE_VFX_SUPERVISOR_AGENT,
        capability=_CAPABILITY_CREATIVE_REVIEW,
        provider=provider,
        model_name=model_name,
        prompt_version=prompt_version,
        snapshot_payload=payload,
        resolve_generator=lambda: generator if generator is not None else _get_generator(),
        persist_result=_persist,
        failure_label="VFX Supervisor Agent creative review generation",
    )
    return await execute_agent(session, spec)


async def get_vfx_supervisor_review(
    session: AsyncSession, review_id: uuid.UUID
) -> VFXSupervisorReview | None:
    return await session.get(VFXSupervisorReview, review_id)


async def list_vfx_supervisor_reviews_for_version(
    session: AsyncSession, version_id: uuid.UUID
) -> list[VFXSupervisorReview]:
    result = await session.execute(
        select(VFXSupervisorReview)
        .where(VFXSupervisorReview.version_id == version_id)
        .order_by(VFXSupervisorReview.created_at.desc())
    )
    return list(result.scalars().all())
