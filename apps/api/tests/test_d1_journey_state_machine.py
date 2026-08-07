"""Package C journey state-machine regression tests.

Covers CLAUDE_CODE_PACKAGE_C_STATE_MACHINE_REBASE_IMPLEMENTATION.md
Tasks 6-10: referential invariants, the semantic-snapshot read-purity
check, and the J0 -> J1 -> J2 -> J3 transition sequence, all driven
through `demo_seed.d1_journey`'s single canonical graph selector
(`inspect_d1_journey`) and the same real domain actions/endpoints the
product UI itself uses.
"""

from __future__ import annotations

from typing import Any

from httpx import AsyncClient
from intent_core_api.agents.cross_role_assessment_service import generate_cross_role_assessment
from intent_core_api.demo_seed.d1_journey import (
    D1JourneyResult,
    inspect_d1_journey,
    reset_d1_journey,
)
from intent_core_api.demo_seed.d1_scenario import DeterministicD1CrossRoleAssessmentGenerator
from intent_core_api.intent.models import (
    CoreAnchor,
    CoreAnchorRevision,
    ExecutionAnchor,
    ExecutionAnchorRevision,
)
from intent_core_api.versions_and_feedback.models import ArtistAgentGuidance, VFXSupervisorReview
from intent_core_api.workflow.actors import ActorContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

VFX = {"X-Actor-Role": "vfx_supervisor", "X-Actor-Id": "vfx-1"}
CG = {"X-Actor-Role": "cg_supervisor", "X-Actor-Id": "cg-1"}
ARTIST = {"X-Actor-Role": "artist", "X-Actor-Id": "artist-1"}

_SEED_VFX = ActorContext(actor_kind="human", actor_id="test-vfx", human_role="vfx_supervisor")


def _semantic_snapshot(result: D1JourneyResult) -> dict[str, Any]:
    """Stable, comparable journey facts -- everything read-purity must
    leave unchanged. Deliberately excludes `completed_at` (volatile)."""
    return {
        "journey_state": result.journey_state,
        "snapshot": result.snapshot,
        "project_id": result.project_id,
        "shot_id": result.shot_id,
        "task_ids": result.task_ids,
        "version_ids": result.version_ids,
        "counts": dict(result.counts),
        "assessment_ids": result.assessment_ids,
        "proposal_ids": result.proposal_ids,
        "proposal_assessment_ids": dict(result.proposal_assessment_ids),
        "attention_levels": result.attention_levels,
    }


# ---------------------------------------------------------------------------
# Task 8: read-purity regression across every normal GET/page-loader surface
# ---------------------------------------------------------------------------


