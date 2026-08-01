import type {
  ArtistCurrentFocusType,
  ArtistInboxItemRead,
} from "@intent-core/contracts";

/** Artist Review Inbox work-item model (Step 7C-5) -- mirrors
 * `features/cg/reviewInbox.ts`'s shape (work-item-first, not a Task-led
 * list): today's only real source is each Task's already-derived,
 * already-honest `ArtistInboxItemRead.current_focus`. Trusts
 * `focus.target_route` directly -- the backend's own
 * `artist_inbox/current_focus.py` already emits exactly the real Artist
 * tab routes (Task Overview / Current Version), never a fabricated one. */
export interface ArtistReviewWorkItemProject {
  id: string;
  name: string;
}

export interface ArtistReviewWorkItemShot {
  id: string;
  name: string;
}

export interface ArtistReviewWorkItemTask {
  id: string;
  name: string;
  department: string | null;
}

export interface ArtistReviewWorkItem {
  /** Stable, globally-unique id: `current_focus:${taskId}:${focusType}`. */
  id: string;
  sourceType: "current_focus";
  sourceId: string;
  category: string;
  title: string;
  explanation: string;
  sortRank: number;
  actionLabel: string | null;
  project: ArtistReviewWorkItemProject;
  shot: ArtistReviewWorkItemShot;
  task: ArtistReviewWorkItemTask;
  executionAnchorState: ArtistInboxItemRead["execution_anchor_state"];
  route: string;
}

/** Honest user-facing category per real `focus_type`. `"none"` never
 * reaches this function -- `adaptArtistCurrentFocusToWorkItems` only
 * calls it for `actionable` records, and `"none"` is never actionable. */
function categoryForFocusType(focusType: ArtistCurrentFocusType): string {
  switch (focusType) {
    case "guidance_outdated":
      return "Guidance update";
    case "review_note_needs_response":
      return "Feedback";
    case "dependency_needs_attention":
      return "Dependency review";
    case "guidance_available":
      return "Guidance available";
    case "none":
      throw new Error(
        'focus_type "none" is never actionable and must never become a work item',
      );
  }
}

/** Every actionable `current_focus` becomes exactly one
 * `ArtistReviewWorkItem`. Non-actionable (`focus_type === "none"`)
 * Tasks contribute nothing -- an honest empty Artist Review Inbox is
 * possible, and expected, whenever no Task has real actionable work. */
export function adaptArtistCurrentFocusToWorkItems(
  items: ArtistInboxItemRead[],
): ArtistReviewWorkItem[] {
  const workItems: ArtistReviewWorkItem[] = [];

  for (const item of items) {
    const focus = item.current_focus;
    if (!focus.actionable) continue;

    workItems.push({
      id: `current_focus:${item.task_id}:${focus.focus_type}`,
      sourceType: "current_focus",
      sourceId: item.task_id,
      category: categoryForFocusType(focus.focus_type),
      title: focus.title,
      explanation: focus.explanation,
      sortRank: item.sort_rank,
      actionLabel: focus.primary_action_label,
      project: { id: item.project_id, name: item.project_name },
      shot: { id: item.shot_id, name: item.shot_name },
      task: {
        id: item.task_id,
        name: item.task_name,
        department: item.department,
      },
      executionAnchorState: item.execution_anchor_state,
      route: focus.target_route,
    });
  }

  return workItems;
}
