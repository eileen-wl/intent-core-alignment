"""Step 7C-1: the approved ExternalSource "demo" contract extension
(docs/step-7/16_STEP_7C0D_...md §2.6/§6) -- proves "demo" is accepted by
the integration-link contract, existing "ftrack" behaviour is unchanged,
and Demo links are never returned or interpreted as real ftrack links by
ftrack-specific lookups (which always filter by an explicit, hardcoded
source="ftrack" -- verified here, not merely assumed).
"""

from __future__ import annotations

import uuid

from intent_core_api.integrations.external_link_service import (
    find_external_id_for_entity,
    find_linked_entity_id,
    record_external_link,
)
from intent_core_api.integrations.models import ExternalEntityLink
from intent_core_contracts.api.integrations import ExternalEntityLinkRead
from sqlalchemy.ext.asyncio import AsyncSession


async def test_external_source_demo_literal_is_accepted() -> None:
    # The contract itself: constructing ExternalEntityLinkRead with
    # source="demo" must not raise a validation error.
    link = ExternalEntityLinkRead(
        id=uuid.uuid4(),
        entity_type="shot",
        entity_id=uuid.uuid4(),
        source="demo",
        external_id="icas-demo:d1:shot-010",
        created_at="2026-07-30T00:00:00Z",
        updated_at="2026-07-30T00:00:00Z",
    )
    assert link.source == "demo"


async def test_demo_link_created_and_found_by_demo_source(session: AsyncSession) -> None:
    entity_id = uuid.uuid4()
    await record_external_link(
        session,
        entity_type="shot",
        entity_id=entity_id,
        source="demo",
        external_id="icas-demo:d1:shot-010",
    )
    await session.commit()

    found = await find_linked_entity_id(
        session, entity_type="shot", source="demo", external_id="icas-demo:d1:shot-010"
    )
    assert found == entity_id

    reverse = await find_external_id_for_entity(
        session, entity_type="shot", entity_id=entity_id, source="demo"
    )
    assert reverse == "icas-demo:d1:shot-010"


async def test_existing_ftrack_behaviour_unchanged(session: AsyncSession) -> None:
    entity_id = uuid.uuid4()
    await record_external_link(
        session,
        entity_type="shot",
        entity_id=entity_id,
        source="ftrack",
        external_id="ftrack-shot-123",
    )
    await session.commit()

    found = await find_linked_entity_id(
        session, entity_type="shot", source="ftrack", external_id="ftrack-shot-123"
    )
    assert found == entity_id


async def test_demo_link_not_found_when_querying_ftrack_source(session: AsyncSession) -> None:
    """A "demo"-sourced link must never be returned or interpreted as a
    real ftrack link -- every ftrack-specific reader in this codebase
    filters by an explicit, hardcoded source="ftrack" (verified by
    inspection: core_agent_service, intent_decomposition_service,
    alignment_assessment_service, integrations.writeback_service all
    pass a literal "ftrack", never a variable). This test proves the
    underlying lookup itself respects that filter, which is what makes
    those call sites safe.
    """
    entity_id = uuid.uuid4()
    await record_external_link(
        session,
        entity_type="shot",
        entity_id=entity_id,
        source="demo",
        external_id="icas-demo:d1:shot-010",
    )
    await session.commit()

    # Same entity_type/entity_id, but a real ftrack-sourced lookup must
    # not see the demo-owned link at all.
    found_by_ftrack = await find_linked_entity_id(
        session, entity_type="shot", source="ftrack", external_id="icas-demo:d1:shot-010"
    )
    assert found_by_ftrack is None

    reverse_by_ftrack = await find_external_id_for_entity(
        session, entity_type="shot", entity_id=entity_id, source="ftrack"
    )
    assert reverse_by_ftrack is None


async def test_demo_and_ftrack_links_can_coexist_for_different_entities(
    session: AsyncSession,
) -> None:
    ftrack_entity = uuid.uuid4()
    demo_entity = uuid.uuid4()
    await record_external_link(
        session,
        entity_type="shot",
        entity_id=ftrack_entity,
        source="ftrack",
        external_id="ftrack-shot-999",
    )
    await record_external_link(
        session,
        entity_type="shot",
        entity_id=demo_entity,
        source="demo",
        external_id="icas-demo:d1:shot-010",
    )
    await session.commit()

    all_links = (await session.execute(ExternalEntityLink.__table__.select())).fetchall()
    sources = {row.source for row in all_links}
    assert sources == {"ftrack", "demo"}
