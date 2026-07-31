import type { VfxInboxItemRead, VfxCurrentFocusType } from "@intent-core/contracts";

/**
 * Review work-item architecture (Step 7C-1 content-architecture
 * correction; docs/step-7/16_STEP_7C0D_...md, docs/step-7/15_STEP_7C0C_...md).
 *
 * Workspace Home and Review Inbox both render *work items*, not Shots.
 * A Shot is production context a work item happens to relate to -- never
 * the primary identity of the Inbox. This file is the shared model both
 * pages consume, plus the one adapter Step 7C-1 has real data for.
 *
 * Step 7C-1 source: `current_focus`. Each Shot's already-derived,
 * already-honest `VfxInboxItemRead.current_focus` is the only work-item
 * source available right now. `adaptCurrentFocusToWorkItems` turns every
 * *actionable* current-focus record into exactly one `ReviewWorkItem`
 * (`focus_type === "none"` never becomes a work item -- there is nothing
 * to act on). Because today's backend still expresses "how would a VFX
 * Supervisor reach this" via `current_focus.target_route`, which for the
 * three alignment-family focus types (`alignment_not_followed_by_anchor_action`,
 * `re_anchor_proposal_present`, `assessment_generation_available`) points
 * at `/vfx/shots/:id/alignment` -- a route that does not exist until Step
 * 7C-3 -- this adapter deliberately does NOT forward `target_route`
 * as-is. It re-derives the destination from the locked route rule
 * instead (`workItemRoute` below): Core Anchor confirmation/draft work
 * goes to the real Intent route; everything else goes to the real Shot
 * Overview route. No work item here ever links to an unimplemented
 * Step 7C-3 route.
 *
 * Step 7C-3 extension boundary: additional adapters (Version/Review Note
 * review, Cross-role Assessment interpretation, Re-anchor Proposal
 * consideration as its own object, cross-department conflict, CG
 * escalation, acknowledgement) will each independently produce
 * `ReviewWorkItem[]` from their own real source objects and real ids,
 * concatenated into one flat collection before sorting -- the same shape
 * this adapter already returns. Nothing about `ReviewWorkItem` assumes a
 * Shot has at most one item: `id`/`sourceId` are keyed by
 * `(sourceType, sourceId)`, never by `shotId` alone, so two work items
 * from different sources (or, once Step 7C-3 lands, the same source
 * producing more than one item) can safely reference the same Shot side
 * by side. Workspace Home and Review Inbox both consume this flat
 * `ReviewWorkItem[]` collection -- neither iterates `VfxInboxItemRead[]`
 * directly for its primary list.
 */

/** Every source a work item can come from. Only `"current_focus"` has a
 * real adapter today; the rest are named here so Step 7C-3 adapters
 * extend this union instead of inventing a parallel one. */
export type ReviewWorkItemSourceType =
  | "current_focus"
  | "version_review"
  | "assessment"
  | "proposal"
  | "conflict"
  | "escalation"
  | "acknowledgement";

export interface ReviewWorkItemProject {
  id: string;
  name: string;
}

export interface ReviewWorkItemShot {
  id: string;
  name: string;
  source: VfxInboxItemRead["shot_source"];
}

export interface ReviewWorkItemTask {
  id: string;
  name: string;
}

export interface ReviewWorkItemVersion {
  id: string;
  name: string;
  number: number | null;
}

/** One independent unit of required VFX Supervisor work. Project/Shot/
 * Task/Version/Core-Anchor-state/ftrack-linkage are supporting context,
 * not the primary identity -- callers must lead with `category`/`title`,
 * never with `shot.name` (docs/step-7 Step 7C-1 locked hierarchy). */
