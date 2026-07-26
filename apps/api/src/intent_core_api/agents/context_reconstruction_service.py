"""Core Agent: the ``context_reconstruction`` capability (Step 1C) --
a model-generated *interpretation* of the exact local production facts
recorded in one ``ContextSnapshot``, answering "why are we doing it this
way?" for downstream humans and future Role Agents
(docs/PRODUCT_SCOPE.md §6.3, docs/AGENT_CONTRACTS.md §4 "Context
Reconstruction").

Mirrors ``agents.intent_decomposition_service``'s exact shape: a
``ContextSnapshot``/``AgentRun`` pair, a ``Protocol`` + deterministic +
real-provider adapter seam, and a single service function owning the
full snapshot -> run -> generate -> persist -> finalize flow.

Mandatory distinction (see this repository's own §B "Critical
terminology boundaries" precedent in ``docs/IMPLEMENTATION_STATUS_AND_ROADMAP.md``):
``ContextSnapshot`` is *not* Context Reconstruction. The snapshot is an
exact, unopinionated copy of recorded facts; a ``ContextReconstruction``
is the Core Agent's model-generated reading of those facts, persisted as
its own immutable row. This capability never judges whether a Version is
aligned or drifting (that is Alignment Assessment's job, not this one's),
never produces an Intent Signal or a re-anchor recommendation, and never
touches a Core Anchor, an Execution Anchor, a Version, a ReviewNote, a
Decision, or ftrack -- the only domain-mutating calls this module makes
are creating a ContextSnapshot/AgentRun/ContextReconstruction row.
"""

from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime
from typing import Any, Final, Protocol

