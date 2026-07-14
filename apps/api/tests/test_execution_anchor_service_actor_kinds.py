"""Service-level ActorContext coverage for agent/system actors, mirroring
test_core_anchor_service_actor_kinds.py: proves the full
create_draft_revision/update_draft_revision/confirm_revision/
reject_revision service functions -- not just the require_* guard
functions in isolation -- correctly admit a cg_supervisor_agent for
drafting and reject agent/system actors for every authoritative action.
"""

from __future__ import annotations

import uuid

import pytest
from intent_core_api.intent import core_anchor_service, execution_anchor_service
from intent_core_api.production_context.models import Project, Shot, Task
from intent_core_api.workflow.actors import ActorContext, build_agent_actor
from intent_core_api.workflow.exceptions import ForbiddenActionError
from sqlalchemy.ext.asyncio import AsyncSession

VFX_ACTOR = ActorContext(actor_kind="human", actor_id="vfx-1", human_role="vfx_supervisor")
CG_ACTOR = ActorContext(actor_kind="human", actor_id="cg-1", human_role="cg_supervisor")


async def _create_task_with_confirmed_core_anchor(session: AsyncSession) -> uuid.UUID:
    project = Project(name="Demo")
    session.add(project)
    await session.flush()
    shot = Shot(project_id=project.id, name="SH010")
    session.add(shot)
    await session.flush()
    task = Task(shot_id=shot.id, name="Lighting Pass", department="lighting")
    session.add(task)
    await session.flush()

    core_draft = await core_anchor_service.create_draft_revision(session, VFX_ACTOR, shot.id, {})
    await core_anchor_service.confirm_revision(session, VFX_ACTOR, core_draft.id)

    return task.id


async def test_cg_supervisor_agent_can_create_draft_revision(session: AsyncSession) -> None:
    task_id = await _create_task_with_confirmed_core_anchor(session)
    agent = build_agent_actor("cg_supervisor_agent", uuid.uuid4())

    revision = await execution_anchor_service.create_draft_revision(session, agent, task_id, {})

    assert revision.status == "draft"
    assert revision.created_by_actor_kind == "agent"
    assert revision.created_by_agent_type == "cg_supervisor_agent"
    assert revision.created_by_human_role is None


async def test_non_permitted_agent_type_cannot_create_draft_revision(session: AsyncSession) -> None:
    task_id = await _create_task_with_confirmed_core_anchor(session)
    agent = build_agent_actor("core_agent", uuid.uuid4())

    with pytest.raises(ForbiddenActionError):
        await execution_anchor_service.create_draft_revision(session, agent, task_id, {})


async def test_agent_cannot_update_draft(session: AsyncSession) -> None:
    task_id = await _create_task_with_confirmed_core_anchor(session)
    revision = await execution_anchor_service.create_draft_revision(session, CG_ACTOR, task_id, {})
    agent = build_agent_actor("cg_supervisor_agent", uuid.uuid4())

    with pytest.raises(ForbiddenActionError):
        await execution_anchor_service.update_draft_revision(
            session, agent, revision.id, {"technical_boundaries": "hijacked"}
        )


async def test_agent_cannot_confirm_revision(session: AsyncSession) -> None:
    task_id = await _create_task_with_confirmed_core_anchor(session)
    revision = await execution_anchor_service.create_draft_revision(session, CG_ACTOR, task_id, {})
    agent = build_agent_actor("cg_supervisor_agent", uuid.uuid4())

    with pytest.raises(ForbiddenActionError):
        await execution_anchor_service.confirm_revision(session, agent, revision.id)


async def test_agent_cannot_reject_revision(session: AsyncSession) -> None:
    task_id = await _create_task_with_confirmed_core_anchor(session)
    revision = await execution_anchor_service.create_draft_revision(session, CG_ACTOR, task_id, {})
    agent = build_agent_actor("cg_supervisor_agent", uuid.uuid4())

    with pytest.raises(ForbiddenActionError):
        await execution_anchor_service.reject_revision(session, agent, revision.id)


async def test_system_actor_cannot_update_confirm_or_reject(session: AsyncSession) -> None:
    task_id = await _create_task_with_confirmed_core_anchor(session)
    revision = await execution_anchor_service.create_draft_revision(session, CG_ACTOR, task_id, {})
    system_actor = ActorContext.system()

    with pytest.raises(ForbiddenActionError):
        await execution_anchor_service.update_draft_revision(
            session, system_actor, revision.id, {"technical_boundaries": "hijacked"}
        )
    with pytest.raises(ForbiddenActionError):
        await execution_anchor_service.confirm_revision(session, system_actor, revision.id)
    with pytest.raises(ForbiddenActionError):
        await execution_anchor_service.reject_revision(session, system_actor, revision.id)
