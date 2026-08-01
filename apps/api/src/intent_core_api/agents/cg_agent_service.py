"""CG Supervisor Agent: the ``execution_anchor_drafting`` capability --
generates an Execution Anchor draft for human review, translating the
Task's Shot's active confirmed Core Anchor into Execution Anchor's
operational fields (technical_boundaries, parameter_ranges,
delivery_conditions, production_ready_criteria, downstream_dependencies,
publish_requirements, allowed_refinements, escalation_conditions).

Mirrors ``agents.core_agent_service``'s exact architecture: reuses the
existing draft-creation workflow
(``intent.execution_anchor_service.create_draft_revision``) so every
permission check, HumanGate-opening, and persistence path already
enforced there applies unchanged -- this module only assembles the input
context and produces the draft content. It never confirms, rejects, or
performs write-back; the only domain-mutating calls this module makes are
creating a ContextSnapshot/AgentRun row (via ``agents.runtime.execute_agent``)
and calling ``create_draft_revision``, which only ever creates a
``status="draft"`` revision. The active Core Anchor is only ever read
here, never written.

Model provider boundary: ``ExecutionAnchorDraftGenerator`` is the seam a
real model-backed generator would implement. Only
``DeterministicExecutionAnchorDraftGenerator`` exists today -- the same
gap as ``core_agent_service.generate_core_anchor_draft``, which also has
no DeepSeek adapter wired despite ``core_anchor_drafting`` being
registered in ``agents.prompt_registry``. To connect a real model behind
this same boundary: register an ``execution_anchor_drafting`` prompt in
``agents.prompt_registry`` and add a DeepSeek-backed generator branch in
``_get_generator()`` below, matching the other capabilities' adapters.
Nothing else in this module or the router would need to change.
"""

from __future__ import annotations

import uuid
from typing import Any, Final, Protocol

from intent_core_contracts.api.execution_anchor import ExecutionAnchorRevisionDraftCreate
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.agents import model_gateway
from intent_core_api.agents.models import AgentRun, ContextSnapshot
from intent_core_api.agents.runtime import AgentExecutionSpec, execute_agent
from intent_core_api.integrations import external_link_service
from intent_core_api.intent import execution_anchor_service
from intent_core_api.intent.models import CoreAnchor, CoreAnchorRevision, ExecutionAnchorRevision
from intent_core_api.production_context.models import Project, Shot, Task
from intent_core_api.workflow.actors import AgentType, build_agent_actor
from intent_core_api.workflow.exceptions import (
    AgentGenerationError,
    ConflictError,
    InternalConsistencyError,
    NotFoundError,
)

_CAPABILITY_EXECUTION_ANCHOR_DRAFTING = "execution_anchor_drafting"
_AGENT_TYPE_CG_SUPERVISOR_AGENT: Final[AgentType] = "cg_supervisor_agent"


class ExecutionAnchorDraftGenerator(Protocol):
    """Pure input -> output: no DB/session access, no ftrack access, no
    ability to confirm/reject/write back -- it only ever returns content
    for a new draft. Whatever it returns still goes through
    ``execution_anchor_service.create_draft_revision``'s own validation
    and persistence, same as a human-authored draft.
    """

    def generate(
        self, *, snapshot_payload: dict[str, Any]
    ) -> ExecutionAnchorRevisionDraftCreate: ...


class DeterministicExecutionAnchorDraftGenerator:
    """Offline, deterministic dev/test adapter: no network call, no API
    key, same output for the same input every time. Does not attempt
    real language understanding or invent operational judgement the
    system doesn't have -- each of the 8 fields is a clearly-labeled
    derivation of the confirmed Core Anchor's own real content, honest
    about being a placeholder that needs human review rather than a
    real analysis (same convention as
    ``core_agent_service.DeterministicCoreAnchorDraftGenerator``).
    """

    def generate(self, *, snapshot_payload: dict[str, Any]) -> ExecutionAnchorRevisionDraftCreate:
        core = snapshot_payload["core_anchor"]
        task_name = snapshot_payload["task"]["name"]
        label = "[CG Agent execution anchor draft - deterministic placeholder, review required]"

        return ExecutionAnchorRevisionDraftCreate(
            technical_boundaries=(
                f"{label} Technical boundaries for {task_name}, per the confirmed Core "
                f"Anchor's core summary: {core['core_summary']}"
            ),
            parameter_ranges=(
                f"{label} Parameter ranges informed by the confirmed visual focus: "
                f"{core['visual_focus']}"
            ),
            delivery_conditions=(
                f"{label} Delivery conditions informed by the confirmed narrative priority: "
                f"{core['narrative_priority']}"
            ),
            production_ready_criteria=(
                f"{label} Production-ready when execution matches the confirmed emotional "
                f"tone: {core['emotional_tone']}"
            ),
            downstream_dependencies=(
                f"{label} Downstream dependencies informed by the confirmed character "
                f"relationship: {core['character_relationship']}"
            ),
            publish_requirements=(
                f"{label} Publish requires confirming rhythm and intensity is preserved: "
                f"{core['rhythm_intensity']}"
            ),
            allowed_refinements=(
                f"{label} Allowed refinements within the confirmed shot objective: "
                f"{core['shot_objective']}"
            ),
            escalation_conditions=(
                f"{label} Escalate to the VFX Supervisor if execution cannot honestly "
                "satisfy the confirmed Core Anchor above."
            ),
        )


