from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.workflow.actors import ActorContext, HumanRole
from intent_core_api.workflow.exceptions import ForbiddenActionError
from intent_core_api.workflow.models import Decision


async def record_decision(
    session: AsyncSession,
    *,
    decision_type: str,
    owning_human_role: HumanRole,
    actor: ActorContext,
    entity_type: str,
    entity_id: uuid.UUID,
    rationale: str | None = None,
    write_back_requested: bool = False,
    supersedes_decision_id: uuid.UUID | None = None,
) -> Decision:
    # Defense-in-depth: every caller already gates on require_can_confirm_or_reject
    # (or the A3 gate-resolution equivalent), but a Decision must never be
    # creatable for a non-human actor regardless of how it's reached.
    if actor.actor_kind != "human":
        raise ForbiddenActionError("Decisions may only be created by a human actor")

    decision = Decision(
        decision_type=decision_type,
        owning_human_role=owning_human_role,
        actor_kind=actor.actor_kind,
        actor_id=actor.actor_id,
        actor_human_role=actor.human_role,
        rationale=rationale,
        entity_type=entity_type,
        entity_id=entity_id,
        write_back_requested=write_back_requested,
        supersedes_decision_id=supersedes_decision_id,
    )
    session.add(decision)
    await session.flush()
    return decision


async def list_decisions_for_entity(
    session: AsyncSession, entity_type: str, entity_id: uuid.UUID
) -> list[Decision]:
    result = await session.execute(
        select(Decision)
        .where(Decision.entity_type == entity_type, Decision.entity_id == entity_id)
        .order_by(Decision.created_at)
    )
    return list(result.scalars().all())
