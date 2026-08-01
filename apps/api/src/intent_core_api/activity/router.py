from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from intent_core_contracts.api.activity import ShotActivityRead
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.activity import service
from intent_core_api.db import get_session

router = APIRouter(tags=["activity"])


@router.get("/shots/{shot_id}/activity", response_model=ShotActivityRead)
async def get_shot_activity(
    shot_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> ShotActivityRead:
    return await service.build_shot_activity(session, shot_id)
