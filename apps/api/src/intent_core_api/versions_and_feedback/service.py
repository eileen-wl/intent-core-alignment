from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.production_context.models import Shot
from intent_core_api.versions_and_feedback.models import ReviewNote, Version
from intent_core_api.workflow.actors import ActorContext, HumanRole, require_human_role
from intent_core_api.workflow.exceptions import NotFoundError

# Unlike IntentBrief (VFX-Supervisor-only) or Core Anchor confirm/reject
# (VFX-Supervisor-only), submitting a Version or adding a Review Note is
# not restricted to one role (docs/ROLE_PERMISSIONS.md: "Submit a
# Version" and "Add original Review Note" both list all three human
# roles) -- any human actor qualifies, no human role is rejected here.
_MANUAL_CREATE_ROLES: frozenset[HumanRole] = frozenset(
    {"vfx_supervisor", "cg_supervisor", "artist"}
)


async def create_version(
    session: AsyncSession,
    actor: ActorContext,
    shot_id: uuid.UUID,
    *,
    name: str,
    version_number: int | None,
    description: str,
) -> Version:
    # Authoritative check: enforced here regardless of what the router
    # does, matching intent.brief_service's own precedent. Also the only
    # thing standing between an agent/system actor and this route --
    # require_human_role rejects any non-"human" actor_kind outright.
    require_human_role(actor, _MANUAL_CREATE_ROLES)

    shot = await session.get(Shot, shot_id)
    if shot is None:
        raise NotFoundError("Shot not found")

    version = Version(
        shot_id=shot_id,
        name=name,
        version_number=version_number,
        description=description,
        source="manual",
        created_by_actor_kind=actor.actor_kind,
        created_by_actor_id=actor.actor_id,
        created_by_human_role=actor.human_role,
    )
    session.add(version)
    await session.commit()
    await session.refresh(version)
    return version


async def get_version(session: AsyncSession, version_id: uuid.UUID) -> Version | None:
    return await session.get(Version, version_id)


async def list_versions_for_shot(session: AsyncSession, shot_id: uuid.UUID) -> list[Version]:
    result = await session.execute(
        select(Version).where(Version.shot_id == shot_id).order_by(Version.created_at)
    )
    return list(result.scalars().all())


async def create_review_note(
    session: AsyncSession, actor: ActorContext, version_id: uuid.UUID, *, content: str
) -> ReviewNote:
    require_human_role(actor, _MANUAL_CREATE_ROLES)

    version = await session.get(Version, version_id)
    if version is None:
        raise NotFoundError("Version not found")

    note = ReviewNote(
        version_id=version_id,
        content=content,
        source="manual",
        created_by_actor_kind=actor.actor_kind,
        created_by_actor_id=actor.actor_id,
        created_by_human_role=actor.human_role,
    )
    session.add(note)
    await session.commit()
    await session.refresh(note)
    return note


async def list_review_notes_for_version(
    session: AsyncSession, version_id: uuid.UUID
) -> list[ReviewNote]:
    result = await session.execute(
        select(ReviewNote)
        .where(ReviewNote.version_id == version_id)
        .order_by(ReviewNote.created_at)
    )
    return list(result.scalars().all())
