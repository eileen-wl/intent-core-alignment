"""Request/response schemas for the Task Activity read model (Step 7C-4).

Same field shape as `api.activity`'s `ShotActivityEventRead`/
`ShotActivityRead`, but a distinct event vocabulary: this timeline is
Task-scoped (Execution Anchor, CG Supervisor review, TaskDependency),
never Shot-scoped Core Anchor/Version/ReviewNote events. See
`intent_core_api.task_activity.service` for the aggregation itself.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from intent_core_contracts.actors import HumanRole

ActorKind = Literal["human", "agent", "system"]

TaskActivityEventType = Literal[
    "execution_anchor_draft_created",
    "execution_anchor_draft_updated",
    "execution_anchor_confirmed",
    "execution_anchor_draft_discarded",
    # A real persisted `Decision` row's own event -- always additional
    # to, never a substitute for, the execution_anchor_confirmed/
    # execution_anchor_draft_discarded event the same Decision also
    # produces (matches the Shot Activity convention fixed in Step
    # 7C-3's completion pass).
    "human_decision_recorded",
    "cg_supervisor_review_generated",
    "dependency_recorded",
    "dependency_acknowledged",
    "dependency_resolved",
    "escalation_recorded",
    "cross_role_assessment_involving_task",
]


class TaskActivityEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    id: str
    event_type: TaskActivityEventType
    occurred_at: datetime
    actor_kind: ActorKind | None
    actor_id: str | None
    actor_human_role: HumanRole | None
    summary: str
    related_entity_type: str
    related_entity_id: UUID
    # The relevant Execution, Version Review, or Dependencies route for
    # this Task; falls back to the Task Overview route only when no more
    # specific tab applies.
    route: str


class TaskActivityRead(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    task_id: UUID
    # Newest first.
    events: list[TaskActivityEventRead]
