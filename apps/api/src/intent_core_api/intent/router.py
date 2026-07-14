from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from intent_core_contracts.api.intent import (
    AnchorConfirmRequest,
    AnchorRejectRequest,
    CoreAnchorRead,
    CoreAnchorRevisionDraftCreate,
    CoreAnchorRevisionRead,
    CoreAnchorRevisionUpdate,
    IntentBriefCreate,
    IntentBriefRead,
)
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.db import get_session
from intent_core_api.intent import brief_service, core_anchor_service
from intent_core_api.intent.models import CoreAnchor, CoreAnchorRevision, IntentBrief
from intent_core_api.workflow.actors import ActorContext, get_current_actor
from intent_core_api.workflow.exceptions import NotFoundError

router = APIRouter(prefix="/intent", tags=["intent"])


@router.post("/briefs", response_model=IntentBriefRead, status_code=201)
async def create_brief(
    payload: IntentBriefCreate,
    actor: ActorContext = Depends(get_current_actor),
    session: AsyncSession = Depends(get_session),
) -> IntentBrief:
    return await brief_service.create_brief(session, actor, payload.shot_id, payload.raw_text)


@router.get("/briefs/{brief_id}", response_model=IntentBriefRead)
async def get_brief(
    brief_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> IntentBrief:
    brief = await brief_service.get_brief(session, brief_id)
    if brief is None:
        raise NotFoundError("Intent brief not found")
    return brief


@router.get("/shots/{shot_id}/briefs", response_model=list[IntentBriefRead])
async def list_briefs(
    shot_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> list[IntentBrief]:
    return await brief_service.list_briefs_for_shot(session, shot_id)


@router.post(
    "/shots/{shot_id}/core-anchor/drafts", response_model=CoreAnchorRevisionRead, status_code=201
)
async def create_core_anchor_draft(
    shot_id: uuid.UUID,
    payload: CoreAnchorRevisionDraftCreate,
    actor: ActorContext = Depends(get_current_actor),
    session: AsyncSession = Depends(get_session),
) -> CoreAnchorRevision:
    return await core_anchor_service.create_draft_revision(
        session, actor, shot_id, payload.model_dump()
    )


@router.get("/shots/{shot_id}/core-anchor", response_model=CoreAnchorRead)
async def get_core_anchor(
    shot_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> CoreAnchor:
    anchor = await core_anchor_service.get_core_anchor_for_shot(session, shot_id)
    if anchor is None:
        raise NotFoundError("Core anchor not found for shot")
    return anchor


@router.get("/core-anchor-revisions/{revision_id}", response_model=CoreAnchorRevisionRead)
async def get_core_anchor_revision(
    revision_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> CoreAnchorRevision:
    revision = await core_anchor_service.get_revision(session, revision_id)
    if revision is None:
        raise NotFoundError("Core anchor revision not found")
    return revision


@router.patch("/core-anchor-revisions/{revision_id}", response_model=CoreAnchorRevisionRead)
async def update_core_anchor_revision(
    revision_id: uuid.UUID,
    payload: CoreAnchorRevisionUpdate,
    actor: ActorContext = Depends(get_current_actor),
    session: AsyncSession = Depends(get_session),
) -> CoreAnchorRevision:
    changes = payload.model_dump(exclude_unset=True)
    return await core_anchor_service.update_draft_revision(session, actor, revision_id, changes)


@router.post("/core-anchor-revisions/{revision_id}/confirm", response_model=CoreAnchorRevisionRead)
async def confirm_core_anchor_revision(
    revision_id: uuid.UUID,
    payload: AnchorConfirmRequest,
    actor: ActorContext = Depends(get_current_actor),
    session: AsyncSession = Depends(get_session),
) -> CoreAnchorRevision:
    return await core_anchor_service.confirm_revision(
        session, actor, revision_id, payload.rationale
    )


@router.post("/core-anchor-revisions/{revision_id}/reject", response_model=CoreAnchorRevisionRead)
async def reject_core_anchor_revision(
    revision_id: uuid.UUID,
    payload: AnchorRejectRequest,
    actor: ActorContext = Depends(get_current_actor),
    session: AsyncSession = Depends(get_session),
) -> CoreAnchorRevision:
    return await core_anchor_service.reject_revision(session, actor, revision_id, payload.rationale)
