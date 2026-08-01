"""Request/response schemas for the Artist Review Inbox read model (Step
7C-5).

Mirrors `api.cg_inbox`'s *shape* only -- Task-scoped, read-only, and its
own bounded five-state `current_focus` precedence (documented in
`intent_core_api.artist_inbox.current_focus`), since Artist's real
actionable surfaces (Artist guidance, Review Notes, dependencies) are
distinct from CG's (Execution Anchor confirmation, Version review).
Composes real, already-persisted Task/ExecutionAnchor/Version/ReviewNote/
ArtistAgentGuidance/TaskDependency state into one bounded row per Task --
no new mutation logic here.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from intent_core_contracts.api.production_context import RecordSource

ArtistCurrentFocusType = Literal[
    "guidance_outdated",
    "review_note_needs_response",
    "dependency_needs_attention",
    "guidance_available",
    "none",
]

ArtistExecutionAnchorState = Literal["none", "draft_pending", "confirmed"]
ArtistGuidanceState = Literal["none", "outdated", "current"]


class ArtistInboxCurrentFocusRead(BaseModel):
    focus_type: ArtistCurrentFocusType
    title: str
    explanation: str
    target_route: str
    primary_action_label: str | None
    actionable: bool


class ArtistInboxItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    task_id: UUID
    task_name: str
    department: str | None
    task_source: RecordSource

    shot_id: UUID
    shot_name: str
    project_id: UUID
    project_name: str

    execution_anchor_state: ArtistExecutionAnchorState
    active_execution_anchor_revision_id: UUID | None
    # The confirmed revision's `technical_boundaries` field -- the
    # closest single-text analogue Execution Anchor has to CoreAnchor's
    # `core_summary` (same convention as CgInboxItemRead). Read-only
    # context for the Artist, never editable from this workspace.
    active_execution_anchor_summary: str | None

    latest_version_id: UUID | None
    latest_version_name: str | None
    latest_version_number: int | None

    # Whether the newest ArtistAgentGuidance for the latest Version (if
    # any) still references the Task's current confirmed Execution
    # Anchor revision -- "outdated" only when real guidance exists and a
    # real newer confirmed revision now differs from what it cites.
    guidance_state: ArtistGuidanceState
    latest_guidance_id: UUID | None

    open_review_note_count: int
    open_dependency_count: int

    current_focus: ArtistInboxCurrentFocusRead

    # Deterministic sort key, ascending -- lower sorts first. Same
    # convention as CgInboxItemRead.sort_rank.
    sort_rank: int


class ArtistInboxRead(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    items: list[ArtistInboxItemRead]
    generated_at: datetime
