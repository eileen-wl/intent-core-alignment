"""Read schema for ``Decision`` (docs/DOMAIN_MODEL.md §9), the
authoritative human-choice record confirm/reject already write via
``workflow.decision_service.record_decision``.

This is the only schema in this module. ``WorkflowTransition`` is not
exposed here: everything a Gate reviewer needs from it (current status,
who acted, when) is already visible on ``CoreAnchorRevisionRead`` itself;
``Decision`` alone carries the one field that isn't -- ``rationale`` --
plus its own metadata (``decision_type``, ``owning_human_role``,
``write_back_requested``, ``supersedes_decision_id``).
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from intent_core_contracts.actors import HumanRole

ActorKind = Literal["human", "agent", "system"]


class DecisionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    decision_type: str
    owning_human_role: HumanRole
    actor_kind: ActorKind
    actor_id: str
    actor_human_role: HumanRole | None
    rationale: str | None
    entity_type: str
    entity_id: UUID
    write_back_requested: bool
    supersedes_decision_id: UUID | None
    created_at: datetime