async def test_read_purity_across_all_normal_pages(
    session: AsyncSession, client: AsyncClient
) -> None:
    reset = await reset_d1_journey(session)
    before = await inspect_d1_journey(session)
    assert before is not None
    snapshot_a = _semantic_snapshot(before)

    animation_task_id, lighting_task_id, comp_task_id = reset.task_ids
    animation_version_id, lighting_version_id, comp_version_id = reset.version_ids

    reads: list[tuple[str, dict[str, str] | None]] = [
        # VFX Home / Inbox / Shots / Shot Overview / Intent / Versions /
        # Alignment / Activity
        ("/vfx/inbox", None),
        (f"/vfx/inbox/{reset.shot_id}", None),
        ("/vfx/anchor-contexts", VFX),
        (f"/vfx/shots/{reset.shot_id}/anchor-context", VFX),
        (f"/vfx/shots/{reset.shot_id}/department-execution-overview", VFX),
        (f"/shots/{reset.shot_id}/versions", None),
        (f"/shots/{reset.shot_id}/activity", None),
        (f"/intent/shots/{reset.shot_id}/core-anchor", None),
        (f"/intent/shots/{reset.shot_id}/core-anchor/revisions", None),
        # CG Home / Inbox / Tasks / Task Overview / Execution / Version
        # Review / Dependencies / Activity
        ("/cg/inbox", None),
        (f"/cg/inbox/{animation_task_id}", None),
        (f"/cg/inbox/{lighting_task_id}", None),
        (f"/cg/inbox/{comp_task_id}", None),
        ("/cg/anchor-contexts", CG),
        (f"/cg/tasks/{animation_task_id}/anchor-context", CG),
        (f"/cg/tasks/{lighting_task_id}/anchor-context", CG),
        (f"/cg/tasks/{comp_task_id}/anchor-context", CG),
        (f"/intent/tasks/{animation_task_id}/execution-anchor", None),
        (f"/intent/tasks/{lighting_task_id}/execution-anchor", None),
        (f"/intent/tasks/{comp_task_id}/execution-anchor", None),
        (f"/tasks/{animation_task_id}/dependencies", None),
        (f"/tasks/{lighting_task_id}/dependencies", None),
        (f"/tasks/{comp_task_id}/dependencies", None),
        (f"/tasks/{animation_task_id}/activity", None),
        (f"/tasks/{lighting_task_id}/activity", None),
        (f"/tasks/{comp_task_id}/activity", None),
        # Artist Home / Inbox / Tasks / Task Overview / Current Version /
        # Feedback History
        ("/artist/inbox", None),
        (f"/artist/inbox/{animation_task_id}", None),
        (f"/artist/inbox/{lighting_task_id}", None),
        (f"/artist/inbox/{comp_task_id}", None),
        ("/artist/anchor-contexts", ARTIST),
        (f"/artist/tasks/{animation_task_id}/anchor-context", ARTIST),
        (f"/artist/tasks/{lighting_task_id}/anchor-context", ARTIST),
        (f"/artist/tasks/{comp_task_id}/anchor-context", ARTIST),
        (f"/tasks/{animation_task_id}/feedback-history", None),
        (f"/tasks/{lighting_task_id}/feedback-history", None),
        (f"/tasks/{comp_task_id}/feedback-history", None),
        # Shot/Task catalogue + Versions
        ("/projects", None),
        ("/shots", None),
        (f"/shots/{reset.shot_id}", None),
        ("/tasks", None),
        (f"/tasks/{animation_task_id}", None),
        (f"/shots/{reset.shot_id}/tasks", None),
        (f"/versions/{animation_version_id}", None),
        (f"/versions/{lighting_version_id}", None),
        (f"/versions/{comp_version_id}", None),
        (f"/versions/{comp_version_id}/review-notes", None),
        (f"/versions/{comp_version_id}/assessments", None),
        # journey-status itself must be a pure read too
        ("/internal/demo/d1/journey-status", None),
    ]

    for path, headers in reads:
        response = await client.get(path, headers=headers)
        assert response.status_code == 200, f"GET {path} -> {response.status_code}: {response.text}"

    after = await inspect_d1_journey(session)
    assert after is not None
    snapshot_b = _semantic_snapshot(after)

    assert snapshot_a == snapshot_b, "opening normal pages must never advance the D1 Journey"


# ---------------------------------------------------------------------------
# Task 6: referential graph invariants
# ---------------------------------------------------------------------------


async def test_referential_invariants_after_assessment(session: AsyncSession) -> None:
    reset = await reset_d1_journey(session)
    _animation_task_id, _lighting_task_id, comp_task_id = reset.task_ids
    _animation_version_id, _lighting_version_id, comp_version_id = reset.version_ids

    assessment = await generate_cross_role_assessment(
        session,
        _SEED_VFX,
        comp_version_id,
        comp_task_id,
        generator=DeterministicD1CrossRoleAssessmentGenerator(),
    )

    result = await inspect_d1_journey(session)
    assert result is not None
    assert result.journey_state == "assessment_complete"

    # Every current assessment/proposal/signal id the canonical graph
    # selector reports must be the one just generated -- not some other,
    # noncanonical row.
    assert result.assessment_ids == (assessment.id,)
    assert len(result.proposal_ids) == 1
    proposal_id = result.proposal_ids[0]
    # A Proposal must reference a parent Assessment inside the canonical
    # graph -- never a dangling or foreign one.
    assert result.proposal_assessment_ids[proposal_id] == assessment.id
    assert result.proposal_assessment_ids[proposal_id] in result.assessment_ids

    # Guidance/Review scoping: every current Guidance/CG Review/VFX
    # Review the graph counted must genuinely belong to a canonical Task/
    # Version, confirmed via the real FK-backed rows, not just a count.
    guidance_rows = list(
        (
            await session.scalars(
                select(ArtistAgentGuidance).where(ArtistAgentGuidance.task_id.in_(reset.task_ids))
            )
        ).all()
    )
    assert len(guidance_rows) == result.counts["guidance"]
    assert all(row.version_id in reset.version_ids for row in guidance_rows)

    vfx_review_rows = list(
        (
            await session.scalars(
                select(VFXSupervisorReview).where(
                    VFXSupervisorReview.version_id.in_(reset.version_ids)
                )
            )
        ).all()
    )
    assert len(vfx_review_rows) == result.counts["vfx_reviews"]
    assert all(row.shot_id == reset.shot_id for row in vfx_review_rows)


