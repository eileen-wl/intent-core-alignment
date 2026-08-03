from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from intent_core_contracts.api.anchor_context import AnchorContextRead
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.anchor_context import service
from intent_core_api.db import get_session
from intent_core_api.workflow.actors import ActorContext, get_current_actor, require_human_role

router = APIRouter(tags=["anchor_context"])


@router.get("/vfx/shots/{shot_id}/anchor-context", response_model=AnchorContextRead)
async def get_vfx_anchor_context(
    shot_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    actor: ActorContext = Depends(get_current_actor),
) -> AnchorContextRead:
    require_human_role(actor, frozenset({"vfx_supervisor"}))
    return await service.get_vfx_anchor_context(session, shot_id)


@router.get("/cg/tasks/{task_id}/anchor-context", response_model=AnchorContextRead)
async def get_cg_anchor_context(
    task_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    actor: ActorContext = Depends(get_current_actor),
) -> AnchorContextRead:
    require_human_role(actor, frozenset({"cg_supervisor"}))
    return await service.get_cg_anchor_context(session, task_id)


@router.get("/artist/tasks/{task_id}/anchor-context", response_model=AnchorContextRead)
async def get_artist_anchor_context(
    task_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    actor: ActorContext = Depends(get_current_actor),
) -> AnchorContextRead:
    require_human_role(actor, frozenset({"artist"}))
    return await service.get_artist_anchor_context(session, task_id)
