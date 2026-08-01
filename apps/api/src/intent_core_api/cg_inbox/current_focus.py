"""Deterministic CG Current-focus derivation (Step 7C-4).

Pure, DB-free logic: operates on an already-loaded ``TaskFocusInputs``
snapshot, never issues a query itself -- same shape discipline as
``vfx_inbox.current_focus``, but this is this Step's own bounded design:
no CG-equivalent locked IA doc exists the way ``14_STEP_7C0B_...md``
locked VFX's six states, so the five states and their precedence below
are defined and documented here for the first time.

Five focus types, in locked precedence order (highest first):

1. ``execution_anchor_gate_pending``
2. ``execution_anchor_draft_needs_review``
3. ``dependency_needs_attention``
4. ``version_review_available``
5. ``none``

Truthfulness rule (matches ``vfx_inbox.current_focus``'s own rule): no
persisted "addressed"/"unread"/"unresolved" status is invented here --
every predicate reads a real, independently-meaningful domain fact
already loaded by the caller.
"""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from intent_core_contracts.api.cg_inbox import CgInboxCurrentFocusRead


@dataclass(frozen=True)
class TaskFocusInputs:
    task_id: UUID

    # Execution Anchor state.
    pending_execution_gate_id: UUID | None
    # A draft revision exists with no HumanGate at all yet (the
    # legacy-compatibility case documented in human_gate_service) --
    # distinct from "gate pending", which already implies a draft.
    draft_revision_without_gate_exists: bool

    # Whether at least one open TaskDependency with kind in
    # ("dependency", "conflict") exists for this Task.
    dependency_needs_attention: bool

    # Whether the Task's Shot has a Production Version with no
    # CGSupervisorReview yet for the Task's active Execution Anchor
    # revision -- only meaningful (and only ever True) once a confirmed
    # Execution Anchor revision exists.
    version_review_available: bool


def _task_route(task_id: UUID) -> str:
    return f"/cg/tasks/{task_id}"


def _execution_route(task_id: UUID) -> str:
    return f"/cg/tasks/{task_id}/execution"


def _dependencies_route(task_id: UUID) -> str:
    return f"/cg/tasks/{task_id}/dependencies"


def _version_review_route(task_id: UUID) -> str:
    return f"/cg/tasks/{task_id}/version-review"


def _gate_pending_focus(inputs: TaskFocusInputs) -> CgInboxCurrentFocusRead:
    return CgInboxCurrentFocusRead(
        focus_type="execution_anchor_gate_pending",
        title="Execution Anchor draft awaiting your confirmation",
        explanation="A proposed department execution translation is ready for your review.",
        target_route=_execution_route(inputs.task_id),
        primary_action_label="Review and confirm",
        actionable=True,
    )


def _draft_needs_review_focus(inputs: TaskFocusInputs) -> CgInboxCurrentFocusRead:
    return CgInboxCurrentFocusRead(
        focus_type="execution_anchor_draft_needs_review",
        title="Execution Anchor draft in progress",
        explanation="A draft revision exists but has not yet been submitted for confirmation.",
        target_route=_execution_route(inputs.task_id),
        primary_action_label="Review draft",
        actionable=True,
    )


def _dependency_focus(inputs: TaskFocusInputs) -> CgInboxCurrentFocusRead:
    return CgInboxCurrentFocusRead(
        focus_type="dependency_needs_attention",
        title="An unresolved dependency needs your interpretation",
        explanation="A real recorded dependency or cross-role conflict is still open.",
        target_route=_dependencies_route(inputs.task_id),
        primary_action_label="Review dependencies",
        actionable=True,
    )


def _version_review_focus(inputs: TaskFocusInputs) -> CgInboxCurrentFocusRead:
    return CgInboxCurrentFocusRead(
        focus_type="version_review_available",
        title="A Production Version is ready for CG review",
        explanation=(
            "No CG Supervisor review has been recorded yet for the current Execution Anchor."
        ),
        target_route=_version_review_route(inputs.task_id),
        primary_action_label="Review version",
        actionable=True,
    )


def _none_focus(inputs: TaskFocusInputs) -> CgInboxCurrentFocusRead:
    return CgInboxCurrentFocusRead(
        focus_type="none",
        title="Nothing requires your attention on this Task right now",
        explanation="Nothing requires your attention on this Task right now.",
        target_route=_task_route(inputs.task_id),
        primary_action_label=None,
        actionable=False,
    )


def derive_current_focus(inputs: TaskFocusInputs) -> CgInboxCurrentFocusRead:
    if inputs.pending_execution_gate_id is not None:
        return _gate_pending_focus(inputs)
    if inputs.draft_revision_without_gate_exists:
        return _draft_needs_review_focus(inputs)
    if inputs.dependency_needs_attention:
        return _dependency_focus(inputs)
    if inputs.version_review_available:
        return _version_review_focus(inputs)
    return _none_focus(inputs)


_FOCUS_TYPE_SORT_RANK: dict[str, int] = {
    "execution_anchor_gate_pending": 0,
    "execution_anchor_draft_needs_review": 1,
    "dependency_needs_attention": 2,
    "version_review_available": 3,
    "none": 4,
}


def sort_rank_for_focus_type(focus_type: str) -> int:
    return _FOCUS_TYPE_SORT_RANK[focus_type]
