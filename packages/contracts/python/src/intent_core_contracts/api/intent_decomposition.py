"""Request/response schemas for the Core Agent ``intent_decomposition``
capability (Step 1B).

``IntentDecompositionOutput`` is the provider's structured output
contract -- deliberately *not* built on ``AgentOutputEnvelope``
(``intent_core_contracts.agents.envelope``): that shape is for narrative
advisory analysis (observations/inferences/evidence/**confidence**) like
Alignment Assessment, and Step 1B's own product scope explicitly does
not want a confidence score at the decomposition stage. This capability's
deliverable is a structured domain object -- the seven Design Concept
dimensions plus candidate Anchor content -- much closer in shape to
``CoreAnchorRevisionDraftCreate`` than to an assessment envelope (see
``agents/core_agent_service.py``'s own docstring for the same reasoning
applied to Core Anchor drafting).

``IntentDecompositionRead`` is the persisted, immutable API read shape.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _require_non_blank(value: str) -> str:
    if not value.strip():
        raise ValueError("must not be blank")
    return value


def _require_non_blank_items(values: list[str]) -> list[str]:
    for value in values:
        if not value.strip():
            raise ValueError("list items must not be blank")
    return values


class IntentDimensionAnalysis(BaseModel):
    summary: str = Field(min_length=1)
    rationale: str = Field(min_length=1)

    @field_validator("summary", "rationale")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        return _require_non_blank(value)


class IntentDecompositionDimensions(BaseModel):
    """Exactly the seven Design Concept dimensions
    (docs/PRODUCT_SCOPE.md §6.1, docs/AGENT_CONTRACTS.md §4) -- no more,
    no fewer. Every dimension is required on every decomposition; an
    ``IntentDimensionAnalysis`` with nothing meaningful to say still
    states that plainly in ``summary``/``rationale`` rather than being
    omitted (see ``uncertainties`` for how "insufficient context" is
    represented instead).
    """

    emotional_tone: IntentDimensionAnalysis
    visual_focus: IntentDimensionAnalysis
    rhythm_and_intensity: IntentDimensionAnalysis
    character_relationships: IntentDimensionAnalysis
    narrative_priority: IntentDimensionAnalysis
    technical_execution_requirements: IntentDimensionAnalysis
    visual_detail_constraints: IntentDimensionAnalysis


class IntentDecompositionOutput(BaseModel):
    core_intent_summary: str = Field(min_length=1)
    anchor_relevant_content: str = Field(min_length=1)
    dimensions: IntentDecompositionDimensions
    # Model-proposed Must-preserve items -- may include only technical or
    # visual-detail requirements that genuinely need to become Anchor
    # constraints, not every technical/visual-detail observation.
    candidate_constraints: list[str] = Field(default_factory=list)
    # Model-proposed Allowed-variation items.
    candidate_variation_zones: list[str] = Field(default_factory=list)
    # Useful brief information that should remain visible but must not
    # become an Anchor constraint.
    contextual_information: list[str] = Field(default_factory=list)
    # Missing, ambiguous, or unresolved issues. An explicit empty list
    # means sufficient context -- there is no separate "status" field.
    uncertainties: list[str] = Field(default_factory=list)

    @field_validator("core_intent_summary", "anchor_relevant_content")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        return _require_non_blank(value)

    @field_validator(
        "candidate_constraints",
        "candidate_variation_zones",
        "contextual_information",
        "uncertainties",
    )
    @classmethod
    def _items_not_blank(cls, value: list[str]) -> list[str]:
        return _require_non_blank_items(value)


class IntentDecompositionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    shot_id: UUID
    intent_brief_id: UUID
    context_snapshot_id: UUID
    agent_run_id: UUID
    core_intent_summary: str
    anchor_relevant_content: str
    dimensions: IntentDecompositionDimensions
    candidate_constraints: list[str]
    candidate_variation_zones: list[str]
    contextual_information: list[str]
    uncertainties: list[str]
    created_at: datetime


class CoreAnchorDraftFromDecompositionRequest(BaseModel):
    """Deliberately empty today -- the decomposition id is already in the
    URL path, and there is no other required input for this action. A
    real body (not an empty-object placeholder) keeps the endpoint
    consistent with the repository's other POST-action endpoints
    (``AnchorConfirmRequest``, ``AssessmentDecisionRequest``, ...), and
    leaves room to add an optional field later without a breaking change.
    """

    model_config = ConfigDict(extra="forbid")
