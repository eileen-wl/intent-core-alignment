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
real model-backed generator implements. Both ``"deterministic"``
(``DeterministicExecutionAnchorDraftGenerator``, offline, dev/test/demo
default) and ``"deepseek"`` (``DeepSeekExecutionAnchorDraftGenerator``,
via the shared ``agents.model_gateway`` -- see ADR-0013, same integration
path as every other capability's real-provider adapter) are wired in
``_get_generator()``. The prompt and output contract are registered as
``"execution_anchor_drafting"`` in ``agents.prompt_registry``.
"""

from __future__ import annotations

import json
import uuid
from typing import Any, Final, Protocol

from intent_core_contracts.api.execution_anchor import ExecutionAnchorRevisionDraftCreate
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.agents import model_gateway, prompt_registry
from intent_core_api.agents.models import AgentRun, ContextSnapshot
from intent_core_api.agents.runtime import AgentExecutionSpec, execute_agent
from intent_core_api.cross_department import service as cross_department_service
from intent_core_api.cross_department.models import TaskDependency
from intent_core_api.integrations import external_link_service
from intent_core_api.intent import execution_anchor_service
from intent_core_api.intent.models import CoreAnchor, CoreAnchorRevision, ExecutionAnchorRevision
from intent_core_api.production_context.models import Project, Shot, Task
from intent_core_api.versions_and_feedback.models import Version
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
    """Offline, deterministic dev/test/demo adapter: no network call, no
    API key, same output for the same input every time. Does not attempt
    real language understanding or invent operational judgement the
    system doesn't have -- each of the 8 fields is a clearly-labeled
    derivation of the confirmed Core Anchor's own real content, honest
    about being a placeholder that needs human review rather than a
    real analysis (same convention as
    ``core_agent_service.DeterministicCoreAnchorDraftGenerator``). Used
    whenever ``MODEL_PROVIDER`` is unset/``"deterministic"`` -- never
    silently substituted for ``"deepseek"``.
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


class DeepSeekExecutionAnchorDraftGenerator:
    """Same DeepSeek integration path as every other capability's
    real-provider adapter (official ``openai`` package pointed at
    DeepSeek's OpenAI-compatible endpoint, via the shared
    ``agents.model_gateway`` -- see ADR-0013) -- one non-streaming
    JSON-mode call, validated against ``ExecutionAnchorRevisionDraftCreate``
    explicitly (the same contract the manual/blank draft-creation path
    already validates against, so a model-generated draft can never carry
    an unsupported field). Model name comes from ``Settings.model_name``
    (never hardcoded). A malformed or empty response, or any
    provider/network failure, raises ``AgentGenerationError`` from
    ``model_gateway.generate_deepseek`` -- there is no fallback to the
    deterministic generator here; a failed DeepSeek call fails the
    AgentRun honestly.
    """

    def __init__(self, *, api_key: str, model_name: str) -> None:
        self._api_key = api_key
        self._model_name = model_name

    def generate(self, *, snapshot_payload: dict[str, Any]) -> ExecutionAnchorRevisionDraftCreate:
        registration = prompt_registry.get_registration(_CAPABILITY_EXECUTION_ANCHOR_DRAFTING)
        return model_gateway.generate_deepseek(
            api_key=self._api_key,
            model_name=self._model_name,
            system_prompt=registration.system_prompt,
            user_content=(
                "Draft an Execution Anchor for this Task, translating the confirmed Core "
                "Anchor into operational terms. Respond with the JSON object described in "
                "the system prompt. Context (JSON):\n" + json.dumps(snapshot_payload, indent=2)
            ),
            output_model=ExecutionAnchorRevisionDraftCreate,
            max_tokens=registration.max_output_tokens,
        )


def _get_generator() -> ExecutionAnchorDraftGenerator:
    provider = model_gateway.resolve_provider_name()
    if provider == "deterministic":
        return DeterministicExecutionAnchorDraftGenerator()
    if provider == "deepseek":
        api_key, model_name = model_gateway.require_deepseek_settings()
        return DeepSeekExecutionAnchorDraftGenerator(api_key=api_key, model_name=model_name)
    raise AgentGenerationError(
        f"model_provider={provider!r} is not implemented; only 'deterministic' and "
        "'deepseek' exist for this capability (see cg_agent_service module docstring)"
    )


async def _relevant_version_for_shot(session: AsyncSession, shot_id: uuid.UUID) -> Version | None:
    """The newest Production Version for the Task's Shot, or ``None`` if
    none exists yet -- the same "a Task's associated Versions are its
    Shot's Versions" convention already established by
    ``execution_anchor_service``'s own context-snapshot assembly and the
    CG Task Version Review page (no persisted Task<->Version link exists
    in the domain). Only the single newest Version is relevant context
    here (this capability drafts from the confirmed Core Anchor, not
    from Version-specific review history), mirroring
    ``cg_supervisor_review_service``'s own "one relevant Version, never
    every Version" convention.
    """
    result: Version | None = await session.scalar(
        select(Version).where(Version.shot_id == shot_id).order_by(Version.created_at.desc())
    )
    return result


async def _build_context_snapshot_payload(
    session: AsyncSession,
    *,
    task: Task,
    shot: Shot,
    project: Project,
    core_revision: CoreAnchorRevision,
    relevant_version: Version | None,
    dependencies: list[TaskDependency],
) -> dict[str, Any]:
    """Compact JSON payload: only fields that already exist locally, only
    ftrack external ids where an ExternalEntityLink already records one
    -- matches ``core_agent_service._build_context_snapshot_payload``'s
    own convention exactly. ``relevant_version``/``dependencies`` are
    included only when real rows exist -- never fabricated placeholders
    when a Task genuinely has no Version or dependency yet.
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

    payload: dict[str, Any] = {
        "project": project_payload,
        "shot": shot_payload,
        "task": task_payload,
        "core_anchor": core_anchor_payload,
    }

    if relevant_version is not None:
        payload["relevant_version"] = {
            "id": str(relevant_version.id),
            "name": relevant_version.name,
            "version_number": relevant_version.version_number,
            "description": relevant_version.description,
        }

    if dependencies:
        payload["existing_dependencies"] = [
            {
                "id": str(dependency.id),
                "kind": dependency.kind,
                "status": dependency.status,
                "description": dependency.description,
                "severity": dependency.severity,
            }
            for dependency in dependencies
        ]

    return payload


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

    relevant_version = await _relevant_version_for_shot(session, shot.id)
    dependencies = await cross_department_service.list_dependencies_for_task(session, task_id)

    # Everything above is pre-flight validation -- nothing durable is
    # created yet. A ContextSnapshot/AgentRun is only ever created once
    # we're actually about to start the agent (inside execute_agent).
    # The real Core Anchor confirmed-ness is re-verified atomically
    # inside create_draft_revision itself (its own CAS check), so a race
    # between this pre-flight read and the actual draft creation can
    # never produce a draft against a stale Core reference.
    payload = await _build_context_snapshot_payload(
        session,
        task=task,
        shot=shot,
        project=project,
        core_revision=core_revision,
        relevant_version=relevant_version,
        dependencies=dependencies,
    )

    resolved_generator = generator
    if resolved_generator is None:
        # Package C follow-up (downstream retranslation semantics): a
        # late-bound, function-local import -- `demo_seed.d1_scenario`
        # already imports this module at its own top level (for the
        # `ExecutionAnchorDraftGenerator` Protocol type), so a module-
        # level import here would be circular. Returns non-None only
        # for the exact canonical Package C D1 Journey Project/Shot/Task
        # identity -- deliberately regardless of the ambient configured
        # provider, exactly mirroring `cross_role_assessment_service.
        # generate_cross_role_assessment`'s own dispatch rule; every
        # other Task/Shot/Project keeps using whatever provider is
        # actually configured, completely unaffected. See that
        # function's own docstring for the full rule.
        from intent_core_api.demo_seed.d1_scenario import (
            resolve_canonical_d1_execution_generator,
        )

        resolved_generator = await resolve_canonical_d1_execution_generator(
            session, project_id=project.id, shot_id=shot.id, task_id=task.id
        )

    # Same late-bound, function-local import pattern as above (see that
    # comment for why a module-level import here would be circular).
    from intent_core_api.demo_seed.d1_scenario import (
        DeterministicD1ExecutionAnchorDraftGenerator,
        resolve_canonical_d1_core_constraints,
    )

    if isinstance(resolved_generator, DeterministicD1ExecutionAnchorDraftGenerator):
        # Package C follow-up: augments the exact same `payload` object
        # already used for generation, with the real confirmed Core
        # Anchor's own Constraint text -- so the D1 generator's per-
        # department translation genuinely cites the confirmed Core R2
        # constraint, never an invented one. Identity-gated a second
        # time inside `resolve_canonical_d1_core_constraints` itself,
        # so this never adds anything for a Shot this generator wasn't
        # already resolved for.
        constraints = await resolve_canonical_d1_core_constraints(
            session, project_id=project.id, shot_id=shot.id
        )
        if constraints:
            payload["core_anchor"]["constraints"] = constraints

    async def _persist(
        session: AsyncSession,
        snapshot: ContextSnapshot,
        run: AgentRun,
        content: ExecutionAnchorRevisionDraftCreate,
    ) -> ExecutionAnchorRevision:
        agent_actor = build_agent_actor(_AGENT_TYPE_CG_SUPERVISOR_AGENT, agent_run_id=run.id)
        # AgentRun.result_revision_id is narrowly FK'd to
        # core_anchor_revisions.id only (WP-B1.5's original, still-
        # unwidened scope -- see agents.models.AgentRun's own docstring)
        # -- it is never set here, matching every other non-Core-Anchor
        # capability's own established convention (cg_supervisor_review,
        # vfx_supervisor_review, artist_guidance, cross_role_assessment,
        # context_reconstruction, alignment_assessment, intent_decomposition
        # all leave it null too). Provenance is fully preserved the other
        # direction instead: create_draft_revision already stamps this
        # revision's own created_by_agent_run_id with run.id.
        return await execution_anchor_service.create_draft_revision(
            session, agent_actor, task_id, content.model_dump()
        )

    provider, model_name, prompt_version = prompt_registry.execution_metadata(
        _CAPABILITY_EXECUTION_ANCHOR_DRAFTING
    )
    spec = AgentExecutionSpec(
        shot_id=shot.id,
        agent_type=_AGENT_TYPE_CG_SUPERVISOR_AGENT,
        capability=_CAPABILITY_EXECUTION_ANCHOR_DRAFTING,
        provider=provider,
        model_name=model_name,
        prompt_version=prompt_version,
        snapshot_payload=payload,
        resolve_generator=lambda: (
            resolved_generator if resolved_generator is not None else _get_generator()
        ),
        persist_result=_persist,
        failure_label="CG Agent execution anchor draft generation",
    )
    return await execute_agent(session, spec)
