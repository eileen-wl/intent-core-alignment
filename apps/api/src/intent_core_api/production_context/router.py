from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from intent_core_contracts.api.production_context import (
    ProjectCreate,
    ProjectRead,
    ShotCreate,
    ShotRead,
    TaskCreate,
    TaskRead,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.db import get_session
from intent_core_api.production_context.models import Project, Shot, Task

router = APIRouter(tags=["production_context"])


@router.post("/projects", response_model=ProjectRead, status_code=201)
async def create_project(
    payload: ProjectCreate, session: AsyncSession = Depends(get_session)
) -> Project:
    project = Project(name=payload.name, source=payload.source)
    session.add(project)
    await session.commit()
    await session.refresh(project)
    return project


@router.get("/projects", response_model=list[ProjectRead])
async def list_projects(session: AsyncSession = Depends(get_session)) -> list[Project]:
    result = await session.execute(select(Project).order_by(Project.created_at))
    return list(result.scalars().all())


@router.post("/shots", response_model=ShotRead, status_code=201)
async def create_shot(payload: ShotCreate, session: AsyncSession = Depends(get_session)) -> Shot:
    project = await session.get(Project, payload.project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    shot = Shot(project_id=payload.project_id, name=payload.name, source=payload.source)
    session.add(shot)
    await session.commit()
    await session.refresh(shot)
    return shot


@router.get("/shots", response_model=list[ShotRead])
async def list_shots(session: AsyncSession = Depends(get_session)) -> list[Shot]:
    result = await session.execute(select(Shot).order_by(Shot.created_at))
    return list(result.scalars().all())


@router.get("/shots/{shot_id}", response_model=ShotRead)
async def get_shot(shot_id: uuid.UUID, session: AsyncSession = Depends(get_session)) -> Shot:
    shot = await session.get(Shot, shot_id)
    if shot is None:
        raise HTTPException(status_code=404, detail="Shot not found")
    return shot


@router.post("/tasks", response_model=TaskRead, status_code=201)
async def create_task(payload: TaskCreate, session: AsyncSession = Depends(get_session)) -> Task:
    shot = await session.get(Shot, payload.shot_id)
    if shot is None:
        raise HTTPException(status_code=404, detail="Shot not found")
    task = Task(
        shot_id=payload.shot_id,
        name=payload.name,
        department=payload.department,
        source=payload.source,
    )
    session.add(task)
    await session.commit()
    await session.refresh(task)
    return task


@router.get("/tasks", response_model=list[TaskRead])
async def list_tasks(session: AsyncSession = Depends(get_session)) -> list[Task]:
    result = await session.execute(select(Task).order_by(Task.created_at))
    return list(result.scalars().all())
