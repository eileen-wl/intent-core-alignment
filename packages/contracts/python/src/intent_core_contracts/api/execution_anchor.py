"""Request/response schemas for the ``intent`` module's Execution Anchor
lifecycle, WP-A slice A2.

Scope: ExecutionAnchor/ExecutionAnchorRevision (draft/update/confirm/
reject). See docs/DOMAIN_MODEL.md §5-6 and the approved WP-A2 plan.
Confirm/reject request bodies are shared with the Core Anchor lifecycle
(``AnchorConfirmRequest``/``AnchorRejectRequest`` in ``api.intent`` -- both
are just an optional rationale string, no need to duplicate them here).
Constraint/VariationZone/DriftRisk/Reference/OpenQuestion and any workflow/
audit read schemas belong to slice A4 and are not defined here.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from intent_core_contracts.actors import HumanRole

ActorKind = Literal["human", "agent", "system"]

# Mirrors intent_core_contracts.agents.envelope.AgentType.
AgentType = Literal[
    "core_agent",
    "vfx_supervisor_agent",
    "cg_supervisor_agent",
    "artist_agent",
    "cross_department",
]

ExecutionAnchorRevisionStatus = Literal["draft", "confirmed", "superseded", "rejected"]


class ExecutionAnchorRevisionDraftCreate(BaseModel):
    technical_boundaries: str | None = None
    parameter_ranges: str | None = None
    delivery_conditions: str | None = None
    production_ready_criteria: str | None = None
    downstream_dependencies: str | None = None
    publish_requirements: str | None = None
    allowed_refinements: str | None = None
    escalation_conditions: str | None = None


class ExecutionAnchorRevisionUpdate(BaseModel):
    technical_boundaries: str | None = None
    parameter_ranges: str | None = None
    delivery_conditions: str | None = None
    production_ready_criteria: str | None = None
    downstream_dependencies: str | None = None
    publish_requirements: str | None = None
    allowed_refinements: str | None = None
    escalation_conditions: str | None = None


class ExecutionAnchorRevisionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    execution_anchor_id: UUID
    core_anchor_revision_id: UUID
    revision_number: int
    status: ExecutionAnchorRevisionStatus

    technical_boundaries: str | None
    parameter_ranges: str | None
    delivery_conditions: str | None
    production_ready_criteria: str | None
    downstream_dependencies: str | None
    publish_requirements: str | None
    allowed_refinements: str | None
    escalation_conditions: str | None

    created_by_actor_kind: ActorKind
    created_by_actor_id: str
    created_by_human_role: HumanRole | None
    created_by_agent_type: AgentType | None
    created_by_agent_run_id: UUID | None

    confirmed_by_human_role: HumanRole | None
    confirmed_by_actor_id: str | None
    confirmed_at: datetime | None

    supersedes_revision_id: UUID | None

    created_at: datetime
    updated_at: datetime


class ExecutionAnchorRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    task_id: UUID
    active_revision_id: UUID | None
    is_stale: bool
    created_at: datetime
    updated_at: datetime
