from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from intent_core_contracts.api.artist_feedback_history import ArtistFeedbackHistoryRead
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.artist_feedback_history.service import build_task_feedback_history
from intent_core_api.db import get_session

router = APIRouter(tags=["artist_feedback_history"])


@router.get("/tasks/{task_id}/feedback-history", response_model=ArtistFeedbackHistoryRead)
async def get_task_feedback_history(
    task_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> ArtistFeedbackHistoryRead:
    return await build_task_feedback_history(session, task_id)
