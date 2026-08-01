from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from intent_core_contracts.api.task_activity import TaskActivityRead
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.db import get_session
from intent_core_api.task_activity import service

router = APIRouter(tags=["task_activity"])


@router.get("/tasks/{task_id}/activity", response_model=TaskActivityRead)
async def get_task_activity(
    task_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> TaskActivityRead:
    return await service.build_task_activity(session, task_id)
