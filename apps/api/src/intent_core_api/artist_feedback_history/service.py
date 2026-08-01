"""Artist-facing Task Feedback History read-model service (Step 7C-5).

Composes real, already-persisted Version / ReviewNote / ArtistAgentGuidance
/ CGSupervisorReview / CrossRoleAssessment / TaskDependency / Decision rows
into one chronological, newest-first timeline per Task -- no new table, no
mutation logic, no fabricated entry. A sibling to ``task_activity`` (CG's
Activity tab), not a reuse of it: this is Artist's own bounded event
vocabulary, framed around feedback received rather than Execution Anchor
draft/save mechanics, and routes into Artist's own pages
(`/artist/tasks/...`), never CG's.
"""

from __future__ import annotations

import uuid

from intent_core_contracts.api.artist_feedback_history import (
    ArtistFeedbackEventRead,
    ArtistFeedbackHistoryRead,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.cross_department.models import TaskDependency
from intent_core_api.intent.models import CGSupervisorReview, ExecutionAnchorRevision
from intent_core_api.production_context.models import Task
from intent_core_api.versions_and_feedback.models import (
    ArtistAgentGuidance,
    CrossRoleAssessment,
    ReviewNote,
    Version,
)
from intent_core_api.workflow import decision_service
from intent_core_api.workflow.models import Decision


def _task_overview_route(task_id: uuid.UUID) -> str:
    return f"/artist/tasks/{task_id}"


def _current_version_route(task_id: uuid.UUID) -> str:
    return f"/artist/tasks/{task_id}/current-version"


_EXECUTION_ANCHOR_DECISION_EVENT_TYPE = {
    "confirm_execution_anchor": "execution_anchor_confirmed",
    "reject_execution_anchor": "execution_anchor_draft_discarded",
}
_EXECUTION_ANCHOR_DECISION_VERB = {
    "confirm_execution_anchor": "confirmed",
    "reject_execution_anchor": "discarded the draft for",
}

_DEPENDENCY_EVENT_TYPE = {
    "open": "dependency_recorded",
    "acknowledged": "dependency_acknowledged",
    "resolved": "dependency_resolved",
}


async def build_task_feedback_history(
    session: AsyncSession, task_id: uuid.UUID
) -> ArtistFeedbackHistoryRead:
    events: list[ArtistFeedbackEventRead] = []

    task = await session.get(Task, task_id)
    versions: list[Version] = []
    if task is not None:
        versions = list(
            (
                await session.execute(
                    select(Version)
                    .where(Version.shot_id == task.shot_id)
                    .order_by(Version.created_at)
                )
            )
            .scalars()
            .all()
        )

    for version in versions:
        events.append(
            ArtistFeedbackEventRead(
                id=f"version_recorded:{version.id}",
                event_type="version_recorded",
                occurred_at=version.created_at,
                actor_kind=version.created_by_actor_kind,  # type: ignore[arg-type]
                actor_id=version.created_by_actor_id,
                actor_human_role=version.created_by_human_role,  # type: ignore[arg-type]
                summary=f'Production Version "{version.name}" recorded',
                related_entity_type="version",
                related_entity_id=version.id,
                related_version_id=version.id,
                route=_current_version_route(task_id),
            )
        )

        review_notes = list(
            (
                await session.execute(
                    select(ReviewNote)
                    .where(ReviewNote.version_id == version.id)
                    .order_by(ReviewNote.created_at)
                )
            )
            .scalars()
            .all()
        )
        for note in review_notes:
            events.append(
                ArtistFeedbackEventRead(
                    id=f"review_note_recorded:{note.id}",
                    event_type="review_note_recorded",
                    occurred_at=note.created_at,
                    actor_kind=note.created_by_actor_kind,  # type: ignore[arg-type]
                    actor_id=note.created_by_actor_id,
                    actor_human_role=note.created_by_human_role,  # type: ignore[arg-type]
                    summary=f'Review Note recorded: "{note.content}"',
                    related_entity_type="review_note",
                    related_entity_id=note.id,
                    related_version_id=version.id,
                    route=_current_version_route(task_id),
                )
            )

    guidances = list(
        (
            await session.execute(
                select(ArtistAgentGuidance)
                .where(ArtistAgentGuidance.task_id == task_id)
                .order_by(ArtistAgentGuidance.created_at)
            )
        )
        .scalars()
        .all()
    )
    for guidance in guidances:
        events.append(
            ArtistFeedbackEventRead(
                id=f"artist_guidance_generated:{guidance.id}",
                event_type="artist_guidance_generated",
                occurred_at=guidance.created_at,
                actor_kind="agent",
                actor_id=None,
                actor_human_role=None,
                summary="Artist Agent guidance generated",
                related_entity_type="artist_agent_guidance",
                related_entity_id=guidance.id,
                related_version_id=guidance.version_id,
                route=_task_overview_route(task_id),
            )
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
            ArtistFeedbackEventRead(
                id=f"cg_review_generated:{review.id}",
                event_type="cg_supervisor_review_generated",
                occurred_at=review.created_at,
                actor_kind="agent",
                actor_id=None,
                actor_human_role=None,
                summary="CG Supervisor review generated for this Task's Execution Anchor",
                related_entity_type="cg_supervisor_review",
                related_entity_id=review.id,
                related_version_id=None,
                route=_current_version_route(task_id),
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
            ArtistFeedbackEventRead(
                id=f"cross_role_assessment:{assessment.id}",
                event_type="cross_role_assessment_involving_task",
                occurred_at=assessment.created_at,
                actor_kind="agent",
                actor_id=None,
                actor_human_role=None,
                summary="Cross-role Assessment generated involving this Task",
                related_entity_type="cross_role_assessment",
                related_entity_id=assessment.id,
                related_version_id=assessment.version_id,
                route=_current_version_route(task_id),
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
            ArtistFeedbackEventRead(
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
                related_version_id=dependency.related_version_id,
                route=_task_overview_route(task_id),
            )
        )
        if dependency.status in ("acknowledged", "resolved") and dependency.resolved_at is not None:
            events.append(
                ArtistFeedbackEventRead(
                    id=f"dependency_status:{dependency.id}:{dependency.status}",
                    event_type=_DEPENDENCY_EVENT_TYPE[dependency.status],  # type: ignore[arg-type]
                    occurred_at=dependency.resolved_at,
                    actor_kind="human",
                    actor_id=dependency.resolved_by_actor_id,
                    actor_human_role=dependency.resolved_by_human_role,  # type: ignore[arg-type]
                    summary=f"{label} {dependency.status}",
                    related_entity_type="task_dependency",
                    related_entity_id=dependency.id,
                    related_version_id=dependency.related_version_id,
                    route=_task_overview_route(task_id),
                )
            )

    execution_revisions: list[ExecutionAnchorRevision] = []
    if task is not None:
        from intent_core_api.intent import execution_anchor_service

        execution_revisions = await execution_anchor_service.list_revisions_for_task(
            session, task_id
        )

    for revision in execution_revisions:
        decisions: list[Decision] = await decision_service.list_decisions_for_entity(
            session, "execution_anchor_revision", revision.id
        )
        for decision in decisions:
            event_type = _EXECUTION_ANCHOR_DECISION_EVENT_TYPE.get(
                decision.decision_type, "execution_anchor_confirmed"
            )
            verb = _EXECUTION_ANCHOR_DECISION_VERB.get(
                decision.decision_type, f"recorded a {decision.decision_type} decision on"
            )
            role_label = decision.actor_human_role or "Supervisor"
            events.append(
                ArtistFeedbackEventRead(
                    id=f"execution_anchor_decision:{decision.id}",
                    event_type=event_type,  # type: ignore[arg-type]
                    occurred_at=decision.created_at,
                    actor_kind=decision.actor_kind,  # type: ignore[arg-type]
                    actor_id=decision.actor_id,
                    actor_human_role=decision.actor_human_role,  # type: ignore[arg-type]
                    summary=(
                        f"Human {role_label} {verb} Execution Anchor Revision "
                        f"{revision.revision_number} -- this Task's operational boundaries"
                    ),
                    related_entity_type="decision",
                    related_entity_id=decision.id,
                    related_version_id=None,
                    route=_task_overview_route(task_id),
                )
            )

    events.sort(key=lambda event: event.occurred_at, reverse=True)
    return ArtistFeedbackHistoryRead(task_id=task_id, events=events)