from intent_core_contracts.api.context_reconstruction import (
    ContextEvidenceReference,
    ContextEvidenceSourceType,
    ContextReconstructionItem,
    ContextReconstructionOutput,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.agents import intent_decomposition_service as decomposition_service
from intent_core_api.agents.models import AgentRun, ContextSnapshot
from intent_core_api.config import get_settings
from intent_core_api.intent import brief_service, core_anchor_service, execution_anchor_service
from intent_core_api.intent.core_anchor_service import CORE_ANCHOR_CONTENT_FIELDS
from intent_core_api.intent.models import (
    ContextReconstruction,
    CoreAnchorRevision,
    ExecutionAnchorRevision,
    IntentDecomposition,
)
from intent_core_api.production_context.models import Project, Shot, Task
from intent_core_api.versions_and_feedback import service as versions_service
from intent_core_api.versions_and_feedback.models import AlignmentAssessment, Version
from intent_core_api.workflow.actors import ActorContext, AgentType, HumanRole, require_human_role
from intent_core_api.workflow.exceptions import (
    AgentGenerationError,
    InternalConsistencyError,
    NotFoundError,
)
from intent_core_api.workflow.models import Decision

_CAPABILITY_CONTEXT_RECONSTRUCTION = "context_reconstruction"
_AGENT_TYPE_CORE_AGENT: Final[AgentType] = "core_agent"
_GENERATE_ROLES: frozenset[HumanRole] = frozenset({"vfx_supervisor"})

# DeepSeek's OpenAI-compatible endpoint; see agents.alignment_assessment_service
# / docs/decisions/ADR-0013 for why (no separate official DeepSeek SDK exists).
_DEEPSEEK_BASE_URL = "https://api.deepseek.com"

_DEEPSEEK_SYSTEM_PROMPT = """\
You are the Core Agent's context-reconstruction capability for a VFX \
production tool. You read exactly one ContextSnapshot -- a recorded copy \
of a Shot's local production facts (Project/Shot identity, IntentBrief, \
Intent Decompositions, Core Anchor content, Execution Anchor content, \
human Decisions, and Version/Review Note history) -- and produce a \
structured interpretation explaining why the current production context \
exists. Nothing else exists in your context -- do not invent facts, \
visual details, camera work, or content not present in the supplied \
snapshot.

You are strictly advisory and read-only: you never judge whether a \
Version is aligned or drifting, never state that a role made the wrong \
choice, never state that a Version should pass or fail review, never \
state that the Anchor should be replaced, never propose a re-anchor \
action, and never produce an Intent Signal or a Human Gate resolution -- \
none of that is available to you at this stage. You may only report \
recorded facts and their history (e.g. "a review note requested a \
specific change", "a Decision confirmed or rejected something", "a later \
record superseded an earlier Decision").

Every structured item you produce (original_intent, \
current_creative_direction, execution_context, and every entry in \
key_decisions/active_constraints/allowed_variations/unresolved_questions) \
must cite at least one piece of evidence -- a concrete record from the \
supplied snapshot, referenced by its exact source_id as it appears in \
the snapshot (e.g. the "id" field of the record you are citing). Each \
evidence reference's source_type must be exactly one of: "shot", \
"intent_brief", "intent_decomposition", "core_anchor_revision", \
"constraint", "variation_zone", "drift_risk", "anchor_reference", \
"open_question", "execution_anchor_revision", "decision", "version", \
"review_note" -- never any other value. Never state a conclusion you \
cannot support with cited evidence. If the current Core Anchor direction \
has not yet been established, or an optional fact is simply absent from \
the snapshot, say so honestly rather than inventing it, and list \
genuinely missing facts in context_gaps -- an empty list means nothing \
meaningful is missing. Do not invent a confidence score.

An <item> is {"summary": "<string>", "rationale": "<string>", \
"evidence": [<evidence>, ...]}. An <evidence> is {"source_type": \
"<string>", "source_id": "<string>", "label": "<string>"}.

Respond with a single JSON object only, no text outside of it, matching \
exactly this JSON shape (all fields required):
{
  "context_summary": "<string>",
  "original_intent": <item>,
  "current_creative_direction": <item>,
  "execution_context": <item>,
  "key_decisions": [<item>, ...],
  "active_constraints": [<item>, ...],
  "allowed_variations": [<item>, ...],
  "unresolved_questions": [<item>, ...],
  "context_gaps": ["<string>", ...]
}"""


def _utcnow() -> datetime:
    return datetime.now(UTC)


class ContextReconstructionGenerator(Protocol):
    """Pure input -> output: no DB/session access, no ftrack access, no
    ability to touch a Core Anchor, an Execution Anchor, a Version, a
    ReviewNote, or a Decision. Whatever it returns is persisted as-is
    into an immutable ContextReconstruction row.
    """

    def generate(self, *, snapshot_payload: dict[str, Any]) -> ContextReconstructionOutput: ...


def _evidence(
    source_type: ContextEvidenceSourceType, source_id: str, label: str
) -> ContextEvidenceReference:
    return ContextEvidenceReference(source_type=source_type, source_id=source_id, label=label)


class DeterministicContextReconstructionGenerator:
    """Offline, deterministic dev/test adapter: no network call, no API
    key, same output for the same input every time. Reads the actual
    supplied snapshot structure and cites real ids from it, honestly
    stating when an optional fact (IntentBrief, Core Anchor, Execution
    Anchors, Decisions, Versions) is absent rather than inventing one.
    """

    def generate(self, *, snapshot_payload: dict[str, Any]) -> ContextReconstructionOutput:
        shot = snapshot_payload["shot"]
        label = "[Core Agent context reconstruction - deterministic placeholder, review required]"
        shot_evidence = [_evidence("shot", shot["id"], f"Shot {shot['name']}")]

        context_gaps: list[str] = []

        # original_intent
        brief = snapshot_payload["intent_brief"]
        decompositions = snapshot_payload["intent_decompositions"]
        if brief is not None:
            intent_evidence = [
                _evidence("intent_brief", brief["id"], f"Intent Brief {brief['id']}")
            ]
            intent_summary = f"{label} Original intent recorded via Intent Brief {brief['id']}."
            if decompositions:
                latest_decomposition = decompositions[0]
                intent_evidence.append(
                    _evidence(
                        "intent_decomposition",
                        latest_decomposition["id"],
                        f"Intent Decomposition {latest_decomposition['id']}",
                    )
                )
                intent_summary += (
                    f" Core Agent decomposed it as: {latest_decomposition['core_intent_summary']}"
                )
            original_intent = ContextReconstructionItem(
                summary=intent_summary,
                rationale=f"{label} Derived directly from the recorded Intent Brief text.",
                evidence=intent_evidence,
            )
        else:
            original_intent = ContextReconstructionItem(
                summary=f"{label} No Intent Brief has been recorded for this Shot yet.",
                rationale=f"{label} The ContextSnapshot's intent_brief field is null.",
                evidence=shot_evidence,
            )
            context_gaps.append("No Intent Brief has been recorded for this Shot.")

        # current_creative_direction
        core_anchor = snapshot_payload["core_anchor"]
        if core_anchor is not None and core_anchor["confirmed_revision"] is not None:
            revision = core_anchor["confirmed_revision"]
            current_creative_direction = ContextReconstructionItem(
                summary=(
                    f"{label} Confirmed Core Anchor revision #{revision['revision_number']}: "
                    f"{revision['core_summary']}"
                ),
                rationale=f"{label} This is the Shot's currently confirmed Core Anchor revision.",
                evidence=[
                    _evidence(
                        "core_anchor_revision",
                        revision["id"],
                        f"Core Anchor revision {revision['id']}",
                    )
                ],
            )
        elif core_anchor is not None and core_anchor["draft_revision"] is not None:
            revision = core_anchor["draft_revision"]
            current_creative_direction = ContextReconstructionItem(
                summary=(
                    f"{label} A Core Anchor draft revision #{revision['revision_number']} exists "
                    "but is not yet confirmed."
                ),
                rationale=f"{label} No confirmed Core Anchor revision exists yet for this Shot.",
                evidence=[
                    _evidence(
                        "core_anchor_revision",
                        revision["id"],
                        f"Core Anchor draft {revision['id']}",
                    )
                ],
            )
            context_gaps.append("The Core Anchor has a draft revision but nothing confirmed yet.")
        else:
            current_creative_direction = ContextReconstructionItem(
                summary=f"{label} No Core Anchor direction has yet been established for this Shot.",
                rationale=f"{label} No CoreAnchor row exists for this Shot.",
                evidence=shot_evidence,
            )
            context_gaps.append("No Core Anchor has been established for this Shot.")

        # execution_context
        execution_anchors = snapshot_payload["execution_anchors"]
        if execution_anchors:
            execution_context = ContextReconstructionItem(
                summary=(
                    f"{label} {len(execution_anchors)} task(s) have Execution Anchor context "
                    "recorded."
                ),
                rationale=(
                    f"{label} Derived from the recorded Execution Anchors for this Shot's tasks."
                ),
                evidence=[
                    _evidence(
                        "execution_anchor_revision",
                        ea["active_revision"]["id"],
                        f"Execution Anchor for task {ea['task_name']}",
                    )
                    for ea in execution_anchors
                    if ea["active_revision"] is not None
                ]
                or shot_evidence,
            )
        else:
            execution_context = ContextReconstructionItem(
                summary=(
                    f"{label} No Execution Anchor context is recorded for this Shot's tasks yet."
                ),
                rationale=f"{label} No ExecutionAnchor rows exist for this Shot's tasks.",
                evidence=shot_evidence,
            )

        # key_decisions
        decisions = snapshot_payload["decisions"]
        key_decisions = [
            ContextReconstructionItem(
                summary=(
                    f"{label} {decision['decision_type']} recorded by "
                    f"{decision['actor_human_role']}."
                ),
                rationale=(
                    f"{label} Recorded human Decision on {decision['entity_type']} "
                    f"{decision['entity_id']}."
                ),
                evidence=[_evidence("decision", decision["id"], f"Decision {decision['id']}")],
            )
            for decision in decisions
        ]

        # active_constraints / allowed_variations from the confirmed (else draft) revision
        active_revision: dict[str, Any] | None = None
        if core_anchor is not None:
            active_revision = core_anchor["confirmed_revision"] or core_anchor["draft_revision"]
        active_revision_id = active_revision["id"] if active_revision is not None else None
        active_constraints = [
            ContextReconstructionItem(
                summary=f"{label} {item['content']}",
                rationale=(
                    f"{label} Recorded Constraint on Core Anchor revision {active_revision_id}."
                ),
                evidence=[_evidence("constraint", item["id"], f"Constraint {item['id']}")],
            )
            for item in (active_revision["constraints"] if active_revision is not None else [])
        ]
        allowed_variations = [
            ContextReconstructionItem(
                summary=f"{label} {item['content']}",
                rationale=(
                    f"{label} Recorded VariationZone on Core Anchor revision {active_revision_id}."
                ),
                evidence=[_evidence("variation_zone", item["id"], f"Variation zone {item['id']}")],
            )
            for item in (active_revision["variation_zones"] if active_revision is not None else [])
        ]
        unresolved_questions = [
            ContextReconstructionItem(
                summary=f"{label} {item['question']}",
                rationale=(
                    f"{label} Recorded OpenQuestion on Core Anchor revision {active_revision_id}."
                ),
                evidence=[_evidence("open_question", item["id"], f"Open question {item['id']}")],
            )
            for item in (active_revision["open_questions"] if active_revision is not None else [])
        ]

        if not decisions:
            context_gaps.append("No human Decisions have been recorded for this Shot yet.")
        if not snapshot_payload["versions"]:
            context_gaps.append("No Versions have been recorded for this Shot yet.")

        has_confirmed = bool(core_anchor and core_anchor["confirmed_revision"])
        confirmed_phrase = "a confirmed" if has_confirmed else "no confirmed"
        return ContextReconstructionOutput(
            context_summary=(
                f"{label} Reconstructed from {len(decompositions)} Intent Decomposition(s), "
                f"{confirmed_phrase} Core Anchor, {len(execution_anchors)} Execution Anchor(s), "
                f"{len(decisions)} recorded Decision(s), and "
                f"{len(snapshot_payload['versions'])} Version(s)."
            ),
            original_intent=original_intent,
            current_creative_direction=current_creative_direction,
            execution_context=execution_context,
            key_decisions=key_decisions,
            active_constraints=active_constraints,
            allowed_variations=allowed_variations,
            unresolved_questions=unresolved_questions,
            context_gaps=context_gaps,
        )


class DeepSeekContextReconstructionGenerator:
    """Same DeepSeek integration path as
    ``DeepSeekIntentDecompositionGenerator`` (official ``openai`` package
    pointed at DeepSeek's OpenAI-compatible endpoint; see ADR-0013) --
    one non-streaming JSON-mode call, validated against
    ``ContextReconstructionOutput`` explicitly. Model name comes from
    ``Settings.model_name`` (never hardcoded).
    """

    def __init__(self, *, api_key: str, model_name: str) -> None:
        self._api_key = api_key
        self._model_name = model_name

    def generate(self, *, snapshot_payload: dict[str, Any]) -> ContextReconstructionOutput:
        from openai import OpenAI

        client = OpenAI(api_key=self._api_key, base_url=_DEEPSEEK_BASE_URL)
        response = client.chat.completions.create(
            model=self._model_name,
            max_tokens=4096,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": _DEEPSEEK_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": (
                        "Reconstruct the context for this Shot. Respond with the JSON "
                        "object described in the system prompt. Context (JSON):\n"
                        + json.dumps(snapshot_payload, indent=2)
                    ),
                },
            ],
        )
        content = response.choices[0].message.content
        if not content:
            raise AgentGenerationError(
                "DeepSeek response had empty content "
                f"(finish_reason={response.choices[0].finish_reason!r})"
            )
        return ContextReconstructionOutput.model_validate_json(content)


