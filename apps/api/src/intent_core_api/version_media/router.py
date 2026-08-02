"""Context-scoped, read-only Version media resolution endpoints (Step
9B-4). Deliberately three separate, narrow routes -- one per role's own
already-locked context (VFX Shot-wide, CG/Artist Task-scoped) -- never
one unrestricted generic ``/versions/{id}/media`` lookup that would let
any authenticated role resolve media for a Version outside its own
context.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Response
from intent_core_contracts.api.version_media import VersionMediaRead
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.db import get_session
from intent_core_api.version_media import service
from intent_core_api.version_media.resolver import MediaResolver, get_media_resolver
from intent_core_api.workflow.actors import ActorContext, get_current_actor
from intent_core_api.workflow.exceptions import NotFoundError

vfx_router = APIRouter(prefix="/vfx", tags=["version_media"])
cg_router = APIRouter(prefix="/cg", tags=["version_media"])
artist_router = APIRouter(prefix="/artist", tags=["version_media"])

# Every resolved URL is transient, signed access material -- never
# cacheable by an intermediary or the browser itself (§5/§7 of the
# locked task).
_NO_STORE_HEADERS = {"Cache-Control": "no-store"}


@vfx_router.get(
    "/shots/{shot_id}/versions/{version_id}/media",
    response_model=VersionMediaRead,
)
async def get_vfx_version_media(
    shot_id: uuid.UUID,
    version_id: uuid.UUID,
    response: Response,
    actor: ActorContext = Depends(get_current_actor),
    session: AsyncSession = Depends(get_session),
    resolver: MediaResolver = Depends(get_media_resolver),
) -> VersionMediaRead:
    response.headers.update(_NO_STORE_HEADERS)
    media = await service.get_media_for_vfx_shot_version(
        session, actor, shot_id, version_id, resolver=resolver
    )
    if media is None:
        raise NotFoundError("Shot not found")
    return media


@cg_router.get(
    "/tasks/{task_id}/versions/{version_id}/media",
    response_model=VersionMediaRead,
)
async def get_cg_version_media(
    task_id: uuid.UUID,
    version_id: uuid.UUID,
    response: Response,
    actor: ActorContext = Depends(get_current_actor),
    session: AsyncSession = Depends(get_session),
    resolver: MediaResolver = Depends(get_media_resolver),
) -> VersionMediaRead:
    response.headers.update(_NO_STORE_HEADERS)
    media = await service.get_media_for_cg_task_version(
        session, actor, task_id, version_id, resolver=resolver
    )
    if media is None:
        raise NotFoundError("Task not found")
    return media


@artist_router.get(
    "/tasks/{task_id}/versions/{version_id}/media",
    response_model=VersionMediaRead,
)
async def get_artist_version_media(
    task_id: uuid.UUID,
    version_id: uuid.UUID,
    response: Response,
    actor: ActorContext = Depends(get_current_actor),
    session: AsyncSession = Depends(get_session),
    resolver: MediaResolver = Depends(get_media_resolver),
) -> VersionMediaRead:
    response.headers.update(_NO_STORE_HEADERS)
    media = await service.get_media_for_artist_task_version(
        session, actor, task_id, version_id, resolver=resolver
    )
    if media is None:
        raise NotFoundError("Task not found")
    return media
