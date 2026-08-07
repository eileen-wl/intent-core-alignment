"""Deterministic Package C journey snapshots on the canonical D1 Shot 010.

These developer-only operations deliberately reuse the normal D1 Project and
Shot identities.  They never create a second product channel and only replace
records proven to belong to the three canonical D1 Journey Tasks.
"""

# ruff: noqa: E501

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass, replace
from datetime import UTC, datetime
from typing import Any, Final

from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.agents import (
    artist_guidance_service,
    cg_supervisor_review_service,
    vfx_supervisor_review_service,
)
from intent_core_api.agents.artist_guidance_service import DeterministicArtistGuidanceGenerator
from intent_core_api.agents.cg_supervisor_review_service import (
    DeterministicCGSupervisorReviewGenerator,
)
from intent_core_api.agents.cross_role_assessment_service import generate_cross_role_assessment
from intent_core_api.agents.models import AgentRun, ContextSnapshot
from intent_core_api.agents.vfx_supervisor_review_service import (
    DeterministicVFXSupervisorReviewGenerator,
)
from intent_core_api.cross_department import service as dependency_service
from intent_core_api.cross_department.models import TaskDependency
from intent_core_api.demo_seed.d1_scenario import (
    D1_MARKER,
    D1_PROJECT_EXTERNAL_ID,
    D1_SHOT_EXTERNAL_ID,
    D1_TASK_EXTERNAL_ID,
    DeterministicD1CrossRoleAssessmentGenerator,
    ensure_d1_scenario,
)
from intent_core_api.integrations.external_link_service import (
    find_linked_entity_id,
    record_external_link,
)
from intent_core_api.integrations.models import ExternalEntityLink
from intent_core_api.intent import core_anchor_service, execution_anchor_service
from intent_core_api.intent.models import (
    AnchorReference,
    CGSupervisorReview,
    Constraint,
    ContextReconstruction,
    CoreAnchor,
    CoreAnchorRevision,
    DriftRisk,
    ExecutionAnchor,
    ExecutionAnchorRevision,
    HumanGate,
    IntentBrief,
    IntentDecomposition,
    OpenQuestion,
    VariationZone,
)
from intent_core_api.production_context.models import Project, Shot, Task
from intent_core_api.versions_and_feedback import service as version_service
from intent_core_api.versions_and_feedback.models import (
    AlignmentAssessment,
    ArtistAgentGuidance,
    CrossRoleAssessment,
    IntentSignal,
    ReAnchorProposal,
    ReviewNote,
    Version,
    VFXSupervisorReview,
)
from intent_core_api.workflow.actors import ActorContext
from intent_core_api.workflow.models import Decision, WorkflowTransition

D1_JOURNEY_MARKER: Final = "[ICAS Demo — D1 Journey]"
ANIMATION_TASK_EXTERNAL_ID: Final = "icas-demo:d1:shot-010:animation-pass"
LIGHTING_TASK_EXTERNAL_ID: Final = "icas-demo:d1:shot-010:lighting-pass"
CANONICAL_TASK_EXTERNAL_IDS: Final = {
    "animation": ANIMATION_TASK_EXTERNAL_ID,
    "lighting": LIGHTING_TASK_EXTERNAL_ID,
    "comp": D1_TASK_EXTERNAL_ID,
}
_TASK_NAMES: Final = {
    "animation": "Animation Pass",
    "lighting": "Lighting Pass",
    "comp": "Compositing Review",
}
_SEED_VFX = ActorContext(actor_kind="human", actor_id="d1-journey-vfx", human_role="vfx_supervisor")
_SEED_CG = ActorContext(actor_kind="human", actor_id="d1-journey-cg", human_role="cg_supervisor")
_SEED_ARTIST = ActorContext(actor_kind="human", actor_id="d1-journey-artist", human_role="artist")