def _resolve_provider_name() -> str:
    settings = get_settings()
    # Same blank-.env-value footgun as core_agent_service._resolve_provider_name.
    return settings.model_provider or "deterministic"


def _get_generator() -> ContextReconstructionGenerator:
    provider = _resolve_provider_name()
    if provider == "deterministic":
        return DeterministicContextReconstructionGenerator()
    if provider == "deepseek":
        settings = get_settings()
        if not settings.model_api_key:
            raise AgentGenerationError("model_provider='deepseek' requires MODEL_API_KEY to be set")
        if not settings.model_name:
            raise AgentGenerationError("model_provider='deepseek' requires MODEL_NAME to be set")
        return DeepSeekContextReconstructionGenerator(
            api_key=settings.model_api_key, model_name=settings.model_name
        )
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
    session: AsyncSession, *, shot: Shot, project: Project
) -> dict[str, Any]:
    """Only locally persisted facts relevant to explaining the current
    state -- no binary media, no generated thumbnails, no model visual
    analysis, no raw/network-fetched ftrack payloads, no WritebackRecord
    internals, no secrets. No ftrack sync is ever run to build this.
    """
    project_payload: dict[str, Any] = {"id": str(project.id), "name": project.name}
    shot_payload: dict[str, Any] = {
        "id": str(shot.id),
        "name": shot.name,
        "source": shot.source,
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
    all_core_revisions: list[CoreAnchorRevision] = []
    if core_anchor is not None:
        all_core_revisions = await core_anchor_service.list_revisions_for_shot(session, shot.id)
        confirmed = next((r for r in all_core_revisions if r.status == "confirmed"), None)
        draft = next((r for r in reversed(all_core_revisions) if r.status == "draft"), None)
        core_anchor_payload = {
            "id": str(core_anchor.id),
            "confirmed_revision": _revision_payload(confirmed) if confirmed is not None else None,
            "draft_revision": _revision_payload(draft) if draft is not None else None,
        }

    tasks_result = await session.execute(select(Task).where(Task.shot_id == shot.id))
    tasks = list(tasks_result.scalars().all())

    execution_anchors_payload: list[dict[str, Any]] = []
    all_execution_revision_ids: list[uuid.UUID] = []
    for task in tasks:
        anchor = await execution_anchor_service.get_execution_anchor_for_task(session, task.id)
        if anchor is None:
            continue
        revisions_result = await session.execute(
            select(ExecutionAnchorRevision)
            .where(ExecutionAnchorRevision.execution_anchor_id == anchor.id)
            .order_by(ExecutionAnchorRevision.revision_number)
        )
        revisions = list(revisions_result.scalars().all())
        all_execution_revision_ids.extend(revision.id for revision in revisions)

        active_revision = None
        if anchor.active_revision_id is not None:
            active_revision = next(
                (r for r in revisions if r.id == anchor.active_revision_id), None
            )
        execution_anchors_payload.append(
            {
                "id": str(anchor.id),
                "task_id": str(task.id),
                "task_name": task.name,
                "department": task.department,
                "is_stale": anchor.is_stale,
                "active_revision": (
                    _execution_revision_payload(active_revision)
                    if active_revision is not None
                    else None
                ),
            }
        )

    versions_result = await session.execute(
        select(Version).where(Version.shot_id == shot.id).order_by(Version.created_at)
    )
    versions = list(versions_result.scalars().all())
    versions_payload: list[dict[str, Any]] = []
    for version in versions:
        review_notes = await versions_service.list_review_notes_for_version(session, version.id)
        versions_payload.append(
            {
                "id": str(version.id),
                "name": version.name,
                "version_number": version.version_number,
                "created_at": version.created_at.isoformat(),
                "review_notes": [
                    {
                        "id": str(note.id),
                        "content": note.content,
                        "author": note.created_by_actor_id,
                        "created_at": note.created_at.isoformat(),
                    }
                    for note in review_notes
                ],
            }
        )

    assessment_ids: list[uuid.UUID] = []
    if versions:
        assessment_result = await session.execute(
            select(AlignmentAssessment.id).where(
                AlignmentAssessment.version_id.in_([v.id for v in versions])
            )
        )
        assessment_ids = list(assessment_result.scalars().all())

    decisions: list[Decision] = []
    decisions.extend(
        await _decisions_for(session, "core_anchor_revision", [r.id for r in all_core_revisions])
    )
    decisions.extend(
        await _decisions_for(session, "execution_anchor_revision", all_execution_revision_ids)
    )
    decisions.extend(await _decisions_for(session, "alignment_assessment", assessment_ids))
    decisions_payload = [_decision_payload(d) for d in decisions]

    return {
        "project": project_payload,
        "shot": shot_payload,
        "intent_brief": brief_payload,
        "intent_decompositions": decompositions_payload,
        "core_anchor": core_anchor_payload,
        "execution_anchors": execution_anchors_payload,
        "decisions": decisions_payload,
        "versions": versions_payload,
    }


async def generate_context_reconstruction(
    session: AsyncSession,
    actor: ActorContext,
    shot_id: uuid.UUID,
    *,
    generator: ContextReconstructionGenerator | None = None,
) -> ContextReconstruction:
    # Authoritative check: enforced here regardless of what the router
    # does, matching every other capability in this module family.
    # Generating a context reconstruction is explicitly Human VFX
    # Supervisor only -- no agent actor is ever accepted here.
    require_human_role(actor, _GENERATE_ROLES)

    shot = await session.get(Shot, shot_id)
    if shot is None:
        raise NotFoundError("Shot not found")

    project = await session.get(Project, shot.project_id)
    if project is None:
        raise InternalConsistencyError(
            f"Shot {shot_id} references missing Project {shot.project_id}"
        )

    payload = await _build_context_snapshot_payload(session, shot=shot, project=project)
    snapshot = ContextSnapshot(shot_id=shot_id, payload=payload)
    session.add(snapshot)
    await session.commit()
    await session.refresh(snapshot)

    run = AgentRun(
        shot_id=shot_id,
        context_snapshot_id=snapshot.id,
        agent_type=_AGENT_TYPE_CORE_AGENT,
        capability=_CAPABILITY_CONTEXT_RECONSTRUCTION,
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
            raise AgentGenerationError(f"Context reconstruction generation failed: {exc}") from exc

        reconstruction = ContextReconstruction(
            shot_id=shot_id,
            context_snapshot_id=snapshot.id,
            agent_run_id=run.id,
            reconstructed_context=output.model_dump(mode="json"),
        )
        session.add(reconstruction)
        await session.commit()
        await session.refresh(reconstruction)
    except Exception as exc:
        run.status = "failed"
        run.error = str(exc)
        run.completed_at = _utcnow()
        await session.commit()
        raise

    run.status = "succeeded"
    run.completed_at = _utcnow()
    await session.commit()

    return reconstruction


async def get_context_reconstruction(
    session: AsyncSession, reconstruction_id: uuid.UUID
) -> ContextReconstruction | None:
    return await session.get(ContextReconstruction, reconstruction_id)


async def list_context_reconstructions_for_shot(
    session: AsyncSession, shot_id: uuid.UUID
) -> list[ContextReconstruction]:
    result = await session.execute(
        select(ContextReconstruction)
        .where(ContextReconstruction.shot_id == shot_id)
        .order_by(ContextReconstruction.created_at.desc())
    )
    return list(result.scalars().all())
