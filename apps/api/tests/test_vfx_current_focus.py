"""Canonical fixture-scenario table for the six VFX Current-focus types
(docs/step-7/15_STEP_7C0C_...md §6.8) -- the Python side of the
cross-implementation parity requirement. The frontend's TypeScript tests
must exercise the same named scenarios if/when a TS-side derivation is
ever introduced; for Step 7C-1 no such duplication exists (the frontend
consumes the backend's derived VfxInboxCurrentFocusRead directly, see
docs/step-7/16_STEP_7C0D_...md §16), so this table is currently the only
copy -- kept here, explicitly named, so a future TS derivation (if ever
justified) has one canonical source to match against.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from intent_core_api.vfx_inbox.current_focus import ShotFocusInputs, derive_current_focus

_SHOT_ID = uuid.uuid4()
_T0 = datetime(2026, 7, 1, tzinfo=UTC)
_T1 = _T0 + timedelta(hours=1)
_T2 = _T0 + timedelta(hours=2)


def _base(**overrides: object) -> ShotFocusInputs:
    defaults: dict[str, object] = dict(
        shot_id=_SHOT_ID,
        core_anchor_confirmed=False,
        active_core_anchor_revision_id=None,
        latest_core_anchor_revision_created_at=None,
        pending_core_anchor_gate_id=None,
        draft_revision_without_gate_exists=False,
        latest_core_anchor_gate_resolved_at=None,
        latest_assessment_id=None,
        latest_assessment_created_at=None,
        latest_signal_attention_level=None,
        re_anchor_proposal_present=False,
        assessment_generation_available=False,
        missing_prerequisite_explanation=None,
    )
    defaults.update(overrides)
    return ShotFocusInputs(**defaults)  # type: ignore[arg-type]


# Canonical scenario table: (scenario name, inputs, expected focus_type).
SCENARIOS: list[tuple[str, ShotFocusInputs, str]] = [
    (
        "pending_gate_outranks_everything",
        _base(
            pending_core_anchor_gate_id=uuid.uuid4(),
            # Even with a medium Signal and available generation also
            # true, the pending gate must still win -- human-exclusive
            # authority outranks advisory Agent interpretation.
            latest_assessment_id=uuid.uuid4(),
            latest_assessment_created_at=_T0,
            latest_signal_attention_level="medium",
            assessment_generation_available=True,
        ),
        "core_anchor_gate_pending",
    ),
    (
        "legacy_draft_without_gate",
        _base(draft_revision_without_gate_exists=True),
        "core_anchor_draft_needs_review",
    ),
    (
        "medium_signal_not_followed_by_anchor_action",
        _base(
            core_anchor_confirmed=True,
            latest_core_anchor_revision_created_at=_T0,
            latest_assessment_id=uuid.uuid4(),
            latest_assessment_created_at=_T1,
            latest_signal_attention_level="medium",
        ),
        "alignment_not_followed_by_anchor_action",
    ),
    (
        "high_signal_not_followed_by_anchor_action",
        _base(
            core_anchor_confirmed=True,
            latest_core_anchor_revision_created_at=_T0,
            latest_assessment_id=uuid.uuid4(),
            latest_assessment_created_at=_T1,
            latest_signal_attention_level="high",
        ),
        "alignment_not_followed_by_anchor_action",
    ),
    (
        "medium_signal_but_newer_anchor_revision_follows",
        _base(
            core_anchor_confirmed=True,
            # A new revision was created *after* the Assessment -- the
            # Assessment has been followed by a real Core Anchor action,
            # so type 3 must not fire even though the Signal is medium.
            latest_core_anchor_revision_created_at=_T2,
            latest_assessment_id=uuid.uuid4(),
            latest_assessment_created_at=_T1,
            latest_signal_attention_level="medium",
        ),
        "none",
    ),
    (
        "medium_signal_but_newer_gate_resolution_follows",
        _base(
            core_anchor_confirmed=True,
            latest_core_anchor_revision_created_at=_T0,
            latest_core_anchor_gate_resolved_at=_T2,
            latest_assessment_id=uuid.uuid4(),
            latest_assessment_created_at=_T1,
            latest_signal_attention_level="medium",
        ),
        "none",
    ),
    (
        "same_instant_is_not_newer",
        _base(
            core_anchor_confirmed=True,
            # Exactly equal timestamps: strict `>` means this does NOT
            # count as "newer than" the Assessment.
            latest_core_anchor_revision_created_at=_T1,
            latest_assessment_id=uuid.uuid4(),
            latest_assessment_created_at=_T1,
            latest_signal_attention_level="medium",
        ),
        "alignment_not_followed_by_anchor_action",
    ),
    (
        "low_signal_with_proposal",
        _base(
            core_anchor_confirmed=True,
            latest_core_anchor_revision_created_at=_T0,
            latest_assessment_id=uuid.uuid4(),
            latest_assessment_created_at=_T1,
            latest_signal_attention_level="low",
            re_anchor_proposal_present=True,
        ),
        "re_anchor_proposal_present",
    ),
    (
        "low_signal_no_proposal_existing_assessment_blocks_generation",
        # Step 7C-1 predicate correction: an existing successful
        # CrossRoleAssessment (latest_assessment_id is set) makes
        # `assessment_generation_available` ineligible even though the
        # input flag itself is True ("prerequisites met for some
        # Task+Version pair" is necessary but not sufficient -- "no
        # Assessment exists yet" is also required). Nothing else is
        # eligible here (signal is low, no proposal), so the honest
        # result is `none`, not a "generate a new assessment" control --
        # that belongs in the future Alignment Workspace (Step 7C-3).
        _base(
            core_anchor_confirmed=True,
            latest_core_anchor_revision_created_at=_T0,
            latest_assessment_id=uuid.uuid4(),
            latest_assessment_created_at=_T1,
            latest_signal_attention_level="low",
            re_anchor_proposal_present=False,
            assessment_generation_available=True,
        ),
        "none",
    ),
    (
        "no_assessment_but_generation_available",
        _base(core_anchor_confirmed=True, assessment_generation_available=True),
        "assessment_generation_available",
    ),
    (
        "no_assessment_prerequisites_missing",
        _base(
            core_anchor_confirmed=True,
            assessment_generation_available=False,
            missing_prerequisite_explanation=(
                "Assessment generation requires a confirmed Execution Anchor, which does not "
                "exist yet for this Shot's Tasks. This is owned by the CG Supervisor."
            ),
        ),
        "none",
    ),
    (
        "nothing_at_all_yet",
        _base(),
        "none",
    ),
]


@pytest.mark.parametrize("name,inputs,expected", SCENARIOS, ids=[s[0] for s in SCENARIOS])
def test_current_focus_scenarios(name: str, inputs: ShotFocusInputs, expected: str) -> None:
    result = derive_current_focus(inputs)
    assert result.focus_type == expected, f"scenario={name!r}"


def test_none_never_renders_a_fake_action() -> None:
    result = derive_current_focus(_base())
    assert result.focus_type == "none"
    assert result.actionable is False
    assert result.primary_action_label is None


def test_none_carries_the_specific_missing_prerequisite_explanation() -> None:
    explanation = "Assessment generation requires a confirmed Execution Anchor."
    result = derive_current_focus(
        _base(core_anchor_confirmed=True, missing_prerequisite_explanation=explanation)
    )
    assert result.focus_type == "none"
    assert result.explanation == explanation


def test_every_actionable_focus_type_has_exactly_one_action_label() -> None:
    for name, inputs, _expected in SCENARIOS:
        result = derive_current_focus(inputs)
        if result.focus_type == "none":
            assert result.primary_action_label is None, name
            assert result.actionable is False, name
        else:
            assert result.primary_action_label is not None, name
            assert result.actionable is True, name


def test_no_persisted_status_language_in_any_wording() -> None:
    forbidden_words = ("unread", "unresolved", "unhandled", "acknowledg")
    for _name, inputs, _expected in SCENARIOS:
        result = derive_current_focus(inputs)
        text = f"{result.title} {result.explanation}".lower()
        for word in forbidden_words:
            assert word not in text
