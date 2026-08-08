from __future__ import annotations

import pytest
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
from intent_core_api.intent.models import Constraint
from intent_core_api.production_context.models import Shot
from intent_core_api.versions_and_feedback.models import Version
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