# ---------------------------------------------------------------------------
# Task 9: J0 -> J1 transition
# ---------------------------------------------------------------------------


async def test_j0_to_j1_real_default_generator_produces_medium_not_high(
    session: AsyncSession, client: AsyncClient
) -> None:
    """Documents an empirically-verified, pre-existing product-behaviour
    gap discovered while building this transition test (not introduced
    by the Package C journey rebase): the real
    `POST /versions/{id}/cross-role-assessments/generate` action -- the
    same endpoint the real Alignment UI's "Generate Cross-role
    Assessment" button calls -- uses whichever generator
    `model_gateway.resolve_provider_name()` resolves. In this
    environment (and in any default local/dev/test environment, since
    `MODEL_PROVIDER` defaults to "deterministic") that resolves to
    `DeterministicCrossRoleAssessmentGenerator`, which its own module
    docstring documents as deliberately keeping every finding at low/
    medium priority and never proposing a re-anchor. Fed the canonical
    J0 evidence, it can therefore never reach "high" attention or a
    Re-anchor Proposal -- only a live model provider (MODEL_PROVIDER=
    deepseek) or the D1-Demo-only `DeterministicD1CrossRoleAssessmentGenerator`
    (used internally by Reset/Load-Completed, see
    `test_j0_to_j1_transition_with_warranting_generator` below) can.

    journey-status honestly reflects this: per the locked J1 invariant
    (assessment=1, high attention), a medium-attention assessment does
    not satisfy J1 and `journey_state` correctly stays "mixed" rather
    than being guessed as the closest snapshot -- see
    ICAS_PACKAGE_C_JOURNEY_REBASE_CLAUDE_HANDOFF.md §8. This is flagged
    in the implementation report for an explicit product decision; nei-
    ther the real Agent generation contract nor the demo-only generator
    was changed to paper over it.
    """
    reset = await reset_d1_journey(session)
    _animation_task_id, _lighting_task_id, comp_task_id = reset.task_ids
    _animation_version_id, _lighting_version_id, comp_version_id = reset.version_ids

    response = await client.post(
        f"/intent/versions/{comp_version_id}/cross-role-assessments/generate",
        json={"task_id": str(comp_task_id)},
        headers=VFX,
    )
    assert response.status_code == 201, response.text

    result = await inspect_d1_journey(session)
    assert result is not None
    assert result.counts["assessments"] == 1
    assert result.counts["proposals"] == 0
    assert result.attention_levels == ("medium",)
    assert result.journey_state == "mixed"


