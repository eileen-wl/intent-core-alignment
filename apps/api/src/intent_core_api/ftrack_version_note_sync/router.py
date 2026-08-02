"""Trusted internal ftrack Version/ReviewNote sync endpoints (Step 8C-3).

Both routes require ``auth.require_internal_sync_token`` -- never a
Human role header, and never accessible through one alone (see
``auth.py``'s module docstring). One request represents exactly one
AssetVersion or one Note; the locked contract names no batch shape, so
none is added here.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from intent_core_contracts.api.ftrack_version_note_sync import (
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