@dataclass(frozen=True)
class D1JourneyResult:
    snapshot: str
    project_id: uuid.UUID
    shot_id: uuid.UUID
    task_ids: tuple[uuid.UUID, ...]
    version_ids: tuple[uuid.UUID, ...]
    counts: dict[str, int]
    completed_at: datetime


@asynccontextmanager
async def _atomic_snapshot(session: AsyncSession) -> AsyncIterator[None]:
    """Turn service-local commits into flushes until the snapshot is complete."""

    original_commit = session.commit

    async def flush() -> None:
        await session.flush()

    session.commit = flush  # type: ignore[method-assign]
    try:
        yield
        session.commit = original_commit  # type: ignore[method-assign]
        await original_commit()
    except Exception:
        session.commit = original_commit  # type: ignore[method-assign]
        await session.rollback()
        raise


def _core_content(revision: str) -> dict[str, Any]:
    summary = (
        "Restrained threat remains still and oppressive while combined department intensity stays capped."
        if revision == "R2"
        else "The final confrontation should feel controlled, oppressive and inevitable."
    )
    risk = (
        "Animation acceleration, warm rim, bloom, particles, and debris must not combine into heroic spectacle."
        if revision == "R2"
        else "Threat must read through restraint, weight, and silhouette hierarchy rather than heroic spectacle."
    )
    return {
        "shot_objective": "Stage a final confrontation whose threat is controlled, oppressive, and inevitable.",
        "emotional_tone": "Controlled, oppressive, inevitable threat.",
        "visual_focus": "Weight and silhouette hierarchy over spectacle.",
        "rhythm_intensity": "Controlled pauses; no release into heroic acceleration.",
        "character_relationship": "The confrontation feels inevitable before it becomes explosive.",
        "narrative_priority": "Preserve controlled threat while allowing each department to improve local readability.",
        "core_summary": summary,
        "constraints": [{"content": risk}],
        "variation_zones": [
            {"content": "Readability may improve only inside the controlled-threat boundary."}
        ],
        "drift_risks": [{"description": risk}],
        "references": [],
        "open_questions": [
            {
                "question": "Where does local readability begin to turn controlled threat into spectacle?"
            }
        ],
    }


def _execution_content(department: str, revision: str) -> dict[str, str]:
    local = {
        "animation": "Faster lunge, clearer impact timing, and a stronger final pose remain subordinate to controlled pauses and silhouette weight.",
        "lighting": "A stronger warm rim, contrast, and facial or weapon readability remain restrained.",
        "comp": "Bloom, particles, debris, saturation, and impact emphasis remain restrained so polish does not become spectacle.",
    }[department]
    return {
        "technical_boundaries": f"{'Preserve the combined-intensity ceiling.' if revision == 'R2' else 'Translate controlled, oppressive, inevitable threat without heroic spectacle.'} {local}",
        "parameter_ranges": "Combined motion acceleration, warm rim, bloom, particles, and debris remain capped by the confirmed Core Anchor.",
        "delivery_conditions": "Deliver a readable confrontation whose threat remains controlled and oppressive.",
        "production_ready_criteria": "Local readability improves without turning the scene triumphant.",
        "downstream_dependencies": "Compositing integration preserves the combined-intensity ceiling across all three departments.",
        "publish_requirements": "Human CG Supervisor confirmation is required before publish.",
        "allowed_refinements": local,
        "escalation_conditions": "Escalate to Human VFX Supervisor when local improvement changes the shared emotional read.",
    }


async def _canonical_root(session: AsyncSession) -> tuple[Project, Shot]:
    seed = await ensure_d1_scenario(session)
    project = await session.get(Project, seed.project_id)
    shot = await session.get(Shot, seed.shot_id)
    if project is None or shot is None or project.source == "ftrack" or shot.source == "ftrack":
        raise RuntimeError("D1 Journey root is missing or protected")
    return project, shot


