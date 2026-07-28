"""Request/response schemas for the Core Agent's ``cross_role_assessment``
capability (Step 6).

``CrossRoleAssessmentOutput`` is the provider's structured output contract
-- a synthesis of the complete recorded evidence chain for one Version's
Task context (confirmed Core Anchor, confirmed Execution Anchor, the
newest VFX Supervisor Agent review, the newest CG Supervisor Agent
review, and the newest Artist Agent guidance) into where the recorded
roles agree, where their recorded interpretations differ, where one
department may be optimising locally at the expense of the shared
creative intent, which dependencies remain unresolved, and whether the
current Core Anchor looks sufficiently clear for the evidence now
available. This is a Core Agent capability (`agent_type=core_agent`,
`capability=cross_role_assessment`) -- not a fifth Agent, not a Role
Agent, and not any of the three existing Role Agents (see
``agents/cross_role_assessment_service.py``'s module docstring).

This capability never inspects footage, frames, renders, scene files, or
DCC project files -- every ``CrossRoleFinding``/``RolePerspectiveRead``
must cite evidence already present in the ContextSnapshot, and
``evidence_gaps`` must honestly record when technical/scene/parameter/
pipeline evidence is unavailable. It never issues an official pass/fail,
a definitive aligned/misaligned or drift verdict, role blame, or a
Version ranking, and it never automatically modifies a Core Anchor,
resolves a HumanGate, or creates an authoritative Decision -- there is
deliberately no such field on this output.

``ReAnchorProposalOutput`` is the only field on this output allowed to
suggest possible future Core Anchor content, and only as bounded advisory
evidence for the Human VFX Supervisor to consider -- never an instruction,
never a Decision, never a ``CoreAnchorRevision``, never an automatic
write (see ``agents/cross_role_assessment_service.py``'s
``_validate_re_anchor_proposal`` for the exact evidence-diversity rules
that gate when a proposal may be persisted at all).

Hard-bounded output (same truncation-avoidance discipline as the CG
Supervisor Agent's Step 4 and Artist Agent's Step 5 output contracts):
every list and string field below carries an explicit ``Field`` length
limit, not just a prompt-text instruction.

``CrossRoleAssessmentRead`` is the persisted, immutable API read shape,
including the required linked ``IntentSignalRead`` and the optional
linked ``ReAnchorProposalRead``.
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

# Bounded to the record kinds the ContextSnapshot builder
# (agents/cross_role_assessment_service.py) actually places into the
# snapshot payload for one Version/Task cross-role assessment -- an
# evidence reference must always be traceable back to one of these,
# never a source_type the snapshot could not have supplied. Deliberately
# excludes "human_gate": HumanGate resolution facts, where available,
# are exposed through the underlying "decision" they produced, not as
# their own source_type.
CrossRoleEvidenceSourceType = Literal[
    "intent_brief",
    "intent_decomposition",
    "core_anchor_revision",
    "constraint",
    "variation_zone",
    "drift_risk",
    "open_question",
    "context_reconstruction",
    "execution_anchor_revision",
    "vfx_supervisor_review",
    "cg_supervisor_review",
    "artist_agent_guidance",
    "version",
    "review_note",
    "decision",
    "task",
    "shot",
]

CrossRolePriority = Literal["low", "medium", "high"]
CrossRoleRole = Literal["vfx_supervisor", "cg_supervisor", "artist"]
_ALL_ROLES: frozenset[CrossRoleRole] = frozenset({"vfx_supervisor", "cg_supervisor", "artist"})

ReAnchorField = Literal[
    "core_summary", "constraints", "variation_zones", "drift_risks", "open_questions"
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


# A short, bounded free-text item (evidence_gaps, proposal free lists) --
# non-blank is still enforced separately via `_require_non_blank_items`
# since `min_length` alone would accept a whitespace-only string.
_BoundedNote = Annotated[str, Field(min_length=1, max_length=280)]


class CrossRoleEvidenceReference(BaseModel):
    source_type: CrossRoleEvidenceSourceType
    source_id: str = Field(min_length=1)
    label: str = Field(min_length=1)

    @field_validator("label")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        return _require_non_blank(value)


class CrossRoleFinding(BaseModel):
    summary: str = Field(min_length=1, max_length=280)
    why_it_matters: str = Field(min_length=1, max_length=420)
    # Which recorded role perspective(s) this finding concerns -- a
    # non-empty, duplicate-free subset of the three roles.
    affected_roles: list[CrossRoleRole] = Field(min_length=1, max_length=3)
    priority: CrossRolePriority
    evidence: list[CrossRoleEvidenceReference] = Field(min_length=1, max_length=3)

    @field_validator("summary", "why_it_matters")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        return _require_non_blank(value)

    @field_validator("affected_roles")
    @classmethod
    def _unique_roles(cls, value: list[CrossRoleRole]) -> list[CrossRoleRole]:
        if len(set(value)) != len(value):
            raise ValueError("affected_roles must not contain duplicates")
        return value


class RolePerspectiveRead(BaseModel):
    role: CrossRoleRole
    current_position: str = Field(min_length=1, max_length=360)
    protected_intent: str = Field(min_length=1, max_length=360)
    main_concerns: str = Field(min_length=1, max_length=360)
    evidence: list[CrossRoleEvidenceReference] = Field(min_length=1, max_length=3)

    @field_validator("current_position", "protected_intent", "main_concerns")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        return _require_non_blank(value)


class ReAnchorFieldProposal(BaseModel):
    field: ReAnchorField
    current_problem: str = Field(min_length=1, max_length=420)
    proposed_direction: str = Field(min_length=1, max_length=420)
    why_it_may_help: str = Field(min_length=1, max_length=420)
    evidence: list[CrossRoleEvidenceReference] = Field(min_length=2, max_length=4)

    @field_validator("current_problem", "proposed_direction", "why_it_may_help")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        return _require_non_blank(value)


class ReAnchorProposalOutput(BaseModel):
    """Advisory-only evidence for the Human VFX Supervisor to consider --
    never an instruction, never a Decision, never a ``CoreAnchorRevision``,
    never an automatic write. See
    ``agents/cross_role_assessment_service.py``'s
    ``_validate_re_anchor_proposal`` for the evidence-diversity rules
    that gate whether a generated proposal may actually be persisted.
    """

    reason_for_consideration: str = Field(min_length=1, max_length=420)
    preserved_elements: list[_BoundedNote] = Field(max_length=5)
    proposed_fields: list[ReAnchorFieldProposal] = Field(min_length=1, max_length=4)
    adoption_risks: list[_BoundedNote] = Field(max_length=4)
    questions_for_human_vfx_supervisor: list[_BoundedNote] = Field(max_length=4)
    evidence: list[CrossRoleEvidenceReference] = Field(min_length=3, max_length=6)

    @field_validator("reason_for_consideration")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        return _require_non_blank(value)

    @field_validator("preserved_elements", "adoption_risks", "questions_for_human_vfx_supervisor")
    @classmethod
    def _items_not_blank(cls, value: list[str]) -> list[str]:
        return _require_non_blank_items(value)


class CrossRoleAssessmentOutput(BaseModel):
    executive_summary: str = Field(min_length=1, max_length=700)
    # The shared creative/technical intent all three roles are meant to
    # be working toward.
    shared_intent_read: CrossRoleFinding
    # Exactly one perspective per role -- validated below.
    role_perspectives: list[RolePerspectiveRead]
    agreements: list[CrossRoleFinding] = Field(max_length=3)
    cross_role_tensions: list[CrossRoleFinding] = Field(max_length=3)
    local_optimum_risks: list[CrossRoleFinding] = Field(max_length=3)
    unresolved_dependencies: list[CrossRoleFinding] = Field(max_length=3)
    human_coordination_priorities: list[CrossRoleFinding] = Field(max_length=3)
    # Only non-null when the bounded evidence-diversity rules in
    # ``_validate_re_anchor_proposal`` are satisfied.
    re_anchor_proposal: ReAnchorProposalOutput | None = None
    # Missing footage/scene/parameter evidence that limits the
    # assessment. Must record the missing-media/technical-evidence
    # limitation explicitly whenever no such evidence exists.
    evidence_gaps: list[_BoundedNote] = Field(max_length=6)

    @field_validator("executive_summary")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        return _require_non_blank(value)

    @field_validator("evidence_gaps")
    @classmethod
    def _items_not_blank(cls, value: list[str]) -> list[str]:
        return _require_non_blank_items(value)

    @model_validator(mode="after")
    def _exactly_one_perspective_per_role(self) -> CrossRoleAssessmentOutput:
        roles = [perspective.role for perspective in self.role_perspectives]
        if set(roles) != _ALL_ROLES or len(roles) != len(_ALL_ROLES):
            raise ValueError(
                "role_perspectives must contain exactly one entry per role "
                f"({sorted(_ALL_ROLES)}), with no duplicate or missing role"
            )
        return self


class CrossRoleAssessmentGenerateRequest(BaseModel):
    task_id: UUID


class ReAnchorProposalRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    cross_role_assessment_id: UUID
    project_id: UUID
    shot_id: UUID
    current_core_anchor_revision_id: UUID
    proposal_output: ReAnchorProposalOutput
    created_at: datetime


IntentSignalDriverCode = Literal[
    "cross_role_tension",
    "local_optimum_risk",
    "unresolved_dependency",
    "anchor_clarity_gap",
    "missing_evidence",
]
AttentionLevel = Literal["low", "medium", "high"]
IntentSignalLabel = Literal["low_attention", "attention_needed", "human_review_required"]


class IntentSignalDriver(BaseModel):
    code: IntentSignalDriverCode
    summary: str = Field(min_length=1, max_length=280)
    priority: CrossRolePriority
    # Which assessment section this driver was derived from (e.g.
    # "cross_role_tensions"), and that section's list index it points
    # to -- 0 for a singular, non-list section such as
    # "shared_intent_read". Lets a reader trace every driver back to the
    # exact assessment content that produced it.
    assessment_section: str = Field(min_length=1)
    assessment_item_index: int = Field(ge=0)

    @field_validator("summary")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        return _require_non_blank(value)


class RoleCoverage(BaseModel):
    vfx_supervisor: bool
    cg_supervisor: bool
    artist: bool


class IntentSignalOutput(BaseModel):
    attention_level: AttentionLevel
    label: IntentSignalLabel
    summary: str = Field(min_length=1, max_length=420)
    drivers: list[IntentSignalDriver] = Field(max_length=5)
    role_coverage: RoleCoverage
    re_anchor_proposal_present: bool
    caveats: list[_BoundedNote] = Field(max_length=4)

    @field_validator("summary")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        return _require_non_blank(value)

    @field_validator("caveats")
    @classmethod
    def _items_not_blank(cls, value: list[str]) -> list[str]:
        return _require_non_blank_items(value)


class IntentSignalRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    cross_role_assessment_id: UUID
    project_id: UUID
    shot_id: UUID
    task_id: UUID
    version_id: UUID
    attention_level: AttentionLevel
    signal_output: IntentSignalOutput
    created_at: datetime


class CrossRoleAssessmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    shot_id: UUID
    task_id: UUID
    version_id: UUID
    core_anchor_revision_id: UUID
    execution_anchor_revision_id: UUID
    vfx_supervisor_review_id: UUID
    cg_supervisor_review_id: UUID
    artist_agent_guidance_id: UUID
    context_snapshot_id: UUID
    agent_run_id: UUID
    assessment_output: CrossRoleAssessmentOutput
    created_at: datetime
    intent_signal: IntentSignalRead
    re_anchor_proposal: ReAnchorProposalRead | None
