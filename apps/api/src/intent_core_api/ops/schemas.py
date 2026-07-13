from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class WorkerHeartbeatUpsert(BaseModel):
    name: str
    pinged_at: datetime


class WorkerHeartbeatRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    last_ping_at: datetime