async def _resolve_task(session: AsyncSession, shot: Shot, department: str) -> Task:
    external_id = CANONICAL_TASK_EXTERNAL_IDS[department]
    entity_id = await find_linked_entity_id(
        session, entity_type="task", source="demo", external_id=external_id
    )
    if entity_id is not None:
        task = await session.get(Task, entity_id)
        if task is None or task.shot_id != shot.id or task.source == "ftrack":
            raise RuntimeError("D1 Journey task identity is inconsistent or protected")
        return task
    task = Task(
        shot_id=shot.id, name=_TASK_NAMES[department], department=department, source="manual"
    )
    session.add(task)
    await session.flush()
    await record_external_link(
        session, entity_type="task", entity_id=task.id, source="demo", external_id=external_id
    )
    await session.commit()
    return task


async def _canonical_tasks(session: AsyncSession, shot: Shot) -> list[Task]:
    return [
        await _resolve_task(session, shot, department)
        for department in ("animation", "lighting", "comp")
    ]


async def _assert_no_ftrack_links(session: AsyncSession, ids: list[uuid.UUID]) -> None:
    protected = await session.scalar(
        select(ExternalEntityLink.id).where(
            ExternalEntityLink.entity_id.in_(ids), ExternalEntityLink.source == "ftrack"
        )
    )
    if protected is not None:
        raise RuntimeError(
            "D1 Journey operation refused: ftrack-linked record exists in canonical subtree"
        )


