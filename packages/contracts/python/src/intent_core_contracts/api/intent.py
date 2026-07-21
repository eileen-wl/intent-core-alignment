"""Request/response schemas for the ``intent`` module, WP-A slice A1.

Scope: ``IntentBrief`` (manual creation only) and CoreAnchor/
CoreAnchorRevision lifecycle (draft/update/confirm/reject). See
docs/DOMAIN_MODEL.md §5-6 and the approved WP-A implementation plan.
Execution Anchors, Constraint/VariationZone/DriftRisk/Reference/
OpenQuestion, and any workflow/audit read schemas belong to later WP-A
slices (A2-A4) and are intentionally not defined here.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from intent_core_contracts.actors import HumanRole

# A Brief/Anchor can originate from ftrack or the manual/file-based input
# path (docs/PRODUCT_SCOPE.md §15). A1 implements manual creation only;
# "ftrack" values are reserved for a later ingestion path.
RecordSource = Literal["manual", "ftrack"]

ActorKind = Literal["human", "agent", "system"]

# Mirrors intent_core_contracts.agents.envelope.AgentType.
AgentType = Literal[
    "core_agent",
    "vfx_supervisor_agent",
    "cg_supervisor_agent",
    "artist_agent",
    "cross_department",
]

CoreAnchorRevisionStatus = Literal["draft", "confirmed", "superseded", "rejected"]


class IntentBriefCreate(BaseModel):
    shot_id: UUID
    raw_text: str = Field(min_length=1)


class IntentBriefRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    shot_id: UUID
    raw_text: str
    source: RecordSource
    created_by_actor_kind: ActorKind
    created_by_actor_id: str
    created_by_human_role: HumanRole | None
    source_external_id: str | None
    created_at: datetime


class CoreAnchorRevisionDraftCreate(BaseModel):
    shot_objective: str | None = None
    emotional_tone: str | None = None
    visual_focus: str | None = None
    rhythm_intensity: str | None = None
    character_relationship: str | None = None
    narrative_priority: str | None = None
    core_summary: str | None = None


class CoreAnchorRevisionUpdate(BaseModel):
    shot_objective: str | None = None
    emotional_tone: str | None = None
    visual_focus: str | None = None
    rhythm_intensity: str | None = None
    character_relationship: str | None = None
    narrative_priority: str | None = None
    core_summary: str | None = None


class CoreAnchorRevisionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    core_anchor_id: UUID
    revision_number: int
    status: CoreAnchorRevisionStatus

    shot_objective: str | None
    emotional_tone: str | None
    visual_focus: str | None
    rhythm_intensity: str | None
    character_relationship: str | None
    narrative_priority: str | None
    core_summary: str | None

    created_by_actor_kind: ActorKind
    created_by_actor_id: str
    created_by_human_role: HumanRole | None
    created_by_agent_type: AgentType | None
    # WP-B1.5: for an agent-generated draft, this is the agents.AgentRun.id
    # that produced it -- the "agent_run_id" provenance field.
    created_by_agent_run_id: UUID | None
    # WP-B1.5: the ContextSnapshot this draft was generated from, when
    # agent-generated; null for human-authored drafts.
    context_snapshot_id: UUID | None

    confirmed_by_human_role: HumanRole | None
    confirmed_by_actor_id: str | None
    confirmed_at: datetime | None

    supersedes_revision_id: UUID | None

    created_at: datetime
    updated_at: datetime


class CoreAnchorRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    shot_id: UUID
    active_revision_id: UUID | None
    created_at: datetime
    updated_at: datetime


class AnchorConfirmRequest(BaseModel):
    rationale: str | None = None
    # ADR-0012: when true, the confirming endpoint also creates a
    # WritebackRecord and enqueues a Note-to-ftrack job for the linked
    # Shot. False (the default) preserves today's confirm-only behavior.
    request_write_back: bool = False


class AnchorRejectRequest(BaseModel):
    rationale: str | None = None
