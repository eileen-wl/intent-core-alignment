"""Request/response schemas for the ``versions_and_feedback`` module,
Step 4a.

Scope: ``Version`` (belongs to a Shot) and ``ReviewNote`` (belongs to a
Version), manual creation only -- mirrors ``api.intent``'s ``IntentBrief``
schemas exactly in shape and doc-comment style.

``VersionCreate``/``ReviewNoteCreate`` (the public manual-create
contracts) are deliberately left untouched by Step 8C-2
(docs/step-8/02_STEP_8B_VERSION_NOTE_SYNC_CONTRACT.md §8, ADR-0014
Decision 3): they must never accept ``source``, ``external_id``,
``task_id``, ``source_created_at``, or either ``external_author_*``
field, so the public/manual creation path can never claim ftrack
provenance. ``VersionRead``/``ReviewNoteRead`` gain read-only,
already-nullable-at-the-database-layer sync metadata fields below,
since a client only ever *observes* these, never sets them through this
module's endpoints. The trusted internal sync payload contracts that
*can* set them (for a not-yet-implemented endpoint) live separately in
``api.ftrack_version_note_sync``, not here.
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
    # extra="forbid" (matches the existing precedent in
    # api.intent_decomposition.CoreAnchorDraftFromDecompositionRequest):
    # a client cannot smuggle source/external_id/task_id/
    # source_created_at/external_author_* through this public manual-
    # create endpoint -- they are silently-ignored-by-default in
    # Pydantic v2 otherwise, which would be a real gap given this
    # endpoint's own explicit boundary decision (ADR-0014 Decision 3).
    model_config = ConfigDict(extra="forbid")

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
    # Step 8C-1/8C-2 (docs/step-8/02_STEP_8B_VERSION_NOTE_SYNC_CONTRACT.md
    # §13, ADR-0014): null for every manually-created Version, populated
    # only by a future ftrack sync. Never an ExternalEntityLink internal
    # id -- task_id is the same kind of ordinary domain FK shot_id
    # already is, resolved server-side, never client-supplied here.
    # default=None (not just "| None"): from_attributes=True always
    # reads the real ORM value regardless of default, so this has no
    # effect on any real API response -- it only keeps the generated
    # OpenAPI/TypeScript key optional rather than required, so existing
    # generated-contract consumers built before this field existed
    # don't need every call site updated just to add it.
    task_id: UUID | None = None
    source_created_at: datetime | None = None
    external_author_id: str | None = None
    external_author_name: str | None = None


class ReviewNoteCreate(BaseModel):
    # extra="forbid" -- same rationale as VersionCreate above.
    model_config = ConfigDict(extra="forbid")

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
    # Step 8C-1/8C-2, same meaning and same default=None rationale as on
    # VersionRead above.
    source_created_at: datetime | None = None
    external_author_id: str | None = None
    external_author_name: str | None = None
