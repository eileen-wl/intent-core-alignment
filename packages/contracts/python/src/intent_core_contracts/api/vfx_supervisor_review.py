"""Request/response schemas for the VFX Supervisor Agent's
``creative_review`` capability (Step 3).

``VFXSupervisorReviewOutput`` is the provider's structured output
contract -- a high-level, evidence-bounded creative/intent-preservation
read of one Version, for a Human VFX Supervisor to review. This is the
first of three planned Role Agents (VFX Supervisor Agent, CG Supervisor
Agent, Artist Agent) -- distinct from the Core Agent and from the human
VFX Supervisor (see ``agents/vfx_supervisor_review_service.py``'s module
docstring).

This capability never performs image/video/frame analysis (no such
capability exists in this repository) -- every ``VFXReviewItem`` and
``VFXProposedFeedbackNote`` must cite at least one piece of evidence
already present in the ContextSnapshot, and ``evidence_gaps`` must
honestly record when media evidence is unavailable. It never judges
whether a Version officially passes/fails, whether it is definitively
aligned/drifting, whether the Core Anchor should be replaced, or which
role is at fault -- there is deliberately no alignment/pass-fail/
confidence/approval/re-anchor field on this output.

``VFXSupervisorReviewRead`` is the persisted, immutable API read shape.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

# Bounded to the record kinds the ContextSnapshot builder
# (agents/vfx_supervisor_review_service.py) actually places into the
# snapshot payload for one Version review -- an evidence reference must
# always be traceable back to one of these, never a source_type the
# snapshot could not have supplied. Deliberately excludes "human_gate":
# HumanGate resolution facts, where available, are exposed through the
# underlying "decision" they produced, not as their own source_type.
VFXReviewEvidenceSourceType = Literal[
    "intent_brief",
    "intent_decomposition",
    "core_anchor_revision",
    "constraint",
    "variation_zone",
    "drift_risk",
    "anchor_reference",
    "open_question",
    "context_reconstruction",
    "alignment_assessment",
    "version",
    "review_note",
    "decision",
    "task",
    "execution_anchor_revision",
    "shot",
]

VFXReviewPriority = Literal["low", "medium", "high"]


def _require_non_blank(value: str) -> str:
    if not value.strip():
        raise ValueError("must not be blank")
    return value


def _require_non_blank_items(values: list[str]) -> list[str]:
    for value in values:
        if not value.strip():
            raise ValueError("list items must not be blank")
    return values


class VFXReviewEvidenceReference(BaseModel):
    source_type: VFXReviewEvidenceSourceType
    source_id: str = Field(min_length=1)
    label: str = Field(min_length=1)

    @field_validator("label")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        return _require_non_blank(value)


class VFXReviewItem(BaseModel):
    summary: str = Field(min_length=1)
    rationale: str = Field(min_length=1)
    priority: VFXReviewPriority
    # Every item must be evidence-backed -- an empty list would mean an
    # unsupported observation, which this capability must never produce.
    evidence: list[VFXReviewEvidenceReference] = Field(min_length=1)

    @field_validator("summary", "rationale")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        return _require_non_blank(value)


class VFXProposedFeedbackNote(BaseModel):
    """Suggested feedback wording only -- never persisted as a
    ``ReviewNote`` row; a Human VFX Supervisor decides whether and how
    to actually record feedback.
    """

    feedback: str = Field(min_length=1)
    underlying_intent: str = Field(min_length=1)
    priority: VFXReviewPriority
    evidence: list[VFXReviewEvidenceReference] = Field(min_length=1)

    @field_validator("feedback", "underlying_intent")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        return _require_non_blank(value)


class VFXSupervisorReviewOutput(BaseModel):
    executive_summary: str = Field(min_length=1)
    # The high-level intent the Version should be reviewed against.
    creative_direction_read: VFXReviewItem
    # Only evidence-supported positive observations. An empty list is
    # valid when the available evidence cannot prove a strength.
    strengths: list[VFXReviewItem]
    # Areas needing human attention based on textual evidence -- concerns,
    # not authoritative defects or drift judgments.
    creative_concerns: list[VFXReviewItem]
    # What the Human VFX Supervisor should examine first.
    review_priorities: list[VFXReviewItem]
    # Suggested feedback wording preserving both what should change and
    # why it matters to the creative intent -- not persisted ReviewNotes.
    proposed_feedback_notes: list[VFXProposedFeedbackNote]
    # Questions requiring human judgment.
    questions_for_human_supervisor: list[str]
    # Missing media, missing review notes, missing task context, or
    # other facts that limit the review. Must record the media/frame
    # analysis limitation explicitly whenever no such evidence exists.
    evidence_gaps: list[str]

    @field_validator("executive_summary")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        return _require_non_blank(value)

    @field_validator("questions_for_human_supervisor", "evidence_gaps")
    @classmethod
    def _items_not_blank(cls, value: list[str]) -> list[str]:
        return _require_non_blank_items(value)


class VFXSupervisorReviewRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    shot_id: UUID
    version_id: UUID
    context_snapshot_id: UUID
    agent_run_id: UUID
    review_output: VFXSupervisorReviewOutput
    created_at: datetime
