"""Core Agent: the smallest end-to-end slice (B1) -- generates a Core
Anchor draft for human review. WP-B1.5 extends B1 with an immutable
``ContextSnapshot`` of the local (already-synced) context used, and a
persisted ``AgentRun`` recording that one execution -- both defined in
``agents.models``.

Reuses the existing A1 draft-creation workflow
(``intent.core_anchor_service.create_draft_revision``) so every
permission check, revision-numbering rule, and persistence path already
enforced there applies unchanged; this module only assembles the input
context and produces the draft content. It never confirms, rejects,
supersedes, or requests ftrack write-back -- there is no code path here
that could do any of those (the only domain-mutating calls this module
makes are creating a ContextSnapshot/AgentRun row and calling
``create_draft_revision``, which only ever creates a ``status="draft"``
revision).

See docs/AGENT_CONTRACTS.md §4 ("Primary Anchor Drafting", "Context
Reconstruction") and docs/PRODUCT_SCOPE.md §6.2.

Deliberately not using ``intent_core_contracts.agents.envelope``
(``AgentOutputEnvelope``/``AgentRunRecord``): that shape is for advisory
outputs (observations/inferences/evidence/confidence) like alignment
assessments and re-anchor proposals, which are out of scope for B1.5.
This slice's deliverable is still a structured domain object
(``CoreAnchorRevisionDraftCreate``); ``agents.models.AgentRun`` is a
separate, minimal execution-record table, not that envelope.

Context Snapshot is built exclusively from data already synchronised
into ICAS PostgreSQL (Shot/Project/Task/IntentBrief rows and any
existing ``ExternalEntityLink``s) -- this module never calls ftrack
directly, matching every other Agent in this codebase
(docs/ARCHITECTURE.md §3.4).

Model provider boundary: ``CoreAnchorDraftGenerator`` is the seam a real
model-backed generator would implement (docs/ARCHITECTURE.md §3.5, §4:
"Agents must go through the Model Gateway once a runtime model provider
is chosen"). Only ``DeterministicCoreAnchorDraftGenerator`` exists today
-- see its docstring for exactly what connecting a real provider would
require.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any, Final, Protocol

from intent_core_contracts.api.intent import (
    ConstraintInput,
    CoreAnchorRevisionDraftCreate,
    OpenQuestionInput,
    VariationZoneInput,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.agents.models import AgentRun, ContextSnapshot
from intent_core_api.config import get_settings
from intent_core_api.integrations import external_link_service
from intent_core_api.intent import brief_service, core_anchor_service
from intent_core_api.intent.models import CoreAnchorRevision, IntentBrief, IntentDecomposition
from intent_core_api.production_context.models import Project, Shot, Task
from intent_core_api.workflow.actors import (
    ActorContext,
    AgentType,
    HumanRole,
    build_agent_actor,
    require_human_role,
)
from intent_core_api.workflow.exceptions import (
    AgentGenerationError,
    ConflictError,
    InternalConsistencyError,
    NotFoundError,
)

_CAPABILITY_CORE_ANCHOR_DRAFTING = "core_anchor_drafting"
_AGENT_TYPE_CORE_AGENT: Final[AgentType] = "core_agent"
# Step 1B: applying a decomposition to a new draft is an authoritative
# application-triggering action, not itself a draft-creation allowlist
# entry -- only a human VFX Supervisor may invoke it (never an agent
# actor), enforced here before anything else runs.
_APPLY_DECOMPOSITION_ROLES: frozenset[HumanRole] = frozenset({"vfx_supervisor"})
_PROVIDER_DETERMINISTIC_TRANSFORM = "deterministic"


def _utcnow() -> datetime:
    return datetime.now(UTC)


class CoreAnchorDraftGenerator(Protocol):
    """Pure input -> output by design: no ftrack access, no session/DB
    access, no ability to confirm/reject/write back -- it only ever
    returns content for a new draft. Whatever it returns still goes
    through ``core_anchor_service.create_draft_revision``'s own
    validation and persistence, same as a human-authored draft.
    """

    def generate(self, *, shot_name: str, brief_text: str) -> CoreAnchorRevisionDraftCreate: ...


class DeterministicCoreAnchorDraftGenerator:
    """Offline, deterministic dev/test adapter: no network call, no API
    key, same output for the same input every time. Does not attempt
    real language understanding or invent creative judgement the system
    doesn't have -- each of the 7 fields is a clearly-labeled echo of the
    intent brief, honest about being a placeholder that needs human
    review rather than a real analysis.

    To connect a real model behind this same boundary: implement
    ``CoreAnchorDraftGenerator.generate()`` against a real provider (this
    project's ``claude-api`` skill -- model ``claude-opus-4-8``,
    structured output via ``client.messages.parse()`` against
    ``CoreAnchorRevisionDraftCreate`` directly), read
    ``MODEL_PROVIDER``/``MODEL_API_KEY``/``MODEL_NAME`` (already reserved
    in ``.env.example``, unused today) into ``Settings``, and add a
    branch for it in ``_resolve_provider_name()``/``_get_generator()``
    below. Nothing else in this module or the router needs to change.
    """

    def generate(self, *, shot_name: str, brief_text: str) -> CoreAnchorRevisionDraftCreate:
        excerpt = brief_text.strip()
        label = "[Core Agent draft - deterministic placeholder, review required]"
        return CoreAnchorRevisionDraftCreate(
            shot_objective=f"{label} Objective for {shot_name}, from the intent brief: {excerpt}",
            emotional_tone=f"{label} Emotional tone per the intent brief: {excerpt}",
            visual_focus=f"{label} Visual focus per the intent brief: {excerpt}",
            rhythm_intensity=f"{label} Rhythm and intensity per the intent brief: {excerpt}",
            character_relationship=f"{label} Character relationship per the brief: {excerpt}",
            narrative_priority=f"{label} Narrative priority per the intent brief: {excerpt}",
            core_summary=f"{label} Summary of the intent brief: {excerpt}",
        )


def _resolve_provider_name() -> str:
    settings = get_settings()
    # An unset/blank MODEL_PROVIDER means "use the default", not "no
    # provider configured" -- .env.example ships it blank on purpose
    # (matches DATABASE_URL's own shape), and pydantic-settings treats an
    # explicit blank in .env as set-to-empty-string rather than falling
    # back to the field default, so that has to be handled here.
    return settings.model_provider or "deterministic"


def _get_generator() -> CoreAnchorDraftGenerator:
    provider = _resolve_provider_name()
    if provider == "deterministic":
        return DeterministicCoreAnchorDraftGenerator()
    raise AgentGenerationError(
        f"model_provider={provider!r} is not implemented; only "
        "'deterministic' exists in this slice (see core_agent_service module docstring)"
    )


async def _build_context_snapshot_payload(
    session: AsyncSession,
    *,
    shot: Shot,
    project: Project,
    tasks: list[Task],
    brief: IntentBrief,
) -> dict[str, Any]:
    """Compact JSON payload: only fields that already exist locally, only
    ftrack external ids where an ExternalEntityLink already records one
    (manual-sourced records simply omit that key -- nothing is invented).
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

    task_payloads: list[dict[str, Any]] = []
    for task in tasks:
        task_payload: dict[str, Any] = {
            "id": str(task.id),
            "name": task.name,
            "source": task.source,
            "department": task.department,
        }
        external_id = await external_link_service.find_external_id_for_entity(
            session, entity_type="task", entity_id=task.id, source="ftrack"
        )
        if external_id is not None:
            task_payload["external_id"] = external_id
        task_payloads.append(task_payload)

    return {
        "shot": shot_payload,
        "project": project_payload,
        "tasks": task_payloads,
        "intent_brief": {
            "id": str(brief.id),
            "raw_text": brief.raw_text,
            "source": brief.source,
            "created_at": brief.created_at.isoformat(),
        },
    }


