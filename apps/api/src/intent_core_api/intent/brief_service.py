from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.intent.models import IntentBrief
from intent_core_api.production_context.models import Shot
from intent_core_api.workflow.actors import ActorContext, HumanRole, require_human_role
from intent_core_api.workflow.exceptions import NotFoundError

_MANUAL_CREATE_ROLES: frozenset[HumanRole] = frozenset({"vfx_supervisor"})


async def create_brief(
    session: AsyncSession, actor: ActorContext, shot_id: uuid.UUID, raw_text: str
) -> IntentBrief:
    # Authoritative check: manual IntentBrief creation is VFX-Supervisor-only.
    # This is enforced here in the service regardless of what the router does.
    require_human_role(actor, _MANUAL_CREATE_ROLES)

    shot = await session.get(Shot, shot_id)
    if shot is None:
        raise NotFoundError("Shot not found")

    brief = IntentBrief(
        shot_id=shot_id,
        raw_text=raw_text,
        source="manual",
        created_by_actor_kind=actor.actor_kind,
        created_by_actor_id=actor.actor_id,
        created_by_human_role=actor.human_role,
        source_external_id=None,
    )
    session.add(brief)
    await session.commit()
    await session.refresh(brief)
    return brief


async def get_brief(session: AsyncSession, brief_id: uuid.UUID) -> IntentBrief | None:
    return await session.get(IntentBrief, brief_id)


async def list_briefs_for_shot(session: AsyncSession, shot_id: uuid.UUID) -> list[IntentBrief]:
    result = await session.execute(
        select(IntentBrief).where(IntentBrief.shot_id == shot_id).order_by(IntentBrief.created_at)
    )
    return list(result.scalars().all())
