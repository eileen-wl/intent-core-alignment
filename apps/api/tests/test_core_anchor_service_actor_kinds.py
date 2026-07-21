"""Service-level ActorContext coverage for agent/system actors.

The guard functions in workflow/actors.py already have unit tests
(test_actor_context.py) proving the permission logic in isolation. These
tests instead exercise the full `intent.core_anchor_service` functions
directly with a fabricated agent/system ActorContext -- something no HTTP
request can ever construct (see workflow/actors.py's module docstring) --
to prove the guards are actually wired into the service layer itself, not
just correct on their own.
"""

from __future__ import annotations

import uuid

import pytest
from intent_core_api.intent import core_anchor_service
from intent_core_api.production_context.models import Project, Shot
from intent_core_api.workflow.actors import ActorContext, build_agent_actor
from intent_core_api.workflow.exceptions import ForbiddenActionError
from sqlalchemy.ext.asyncio import AsyncSession

VFX_ACTOR = ActorContext(actor_kind="human", actor_id="vfx-1", human_role="vfx_supervisor")


async def _create_shot(session: AsyncSession) -> uuid.UUID:
    project = Project(name="Demo")
    session.add(project)
    await session.flush()
    shot = Shot(project_id=project.id, name="SH010")
    session.add(shot)
    await session.flush()
    return shot.id


async def test_core_agent_can_create_draft_revision(session: AsyncSession) -> None:
    shot_id = await _create_shot(session)
    agent = build_agent_actor("core_agent", uuid.uuid4())

    revision = await core_anchor_service.create_draft_revision(session, agent, shot_id, {})

    assert revision.status == "draft"
    assert revision.created_by_actor_kind == "agent"
    assert revision.created_by_agent_type == "core_agent"
    assert revision.created_by_human_role is None


async def test_non_permitted_agent_type_cannot_create_draft_revision(session: AsyncSession) -> None:
    shot_id = await _create_shot(session)
    agent = build_agent_actor("cg_supervisor_agent", uuid.uuid4())

    with pytest.raises(ForbiddenActionError):
        await core_anchor_service.create_draft_revision(session, agent, shot_id, {})


async def test_agent_cannot_update_draft(session: AsyncSession) -> None:
    shot_id = await _create_shot(session)
    revision = await core_anchor_service.create_draft_revision(session, VFX_ACTOR, shot_id, {})
    agent = build_agent_actor("core_agent", uuid.uuid4())

    with pytest.raises(ForbiddenActionError):
        await core_anchor_service.update_draft_revision(
            session, agent, revision.id, {"shot_objective": "hijacked"}
        )


async def test_agent_cannot_confirm_revision(session: AsyncSession) -> None:
    shot_id = await _create_shot(session)
    revision = await core_anchor_service.create_draft_revision(session, VFX_ACTOR, shot_id, {})
    agent = build_agent_actor("core_agent", uuid.uuid4())

    with pytest.raises(ForbiddenActionError):
        await core_anchor_service.confirm_revision(session, agent, revision.id)


async def test_agent_cannot_reject_revision(session: AsyncSession) -> None:
    shot_id = await _create_shot(session)
    revision = await core_anchor_service.create_draft_revision(session, VFX_ACTOR, shot_id, {})
    agent = build_agent_actor("core_agent", uuid.uuid4())

    with pytest.raises(ForbiddenActionError):
        await core_anchor_service.reject_revision(session, agent, revision.id)


async def test_system_actor_cannot_update_confirm_or_reject(session: AsyncSession) -> None:
    shot_id = await _create_shot(session)
    revision = await core_anchor_service.create_draft_revision(session, VFX_ACTOR, shot_id, {})
    system_actor = ActorContext.system()

    with pytest.raises(ForbiddenActionError):
        await core_anchor_service.update_draft_revision(
            session, system_actor, revision.id, {"shot_objective": "hijacked"}
        )
    with pytest.raises(ForbiddenActionError):
        await core_anchor_service.confirm_revision(session, system_actor, revision.id)
    with pytest.raises(ForbiddenActionError):
        await core_anchor_service.reject_revision(session, system_actor, revision.id)
