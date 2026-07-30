from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from intent_core_contracts.api.vfx_inbox import VfxInboxItemRead, VfxInboxRead
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.db import get_session
from intent_core_api.vfx_inbox import service
from intent_core_api.workflow.exceptions import NotFoundError

router = APIRouter(prefix="/vfx", tags=["vfx_inbox"])


@router.get("/inbox", response_model=VfxInboxRead)
async def get_vfx_inbox(session: AsyncSession = Depends(get_session)) -> VfxInboxRead:
    return await service.list_inbox_items(session)


@router.get("/inbox/{shot_id}", response_model=VfxInboxItemRead)
async def get_vfx_inbox_item(
    shot_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> VfxInboxItemRead:
    item = await service.get_inbox_item_for_shot(session, shot_id)
    if item is None:
        raise NotFoundError("Shot not found")
    return item
