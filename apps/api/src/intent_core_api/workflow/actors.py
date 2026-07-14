"""ActorContext: who is calling, and the permission guards every
intent/workflow/audit service must call before performing a state change.

See docs/ROLE_PERMISSIONS.md and the approved WP-A implementation plan.

Construction paths:

- ``get_current_actor`` is the *temporary* HTTP-header dependency. It can
  only ever construct a ``human`` actor -- there is no header for
  ``actor_kind``, ``agent_type``, or ``agent_run_id``, so an HTTP caller has
  no way to declare itself an agent or the system. This is explicitly
  scaffolding: it does not touch ``production_context`` and does not build
  real authentication (see the plan's deferred "Identity, Membership &
  Assignment Scoping" work package).
- ``ActorContext.system()`` is used only by service code for cascade side
  effects on an entity a human didn't directly target (e.g. auto-
  superseding a different revision). ``actor_id`` is always the stable
  constant ``"system"`` -- never null -- so audit/lineage rows always carry
  a concrete actor identity.
- ``build_agent_actor`` exists for future in-process callers only. No
  router in this codebase calls it, and no HTTP endpoint accepts
  ``agent_type``/``agent_run_id`` as request input. A real remote agent
  caller must authenticate through a separate, distinct internal service
  boundary (a signed service-to-service token, mTLS, or a network trust
  boundary) that is not implemented in WP-A; once such a boundary exists,
  the API server -- not the caller -- constructs the resulting
  ``ActorContext`` from verified machine identity and agent-run metadata.
  An agent can never reach ``human_role`` or the ``X-Actor-Role`` header
  path.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated, Literal, cast, get_args
from uuid import UUID

from fastapi import Header, HTTPException

from intent_core_api.workflow.exceptions import ForbiddenActionError

ActorKind = Literal["human", "agent", "system"]
HumanRole = Literal["vfx_supervisor", "cg_supervisor", "artist"]
AgentType = Literal[
    "core_agent",
    "vfx_supervisor_agent",
    "cg_supervisor_agent",
    "artist_agent",
    "cross_department",
]

SYSTEM_ACTOR_ID = "system"

_HUMAN_ROLES = frozenset(get_args(HumanRole))


@dataclass(frozen=True)
class ActorContext:
    actor_kind: ActorKind
    actor_id: str
    human_role: HumanRole | None = None
    agent_type: AgentType | None = None
    agent_run_id: UUID | None = None

    def __post_init__(self) -> None:
        if not self.actor_id:
            raise ValueError("actor_id must be non-empty")
        if self.actor_kind == "human":
            if self.human_role is None:
                raise ValueError("a human actor requires human_role")
            if self.agent_type is not None or self.agent_run_id is not None:
                raise ValueError("a human actor must not set agent_type/agent_run_id")
        elif self.actor_kind == "agent":
            if self.agent_type is None or self.agent_run_id is None:
                raise ValueError("an agent actor requires agent_type and agent_run_id")
            if self.human_role is not None:
                raise ValueError("an agent actor must not set human_role")
        elif self.actor_kind == "system":
            if (
                self.human_role is not None
                or self.agent_type is not None
                or self.agent_run_id is not None
            ):
                raise ValueError("a system actor must not set human_role/agent_type/agent_run_id")

    @staticmethod
    def system() -> ActorContext:
        return ActorContext(actor_kind="system", actor_id=SYSTEM_ACTOR_ID)


def build_agent_actor(
    agent_type: AgentType, agent_run_id: UUID, actor_id: str = "agent"
) -> ActorContext:
    """Internal-only factory for a future in-process/authenticated agent
    caller. Not reachable from any router in WP-A -- see module docstring.
    """
    return ActorContext(
        actor_kind="agent", actor_id=actor_id, agent_type=agent_type, agent_run_id=agent_run_id
    )


async def get_current_actor(
    x_actor_role: Annotated[str | None, Header(alias="X-Actor-Role")] = None,
    x_actor_id: Annotated[str | None, Header(alias="X-Actor-Id")] = None,
) -> ActorContext:
    if x_actor_role not in _HUMAN_ROLES:
        raise HTTPException(status_code=401, detail="Missing or invalid X-Actor-Role header")
    if not x_actor_id:
        raise HTTPException(status_code=401, detail="Missing X-Actor-Id header")
    return ActorContext(
        actor_kind="human", actor_id=x_actor_id, human_role=cast(HumanRole, x_actor_role)
    )


def require_human_role(actor: ActorContext, allowed_roles: frozenset[HumanRole]) -> None:
    if actor.actor_kind != "human" or actor.human_role not in allowed_roles:
        raise ForbiddenActionError(
            f"action requires a human actor with role in {sorted(allowed_roles)}; "
            f"got actor_kind={actor.actor_kind!r} human_role={actor.human_role!r}"
        )


def require_can_draft(
    actor: ActorContext,
    owning_human_role: HumanRole,
    allowed_agent_types: frozenset[AgentType] = frozenset(),
) -> None:
    if actor.actor_kind == "human" and actor.human_role == owning_human_role:
        return
    if actor.actor_kind == "agent" and actor.agent_type in allowed_agent_types:
        return
    raise ForbiddenActionError(
        f"draft creation requires human role {owning_human_role!r} "
        f"or an agent of type in {sorted(allowed_agent_types)}; "
        f"got actor_kind={actor.actor_kind!r} human_role={actor.human_role!r} "
        f"agent_type={actor.agent_type!r}"
    )


def require_can_update_draft(actor: ActorContext, owning_human_role: HumanRole) -> None:
    require_human_role(actor, frozenset({owning_human_role}))


def require_can_confirm_or_reject(actor: ActorContext, owning_human_role: HumanRole) -> None:
    require_human_role(actor, frozenset({owning_human_role}))
