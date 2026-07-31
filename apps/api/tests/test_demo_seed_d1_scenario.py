"""Complete D1 Demo scenario seed idempotency (Step 7C-1;
docs/step-7/16_STEP_7C0D_...md §3.4/§5's required test list).
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from intent_core_api.demo_seed.d1_scenario import (
    D1_MARKER,
    D1_SHOT_EXTERNAL_ID,
    UNINITIALIZED_SHOT_EXTERNAL_ID,
    UNINITIALIZED_TASK_EXTERNAL_ID,
    DeterministicD1CrossRoleAssessmentGenerator,
    ensure_d1_scenario,
    reset_uninitialized_shot_core_anchor_state,
)
from intent_core_api.integrations.external_link_service import find_linked_entity_id
from intent_core_api.intent import core_anchor_service
from intent_core_api.intent.models import (
    CGSupervisorReview,
    CoreAnchor,
    CoreAnchorRevision,
    ExecutionAnchor,
    ExecutionAnchorRevision,
    HumanGate,
)
from intent_core_api.production_context.models import Project, Shot, Task
from intent_core_api.versions_and_feedback.models import (
    ArtistAgentGuidance,
    CrossRoleAssessment,
    IntentSignal,
    ReAnchorProposal,
    ReviewNote,
    Version,
    VFXSupervisorReview,
)
from intent_core_api.vfx_inbox.service import get_inbox_item_for_shot, list_inbox_items
from intent_core_api.workflow.actors import ActorContext
from intent_core_api.workflow.exceptions import AgentGenerationError, InternalConsistencyError
from intent_core_api.workflow.models import Decision
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

_TEST_VFX_ACTOR = ActorContext(
    actor_kind="human", actor_id="jordan-lee", human_role="vfx_supervisor"
)


async def _count(session: AsyncSession, model: type) -> int:
    return (await session.execute(select(func.count()).select_from(model))).scalar_one()


async def test_empty_database_creates_full_baseline(session: AsyncSession) -> None:
    result = await ensure_d1_scenario(session)

    # Step 7C-1: this same generic development seed process now also
    # folds in a second, deliberately-unconfirmed Shot (see
    # `test_uninitialized_shot_*` below) -- Shot/Task/Version counts are
    # 2, one per Shot, sharing the one seed-owned Project.
    assert await _count(session, Project) == 1
    assert await _count(session, Shot) == 2
    assert await _count(session, Task) == 2
    assert await _count(session, Version) == 2
    assert await _count(session, CoreAnchorRevision) == 1
    assert await _count(session, ExecutionAnchorRevision) == 1
    assert await _count(session, VFXSupervisorReview) == 1
    assert await _count(session, CGSupervisorReview) == 1
    assert await _count(session, ArtistAgentGuidance) == 1
    assert await _count(session, CrossRoleAssessment) == 1
    assert await _count(session, ReviewNote) == 1
    # Step 7C-1 correction: the baseline now includes exactly one valid,
    # evidence-grounded Re-anchor Proposal alongside its required Intent
    # Signal -- see DeterministicD1CrossRoleAssessmentGenerator.
    assert await _count(session, ReAnchorProposal) == 1
    assert await _count(session, IntentSignal) == 1
    # The uninitialized Shot never gets a CoreAnchor row at all -- the
    # single CoreAnchorRevision above belongs entirely to the rich Shot.
    assert await _count(session, CoreAnchor) == 1

    revision = await session.get(CoreAnchorRevision, result.core_anchor_revision_id)
    assert revision is not None
    assert revision.status == "confirmed"

    exec_revision = await session.get(ExecutionAnchorRevision, result.execution_anchor_revision_id)
    assert exec_revision is not None
    assert exec_revision.status == "confirmed"

    assert result.uninitialized_shot_id != result.shot_id
    uninitialized_shot = await session.get(Shot, result.uninitialized_shot_id)
    assert uninitialized_shot is not None


async def test_already_complete_seed_is_a_no_op(session: AsyncSession) -> None:
    first = await ensure_d1_scenario(session)
    second = await ensure_d1_scenario(session)

    assert first.shot_id == second.shot_id
    assert first.project_id == second.project_id
    assert first.task_id == second.task_id
    assert first.version_id == second.version_id
    assert first.core_anchor_revision_id == second.core_anchor_revision_id
    assert first.execution_anchor_revision_id == second.execution_anchor_revision_id
    assert first.cross_role_assessment_id == second.cross_role_assessment_id
    assert first.uninitialized_shot_id == second.uninitialized_shot_id

    assert await _count(session, Project) == 1
    assert await _count(session, Shot) == 2
    assert await _count(session, Task) == 2
    assert await _count(session, Version) == 2
    assert await _count(session, CoreAnchorRevision) == 1
    assert await _count(session, ExecutionAnchorRevision) == 1
    assert await _count(session, VFXSupervisorReview) == 1
    assert await _count(session, CGSupervisorReview) == 1
    assert await _count(session, ArtistAgentGuidance) == 1
    assert await _count(session, CrossRoleAssessment) == 1
    assert await _count(session, ReAnchorProposal) == 1
    assert await _count(session, IntentSignal) == 1


async def test_partial_seed_resumes_without_duplicating(session: AsyncSession) -> None:
    # Simulate a crash after Project/Shot/Task/Version/IntentBrief but
    # before the Core Anchor baseline, by running only the early phase
    # manually is impractical here -- instead, run the full seed once,
    # delete everything downstream of the confirmed Core Anchor, and
    # confirm a re-run resumes cleanly without recreating the
    # already-resolved Project/Shot/Task/Version/link rows.
    first = await ensure_d1_scenario(session)

    # "Everything downstream of the confirmed Core Anchor" includes the
    # Assessment's required IntentSignal and optional ReAnchorProposal --
    # deleted first since both hold a unique FK to CrossRoleAssessment.
    await session.execute(ReAnchorProposal.__table__.delete())
    await session.execute(IntentSignal.__table__.delete())
    await session.execute(CrossRoleAssessment.__table__.delete())
    await session.execute(ArtistAgentGuidance.__table__.delete())
    await session.execute(CGSupervisorReview.__table__.delete())
    await session.execute(VFXSupervisorReview.__table__.delete())
    await session.commit()

    second = await ensure_d1_scenario(session)

    assert second.shot_id == first.shot_id
    assert second.project_id == first.project_id
    assert second.core_anchor_revision_id == first.core_anchor_revision_id
    assert second.execution_anchor_revision_id == first.execution_anchor_revision_id
    # New Assessment (with its own new Signal and Proposal) generated to
    # fill the gap, but Project/Shot/Task/Version/CoreAnchor/
    # ExecutionAnchor were not recreated, and the recovery does not
    # duplicate the Assessment or Signal.
    assert await _count(session, Project) == 1
    assert await _count(session, Shot) == 2
    assert await _count(session, Task) == 2
    assert await _count(session, Version) == 2
    assert await _count(session, CoreAnchorRevision) == 1
    assert await _count(session, ExecutionAnchorRevision) == 1
    assert await _count(session, VFXSupervisorReview) == 1
    assert await _count(session, CGSupervisorReview) == 1
    assert await _count(session, ArtistAgentGuidance) == 1
    assert await _count(session, CrossRoleAssessment) == 1
    assert await _count(session, IntentSignal) == 1
    assert await _count(session, ReAnchorProposal) == 1


async def test_orphaned_demo_link_fails_loudly(session: AsyncSession) -> None:
    await ensure_d1_scenario(session)
    shot_id = await find_linked_entity_id(
        session, entity_type="shot", source="demo", external_id=D1_SHOT_EXTERNAL_ID
    )
    assert shot_id is not None

    # Simulate an inconsistent seed-owned chain: the linked Shot row is
    # gone but its ExternalEntityLink remains.
    shot = await session.get(Shot, shot_id)
    assert shot is not None
    await session.delete(shot)
    await session.commit()

    import pytest

    with pytest.raises(InternalConsistencyError):
        await ensure_d1_scenario(session)


async def test_repeated_invocation_is_deterministic(session: AsyncSession) -> None:
    results = [await ensure_d1_scenario(session) for _ in range(3)]
    shot_ids = {result.shot_id for result in results}
    assessment_ids = {result.cross_role_assessment_id for result in results}
    assert len(shot_ids) == 1
    assert len(assessment_ids) == 1


async def test_later_live_records_do_not_confuse_baseline_resolution(session: AsyncSession) -> None:
    first = await ensure_d1_scenario(session)
    first_proposal = await session.scalar(
        select(ReAnchorProposal).where(
            ReAnchorProposal.cross_role_assessment_id == first.cross_role_assessment_id
        )
    )
    assert first_proposal is not None

    # A "live" Assessment generated after the baseline (a later, newer
    # row than the seed's own baseline) must not be mistaken for the
    # seed's own baseline on the next ensure call.
    from intent_core_api.agents.cross_role_assessment_service import (
        DeterministicCrossRoleAssessmentGenerator,
        generate_cross_role_assessment,
    )

    live_actor = ActorContext(actor_kind="human", actor_id="maya-chen", human_role="vfx_supervisor")
    live_assessment = await generate_cross_role_assessment(
        session,
        live_actor,
        first.version_id,
        first.task_id,
        generator=DeterministicCrossRoleAssessmentGenerator(),
    )
    assert live_assessment.id != first.cross_role_assessment_id

    second = await ensure_d1_scenario(session)
    # ensure_d1_scenario finds *a* baseline (earliest for the shot) and
    # does not attempt to create a redundant new "baseline" merely
    # because a newer live Assessment now exists.
    assert second.cross_role_assessment_id == first.cross_role_assessment_id
    assert await _count(session, CrossRoleAssessment) == 2
    # The live Assessment used the shared, proposal-free generator, so
    # exactly one ReAnchorProposal exists overall -- the baseline's own,
    # untouched by the id, not overwritten or deleted.
    assert await _count(session, ReAnchorProposal) == 1
    baseline_proposal_after = await session.scalar(
        select(ReAnchorProposal).where(
            ReAnchorProposal.cross_role_assessment_id == first.cross_role_assessment_id
        )
    )
    assert baseline_proposal_after is not None
    assert baseline_proposal_after.id == first_proposal.id


async def test_no_duplicate_intent_signal_or_agent_output_rows(session: AsyncSession) -> None:
    await ensure_d1_scenario(session)
    await ensure_d1_scenario(session)

    from intent_core_api.versions_and_feedback.models import IntentSignal

    assert await _count(session, IntentSignal) == 1
    assert await _count(session, ReviewNote) == 1


async def test_resolved_shot_id_deterministic_across_calls(session: AsyncSession) -> None:
    ids = [(await ensure_d1_scenario(session)).shot_id for _ in range(2)]
    assert ids[0] == ids[1]


async def test_ensure_endpoint_resolves_and_redirect_target_is_a_real_shot(
    client: AsyncClient, session: AsyncSession
) -> None:
    response = await client.post("/internal/demo/ensure-d1-scenario")
    assert response.status_code == 200
    body = response.json()
    assert body["shot_id"]

    item = await get_inbox_item_for_shot(session, __import__("uuid").UUID(body["shot_id"]))
    assert item is not None
    assert item.current_focus.focus_type == "alignment_not_followed_by_anchor_action"
    assert item.latest_signal_attention_level == "high"
    assert item.re_anchor_proposal_present is True


async def test_seeded_signal_is_high_with_valid_proposal(session: AsyncSession) -> None:
    """Verifies, against the real deterministic generator path (not
    assumed), that the seeded baseline now carries a real, evidence-
    grounded Re-anchor Proposal, and that ``derive_intent_signal``
    honestly reaches ``high`` attention as a direct, documented
    consequence of that Proposal's presence (see
    ``derive_intent_signal``'s ``proposal_present`` branch) -- not a
    seed-side shortcut.
    """
    result = await ensure_d1_scenario(session)
    assessment = await session.get(CrossRoleAssessment, result.cross_role_assessment_id)
    assert assessment is not None
    output = assessment.assessment_output
    assert output["re_anchor_proposal"] is not None

    from intent_core_api.agents.cross_role_assessment_service import derive_intent_signal
    from intent_core_contracts.api.cross_role_assessment import CrossRoleAssessmentOutput

    signal = derive_intent_signal(CrossRoleAssessmentOutput.model_validate(output))
    assert signal.attention_level == "high"
    assert signal.re_anchor_proposal_present is True


async def test_seed_content_carries_the_stable_marker(session: AsyncSession) -> None:
    result = await ensure_d1_scenario(session)
    version = await session.get(Version, result.version_id)
    assert version is not None
    assert version.description.startswith(D1_MARKER)


async def test_seed_requires_no_network_or_live_provider(session: AsyncSession) -> None:
    """The seed must not require MODEL_PROVIDER to be anything other than
    the default (test env already sets it to "deterministic" globally in
    conftest.py) -- this test asserts the seed succeeds without the
    seed code itself reading or mutating os.environ.
    """
    import os

    before = dict(os.environ)
    await ensure_d1_scenario(session)
    after = dict(os.environ)
    assert before == after


async def test_proposal_persisted_through_real_service_with_correct_linkage(
    session: AsyncSession,
) -> None:
    """The ReAnchorProposal row's own FK fields (``project_id``,
    ``shot_id``, ``current_core_anchor_revision_id``) are only ever set
    by ``generate_cross_role_assessment``'s ``_persist`` closure -- a
    generator has no way to set them itself. Their presence and
    correctness is direct evidence the row was created by the real
    service call, not manually inserted.
    """
    result = await ensure_d1_scenario(session)
    proposal = await session.scalar(
        select(ReAnchorProposal).where(
            ReAnchorProposal.cross_role_assessment_id == result.cross_role_assessment_id
        )
    )
    assert proposal is not None
    assert proposal.project_id == result.project_id
    assert proposal.shot_id == result.shot_id
    assert proposal.current_core_anchor_revision_id == result.core_anchor_revision_id


async def test_proposal_validation_is_not_bypassed_for_seed_generators(
    session: AsyncSession,
) -> None:
    """Feeds ``generate_cross_role_assessment`` a deliberately-broken D1
    generator variant whose Proposal evidence omits the required
    ``core_anchor_revision`` citation, using the exact same call site
    pattern the real seed uses. If the real
    ``_validate_re_anchor_proposal`` gate were bypassed for Demo
    generators, this call would silently persist an invalid Proposal
    instead of raising.
    """

    class _BrokenEvidenceD1Generator:
        def generate(self, *, snapshot_payload: object) -> object:  # type: ignore[override]
            output = DeterministicD1CrossRoleAssessmentGenerator().generate(
                snapshot_payload=snapshot_payload  # type: ignore[arg-type]
            )
            assert output.re_anchor_proposal is not None
            broken_evidence = [
                ref
                for ref in output.re_anchor_proposal.evidence
                if ref.source_type != "core_anchor_revision"
            ]
            broken_proposal = output.re_anchor_proposal.model_copy(
                update={"evidence": broken_evidence}
            )
            return output.model_copy(update={"re_anchor_proposal": broken_proposal})

    baseline = await ensure_d1_scenario(session)

    from intent_core_api.agents.cross_role_assessment_service import generate_cross_role_assessment

    broken_actor = ActorContext(
        actor_kind="human", actor_id="test-broken-generator", human_role="vfx_supervisor"
    )
    with pytest.raises(AgentGenerationError):
        await generate_cross_role_assessment(
            session,
            broken_actor,
            baseline.version_id,
            baseline.task_id,
            generator=_BrokenEvidenceD1Generator(),  # type: ignore[arg-type]
        )


async def test_seeded_proposal_evidence_satisfies_diversity_rule(session: AsyncSession) -> None:
    """Direct, positive confirmation that the persisted baseline Proposal
    satisfies the real evidence-diversity rule from
    ``_validate_re_anchor_proposal``: evidence spanning at least two
    distinct role categories, plus a ``core_anchor_revision`` citation.
    """
    from intent_core_api.agents.cross_role_assessment_service import _ROLE_CATEGORY_SOURCE_TYPES

    result = await ensure_d1_scenario(session)
    proposal = await session.scalar(
        select(ReAnchorProposal).where(
            ReAnchorProposal.cross_role_assessment_id == result.cross_role_assessment_id
        )
    )
    assert proposal is not None
    output = proposal.proposal_output
    all_evidence = list(output["evidence"])
    for field_proposal in output["proposed_fields"]:
        all_evidence.extend(field_proposal["evidence"])

    role_categories_cited = {
        ref["source_type"]
        for ref in all_evidence
        if ref["source_type"] in _ROLE_CATEGORY_SOURCE_TYPES
    }
    assert len(role_categories_cited) >= 2
    assert any(ref["source_type"] == "core_anchor_revision" for ref in all_evidence)


async def test_seeded_baseline_focus_and_proposal_presence_in_read_model(
    session: AsyncSession,
) -> None:
    """The locked D1 starting Current focus (``alignment_not_followed_by_
    anchor_action``) is unchanged by adding a valid Proposal -- that
    focus type's own predicate accepts both ``medium`` and ``high``
    signal levels, while ``re_anchor_proposal_present`` requires
    ``low`` -- so the Proposal shows up only as honest supporting
    information (``re_anchor_proposal_present``), never as a competing
    Current focus.
    """
    result = await ensure_d1_scenario(session)
    item = await get_inbox_item_for_shot(session, result.shot_id)
    assert item is not None
    assert item.current_focus.focus_type == "alignment_not_followed_by_anchor_action"
    assert item.latest_signal_attention_level == "high"
    assert item.re_anchor_proposal_present is True


async def test_seeded_baseline_next_candidates_are_exactly_the_proposal(
    session: AsyncSession,
) -> None:
    """Predicate-correction regression test (required D1 test item 7):
    the baseline D1 Shot already has a successful CrossRoleAssessment,
    so ``assessment_generation_available`` must never appear as a Next
    candidate even though generation prerequisites remain independently
    satisfied. The only real subordinate candidate is the Proposal.
    """
    result = await ensure_d1_scenario(session)
    item = await get_inbox_item_for_shot(session, result.shot_id)
    assert item is not None
    assert [candidate.focus_type for candidate in item.next_candidates] == [
        "re_anchor_proposal_present"
    ]


async def test_ensure_endpoint_returns_the_corrected_next_candidate_set(
    client: AsyncClient,
) -> None:
    response = await client.post("/internal/demo/ensure-d1-scenario")
    assert response.status_code == 200
    shot_id = response.json()["shot_id"]

    inbox_response = await client.get(f"/vfx/inbox/{shot_id}")
    assert inbox_response.status_code == 200
    body = inbox_response.json()
    assert body["current_focus"]["focus_type"] == "alignment_not_followed_by_anchor_action"
    assert body["re_anchor_proposal_present"] is True
    assert [candidate["focus_type"] for candidate in body["next_candidates"]] == [
        "re_anchor_proposal_present"
    ]


async def test_baseline_seed_introduces_no_pending_human_gate(session: AsyncSession) -> None:
    """The baseline's Core Anchor and Execution Anchor confirmations each
    legitimately open-and-resolve their own HumanGate row (Step 1D/4's
    normal draft -> confirm flow, pre-existing Phase 2 behaviour,
    unrelated to this correction) -- both end up ``status="confirmed"``,
    never left ``"pending"``. The Proposal added by this correction must
    not introduce a HumanGate of its own at all.
    """
    result = await ensure_d1_scenario(session)
    gate_statuses = (
        await session.execute(select(HumanGate.status).where(HumanGate.shot_id == result.shot_id))
    ).scalars().all()
    assert gate_statuses, "expected the Core/Execution Anchor confirmation gates to exist"
    assert all(status != "pending" for status in gate_statuses)
    item = await get_inbox_item_for_shot(session, result.shot_id)
    assert item is not None
    assert item.pending_human_gate_id is None


async def test_shared_deterministic_generator_still_never_proposes(session: AsyncSession) -> None:
    """Regression lock: the shared, general-purpose
    ``DeterministicCrossRoleAssessmentGenerator`` -- used by normal
    production requests and by other tests' fixtures -- remains
    completely unmodified by this correction. Only the D1-scoped
    ``DeterministicD1CrossRoleAssessmentGenerator`` in this seed module
    adds a Proposal.
    """
    result = await ensure_d1_scenario(session)

    from intent_core_api.agents.cross_role_assessment_service import (
        DeterministicCrossRoleAssessmentGenerator,
        generate_cross_role_assessment,
    )

    live_actor = ActorContext(
        actor_kind="human", actor_id="jordan-lee", human_role="vfx_supervisor"
    )
    live_assessment = await generate_cross_role_assessment(
        session,
        live_actor,
        result.version_id,
        result.task_id,
        generator=DeterministicCrossRoleAssessmentGenerator(),
    )
    assert live_assessment.assessment_output["re_anchor_proposal"] is None


# --- Step 7C-1: the normal uninitialized Shot folded into this same
# generic development seed process (replaces the removed Step 7C-2
# Guided-walkthrough-specific scenario/endpoint/Inbox-exclusion) -----------


async def test_uninitialized_shot_has_zero_core_anchor_rows(session: AsyncSession) -> None:
    result = await ensure_d1_scenario(session)

    core_anchor = await session.scalar(
        select(CoreAnchor).where(CoreAnchor.shot_id == result.uninitialized_shot_id)
    )
    assert core_anchor is None

    gate_count = await session.scalar(
        select(func.count())
        .select_from(HumanGate)
        .where(HumanGate.shot_id == result.uninitialized_shot_id)
    )
    assert gate_count == 0


async def test_uninitialized_shot_has_no_execution_anchor_or_downstream_assessment(
    session: AsyncSession,
) -> None:
    result = await ensure_d1_scenario(session)

    uninitialized_task = await session.scalar(
        select(Task).where(Task.shot_id == result.uninitialized_shot_id)
    )
    assert uninitialized_task is not None

    execution_anchor = await session.scalar(
        select(ExecutionAnchor).where(ExecutionAnchor.task_id == uninitialized_task.id)
    )
    assert execution_anchor is None

    assessment = await session.scalar(
        select(CrossRoleAssessment).where(
            CrossRoleAssessment.shot_id == result.uninitialized_shot_id
        )
    )
    assert assessment is None


async def test_uninitialized_and_rich_shot_ids_are_distinct_and_linked(
    session: AsyncSession,
) -> None:
    result = await ensure_d1_scenario(session)

    assert result.uninitialized_shot_id != result.shot_id

    rich_link = await find_linked_entity_id(
        session, entity_type="shot", source="demo", external_id=D1_SHOT_EXTERNAL_ID
    )
    uninitialized_link = await find_linked_entity_id(
        session, entity_type="shot", source="demo", external_id=UNINITIALIZED_SHOT_EXTERNAL_ID
    )
    assert rich_link == result.shot_id
    assert uninitialized_link == result.uninitialized_shot_id

    uninitialized_task_link = await find_linked_entity_id(
        session, entity_type="task", source="demo", external_id=UNINITIALIZED_TASK_EXTERNAL_ID
    )
    assert uninitialized_task_link is not None


async def test_uninitialized_shot_seed_is_deterministic_and_idempotent(
    session: AsyncSession,
) -> None:
    results = [await ensure_d1_scenario(session) for _ in range(3)]
    uninitialized_ids = {result.uninitialized_shot_id for result in results}
    assert len(uninitialized_ids) == 1
    assert await _count(session, Shot) == 2


async def test_rich_scenario_is_unaffected_by_uninitialized_shot(session: AsyncSession) -> None:
    result = await ensure_d1_scenario(session)

    revision = await session.get(CoreAnchorRevision, result.core_anchor_revision_id)
    assert revision is not None
    assert revision.status == "confirmed"

    exec_revision = await session.get(ExecutionAnchorRevision, result.execution_anchor_revision_id)
    assert exec_revision is not None
    assert exec_revision.status == "confirmed"

    # Exactly one confirmed Core Anchor overall -- the rich Shot's --
    # the uninitialized Shot contributed zero.
    assert await _count(session, CoreAnchorRevision) == 1


async def test_uninitialized_shot_appears_normally_in_the_alignment_inbox(
    session: AsyncSession,
) -> None:
    """Step 7C-1: unlike the removed Guided Shot, the uninitialized Shot
    is never excluded from `list_inbox_items` -- there is no more
    Guided/Explore split, so every seeded Shot is a normal Shot.
    """
    result = await ensure_d1_scenario(session)

    inbox = await list_inbox_items(session)
    shot_ids_in_inbox = {item.shot_id for item in inbox.items}

    assert result.shot_id in shot_ids_in_inbox
    assert result.uninitialized_shot_id in shot_ids_in_inbox

    uninitialized_item = await get_inbox_item_for_shot(session, result.uninitialized_shot_id)
    assert uninitialized_item is not None
    assert uninitialized_item.core_anchor_state == "none"
    assert uninitialized_item.pending_human_gate_id is None


async def test_ensure_endpoint_returns_the_uninitialized_shot_id(client: AsyncClient) -> None:
    response = await client.post("/internal/demo/ensure-d1-scenario")
    assert response.status_code == 200
    body = response.json()
    assert body["uninitialized_shot_id"]
    assert body["uninitialized_shot_id"] != body["shot_id"]


# --- Step 7C-2 browser-validation fix #1: reset the uninitialized Shot
# back to INITIAL EMPTY on demand, since the seed endpoint alone only
# ever resolves-or-creates and never resets a Shot a browser session has
# since moved past state 1 -----------------------------------------------


async def test_reset_creates_the_shot_at_initial_empty_on_a_fresh_database(
    session: AsyncSession,
) -> None:
    shot_id = await reset_uninitialized_shot_core_anchor_state(session)

    shot = await session.get(Shot, shot_id)
    assert shot is not None

    core_anchor = await session.scalar(select(CoreAnchor).where(CoreAnchor.shot_id == shot_id))
    assert core_anchor is None
    gate_count = await session.scalar(
        select(func.count()).select_from(HumanGate).where(HumanGate.shot_id == shot_id)
    )
    assert gate_count == 0


async def test_reset_is_a_noop_when_already_initial_empty(session: AsyncSession) -> None:
    first_id = await reset_uninitialized_shot_core_anchor_state(session)
    second_id = await reset_uninitialized_shot_core_anchor_state(session)
    assert first_id == second_id
    assert await _count(session, Shot) == 1


async def test_reset_removes_an_existing_unconfirmed_draft_and_its_human_gate(
    session: AsyncSession,
) -> None:
    shot_id = await reset_uninitialized_shot_core_anchor_state(session)
    draft = await core_anchor_service.create_draft_revision(
        session, _TEST_VFX_ACTOR, shot_id, {"core_summary": "A draft a browser session started."}
    )
    assert await _count(session, CoreAnchorRevision) == 1
    assert await _count(session, HumanGate) == 1

    result_shot_id = await reset_uninitialized_shot_core_anchor_state(session)
    assert result_shot_id == shot_id

    assert await session.get(CoreAnchorRevision, draft.id) is None
    assert await session.scalar(select(CoreAnchor).where(CoreAnchor.shot_id == shot_id)) is None
    assert await _count(session, CoreAnchorRevision) == 0
    assert await _count(session, HumanGate) == 0


async def test_reset_removes_a_confirmed_revision_and_its_decision(session: AsyncSession) -> None:
    shot_id = await reset_uninitialized_shot_core_anchor_state(session)
    draft = await core_anchor_service.create_draft_revision(
        session, _TEST_VFX_ACTOR, shot_id, {"core_summary": "Confirmed then reset."}
    )
    confirmed = await core_anchor_service.confirm_revision(
        session, _TEST_VFX_ACTOR, draft.id, "Confirmed during manual QA."
    )
    assert confirmed.status == "confirmed"
    decision_count_before = await session.scalar(
        select(func.count())
        .select_from(Decision)
        .where(Decision.entity_type == "core_anchor_revision", Decision.entity_id == draft.id)
    )
    assert decision_count_before == 1

    await reset_uninitialized_shot_core_anchor_state(session)

    assert await session.get(CoreAnchorRevision, draft.id) is None
    assert await session.scalar(select(CoreAnchor).where(CoreAnchor.shot_id == shot_id)) is None
    decision_count_after = await session.scalar(
        select(func.count())
        .select_from(Decision)
        .where(Decision.entity_type == "core_anchor_revision", Decision.entity_id == draft.id)
    )
    assert decision_count_after == 0


async def test_reset_never_touches_the_rich_shot_or_other_shots(session: AsyncSession) -> None:
    result = await ensure_d1_scenario(session)
    await core_anchor_service.create_draft_revision(
        session, _TEST_VFX_ACTOR, result.uninitialized_shot_id, {"core_summary": "temp"}
    )

    await reset_uninitialized_shot_core_anchor_state(session)

    rich_revision = await session.get(CoreAnchorRevision, result.core_anchor_revision_id)
    assert rich_revision is not None
    assert rich_revision.status == "confirmed"
    assert await _count(session, Shot) == 2


async def test_reset_endpoint_returns_the_shot_id_and_its_exact_intent_url(
    client: AsyncClient,
) -> None:
    response = await client.post("/internal/demo/reset-uninitialized-shot")
    assert response.status_code == 200
    body = response.json()
    assert body["shot_id"]
    assert body["intent_url"] == f"/vfx/shots/{body['shot_id']}/intent"