async def _delete_journey_records(
    session: AsyncSession, project: Project, shot: Shot, tasks: list[Task]
) -> None:
    task_ids = [task.id for task in tasks]
    await _assert_no_ftrack_links(session, [project.id, shot.id, *task_ids])
    core = await session.scalar(select(CoreAnchor).where(CoreAnchor.shot_id == shot.id))
    core_ids = (
        []
        if core is None
        else [
            row.id
            for row in (
                await session.scalars(
                    select(CoreAnchorRevision).where(CoreAnchorRevision.core_anchor_id == core.id)
                )
            ).all()
        ]
    )
    execution_anchors = list(
        (
            await session.scalars(
                select(ExecutionAnchor).where(ExecutionAnchor.task_id.in_(task_ids))
            )
        ).all()
    )
    execution_ids = (
        [
            row.id
            for row in (
                await session.scalars(
                    select(ExecutionAnchorRevision).where(
                        ExecutionAnchorRevision.execution_anchor_id.in_(
                            [anchor.id for anchor in execution_anchors]
                        )
                    )
                )
            ).all()
        ]
        if execution_anchors
        else []
    )
    versions = list(
        (
            await session.scalars(
                select(Version).where(
                    Version.shot_id == shot.id,
                    or_(
                        Version.task_id.in_(task_ids),
                        Version.description.like(f"{D1_MARKER}%"),
                        Version.description.like(f"{D1_JOURNEY_MARKER}%"),
                    ),
                )
            )
        ).all()
    )
    version_ids = [version.id for version in versions]
    assessments = (
        list(
            (
                await session.scalars(
                    select(CrossRoleAssessment).where(
                        or_(
                            CrossRoleAssessment.version_id.in_(version_ids),
                            CrossRoleAssessment.task_id.in_(task_ids),
                        )
                    )
                )
            ).all()
        )
        if version_ids
        else []
    )
    assessment_ids = [row.id for row in assessments]
    entity_ids = [*core_ids, *execution_ids]
    decision_ids = [
        row
        for row in (
            await session.scalars(select(Decision.id).where(Decision.entity_id.in_(entity_ids)))
        ).all()
    ]
    vfx = (
        list(
            (
                await session.scalars(
                    select(VFXSupervisorReview).where(
                        VFXSupervisorReview.version_id.in_(version_ids)
                    )
                )
            ).all()
        )
        if version_ids
        else []
    )
    cg = (
        list(
            (
                await session.scalars(
                    select(CGSupervisorReview).where(
                        CGSupervisorReview.execution_anchor_revision_id.in_(execution_ids)
                    )
                )
            ).all()
        )
        if execution_ids
        else []
    )
    guidance = list(
        (
            await session.scalars(
                select(ArtistAgentGuidance).where(ArtistAgentGuidance.task_id.in_(task_ids))
            )
        ).all()
    )
    decompositions = list(
        (
            await session.scalars(
                select(IntentDecomposition).where(IntentDecomposition.shot_id == shot.id)
            )
        ).all()
    )
    reconstructions = list(
        (
            await session.scalars(
                select(ContextReconstruction).where(ContextReconstruction.shot_id == shot.id)
            )
        ).all()
    )
    alignment_assessments = list(
        (
            await session.scalars(
                select(AlignmentAssessment).where(
                    or_(
                        AlignmentAssessment.version_id.in_(version_ids),
                        AlignmentAssessment.core_anchor_revision_id.in_(core_ids),
                    )
                )
            )
        ).all()
    )
    run_ids = (
        [row.agent_run_id for row in vfx]
        + [row.agent_run_id for row in cg]
        + [row.agent_run_id for row in guidance]
        + [row.agent_run_id for row in assessments]
        + [row.agent_run_id for row in decompositions]
        + [row.agent_run_id for row in reconstructions]
        + [row.agent_run_id for row in alignment_assessments]
    )
    context_ids = (
        [row.context_snapshot_id for row in vfx]
        + [row.context_snapshot_id for row in cg]
        + [row.context_snapshot_id for row in guidance]
        + [row.context_snapshot_id for row in assessments]
        + [row.context_snapshot_id for row in decompositions]
        + [row.context_snapshot_id for row in reconstructions]
        + [row.context_snapshot_id for row in alignment_assessments]
    )
    context_ids.extend(
        row
        for row in (
            await session.scalars(
                select(CoreAnchorRevision.context_snapshot_id).where(
                    CoreAnchorRevision.id.in_(core_ids),
                    CoreAnchorRevision.context_snapshot_id.is_not(None),
                )
            )
        ).all()
        if row is not None
    )
    await session.execute(
        delete(ReAnchorProposal).where(
            ReAnchorProposal.cross_role_assessment_id.in_(assessment_ids)
        )
    )
    await session.execute(
        delete(IntentSignal).where(IntentSignal.cross_role_assessment_id.in_(assessment_ids))
    )
    await session.execute(
        delete(CrossRoleAssessment).where(CrossRoleAssessment.id.in_(assessment_ids))
    )
    await session.execute(
        delete(AlignmentAssessment).where(
            AlignmentAssessment.id.in_([row.id for row in alignment_assessments])
        )
    )
    await session.execute(delete(TaskDependency).where(TaskDependency.task_id.in_(task_ids)))
    await session.execute(delete(ReviewNote).where(ReviewNote.version_id.in_(version_ids)))
    await session.execute(
        delete(VFXSupervisorReview).where(VFXSupervisorReview.id.in_([row.id for row in vfx]))
    )
    await session.execute(
        delete(CGSupervisorReview).where(CGSupervisorReview.id.in_([row.id for row in cg]))
    )
    await session.execute(
        delete(ArtistAgentGuidance).where(ArtistAgentGuidance.id.in_([row.id for row in guidance]))
    )
    await session.execute(
        delete(WorkflowTransition).where(WorkflowTransition.entity_id.in_(entity_ids))
    )
    await session.execute(
        delete(HumanGate).where(
            or_(
                HumanGate.core_anchor_revision_id.in_(core_ids),
                HumanGate.execution_anchor_revision_id.in_(execution_ids),
            )
        )
    )
    await session.execute(
        update(Decision)
        .where(Decision.supersedes_decision_id.in_(decision_ids))
        .values(supersedes_decision_id=None)
    )
    await session.execute(delete(Decision).where(Decision.entity_id.in_(entity_ids)))
    await session.execute(
        update(ExecutionAnchor)
        .where(ExecutionAnchor.id.in_([anchor.id for anchor in execution_anchors]))
        .values(active_revision_id=None)
    )
    if core is not None:
        await session.execute(
            update(CoreAnchor).where(CoreAnchor.id == core.id).values(active_revision_id=None)
        )
    await session.flush()
    await session.execute(
        delete(Constraint).where(Constraint.core_anchor_revision_id.in_(core_ids))
    )
    await session.execute(
        delete(VariationZone).where(VariationZone.core_anchor_revision_id.in_(core_ids))
    )
    await session.execute(delete(DriftRisk).where(DriftRisk.core_anchor_revision_id.in_(core_ids)))
    await session.execute(
        delete(AnchorReference).where(AnchorReference.core_anchor_revision_id.in_(core_ids))
    )
    await session.execute(
        delete(OpenQuestion).where(OpenQuestion.core_anchor_revision_id.in_(core_ids))
    )
    await session.execute(
        delete(ExecutionAnchorRevision).where(ExecutionAnchorRevision.id.in_(execution_ids))
    )
    await session.execute(delete(CoreAnchorRevision).where(CoreAnchorRevision.id.in_(core_ids)))
    await session.execute(
        delete(ExecutionAnchor).where(
            ExecutionAnchor.id.in_([anchor.id for anchor in execution_anchors])
        )
    )
    if core is not None:
        await session.execute(delete(CoreAnchor).where(CoreAnchor.id == core.id))
    await session.execute(
        delete(IntentDecomposition).where(
            IntentDecomposition.id.in_([row.id for row in decompositions])
        )
    )
    await session.execute(
        delete(ContextReconstruction).where(
            ContextReconstruction.id.in_([row.id for row in reconstructions])
        )
    )
    await session.execute(delete(AgentRun).where(AgentRun.id.in_(run_ids)))
    await session.execute(delete(ContextSnapshot).where(ContextSnapshot.id.in_(context_ids)))
    await session.execute(delete(Version).where(Version.id.in_(version_ids)))
    await session.execute(
        delete(IntentBrief).where(
            IntentBrief.shot_id == shot.id, IntentBrief.raw_text.like(f"{D1_MARKER}%")
        )
    )
    await session.commit()