export interface ReviewWorkItem {
  /** Stable, globally-unique id: `${sourceType}:${sourceId}`. Never
   * `shotId` alone. */
  id: string;
  sourceType: ReviewWorkItemSourceType;
  /** The source object's own real identity when one exists.
   * `current_focus` has no persisted row of its own, so this adapter
   * uses the Shot id it was derived for -- still safe, because `id`
   * above additionally namespaces by `sourceType` and (for
   * `current_focus`) by `focusType`. */
  sourceId: string;
  /** Honest, user-facing category -- never a fabricated object name
   * (HumanGate/Assessment/Proposal/Decision) unless the source data
   * proves that object exists. */
  category: string;
  /** The required action, always the primary heading. */
  title: string;
  explanation: string;
  /** Ascending; lower sorts first. Reuses the backend's own real
   * priority ordering (`sort_rank` today) -- never re-derived. */
  sortRank: number;
  /** `null` only when the source has no single primary action (never
   * true for an actionable-only collection, kept for shape symmetry
   * with `VfxInboxCurrentFocusRead`). */
  actionLabel: string | null;
  /** A real persisted status, only when the source actually has one.
   * `current_focus` has none (docs/step-7/15_STEP_7C0C_...md §2's
   * truthfulness rule: no persisted "addressed"/"unresolved" flag
   * exists), so this adapter never sets it. */
  status?: string;
  project?: ReviewWorkItemProject;
  shot?: ReviewWorkItemShot;
  task?: ReviewWorkItemTask;
  version?: ReviewWorkItemVersion;
  coreAnchorState?: VfxInboxItemRead["core_anchor_state"];
  /** Destination route, already corrected for Step 7C-3 route
   * availability -- see `workItemRoute` below. Callers should navigate
   * here directly rather than re-deriving a route from `focusType`. */
  route: string;
}

const CORE_ANCHOR_ROUTE_FOCUS_TYPES: ReadonlySet<VfxCurrentFocusType> = new Set([
  "core_anchor_gate_pending",
  "core_anchor_draft_needs_review",
]);

/** Locked route rule (Step 7C-1 §6/§9): Core Anchor draft or
 * confirmation work opens the real Intent route; every other currently
 * supported work item opens the real Shot Overview route. No work item
 * ever links to `/versions`, `/alignment`, or `/activity` -- none of
 * those routes exist until Step 7C-3. */
function workItemRoute(shotId: string, focusType: VfxCurrentFocusType): string {
  if (CORE_ANCHOR_ROUTE_FOCUS_TYPES.has(focusType)) {
    return `/vfx/shots/${shotId}/intent`;
  }
  return `/vfx/shots/${shotId}`;
}

/** Honest user-facing category per real `focus_type` (Step 7C-1 §3/§6).
 * `"none"` never reaches this function -- `adaptCurrentFocusToWorkItems`
 * only calls it for `actionable` records, and `"none"` is never
 * actionable, so the fallthrough is a defensive, loud failure rather
 * than a silently wrong label. */
function workItemCategory(focusType: VfxCurrentFocusType): string {
  switch (focusType) {
    case "core_anchor_gate_pending":
      return "Core Anchor confirmation";
    case "core_anchor_draft_needs_review":
      return "Draft review";
    case "alignment_not_followed_by_anchor_action":
    case "re_anchor_proposal_present":
      return "Alignment interpretation";
    case "assessment_generation_available":
      return "Attention required";
    case "none":
      throw new Error("focus_type \"none\" is never actionable and must never become a work item");
  }
}

function taskFrom(item: VfxInboxItemRead): ReviewWorkItemTask | undefined {
  return item.relevant_task_id && item.relevant_task_name
    ? { id: item.relevant_task_id, name: item.relevant_task_name }
    : undefined;
}

function versionFrom(item: VfxInboxItemRead): ReviewWorkItemVersion | undefined {
  return item.relevant_version_id && item.relevant_version_name
    ? {
        id: item.relevant_version_id,
        name: item.relevant_version_name,
        number: item.relevant_version_number,
      }
    : undefined;
}

/** Step 7C-1's one real adapter: every actionable `current_focus`
 * becomes exactly one `ReviewWorkItem`. Non-actionable (`focus_type ===
 * "none"`) Shots contribute nothing -- an honest empty Review Inbox is
 * possible, and expected, whenever no Shot has real actionable work. */
export function adaptCurrentFocusToWorkItems(items: VfxInboxItemRead[]): ReviewWorkItem[] {
  const workItems: ReviewWorkItem[] = [];

  for (const item of items) {
    const focus = item.current_focus;
    if (!focus.actionable) continue;

    workItems.push({
      id: `current_focus:${item.shot_id}:${focus.focus_type}`,
      sourceType: "current_focus",
      sourceId: item.shot_id,
      category: workItemCategory(focus.focus_type),
      title: focus.title,
      explanation: focus.explanation,
      sortRank: item.sort_rank,
      actionLabel: focus.primary_action_label,
      project: { id: item.project_id, name: item.project_name },
      shot: { id: item.shot_id, name: item.shot_name, source: item.shot_source },
      task: taskFrom(item),
      version: versionFrom(item),
      coreAnchorState: item.core_anchor_state,
      route: workItemRoute(item.shot_id, focus.focus_type),
    });
  }

  return workItems;
}
