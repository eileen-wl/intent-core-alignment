"""Request/response schemas for the `cross_department` module's
TaskDependency object (Step 7C-4) -- the first real persistence of the
Cross-department Conflict / Escalation concepts already named in
docs/GLOSSARY.md. See `intent_core_api.cross_department.models.TaskDependency`.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from intent_core_contracts.actors import HumanRole

ActorKind = Literal["human", "agent", "system"]
TaskDependencyKind = Literal["dependency", "conflict", "escalation"]
TaskDependencyStatus = Literal["open", "acknowledged", "resolved"]
TaskDependencySeverity = Literal["low", "medium", "high"]


class TaskDependencyCreate(BaseModel):
    kind: Literal["dependency", "conflict"]
    description: str = Field(min_length=1)
    severity: TaskDependencySeverity | None = None
    related_version_id: UUID | None = None


class EscalationCreate(BaseModel):
    description: str = Field(min_length=1)
    related_version_id: UUID | None = None


class TaskDependencyRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    shot_id: UUID
    task_id: UUID
    related_version_id: UUID | None
    kind: TaskDependencyKind
    status: TaskDependencyStatus
    description: str
    severity: TaskDependencySeverity | None
    escalated_to_role: HumanRole | None

    created_by_actor_kind: ActorKind
    created_by_actor_id: str
    created_by_human_role: HumanRole | None
    created_at: datetime

    resolved_by_actor_id: str | None
    resolved_by_human_role: HumanRole | None
    resolved_at: datetime | None

    related_cross_role_assessment_id: UUID | None
