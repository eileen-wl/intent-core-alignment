"""Trusted internal ftrack Version/ReviewNote sync endpoints (Step 8C-3,
8C-4/8C-5).

All routes require ``auth.require_internal_sync_token`` -- never a
Human role header, and never accessible through one alone (see
``auth.py``'s module docstring). One request represents exactly one
AssetVersion or one Note; the locked contract names no batch shape, so
none is added here. ``GET /linked-shots`` (Step 8C-4/8C-5) is the
worker's safe boundary for discovering which Shots to sweep -- it never
exposes an unrelated ``ExternalEntityLink`` row (see
``service.list_linked_shots``).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from intent_core_contracts.api.ftrack_version_note_sync import (
    LinkedShotRead,
    ReviewNoteSyncCreate,
    VersionNoteSyncItemResult,
    VersionSyncCreate,
)
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.db import get_session
from intent_core_api.ftrack_version_note_sync import service
from intent_core_api.ftrack_version_note_sync.auth import require_internal_sync_token

router = APIRouter(
    prefix="/internal/sync",
    tags=["ftrack_version_note_sync"],
    dependencies=[Depends(require_internal_sync_token)],
)


@router.get("/linked-shots", response_model=list[LinkedShotRead])
async def linked_shots(session: AsyncSession = Depends(get_session)) -> list[LinkedShotRead]:
    return await service.list_linked_shots(session)


@router.post("/versions", response_model=VersionNoteSyncItemResult, status_code=201)
async def sync_version(
    payload: VersionSyncCreate, session: AsyncSession = Depends(get_session)
) -> VersionNoteSyncItemResult:
    return await service.sync_version(session, payload)


@router.post("/review-notes", response_model=VersionNoteSyncItemResult, status_code=201)
async def sync_review_note(
    payload: ReviewNoteSyncCreate, session: AsyncSession = Depends(get_session)
) -> VersionNoteSyncItemResult:
    return await service.sync_review_note(session, payload)
