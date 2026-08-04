from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from intent_core_contracts.api.cg_inbox import CgInboxItemRead, CgInboxRead
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.cg_inbox import service
from intent_core_api.db import get_session
from intent_core_api.workflow.exceptions import NotFoundError

router = APIRouter(prefix="/cg", tags=["cg_inbox"])


@router.get("/inbox", response_model=CgInboxRead)
async def get_cg_inbox(
    session: AsyncSession = Depends(get_session),
) -> CgInboxRead:
    return await service.list_inbox_items(session)


@router.get("/inbox/{task_id}", response_model=CgInboxItemRead)
async def get_cg_inbox_item(
    task_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> CgInboxItemRead:
    item = await service.get_inbox_item_for_task(session, task_id)
    if item is None:
        raise NotFoundError("Task not found")
    return item