async def generate_core_anchor_draft(
    session: AsyncSession,
    shot_id: uuid.UUID,
    *,
    generator: CoreAnchorDraftGenerator | None = None,
) -> CoreAnchorRevision:
    shot = await session.get(Shot, shot_id)
    if shot is None:
        raise NotFoundError("Shot not found")

    briefs = await brief_service.list_briefs_for_shot(session, shot_id)
    if not briefs:
        raise NotFoundError(
            "No Intent Brief exists for this Shot; cannot generate a Core Anchor draft"
        )
    latest_brief = briefs[-1]

    existing_revisions = await core_anchor_service.list_revisions_for_shot(session, shot_id)
    if any(revision.status == "draft" for revision in existing_revisions):
        raise ConflictError(
            "An editable Core Anchor draft already exists for this shot; confirm, "
            "reject, or edit it before generating a new one"
        )

    project = await session.get(Project, shot.project_id)
    if project is None:
        raise InternalConsistencyError(
            f"Shot {shot_id} references missing Project {shot.project_id}"
        )

    task_rows = await session.execute(
        select(Task).where(Task.shot_id == shot_id).order_by(Task.created_at)
    )
    tasks = list(task_rows.scalars().all())

    # Everything above is pre-flight validation -- nothing durable is
    # created yet. A ContextSnapshot/AgentRun is only ever created once
    # we're actually about to start the agent.
    payload = await _build_context_snapshot_payload(
        session, shot=shot, project=project, tasks=tasks, brief=latest_brief
    )
    snapshot = ContextSnapshot(shot_id=shot_id, payload=payload)
    session.add(snapshot)
    await session.commit()
    await session.refresh(snapshot)

    run = AgentRun(
        shot_id=shot_id,
        context_snapshot_id=snapshot.id,
        agent_type=_AGENT_TYPE_CORE_AGENT,
        capability=_CAPABILITY_CORE_ANCHOR_DRAFTING,
        provider=_resolve_provider_name(),
        status="running",
    )
    session.add(run)
    await session.commit()
    await session.refresh(run)

    try:
        active_generator = generator if generator is not None else _get_generator()
        try:
            content = active_generator.generate(
                shot_name=payload["shot"]["name"], brief_text=payload["intent_brief"]["raw_text"]
            )
        except AgentGenerationError:
            raise
        except Exception as exc:  # noqa: BLE001 -- any provider/runtime failure becomes a clear 502
            raise AgentGenerationError(f"Core Agent draft generation failed: {exc}") from exc

        agent_actor = build_agent_actor(_AGENT_TYPE_CORE_AGENT, agent_run_id=run.id)
        revision = await core_anchor_service.create_draft_revision(
            session,
            agent_actor,
            shot_id,
            content.model_dump(),
            context_snapshot_id=snapshot.id,
        )
    except Exception as exc:
        run.status = "failed"
        run.error = str(exc)
        run.completed_at = _utcnow()
        await session.commit()
        raise

    run.status = "succeeded"
    run.result_revision_id = revision.id
    run.completed_at = _utcnow()
    await session.commit()

    return revision


