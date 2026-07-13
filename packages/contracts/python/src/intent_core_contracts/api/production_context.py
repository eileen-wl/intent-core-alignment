"""Request/response schemas for the production_context module.

Scope: the smallest manual-input slice of the domain model (Project,
Shot, Task) needed for the first end-to-end skeleton. See
docs/DOMAIN_MODEL.md §3. Sequence, Department entities, and ftrack
sync fields are intentionally out of scope until the ftrack workspace
mapping is validated (docs/FTRACK_INTEGRATION.md §16).
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

# A Project/Shot/Task can originate from ftrack or from the manual/file-based
# input path that PRODUCT_SCOPE.md §15 requires to exist independently of
# ftrack. Both paths must produce the same internal object types.
RecordSource = Literal["manual", "ftrack"]


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    source: RecordSource = "manual"


class ProjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    source: RecordSource
    created_at: datetime
    updated_at: datetime


class ShotCreate(BaseModel):
    project_id: UUID
    name: str = Field(min_length=1, max_length=200)
    source: RecordSource = "manual"


class ShotRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    name: str
    source: RecordSource
    created_at: datetime
    updated_at: datetime


class TaskCreate(BaseModel):
    shot_id: UUID
    name: str = Field(min_length=1, max_length=200)
    # Free text, not an enum: department/hierarchy names must be
    # configurable per workspace (docs/DOMAIN_MODEL.md §3).
    department: str | None = Field(default=None, max_length=100)
    source: RecordSource = "manual"


class TaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    shot_id: UUID
    name: str
    department: str | None
    source: RecordSource
    created_at: datetime
    updated_at: datetime
