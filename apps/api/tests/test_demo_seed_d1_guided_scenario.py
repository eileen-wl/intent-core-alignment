"""Guided D1 walkthrough scenario seed (Step 7C-2).

Verifies `ensure_d1_guided_scenario` produces a Shot that starts at Core
Anchor lifecycle state 1 (INITIAL EMPTY), distinct from the rich,
fully-seeded D1 Shot `ensure_d1_scenario` produces, and that the guided
Shot is excluded from the Alignment Inbox `list_inbox_items` reads.
"""

from __future__ import annotations

from httpx import AsyncClient
from intent_core_api.demo_seed.d1_scenario import (
    D1_GUIDED_SHOT_EXTERNAL_ID,
    D1_SHOT_EXTERNAL_ID,
    ensure_d1_guided_scenario,
    ensure_d1_scenario,
)
from intent_core_api.integrations.external_link_service import find_linked_entity_id
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
    Version,
    VFXSupervisorReview,
)
from intent_core_api.vfx_inbox.service import get_inbox_item_for_shot, list_inbox_items
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession


async def _count(session: AsyncSession, model: type) -> int:
    return (await session.execute(select(func.count()).select_from(model))).scalar_one()


async def test_guided_scenario_creates_shot_with_zero_core_anchor_rows(
    session: AsyncSession,
) -> None:
    result = await ensure_d1_guided_scenario(session)

    assert await _count(session, Shot) == 1
    assert await _count(session, Task) == 1
    assert await _count(session, Version) == 1
    assert await _count(session, CoreAnchor) == 0
    assert await _count(session, CoreAnchorRevision) == 0
    assert await _count(session, HumanGate) == 0

    shot = await session.get(Shot, result.shot_id)
    assert shot is not None


async def test_guided_scenario_has_no_execution_anchor_or_downstream_assessment(
    session: AsyncSession,
) -> None:
    await ensure_d1_guided_scenario(session)

    assert await _count(session, ExecutionAnchor) == 0
    assert await _count(session, ExecutionAnchorRevision) == 0
    assert await _count(session, VFXSupervisorReview) == 0
    assert await _count(session, CGSupervisorReview) == 0
    assert await _count(session, ArtistAgentGuidance) == 0
    assert await _count(session, CrossRoleAssessment) == 0


async def test_guided_and_rich_shot_ids_are_distinct(session: AsyncSession) -> None:
    rich = await ensure_d1_scenario(session)
    guided = await ensure_d1_guided_scenario(session)

    assert rich.shot_id != guided.shot_id
    assert rich.project_id == guided.project_id  # same seed-owned "D1 Demo Project"

    rich_link = await find_linked_entity_id(
        session, entity_type="shot", source="demo", external_id=D1_SHOT_EXTERNAL_ID
    )
    guided_link = await find_linked_entity_id(
        session, entity_type="shot", source="demo", external_id=D1_GUIDED_SHOT_EXTERNAL_ID
    )
    assert rich_link == rich.shot_id
    assert guided_link == guided.shot_id


async def test_rich_scenario_is_unaffected_by_guided_scenario(session: AsyncSession) -> None:
    rich = await ensure_d1_scenario(session)
    await ensure_d1_guided_scenario(session)

    revision = await session.get(CoreAnchorRevision, rich.core_anchor_revision_id)
    assert revision is not None
    assert revision.status == "confirmed"

    exec_revision = await session.get(ExecutionAnchorRevision, rich.execution_anchor_revision_id)
    assert exec_revision is not None
    assert exec_revision.status == "confirmed"

    # Exactly one confirmed Core Anchor overall -- the rich Shot's --
    # the guided Shot contributed zero.
    assert await _count(session, CoreAnchorRevision) == 1


async def test_guided_scenario_repeated_ensure_is_deterministic(session: AsyncSession) -> None:
    results = [await ensure_d1_guided_scenario(session) for _ in range(3)]
    shot_ids = {result.shot_id for result in results}
    task_ids = {result.task_id for result in results}
    version_ids = {result.version_id for result in results}
    assert len(shot_ids) == 1
    assert len(task_ids) == 1
    assert len(version_ids) == 1

    assert await _count(session, Shot) == 1
    assert await _count(session, Task) == 1
    assert await _count(session, Version) == 1
    assert await _count(session, Project) == 1
    assert await _count(session, CoreAnchor) == 0


async def test_guided_shot_excluded_from_alignment_inbox(session: AsyncSession) -> None:
    rich = await ensure_d1_scenario(session)
    guided = await ensure_d1_guided_scenario(session)

    inbox = await list_inbox_items(session)
    shot_ids_in_inbox = {item.shot_id for item in inbox.items}

    assert rich.shot_id in shot_ids_in_inbox
    assert guided.shot_id not in shot_ids_in_inbox

    # The guided Shot's own Overview/Intent pages must still resolve
    # directly -- only the Inbox *listing* excludes it.
    guided_item = await get_inbox_item_for_shot(session, guided.shot_id)
    assert guided_item is not None
    assert guided_item.core_anchor_state == "none"


async def test_inbox_unaffected_when_no_guided_shot_seeded_yet(session: AsyncSession) -> None:
    """Before `ensure_d1_guided_scenario` has ever run, the exclusion
    lookup finds no linked guided Shot and must not error or filter
    anything out."""
    rich = await ensure_d1_scenario(session)

    inbox = await list_inbox_items(session)
    shot_ids_in_inbox = {item.shot_id for item in inbox.items}
    assert rich.shot_id in shot_ids_in_inbox


async def test_ensure_guided_scenario_endpoint_returns_a_real_shot(
    client: AsyncClient, session: AsyncSession
) -> None:
    response = await client.post("/internal/demo/ensure-d1-guided-scenario")
    assert response.status_code == 200
    body = response.json()
    assert body["shot_id"]
    assert body["project_id"]
    assert body["task_id"]
    assert body["version_id"]

    from uuid import UUID

    item = await get_inbox_item_for_shot(session, UUID(body["shot_id"]))
    assert item is not None
    assert item.core_anchor_state == "none"
    assert item.pending_human_gate_id is None
