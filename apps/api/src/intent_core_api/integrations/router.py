from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from intent_core_contracts.api.integrations import (
    SyncCursorRead,
    SyncCursorUpsert,
    WritebackRecordRead,
    WritebackRecordStatusUpdate,
)
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.db import get_session
from intent_core_api.integrations.models import SyncCursor, WritebackRecord

router = APIRouter(prefix="/integrations", tags=["integrations"])


@router.get("/sync-cursor/{key}", response_model=SyncCursorRead)
async def get_sync_cursor(key: str, session: AsyncSession = Depends(get_session)) -> SyncCursor:
    cursor = await session.get(SyncCursor, key)
    if cursor is None:
        raise HTTPException(status_code=404, detail="No sync cursor recorded yet")
    return cursor


@router.put("/sync-cursor/{key}", response_model=SyncCursorRead)
async def upsert_sync_cursor(
    key: str, payload: SyncCursorUpsert, session: AsyncSession = Depends(get_session)
) -> SyncCursor:
    cursor = await session.get(SyncCursor, key)
    if cursor is None:
        cursor = SyncCursor(key=key, last_synced_at=payload.last_synced_at)
        session.add(cursor)
    else:
        cursor.last_synced_at = payload.last_synced_at
    await session.commit()
    await session.refresh(cursor)
    return cursor


@router.get("/writeback-records/{record_id}", response_model=WritebackRecordRead)
async def get_writeback_record(
    record_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> WritebackRecord:
    record = await session.get(WritebackRecord, record_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Writeback record not found")
    return record


@router.patch("/writeback-records/{record_id}", response_model=WritebackRecordRead)
async def update_writeback_record_status(
    record_id: uuid.UUID,
    payload: WritebackRecordStatusUpdate,
    session: AsyncSession = Depends(get_session),
) -> WritebackRecord:
    record = await session.get(WritebackRecord, record_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Writeback record not found")
    record.status = payload.status
    record.external_note_id = payload.external_note_id
    record.error = payload.error
    record.completed_at = datetime.now(UTC)
    await session.commit()
    await session.refresh(record)
    return record
