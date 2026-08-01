"""Deterministic Artist Current-focus derivation (Step 7C-5).

Pure, DB-free logic: operates on an already-loaded ``TaskFocusInputs``
snapshot, never issues a query itself -- same shape discipline as
``cg_inbox.current_focus``/``vfx_inbox.current_focus``. No Artist-
equivalent locked IA doc exists, so the five states and their precedence
below are defined and documented here for the first time, bounded to
what is actually actionable for the Artist role (never Execution Anchor
confirmation or Dependency resolution -- those remain CG-owned; Artist
can only read, generate guidance, and respond to feedback).

Five focus types, in locked precedence order (highest first):

1. ``guidance_outdated``
2. ``review_note_needs_response``
3. ``dependency_needs_attention``
4. ``guidance_available``
5. ``none``

Truthfulness rule (matches ``cg_inbox.current_focus``'s own rule): no
persisted "read"/"resolved" status is invented here -- every predicate
reads a real, independently-meaningful domain fact already loaded by the
caller (a real newer confirmed Execution Anchor revision than the
guidance cites, a real recorded ReviewNote, a real open TaskDependency, a
real absence of any ArtistAgentGuidance row).
"""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from intent_core_contracts.api.artist_inbox import ArtistInboxCurrentFocusRead


@dataclass(frozen=True)
class TaskFocusInputs:
    task_id: UUID

    # Whether real ArtistAgentGuidance exists for the Task's latest
    # Version, and if so, whether its cited Execution Anchor revision id
    # still matches the Task's current confirmed one.
    guidance_exists: bool
    guidance_outdated: bool

    # Whether the Task's latest Version has at least one real recorded
    # ReviewNote.
    has_review_notes: bool

    # Whether at least one open TaskDependency (kind in "dependency",
    # "conflict", "escalation") exists for this Task.
    dependency_needs_attention: bool

    # Whether guidance could honestly be generated right now (a
    # confirmed Execution Anchor revision and a latest Version both
    # exist) but no guidance has ever been generated for that Version.
    guidance_available: bool


def _task_route(task_id: UUID) -> str:
    return f"/artist/tasks/{task_id}"


def _current_version_route(task_id: UUID) -> str:
    return f"/artist/tasks/{task_id}/current-version"


def _guidance_outdated_focus(inputs: TaskFocusInputs) -> ArtistInboxCurrentFocusRead:
    return ArtistInboxCurrentFocusRead(
        focus_type="guidance_outdated",
        title="Your guidance is based on an earlier Execution Anchor",
        explanation=(
            "A newer confirmed Execution Anchor revision exists since this guidance was "
            "generated -- regenerate it to stay current."
        ),
        target_route=_task_route(inputs.task_id),
        primary_action_label="Review and regenerate",
        actionable=True,
    )


def _review_note_focus(inputs: TaskFocusInputs) -> ArtistInboxCurrentFocusRead:
    return ArtistInboxCurrentFocusRead(
        focus_type="review_note_needs_response",
        title="Feedback has been recorded on your current Version",
        explanation="A real Review Note exists on the latest Production Version for this Task.",
        target_route=_current_version_route(inputs.task_id),
        primary_action_label="Read feedback",
        actionable=True,
    )


def _dependency_focus(inputs: TaskFocusInputs) -> ArtistInboxCurrentFocusRead:
    return ArtistInboxCurrentFocusRead(
        focus_type="dependency_needs_attention",
        title="An unresolved issue may affect this Task",
        explanation="A real recorded dependency, conflict, or escalation is still open.",
        target_route=_task_route(inputs.task_id),
        primary_action_label="Review Task Overview",
        actionable=True,
    )


def _guidance_available_focus(inputs: TaskFocusInputs) -> ArtistInboxCurrentFocusRead:
    return ArtistInboxCurrentFocusRead(
        focus_type="guidance_available",
        title="Artist guidance can be generated for this Task",
        explanation="A confirmed Execution Anchor exists, but no guidance has been generated yet.",
        target_route=_task_route(inputs.task_id),
        primary_action_label="Generate guidance",
        actionable=True,
    )


def _none_focus(inputs: TaskFocusInputs) -> ArtistInboxCurrentFocusRead:
    return ArtistInboxCurrentFocusRead(
        focus_type="none",
        title="Nothing requires your attention on this Task right now",
        explanation="Nothing requires your attention on this Task right now.",
        target_route=_task_route(inputs.task_id),
        primary_action_label=None,
        actionable=False,
    )


def derive_current_focus(inputs: TaskFocusInputs) -> ArtistInboxCurrentFocusRead:
    if inputs.guidance_exists and inputs.guidance_outdated:
        return _guidance_outdated_focus(inputs)
    if inputs.has_review_notes:
        return _review_note_focus(inputs)
    if inputs.dependency_needs_attention:
        return _dependency_focus(inputs)
    if inputs.guidance_available:
        return _guidance_available_focus(inputs)
    return _none_focus(inputs)


_FOCUS_TYPE_SORT_RANK: dict[str, int] = {
    "guidance_outdated": 0,
    "review_note_needs_response": 1,
    "dependency_needs_attention": 2,
    "guidance_available": 3,
    "none": 4,
}


def sort_rank_for_focus_type(focus_type: str) -> int:
    return _FOCUS_TYPE_SORT_RANK[focus_type]
