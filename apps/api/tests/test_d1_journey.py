from __future__ import annotations

import json

import pytest
from intent_core_api.agents import cg_supervisor_review_service
from intent_core_api.agents.cg_supervisor_review_service import (
    DeterministicCGSupervisorReviewGenerator,
)
from intent_core_api.cross_department.models import TaskDependency
from intent_core_api.demo_seed import d1_journey
from intent_core_api.demo_seed.d1_journey import (
    ANIMATION_TASK_EXTERNAL_ID,
    CANONICAL_TASK_EXTERNAL_IDS,
    D1_SHOT_EXTERNAL_ID,
    inspect_d1_journey,
    load_completed_d1_journey,
    reset_d1_journey,
)
from intent_core_api.demo_seed.d1_scenario import (
    D1_PROJECT_EXTERNAL_ID,
    UNINITIALIZED_SHOT_EXTERNAL_ID,
    ensure_d1_scenario,
    resolve_or_create_canonical_root,
)
from intent_core_api.integrations.external_link_service import (
    find_linked_entity_id,
    record_external_link,
)
from intent_core_api.integrations.models import ExternalEntityLink
from intent_core_api.intent.models import (
    CGSupervisorReview,
    Constraint,
    ExecutionAnchor,
    ExecutionAnchorRevision,
)
from intent_core_api.production_context.models import Shot
from intent_core_api.versions_and_feedback.models import (
    ArtistAgentGuidance,
    CrossRoleAssessment,
    Version,
    VFXSupervisorReview,
)
from intent_core_api.workflow.actors import ActorContext
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession


async def test_reset_reuses_d1_shot_and_creates_three_department_journey(
    session: AsyncSession,
) -> None:
    baseline_project, baseline_shot = await resolve_or_create_canonical_root(session)
    result = await reset_d1_journey(session)

    assert result.snapshot == "reset"
    assert result.project_id == baseline_project.id
    assert result.shot_id == baseline_shot.id
    assert result.counts["tasks"] == 3
    assert result.counts["versions"] == 3
    assert result.counts["core_anchor_revisions"] == 1
    assert result.counts["execution_anchor_revisions"] == 3
    assert result.counts["assessments"] == 0
    assert (
        await find_linked_entity_id(
            session, entity_type="task", source="demo", external_id=ANIMATION_TASK_EXTERNAL_ID
        )
        is not None
    )
    ids = {
        row.external_id
        for row in (
            await session.scalars(
                select(ExternalEntityLink).where(ExternalEntityLink.entity_id.in_(result.task_ids))
            )
        ).all()
    }
    assert ids == set(CANONICAL_TASK_EXTERNAL_IDS.values())


_FORBIDDEN_INTERNAL_LABELS: tuple[str, ...] = (
    "[CG Agent execution anchor draft",
    "[CG D1 deterministic",
    "[Artist D1 deterministic",
    "[VFX D1 deterministic",
    "[Cross-role D1]",
)


async def test_completed_journey_user_facing_content_has_no_internal_fixture_labels(
    session: AsyncSession,
) -> None:
    """Package C final presentation cleanup: a fresh canonical D1 run's
    Execution Anchor content, Artist Guidance, CG/VFX Reviews, and
    Cross-role Assessment findings must read as real creative/execution
    prose -- never carrying an implementation-oriented bracketed label
    like `[CG Agent execution anchor draft - D1 combined-intensity
    ceiling translation]`. Deliberately does not assert anything about
    the shared, generic deterministic generators' own `"[X
    deterministic]"` labels (`cross_role_assessment_service`/
    `cg_supervisor_review_service`/`artist_guidance_service`'s own base
    classes) -- those are unrelated, generic/non-D1 behaviour this pass
    explicitly leaves untouched.
    """
    completed = await load_completed_d1_journey(session)
    task_ids = list(completed.task_ids)

    execution_revisions = (
        await session.scalars(
            select(ExecutionAnchorRevision).where(
                ExecutionAnchorRevision.execution_anchor_id.in_(
                    select(ExecutionAnchor.id).where(ExecutionAnchor.task_id.in_(task_ids))
                )
            )
        )
    ).all()
    cg_reviews = (
        await session.scalars(
            select(CGSupervisorReview).where(
                CGSupervisorReview.execution_anchor_revision_id.in_(
                    [row.id for row in execution_revisions]
                )
            )
        )
    ).all()
    guidances = (
        await session.scalars(
            select(ArtistAgentGuidance).where(ArtistAgentGuidance.task_id.in_(task_ids))
        )
    ).all()
    vfx_reviews = (
        await session.scalars(
            select(VFXSupervisorReview).where(
                VFXSupervisorReview.version_id.in_(list(completed.version_ids))
            )
        )
    ).all()
    assessments = (
        await session.scalars(
            select(CrossRoleAssessment).where(CrossRoleAssessment.task_id.in_(task_ids))
        )
    ).all()

    blob_parts = [
        *(
            json.dumps(
                {
                    field: getattr(revision, field)
                    for field in (
                        "technical_boundaries",
                        "parameter_ranges",
                        "delivery_conditions",
                        "production_ready_criteria",
                        "downstream_dependencies",
                        "publish_requirements",
                        "allowed_refinements",
                        "escalation_conditions",
                    )
                }
            )
            for revision in execution_revisions
        ),
        *(json.dumps(review.review_output) for review in cg_reviews),
        *(json.dumps(guidance.guidance_output) for guidance in guidances),
        *(json.dumps(review.review_output) for review in vfx_reviews),
        *(json.dumps(assessment.assessment_output) for assessment in assessments),
    ]
    full_blob = "\n".join(blob_parts)
    assert full_blob, "expected real persisted content to check"

    for forbidden in _FORBIDDEN_INTERNAL_LABELS:
        assert forbidden not in full_blob, f"leaked internal label: {forbidden!r}"