def _draft_content_from_decomposition(
    decomposition: IntentDecomposition,
) -> CoreAnchorRevisionDraftCreate:
    """Deterministic field mapping only -- no model call. See module
    docstring and Step 1B's fixed mapping: dimensions without a scalar
    Core Anchor field (technical_execution_requirements,
    visual_detail_constraints) already fed into candidate_constraints at
    decomposition time, so nothing further is done with them here.
    """
    dims = decomposition.dimensions
    return CoreAnchorRevisionDraftCreate(
        shot_objective=decomposition.anchor_relevant_content,
        emotional_tone=dims["emotional_tone"]["summary"],
        visual_focus=dims["visual_focus"]["summary"],
        rhythm_intensity=dims["rhythm_and_intensity"]["summary"],
        character_relationship=dims["character_relationships"]["summary"],
        narrative_priority=dims["narrative_priority"]["summary"],
        core_summary=decomposition.core_intent_summary,
        constraints=[ConstraintInput(content=c) for c in decomposition.candidate_constraints],
        variation_zones=[
            VariationZoneInput(content=v) for v in decomposition.candidate_variation_zones
        ],
        drift_risks=[],
        references=[],
        open_questions=[OpenQuestionInput(question=u) for u in decomposition.uncertainties],
    )


async def create_core_anchor_draft_from_decomposition(
    session: AsyncSession,
    actor: ActorContext,
    decomposition_id: uuid.UUID,
) -> CoreAnchorRevision:
    """Step 1B "Use in Core Anchor draft": a human-triggered, purely
    deterministic transform (no second model call -- the model already
    ran once, at decomposition time) that turns one immutable
    IntentDecomposition into a new editable CoreAnchorRevision draft.

    Never confirms, rejects, or writes back -- the only domain-mutating
    calls here are creating a ContextSnapshot/AgentRun row and calling
    ``core_anchor_service.create_draft_revision``, which only ever
    creates a ``status="draft"`` revision (same guarantee as
    ``generate_core_anchor_draft``).
    """
    # Human VFX Supervisor only -- never an agent actor, unlike
    # create_draft_revision's own allowlist (which exists for a
    # *different* caller: the Core Agent constructing the draft itself).
    require_human_role(actor, _APPLY_DECOMPOSITION_ROLES)

    decomposition = await session.get(IntentDecomposition, decomposition_id)
    if decomposition is None:
        raise NotFoundError("Intent decomposition not found")

    shot = await session.get(Shot, decomposition.shot_id)
    if shot is None:
        raise InternalConsistencyError(
            f"IntentDecomposition {decomposition_id} references missing Shot "
            f"{decomposition.shot_id}"
        )
    intent_brief = await session.get(IntentBrief, decomposition.intent_brief_id)
    if intent_brief is None:
        raise InternalConsistencyError(
            f"IntentDecomposition {decomposition_id} references missing IntentBrief "
            f"{decomposition.intent_brief_id}"
        )

    # Refuse to overwrite an existing draft -- identical guard to
    # generate_core_anchor_draft, reusing the same Core Anchor lock and
    # conflict behaviour rather than inventing a second one.
    existing_revisions = await core_anchor_service.list_revisions_for_shot(session, shot.id)
    if any(revision.status == "draft" for revision in existing_revisions):
        raise ConflictError(
            "An editable Core Anchor draft already exists for this shot; confirm, "
            "reject, or edit it before applying a decomposition"
        )

    # Everything above is pre-flight validation -- nothing durable is
    # created yet, matching generate_core_anchor_draft's own convention.
    snapshot_payload: dict[str, Any] = {
        "source_intent_decomposition_id": str(decomposition.id),
        "decomposition_output": {
            "core_intent_summary": decomposition.core_intent_summary,
            "anchor_relevant_content": decomposition.anchor_relevant_content,
            "dimensions": decomposition.dimensions,
            "candidate_constraints": decomposition.candidate_constraints,
            "candidate_variation_zones": decomposition.candidate_variation_zones,
            "contextual_information": decomposition.contextual_information,
            "uncertainties": decomposition.uncertainties,
        },
        "shot": {"id": str(shot.id), "name": shot.name, "source": shot.source},
        "intent_brief": {"id": str(intent_brief.id), "raw_text": intent_brief.raw_text},
    }
    snapshot = ContextSnapshot(shot_id=shot.id, payload=snapshot_payload)
    session.add(snapshot)
    await session.commit()
    await session.refresh(snapshot)

    run = AgentRun(
        shot_id=shot.id,
        context_snapshot_id=snapshot.id,
        agent_type=_AGENT_TYPE_CORE_AGENT,
        capability=_CAPABILITY_CORE_ANCHOR_DRAFTING,
        provider=_PROVIDER_DETERMINISTIC_TRANSFORM,
        status="running",
    )
    session.add(run)
    await session.commit()
    await session.refresh(run)

    try:
        content = _draft_content_from_decomposition(decomposition)
        agent_actor = build_agent_actor(_AGENT_TYPE_CORE_AGENT, agent_run_id=run.id)
        revision = await core_anchor_service.create_draft_revision(
            session,
            agent_actor,
            shot.id,
            content.model_dump(),
            context_snapshot_id=snapshot.id,
            source_intent_decomposition_id=decomposition.id,
        )
    except Exception as exc:
        run.status = "failed"
        run.error = str(exc)
        run.completed_at = _utcnow()
        await session.commit()
        raise

    run.status = "succeeded"
    run.result_revision_id = revision.id
    run.completed_at = _utcnow()
    await session.commit()

    return revision


async def get_context_snapshot(
    session: AsyncSession, snapshot_id: uuid.UUID
) -> ContextSnapshot | None:
    return await session.get(ContextSnapshot, snapshot_id)


async def get_agent_run(session: AsyncSession, agent_run_id: uuid.UUID) -> AgentRun | None:
    return await session.get(AgentRun, agent_run_id)
