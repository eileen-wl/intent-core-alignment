from __future__ import annotations

from arq import create_pool
from arq.connections import RedisSettings
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.config import get_settings
from intent_core_api.db import get_session
from intent_core_api.ftrack_version_note_sync.auth import require_internal_sync_token
from intent_core_api.ops.models import WorkerHeartbeat
from intent_core_api.ops.schemas import WorkerHeartbeatRead, WorkerHeartbeatUpsert

# Protected by the same trusted-internal-caller mechanism as
# ftrack_version_note_sync/router.py (X-Internal-Sync-Token). Reused here
# rather than a second auth concept -- see auth.py's module docstring.
router = APIRouter(
    prefix="/internal", tags=["ops"], dependencies=[Depends(require_internal_sync_token)]
)

PING_HEARTBEAT_NAME = "worker-ping"


@router.post("/ping-worker", status_code=202)
async def ping_worker() -> dict[str, str]:
    settings = get_settings()
    redis = await create_pool(RedisSettings.from_dsn(settings.redis_url))
    try:
        job = await redis.enqueue_job("ping", PING_HEARTBEAT_NAME)
    finally:
        await redis.close()
    if job is None:
        raise HTTPException(status_code=503, detail="Could not enqueue ping job")
    return {"job_id": job.job_id}


@router.post("/reconcile-ftrack-shots", status_code=202)
async def reconcile_ftrack_shots() -> dict[str, str]:
    settings = get_settings()
    redis = await create_pool(RedisSettings.from_dsn(settings.redis_url))
    try:
        job = await redis.enqueue_job("reconcile_ftrack_shots")
    finally:
        await redis.close()
    if job is None:
        raise HTTPException(status_code=503, detail="Could not enqueue reconcile job")
    return {"job_id": job.job_id}


@router.post("/worker-heartbeat", response_model=WorkerHeartbeatRead)
async def record_worker_heartbeat(
    payload: WorkerHeartbeatUpsert, session: AsyncSession = Depends(get_session)
) -> WorkerHeartbeat:
    heartbeat = await session.get(WorkerHeartbeat, payload.name)
    if heartbeat is None:
        heartbeat = WorkerHeartbeat(name=payload.name, last_ping_at=payload.pinged_at)
        session.add(heartbeat)
    else:
        heartbeat.last_ping_at = payload.pinged_at
    await session.commit()
    await session.refresh(heartbeat)
    return heartbeat


@router.get("/worker-heartbeat/{name}", response_model=WorkerHeartbeatRead)
async def get_worker_heartbeat(
    name: str, session: AsyncSession = Depends(get_session)
) -> WorkerHeartbeat:
    heartbeat = await session.get(WorkerHeartbeat, name)
    if heartbeat is None:
        raise HTTPException(status_code=404, detail="No heartbeat recorded yet")
    return heartbeat
