from __future__ import annotations

import uuid

import pytest
from fastapi import HTTPException
from intent_core_api.workflow.actors import (
    SYSTEM_ACTOR_ID,
    ActorContext,
    build_agent_actor,
    get_current_actor,
    require_can_confirm_or_reject,
    require_can_draft,
    require_can_update_draft,
    require_human_role,
)
from intent_core_api.workflow.exceptions import ForbiddenActionError


def test_human_actor_requires_human_role() -> None:
    with pytest.raises(ValueError):
        ActorContext(actor_kind="human", actor_id="alice")


def test_human_actor_forbids_agent_fields() -> None:
    with pytest.raises(ValueError):
        ActorContext(
            actor_kind="human",
            actor_id="alice",
            human_role="vfx_supervisor",
            agent_type="core_agent",
        )
    with pytest.raises(ValueError):
        ActorContext(
            actor_kind="human",
            actor_id="alice",
            human_role="vfx_supervisor",
            agent_run_id=uuid.uuid4(),
        )


def test_agent_actor_requires_agent_type_and_run_id() -> None:
    with pytest.raises(ValueError):
        ActorContext(actor_kind="agent", actor_id="agent-1", agent_run_id=uuid.uuid4())
    with pytest.raises(ValueError):
        ActorContext(actor_kind="agent", actor_id="agent-1", agent_type="core_agent")


def test_agent_actor_forbids_human_role() -> None:
    with pytest.raises(ValueError):
        ActorContext(
            actor_kind="agent",
            actor_id="agent-1",
            agent_type="core_agent",
            agent_run_id=uuid.uuid4(),
            human_role="vfx_supervisor",
        )


def test_system_actor_forbids_human_and_agent_fields() -> None:
    with pytest.raises(ValueError):
        ActorContext(actor_kind="system", actor_id="system", human_role="vfx_supervisor")
    with pytest.raises(ValueError):
        ActorContext(actor_kind="system", actor_id="system", agent_type="core_agent")
    with pytest.raises(ValueError):
        ActorContext(actor_kind="system", actor_id="system", agent_run_id=uuid.uuid4())


def test_actor_id_must_be_non_empty() -> None:
    with pytest.raises(ValueError):
        ActorContext(actor_kind="human", actor_id="", human_role="vfx_supervisor")
    with pytest.raises(ValueError):
        ActorContext(actor_kind="system", actor_id="")


def test_valid_actor_combinations_construct() -> None:
    ActorContext(actor_kind="human", actor_id="alice", human_role="vfx_supervisor")
    ActorContext(
        actor_kind="agent", actor_id="agent-1", agent_type="core_agent", agent_run_id=uuid.uuid4()
    )
    ActorContext(actor_kind="system", actor_id="system")


def test_system_factory_uses_stable_actor_id() -> None:
    system_actor = ActorContext.system()
    assert system_actor.actor_kind == "system"
    assert system_actor.actor_id == SYSTEM_ACTOR_ID
    assert system_actor.actor_id  # never empty/null


def test_build_agent_actor_factory() -> None:
    run_id = uuid.uuid4()
    actor = build_agent_actor("core_agent", run_id)
    assert actor.actor_kind == "agent"
    assert actor.agent_type == "core_agent"
    assert actor.agent_run_id == run_id


async def test_get_current_actor_constructs_human_only() -> None:
    actor = await get_current_actor(x_actor_role="vfx_supervisor", x_actor_id="alice")
    assert actor.actor_kind == "human"
    assert actor.human_role == "vfx_supervisor"
    assert actor.agent_type is None
    assert actor.agent_run_id is None


async def test_get_current_actor_rejects_missing_role() -> None:
    with pytest.raises(HTTPException) as exc_info:
        await get_current_actor(x_actor_role=None, x_actor_id="alice")
    assert exc_info.value.status_code == 401


async def test_get_current_actor_rejects_invalid_role() -> None:
    with pytest.raises(HTTPException) as exc_info:
        await get_current_actor(x_actor_role="not_a_real_role", x_actor_id="alice")
    assert exc_info.value.status_code == 401


async def test_get_current_actor_rejects_missing_actor_id() -> None:
    with pytest.raises(HTTPException) as exc_info:
        await get_current_actor(x_actor_role="vfx_supervisor", x_actor_id=None)
    assert exc_info.value.status_code == 401


def test_require_human_role_accepts_matching_human() -> None:
    actor = ActorContext(actor_kind="human", actor_id="alice", human_role="vfx_supervisor")
    require_human_role(actor, frozenset({"vfx_supervisor"}))


def test_require_human_role_rejects_wrong_role() -> None:
    actor = ActorContext(actor_kind="human", actor_id="bob", human_role="artist")
    with pytest.raises(ForbiddenActionError):
        require_human_role(actor, frozenset({"vfx_supervisor"}))


def test_require_can_draft_accepts_permitted_agent_type() -> None:
    agent = build_agent_actor("core_agent", uuid.uuid4())
    # Proves the guard logic is correct even though no real caller exists yet.
    require_can_draft(agent, "vfx_supervisor", allowed_agent_types=frozenset({"core_agent"}))


def test_require_can_draft_rejects_unpermitted_agent_type() -> None:
    agent = build_agent_actor("cg_supervisor_agent", uuid.uuid4())
    with pytest.raises(ForbiddenActionError):
        require_can_draft(agent, "vfx_supervisor", allowed_agent_types=frozenset({"core_agent"}))


def test_require_can_update_draft_rejects_agent_and_system() -> None:
    agent = build_agent_actor("core_agent", uuid.uuid4())
    system_actor = ActorContext.system()
    with pytest.raises(ForbiddenActionError):
        require_can_update_draft(agent, "vfx_supervisor")
    with pytest.raises(ForbiddenActionError):
        require_can_update_draft(system_actor, "vfx_supervisor")


def test_require_can_confirm_or_reject_rejects_every_non_matching_actor() -> None:
    wrong_human = ActorContext(actor_kind="human", actor_id="bob", human_role="cg_supervisor")
    agent = build_agent_actor("core_agent", uuid.uuid4())
    system_actor = ActorContext.system()
    for actor in (wrong_human, agent, system_actor):
        with pytest.raises(ForbiddenActionError):
            require_can_confirm_or_reject(actor, "vfx_supervisor")
