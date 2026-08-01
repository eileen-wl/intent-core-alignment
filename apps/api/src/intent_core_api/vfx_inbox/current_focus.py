"""Deterministic VFX Current-focus derivation (Step 7C-1).

Pure, DB-free logic: every predicate operates on an already-loaded
``ShotFocusInputs`` snapshot, never issues a query itself, so it is
testable against plain fixture data and does not duplicate the
service layer's own query/aggregation concerns (docs/step-7/15_STEP_7C0C_...md
§6, docs/step-7/16_STEP_7C0D_...md §6/§8).

Six focus types, in locked precedence order (highest first):

1. ``core_anchor_gate_pending``
2. ``core_anchor_draft_needs_review``
3. ``alignment_not_followed_by_anchor_action``
4. ``re_anchor_proposal_present``
5. ``assessment_generation_available``
6. ``none``

Truthfulness rule (docs/step-7/15_STEP_7C0C_...md §2): no persisted
"addressed"/"unread"/"unresolved" status exists anywhere in the domain
model. "No newer Core Anchor action has followed this assessment" is a
derived timestamp fact (a plain ``>`` comparison on real ``created_at``/
``resolved_at`` columns), never presented as a persisted workflow status.
"Newer than" uses strict ``>`` -- a revision/gate-resolution created in
the exact same instant as the Assessment is not "newer" (relevant only
for synthetic/seeded fixture timestamps sharing one instant).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from intent_core_contracts.api.vfx_inbox import AttentionLevel, VfxInboxCurrentFocusRead


@dataclass(frozen=True)
class ShotFocusInputs:
    """Everything the derivation needs for one Shot, already loaded by
    the caller. No field here is itself a persisted "focus" or
    "attention" flag -- every field is a real, independently-meaningful
    domain fact.
    """

    shot_id: UUID

    # Core Anchor state.
    core_anchor_confirmed: bool
    active_core_anchor_revision_id: UUID | None
    # Max created_at across every CoreAnchorRevision ever created for
    # this Shot (draft, confirmed, rejected, superseded alike) -- used
    # only for the "newer than the latest Assessment" comparison.
    latest_core_anchor_revision_created_at: datetime | None

    # HumanGate state for this Shot's Core Anchor.
    pending_core_anchor_gate_id: UUID | None
    # A draft revision exists with no HumanGate at all yet (the
    # legacy-compatibility case documented in human_gate_service) --
    # distinct from "gate pending", which already implies a draft.
    draft_revision_without_gate_exists: bool
    # Max resolved_at across every HumanGate ever resolved for this
    # Shot's Core Anchor -- used for the "newer than the latest
    # Assessment" comparison.
    latest_core_anchor_gate_resolved_at: datetime | None

    # Latest CrossRoleAssessment for this Shot (via whichever Task/
    # Version pairing it was generated against), if any.
    latest_assessment_id: UUID | None
    latest_assessment_created_at: datetime | None
    latest_signal_attention_level: AttentionLevel | None
    re_anchor_proposal_present: bool

    # Whether generation prerequisites are fully met for at least one
    # real Task+Version combination belonging to this Shot (confirmed
    # Execution Anchor for that Task, plus a VFX review, CG review, and
    # Artist guidance all present for that Task/Version) -- computed by
    # the caller, never guessed here.
    assessment_generation_available: bool
    # When prerequisites are only partially met, the specific missing
    # one, for an honest explanation (docs/step-7/15_STEP_7C0C_...md
    # §6.5's note) -- None when either fully met or nothing has even
    # started (no confirmed Core Anchor yet).
    missing_prerequisite_explanation: str | None


def _shot_route(shot_id: UUID) -> str:
    return f"/vfx/shots/{shot_id}"


def _intent_route(shot_id: UUID) -> str:
    return f"/vfx/shots/{shot_id}/intent"


def _alignment_route(shot_id: UUID) -> str:
    return f"/vfx/shots/{shot_id}/alignment"


def _gate_pending_focus(inputs: ShotFocusInputs) -> VfxInboxCurrentFocusRead:
    return VfxInboxCurrentFocusRead(
        focus_type="core_anchor_gate_pending",
        title="Core Anchor draft awaiting your confirmation",
        explanation="A proposed revision to the shared creative intent is ready for your review.",
        target_route=_intent_route(inputs.shot_id),
        primary_action_label="Review and confirm",
        actionable=True,
    )


def _draft_needs_review_focus(inputs: ShotFocusInputs) -> VfxInboxCurrentFocusRead:
    return VfxInboxCurrentFocusRead(
        focus_type="core_anchor_draft_needs_review",
        title="Core Anchor draft in progress",
        explanation="A draft revision exists but has not yet been submitted for confirmation.",
        target_route=_intent_route(inputs.shot_id),
        primary_action_label="Review draft",
        actionable=True,
    )


def _alignment_focus(inputs: ShotFocusInputs) -> VfxInboxCurrentFocusRead:
    return VfxInboxCurrentFocusRead(
        focus_type="alignment_not_followed_by_anchor_action",
        title="Cross-role assessment may need your interpretation",
        explanation="No newer Core Anchor action has followed this assessment.",
        target_route=_alignment_route(inputs.shot_id),
        primary_action_label="Review alignment",
        actionable=True,
    )


def _proposal_focus(inputs: ShotFocusInputs) -> VfxInboxCurrentFocusRead:
    return VfxInboxCurrentFocusRead(
        focus_type="re_anchor_proposal_present",
        title="Re-anchor proposal available for consideration",
        explanation="The latest assessment includes an advisory suggestion for the Core Anchor.",
        target_route=_alignment_route(inputs.shot_id),
        primary_action_label="Review proposal",
        actionable=True,
    )


def _generation_available_focus(inputs: ShotFocusInputs) -> VfxInboxCurrentFocusRead:
    return VfxInboxCurrentFocusRead(
        focus_type="assessment_generation_available",
        title="A new cross-role assessment can be generated",
        explanation="All prerequisites are met for this Shot's current Task and Version.",
        target_route=_alignment_route(inputs.shot_id),
        primary_action_label="Generate assessment",
        actionable=True,
    )


def _none_focus(inputs: ShotFocusInputs) -> VfxInboxCurrentFocusRead:
    explanation = (
        inputs.missing_prerequisite_explanation
        or "Nothing requires your attention on this Shot right now."
    )
    return VfxInboxCurrentFocusRead(
        focus_type="none",
        title="Nothing requires your attention on this Shot right now",
        explanation=explanation,
        target_route=_shot_route(inputs.shot_id),
        primary_action_label=None,
        actionable=False,
    )


def _eligible_focus_candidates(inputs: ShotFocusInputs) -> list[VfxInboxCurrentFocusRead]:
    """Every focus type (excluding ``none``) whose own real predicate is
    currently satisfied, in locked precedence order. ``derive_current_focus``
    always returns element 0 of this list when it is non-empty (both walk
    the same predicates, in the same order, over the same inputs) --
    this is the single shared source of truth `derive_next_focus_candidates`
    relies on to stay consistent with the Current-focus selection without
    duplicating any predicate or text.
    """
    not_followed_by_anchor_action = _not_followed_by_anchor_action(inputs)
    candidates: list[VfxInboxCurrentFocusRead] = []

    if inputs.pending_core_anchor_gate_id is not None:
        candidates.append(_gate_pending_focus(inputs))

    if inputs.draft_revision_without_gate_exists:
        candidates.append(_draft_needs_review_focus(inputs))

    if (
        inputs.latest_assessment_id is not None
        and inputs.latest_signal_attention_level in ("medium", "high")
        and not_followed_by_anchor_action
    ):
        candidates.append(_alignment_focus(inputs))

    # No explicit signal-level check here (unlike the original,
    # pre-correction type 4 predicate): type 3 is appended first and
    # always wins the *Current*-focus slot (`eligible[0]`) whenever its
    # own condition (signal in ("medium", "high")) holds, exactly
    # preserving the old behaviour where type 4 could only ever become
    # Current focus when the Signal read "low". Dropping the signal
    # check here only changes what happens *after* index 0: it lets a
    # real Proposal on a medium/high-Signal Assessment surface as a
    # `re_anchor_proposal_present` Next-in-this-Shot candidate (Step
    # 7C-1 targeted correction §7-§8), instead of being invisible
    # whenever type 3 already won Current focus.
    if (
        inputs.latest_assessment_id is not None
        and inputs.re_anchor_proposal_present
        and not_followed_by_anchor_action
    ):
        candidates.append(_proposal_focus(inputs))

    # Locked meaning (Step 7C-1 predicate correction): "a new assessment
    # can be generated" is only true when no successful CrossRoleAssessment
    # exists for this Shot yet -- `inputs.assessment_generation_available`
    # alone only encodes "prerequisites are met for some Task+Version
    # pair", never "and none has been generated yet". Once a Shot has a
    # real Assessment, offering to generate a first one is no longer
    # honest; a *new* generation control belongs in the future Alignment
    # Workspace (Step 7C-3), not Shot Overview Current-focus or
    # Next-in-this-Shot.
    if inputs.assessment_generation_available and inputs.latest_assessment_id is None:
        candidates.append(_generation_available_focus(inputs))

    return candidates


def derive_current_focus(inputs: ShotFocusInputs) -> VfxInboxCurrentFocusRead:
    eligible = _eligible_focus_candidates(inputs)
    # Precedence order is already encoded by `_eligible_focus_candidates`'
    # own evaluation order -- the first eligible candidate is always the
    # Current focus. `none` is never itself a "candidate" (§6 above): it
    # is only ever the honest fallback when nothing else is eligible.
    if eligible:
        return eligible[0]
    return _none_focus(inputs)


def derive_next_focus_candidates(inputs: ShotFocusInputs) -> list[VfxInboxCurrentFocusRead]:
    """The remaining eligible focus-type candidates once the
    highest-precedence one has been selected as Current focus (Step
    7C-1 targeted correction §7-§8): every candidate from
    ``_eligible_focus_candidates`` after the first, capped at two.
    Always empty when zero or one candidate is eligible. Never includes
    ``none`` (excluded from ``_eligible_focus_candidates`` by
    construction) and never a duplicate of the Current-focus type
    (element 0 is always dropped, and no predicate can match twice).
    """
    eligible = _eligible_focus_candidates(inputs)
    return eligible[1:3]


def _not_followed_by_anchor_action(inputs: ShotFocusInputs) -> bool:
    if inputs.latest_assessment_created_at is None:
        return False
    assessment_created_at = inputs.latest_assessment_created_at
    revision_created_at = inputs.latest_core_anchor_revision_created_at
    gate_resolved_at = inputs.latest_core_anchor_gate_resolved_at
    return not (
        (revision_created_at is not None and revision_created_at > assessment_created_at)
        or (gate_resolved_at is not None and gate_resolved_at > assessment_created_at)
    )


# Deterministic sort precedence (docs/step-7/14_STEP_7C0B_...md §6.3,
# docs/step-7/15_STEP_7C0C_...md §7.2): lower rank sorts first. Rows
# within the same bucket are ordered by the caller using each row's own
# most-recent-relevant timestamp, descending, then by shot_id ascending
# as the final deterministic tie-break (docs/step-7/15_STEP_7C0C_...md
# §6.7) -- both applied by the service, not here.
_FOCUS_TYPE_SORT_RANK: dict[str, int] = {
    "core_anchor_gate_pending": 0,
    "core_anchor_draft_needs_review": 1,
    "alignment_not_followed_by_anchor_action": 2,
    "re_anchor_proposal_present": 2,
    "assessment_generation_available": 3,
    "none": 4,
}


def sort_rank_for_focus_type(focus_type: str) -> int:
    return _FOCUS_TYPE_SORT_RANK[focus_type]
