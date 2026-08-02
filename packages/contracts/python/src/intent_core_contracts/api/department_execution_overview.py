"""Request/response schemas for the VFX Department Execution Overview
read model (Step 9B-3; docs/step-9/05_STEP_9B3_DEPARTMENT_EXECUTION_OVERVIEW.md).

Read-only, Shot-scoped, VFX-Supervisor-only. Composes real, already-
persisted Task/ExecutionAnchor/ExecutionAnchorRevision/HumanGate/Version/
TaskDependency/CrossRoleAssessment/IntentSignal state into one row per
real Task under a Shot -- the same "one row per real object, several
already-real fields projected together" pattern already established by
`VfxInboxItemRead`/`CgInboxItemRead`. No new authoritative table, no new
mutation. Every row is matched by its real `Task.id` -- never by a
department-name string (docs/step-9/02_STEP_9A_...md §8).
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from intent_core_contracts.api.cg_inbox import CgCurrentFocusType
from intent_core_contracts.api.dependencies import TaskDependencySeverity
from intent_core_contracts.api.production_context import RecordSource
from intent_core_contracts.api.vfx_inbox import AttentionLevel

DepartmentExecutionAnchorState = Literal[
    "none",
    "draft",
    "awaiting_confirmation",
    "confirmed",
    "rejected",
]

DepartmentExecutionLastUpdatedSource = Literal[
    "task_created",
    "execution_anchor_revision",
    "version",
    "dependency",
    "escalation",
    "alignment_assessment",
]

# Whether the Task's latest Version is genuinely linked to this Task
# (`Version.task_id == task_id`) or is only a Shot-level manual Version
# reached through the Step 8C-6/8C-7 nullable-`task_id` fallback -- the
# two must never be displayed identically (docs/step-9 owner-validation
# correction). `None` only when there is no latest Version at all.
DepartmentExecutionVersionScope = Literal["task", "shot_unscoped"]


class DepartmentExecutionTaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    task_id: UUID
    task_name: str
    department: str | None
    task_source: RecordSource

    # The Task's current Execution Anchor state, using the exact
    # lifecycle rule the service documents: `confirmed` only from a real
    # `active_revision_id` whose own status is `confirmed`; `awaiting_
    # confirmation` only when a real pending HumanGate exists; `draft`
    # only for an un-gated draft revision; `rejected` only when the
    # latest real revision's own status is `rejected`; a superseded
    # revision is never selected as current under any state.
    execution_anchor_state: DepartmentExecutionAnchorState
    execution_anchor_revision_number: int | None
    execution_anchor_summary: str | None

    # Latest Production Version relevant to this Task: Task-scoped first
    # (`Version.task_id == task_id`), falling back to a Shot-level manual
    # Version (`Version.task_id IS NULL`) per the existing Step 8C-6/8C-7
    # nullable-task_id compatibility rule -- never a Version explicitly
    # linked to a *different* Task. Ordered by `source_created_at ??
    # created_at`. `latest_version_scope` distinguishes the two cases --
    # `"task"` only when `Version.task_id == task_id`, `"shot_unscoped"`
    # for the nullable-task_id fallback -- so a Shot-level Version is
    # never presented as if it were explicitly linked to this Task.
    latest_version_id: UUID | None
    latest_version_name: str | None
    latest_version_number: int | None
    latest_version_source: RecordSource | None
    latest_version_scope: DepartmentExecutionVersionScope | None

    # The Task's existing, real, already-tested Current focus (the same
    # derivation CG's own Review Inbox uses, `cg_inbox.current_focus`) --
    # never re-derived by a second ranking algorithm. `current_focus_type`
    # is the real discriminator so the frontend can render role-explicit,
    # role-neutral copy instead of CG's own second-person "your" wording
    # verbatim on a VFX page (docs/step-9 owner-validation correction).
    # `current_focus_title`/`current_focus_actionable` remain the raw CG
    # copy for any CG-facing reuse; a VFX-facing surface must not render
    # `current_focus_title` unqualified.
    current_focus_type: CgCurrentFocusType
    current_focus_title: str
    current_focus_actionable: bool

    # Real, open TaskDependency rows (`kind in ("dependency", "conflict")`)
    # only -- an escalation is reported separately below, and a resolved
    # Dependency is never counted or shown here as open.
    open_dependency_count: int
    top_open_dependency_description: str | None
    top_open_dependency_severity: TaskDependencySeverity | None

    # The Task's own latest CrossRoleAssessment's IntentSignal, if any --
    # always advisory (Agent-derived), never a Human Decision. `None`
    # means no Assessment has been generated for this Task yet -- never
    # rendered as "confirmed aligned."
    alignment_concern_summary: str | None
    alignment_concern_attention_level: AttentionLevel | None

    # A real, open TaskDependency(kind="escalation",
    # escalated_to_role="vfx_supervisor") targeting this Task -- never
    # inferred from an Agent recommendation or a high Intent Signal alone.
    open_escalation: bool
    open_escalation_summary: str | None

    # Deterministic maximum of every real, included source object's own
    # timestamp above -- never the request time. `last_updated_source`
    # names exactly which one won (ties broken by a fixed field order,
    # never arbitrarily).
    last_updated_at: datetime
    last_updated_source: DepartmentExecutionLastUpdatedSource


class DepartmentExecutionOverviewRead(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    shot_id: UUID
    tasks: list[DepartmentExecutionTaskRead]
    generated_at: datetime
