from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.audit.models import AuditEvent
from intent_core_api.workflow.actors import ActorContext


async def record_audit_event(
    session: AsyncSession,
    *,
    entity_type: str,
    entity_id: uuid.UUID,
    action: str,
    actor: ActorContext,
    source_context: dict[str, Any] | None = None,
    related_entity_type: str | None = None,
    related_entity_id: uuid.UUID | None = None,
) -> AuditEvent:
    event = AuditEvent(
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        actor_kind=actor.actor_kind,
        actor_id=actor.actor_id,
        actor_human_role=actor.human_role,
        actor_agent_type=actor.agent_type,
        actor_agent_run_id=actor.agent_run_id,
        source_context=source_context or {},
        related_entity_type=related_entity_type,
        related_entity_id=related_entity_id,
    )
    session.add(event)
    await session.flush()
    return event
