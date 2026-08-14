import type {
  CgCurrentFocusType,
  CgInboxItemRead,
} from "@intent-core/contracts";

import type { IconName } from "@/design";

/** CG Review Inbox work-item model (Step 7C-4) -- mirrors
 * `features/vfx/review-inbox/workItem.ts`'s *shape* (work-item-first,
 * not a Task-led list), a smaller, CG-owned model: today's only real
 * source is each Task's already-derived, already-honest
 * `CgInboxItemRead.current_focus`. Unlike the VFX model, this trusts
 * `focus.target_route` directly rather than re-deriving it: there is
 * only one real source here (no multi-adapter route-conflict risk the
 * VFX model was hardened against), and the backend's own
 * `cg_inbox/current_focus.py` already emits exactly the four real CG
 * tab routes (Execution/Dependencies/Version Review/Task Overview). */
export interface CgReviewWorkItemProject {
  id: string;
  name: string;
}

export interface CgReviewWorkItemShot {
  id: string;
  name: string;
}

export interface CgReviewWorkItemTask {
  id: string;
  name: string;
  department: string | null;
}

export interface CgReviewWorkItem {
  /** Stable, globally-unique id: `current_focus:${taskId}:${focusType}`. */
  id: string;
  sourceType: "current_focus";
  sourceId: string;
  category: string;
  title: string;
  explanation: string;
  sortRank: number;
  actionLabel: string | null;
  project: CgReviewWorkItemProject;
  shot: CgReviewWorkItemShot;
  task: CgReviewWorkItemTask;
  executionAnchorState: CgInboxItemRead["execution_anchor_state"];
  /** Real, already-persisted aggregate count (`CgInboxItemRead`'s own
   * accurate `sum()` over open `TaskDependency` rows, never a boolean
   * masquerading as a count) -- the row-level semantic-status
   * correction's source fact for "Dependency review" items, where
   * `executionAnchorState` is not the item's real subject. */
  openDependencyCount: number;
  route: string;
}

/** Honest user-facing category per real `focus_type`. `"none"` never
 * reaches this function -- `adaptCgCurrentFocusToWorkItems` only calls
 * it for `actionable` records, and `"none"` is never actionable. */
function categoryForFocusType(focusType: CgCurrentFocusType): string {
  switch (focusType) {
    case "execution_anchor_gate_pending":
      return "Execution Anchor confirmation";
    case "execution_anchor_draft_needs_review":
      return "Draft review";
    case "dependency_needs_attention":
      return "Dependency review";
    case "version_review_available":
      return "Version review";
    case "none":
      throw new Error(
        'focus_type "none" is never actionable and must never become a work item',
      );
  }
}

/** Worklist archetype family consistency (mirrors
 * `features/vfx/review-inbox/workItem.ts`'s `workItemIcon`): a compact
 * type marker for the group heading, keyed by the same honest
 * `category` string the adapter above already produces. An
 * unrecognised category renders without one rather than guessing.
 * Presentation-only -- never used by the adapter itself. "Draft
 * review" and "Execution Anchor confirmation" both concern the same
 * real object (the Execution Anchor, at different lifecycle stages),
 * so both map to `execution-anchor`, mirroring how VFX's own "Draft
 * review" (Core Anchor's draft stage) maps to `core-anchor`. */
export function cgWorkItemIcon(category: string): IconName | null {
  switch (category) {
    case "Execution Anchor confirmation":
    case "Draft review":
      return "execution-anchor";
    case "Dependency review":
      return "coordination";
    case "Version review":
      return "version";
    default:
      return null;
  }
}

/** Every actionable `current_focus` becomes exactly one
 * `CgReviewWorkItem`. Non-actionable (`focus_type === "none"`) Tasks
 * contribute nothing -- an honest empty CG Review Inbox is possible,
 * and expected, whenever no Task has real actionable work. */
export function adaptCgCurrentFocusToWorkItems(
  items: CgInboxItemRead[],
): CgReviewWorkItem[] {
  const workItems: CgReviewWorkItem[] = [];

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
      openDependencyCount: item.open_dependency_count,
      route: focus.target_route,
    });
  }

  return workItems;
}
