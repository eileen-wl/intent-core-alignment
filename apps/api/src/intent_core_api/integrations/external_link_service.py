"""Idempotent-upsert support for production_context's create endpoints.

Kept out of production_context itself (ADR-0010): the connector-
specific concept of an external link stays in the integrations module,
so production_context has no structural dependency on it beyond
calling these two functions.
"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.integrations.models import ExternalEntityLink


async def find_linked_entity_id(
    session: AsyncSession, *, entity_type: str, source: str, external_id: str
) -> uuid.UUID | None:
    result = await session.execute(
        select(ExternalEntityLink.entity_id).where(
            ExternalEntityLink.entity_type == entity_type,
            ExternalEntityLink.source == source,
            ExternalEntityLink.external_id == external_id,
        )
    )
    return result.scalar_one_or_none()


async def find_external_id_for_entity(
    session: AsyncSession, *, entity_type: str, entity_id: uuid.UUID, source: str
) -> str | None:
    """Reverse of ``find_linked_entity_id``: given an internal entity, the
    external id it was synced from, if any (WP-B1.5's Context Snapshot
    needs this; nothing before it did).
    """
    result = await session.execute(
        select(ExternalEntityLink.external_id).where(
            ExternalEntityLink.entity_type == entity_type,
            ExternalEntityLink.entity_id == entity_id,
            ExternalEntityLink.source == source,
        )
    )
    return result.scalar_one_or_none()


async def record_external_link(
    session: AsyncSession, *, entity_type: str, entity_id: uuid.UUID, source: str, external_id: str
) -> None:
    session.add(
        ExternalEntityLink(
            entity_type=entity_type,
            entity_id=entity_id,
            source=source,
            external_id=external_id,
        )
    )


async def list_linked_entities(
    session: AsyncSession, *, entity_type: str, source: str
) -> list[tuple[uuid.UUID, str]]:
    """Every ``(entity_id, external_id)`` pair currently linked for one
    ``entity_type``/``source`` pair -- e.g. every ftrack-linked Shot, for
    Step 8C-4/8C-5's reconciliation worker to enumerate its per-Shot
    sweep. Scoped exactly like ``find_linked_entity_id``; never returns a
    row for a different ``entity_type`` or ``source``.
    """
    result = await session.execute(
        select(ExternalEntityLink.entity_id, ExternalEntityLink.external_id).where(
            ExternalEntityLink.entity_type == entity_type,
            ExternalEntityLink.source == source,
        )
    )
    return [(row.entity_id, row.external_id) for row in result.all()]
