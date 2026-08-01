from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from intent_core_contracts.api.artist_inbox import ArtistInboxItemRead, ArtistInboxRead
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.artist_inbox import service
from intent_core_api.db import get_session
from intent_core_api.workflow.exceptions import NotFoundError

router = APIRouter(prefix="/artist", tags=["artist_inbox"])


@router.get("/inbox", response_model=ArtistInboxRead)
async def get_artist_inbox(session: AsyncSession = Depends(get_session)) -> ArtistInboxRead:
    return await service.list_inbox_items(session)


@router.get("/inbox/{task_id}", response_model=ArtistInboxItemRead)
async def get_artist_inbox_item(
    task_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> ArtistInboxItemRead:
    item = await service.get_inbox_item_for_task(session, task_id)
    if item is None:
        raise NotFoundError("Task not found")
    return item