async def test_j0_to_j1_transition_with_warranting_generator(session: AsyncSession) -> None:
    """The state-machine classification side of Transition A
    (ICAS_PACKAGE_C_JOURNEY_REBASE_CLAUDE_HANDOFF.md §11): once a
    genuinely high-attention, re-anchor-warranting assessment exists --
    exactly the shape Reset/Load-Completed's own
    `DeterministicD1CrossRoleAssessmentGenerator` produces, still through
    the same real, unbypassed `generate_cross_role_assessment` service
    call the real endpoint uses -- `journey_state` correctly reaches
    "assessment_complete" (J1) with no Core Draft yet.
    """
    reset = await reset_d1_journey(session)
    _animation_task_id, _lighting_task_id, comp_task_id = reset.task_ids
    _animation_version_id, _lighting_version_id, comp_version_id = reset.version_ids

    await generate_cross_role_assessment(
        session,
        _SEED_VFX,
        comp_version_id,
        comp_task_id,
        generator=DeterministicD1CrossRoleAssessmentGenerator(),
    )

    result = await inspect_d1_journey(session)
    assert result is not None
    assert result.journey_state == "assessment_complete"
    assert result.counts["assessments"] == 1
    assert result.counts["proposals"] == 1
    assert result.attention_levels == ("high",)
    assert result.counts["core_drafts"] == 0
    # J0 baseline otherwise untouched.
    assert result.counts["core_anchor_confirmed_revisions"] == 1
    assert result.counts["execution_anchor_confirmed_revisions"] == 3
    assert result.counts["execution_drafts"] == 0
    assert result.counts["versions"] == 3


# ---------------------------------------------------------------------------
# Task 10: J1 -> J2 -> J3 transitions
# ---------------------------------------------------------------------------


async def test_j1_to_j2_use_proposal_creates_core_draft(
    session: AsyncSession, client: AsyncClient
) -> None:
    """Transition B (ICAS_PACKAGE_C_JOURNEY_REBASE_CLAUDE_HANDOFF.md
    §11): the Human VFX Supervisor's real "start a new Core Anchor draft
    from the confirmed revision" action -- the same one the Intent
    Workspace's own Core Anchor editor uses to let the Supervisor review
    the Proposal's evidence and begin drafting R2. R1 remains
    authoritative; nothing downstream is auto-rewritten.
    """
    reset = await reset_d1_journey(session)
    _animation_task_id, _lighting_task_id, comp_task_id = reset.task_ids
    _animation_version_id, _lighting_version_id, comp_version_id = reset.version_ids

    await generate_cross_role_assessment(
        session,
        _SEED_VFX,
        comp_version_id,
        comp_task_id,
        generator=DeterministicD1CrossRoleAssessmentGenerator(),
    )
    j1 = await inspect_d1_journey(session)
    assert j1 is not None and j1.journey_state == "assessment_complete"

    response = await client.post(
        f"/intent/shots/{reset.shot_id}/core-anchor/drafts/from-confirmed", headers=VFX
    )
    assert response.status_code == 201, response.text
    draft = response.json()
    assert draft["status"] == "draft"
    assert draft["revision_number"] == 2

    result = await inspect_d1_journey(session)
    assert result is not None
    assert result.journey_state == "reanchor_draft"
    assert result.counts["core_drafts"] == 1
    assert result.counts["core_anchor_confirmed_revisions"] == 1  # R1 still authoritative
    assert result.counts["core_anchor_revisions"] == 2  # R1 confirmed + R2 draft
    # J1's assessment/proposal remain untouched, immutable historical
    # evidence -- not rewritten by starting a draft.
    assert result.assessment_ids == j1.assessment_ids
    assert result.proposal_ids == j1.proposal_ids
    # Nothing downstream of the Core Anchor was auto-regenerated.
    assert result.counts["execution_anchor_confirmed_revisions"] == 3
    assert result.counts["execution_drafts"] == 0
    assert result.counts["versions"] == 3
    assert result.counts["guidance"] == 3
    assert result.counts["cg_reviews"] == 3
    assert result.counts["vfx_reviews"] == 1


