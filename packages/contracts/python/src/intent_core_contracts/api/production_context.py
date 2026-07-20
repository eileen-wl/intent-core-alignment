"""Request/response schemas for the production_context module.

Scope: the smallest manual-input slice of the domain model (Project,
Shot, Task) needed for the first end-to-end skeleton, plus (ADR-0010)
the `external_id` an ftrack-sourced record carries so the
`/projects`/`/shots`/`/tasks` endpoints can upsert idempotently instead
of duplicating a record on repeat sync. See docs/DOMAIN_MODEL.md §3.
Sequence and Department entities remain out of scope until the ftrack
workspace mapping is further validated (docs/FTRACK_INTEGRATION.md
§16).
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

# A Project/Shot/Task can originate from ftrack or from the manual/file-based
# input path that PRODUCT_SCOPE.md §15 requires to exist independently of
# ftrack. Both paths must produce the same internal object types.
RecordSource = Literal["manual", "ftrack"]


def _check_external_id_matches_source(source: RecordSource, external_id: str | None) -> None:
    if source == "manual" and external_id is not None:
        raise ValueError("external_id must not be set when source='manual'")
    if source != "manual" and external_id is None:
        raise ValueError("external_id is required when source is not 'manual'")


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    source: RecordSource = "manual"
    # Required when source != "manual" (ADR-0010): identifies the
    # external (ftrack) record this create/upsert call corresponds to.
    external_id: str | None = None

    @model_validator(mode="after")
    def _validate_external_id(self) -> ProjectCreate:
        _check_external_id_matches_source(self.source, self.external_id)
        return self


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
    external_id: str | None = None

    @model_validator(mode="after")
    def _validate_external_id(self) -> ShotCreate:
        _check_external_id_matches_source(self.source, self.external_id)
        return self


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
    external_id: str | None = None

    @model_validator(mode="after")
    def _validate_external_id(self) -> TaskCreate:
        _check_external_id_matches_source(self.source, self.external_id)
        return self


class TaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    shot_id: UUID
    name: str
    department: str | None
    source: RecordSource
    created_at: datetime
    updated_at: datetime
