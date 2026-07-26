"""Request/response schemas for the ``intent`` module, WP-A slice A1,
plus the Step 1A Core Anchor semantic objects (Constraint/VariationZone/
DriftRisk/AnchorReference/OpenQuestion).

Scope: ``IntentBrief`` (manual creation only) and CoreAnchor/
CoreAnchorRevision lifecycle (draft/update/confirm/reject), including its
five ordered semantic-child collections. See docs/DOMAIN_MODEL.md §5-6
and the approved WP-A / Step 1A implementation plans. Execution Anchors
and any workflow/audit read schemas belong to other slices and are
intentionally not defined here.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

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


def _require_non_blank(value: str) -> str:
    if not value.strip():
        raise ValueError("must not be blank")
    return value


class ConstraintInput(BaseModel):
    content: str = Field(min_length=1)

    @field_validator("content")
    @classmethod
    def _content_not_blank(cls, value: str) -> str:
        return _require_non_blank(value)


class ConstraintRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    order_index: int
    content: str
    created_at: datetime


class VariationZoneInput(BaseModel):
    content: str = Field(min_length=1)

    @field_validator("content")
    @classmethod
    def _content_not_blank(cls, value: str) -> str:
        return _require_non_blank(value)


class VariationZoneRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    order_index: int
    content: str
    created_at: datetime


class DriftRiskInput(BaseModel):
    description: str = Field(min_length=1)

    @field_validator("description")
    @classmethod
    def _description_not_blank(cls, value: str) -> str:
        return _require_non_blank(value)


class DriftRiskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    order_index: int
    description: str
    created_at: datetime


class AnchorReferenceInput(BaseModel):
    label: str = Field(min_length=1)
    uri: str | None = None
    note: str | None = None

    @field_validator("label")
    @classmethod
    def _label_not_blank(cls, value: str) -> str:
        return _require_non_blank(value)


class AnchorReferenceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    order_index: int
    label: str
    uri: str | None
    note: str | None
    created_at: datetime


class OpenQuestionInput(BaseModel):
    question: str = Field(min_length=1)

    @field_validator("question")
    @classmethod
    def _question_not_blank(cls, value: str) -> str:
        return _require_non_blank(value)


class OpenQuestionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    order_index: int
    question: str
    created_at: datetime


class CoreAnchorRevisionDraftCreate(BaseModel):
    shot_objective: str | None = None
    emotional_tone: str | None = None
    visual_focus: str | None = None
    rhythm_intensity: str | None = None
    character_relationship: str | None = None
    narrative_priority: str | None = None
    core_summary: str | None = None

    # Step 1A: the five Core Anchor semantic-child collections. Order in
    # each input array becomes the persisted `order_index`.
    constraints: list[ConstraintInput] = Field(default_factory=list)
    variation_zones: list[VariationZoneInput] = Field(default_factory=list)
    drift_risks: list[DriftRiskInput] = Field(default_factory=list)
    references: list[AnchorReferenceInput] = Field(default_factory=list)
    open_questions: list[OpenQuestionInput] = Field(default_factory=list)


class CoreAnchorRevisionUpdate(BaseModel):
    shot_objective: str | None = None
    emotional_tone: str | None = None
    visual_focus: str | None = None
    rhythm_intensity: str | None = None
    character_relationship: str | None = None
    narrative_priority: str | None = None
    core_summary: str | None = None

    # Step 1A: each collection is independently optional -- omitted means
    # unchanged, an explicit `[]` means clear, a populated list means
    # fully replace. Distinguishing "omitted" from "explicit []" requires
    # the router to read this via `model_dump(exclude_unset=True)`, same
    # as every other field on this model already does.
    constraints: list[ConstraintInput] | None = None
    variation_zones: list[VariationZoneInput] | None = None
    drift_risks: list[DriftRiskInput] | None = None
    references: list[AnchorReferenceInput] | None = None
    open_questions: list[OpenQuestionInput] | None = None


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

    # Step 1B: set only when this draft was created via the explicit
    # "apply decomposition" action; null for every directly-generated or
    # human-authored draft, and for every revision that predates Step 1B.
    source_intent_decomposition_id: UUID | None

    created_at: datetime
    updated_at: datetime

    # Step 1A: always present, ordered by order_index; a revision with no
    # children of a given kind returns an empty array, never null.
    constraints: list[ConstraintRead]
    variation_zones: list[VariationZoneRead]
    drift_risks: list[DriftRiskRead]
    references: list[AnchorReferenceRead]
    open_questions: list[OpenQuestionRead]


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
