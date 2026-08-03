"""Derived, role-scoped Anchor Context read contracts (Package A).

These models project existing Anchor, HumanGate, IntentSignal, Version,
Guidance, and Current-focus state. They are read-only and introduce no new
authority or persistence.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from intent_core_contracts.actors import HumanRole

AnchorContextRole = Literal["vfx_supervisor", "cg_supervisor", "artist"]
AnchorLifecycleState = Literal["missing", "draft", "confirmed"]
ExecutionContextState = Literal[
    "missing",
    "draft",
    "pending",
    "current",
    "outdated",
    "relationship_unavailable",
]
AnchorDraftSource = Literal[
    "agent_proposed",
    "human_created",
    "copied_from_prior_revision",
    "demo_fixture",
    "unknown",
]
AnchorAttentionLevel = Literal["low", "medium", "high", "not_assessed"]
AnchorGuidanceState = Literal["current", "outdated", "missing", "unavailable"]


class CoreAnchorContextRead(BaseModel):
    exists: bool
    lifecycle_state: AnchorLifecycleState
    confirmed_revision_id: UUID | None
    confirmed_revision_number: int | None
    direction_summary: str | None
    must_preserve: str | None
    allowed_variation: str | None
    confirmed_by_human_role: HumanRole | None
    confirmed_by_actor_id: str | None
    link_target: str | None
    newer_draft_exists: bool
    pending_human_gate_exists: bool
    draft_revision_number: int | None


class ExecutionAnchorContextRead(BaseModel):
    exists: bool
    department: str | None
    lifecycle_state: AnchorLifecycleState
    context_state: ExecutionContextState
    confirmed_revision_id: UUID | None
    confirmed_revision_number: int | None
    direction_summary: str | None
    execution_boundary: str | None
    allowed_refinement: str | None
    based_on_core_anchor_revision_id: UUID | None
    based_on_core_anchor_revision_number: int | None
    upstream_relationship_available: bool
    confirmed_by_human_role: HumanRole | None
    confirmed_by_actor_id: str | None
    link_target: str | None
    draft_revision_number: int | None
    draft_source: AnchorDraftSource | None


class AnchorAttentionContextRead(BaseModel):
    level: AnchorAttentionLevel
    summary: str | None
    review_requirement: str
    source_assessment_id: UUID | None
    source_signal_id: UUID | None
    assessed_at: datetime | None
    link_target: str | None


class AnchorVersionContextRead(BaseModel):
    version_id: UUID | None
    name: str | None
    version_number: int | None
    link_target: str | None


class AnchorNextActionRead(BaseModel):
    title: str
    why_now: str
    downstream_effect: str
    target_route: str | None
    action_label: str | None
    executable: bool


class AnchorContextRead(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    role: AnchorContextRole
    shot_id: UUID
    task_id: UUID | None
    core_anchor: CoreAnchorContextRead
    execution_anchor: ExecutionAnchorContextRead | None
    attention: AnchorAttentionContextRead
    current_version: AnchorVersionContextRead
    guidance_state: AnchorGuidanceState
    open_vfx_escalation: bool
    next_action: AnchorNextActionRead
