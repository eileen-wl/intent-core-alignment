"""CG Review Inbox read-model service (Step 7C-4).

Composes real, already-persisted Task/Shot/Project/ExecutionAnchor/
HumanGate/CGSupervisorReview/TaskDependency/Version state into one
bounded ``CgInboxItemRead`` per Task -- no new mutation logic, no
notification/read state, no fabricated metric. Mirrors
``vfx_inbox.service``'s per-item query shape (one bounded set of queries
per Task, no cross-Task batching), not its Shot-specific content.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from intent_core_contracts.api.cg_inbox import CgInboxItemRead, CgInboxRead
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.cg_inbox.current_focus import (
    TaskFocusInputs,
    derive_current_focus,
    sort_rank_for_focus_type,
)
from intent_core_api.cross_department.models import TaskDependency
from intent_core_api.intent.models import (
    CGSupervisorReview,
    ExecutionAnchor,
    ExecutionAnchorRevision,
    HumanGate,
)
from intent_core_api.production_context.models import Project, Shot, Task
from intent_core_api.versions_and_feedback.models import Version


@dataclass(frozen=True)
class _TaskRelatedData:
    execution_anchor: ExecutionAnchor | None
    active_revision: ExecutionAnchorRevision | None
    pending_gate_id: uuid.UUID | None
    draft_revision_without_gate: bool
    open_dependency_count: int
    dependency_needs_attention: bool
    latest_version: Version | None
    version_review_available: bool


async def _load_task_related_data(
    session: AsyncSession, task_id: uuid.UUID, shot_id: uuid.UUID
) -> _TaskRelatedData:
    execution_anchor = await session.scalar(
        select(ExecutionAnchor).where(ExecutionAnchor.task_id == task_id)
    )

    active_revision: ExecutionAnchorRevision | None = None
    pending_gate_id: uuid.UUID | None = None
    draft_revision_without_gate = False

    if execution_anchor is not None:
        if execution_anchor.active_revision_id is not None:
            active_revision = await session.get(
                ExecutionAnchorRevision, execution_anchor.active_revision_id
            )

        revisions = list(
            (
                await session.execute(
                    select(ExecutionAnchorRevision).where(
                        ExecutionAnchorRevision.execution_anchor_id == execution_anchor.id
                    )
                )
            )
            .scalars()
            .all()
        )
        revision_ids = [revision.id for revision in revisions]
        gates: list[HumanGate] = []
        if revision_ids:
            gates = list(
                (
                    await session.execute(
                        select(HumanGate).where(
                            HumanGate.execution_anchor_revision_id.in_(revision_ids)
                        )
                    )
                )
                .scalars()
                .all()
            )
        gated_revision_ids = {gate.execution_anchor_revision_id for gate in gates}
        for gate in gates:
            if gate.status == "pending":
                pending_gate_id = gate.id
        if pending_gate_id is None:
            draft_revision_without_gate = any(
                revision.status == "draft" and revision.id not in gated_revision_ids
                for revision in revisions
            )

    dependency_rows = list(
        (await session.execute(select(TaskDependency).where(TaskDependency.task_id == task_id)))
        .scalars()
        .all()
    )
    open_dependency_count = sum(
        1
        for dependency in dependency_rows
        if dependency.kind in ("dependency", "conflict") and dependency.status != "resolved"
    )
    dependency_needs_attention = any(
        dependency.kind in ("dependency", "conflict") and dependency.status == "open"
        for dependency in dependency_rows
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

    version_review_available = False
    if (
        active_revision is not None
        and active_revision.status == "confirmed"
        and latest_version is not None
    ):
        existing_review = await session.scalar(
            select(CGSupervisorReview.id).where(
                CGSupervisorReview.execution_anchor_revision_id == active_revision.id
            )
        )
        version_review_available = existing_review is None

    return _TaskRelatedData(
        execution_anchor=execution_anchor,
        active_revision=active_revision,
        pending_gate_id=pending_gate_id,
        draft_revision_without_gate=draft_revision_without_gate,
        open_dependency_count=open_dependency_count,
        dependency_needs_attention=dependency_needs_attention,
        latest_version=latest_version,
        version_review_available=version_review_available,
    )


def _execution_anchor_state(data: _TaskRelatedData) -> str:
    if data.execution_anchor is None:
        return "none"
    if data.active_revision is not None and data.active_revision.status == "confirmed":
        return "confirmed"
    if (
        data.execution_anchor.active_revision_id is not None
        or data.pending_gate_id is not None
        or data.draft_revision_without_gate
    ):
        return "draft_pending"
    return "none"


async def build_task_inbox_item(
    session: AsyncSession, task: Task, shot: Shot, project_name: str
) -> CgInboxItemRead:
    data = await _load_task_related_data(session, task.id, shot.id)

    inputs = TaskFocusInputs(
        task_id=task.id,
        pending_execution_gate_id=data.pending_gate_id,
        draft_revision_without_gate_exists=data.draft_revision_without_gate,
        dependency_needs_attention=data.dependency_needs_attention,
        version_review_available=data.version_review_available,
    )
    current_focus = derive_current_focus(inputs)

    relevant_timestamp = task.created_at
    bucket = sort_rank_for_focus_type(current_focus.focus_type)
    ordinal = -int(relevant_timestamp.timestamp() * 1_000_000) if relevant_timestamp else 0

    return CgInboxItemRead(
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
        pending_human_gate_id=data.pending_gate_id,
        latest_version_id=data.latest_version.id if data.latest_version else None,
        latest_version_name=data.latest_version.name if data.latest_version else None,
        latest_version_number=(data.latest_version.version_number if data.latest_version else None),
        open_dependency_count=data.open_dependency_count,
        current_focus=current_focus,
        sort_rank=bucket * 1_000_000_000_000 + ordinal,
    )


async def list_inbox_items(session: AsyncSession) -> CgInboxRead:
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
    return CgInboxRead(items=items, generated_at=datetime.now(UTC))


async def get_inbox_item_for_task(
    session: AsyncSession, task_id: uuid.UUID
) -> CgInboxItemRead | None:
    task = await session.get(Task, task_id)
    if task is None:
        return None
    shot = await session.get(Shot, task.shot_id)
    if shot is None:
        return None
    project = await session.get(Project, shot.project_id)
    project_name = project.name if project is not None else ""
    return await build_task_inbox_item(session, task, shot, project_name)
