"""Isolated Package C Golden Demo snapshots.

The Golden dataset deliberately has a different ExternalEntityLink namespace
from the older D1 development fixture.  All destructive work is restricted to
that exact namespace and refuses to proceed when an ftrack link is found in
the selected subtree.
"""

# ruff: noqa: E501

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Final

from sqlalchemy import delete, func, select, update
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
from intent_core_api.agents.cross_role_assessment_service import (
    DeterministicCrossRoleAssessmentGenerator,
    generate_cross_role_assessment,
)
from intent_core_api.agents.models import AgentRun, ContextSnapshot
from intent_core_api.agents.vfx_supervisor_review_service import (
    DeterministicVFXSupervisorReviewGenerator,
)
from intent_core_api.cross_department import service as dependency_service
from intent_core_api.cross_department.models import TaskDependency
from intent_core_api.integrations.external_link_service import (
    find_linked_entity_id,
    record_external_link,
)
from intent_core_api.integrations.models import ExternalEntityLink
from intent_core_api.intent import core_anchor_service, execution_anchor_service
from intent_core_api.intent.models import (
    CGSupervisorReview,
    CoreAnchor,
    CoreAnchorRevision,
    ExecutionAnchor,
    ExecutionAnchorRevision,
    HumanGate,
    IntentBrief,
)
from intent_core_api.production_context.models import Project, Shot, Task
from intent_core_api.versions_and_feedback import service as version_service
from intent_core_api.versions_and_feedback.models import (
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

GOLDEN_SOURCE: Final = "demo"
GOLDEN_PROJECT_EXTERNAL_ID: Final = "icas-demo:golden"
GOLDEN_SHOT_EXTERNAL_ID: Final = "icas-demo:golden:shot-010"
GOLDEN_TASK_EXTERNAL_IDS: Final = {
    "animation": "icas-demo:golden:shot-010:animation",
    "lighting": "icas-demo:golden:shot-010:lighting",
    "comp": "icas-demo:golden:shot-010:compositing",
}
GOLDEN_MARKER: Final = "[ICAS Demo — Golden]"

_PROJECT_NAME = "ICAS Golden Demo Project"
_SHOT_NAME = "Shot 010 — Final confrontation"
_TASK_NAMES = {
    "animation": "Animation Pass",
    "lighting": "Lighting Pass",
    "comp": "Compositing Review",
}
_SEED_VFX = ActorContext(
    actor_kind="human", actor_id="golden-demo-vfx", human_role="vfx_supervisor"
)
_SEED_CG = ActorContext(actor_kind="human", actor_id="golden-demo-cg", human_role="cg_supervisor")
_SEED_ARTIST = ActorContext(actor_kind="human", actor_id="golden-demo-artist", human_role="artist")


@dataclass(frozen=True)
class GoldenScenarioResult:
    snapshot: str
    project_id: uuid.UUID
    shot_id: uuid.UUID
    task_ids: tuple[uuid.UUID, ...]
    version_ids: tuple[uuid.UUID, ...]
    counts: dict[str, int]
    completed_at: datetime


def _now() -> datetime:
    return datetime.now(UTC)


def _core_content(*, revision: str) -> dict[str, Any]:
    if revision == "R2":
        summary = "Restrained threat remains still and oppressive while combined department intensity stays capped."
        risks = "Animation acceleration, warm rim, bloom, particles, and debris must not combine into heroic spectacle."
        questions = (
            "Can readability improve without making the confrontation triumphant or explosive?"
        )
    else:
        summary = "The final confrontation should feel controlled, oppressive and inevitable."
        risks = "Threat must read through restraint, weight, and silhouette hierarchy rather than heroic spectacle."
        questions = "Where does local readability begin to turn controlled threat into spectacle?"
    return {
        "shot_objective": "Stage a final confrontation whose threat is controlled, oppressive, and inevitable.",
        "emotional_tone": "Controlled, oppressive, inevitable threat.",
        "visual_focus": "Weight and silhouette hierarchy over spectacle.",
        "rhythm_intensity": "Controlled pauses; no release into heroic acceleration.",
        "character_relationship": "The confrontation feels inevitable before it becomes explosive.",
        "narrative_priority": "Preserve controlled threat while allowing each department to improve local readability.",
        "core_summary": summary,
        "constraints": [{"content": risks}],
        "variation_zones": [
            {"content": "Readability may improve only inside the controlled-threat boundary."}
        ],
        "drift_risks": [{"description": risks}],
        "references": [],
        "open_questions": [{"question": questions}],
    }


def _execution_content(department: str, *, revision: str) -> dict[str, str]:
    if revision == "R2":
        common = "Preserve restrained threatening stillness; combined intensity must not become triumphant or explosive."
    else:
        common = "Translate the confirmed controlled, oppressive, inevitable Core Anchor without heroic spectacle."
    local = {
        "animation": "Faster lunge and clearer impact timing remain subordinate to controlled pauses and silhouette weight.",
        "lighting": "Character separation may improve through a restrained warm rim and readable facial/weapon hierarchy.",
        "comp": "Bloom, particles, debris, and saturation remain restrained so polish does not become spectacle.",
    }[department]
    return {
        "technical_boundaries": f"{common} {local}",
        "parameter_ranges": "Combined motion acceleration, warm rim, bloom, particles, and debris must remain capped by the confirmed Core Anchor.",
        "delivery_conditions": "Deliver a readable confrontation whose threat remains controlled and oppressive.",
        "production_ready_criteria": "Local readability improves without turning the scene triumphant.",
        "downstream_dependencies": "Compositing integration must preserve the combined-intensity ceiling across all three departments.",
        "publish_requirements": "Human CG Supervisor confirmation is required before publish.",
        "allowed_refinements": local,
        "escalation_conditions": "Escalate to Human VFX Supervisor when local improvements change the shared emotional read.",
    }


async def _resolve_project(session: AsyncSession) -> Project:
    entity_id = await find_linked_entity_id(
        session, entity_type="project", source=GOLDEN_SOURCE, external_id=GOLDEN_PROJECT_EXTERNAL_ID
    )
    if entity_id:
        project = await session.get(Project, entity_id)
        if project is None or project.source == "ftrack":
            raise RuntimeError("Golden Demo project identity is inconsistent or protected")
        return project
    project = Project(name=_PROJECT_NAME, source="manual")
    session.add(project)
    await session.flush()
    await record_external_link(
        session,
        entity_type="project",
        entity_id=project.id,
        source=GOLDEN_SOURCE,
        external_id=GOLDEN_PROJECT_EXTERNAL_ID,
    )
    return project


async def _resolve_shot(session: AsyncSession, project: Project) -> Shot:
    entity_id = await find_linked_entity_id(
        session, entity_type="shot", source=GOLDEN_SOURCE, external_id=GOLDEN_SHOT_EXTERNAL_ID
    )
    if entity_id:
        shot = await session.get(Shot, entity_id)
        if shot is None or shot.project_id != project.id or shot.source == "ftrack":
            raise RuntimeError("Golden Demo shot identity is inconsistent or protected")
        return shot
    shot = Shot(project_id=project.id, name=_SHOT_NAME, source="manual")
    session.add(shot)
    await session.flush()
    await record_external_link(
        session,
        entity_type="shot",
        entity_id=shot.id,
        source=GOLDEN_SOURCE,
        external_id=GOLDEN_SHOT_EXTERNAL_ID,
    )
    return shot


async def _resolve_task(session: AsyncSession, shot: Shot, department: str) -> Task:
    external_id = GOLDEN_TASK_EXTERNAL_IDS[department]
    entity_id = await find_linked_entity_id(
        session, entity_type="task", source=GOLDEN_SOURCE, external_id=external_id
    )
    if entity_id:
        task = await session.get(Task, entity_id)
        if task is None or task.shot_id != shot.id or task.source == "ftrack":
            raise RuntimeError("Golden Demo task identity is inconsistent or protected")
        return task
    task = Task(
        shot_id=shot.id, name=_TASK_NAMES[department], department=department, source="manual"
    )
    session.add(task)
    await session.flush()
    await record_external_link(
        session,
        entity_type="task",
        entity_id=task.id,
        source=GOLDEN_SOURCE,
        external_id=external_id,
    )
    return task


async def _assert_protected_records_absent(
    session: AsyncSession, project_id: uuid.UUID, shot_id: uuid.UUID, task_ids: list[uuid.UUID]
) -> None:
    ids = {project_id, shot_id, *task_ids}
    result = await session.execute(
        select(ExternalEntityLink).where(
            ExternalEntityLink.entity_id.in_(ids), ExternalEntityLink.source == "ftrack"
        )
    )
    if result.scalars().first() is not None:
        raise RuntimeError(
            "Golden Demo operation refused: ftrack-linked record exists in the canonical subtree"
        )


async def _create_version(
    session: AsyncSession, shot: Shot, task: Task, *, name: str, number: int, description: str
) -> Version:
    version = await version_service.create_version(
        session, _SEED_VFX, shot.id, name=name, version_number=number, description=description
    )
    version.task_id = task.id
    await session.commit()
    await session.refresh(version)
    return version


async def _create_anchor_baseline(
    session: AsyncSession, shot: Shot, tasks: list[Task], *, revision: str
) -> tuple[CoreAnchorRevision, list[ExecutionAnchorRevision]]:
    core = await core_anchor_service.create_draft_revision(
        session, _SEED_VFX, shot.id, _core_content(revision=revision)
    )
    core = await core_anchor_service.confirm_revision(
        session, _SEED_VFX, core.id, f"{GOLDEN_MARKER} Human VFX confirmed Core Anchor {revision}."
    )
    execution_revisions: list[ExecutionAnchorRevision] = []
    for task in tasks:
        draft = await execution_anchor_service.create_draft_revision(
            session,
            _SEED_CG,
            task.id,
            _execution_content(task.department or "comp", revision=revision),
        )
        execution_revisions.append(
            await execution_anchor_service.confirm_revision(
                session,
                _SEED_CG,
                draft.id,
                f"{GOLDEN_MARKER} Human CG confirmed {task.department} Execution Anchor {revision}.",
            )
        )
    return core, execution_revisions


async def _create_baseline_evidence(
    session: AsyncSession,
    shot: Shot,
    tasks: list[Task],
    versions: list[Version],
    execution_revisions: list[ExecutionAnchorRevision],
) -> None:
    brief = IntentBrief(
        shot_id=shot.id,
        raw_text=f"{GOLDEN_MARKER} The final confrontation must remain controlled, oppressive and inevitable.",
        source="manual",
        created_by_actor_kind="human",
        created_by_actor_id=_SEED_VFX.actor_id,
        created_by_human_role="vfx_supervisor",
    )
    session.add(brief)
    await session.commit()
    for version in versions:
        note = ReviewNote(
            version_id=version.id,
            content=f"{GOLDEN_MARKER} Local readability is defensible, but the integrated result must preserve controlled threat.",
            source="manual",
            created_by_actor_kind="human",
            created_by_actor_id=_SEED_VFX.actor_id,
            created_by_human_role="vfx_supervisor",
        )
        session.add(note)
    await session.commit()
    await vfx_supervisor_review_service.generate_vfx_supervisor_review(
        session, _SEED_VFX, versions[2].id, generator=DeterministicVFXSupervisorReviewGenerator()
    )
    for execution in execution_revisions:
        await cg_supervisor_review_service.generate_cg_supervisor_review(
            session, _SEED_CG, execution.id, generator=DeterministicCGSupervisorReviewGenerator()
        )
    for task, version in zip(tasks, versions, strict=True):
        await artist_guidance_service.generate_artist_agent_guidance(
            session,
            _SEED_ARTIST,
            version.id,
            task.id,
            generator=DeterministicArtistGuidanceGenerator(),
        )
    await dependency_service.create_dependency(
        session,
        _SEED_CG,
        tasks[2].id,
        kind="dependency",
        description=f"{GOLDEN_MARKER} Compositing integration depends on Animation and Lighting preserving the shared intensity ceiling.",
        severity="high",
        related_version_id=versions[2].id,
    )


async def _delete_golden_records(
    session: AsyncSession,
) -> tuple[uuid.UUID | None, list[uuid.UUID], list[uuid.UUID]]:
    project_id = await find_linked_entity_id(
        session, entity_type="project", source=GOLDEN_SOURCE, external_id=GOLDEN_PROJECT_EXTERNAL_ID
    )
    if project_id is None:
        return None, [], []
    project = await session.get(Project, project_id)
    if project is None or project.source == "ftrack":
        raise RuntimeError("Golden Demo root is missing or protected")
    shots = list((await session.scalars(select(Shot).where(Shot.project_id == project_id))).all())
    shot_ids = [shot.id for shot in shots]
    tasks = (
        list((await session.scalars(select(Task).where(Task.shot_id.in_(shot_ids)))).all())
        if shot_ids
        else []
    )
    task_ids = [task.id for task in tasks]
    await _assert_protected_records_absent(
        session, project_id, shot_ids[0] if shot_ids else project_id, task_ids
    )
    version_ids = (
        [
            row.id
            for row in (
                await session.scalars(select(Version).where(Version.shot_id.in_(shot_ids)))
            ).all()
        ]
        if shot_ids
        else []
    )
    core_ids = (
        [
            row.id
            for row in (
                await session.scalars(
                    select(CoreAnchorRevision).where(
                        CoreAnchorRevision.core_anchor_id.in_(
                            select(CoreAnchor.id).where(CoreAnchor.shot_id.in_(shot_ids))
                        )
                    )
                )
            ).all()
        ]
        if shot_ids
        else []
    )
    exec_ids = (
        [
            row.id
            for row in (
                await session.scalars(
                    select(ExecutionAnchorRevision).where(
                        ExecutionAnchorRevision.execution_anchor_id.in_(
                            select(ExecutionAnchor.id).where(ExecutionAnchor.task_id.in_(task_ids))
                        )
                    )
                )
            ).all()
        ]
        if task_ids
        else []
    )
    agent_run_ids = [
        row.agent_run_id
        for row in (
            await session.scalars(
                select(VFXSupervisorReview).where(VFXSupervisorReview.version_id.in_(version_ids))
            )
        ).all()
    ]
    agent_run_ids.extend(
        row.agent_run_id
        for row in (
            await session.scalars(
                select(CGSupervisorReview).where(
                    CGSupervisorReview.execution_anchor_revision_id.in_(exec_ids)
                )
            )
        ).all()
    )
    agent_run_ids.extend(
        row.agent_run_id
        for row in (
            await session.scalars(
                select(ArtistAgentGuidance).where(ArtistAgentGuidance.task_id.in_(task_ids))
            )
        ).all()
    )
    agent_run_ids.extend(
        row.agent_run_id
        for row in (
            await session.scalars(
                select(CrossRoleAssessment).where(CrossRoleAssessment.shot_id.in_(shot_ids))
            )
        ).all()
    )
    context_ids = [
        row.context_snapshot_id
        for row in (
            await session.scalars(
                select(VFXSupervisorReview).where(VFXSupervisorReview.version_id.in_(version_ids))
            )
        ).all()
    ]
    context_ids.extend(
        row.context_snapshot_id
        for row in (
            await session.scalars(
                select(CGSupervisorReview).where(
                    CGSupervisorReview.execution_anchor_revision_id.in_(exec_ids)
                )
            )
        ).all()
    )
    context_ids.extend(
        row.context_snapshot_id
        for row in (
            await session.scalars(
                select(ArtistAgentGuidance).where(ArtistAgentGuidance.task_id.in_(task_ids))
            )
        ).all()
    )
    context_ids.extend(
        row.context_snapshot_id
        for row in (
            await session.scalars(
                select(CrossRoleAssessment).where(CrossRoleAssessment.shot_id.in_(shot_ids))
            )
        ).all()
    )
    loose_ids = set(
        project_ids
        for project_ids in [project_id, *shot_ids, *task_ids, *version_ids, *core_ids, *exec_ids]
    )
    await session.execute(delete(ReAnchorProposal).where(ReAnchorProposal.shot_id.in_(shot_ids)))
    await session.execute(delete(IntentSignal).where(IntentSignal.shot_id.in_(shot_ids)))
    await session.execute(
        delete(CrossRoleAssessment).where(CrossRoleAssessment.shot_id.in_(shot_ids))
    )
    await session.execute(delete(TaskDependency).where(TaskDependency.project_id == project_id))
    await session.execute(delete(ReviewNote).where(ReviewNote.version_id.in_(version_ids)))
    await session.execute(
        delete(VFXSupervisorReview).where(VFXSupervisorReview.version_id.in_(version_ids))
    )
    await session.execute(
        delete(CGSupervisorReview).where(
            CGSupervisorReview.execution_anchor_revision_id.in_(exec_ids)
        )
    )
    await session.execute(
        delete(ArtistAgentGuidance).where(ArtistAgentGuidance.task_id.in_(task_ids))
    )
    await session.execute(delete(AgentRun).where(AgentRun.id.in_(agent_run_ids)))
    await session.execute(delete(ContextSnapshot).where(ContextSnapshot.id.in_(context_ids)))
    await session.execute(delete(HumanGate).where(HumanGate.shot_id.in_(shot_ids)))
    await session.execute(delete(Decision).where(Decision.entity_id.in_([*core_ids, *exec_ids])))
    await session.execute(
        delete(WorkflowTransition).where(WorkflowTransition.entity_id.in_([*core_ids, *exec_ids]))
    )
    await session.execute(
        update(ExecutionAnchor)
        .where(ExecutionAnchor.task_id.in_(task_ids))
        .values(active_revision_id=None)
    )
    await session.execute(
        update(CoreAnchor).where(CoreAnchor.shot_id.in_(shot_ids)).values(active_revision_id=None)
    )
    await session.flush()
    await session.execute(
        delete(ExecutionAnchorRevision).where(ExecutionAnchorRevision.id.in_(exec_ids))
    )
    await session.execute(delete(CoreAnchorRevision).where(CoreAnchorRevision.id.in_(core_ids)))
    await session.execute(delete(ExecutionAnchor).where(ExecutionAnchor.task_id.in_(task_ids)))
    await session.execute(delete(CoreAnchor).where(CoreAnchor.shot_id.in_(shot_ids)))
    await session.execute(delete(Version).where(Version.id.in_(version_ids)))
    await session.execute(delete(IntentBrief).where(IntentBrief.shot_id.in_(shot_ids)))
    await session.execute(
        delete(ExternalEntityLink).where(
            ExternalEntityLink.entity_id.in_(loose_ids), ExternalEntityLink.source == GOLDEN_SOURCE
        )
    )
    await session.execute(delete(Task).where(Task.id.in_(task_ids)))
    await session.execute(delete(Shot).where(Shot.id.in_(shot_ids)))
    await session.execute(delete(Project).where(Project.id == project_id))
    await session.commit()
    return project_id, shot_ids, task_ids


async def _result(
    session: AsyncSession,
    snapshot: str,
    project: Project,
    shot: Shot,
    tasks: list[Task],
    versions: list[Version],
) -> GoldenScenarioResult:
    task_ids = [task.id for task in tasks]
    version_ids = [version.id for version in versions]
    core_ids = select(CoreAnchorRevision.id).where(
        CoreAnchorRevision.core_anchor_id.in_(
            select(CoreAnchor.id).where(CoreAnchor.shot_id == shot.id)
        )
    )
    execution_ids = select(ExecutionAnchorRevision.id).where(
        ExecutionAnchorRevision.execution_anchor_id.in_(
            select(ExecutionAnchor.id).where(ExecutionAnchor.task_id.in_(task_ids))
        )
    )
    counts = {
        "projects": 1,
        "shots": int(
            await session.scalar(select(func.count()).select_from(Shot).where(Shot.id == shot.id))
        ),
        "tasks": int(
            await session.scalar(
                select(func.count()).select_from(Task).where(Task.id.in_(task_ids))
            )
        ),
        "versions": int(
            await session.scalar(
                select(func.count()).select_from(Version).where(Version.id.in_(version_ids))
            )
        ),
        "core_anchor_revisions": int(
            await session.scalar(
                select(func.count())
                .select_from(CoreAnchorRevision)
                .where(CoreAnchorRevision.id.in_(core_ids))
            )
        ),
        "execution_anchor_revisions": int(
            await session.scalar(
                select(func.count())
                .select_from(ExecutionAnchorRevision)
                .where(ExecutionAnchorRevision.id.in_(execution_ids))
            )
        ),
        "reviews": int(
            await session.scalar(
                select(func.count())
                .select_from(VFXSupervisorReview)
                .where(VFXSupervisorReview.version_id.in_(version_ids))
            )
        ),
        "guidance": int(
            await session.scalar(
                select(func.count())
                .select_from(ArtistAgentGuidance)
                .where(ArtistAgentGuidance.task_id.in_(task_ids))
            )
        ),
        "assessments": int(
            await session.scalar(
                select(func.count())
                .select_from(CrossRoleAssessment)
                .where(CrossRoleAssessment.shot_id == shot.id)
            )
        ),
        "dependencies": int(
            await session.scalar(
                select(func.count())
                .select_from(TaskDependency)
                .where(TaskDependency.project_id == project.id)
            )
        ),
    }
    return GoldenScenarioResult(
        snapshot=snapshot,
        project_id=project.id,
        shot_id=shot.id,
        task_ids=tuple(task.id for task in tasks),
        version_ids=tuple(version.id for version in versions),
        counts=counts,
        completed_at=_now(),
    )


async def _build_reset(session: AsyncSession) -> GoldenScenarioResult:
    await _delete_golden_records(session)
    project = await _resolve_project(session)
    shot = await _resolve_shot(session, project)
    tasks = [
        await _resolve_task(session, shot, department)
        for department in ("animation", "lighting", "comp")
    ]
    await session.commit()
    core, execution = await _create_anchor_baseline(session, shot, tasks, revision="R1")
    versions = [
        await _create_version(
            session,
            shot,
            task,
            name=f"{department.title()} Conflict V1",
            number=1,
            description=f"{GOLDEN_MARKER} {department} local-optimum conflict version.",
        )
        for department, task in zip(("Animation", "Lighting", "Compositing"), tasks, strict=True)
    ]
    await _create_baseline_evidence(session, shot, tasks, versions, execution)
    return await _result(session, "reset", project, shot, tasks, versions)


async def _build_completed(session: AsyncSession) -> GoldenScenarioResult:
    await _delete_golden_records(session)
    project = await _resolve_project(session)
    shot = await _resolve_shot(session, project)
    tasks = [
        await _resolve_task(session, shot, department)
        for department in ("animation", "lighting", "comp")
    ]
    await session.commit()
    core_r1, execution_r1 = await _create_anchor_baseline(session, shot, tasks, revision="R1")
    conflict_versions = [
        await _create_version(
            session,
            shot,
            task,
            name=f"{department.title()} Conflict V1",
            number=1,
            description=f"{GOLDEN_MARKER} {department} local-optimum conflict version.",
        )
        for department, task in zip(("Animation", "Lighting", "Compositing"), tasks, strict=True)
    ]
    await _create_baseline_evidence(session, shot, tasks, conflict_versions, execution_r1)
    assessment = await generate_cross_role_assessment(
        session,
        _SEED_VFX,
        conflict_versions[2].id,
        tasks[2].id,
        generator=DeterministicCrossRoleAssessmentGenerator(),
    )
    core_r2_draft = await core_anchor_service.create_draft_revision(
        session, _SEED_VFX, shot.id, _core_content(revision="R2")
    )
    await core_anchor_service.confirm_revision(
        session,
        _SEED_VFX,
        core_r2_draft.id,
        f"{GOLDEN_MARKER} Human VFX confirmed Core Anchor R2 after cross-role assessment {assessment.id}.",
    )
    execution_r2: list[ExecutionAnchorRevision] = []
    for task in tasks:
        draft = await execution_anchor_service.create_draft_revision(
            session, _SEED_CG, task.id, _execution_content(task.department or "comp", revision="R2")
        )
        execution_r2.append(
            await execution_anchor_service.confirm_revision(
                session,
                _SEED_CG,
                draft.id,
                f"{GOLDEN_MARKER} Human CG confirmed {task.department} Execution Anchor R2.",
            )
        )
    resolved_versions = [
        await _create_version(
            session,
            shot,
            task,
            name=f"{department.title()} Resolved V2",
            number=2,
            description=f"{GOLDEN_MARKER} {department} resolved version applying Core Anchor R2 combined-intensity constraints.",
        )
        for department, task in zip(("Animation", "Lighting", "Compositing"), tasks, strict=True)
    ]
    await _create_baseline_evidence(session, shot, tasks, resolved_versions, execution_r2)
    await generate_cross_role_assessment(
        session,
        _SEED_VFX,
        resolved_versions[2].id,
        tasks[2].id,
        generator=DeterministicCrossRoleAssessmentGenerator(),
    )
    return await _result(
        session, "completed", project, shot, tasks, [*conflict_versions, *resolved_versions]
    )


async def reset_golden_journey(session: AsyncSession) -> GoldenScenarioResult:
    return await _build_reset(session)


async def load_completed_golden_journey(session: AsyncSession) -> GoldenScenarioResult:
    return await _build_completed(session)


async def inspect_golden_journey(session: AsyncSession) -> GoldenScenarioResult | None:
    project = await session.scalar(
        select(Project)
        .join(ExternalEntityLink, ExternalEntityLink.entity_id == Project.id)
        .where(
            ExternalEntityLink.entity_type == "project",
            ExternalEntityLink.source == GOLDEN_SOURCE,
            ExternalEntityLink.external_id == GOLDEN_PROJECT_EXTERNAL_ID,
        )
    )
    if project is None:
        return None
    shot = await session.scalar(select(Shot).where(Shot.project_id == project.id))
    if shot is None:
        return None
    tasks = list(
        (
            await session.scalars(
                select(Task).where(Task.shot_id == shot.id).order_by(Task.created_at)
            )
        ).all()
    )
    versions = list(
        (
            await session.scalars(
                select(Version).where(Version.shot_id == shot.id).order_by(Version.created_at)
            )
        ).all()
    )
    snapshot = "completed" if len(versions) == 6 else "reset"
    return await _result(session, snapshot, project, shot, tasks, versions)
