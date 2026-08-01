import type { VfxInboxItemRead, VfxCurrentFocusType } from "@intent-core/contracts";

/**
 * Review work-item architecture (Step 7C-1 content-architecture
 * correction, updated in Step 7C-3 now that `/versions`, `/alignment`,
 * and `/activity` are real routes; docs/step-7/16_STEP_7C0D_...md,
 * docs/step-7/15_STEP_7C0C_...md).
 *
 * Workspace Home and Review Inbox both render *work items*, not Shots.
 * A Shot is production context a work item happens to relate to -- never
 * the primary identity of the Inbox. This file is the shared model both
 * pages consume, plus two real adapters.
 *
 * Source 1: `current_focus`. Each Shot's already-derived, already-honest
 * `VfxInboxItemRead.current_focus` is one work-item source.
 * `adaptCurrentFocusToWorkItems` turns every *actionable* current-focus
 * record into exactly one `ReviewWorkItem` (`focus_type === "none"`
 * never becomes a work item -- there is nothing to act on).
 * `workItemRoute` still does not blindly forward
 * `current_focus.target_route`: it re-derives the destination from its
 * own locked route rule, kept independently correct so a future
 * backend-side route change cannot silently redirect a work item
 * without this adapter's own review. That rule now matches the
 * backend's real `target_route` for every currently-produced focus type
 * (see `vfx_inbox/current_focus.py`): Core Anchor confirmation/draft
 * work goes to the real Intent route; the three alignment-family types
 * (`alignment_not_followed_by_anchor_action`, `re_anchor_proposal_present`,
 * `assessment_generation_available`) go to the real Alignment route;
 * anything else, and any future unrecognised focus type, safely falls
 * back to the real Shot Overview route.
 *
 * Source 2: `version_review` (Step 7C-3 completion pass).
 * `adaptVersionReviewWorkItems` turns each Shot's real
 * `latest_version_without_review_id` (backend-computed from actual
 * `Version`/`ReviewNote` rows -- see that field's doc comment in
 * `vfx_inbox.py`) into exactly one `ReviewWorkItem`, routed straight to
 * the real Versions workspace. Never every Version, never every Review
 * Note -- only the one real Shot-latest Version that has not yet
 * received a single real Review Note. Concatenated into Review Inbox's
 * collection only (`app/vfx/inbox/ReviewInboxPage.tsx`) -- Workspace
 * Home's "Priority actions" widget stays on `adaptCurrentFocusToWorkItems`
 * alone, unchanged by this pass, per its own existing "never the
 * complete catalogue" scoping.
 *
 * Source 3: `escalation` (Step 7C-4). `adaptEscalationWorkItems` turns
 * each Shot's real `open_cg_escalation_task_id` (backend-computed from a
 * real, persisted, open `TaskDependency` row of `kind="escalation"` --
 * see `intent_core_api.cross_department.models.TaskDependency` and that
 * field's doc comment in `vfx_inbox.py`) into exactly one
 * `ReviewWorkItem`, routed to Shot Overview (VFX has no route into CG
 * Task detail). This is the real CG-to-VFX escalation surface: a CG
 * Supervisor's "Escalate to VFX" action on the Version Review page
 * persists the `TaskDependency` row this adapter reads.
 *
 * Remaining extension boundary: further adapters (Cross-role Assessment
 * interpretation, Re-anchor Proposal consideration as its own object,
 * cross-department conflict, acknowledgement) will each independently
 * produce `ReviewWorkItem[]` from their own real source objects and real
 * ids, concatenated into the same flat collection these three adapters
 * already return. Nothing about `ReviewWorkItem` assumes a Shot has at
 * most one item: `id`/`sourceId` are keyed by `(sourceType, sourceId)`,
 * never by `shotId` alone, so two work items from different sources (or
 * the same source producing more than one item) can safely reference the
 * same Shot side by side. Workspace Home and Review Inbox both consume
 * this flat `ReviewWorkItem[]` collection -- neither iterates
 * `VfxInboxItemRead[]` directly for its primary list.
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

/** The three alignment-family focus types: a Cross-role Assessment
 * awaiting interpretation, a Re-anchor Proposal available for
 * consideration, and a new assessment being generatable -- all real
 * Alignment-object work, per the Step 7C-3 object-responsibility
 * routing table (§5). A Re-anchor Proposal is explained on the
 * Alignment page; its own in-page "Review proposal" action is what
 * leads to Intent, never this work item's own route. */
const ALIGNMENT_ROUTE_FOCUS_TYPES: ReadonlySet<VfxCurrentFocusType> = new Set([
  "alignment_not_followed_by_anchor_action",
  "re_anchor_proposal_present",
  "assessment_generation_available",
]);