async def test_completed_is_bounded_and_idempotent(session: AsyncSession) -> None:
    first = await load_completed_d1_journey(session)
    second = await load_completed_d1_journey(session)

    assert first.snapshot == second.snapshot == "completed"
    assert first.counts == second.counts
    assert first.counts["versions"] == 6
    assert first.counts["core_anchor_revisions"] == 2
    assert first.counts["execution_anchor_revisions"] == 6
    assert first.counts["assessments"] == 2


async def test_completed_dependency_evidence_stays_frozen_and_ceiling_free(
    session: AsyncSession,
) -> None:
    """Package C follow-up (J3 -> J4 Version-publish): J4 is now defined
    from the real canonical graph the formal role flow actually
    produces -- publishing a resolved Version, generating Guidance/
    Reviews, and generating the final Assessment none of them touch
    TaskDependency at all. So the R1-era dependency evidence stays
    exactly at its J0 baseline (2 rows, ceiling-free) all the way
    through J4 `completed`, same as every other downstream fact this
    action doesn't own.
    """
    completed = await load_completed_d1_journey(session)
    comp_task_id = completed.task_ids[2]
    assert completed.counts["dependencies"] == 2

    rows = (
        await session.scalars(select(TaskDependency).where(TaskDependency.task_id == comp_task_id))
    ).all()
    assert len(rows) == 2
    for row in rows:
        lowered = row.description.lower()
        assert "intensity ceiling" not in lowered
        assert "confirmed local range" in lowered


async def test_completed_tolerates_duplicate_cg_reviews_from_repeated_generate_clicks(
    session: AsyncSession,
) -> None:
    """Owner re-validation correction: a Human CG Supervisor regenerating
    an Agent Execution Review against unchanged evidence is a real,
    already-tested product capability (see `test_cg_supervisor_review.
    test_multiple_runs_create_multiple_immutable_reviews`), not a bug --
    so an extra historical/duplicate row (e.g. from repeated explicit
    Generate clicks) must never turn an otherwise-complete graph
    `mixed`, and must never be silently deleted just to satisfy a raw
    count. `_classify_journey_state` checks real per-Task current-
    revision *coverage* (`cg_reviews_current_tasks`), not the raw
    `cg_reviews` total.
    """
    completed = await load_completed_d1_journey(session)
    assert completed.journey_state == "completed"
    animation_task_id = completed.task_ids[0]

    execution_anchor = await session.scalar(
        select(ExecutionAnchor).where(ExecutionAnchor.task_id == animation_task_id)
    )
    assert execution_anchor is not None
    assert execution_anchor.active_revision_id is not None

    cg_actor = ActorContext(actor_kind="human", actor_id="cg-1", human_role="cg_supervisor")
    await cg_supervisor_review_service.generate_cg_supervisor_review(
        session,
        cg_actor,
        execution_anchor.active_revision_id,
        generator=DeterministicCGSupervisorReviewGenerator(),
    )

    after_duplicate = await inspect_d1_journey(session)
    assert after_duplicate is not None
    assert after_duplicate.journey_state == "completed"
    assert after_duplicate.snapshot == "completed"
    assert after_duplicate.counts["cg_reviews"] == 7
    assert after_duplicate.counts["cg_reviews_current_tasks"] == 3


