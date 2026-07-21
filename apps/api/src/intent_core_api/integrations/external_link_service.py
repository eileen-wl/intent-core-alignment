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
