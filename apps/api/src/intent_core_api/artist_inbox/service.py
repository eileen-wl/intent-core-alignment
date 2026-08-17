"""Artist Review Inbox read-model service (Step 7C-5).

Composes real, already-persisted Task/Shot/Project/ExecutionAnchor/
Version/ReviewNote/ArtistAgentGuidance/TaskDependency state into one
bounded ``ArtistInboxItemRead`` per Task -- no new mutation logic, no
notification/read state, no fabricated metric. Mirrors
``cg_inbox.service``'s per-item query shape (one bounded set of queries
per Task, no cross-Task batching), Artist-owned content instead of CG's.

Every Task in the system is potentially Artist-relevant -- the domain has
no persisted Task-assignee field (``production_context.models.Task`` has
none), so this deliberately does not fabricate an assignment scope; it
lists every real Task exactly as ``cg_inbox.service`` already does for CG.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from intent_core_contracts.api.artist_inbox import ArtistInboxItemRead, ArtistInboxRead
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.artist_inbox.current_focus import (
    TaskFocusInputs,
    derive_current_focus,
    sort_rank_for_focus_type,
)
from intent_core_api.cross_department.models import TaskDependency
from intent_core_api.intent.models import ExecutionAnchor, ExecutionAnchorRevision
from intent_core_api.production_context.models import Project, Shot, Task
from intent_core_api.versions_and_feedback.models import ArtistAgentGuidance, ReviewNote, Version


@dataclass(frozen=True)
class _TaskRelatedData:
    active_revision: ExecutionAnchorRevision | None
    execution_anchor_exists: bool
    draft_or_pending_execution: bool
    latest_version: Version | None
    has_review_notes: bool
    open_dependency_count: int
    dependency_needs_attention: bool
    latest_guidance: ArtistAgentGuidance | None


async def _load_task_related_data(
    session: AsyncSession, task_id: uuid.UUID, shot_id: uuid.UUID
) -> _TaskRelatedData:
    execution_anchor = await session.scalar(
        select(ExecutionAnchor).where(ExecutionAnchor.task_id == task_id)
    )

    active_revision: ExecutionAnchorRevision | None = None
    draft_or_pending_execution = False
    if execution_anchor is not None:
        if execution_anchor.active_revision_id is not None:
            active_revision = await session.get(
                ExecutionAnchorRevision, execution_anchor.active_revision_id
            )
        draft_or_pending_execution = execution_anchor.active_revision_id is not None or bool(
            (
                await session.scalars(
                    select(ExecutionAnchorRevision.id).where(
                        ExecutionAnchorRevision.execution_anchor_id == execution_anchor.id,
                        ExecutionAnchorRevision.status == "draft",
                    )
                )
            ).first()
        )

    latest_version = await session.scalar(
        select(Version)
        .where(Version.shot_id == shot_id, Version.task_id == task_id)
        .order_by(Version.created_at.desc())
        .limit(1)
    )
    if latest_version is None:
        latest_version = await session.scalar(
            select(Version)
            .where(Version.shot_id == shot_id, Version.task_id.is_(None))
            .order_by(Version.created_at.desc())
            .limit(1)
        )

    has_review_notes = False
    if latest_version is not None:
        existing_note = await session.scalar(
            select(ReviewNote.id).where(ReviewNote.version_id == latest_version.id).limit(1)
        )
        has_review_notes = existing_note is not None

    dependency_rows = list(
        (await session.execute(select(TaskDependency).where(TaskDependency.task_id == task_id)))
        .scalars()
        .all()
    )
    open_dependency_count = sum(
        1
        for dependency in dependency_rows
        if dependency.kind in ("dependency", "conflict", "escalation")
        and dependency.status != "resolved"
    )
    dependency_needs_attention = any(
        dependency.kind in ("dependency", "conflict", "escalation") and dependency.status == "open"
        for dependency in dependency_rows
    )

    latest_guidance: ArtistAgentGuidance | None = None
    if latest_version is not None:
        latest_guidance = await session.scalar(
            select(ArtistAgentGuidance)
            .where(
                ArtistAgentGuidance.task_id == task_id,
                ArtistAgentGuidance.version_id == latest_version.id,
            )
            .order_by(ArtistAgentGuidance.created_at.desc())
            .limit(1)
        )

    return _TaskRelatedData(
        active_revision=active_revision,
        execution_anchor_exists=execution_anchor is not None,
        draft_or_pending_execution=draft_or_pending_execution,
        latest_version=latest_version,
        has_review_notes=has_review_notes,
        open_dependency_count=open_dependency_count,
        dependency_needs_attention=dependency_needs_attention,
        latest_guidance=latest_guidance,
    )


def _execution_anchor_state(data: _TaskRelatedData) -> str:
    if data.active_revision is not None and data.active_revision.status == "confirmed":
        return "confirmed"
    if data.execution_anchor_exists and data.draft_or_pending_execution:
        return "draft_pending"
    return "none"


def _guidance_state(data: _TaskRelatedData) -> tuple[str, bool]:
    """Returns ``(guidance_state, is_outdated)``. Outdated is real and
    derivable only when guidance exists *and* the Task's active confirmed
    Execution Anchor revision now differs from the one it was generated
    against -- never a fabricated staleness signal.
    """
    if data.latest_guidance is None:
        return "none", False
    if (
        data.active_revision is not None
        and data.active_revision.status == "confirmed"
        and data.latest_guidance.execution_anchor_revision_id != data.active_revision.id
    ):
        return "outdated", True
    return "current", False


async def build_task_inbox_item(
    session: AsyncSession, task: Task, shot: Shot, project_name: str
) -> ArtistInboxItemRead:
    data = await _load_task_related_data(session, task.id, shot.id)
    guidance_state, is_outdated = _guidance_state(data)

    guidance_available = (
        data.latest_guidance is None
        and data.active_revision is not None
        and data.active_revision.status == "confirmed"
        and data.latest_version is not None
    )

    inputs = TaskFocusInputs(
        task_id=task.id,
        guidance_exists=data.latest_guidance is not None,
        guidance_outdated=is_outdated,
        has_review_notes=data.has_review_notes,
        dependency_needs_attention=data.dependency_needs_attention,
        guidance_available=guidance_available,
    )
    current_focus = derive_current_focus(inputs)

    bucket = sort_rank_for_focus_type(current_focus.focus_type)
    ordinal = -int(task.created_at.timestamp() * 1_000_000) if task.created_at else 0

    return ArtistInboxItemRead(
        task_id=task.id,
        task_name=task.name,
        department=task.department,
        task_source=task.source,  # type: ignore[arg-type]
        shot_id=shot.id,
        shot_name=shot.name,
        project_id=shot.project_id,
        project_name=project_name,
        execution_anchor_state=_execution_anchor_state(data),  # type: ignore[arg-type]
        active_execution_anchor_revision_id=(
            data.active_revision.id if data.active_revision else None
        ),
        active_execution_anchor_summary=(
            data.active_revision.technical_boundaries if data.active_revision else None
        ),
        latest_version_id=data.latest_version.id if data.latest_version else None,
        latest_version_name=data.latest_version.name if data.latest_version else None,
        latest_version_number=(data.latest_version.version_number if data.latest_version else None),
        guidance_state=guidance_state,  # type: ignore[arg-type]
        latest_guidance_id=data.latest_guidance.id if data.latest_guidance else None,
        open_review_note_count=1 if data.has_review_notes else 0,
        open_dependency_count=data.open_dependency_count,
        current_focus=current_focus,
        sort_rank=bucket * 1_000_000_000_000 + ordinal,
    )


async def list_inbox_items(session: AsyncSession) -> ArtistInboxRead:
    query = select(Task).order_by(Task.created_at)
    tasks = list((await session.execute(query)).scalars().all())

    shot_ids = {task.shot_id for task in tasks}
    shots: dict[uuid.UUID, Shot] = {}
    if shot_ids:
        shot_rows = (
            (await session.execute(select(Shot).where(Shot.id.in_(shot_ids)))).scalars().all()
        )
        shots = {shot.id: shot for shot in shot_rows}

    project_ids = {shot.project_id for shot in shots.values()}
    projects: dict[uuid.UUID, str] = {}
    if project_ids:
        project_rows = (
            await session.execute(
                select(Project.id, Project.name).where(Project.id.in_(project_ids))
            )
        ).all()
        projects = {row[0]: row[1] for row in project_rows}

    items = [
        await build_task_inbox_item(
            session, task, shots[task.shot_id], projects.get(shots[task.shot_id].project_id, "")
        )
        for task in tasks
        if task.shot_id in shots
    ]
    items.sort(key=lambda item: (item.sort_rank, str(item.task_id)))
    return ArtistInboxRead(items=items, generated_at=datetime.now(UTC))


async def get_inbox_item_for_task(
    session: AsyncSession, task_id: uuid.UUID
) -> ArtistInboxItemRead | None:
    task = await session.get(Task, task_id)
    if task is None:
        return None
    shot = await session.get(Shot, task.shot_id)
    if shot is None:
        return None
    project = await session.get(Project, shot.project_id)
    project_name = project.name if project is not None else ""
    return await build_task_inbox_item(session, task, shot, project_name)
