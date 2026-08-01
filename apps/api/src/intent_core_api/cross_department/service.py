"""TaskDependency lifecycle: record (dependency/conflict/escalation),
acknowledge, resolve. See `models.TaskDependency`'s module docstring for
what `kind` distinguishes.

Every mutation requires a human CG Supervisor actor -- enforced here,
not only in the UI (CLAUDE.md's "Permissions must be enforced in backend
logic"). Escalation always targets `escalated_to_role="vfx_supervisor"`,
the only real escalation target this Step defines.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.cross_department.models import TaskDependency
from intent_core_api.production_context.models import Shot, Task
from intent_core_api.workflow.actors import ActorContext, HumanRole, require_human_role
from intent_core_api.workflow.exceptions import ConflictError, NotFoundError

_CG_SUPERVISOR: frozenset[HumanRole] = frozenset({"cg_supervisor"})


def _utcnow() -> datetime:
    return datetime.now(UTC)


async def _get_task_or_404(session: AsyncSession, task_id: uuid.UUID) -> Task:
    task = await session.get(Task, task_id)
    if task is None:
        raise NotFoundError("Task not found")
    return task


async def create_dependency(
    session: AsyncSession,
    actor: ActorContext,
    task_id: uuid.UUID,
    *,
    kind: str,
    description: str,
    severity: str | None = None,
    related_version_id: uuid.UUID | None = None,
) -> TaskDependency:
    require_human_role(actor, _CG_SUPERVISOR)
    task = await _get_task_or_404(session, task_id)

    dependency = TaskDependency(
        project_id=(await _project_id_for_shot(session, task.shot_id)),
        shot_id=task.shot_id,
        task_id=task_id,
        related_version_id=related_version_id,
        kind=kind,
        status="open",
        description=description,
        severity=severity,
        created_by_actor_kind=actor.actor_kind,
        created_by_actor_id=actor.actor_id,
        created_by_human_role=actor.human_role,
    )
    session.add(dependency)
    await session.commit()
    await session.refresh(dependency)
    return dependency


async def create_escalation(
    session: AsyncSession,
    actor: ActorContext,
    task_id: uuid.UUID,
    *,
    description: str,
    related_version_id: uuid.UUID | None = None,
) -> TaskDependency:
    require_human_role(actor, _CG_SUPERVISOR)
    task = await _get_task_or_404(session, task_id)

    escalation = TaskDependency(
        project_id=(await _project_id_for_shot(session, task.shot_id)),
        shot_id=task.shot_id,
        task_id=task_id,
        related_version_id=related_version_id,
        kind="escalation",
        status="open",
        description=description,
        escalated_to_role="vfx_supervisor",
        created_by_actor_kind=actor.actor_kind,
        created_by_actor_id=actor.actor_id,
        created_by_human_role=actor.human_role,
    )
    session.add(escalation)
    await session.commit()
    await session.refresh(escalation)
    return escalation


async def _project_id_for_shot(session: AsyncSession, shot_id: uuid.UUID) -> uuid.UUID:
    shot = await session.get(Shot, shot_id)
    assert shot is not None  # Task -> Shot FK guarantees this
    return shot.project_id


async def list_dependencies_for_task(
    session: AsyncSession, task_id: uuid.UUID
) -> list[TaskDependency]:
    result = await session.execute(
        select(TaskDependency)
        .where(TaskDependency.task_id == task_id)
        .order_by(TaskDependency.created_at.desc())
    )
    return list(result.scalars().all())


async def _resolve_status(
    session: AsyncSession, actor: ActorContext, dependency_id: uuid.UUID, *, new_status: str
) -> TaskDependency:
    require_human_role(actor, _CG_SUPERVISOR)
    dependency = await session.get(TaskDependency, dependency_id)
    if dependency is None:
        raise NotFoundError("Dependency not found")
    if dependency.status == "resolved":
        raise ConflictError("This dependency has already been resolved")

    dependency.status = new_status
    if new_status == "resolved":
        dependency.resolved_by_actor_id = actor.actor_id
        dependency.resolved_by_human_role = actor.human_role
        dependency.resolved_at = _utcnow()

    await session.commit()
    await session.refresh(dependency)
    return dependency


async def acknowledge_dependency(
    session: AsyncSession, actor: ActorContext, dependency_id: uuid.UUID
) -> TaskDependency:
    return await _resolve_status(session, actor, dependency_id, new_status="acknowledged")


async def resolve_dependency(
    session: AsyncSession, actor: ActorContext, dependency_id: uuid.UUID
) -> TaskDependency:
    return await _resolve_status(session, actor, dependency_id, new_status="resolved")
