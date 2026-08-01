from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from intent_core_contracts.api.dependencies import (
    EscalationCreate,
    TaskDependencyCreate,
    TaskDependencyRead,
)
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.cross_department import service
from intent_core_api.cross_department.models import TaskDependency
from intent_core_api.db import get_session
from intent_core_api.workflow.actors import ActorContext, get_current_actor

router = APIRouter(tags=["cross_department"])


@router.get("/tasks/{task_id}/dependencies", response_model=list[TaskDependencyRead])
async def list_task_dependencies(
    task_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> list[TaskDependency]:
    return await service.list_dependencies_for_task(session, task_id)


@router.post("/tasks/{task_id}/dependencies", response_model=TaskDependencyRead, status_code=201)
async def create_task_dependency(
    task_id: uuid.UUID,
    payload: TaskDependencyCreate,
    actor: ActorContext = Depends(get_current_actor),
    session: AsyncSession = Depends(get_session),
) -> TaskDependency:
    return await service.create_dependency(
        session,
        actor,
        task_id,
        kind=payload.kind,
        description=payload.description,
        severity=payload.severity,
        related_version_id=payload.related_version_id,
    )


@router.post(
    "/tasks/{task_id}/dependencies/{dependency_id}/acknowledge",
    response_model=TaskDependencyRead,
)
async def acknowledge_task_dependency(
    task_id: uuid.UUID,
    dependency_id: uuid.UUID,
    actor: ActorContext = Depends(get_current_actor),
    session: AsyncSession = Depends(get_session),
) -> TaskDependency:
    return await service.acknowledge_dependency(session, actor, dependency_id)


@router.post(
    "/tasks/{task_id}/dependencies/{dependency_id}/resolve",
    response_model=TaskDependencyRead,
)
async def resolve_task_dependency(
    task_id: uuid.UUID,
    dependency_id: uuid.UUID,
    actor: ActorContext = Depends(get_current_actor),
    session: AsyncSession = Depends(get_session),
) -> TaskDependency:
    return await service.resolve_dependency(session, actor, dependency_id)


@router.post("/tasks/{task_id}/escalate", response_model=TaskDependencyRead, status_code=201)
async def escalate_task(
    task_id: uuid.UUID,
    payload: EscalationCreate,
    actor: ActorContext = Depends(get_current_actor),
    session: AsyncSession = Depends(get_session),
) -> TaskDependency:
    return await service.create_escalation(
        session,
        actor,
        task_id,
        description=payload.description,
        related_version_id=payload.related_version_id,
    )