async def test_j2_to_j3_confirm_r2_downstream_not_auto_replaced(
    session: AsyncSession, client: AsyncClient
) -> None:
    """Transition C: the Human VFX Supervisor's real "confirm this
    revision" action. R1 becomes historical/superseded; R2 becomes
    current confirmed. Execution Anchors, Reviews, and Guidance are
    *not* silently regenerated against R2 -- they remain the real R1-era
    rows, exactly as §11's "Assert that downstream R1 outputs are not
    silently replaced" requires.
    """
    reset = await reset_d1_journey(session)
    _animation_task_id, _lighting_task_id, comp_task_id = reset.task_ids
    _animation_version_id, _lighting_version_id, comp_version_id = reset.version_ids

    await generate_cross_role_assessment(
        session,
        _SEED_VFX,
        comp_version_id,
        comp_task_id,
        generator=DeterministicD1CrossRoleAssessmentGenerator(),
    )
    before_draft = await inspect_d1_journey(session)
    assert before_draft is not None

    draft_response = await client.post(
        f"/intent/shots/{reset.shot_id}/core-anchor/drafts/from-confirmed", headers=VFX
    )
    assert draft_response.status_code == 201, draft_response.text
    draft_id = draft_response.json()["id"]

    r1_execution_confirmed_ids = {
        row.id
        for row in (
            await session.scalars(
                select(ExecutionAnchorRevision).where(
                    ExecutionAnchorRevision.execution_anchor_id.in_(
                        select(ExecutionAnchor.id).where(
                            ExecutionAnchor.task_id.in_(reset.task_ids)
                        )
                    ),
                    ExecutionAnchorRevision.status == "confirmed",
                )
            )
        ).all()
    }
    r1_guidance_ids = {
        row.id
        for row in (
            await session.scalars(
                select(ArtistAgentGuidance).where(ArtistAgentGuidance.task_id.in_(reset.task_ids))
            )
        ).all()
    }

    confirm_response = await client.post(
        f"/intent/core-anchor-revisions/{draft_id}/confirm",
        json={"rationale": "Human VFX confirmed Core Anchor R2 after reviewing the Proposal."},
        headers=VFX,
    )
    assert confirm_response.status_code == 200, confirm_response.text
    confirmed = confirm_response.json()
    assert confirmed["status"] == "confirmed"
    assert confirmed["revision_number"] == 2

    result = await inspect_d1_journey(session)
    assert result is not None
    assert result.journey_state == "r2_confirmed"
    assert result.counts["core_anchor_revisions"] == 2  # R1 (superseded) + R2 (confirmed)
    assert result.counts["core_anchor_confirmed_revisions"] == 1  # only R2 is "confirmed" now
    assert result.counts["core_drafts"] == 0

    # R1's own revision row (revision_number == 1 for this Shot's Core
    # Anchor) must now report "superseded", never silently deleted or
    # rewritten.
    core_anchor_id = await session.scalar(
        select(CoreAnchor.id).where(CoreAnchor.shot_id == reset.shot_id)
    )
    r1_revision = await session.scalar(
        select(CoreAnchorRevision).where(
            CoreAnchorRevision.core_anchor_id == core_anchor_id,
            CoreAnchorRevision.revision_number == 1,
        )
    )
    assert r1_revision is not None
    assert r1_revision.status == "superseded"

    # Downstream: Execution Anchors, CG/VFX Reviews, Guidance remain the
    # exact real R1-era rows -- not auto-regenerated, not deleted.
    assert result.counts["execution_anchor_confirmed_revisions"] == 3
    assert result.counts["execution_drafts"] == 0
    assert result.counts["guidance"] == 3
    assert result.counts["cg_reviews"] == 3
    assert result.counts["vfx_reviews"] == 1
    current_execution_confirmed_ids = {
        row.id
        for row in (
            await session.scalars(
                select(ExecutionAnchorRevision).where(
                    ExecutionAnchorRevision.execution_anchor_id.in_(
                        select(ExecutionAnchor.id).where(
                            ExecutionAnchor.task_id.in_(reset.task_ids)
                        )
                    ),
                    ExecutionAnchorRevision.status == "confirmed",
                )
            )
        ).all()
    }
    assert current_execution_confirmed_ids == r1_execution_confirmed_ids
    current_guidance_ids = {
        row.id
        for row in (
            await session.scalars(
                select(ArtistAgentGuidance).where(ArtistAgentGuidance.task_id.in_(reset.task_ids))
            )
        ).all()
    }
    assert current_guidance_ids == r1_guidance_ids
