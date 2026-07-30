"""Request/response schemas for the integrations module.

Scope: `ExternalEntityLink`, the record connecting an internal
Project/Shot/Task to the external (ftrack) record it was synced from
(docs/GLOSSARY.md, ADR-0010). Read-only here -- no create/update
endpoint takes this shape directly; links are created as a side effect
of `production_context`'s idempotent-upsert endpoints (see
`ExternalSource`/`external_id` on ProjectCreate/ShotCreate/TaskCreate
in `api/production_context.py`).

Also `SyncCursor` (docs/DOMAIN_MODEL.md §10, ADR-0011): the last
successful sync point for one named reconciliation process (e.g.
`"ftrack_shot_reconciliation"`), read and advanced by
`services/worker`'s reconciliation job.

Also `WritebackRecord` (docs/DOMAIN_MODEL.md §10, ADR-0012): tracks one
outbound ftrack operation (currently: posting a Note), created by
`apps/api` with its target already resolved, and updated by
`services/worker`'s write-back job once it has attempted the write.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

# The first (and so far only) Workflow Connector (docs/PROJECT_CONTEXT.md
# §11), plus "demo": an ICAS-owned seeded Demo identity marker (Step 7C-1,
# docs/step-7/16_STEP_7C0D_...md §2.6/§6) -- used only for deterministic
# Demo scenario ownership/lookup on ExternalEntityLink, never presented as
# a real production integration, and never treated as "ftrack" by any
# ftrack-specific code path. Extend further only when a genuine new
# connector or ownership marker is added -- not preemptively.
ExternalSource = Literal["ftrack", "demo"]
LinkedEntityType = Literal["project", "shot", "task"]


class ExternalEntityLinkRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    entity_type: LinkedEntityType
    entity_id: UUID
    source: ExternalSource
    external_id: str
    created_at: datetime
    updated_at: datetime


class SyncCursorRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    key: str
    last_synced_at: datetime
    updated_at: datetime


class SyncCursorUpsert(BaseModel):
    last_synced_at: datetime


WritebackEntityType = Literal["core_anchor_revision"]
WritebackStatus = Literal["pending", "succeeded", "failed"]


class WritebackRecordRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    entity_type: WritebackEntityType
    entity_id: UUID
    source: ExternalSource
    target_external_id: str
    content: str
    status: WritebackStatus
    external_note_id: str | None
    error: str | None
    created_at: datetime
    completed_at: datetime | None


class WritebackRecordStatusUpdate(BaseModel):
    status: WritebackStatus
    external_note_id: str | None = None
    error: str | None = None
