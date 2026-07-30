"""Next-in-this-Shot subordinate focus candidates (Step 7C-1 targeted
correction §7-§8): the remaining eligible focus-type candidates once the
highest-precedence one has been selected as Current focus, capped at
two, using the same locked six-type precedence as Current-focus
derivation. Mirrors test_vfx_current_focus.py's fixture-table
convention.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import get_args

from intent_core_api.demo_seed.d1_scenario import ensure_d1_scenario
from intent_core_api.vfx_inbox.current_focus import (
    ShotFocusInputs,
    derive_current_focus,
    derive_next_focus_candidates,
    sort_rank_for_focus_type,
)
from intent_core_api.vfx_inbox.service import get_inbox_item_for_shot, list_inbox_items
from intent_core_contracts.api.vfx_inbox import VfxCurrentFocusType
from sqlalchemy.ext.asyncio import AsyncSession

_SHOT_ID = uuid.uuid4()
_T0 = datetime(2026, 7, 1, tzinfo=UTC)
_T1 = _T0 + timedelta(hours=1)

_LEGACY_ALIGNMENT_ASSESSMENT_TYPE = "alignment_assessment"


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


def test_only_one_eligible_candidate_yields_zero_next() -> None:
    inputs = _base(assessment_generation_available=True)
    current = derive_current_focus(inputs)
    next_items = derive_next_focus_candidates(inputs)
    assert current.focus_type == "assessment_generation_available"
    assert next_items == []


def test_pending_gate_and_medium_assessment_yields_alignment_next() -> None:
    inputs = _base(
        pending_core_anchor_gate_id=uuid.uuid4(),
        core_anchor_confirmed=True,
        latest_core_anchor_revision_created_at=_T0,
        latest_assessment_id=uuid.uuid4(),
        latest_assessment_created_at=_T1,
        latest_signal_attention_level="medium",
    )
    current = derive_current_focus(inputs)
    next_items = derive_next_focus_candidates(inputs)
    assert current.focus_type == "core_anchor_gate_pending"
    assert [item.focus_type for item in next_items] == ["alignment_not_followed_by_anchor_action"]


def test_existing_assessment_with_ready_prerequisites_excludes_generation_available() -> None:
    """Predicate-correction regression test: a successful Assessment
    already exists for this Shot, and generation prerequisites also
    happen to still be satisfied (e.g. for a *different* Task/Version
    pair) -- ``assessment_generation_available`` must not be eligible,
    as either Current focus or a Next candidate, once an Assessment
    exists. With nothing else eligible (signal is low, no proposal, no
    gate/draft), the honest outcome is ``none``.
    """
    inputs = _base(
        core_anchor_confirmed=True,
        latest_core_anchor_revision_created_at=_T0,
        latest_assessment_id=uuid.uuid4(),
        latest_assessment_created_at=_T1,
        latest_signal_attention_level="low",
        re_anchor_proposal_present=False,
        assessment_generation_available=True,
    )
    current = derive_current_focus(inputs)
    next_items = derive_next_focus_candidates(inputs)
    assert current.focus_type == "none"
    assert next_items == []


def test_medium_assessment_with_valid_proposal_yields_proposal_next() -> None:
    """A real Proposal on a medium/high-Signal Assessment (the actual
    shape ``derive_intent_signal`` produces, since any Proposal forces
    ``high`` attention) must surface as a subordinate Next item, not
    disappear -- see current_focus.py's `_eligible_focus_candidates`
    comment on why type 4's Next-eligibility no longer requires
    ``latest_signal_attention_level == "low"``.

    ``assessment_generation_available`` is deliberately also True here
    (prerequisites remain satisfied) to reproduce the exact live-
    verification defect this correction fixes: with a real Assessment
    already present, it must never appear in ``next_candidates``.
    """
    inputs = _base(
        core_anchor_confirmed=True,
        latest_core_anchor_revision_created_at=_T0,
        latest_assessment_id=uuid.uuid4(),
        latest_assessment_created_at=_T1,
        latest_signal_attention_level="high",
        re_anchor_proposal_present=True,
        assessment_generation_available=True,
    )
    current = derive_current_focus(inputs)
    next_items = derive_next_focus_candidates(inputs)
    assert current.focus_type == "alignment_not_followed_by_anchor_action"
    assert [item.focus_type for item in next_items] == ["re_anchor_proposal_present"]
    assert "assessment_generation_available" not in [item.focus_type for item in next_items]


def test_draft_plus_assessment_plus_proposal_caps_at_two_ordered_next_items() -> None:
    inputs = _base(
        draft_revision_without_gate_exists=True,
        core_anchor_confirmed=True,
        latest_core_anchor_revision_created_at=_T0,
        latest_assessment_id=uuid.uuid4(),
        latest_assessment_created_at=_T1,
        latest_signal_attention_level="medium",
        re_anchor_proposal_present=True,
        assessment_generation_available=True,
    )
    current = derive_current_focus(inputs)
    next_items = derive_next_focus_candidates(inputs)
    assert current.focus_type == "core_anchor_draft_needs_review"
    assert [item.focus_type for item in next_items] == [
        "alignment_not_followed_by_anchor_action",
        "re_anchor_proposal_present",
    ]
    assert len(next_items) <= 2
    assert "assessment_generation_available" not in [item.focus_type for item in next_items]


def test_pending_gate_plus_existing_assessment_plus_proposal_excludes_generation_available() -> (
    None
):
    """Required test item 4: pending HumanGate + an existing Assessment
    + a valid Proposal (+ prerequisites still independently satisfied)
    -- the HumanGate wins Current focus, the weaker Assessment/Proposal
    candidates follow in locked order, and
    ``assessment_generation_available`` is absent throughout, since an
    Assessment already exists for this Shot.
    """
    inputs = _base(
        pending_core_anchor_gate_id=uuid.uuid4(),
        core_anchor_confirmed=True,
        latest_core_anchor_revision_created_at=_T0,
        latest_assessment_id=uuid.uuid4(),
        latest_assessment_created_at=_T1,
        latest_signal_attention_level="medium",
        re_anchor_proposal_present=True,
        assessment_generation_available=True,
    )
    current = derive_current_focus(inputs)
    next_items = derive_next_focus_candidates(inputs)
    assert current.focus_type == "core_anchor_gate_pending"
    assert [item.focus_type for item in next_items] == [
        "alignment_not_followed_by_anchor_action",
        "re_anchor_proposal_present",
    ]
    assert "assessment_generation_available" not in [item.focus_type for item in next_items]


def test_more_than_three_eligible_candidates_yields_one_current_and_two_next() -> None:
    """Four types are simultaneously eligible here (gate, draft,
    alignment, proposal) -- more than three -- so Current focus takes
    exactly one and Next takes exactly the next two, dropping the rest.
    ``assessment_generation_available`` is *not* among the four eligible
    types at all, because an Assessment already exists for this Shot
    (the predicate correction this test file is named for).
    """
    inputs = _base(
        pending_core_anchor_gate_id=uuid.uuid4(),
        draft_revision_without_gate_exists=True,
        core_anchor_confirmed=True,
        latest_core_anchor_revision_created_at=_T0,
        latest_assessment_id=uuid.uuid4(),
        latest_assessment_created_at=_T1,
        latest_signal_attention_level="medium",
        re_anchor_proposal_present=True,
        assessment_generation_available=True,
    )
    current = derive_current_focus(inputs)
    next_items = derive_next_focus_candidates(inputs)
    assert current.focus_type == "core_anchor_gate_pending"
    assert len(next_items) == 2
    assert [item.focus_type for item in next_items] == [
        "core_anchor_draft_needs_review",
        "alignment_not_followed_by_anchor_action",
    ]
    assert "assessment_generation_available" not in [item.focus_type for item in next_items]


def test_no_eligible_candidates_yields_none_and_zero_next() -> None:
    inputs = _base()
    current = derive_current_focus(inputs)
    next_items = derive_next_focus_candidates(inputs)
    assert current.focus_type == "none"
    assert next_items == []


def test_next_candidates_never_include_none_or_legacy_alignment_assessment() -> None:
    scenarios = [
        _base(assessment_generation_available=True),
        _base(
            pending_core_anchor_gate_id=uuid.uuid4(),
            draft_revision_without_gate_exists=True,
            core_anchor_confirmed=True,
            latest_core_anchor_revision_created_at=_T0,
            latest_assessment_id=uuid.uuid4(),
            latest_assessment_created_at=_T1,
            latest_signal_attention_level="medium",
            re_anchor_proposal_present=True,
            assessment_generation_available=True,
        ),
        _base(),
    ]
    known_types = set(get_args(VfxCurrentFocusType))
    for inputs in scenarios:
        for item in derive_next_focus_candidates(inputs):
            assert item.focus_type != "none"
            assert item.focus_type != _LEGACY_ALIGNMENT_ASSESSMENT_TYPE
            assert item.focus_type in known_types


def test_next_candidates_have_no_duplicate_and_exclude_current() -> None:
    inputs = _base(
        pending_core_anchor_gate_id=uuid.uuid4(),
        draft_revision_without_gate_exists=True,
        core_anchor_confirmed=True,
        latest_core_anchor_revision_created_at=_T0,
        latest_assessment_id=uuid.uuid4(),
        latest_assessment_created_at=_T1,
        latest_signal_attention_level="medium",
        re_anchor_proposal_present=True,
        assessment_generation_available=True,
    )
    current = derive_current_focus(inputs)
    next_items = derive_next_focus_candidates(inputs)
    all_types = [current.focus_type, *[item.focus_type for item in next_items]]
    assert len(all_types) == len(set(all_types))
    assert "assessment_generation_available" not in all_types


def test_next_candidates_are_deterministically_ordered() -> None:
    inputs = _base(
        pending_core_anchor_gate_id=uuid.uuid4(),
        draft_revision_without_gate_exists=True,
        core_anchor_confirmed=True,
        latest_core_anchor_revision_created_at=_T0,
        latest_assessment_id=uuid.uuid4(),
        latest_assessment_created_at=_T1,
        latest_signal_attention_level="medium",
        re_anchor_proposal_present=True,
        assessment_generation_available=True,
    )
    first_run = [item.focus_type for item in derive_next_focus_candidates(inputs)]
    second_run = [item.focus_type for item in derive_next_focus_candidates(inputs)]
    assert first_run == second_run
    ranks = [sort_rank_for_focus_type(focus_type) for focus_type in first_run]
    assert ranks == sorted(ranks)


async def test_inbox_current_focus_matches_shot_specific_current_focus(
    session: AsyncSession,
) -> None:
    """The Inbox list and the Shot-specific endpoint both compose their
    ``VfxInboxItemRead`` through the same ``build_inbox_item`` -- this
    is a real, end-to-end confirmation of that shared derivation, not
    just a code-reading assumption.
    """
    result = await ensure_d1_scenario(session)

    inbox = await list_inbox_items(session)
    inbox_item = next(item for item in inbox.items if item.shot_id == result.shot_id)
    shot_item = await get_inbox_item_for_shot(session, result.shot_id)

    assert shot_item is not None
    assert inbox_item.current_focus == shot_item.current_focus
    assert inbox_item.next_candidates == shot_item.next_candidates