async def test_reset_completed_reset_preserves_other_d1_fixture(session: AsyncSession) -> None:
    # `ensure_d1_scenario` here only stands in for "some other, unrelated
    # D1 fixture exists" (Step 7C-1's uninitialized Shot 020) -- it no
    # longer touches the canonical Journey Shot at all (Package C journey
    # rebase), so its own `shot_id`/`project_id` are deliberately never
    # compared against the Journey's own below.
    fixture = await ensure_d1_scenario(session)
    first = await reset_d1_journey(session)
    await load_completed_d1_journey(session)
    final = await reset_d1_journey(session)

    assert final.shot_id == first.shot_id
    uninitialized_id = await find_linked_entity_id(
        session,
        entity_type="shot",
        source="demo",
        external_id=UNINITIALIZED_SHOT_EXTERNAL_ID,
    )
    assert uninitialized_id == fixture.uninitialized_shot_id
    assert await session.get(Shot, uninitialized_id) is not None
    assert (
        await find_linked_entity_id(
            session, entity_type="project", source="demo", external_id=D1_PROJECT_EXTERNAL_ID
        )
        == fixture.project_id
        == final.project_id
    )
    assert (
        await find_linked_entity_id(
            session, entity_type="shot", source="demo", external_id=D1_SHOT_EXTERNAL_ID
        )
        == final.shot_id
    )


async def test_d1_journey_internal_endpoints(client) -> None:
    missing = await client.get("/internal/demo/d1/journey-status")
    assert missing.status_code == 200

    reset = await client.post("/internal/demo/d1/reset-journey")
    assert reset.status_code == 200
    assert reset.json()["project_external_id"] == D1_PROJECT_EXTERNAL_ID
    assert len(reset.json()["task_ids"]) == 3

    completed = await client.post("/internal/demo/d1/load-completed-journey")
    assert completed.status_code == 200
    assert completed.json()["snapshot"] == "completed"


async def test_reset_removes_normalized_revision_children_from_existing_data(
    session: AsyncSession,
) -> None:
    await load_completed_d1_journey(session)
    assert await session.scalar(select(func.count()).select_from(Constraint)) > 0

    result = await reset_d1_journey(session)

    assert result.snapshot == "reset"
    status = await inspect_d1_journey(session)
    assert status is not None
    assert status.snapshot == "reset"
    assert status.counts["core_drafts"] == status.counts["execution_drafts"] == 0


async def test_status_marks_mixed_data_and_exact_completed_truthfully(
    session: AsyncSession,
) -> None:
    reset = await reset_d1_journey(session)
    session.add(
        Version(
            shot_id=reset.shot_id,
            task_id=reset.task_ids[0],
            name="Injected mixed Version",
            version_number=99,
            description=f"{d1_journey.D1_JOURNEY_MARKER} injected mixed state",
            source="manual",
            created_by_actor_kind="human",
            created_by_actor_id="test",
            created_by_human_role="vfx_supervisor",
        )
    )
    await session.commit()

    mixed = await inspect_d1_journey(session)
    assert mixed is not None
    assert mixed.snapshot == "mixed"
    assert mixed.counts["versions"] == 4

    await load_completed_d1_journey(session)
    completed = await inspect_d1_journey(session)
    assert completed is not None
    assert completed.snapshot == "completed"


async def test_forced_mid_reset_failure_rolls_back_existing_completed_state(
    session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    await load_completed_d1_journey(session)

    async def fail_after_delete(*args, **kwargs):
        raise RuntimeError("forced snapshot failure")

    monkeypatch.setattr(d1_journey, "_anchors", fail_after_delete)
    with pytest.raises(RuntimeError, match="forced snapshot failure"):
        await reset_d1_journey(session)

    status = await inspect_d1_journey(session)
    assert status is not None
    assert status.snapshot == "completed"


async def test_protected_ftrack_link_aborts_without_mutating_reset_state(
    session: AsyncSession,
) -> None:
    reset = await reset_d1_journey(session)
    await record_external_link(
        session,
        entity_type="task",
        entity_id=reset.task_ids[0],
        source="ftrack",
        external_id="ftrack-protected-d1-animation",
    )
    await session.commit()

    with pytest.raises(RuntimeError, match="ftrack-linked"):
        await reset_d1_journey(session)

    status = await inspect_d1_journey(session)
    assert status is not None
    assert status.snapshot == "reset"
