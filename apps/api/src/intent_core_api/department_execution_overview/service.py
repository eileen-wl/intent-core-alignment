"""Department Execution Overview read-model service (Step 9B-3).

Composes real, already-persisted Task/ExecutionAnchor/
ExecutionAnchorRevision/HumanGate/Version/TaskDependency/IntentSignal
state into one ``DepartmentExecutionTaskRead`` per real Task under a
Shot -- read-only, no mutation, no new authoritative table. Reuses
``cg_inbox.current_focus``'s existing, already-tested Current-focus
derivation directly rather than re-deriving a second ranking algorithm
(docs/step-9/02_STEP_9A_CURRENT_STATE_AND_IMPLEMENTATION_MAP.md §8).

Every Task is matched by its real ``Task.id`` -- never a department-name
string. VFX-Supervisor-only: ``require_human_role`` is checked before any
Shot lookup, so an unauthorized caller learns nothing about whether the
Shot exists.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from intent_core_contracts.api.department_execution_overview import (
    DepartmentExecutionAnchorState,
    DepartmentExecutionLastUpdatedSource,
    DepartmentExecutionOverviewRead,
    DepartmentExecutionTaskRead,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.cg_inbox.current_focus import TaskFocusInputs, derive_current_focus
from intent_core_api.cross_department.models import TaskDependency
from intent_core_api.intent.models import (
    CGSupervisorReview,
    ExecutionAnchor,
    ExecutionAnchorRevision,
    HumanGate,
)
from intent_core_api.production_context.models import Shot, Task
from intent_core_api.versions_and_feedback.models import IntentSignal, Version
from intent_core_api.workflow.actors import ActorContext, HumanRole, require_human_role

_VFX_SUPERVISOR: frozenset[HumanRole] = frozenset({"vfx_supervisor"})

_SEVERITY_RANK: dict[str | None, int] = {"high": 0, "medium": 1, "low": 2, None: 3}


def _effective_timestamp(version: Version) -> datetime:
    """Step 8C-6/8C-7's ``source_created_at ?? created_at`` rule -- the
    same chronological-ordering convention every role's Version/
    ReviewNote sort already uses (docs/DOMAIN_MODEL.md §4.1)."""
    return version.source_created_at or version.created_at


def _is_version_in_task_scope(version: Version, task_id: uuid.UUID) -> bool:
    """Step 8's nullable ``task_id`` compatibility rule: a manually-
    created Version with no Task link belongs to every Task under its
    Shot; a Version explicitly linked to a *different* Task is excluded."""
    return version.task_id is None or version.task_id == task_id


@dataclass(frozen=True)
class _ExecutionAnchorState:
    state: DepartmentExecutionAnchorState
    # The one revision that is genuinely "current" under `state` -- never
    # a superseded revision, never mixed up between draft and confirmed.
    revision: ExecutionAnchorRevision | None
    pending_gate_id: uuid.UUID | None
    draft_revision_without_gate: bool


async def _load_execution_anchor_state(
    session: AsyncSession, task_id: uuid.UUID
) -> _ExecutionAnchorState:
    execution_anchor = await session.scalar(
        select(ExecutionAnchor).where(ExecutionAnchor.task_id == task_id)
    )
    if execution_anchor is None:
        return _ExecutionAnchorState("none", None, None, False)

    active_revision: ExecutionAnchorRevision | None = None
    if execution_anchor.active_revision_id is not None:
        active_revision = await session.get(
            ExecutionAnchorRevision, execution_anchor.active_revision_id
        )
    if active_revision is not None and active_revision.status == "confirmed":
        return _ExecutionAnchorState("confirmed", active_revision, None, False)

    revisions = list(
        (
            await session.execute(
                select(ExecutionAnchorRevision)
                .where(ExecutionAnchorRevision.execution_anchor_id == execution_anchor.id)
                .order_by(ExecutionAnchorRevision.revision_number)
            )
        )
        .scalars()
        .all()
    )
    revision_ids = [revision.id for revision in revisions]
    gates: list[HumanGate] = []
    if revision_ids:
        gates = list(
            (
                await session.execute(
                    select(HumanGate).where(
                        HumanGate.execution_anchor_revision_id.in_(revision_ids)
                    )
                )
            )
            .scalars()
            .all()
        )
    pending_gate_id: uuid.UUID | None = None
    gated_revision_ids = {gate.execution_anchor_revision_id for gate in gates}
    for gate in gates:
        if gate.status == "pending":
            pending_gate_id = gate.id

    draft_revision_without_gate = pending_gate_id is None and any(
        revision.status == "draft" and revision.id not in gated_revision_ids
        for revision in revisions
    )
    latest_revision = revisions[-1] if revisions else None

    if pending_gate_id is not None:
        return _ExecutionAnchorState(
            "awaiting_confirmation", latest_revision, pending_gate_id, False
        )
    if draft_revision_without_gate:
        return _ExecutionAnchorState("draft", latest_revision, None, True)
    if latest_revision is not None and latest_revision.status == "rejected":
        return _ExecutionAnchorState("rejected", latest_revision, None, False)
    # Covers both a genuinely empty history and the defensive case of a
    # `latest_revision.status == "superseded"` with no active pointer --
    # a superseded revision is never reported as the Task's current state.
    return _ExecutionAnchorState("none", None, None, False)


async def _build_task_row(
    session: AsyncSession, task: Task, shot_versions: list[Version]
) -> DepartmentExecutionTaskRead:
    anchor_state = await _load_execution_anchor_state(session, task.id)

    dependency_rows = list(
        (await session.execute(select(TaskDependency).where(TaskDependency.task_id == task.id)))
        .scalars()
        .all()
    )
    open_dependencies = [
        dependency
        for dependency in dependency_rows
        if dependency.kind in ("dependency", "conflict") and dependency.status != "resolved"
    ]
    # `dependency_needs_attention`/the highlighted "top" dependency uses
    # the narrower, exactly-"open" predicate (mirrors cg_inbox's own
    # focus-precedence input) -- an "acknowledged" Dependency still counts
    # toward `open_dependency_count` but does not win Current focus or the
    # highlighted row.
    attention_dependencies = [
        dependency
        for dependency in dependency_rows
        if dependency.kind in ("dependency", "conflict") and dependency.status == "open"
    ]

    def _dependency_rank(dependency: TaskDependency) -> tuple[int, datetime]:
        return (_SEVERITY_RANK.get(dependency.severity, 3), dependency.created_at)

    top_open_dependency = (
        sorted(attention_dependencies, key=_dependency_rank)[0] if attention_dependencies else None
    )

    escalation = next(
        (
            dependency
            for dependency in dependency_rows
            if dependency.kind == "escalation"
            and dependency.status == "open"
            and dependency.escalated_to_role == "vfx_supervisor"
        ),
        None,
    )

    versions_in_scope = [
        version for version in shot_versions if _is_version_in_task_scope(version, task.id)
    ]
    latest_version = max(versions_in_scope, key=_effective_timestamp) if versions_in_scope else None

    version_review_available = False
    if (
        anchor_state.state == "confirmed"
        and anchor_state.revision is not None
        and latest_version is not None
    ):
        existing_review = await session.scalar(
            select(CGSupervisorReview.id).where(
                CGSupervisorReview.execution_anchor_revision_id == anchor_state.revision.id
            )
        )
        version_review_available = existing_review is None

    focus_inputs = TaskFocusInputs(
        task_id=task.id,
        pending_execution_gate_id=anchor_state.pending_gate_id,
        draft_revision_without_gate_exists=anchor_state.draft_revision_without_gate,
        dependency_needs_attention=bool(attention_dependencies),
        version_review_available=version_review_available,
    )
    current_focus = derive_current_focus(focus_inputs)

    latest_signal = await session.scalar(
        select(IntentSignal)
        .where(IntentSignal.task_id == task.id)
        .order_by(IntentSignal.created_at.desc(), IntentSignal.id.desc())
        .limit(1)
    )
    alignment_concern_summary = (
        latest_signal.signal_output.get("summary") if latest_signal else None
    )
    alignment_concern_attention_level = latest_signal.attention_level if latest_signal else None

    # Deterministic maximum over every real, included source object's own
    # timestamp -- never the request time. Ties are broken by this fixed
    # list order (task_created is always present as the floor).
    candidates: list[tuple[datetime, DepartmentExecutionLastUpdatedSource]] = [
        (task.created_at, "task_created")
    ]
    if anchor_state.revision is not None:
        candidates.append((anchor_state.revision.updated_at, "execution_anchor_revision"))
    if latest_version is not None:
        candidates.append((_effective_timestamp(latest_version), "version"))
    if top_open_dependency is not None:
        candidates.append((top_open_dependency.created_at, "dependency"))
    if escalation is not None:
        candidates.append((escalation.created_at, "escalation"))
    if latest_signal is not None:
        candidates.append((latest_signal.created_at, "alignment_assessment"))
    last_updated_at, last_updated_source = max(candidates, key=lambda candidate: candidate[0])

    return DepartmentExecutionTaskRead(
        task_id=task.id,
        task_name=task.name,
        department=task.department,
        task_source=task.source,  # type: ignore[arg-type]
        execution_anchor_state=anchor_state.state,
        execution_anchor_revision_number=(
            anchor_state.revision.revision_number if anchor_state.revision else None
        ),
        execution_anchor_summary=(
            anchor_state.revision.technical_boundaries if anchor_state.revision else None
        ),
        latest_version_id=latest_version.id if latest_version else None,
        latest_version_name=latest_version.name if latest_version else None,
        latest_version_number=latest_version.version_number if latest_version else None,
        latest_version_source=(latest_version.source if latest_version else None),  # type: ignore[arg-type]
        current_focus_title=current_focus.title,
        current_focus_actionable=current_focus.actionable,
        open_dependency_count=len(open_dependencies),
        top_open_dependency_description=(
            top_open_dependency.description if top_open_dependency else None
        ),
        top_open_dependency_severity=(
            top_open_dependency.severity if top_open_dependency else None  # type: ignore[arg-type]
        ),
        alignment_concern_summary=alignment_concern_summary,
        alignment_concern_attention_level=alignment_concern_attention_level,  # type: ignore[arg-type]
        open_escalation=escalation is not None,
        open_escalation_summary=escalation.description if escalation else None,
        last_updated_at=last_updated_at,
        last_updated_source=last_updated_source,
    )


async def get_department_execution_overview(
    session: AsyncSession, actor: ActorContext, shot_id: uuid.UUID
) -> DepartmentExecutionOverviewRead | None:
    """VFX-Supervisor-only. Returns ``None`` only when the Shot itself
    does not exist -- a valid Shot with no Tasks returns an empty
    ``tasks`` list. Read-only: no row is created, updated, or deleted."""
    require_human_role(actor, _VFX_SUPERVISOR)

    shot = await session.get(Shot, shot_id)
    if shot is None:
        return None

    tasks = list(
        (
            await session.execute(
                select(Task).where(Task.shot_id == shot_id).order_by(Task.created_at)
            )
        )
        .scalars()
        .all()
    )
    shot_versions = list(
        (
            await session.execute(
                select(Version).where(Version.shot_id == shot_id).order_by(Version.created_at)
            )
        )
        .scalars()
        .all()
    )

    task_rows = [await _build_task_row(session, task, shot_versions) for task in tasks]
    return DepartmentExecutionOverviewRead(
        shot_id=shot.id, tasks=task_rows, generated_at=datetime.now(UTC)
    )