async def _anchors(
    session: AsyncSession, shot: Shot, tasks: list[Task], revision: str
) -> list[ExecutionAnchorRevision]:
    core = await core_anchor_service.create_draft_revision(
        session, _SEED_VFX, shot.id, _core_content(revision)
    )
    await core_anchor_service.confirm_revision(
        session,
        _SEED_VFX,
        core.id,
        f"{D1_JOURNEY_MARKER} Human VFX confirmed Core Anchor {revision}.",
    )
    results = []
    for task in tasks:
        draft = await execution_anchor_service.create_draft_revision(
            session, _SEED_CG, task.id, _execution_content(task.department or "comp", revision)
        )
        results.append(
            await execution_anchor_service.confirm_revision(
                session,
                _SEED_CG,
                draft.id,
                f"{D1_JOURNEY_MARKER} Human CG confirmed {task.department} Execution Anchor {revision}.",
            )
        )
    return results


async def _version(
    session: AsyncSession, shot: Shot, task: Task, name: str, number: int, description: str
) -> Version:
    result = await version_service.create_version(
        session, _SEED_VFX, shot.id, name=name, version_number=number, description=description
    )
    result.task_id = task.id
    await session.commit()
    return result


async def _evidence(
    session: AsyncSession,
    shot: Shot,
    tasks: list[Task],
    versions: list[Version],
    execution: list[ExecutionAnchorRevision],
) -> None:
    session.add(
        IntentBrief(
            shot_id=shot.id,
            raw_text=f"{D1_JOURNEY_MARKER} The final confrontation must remain controlled, oppressive and inevitable.",
            source="manual",
            created_by_actor_kind="human",
            created_by_actor_id=_SEED_VFX.actor_id,
            created_by_human_role="vfx_supervisor",
        )
    )
    for version in versions:
        session.add(
            ReviewNote(
                version_id=version.id,
                content=f"{D1_JOURNEY_MARKER} Local readability is defensible, but integration must preserve controlled threat.",
                source="manual",
                created_by_actor_kind="human",
                created_by_actor_id=_SEED_VFX.actor_id,
                created_by_human_role="vfx_supervisor",
            )
        )
    await session.commit()
    await vfx_supervisor_review_service.generate_vfx_supervisor_review(
        session, _SEED_VFX, versions[2].id, generator=DeterministicVFXSupervisorReviewGenerator()
    )
    for revision in execution:
        await cg_supervisor_review_service.generate_cg_supervisor_review(
            session, _SEED_CG, revision.id, generator=DeterministicCGSupervisorReviewGenerator()
        )
    for task, version in zip(tasks, versions, strict=True):
        await artist_guidance_service.generate_artist_agent_guidance(
            session,
            _SEED_ARTIST,
            version.id,
            task.id,
            generator=DeterministicArtistGuidanceGenerator(),
        )
    for _task, label in zip(tasks[:2], ("Animation", "Lighting"), strict=True):
        await dependency_service.create_dependency(
            session,
            _SEED_CG,
            tasks[2].id,
            kind="dependency",
            description=f"{D1_JOURNEY_MARKER} Compositing integration depends on {label} preserving the shared intensity ceiling.",
            severity="high",
            related_version_id=versions[2].id,
        )


