"""Internal event payloads dispatched through the background queue.

Per docs/ARCHITECTURE.md §6, external changes and workflow transitions
become internal events carrying internal IDs. Downstream modules
depend only on this shape, never on raw ftrack payload structure
(docs/FTRACK_INTEGRATION.md §7).
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

EventType = Literal[
    "PROJECT_SYNCED",
    "SHOT_SYNCED",
    "TASK_SYNCED",
    "VERSION_PUBLISHED",
    "VERSION_UPDATED",
    "REVIEW_NOTE_ADDED",
    "CORE_ANCHOR_CONFIRMED",
    "EXECUTION_ANCHOR_CONFIRMED",
    "ASSESSMENT_COMPLETED",
    "HUMAN_GATE_OPENED",
    "DECISION_RECORDED",
    "STATUS_CHANGED",
    "ASSIGNMENT_CHANGED",
    "WRITEBACK_REQUESTED",
    "WRITEBACK_COMPLETED",
]


class InternalEvent(BaseModel):
    event_type: EventType
    entity_id: UUID
    occurred_at: datetime
    payload: dict[str, object] = Field(default_factory=dict)
