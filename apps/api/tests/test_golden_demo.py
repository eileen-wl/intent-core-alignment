from __future__ import annotations

from intent_core_api.demo_seed.d1_scenario import D1_PROJECT_EXTERNAL_ID, ensure_d1_scenario
from intent_core_api.demo_seed.golden_scenario import (
    GOLDEN_PROJECT_EXTERNAL_ID,
    GOLDEN_TASK_EXTERNAL_IDS,
    load_completed_golden_journey,
    reset_golden_journey,
)
from intent_core_api.integrations.external_link_service import find_linked_entity_id
from intent_core_api.integrations.models import ExternalEntityLink
from intent_core_api.versions_and_feedback.models import CrossRoleAssessment
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession


async def test_reset_creates_isolated_three_department_snapshot(session: AsyncSession) -> None:
    result = await reset_golden_journey(session)

    assert result.snapshot == "reset"
    assert result.counts["projects"] == 1
    assert result.counts["shots"] == 1
    assert result.counts["tasks"] == 3
    assert result.counts["versions"] == 3
    assert result.counts["core_anchor_revisions"] == 1
    assert result.counts["execution_anchor_revisions"] == 3
    assert result.counts["assessments"] == 0
    assert set(GOLDEN_TASK_EXTERNAL_IDS.values()) == {
        row.external_id
        for row in (
            await session.scalars(
                select(ExternalEntityLink).where(
                    ExternalEntityLink.source == "demo",
                    ExternalEntityLink.entity_type == "task",
                )
            )
        ).all()
        if row.external_id.startswith("icas-demo:golden:")
    }


async def test_completed_snapshot_is_bounded_and_idempotent(session: AsyncSession) -> None:
    first = await load_completed_golden_journey(session)
    second = await load_completed_golden_journey(session)

    assert first.snapshot == second.snapshot == "completed"
    assert first.counts == second.counts
    assert first.counts["versions"] == 6
    assert first.counts["core_anchor_revisions"] == 2
    assert first.counts["execution_anchor_revisions"] == 6
    assert first.counts["assessments"] == 2


async def test_reset_completed_reset_does_not_touch_d1(session: AsyncSession) -> None:
    d1 = await ensure_d1_scenario(session)
    await reset_golden_journey(session)
    await load_completed_golden_journey(session)
    await reset_golden_journey(session)

    assert (
        await find_linked_entity_id(
            session,
            entity_type="project",
            source="demo",
            external_id=D1_PROJECT_EXTERNAL_ID,
        )
        == d1.project_id
    )
    assert (
        await find_linked_entity_id(
            session,
            entity_type="project",
            source="demo",
            external_id=GOLDEN_PROJECT_EXTERNAL_ID,
        )
        is not None
    )
    assert await session.scalar(select(func.count()).select_from(CrossRoleAssessment)) == 1


async def test_golden_status_endpoint_returns_summary(client) -> None:
    missing = await client.get("/internal/demo/golden/status")
    assert missing.status_code == 200
    assert missing.json() is None

    reset = await client.post("/internal/demo/golden/reset")
    assert reset.status_code == 200
    body = reset.json()
    assert body["project_external_id"] == GOLDEN_PROJECT_EXTERNAL_ID
    assert len(body["task_ids"]) == 3
    assert body["shot_id"]

    vfx = await client.get("/vfx/inbox", params={"project_external_id": GOLDEN_PROJECT_EXTERNAL_ID})
    cg = await client.get("/cg/inbox", params={"project_external_id": GOLDEN_PROJECT_EXTERNAL_ID})
    artist = await client.get(
        "/artist/inbox", params={"project_external_id": GOLDEN_PROJECT_EXTERNAL_ID}
    )
    assert vfx.status_code == cg.status_code == artist.status_code == 200
    assert len(vfx.json()["items"]) == 1
    assert len(cg.json()["items"]) == len(artist.json()["items"]) == 3
