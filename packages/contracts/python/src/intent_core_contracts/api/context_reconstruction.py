"""Request/response schemas for the Core Agent ``context_reconstruction``
capability (Step 1C).

``ContextReconstructionOutput`` is the provider's structured output
contract -- a model-generated *interpretation* of the exact local facts
recorded in one ``ContextSnapshot``, distinct from that snapshot itself
(see ``agents/context_reconstruction_service.py``'s module docstring for
the "ContextSnapshot != Context Reconstruction" distinction). Every
``ContextReconstructionItem`` must cite at least one piece of concrete
evidence already present in the snapshot -- this capability must never
state an unsupported fact, and it must never judge whether a Version is
aligned, drifting, or should pass review (that is Alignment Assessment's
job, not this one's).

``ContextReconstructionRead`` is the persisted, immutable API read shape.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

# Bounded to the record kinds the ContextSnapshot builder
# (agents/context_reconstruction_service.py) actually places into the
# snapshot payload -- an evidence reference must always be traceable back
# to one of these, never a source_type the snapshot could not have
# supplied.
ContextEvidenceSourceType = Literal[
    "shot",
    "intent_brief",
    "intent_decomposition",
    "core_anchor_revision",
    "constraint",
    "variation_zone",
    "drift_risk",
    "anchor_reference",
    "open_question",
    "execution_anchor_revision",
    "decision",
    "version",
    "review_note",
]


def _require_non_blank(value: str) -> str:
    if not value.strip():
        raise ValueError("must not be blank")
    return value


def _require_non_blank_items(values: list[str]) -> list[str]:
    for value in values:
        if not value.strip():
            raise ValueError("list items must not be blank")
    return values


class ContextEvidenceReference(BaseModel):
    source_type: ContextEvidenceSourceType
    source_id: str = Field(min_length=1)
    label: str = Field(min_length=1)

    @field_validator("label")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        return _require_non_blank(value)


class ContextReconstructionItem(BaseModel):
    summary: str = Field(min_length=1)
    rationale: str = Field(min_length=1)
    # Every reconstructed conclusion must be evidence-backed -- an empty
    # list would mean an unsupported fact, which this capability must
    # never produce.
    evidence: list[ContextEvidenceReference] = Field(min_length=1)

    @field_validator("summary", "rationale")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        return _require_non_blank(value)


class ContextReconstructionOutput(BaseModel):
    context_summary: str = Field(min_length=1)
    # Reconstructs the source IntentBrief and IntentDecomposition intent.
    original_intent: ContextReconstructionItem
    # Reconstructs the current active Core Anchor direction when one
    # exists; otherwise clearly states that no Core Anchor direction has
    # yet been established (still evidence-backed, e.g. citing the Shot
    # itself as evidence that no Core Anchor row exists for it).
    current_creative_direction: ContextReconstructionItem
    # Summarizes existing Execution Anchor/task-level context without
    # evaluating quality.
    execution_context: ContextReconstructionItem
    # Meaningful recorded human Decisions that shaped the current state.
    # Always explicitly supplied by every generator (an empty list is a
    # real, meaningful value here, e.g. "no Decisions recorded yet") --
    # required, not defaulted, so the OpenAPI/generated-TS shape never
    # marks it optional for an already-persisted, immutable record.
    key_decisions: list[ContextReconstructionItem]
    # Current Core Anchor Constraints and relevant execution constraints.
    active_constraints: list[ContextReconstructionItem]
    # Current Core Anchor VariationZones.
    allowed_variations: list[ContextReconstructionItem]
    # Current OpenQuestions and explicitly unresolved recorded issues.
    unresolved_questions: list[ContextReconstructionItem]
    # Facts genuinely missing from the local record. No confidence scores.
    context_gaps: list[str]

    @field_validator("context_summary")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        return _require_non_blank(value)

    @field_validator("context_gaps")
    @classmethod
    def _items_not_blank(cls, value: list[str]) -> list[str]:
        return _require_non_blank_items(value)


class ContextReconstructionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    shot_id: UUID
    context_snapshot_id: UUID
    agent_run_id: UUID
    # Nested under one field matching the ORM column name exactly, same
    # convention as AlignmentAssessmentRead.envelope -- not flattened
    # onto this model, so there is exactly one place (the JSON column)
    # that owns this shape.
    reconstructed_context: ContextReconstructionOutput
    created_at: datetime