def _get_generator() -> ExecutionAnchorDraftGenerator:
    provider = model_gateway.resolve_provider_name()
    if provider == "deterministic":
        return DeterministicExecutionAnchorDraftGenerator()
    raise AgentGenerationError(
        f"model_provider={provider!r} is not implemented; only 'deterministic' exists for "
        "this capability (see cg_agent_service module docstring)"
    )


async def _build_context_snapshot_payload(
    session: AsyncSession,
    *,
    task: Task,
    shot: Shot,
    project: Project,
    core_revision: CoreAnchorRevision,
) -> dict[str, Any]:
    """Compact JSON payload: only fields that already exist locally, only
    ftrack external ids where an ExternalEntityLink already records one
    -- matches ``core_agent_service._build_context_snapshot_payload``'s
    own convention exactly.
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

    core_anchor_payload: dict[str, Any] = {
        "id": str(core_revision.id),
        "revision_number": core_revision.revision_number,
        "shot_objective": core_revision.shot_objective,
        "emotional_tone": core_revision.emotional_tone,
        "visual_focus": core_revision.visual_focus,
        "rhythm_intensity": core_revision.rhythm_intensity,
        "character_relationship": core_revision.character_relationship,
        "narrative_priority": core_revision.narrative_priority,
        "core_summary": core_revision.core_summary,
    }

    return {
        "project": project_payload,
        "shot": shot_payload,
        "task": task_payload,
        "core_anchor": core_anchor_payload,
    }


async def generate_execution_anchor_draft(
    session: AsyncSession,
    task_id: uuid.UUID,
    *,
    generator: ExecutionAnchorDraftGenerator | None = None,
) -> ExecutionAnchorRevision:
    task = await session.get(Task, task_id)
    if task is None:
        raise NotFoundError("Task not found")

    core_anchor = await session.scalar(select(CoreAnchor).where(CoreAnchor.shot_id == task.shot_id))
    if core_anchor is None or core_anchor.active_revision_id is None:
        raise ConflictError(
            "No confirmed CoreAnchorRevision exists for this Task's Shot; an Execution "
            "Anchor draft cannot be generated until the Primary Anchor is confirmed"
        )
    core_revision = await session.get(CoreAnchorRevision, core_anchor.active_revision_id)
    if core_revision is None or core_revision.status != "confirmed":
        raise InternalConsistencyError(
            "CoreAnchor.active_revision_id does not reference a confirmed revision"
        )

    existing_revisions = await execution_anchor_service.list_revisions_for_task(session, task_id)
    if any(revision.status == "draft" for revision in existing_revisions):
        raise ConflictError(
            "An editable Execution Anchor draft already exists for this Task; confirm, "
            "reject, or edit it before generating a new one"
        )

    shot = await session.get(Shot, task.shot_id)
    if shot is None:
        raise InternalConsistencyError(f"Task {task_id} references missing Shot {task.shot_id}")
    project = await session.get(Project, shot.project_id)
    if project is None:
        raise InternalConsistencyError(
            f"Shot {shot.id} references missing Project {shot.project_id}"
        )

    # Everything above is pre-flight validation -- nothing durable is
    # created yet. A ContextSnapshot/AgentRun is only ever created once
    # we're actually about to start the agent (inside execute_agent).
    # The real Core Anchor confirmed-ness is re-verified atomically
    # inside create_draft_revision itself (its own CAS check), so a race
    # between this pre-flight read and the actual draft creation can
    # never produce a draft against a stale Core reference.
    payload = await _build_context_snapshot_payload(
        session, task=task, shot=shot, project=project, core_revision=core_revision
    )

    async def _persist(
        session: AsyncSession,
        snapshot: ContextSnapshot,
        run: AgentRun,
        content: ExecutionAnchorRevisionDraftCreate,
    ) -> ExecutionAnchorRevision:
        agent_actor = build_agent_actor(_AGENT_TYPE_CG_SUPERVISOR_AGENT, agent_run_id=run.id)
        revision = await execution_anchor_service.create_draft_revision(
            session, agent_actor, task_id, content.model_dump()
        )
        run.result_revision_id = revision.id
        return revision

    spec = AgentExecutionSpec(
        shot_id=shot.id,
        agent_type=_AGENT_TYPE_CG_SUPERVISOR_AGENT,
        capability=_CAPABILITY_EXECUTION_ANCHOR_DRAFTING,
        provider=model_gateway.resolve_provider_name(),
        snapshot_payload=payload,
        resolve_generator=lambda: generator if generator is not None else _get_generator(),
        persist_result=_persist,
        failure_label="CG Agent execution anchor draft generation",
    )
    return await execute_agent(session, spec)
