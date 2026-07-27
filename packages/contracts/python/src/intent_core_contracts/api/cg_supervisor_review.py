"""Request/response schemas for the CG Supervisor Agent's
``execution_review`` capability (Step 4).

``CGSupervisorReviewOutput`` is the provider's structured output
contract -- a department/task-level execution-guidance read of one
``ExecutionAnchorRevision``, for a Human CG Supervisor to review. This
is the second of three planned Role Agents (VFX Supervisor Agent, CG
Supervisor Agent, Artist Agent) -- distinct from the Core Agent, the
Human CG Supervisor, and the VFX Supervisor Agent (see
``agents/cg_supervisor_review_service.py``'s module docstring).

This capability never inspects footage, frames, renders, scene files, or
DCC project files -- every ``CGReviewItem`` and
``CGProposedExecutionGuidance`` must cite at least one piece of evidence
already present in the ContextSnapshot, and ``evidence_gaps`` must
honestly record when technical/scene/parameter/pipeline evidence is
unavailable. It never judges whether work officially passes/fails,
whether a Version definitively drifted, which role is at fault, whether
the Core Anchor should be replaced, or whether a HumanGate should be
confirmed -- there is deliberately no pass/fail/alignment/confidence/
gate-resolution field on this output.

Hard-bounded output (Step 4 real-provider truncation fix, see
``agents/model_gateway.py``'s module docstring for the companion
diagnostics work): every list and string field below carries an
explicit ``Field`` length limit, not just a prompt-text instruction, so
a provider that ignores the prompt's own bounded-output guidance still
cannot produce a response so large it risks being cut off mid-JSON
before ever reaching validation. These limits are deliberately tighter
than a "nice to have" cap -- they are sized to keep the full structured
response comfortably inside the capability's configured
``max_output_tokens`` budget.

``CGSupervisorReviewRead`` is the persisted, immutable API read shape.
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

# Bounded to the record kinds the ContextSnapshot builder
# (agents/cg_supervisor_review_service.py) actually places into the
# snapshot payload for one ExecutionAnchorRevision review -- an evidence
# reference must always be traceable back to one of these, never a
# source_type the snapshot could not have supplied. Deliberately
# excludes "human_gate": HumanGate resolution facts, where available,
# are exposed through the underlying "decision" they produced, not as
# their own source_type.
CGReviewEvidenceSourceType = Literal[
    "intent_brief",
    "intent_decomposition",
    "core_anchor_revision",
    "constraint",
    "variation_zone",
    "drift_risk",
    "anchor_reference",
    "open_question",
    "context_reconstruction",
    "execution_anchor_revision",
    "alignment_assessment",
    "vfx_supervisor_review",
    "version",
    "review_note",
    "decision",
    "task",
    "shot",
]

CGReviewPriority = Literal["low", "medium", "high"]


def _require_non_blank(value: str) -> str:
    if not value.strip():
        raise ValueError("must not be blank")
    return value


def _require_non_blank_items(values: list[str]) -> list[str]:
    for value in values:
        if not value.strip():
            raise ValueError("list items must not be blank")
    return values


# A short, bounded free-text item (questions_for_human_cg_supervisor,
# evidence_gaps) -- non-blank is still enforced separately via
# `_require_non_blank_items` since `min_length` alone would accept a
# whitespace-only string.
_BoundedNote = Annotated[str, Field(min_length=1, max_length=260)]


class CGReviewEvidenceReference(BaseModel):
    source_type: CGReviewEvidenceSourceType
    source_id: str = Field(min_length=1)
    label: str = Field(min_length=1)

    @field_validator("label")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        return _require_non_blank(value)


class CGReviewItem(BaseModel):
    summary: str = Field(min_length=1, max_length=280)
    rationale: str = Field(min_length=1, max_length=420)
    priority: CGReviewPriority
    # Every item must be evidence-backed -- an empty list would mean an
    # unsupported observation, which this capability must never
    # produce. Capped at 2: the smallest sufficient set, per the system
    # prompt's own instruction, not an exhaustive citation list.
    evidence: list[CGReviewEvidenceReference] = Field(min_length=1, max_length=2)

    @field_validator("summary", "rationale")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        return _require_non_blank(value)


class CGProposedExecutionGuidance(BaseModel):
    """Suggested execution guidance wording only -- never persisted as a
    ``ReviewNote`` row; a Human CG Supervisor decides whether and how to
    actually communicate guidance to Artists.
    """

    guidance: str = Field(min_length=1, max_length=320)
    underlying_intent: str = Field(min_length=1, max_length=420)
    priority: CGReviewPriority
    evidence: list[CGReviewEvidenceReference] = Field(min_length=1, max_length=2)

    @field_validator("guidance", "underlying_intent")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        return _require_non_blank(value)


class CGSupervisorReviewOutput(BaseModel):
    executive_summary: str = Field(min_length=1, max_length=700)
    # The technical/execution direction represented by the current
    # Execution Anchor revision, read against the confirmed Core Anchor.
    execution_direction_read: CGReviewItem
    # Requirements that appear actionable given the recorded evidence.
    actionable_requirements: list[CGReviewItem] = Field(max_length=3)
    # Technical concerns or ambiguities requiring Human CG Supervisor
    # attention -- concerns, not authoritative defects or drift judgments.
    technical_concerns: list[CGReviewItem] = Field(max_length=3)
    # Cross-department/coordination concerns (e.g. conflicting Task
    # requirements, unresolved upstream dependencies).
    coordination_concerns: list[CGReviewItem] = Field(max_length=2)
    # What the Human CG Supervisor should clarify first.
    implementation_priorities: list[CGReviewItem] = Field(max_length=3)
    # Suggested execution guidance preserving both what to do and why it
    # matters -- not persisted ReviewNotes.
    proposed_execution_guidance: list[CGProposedExecutionGuidance] = Field(max_length=3)
    # Questions requiring human judgment.
    questions_for_human_cg_supervisor: list[_BoundedNote] = Field(max_length=3)
    # Missing media, scene, parameter, or pipeline evidence that limits
    # the review. Must record the missing-media/technical-evidence
    # limitation explicitly whenever no such evidence exists.
    evidence_gaps: list[_BoundedNote] = Field(max_length=5)

    @field_validator("executive_summary")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        return _require_non_blank(value)

    @field_validator("questions_for_human_cg_supervisor", "evidence_gaps")
    @classmethod
    def _items_not_blank(cls, value: list[str]) -> list[str]:
        return _require_non_blank_items(value)


class CGSupervisorReviewRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    shot_id: UUID
    task_id: UUID
    execution_anchor_revision_id: UUID
    context_snapshot_id: UUID
    agent_run_id: UUID
    review_output: CGSupervisorReviewOutput
    created_at: datetime
