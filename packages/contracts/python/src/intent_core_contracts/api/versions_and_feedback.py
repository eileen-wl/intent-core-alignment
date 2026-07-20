"""Request/response schemas for the ``versions_and_feedback`` module,
Step 4a.

Scope: ``Version`` (belongs to a Shot) and ``ReviewNote`` (belongs to a
Version), manual creation only -- mirrors ``api.intent``'s ``IntentBrief``
schemas exactly in shape and doc-comment style. ``AlignmentAssessment``
and any ftrack-sourced fields belong to a later slice and are
intentionally not defined here.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from intent_core_contracts.actors import HumanRole

# Same convention as api.production_context/api.intent: a Version or
# ReviewNote can originate from ftrack or the manual/file-based input
# path. This slice implements manual creation only; "ftrack" is reserved
# for a later, narrowly-scoped sync extension (not this slice -- see
# Step 4a's scope notes).
RecordSource = Literal["manual", "ftrack"]

ActorKind = Literal["human", "agent", "system"]


class VersionCreate(BaseModel):
    shot_id: UUID
    name: str = Field(min_length=1, max_length=200)
    version_number: int | None = None
    description: str = Field(min_length=1)


class VersionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    shot_id: UUID
    name: str
    version_number: int | None
    description: str
    source: RecordSource
    created_by_actor_kind: ActorKind
    created_by_actor_id: str
    created_by_human_role: HumanRole | None
    created_at: datetime


class ReviewNoteCreate(BaseModel):
    content: str = Field(min_length=1)


class ReviewNoteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    version_id: UUID
    content: str
    source: RecordSource
    created_by_actor_kind: ActorKind
    created_by_actor_id: str
    created_by_human_role: HumanRole | None
    created_at: datetime
