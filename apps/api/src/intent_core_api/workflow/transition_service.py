from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.workflow.actors import ActorContext
from intent_core_api.workflow.models import WorkflowTransition


async def record_transition(
    session: AsyncSession,
    *,
    entity_type: str,
    entity_id: uuid.UUID,
    from_state: str,
    to_state: str,
    actor: ActorContext,
    decision_id: uuid.UUID | None = None,
) -> WorkflowTransition:
    transition = WorkflowTransition(
        entity_type=entity_type,
        entity_id=entity_id,
        from_state=from_state,
        to_state=to_state,
        actor_kind=actor.actor_kind,
        actor_id=actor.actor_id,
        actor_human_role=actor.human_role,
        actor_agent_type=actor.agent_type,
        actor_agent_run_id=actor.agent_run_id,
        decision_id=decision_id,
    )
    session.add(transition)
    await session.flush()
    return transition