async def _result(
    session: AsyncSession,
    snapshot: str,
    project: Project,
    shot: Shot,
    tasks: list[Task],
    versions: list[Version],
) -> D1JourneyResult:
    task_ids, version_ids = [task.id for task in tasks], [version.id for version in versions]
    counts = {
        "projects": 1,
        "shots": 1,
        "tasks": len(tasks),
        "versions": len(versions),
        "core_anchor_revisions": int(
            await session.scalar(
                select(func.count())
                .select_from(CoreAnchorRevision)
                .where(
                    CoreAnchorRevision.core_anchor_id.in_(
                        select(CoreAnchor.id).where(CoreAnchor.shot_id == shot.id)
                    )
                )
            )
        ),
        "execution_anchor_revisions": int(
            await session.scalar(
                select(func.count())
                .select_from(ExecutionAnchorRevision)
                .where(
                    ExecutionAnchorRevision.execution_anchor_id.in_(
                        select(ExecutionAnchor.id).where(ExecutionAnchor.task_id.in_(task_ids))
                    )
                )
            )
        ),
        "assessments": int(
            await session.scalar(
                select(func.count())
                .select_from(CrossRoleAssessment)
                .where(CrossRoleAssessment.version_id.in_(version_ids))
            )
        ),
        "dependencies": int(
            await session.scalar(
                select(func.count())
                .select_from(TaskDependency)
                .where(TaskDependency.task_id == tasks[2].id)
            )
        ),
    }
    return D1JourneyResult(
        snapshot=snapshot,
        project_id=project.id,
        shot_id=shot.id,
        task_ids=tuple(task_ids),
        version_ids=tuple(version_ids),
        counts=counts,
        completed_at=datetime.now(UTC),
    )


async def _build_reset_d1_journey(session: AsyncSession) -> D1JourneyResult:
    project, shot = await _canonical_root(session)
    tasks = await _canonical_tasks(session, shot)
    await _delete_journey_records(session, project, shot, tasks)
    execution = await _anchors(session, shot, tasks, "R1")
    versions = [
        await _version(
            session,
            shot,
            task,
            f"{name} Conflict V1",
            1,
            f"{D1_JOURNEY_MARKER} {name} local-optimum conflict version.",
        )
        for name, task in zip(("Animation", "Lighting", "Compositing"), tasks, strict=True)
    ]
    await _evidence(session, shot, tasks, versions, execution)
    return await _result(session, "reset", project, shot, tasks, versions)


