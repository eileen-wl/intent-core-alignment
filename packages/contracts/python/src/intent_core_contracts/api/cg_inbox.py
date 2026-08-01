"""Request/response schemas for the CG Review Inbox read model (Step 7C-4).

Mirrors `api.vfx_inbox`'s *shape* only -- Task-scoped instead of
Shot-scoped, and its own bounded five-state `current_focus` precedence
(documented in `intent_core_api.cg_inbox.current_focus`), since no
CG-equivalent locked IA doc exists the way VFX's did. Read-only:
composes real, already-persisted Task/ExecutionAnchor/HumanGate/
TaskDependency/Version state into one bounded row per Task -- no new
mutation logic here.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from intent_core_contracts.api.production_context import RecordSource

CgCurrentFocusType = Literal[
    "execution_anchor_gate_pending",
    "execution_anchor_draft_needs_review",
    "dependency_needs_attention",
    "version_review_available",
    "none",
]

ExecutionAnchorState = Literal["none", "draft_pending", "confirmed"]


class CgInboxCurrentFocusRead(BaseModel):
    focus_type: CgCurrentFocusType
    title: str
    explanation: str
    target_route: str
    primary_action_label: str | None
    actionable: bool


class CgInboxItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    task_id: UUID
    task_name: str
    department: str | None
    task_source: RecordSource

    shot_id: UUID
    shot_name: str
    project_id: UUID
    project_name: str

    execution_anchor_state: ExecutionAnchorState
    active_execution_anchor_revision_id: UUID | None
    # The confirmed revision's `technical_boundaries` field -- the
    # closest single-text analogue Execution Anchor has to CoreAnchor's
    # `core_summary` (no dedicated summary field exists on
    # ExecutionAnchorRevision). Never a synthesized/fabricated summary.
    active_execution_anchor_summary: str | None
    pending_human_gate_id: UUID | None

    latest_version_id: UUID | None
    latest_version_name: str | None
    latest_version_number: int | None

    open_dependency_count: int

    current_focus: CgInboxCurrentFocusRead

    # Deterministic sort key, ascending -- lower sorts first. Same
    # convention as VfxInboxItemRead.sort_rank.
    sort_rank: int


class CgInboxRead(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    items: list[CgInboxItemRead]
    generated_at: datetime
