"""Request/response schemas for the VFX Alignment Inbox read model
(Step 7C-1; docs/step-7/14_STEP_7C0B_...md §6, docs/step-7/16_STEP_7C0D_...md).

Read-only. Composes existing persisted Shot/CoreAnchor/HumanGate/
CrossRoleAssessment/IntentSignal/ReAnchorProposal state into one bounded
row per Shot -- no new mutation logic, no new persisted table. The
Current-focus discriminator and its six locked types are the single
source of truth for "what does this Shot need from the VFX Supervisor
right now" (docs/step-7/15_STEP_7C0C_...md §6): `core_anchor_gate_pending`,
`core_anchor_draft_needs_review`, `alignment_not_followed_by_anchor_action`,
`re_anchor_proposal_present`, `assessment_generation_available`, `none`.

Task and Version context on a row are either the real persisted pairing
from the latest CrossRoleAssessment (`task_id`/`version_id` both set,
matching that Assessment) or independently-displayed "latest known"
facts (each field set independently, `pairing_established=False`) --
never a fabricated relationship. See docs/step-7/15_STEP_7C0C_...md §3.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from intent_core_contracts.api.production_context import RecordSource

VfxCurrentFocusType = Literal[
    "core_anchor_gate_pending",
    "core_anchor_draft_needs_review",
    "alignment_not_followed_by_anchor_action",
    "re_anchor_proposal_present",
    "assessment_generation_available",
    "none",
]

AttentionLevel = Literal["low", "medium", "high"]

CoreAnchorState = Literal["none", "draft_pending", "confirmed"]


class VfxInboxCurrentFocusRead(BaseModel):
    """The single derived Current focus for one Shot -- never more than
    one per Shot, per the locked precedence order. See
    docs/step-7/15_STEP_7C0C_...md §6 for the exact predicate each
    `focus_type` corresponds to.
    """

    focus_type: VfxCurrentFocusType
    title: str
    explanation: str
    target_route: str
    primary_action_label: str | None
    # False only for focus_type == "none" -- every other type renders
    # exactly one primary action.
    actionable: bool


class VfxInboxNextFocusRead(BaseModel):
    """One subordinate, still-real focus-type candidate for a Shot,
    ranked below the Current focus by the same locked precedence (Step
    7C-1 targeted correction §7-§8): derived from the same real domain
    state via the same six-type predicates, minus whichever type won as
    Current focus, capped at the next two. Field-identical to
    `VfxInboxCurrentFocusRead` by design -- same real derivation, same
    honest action target -- but a distinct type on purpose: a "Next in
    this Shot" item is never rendered, or represented over the API, as
    if it were the active Current focus. `focus_type` is never `"none"`
    here (`"none"` is never a candidate) and never the legacy
    AlignmentAssessment concept (no such type exists in
    `VfxCurrentFocusType`).
    """

    focus_type: VfxCurrentFocusType
    title: str
    explanation: str
    target_route: str
    primary_action_label: str | None
    actionable: bool


class VfxInboxItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    project_id: UUID
    project_name: str
    shot_id: UUID
    shot_name: str
    # The Shot's own real domain source -- never "demo" here, even if
    # the Shot was seed-resolved via a "demo"-sourced ExternalEntityLink
    # (docs/step-7/16_STEP_7C0D_...md §2.6/§6): that marker is internal
    # seed bookkeeping, not a production integration state.
    shot_source: RecordSource

    core_anchor_state: CoreAnchorState
    active_core_anchor_revision_id: UUID | None
    # core_summary only -- never the full Anchor field set on this row
    # (docs/step-7/14_STEP_7C0B_...md §11's disclosure matrix).
    active_core_anchor_summary: str | None
    pending_human_gate_id: UUID | None

    # Task/Version context: independent facts unless an established
    # Assessment pairing exists (see module docstring and
    # docs/step-7/15_STEP_7C0C_...md §3).
    relevant_task_id: UUID | None
    relevant_task_name: str | None
    relevant_version_id: UUID | None
    relevant_version_name: str | None
    relevant_version_number: int | None
    pairing_established: bool

    latest_assessment_id: UUID | None
    latest_assessment_created_at: datetime | None
    latest_signal_id: UUID | None
    latest_signal_attention_level: AttentionLevel | None
    latest_signal_summary: str | None
    re_anchor_proposal_present: bool

    current_focus: VfxInboxCurrentFocusRead
    # Zero-to-two remaining eligible focus-type candidates, ranked below
    # Current focus by the same locked precedence -- never `"none"`,
    # never a duplicate of `current_focus.focus_type`, never the legacy
    # AlignmentAssessment concept. The Inbox list is not required to
    # display this; the Shot-specific read model (this same type) is
    # what the Shot Overview page renders it from.
    next_candidates: list[VfxInboxNextFocusRead] = Field(default_factory=list, max_length=2)

    # Deterministic sort key, ascending -- lower sorts first (highest
    # precedence). Ties are broken by the row's own most-recent-relevant
    # timestamp (already reflected in this field's derivation), then by
    # shot_id, both applied by the service before this contract is built
    # (docs/step-7/15_STEP_7C0C_...md §6.7/§9's Inbox row-sorting rule).
    sort_rank: int


class VfxInboxRead(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    items: list[VfxInboxItemRead]
    generated_at: datetime