async def reset_d1_journey(session: AsyncSession) -> D1JourneyResult:
    async with _atomic_snapshot(session):
        return await _build_reset_d1_journey(session)


async def load_completed_d1_journey(session: AsyncSession) -> D1JourneyResult:
    async with _atomic_snapshot(session):
        reset = await _build_reset_d1_journey(session)
        project = await session.get(Project, reset.project_id)
        shot = await session.get(Shot, reset.shot_id)
        tasks = [await session.get(Task, task_id) for task_id in reset.task_ids]
        if project is None or shot is None or any(task is None for task in tasks):
            raise RuntimeError("D1 Journey reset did not produce its canonical records")
        resolved_tasks: list[Task] = [task for task in tasks if task is not None]
        conflict_versions = list(
            (
                await session.scalars(
                    select(Version)
                    .where(
                        Version.shot_id == shot.id,
                        Version.description.like(f"{D1_JOURNEY_MARKER}%"),
                    )
                    .order_by(Version.created_at)
                )
            ).all()
        )
        await generate_cross_role_assessment(
            session,
            _SEED_VFX,
            conflict_versions[2].id,
            resolved_tasks[2].id,
            generator=DeterministicD1CrossRoleAssessmentGenerator(),
        )
        core = await core_anchor_service.create_draft_revision(
            session, _SEED_VFX, shot.id, _core_content("R2")
        )
        await core_anchor_service.confirm_revision(
            session, _SEED_VFX, core.id, f"{D1_JOURNEY_MARKER} Human VFX confirmed Core Anchor R2."
        )
        execution = []
        for task in resolved_tasks:
            draft = await execution_anchor_service.create_draft_revision(
                session, _SEED_CG, task.id, _execution_content(task.department or "comp", "R2")
            )
            execution.append(
                await execution_anchor_service.confirm_revision(
                    session,
                    _SEED_CG,
                    draft.id,
                    f"{D1_JOURNEY_MARKER} Human CG confirmed {task.department} Execution Anchor R2.",
                )
            )
        resolved = [
            await _version(
                session,
                shot,
                task,
                f"{name} Resolved V2",
                2,
                f"{D1_JOURNEY_MARKER} {name} resolved version applying Core Anchor R2 combined-intensity constraints.",
            )
            for name, task in zip(
                ("Animation", "Lighting", "Compositing"), resolved_tasks, strict=True
            )
        ]
        await _evidence(session, shot, resolved_tasks, resolved, execution)
        await generate_cross_role_assessment(
            session,
            _SEED_VFX,
            resolved[2].id,
            resolved_tasks[2].id,
            generator=DeterministicD1CrossRoleAssessmentGenerator(),
        )
        return await _result(
            session, "completed", project, shot, resolved_tasks, [*conflict_versions, *resolved]
        )


