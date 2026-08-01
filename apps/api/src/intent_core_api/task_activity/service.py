"""Task Activity read-model service (Step 7C-4).

Composes real, already-persisted Execution Anchor / Decision / CG
Supervisor review / TaskDependency / Cross-role Assessment rows into one
chronological timeline per Task -- no new table, no mutation logic, no
fabricated entry. Mirrors ``activity.service.build_shot_activity``'s
event-record shape and its "Decision recorded is additive, never a
substitute" convention (fixed there in Step 7C-3's completion pass),
Task-scoped instead of Shot-scoped.
"""

from __future__ import annotations

import uuid

from intent_core_contracts.api.task_activity import TaskActivityEventRead, TaskActivityRead
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.cross_department.models import TaskDependency
from intent_core_api.intent import execution_anchor_service
from intent_core_api.intent.models import CGSupervisorReview
from intent_core_api.versions_and_feedback.models import CrossRoleAssessment
from intent_core_api.workflow import decision_service
from intent_core_api.workflow.models import Decision


def _execution_route(task_id: uuid.UUID) -> str:
    return f"/cg/tasks/{task_id}/execution"


def _version_review_route(task_id: uuid.UUID) -> str:
    return f"/cg/tasks/{task_id}/version-review"


def _dependencies_route(task_id: uuid.UUID) -> str:
    return f"/cg/tasks/{task_id}/dependencies"


_EXECUTION_ANCHOR_DECISION_EVENT_TYPE = {
    "confirm_execution_anchor": "execution_anchor_confirmed",
    "reject_execution_anchor": "execution_anchor_draft_discarded",
}
_EXECUTION_ANCHOR_DECISION_SUMMARY_VERB = {
    "confirm_execution_anchor": "confirmed",
    "reject_execution_anchor": "discarded the draft for",
}


def _decision_event(
    decision: Decision, revision_number: int, task_id: uuid.UUID
) -> TaskActivityEventRead:
    event_type = _EXECUTION_ANCHOR_DECISION_EVENT_TYPE.get(
        decision.decision_type, "execution_anchor_confirmed"
    )
    verb = _EXECUTION_ANCHOR_DECISION_SUMMARY_VERB.get(
        decision.decision_type, f"recorded a {decision.decision_type} decision on"
    )
    role_label = decision.actor_human_role or "Supervisor"
    return TaskActivityEventRead(
        id=f"decision:{decision.id}",
        event_type=event_type,  # type: ignore[arg-type]
        occurred_at=decision.created_at,
        actor_kind=decision.actor_kind,  # type: ignore[arg-type]
        actor_id=decision.actor_id,
        actor_human_role=decision.actor_human_role,  # type: ignore[arg-type]
        summary=f"Human {role_label} {verb} Execution Anchor Revision {revision_number}",
        related_entity_type="decision",
        related_entity_id=decision.id,
        route=_execution_route(task_id),
    )


def _human_decision_recorded_event(
    decision: Decision, revision_number: int, task_id: uuid.UUID
) -> TaskActivityEventRead:
    role_label = decision.actor_human_role or "Supervisor"
    decision_label = decision.decision_type.replace("_", " ")
    return TaskActivityEventRead(
        id=f"decision_recorded:{decision.id}",
        event_type="human_decision_recorded",
        occurred_at=decision.created_at,
        actor_kind=decision.actor_kind,  # type: ignore[arg-type]
        actor_id=decision.actor_id,
        actor_human_role=decision.actor_human_role,  # type: ignore[arg-type]
        summary=(
            f"Decision recorded: Human {role_label} {decision_label} "
            f"(Execution Anchor Revision {revision_number})"
        ),
        related_entity_type="decision",
        related_entity_id=decision.id,
        route=_execution_route(task_id),
    )


_DEPENDENCY_EVENT_TYPE = {
    "open": "dependency_recorded",
    "acknowledged": "dependency_acknowledged",
    "resolved": "dependency_resolved",
}