/** Locked route rule for `current_focus`-sourced work items (Step 7C-3
 * §5, updating Step 7C-1 §6/§9 now that `/versions`, `/alignment`, and
 * `/activity` are real routes): Core Anchor draft or confirmation work
 * opens the real Intent route; Alignment-family work (assessment
 * interpretation, re-anchor consideration, assessment generation) opens
 * the real Alignment route -- matching the backend's own
 * `current_focus.target_route` for these exact three types (see
 * `vfx_inbox/current_focus.py`), no longer overridden to Shot Overview
 * now that the destination exists. Every other, unrecognised work item
 * safely falls back to the real Shot Overview route. `version_review`
 * work items do not go through this function at all --
 * `adaptVersionReviewWorkItems` sets `/versions` directly, since that
 * source has no `current_focus` counterpart. */
function workItemRoute(shotId: string, focusType: VfxCurrentFocusType): string {
  if (CORE_ANCHOR_ROUTE_FOCUS_TYPES.has(focusType)) {
    return `/vfx/shots/${shotId}/intent`;
  }
  if (ALIGNMENT_ROUTE_FOCUS_TYPES.has(focusType)) {
    return `/vfx/shots/${shotId}/alignment`;
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

/** Step 7C-3 completion pass: the first real `version_review` adapter.
 * Audit of the existing persisted `Version`/`ReviewNote` domain data
 * (no persisted "unread"/"pending" status exists on either -- the same
 * truthfulness rule `current_focus.py` documents) found exactly one
 * real, already-persisted condition worth surfacing: a Shot's own most
 * recently created Production Version that has never received a single
 * real Review Note. That is computed backend-side (never re-derived
 * here) as `VfxInboxItemRead.latest_version_without_review_id` --
 * non-null only for that one real Version per Shot, never every Version
 * and never every Review Note. Routes straight to the real Versions
 * workspace, never through `workItemRoute`'s Core-Anchor/Alignment
 * routing table (that table has no Versions destination). */
export function adaptVersionReviewWorkItems(items: VfxInboxItemRead[]): ReviewWorkItem[] {
  const workItems: ReviewWorkItem[] = [];

  for (const item of items) {
    const versionId = item.latest_version_without_review_id;
    const versionName = item.latest_version_without_review_name;
    if (!versionId || !versionName) continue;

    workItems.push({
      id: `version_review:${versionId}`,
      sourceType: "version_review",
      sourceId: versionId,
      category: "Version review",
      title: "New Production Version awaiting review",
      explanation: `No Review Notes have been recorded yet for "${versionName}"${
        item.latest_version_without_review_number
          ? ` (v${item.latest_version_without_review_number})`
          : ""
      }.`,
      sortRank: item.sort_rank,
      actionLabel: "Review Version",
      project: { id: item.project_id, name: item.project_name },
      shot: { id: item.shot_id, name: item.shot_name, source: item.shot_source },
      version: {
        id: versionId,
        name: versionName,
        number: item.latest_version_without_review_number ?? null,
      },
      coreAnchorState: item.core_anchor_state,
      route: `/vfx/shots/${item.shot_id}/versions`,
    });
  }

  return workItems;
}

/** Source 3: `escalation` (Step 7C-4). Turns each Shot's real
 * `open_cg_escalation_task_id` (backend-computed from a real,
 * persisted, open `TaskDependency` row with `kind="escalation"` --
 * see that field's doc comment in `vfx_inbox.py`) into exactly one
 * `ReviewWorkItem`. Routes to Shot Overview, not through
 * `workItemRoute`'s Core-Anchor/Alignment table: VFX has no route into
 * CG Task detail, so Overview is the honest fallback destination. */
export function adaptEscalationWorkItems(items: VfxInboxItemRead[]): ReviewWorkItem[] {
  const workItems: ReviewWorkItem[] = [];

  for (const item of items) {
    const taskId = item.open_cg_escalation_task_id;
    const taskName = item.open_cg_escalation_task_name;
    const summary = item.open_cg_escalation_summary;
    if (!taskId || !summary) continue;

    workItems.push({
      id: `escalation:${taskId}`,
      sourceType: "escalation",
      sourceId: taskId,
      category: "CG escalation",
      title: "A CG Supervisor escalation needs your attention",
      explanation: summary,
      sortRank: item.sort_rank,
      actionLabel: "Review escalation",
      project: { id: item.project_id, name: item.project_name },
      shot: { id: item.shot_id, name: item.shot_name, source: item.shot_source },
      task: taskName ? { id: taskId, name: taskName } : undefined,
      coreAnchorState: item.core_anchor_state,
      route: `/vfx/shots/${item.shot_id}`,
    });
  }

  return workItems;
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
