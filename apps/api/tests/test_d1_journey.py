from __future__ import annotations

from intent_core_api.demo_seed.d1_journey import (
    ANIMATION_TASK_EXTERNAL_ID,
    CANONICAL_TASK_EXTERNAL_IDS,
    load_completed_d1_journey,
    reset_d1_journey,
)
from intent_core_api.demo_seed.d1_scenario import (
    D1_PROJECT_EXTERNAL_ID,
    D1_SHOT_EXTERNAL_ID,
    UNINITIALIZED_SHOT_EXTERNAL_ID,
    ensure_d1_scenario,
)
from intent_core_api.integrations.external_link_service import find_linked_entity_id
from intent_core_api.integrations.models import ExternalEntityLink
from intent_core_api.production_context.models import Shot
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


async def test_reset_reuses_d1_shot_and_creates_three_department_journey(
    session: AsyncSession,
) -> None:
    baseline = await ensure_d1_scenario(session)
    result = await reset_d1_journey(session)

    assert result.snapshot == "reset"
    assert result.project_id == baseline.project_id
    assert result.shot_id == baseline.shot_id
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


async def test_reset_completed_reset_preserves_other_d1_fixture(session: AsyncSession) -> None:
    baseline = await ensure_d1_scenario(session)
    await reset_d1_journey(session)
    await load_completed_d1_journey(session)
    final = await reset_d1_journey(session)

    assert final.shot_id == baseline.shot_id
    uninitialized_id = await find_linked_entity_id(
        session,
        entity_type="shot",
        source="demo",
        external_id=UNINITIALIZED_SHOT_EXTERNAL_ID,
    )
    assert uninitialized_id == baseline.uninitialized_shot_id
    assert await session.get(Shot, uninitialized_id) is not None
    assert (
        await find_linked_entity_id(
            session, entity_type="project", source="demo", external_id=D1_PROJECT_EXTERNAL_ID
        )
        == baseline.project_id
    )
    assert (
        await find_linked_entity_id(
            session, entity_type="shot", source="demo", external_id=D1_SHOT_EXTERNAL_ID
        )
        == baseline.shot_id
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