async def build_task_activity(session: AsyncSession, task_id: uuid.UUID) -> TaskActivityRead:
    events: list[TaskActivityEventRead] = []

    revisions = await execution_anchor_service.list_revisions_for_task(session, task_id)
    for revision in revisions:
        events.append(
            TaskActivityEventRead(
                id=f"execution_anchor_revision_created:{revision.id}",
                event_type="execution_anchor_draft_created",
                occurred_at=revision.created_at,
                actor_kind=revision.created_by_actor_kind,  # type: ignore[arg-type]
                actor_id=revision.created_by_actor_id,
                actor_human_role=revision.created_by_human_role,  # type: ignore[arg-type]
                summary=f"Execution Anchor Revision {revision.revision_number} draft created",
                related_entity_type="execution_anchor_revision",
                related_entity_id=revision.id,
                route=_execution_route(task_id),
            )
        )
        if revision.updated_at > revision.created_at:
            events.append(
                TaskActivityEventRead(
                    id=f"execution_anchor_revision_updated:{revision.id}",
                    event_type="execution_anchor_draft_updated",
                    occurred_at=revision.updated_at,
                    actor_kind=None,
                    actor_id=None,
                    actor_human_role=None,
                    summary=f"Execution Anchor Revision {revision.revision_number} draft saved",
                    related_entity_type="execution_anchor_revision",
                    related_entity_id=revision.id,
                    route=_execution_route(task_id),
                )
            )

        decisions = await decision_service.list_decisions_for_entity(
            session, "execution_anchor_revision", revision.id
        )
        for decision in decisions:
            events.append(_decision_event(decision, revision.revision_number, task_id))
            events.append(
                _human_decision_recorded_event(decision, revision.revision_number, task_id)
            )

    cg_reviews = list(
        (
            await session.execute(
                select(CGSupervisorReview).where(CGSupervisorReview.task_id == task_id)
            )
        )
        .scalars()
        .all()
    )
    for review in cg_reviews:
        events.append(
            TaskActivityEventRead(
                id=f"cg_review_generated:{review.id}",
                event_type="cg_supervisor_review_generated",
                occurred_at=review.created_at,
                actor_kind="agent",
                actor_id=None,
                actor_human_role=None,
                summary="CG Supervisor review generated",
                related_entity_type="cg_supervisor_review",
                related_entity_id=review.id,
                route=_version_review_route(task_id),
            )
        )

    dependencies = list(
        (await session.execute(select(TaskDependency).where(TaskDependency.task_id == task_id)))
        .scalars()
        .all()
    )
    for dependency in dependencies:
        label = "Escalation" if dependency.kind == "escalation" else dependency.kind.capitalize()
        events.append(
            TaskActivityEventRead(
                id=f"dependency_recorded:{dependency.id}",
                event_type=(
                    "escalation_recorded"
                    if dependency.kind == "escalation"
                    else "dependency_recorded"
                ),
                occurred_at=dependency.created_at,
                actor_kind=dependency.created_by_actor_kind,  # type: ignore[arg-type]
                actor_id=dependency.created_by_actor_id,
                actor_human_role=dependency.created_by_human_role,  # type: ignore[arg-type]
                summary=f'{label} recorded: "{dependency.description}"',
                related_entity_type="task_dependency",
                related_entity_id=dependency.id,
                route=_dependencies_route(task_id),
            )
        )
        if dependency.status in ("acknowledged", "resolved") and dependency.resolved_at is not None:
            events.append(
                TaskActivityEventRead(
                    id=f"dependency_status:{dependency.id}:{dependency.status}",
                    event_type=_DEPENDENCY_EVENT_TYPE[dependency.status],  # type: ignore[arg-type]
                    occurred_at=dependency.resolved_at,
                    actor_kind="human",
                    actor_id=dependency.resolved_by_actor_id,
                    actor_human_role=dependency.resolved_by_human_role,  # type: ignore[arg-type]
                    summary=f"{label} {dependency.status}",
                    related_entity_type="task_dependency",
                    related_entity_id=dependency.id,
                    route=_dependencies_route(task_id),
                )
            )

    assessments = list(
        (
            await session.execute(
                select(CrossRoleAssessment).where(CrossRoleAssessment.task_id == task_id)
            )
        )
        .scalars()
        .all()
    )
    for assessment in assessments:
        events.append(
            TaskActivityEventRead(
                id=f"cross_role_assessment:{assessment.id}",
                event_type="cross_role_assessment_involving_task",
                occurred_at=assessment.created_at,
                actor_kind="agent",
                actor_id=None,
                actor_human_role=None,
                summary="Cross-role Assessment generated involving this Task",
                related_entity_type="cross_role_assessment",
                related_entity_id=assessment.id,
                route=_version_review_route(task_id),
            )
        )

    events.sort(key=lambda event: event.occurred_at, reverse=True)
    return TaskActivityRead(task_id=task_id, events=events)
