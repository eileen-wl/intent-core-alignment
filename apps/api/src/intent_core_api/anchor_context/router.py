from __future__ import annotations

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query
from intent_core_contracts.api.anchor_context import (
    AnchorContextRead,
    AnchorContextSummaryListRead,
)
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.anchor_context import service
from intent_core_api.db import get_session
from intent_core_api.workflow.actors import ActorContext, get_current_actor, require_human_role

router = APIRouter(tags=["anchor_context"])

SummaryScope = Literal["all", "triage", "ready", "waiting"]


@router.get("/vfx/anchor-contexts", response_model=AnchorContextSummaryListRead)
async def get_vfx_anchor_context_summaries(
    limit: int = Query(default=50, ge=1, le=200),
    scope: SummaryScope = Query(default="all"),
    project_external_id: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    actor: ActorContext = Depends(get_current_actor),
) -> AnchorContextSummaryListRead:
    require_human_role(actor, frozenset({"vfx_supervisor"}))
    return await service.list_anchor_context_summaries(
        session,
        role="vfx_supervisor",
        limit=limit,
        scope=scope,
        project_external_id=project_external_id,
    )


@router.get("/cg/anchor-contexts", response_model=AnchorContextSummaryListRead)
async def get_cg_anchor_context_summaries(
    limit: int = Query(default=50, ge=1, le=200),
    scope: SummaryScope = Query(default="all"),
    project_external_id: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    actor: ActorContext = Depends(get_current_actor),
) -> AnchorContextSummaryListRead:
    require_human_role(actor, frozenset({"cg_supervisor"}))
    return await service.list_anchor_context_summaries(
        session,
        role="cg_supervisor",
        limit=limit,
        scope=scope,
        project_external_id=project_external_id,
    )


@router.get("/artist/anchor-contexts", response_model=AnchorContextSummaryListRead)
async def get_artist_anchor_context_summaries(
    limit: int = Query(default=50, ge=1, le=200),
    scope: SummaryScope = Query(default="all"),
    project_external_id: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    actor: ActorContext = Depends(get_current_actor),
) -> AnchorContextSummaryListRead:
    require_human_role(actor, frozenset({"artist"}))
    return await service.list_anchor_context_summaries(
        session,
        role="artist",
        limit=limit,
        scope=scope,
        project_external_id=project_external_id,
    )


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
