"""Request/response schemas for the Artist Agent's ``iteration_guidance``
capability (Step 5).

``ArtistAgentGuidanceOutput`` is the provider's structured output
contract -- Artist-facing, evidence-bounded iteration guidance for one
Version, translating upstream creative/technical intent and existing
feedback into practical terms for a Human Artist to read. This is the
third of three planned Role Agents (VFX Supervisor Agent, CG Supervisor
Agent, Artist Agent) -- distinct from the Core Agent, the VFX Supervisor
Agent, the CG Supervisor Agent, and the human Artist (see
``agents/artist_guidance_service.py``'s module docstring).

This capability never inspects footage, rendered frames, scene/project/
DCC files, or numeric/pipeline-specific production parameters -- every
``ArtistGuidanceItem`` and ``ArtistFeedbackTranslation`` must cite at
least one piece of evidence already present in the ContextSnapshot, and
``evidence_gaps`` must honestly record when that evidence is
unavailable. It never decides which Version is officially best, issues a
pass/fail judgment, declares definitive alignment or drift, assigns
blame, instructs anyone to modify an Anchor, recommends confirming or
rejecting a HumanGate, or creates a production Decision -- there is
deliberately no ranking/pass-fail/alignment/blame/gate-resolution field
on this output.

Hard-bounded output (same discipline as the CG Supervisor Agent's Step 4
truncation-fix contract, see ``agents/model_gateway.py``'s module
docstring for the companion diagnostics work): every list and string
field below carries an explicit ``Field`` length limit, not just a
prompt-text instruction.

Step 7C-5 fix (v2, see ``agents/prompt_registry.py``'s
``artist_iteration_guidance.v2`` registration): a real DeepSeek call was
observed to truncate mid-JSON (``finish_reason="length"``) at the
existing 6144-token completion budget. The chosen fix tightens this
contract's own bounds rather than raising the budget --
``ArtistEvidenceReference.label`` previously had no ``max_length`` at
all (the one genuinely unbounded string in the whole output, and the
likeliest place a verbose model response would grow without limit,
e.g. by quoting Anchor content into a citation label instead of a
short reference), every per-item ``evidence`` list is capped at exactly
one reference instead of up to two, and every string/list bound below
was reduced to the smallest size that still fits the six required
guidance categories (what should change, why it matters, what must
remain fixed, what variation is allowed, risks to watch, when to
escalate) at least one concise item each. No field was added, removed,
or renamed -- this is strictly bound-tightening.

``ArtistAgentGuidanceRead`` is the persisted, immutable API read shape.
``ArtistGuidanceGenerateRequest`` carries the ``task_id`` the Human
Artist is submitting for -- the domain model has no reliable Version ->
Task foreign key (a Shot may have several Tasks and several Versions
with no join between them, see ``versions_and_feedback.models.Version``'s
own module docstring), so the caller supplies it explicitly rather than
the service guessing it.
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

# Bounded to the record kinds the ContextSnapshot builder
# (agents/artist_guidance_service.py) actually places into the snapshot
# payload for one Version's guidance -- an evidence reference must
# always be traceable back to one of these, never a source_type the
# snapshot could not have supplied. Deliberately excludes "human_gate":
# HumanGate resolution facts, where available, are exposed through the
# underlying "decision" they produced, not as their own source_type.
ArtistEvidenceSourceType = Literal[
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
    "version",
    "review_note",
    "decision",
    "task",
    "shot",
]

ArtistGuidancePriority = Literal["low", "medium", "high"]


def _require_non_blank(value: str) -> str:
    if not value.strip():
        raise ValueError("must not be blank")
    return value


def _require_non_blank_items(values: list[str]) -> list[str]:
    for value in values:
        if not value.strip():
            raise ValueError("list items must not be blank")
    return values


# A short, bounded free-text item (questions_for_human_supervisor,
# evidence_gaps) -- non-blank is still enforced separately via
# `_require_non_blank_items` since `min_length` alone would accept a
# whitespace-only string. Tightened 260 -> 220 chars in the v2 bound
# pass (see module docstring).
_BoundedNote = Annotated[str, Field(min_length=1, max_length=220)]


class ArtistEvidenceReference(BaseModel):
    source_type: ArtistEvidenceSourceType
    # v2 bound pass: previously unbounded (only `min_length=1`) -- the
    # one genuinely unbounded string in this whole output, and the
    # likeliest place a verbose response grows without limit. Real
    # `source_id` values are always Task/Shot/record UUIDs (36 chars);
    # 80 leaves headroom without permitting free text.
    source_id: str = Field(min_length=1, max_length=80)
    # v2 bound pass: previously unbounded. A citation label, not a
    # place to quote Anchor or evidence content -- 140 chars fits every
    # real label already produced by `DeterministicArtistGuidanceGenerator`
    # (e.g. "Confirmed Core Anchor revision <uuid>") with headroom, while
    # still forbidding a verbose restatement of Anchor text.
    label: str = Field(min_length=1, max_length=140)

    @field_validator("label")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        return _require_non_blank(value)


class ArtistGuidanceItem(BaseModel):
    # v2 bound pass: 280 -> 200, 420 -> 240 (see module docstring).
    summary: str = Field(min_length=1, max_length=200)
    why_it_matters: str = Field(min_length=1, max_length=240)
    priority: ArtistGuidancePriority
    # Every item must be evidence-backed -- an empty list would mean an
    # unsupported observation, which this capability must never
    # produce. v2 bound pass: capped at exactly 1 (was up to 2) -- the
    # single most direct token-budget lever, since evidence entries are
    # the most repeated structure in the output.
    evidence: list[ArtistEvidenceReference] = Field(min_length=1, max_length=1)

    @field_validator("summary", "why_it_matters")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        return _require_non_blank(value)


class ArtistFeedbackTranslation(BaseModel):
    """Translates one piece of upstream feedback/evidence into practical,
    Artist-facing terms -- suggested wording only, never persisted as a
    ``ReviewNote`` row.
    """

    # v2 bound pass: 280 -> 200, 360 -> 220, 420 -> 240, 320 -> 200.
    feedback_or_issue: str = Field(min_length=1, max_length=200)
    practical_action: str = Field(min_length=1, max_length=220)
    underlying_intent: str = Field(min_length=1, max_length=240)
    self_check: str = Field(min_length=1, max_length=200)
    priority: ArtistGuidancePriority
    evidence: list[ArtistEvidenceReference] = Field(min_length=1, max_length=1)

    @field_validator("feedback_or_issue", "practical_action", "underlying_intent", "self_check")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        return _require_non_blank(value)


class ArtistAgentGuidanceOutput(BaseModel):
    # v2 bound pass: 650 -> 400.
    executive_summary: str = Field(min_length=1, max_length=400)
    # What the Shot/scene is trying to achieve.
    creative_intent_read: ArtistGuidanceItem
    # What the current Task is responsible for.
    task_goal: ArtistGuidanceItem
    # A read of this specific Version as one iteration toward that goal.
    current_iteration_read: ArtistGuidanceItem
    # Constraints that are not open to variation. v2 bound pass: 3 -> 2.
    non_negotiables: list[ArtistGuidanceItem] = Field(max_length=2)
    # Areas explicitly open to Artist variation. v2 bound pass: 3 -> 2.
    allowed_variations: list[ArtistGuidanceItem] = Field(max_length=2)
    # Existing feedback/evidence translated into practical action. v2
    # bound pass: 3 -> 2.
    feedback_translations: list[ArtistFeedbackTranslation] = Field(max_length=2)
    # What the Human Artist should address first on the next iteration.
    # v2 bound pass: 3 -> 2.
    iteration_priorities: list[ArtistGuidanceItem] = Field(max_length=2)
    # Dependencies requiring coordination with another department or
    # supervisor -- never an instruction to resolve them unilaterally.
    cross_department_dependencies: list[ArtistGuidanceItem] = Field(max_length=2)
    # Questions requiring human judgment. v2 bound pass: 3 -> 2.
    questions_for_human_supervisor: list[_BoundedNote] = Field(max_length=2)
    # Missing media, scene, parameter, or pipeline evidence that limits
    # the guidance. Must record the missing-media/technical-evidence
    # limitation explicitly whenever no such evidence exists. v2 bound
    # pass: 5 -> 4 (kept at 4, not 3: the mandatory inspection-boundary
    # disclosure plus up to three independent real gap conditions --
    # missing Execution Anchor guidance, no Review Notes, no VFX
    # Supervisor Agent review -- can genuinely co-occur, e.g. for a
    # bare Task with no recorded context yet).
    evidence_gaps: list[_BoundedNote] = Field(max_length=4)

    @field_validator("executive_summary")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        return _require_non_blank(value)

    @field_validator("questions_for_human_supervisor", "evidence_gaps")
    @classmethod
    def _items_not_blank(cls, value: list[str]) -> list[str]:
        return _require_non_blank_items(value)


class ArtistGuidanceGenerateRequest(BaseModel):
    task_id: UUID


class ArtistAgentGuidanceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    shot_id: UUID
    task_id: UUID
    version_id: UUID
    execution_anchor_revision_id: UUID
    context_snapshot_id: UUID
    agent_run_id: UUID
    guidance_output: ArtistAgentGuidanceOutput
    created_at: datetime