async def inspect_d1_journey(session: AsyncSession) -> D1JourneyResult | None:
    project_id = await find_linked_entity_id(
        session, entity_type="project", source="demo", external_id=D1_PROJECT_EXTERNAL_ID
    )
    shot_id = await find_linked_entity_id(
        session, entity_type="shot", source="demo", external_id=D1_SHOT_EXTERNAL_ID
    )
    if project_id is None or shot_id is None:
        return None
    project, shot = await session.get(Project, project_id), await session.get(Shot, shot_id)
    if project is None or shot is None:
        return None
    task_ids = [
        await find_linked_entity_id(
            session, entity_type="task", source="demo", external_id=external_id
        )
        for external_id in CANONICAL_TASK_EXTERNAL_IDS.values()
    ]
    if any(task_id is None for task_id in task_ids):
        return None
    tasks = [await session.get(Task, task_id) for task_id in task_ids]
    if any(task is None or task.shot_id != shot.id for task in tasks):
        return None
    resolved_tasks: list[Task] = [task for task in tasks if task is not None]
    versions = list(
        (
            await session.scalars(
                select(Version)
                .where(
                    Version.shot_id == shot.id, Version.description.like(f"{D1_JOURNEY_MARKER}%")
                )
                .order_by(Version.created_at)
            )
        ).all()
    )
    result = await _result(session, "mixed", project, shot, resolved_tasks, versions)
    task_ids = [task.id for task in resolved_tasks]
    assessment_ids = [
        row.id
        for row in (
            await session.scalars(
                select(CrossRoleAssessment).where(CrossRoleAssessment.task_id.in_(task_ids))
            )
        ).all()
    ]
    proposal_count = int(
        await session.scalar(
            select(func.count())
            .select_from(ReAnchorProposal)
            .where(ReAnchorProposal.cross_role_assessment_id.in_(assessment_ids))
        )
    )
    vfx_review_count = int(
        await session.scalar(
            select(func.count())
            .select_from(VFXSupervisorReview)
            .where(VFXSupervisorReview.version_id.in_([version.id for version in versions]))
        )
    )
    execution_ids = select(ExecutionAnchorRevision.id).where(
        ExecutionAnchorRevision.execution_anchor_id.in_(
            select(ExecutionAnchor.id).where(ExecutionAnchor.task_id.in_(task_ids))
        )
    )
    cg_review_count = int(
        await session.scalar(
            select(func.count())
            .select_from(CGSupervisorReview)
            .where(CGSupervisorReview.execution_anchor_revision_id.in_(execution_ids))
        )
    )
    guidance_count = int(
        await session.scalar(
            select(func.count())
            .select_from(ArtistAgentGuidance)
            .where(ArtistAgentGuidance.task_id.in_(task_ids))
        )
    )
    core_draft_count = int(
        await session.scalar(
            select(func.count())
            .select_from(CoreAnchorRevision)
            .where(
                CoreAnchorRevision.core_anchor_id.in_(
                    select(CoreAnchor.id).where(CoreAnchor.shot_id == shot.id)
                ),
                CoreAnchorRevision.status == "draft",
            )
        )
    )
    execution_draft_count = int(
        await session.scalar(
            select(func.count())
            .select_from(ExecutionAnchorRevision)
            .where(
                ExecutionAnchorRevision.id.in_(execution_ids),
                ExecutionAnchorRevision.status == "draft",
            )
        )
    )
    counts = {
        **result.counts,
        "proposals": proposal_count,
        "vfx_reviews": vfx_review_count,
        "cg_reviews": cg_review_count,
        "guidance": guidance_count,
        "core_drafts": core_draft_count,
        "execution_drafts": execution_draft_count,
        "canonical_tasks_present": len(resolved_tasks),
    }
    reset = (
        counts["tasks"] == 3
        and counts["versions"] == 3
        and counts["core_anchor_revisions"] == 1
        and counts["execution_anchor_revisions"] == 3
        and counts["assessments"] == 0
        and counts["proposals"] == 0
        and counts["dependencies"] == 2
        and counts["vfx_reviews"] == 1
        and counts["cg_reviews"] == 3
        and counts["guidance"] == 3
        and counts["core_drafts"] == 0
        and counts["execution_drafts"] == 0
    )
    completed = (
        counts["tasks"] == 3
        and counts["versions"] == 6
        and counts["core_anchor_revisions"] == 2
        and counts["execution_anchor_revisions"] == 6
        and counts["assessments"] == 2
        and counts["proposals"] >= 1
        and counts["dependencies"] == 4
        and counts["vfx_reviews"] == 2
        and counts["cg_reviews"] == 6
        and counts["guidance"] == 6
        and counts["core_drafts"] == 0
        and counts["execution_drafts"] == 0
    )
    return replace(
        result, snapshot="reset" if reset else "completed" if completed else "mixed", counts=counts
    )
