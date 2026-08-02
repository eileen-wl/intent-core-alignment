import type {
  CgCurrentFocusType,
  DepartmentExecutionAnchorState,
  DepartmentExecutionLastUpdatedSource,
  DepartmentExecutionVersionScope,
} from "@intent-core/contracts";

import type { StatusBadgeStatus } from "@/design";

/** Step 9B-3: honest, human-readable copy for each real
 * `DepartmentExecutionAnchorState` value -- never the raw enum, and
 * never implying "confirmed" for anything short of a real confirmed
 * revision. */
const STATE_LABEL: Record<DepartmentExecutionAnchorState, string> = {
  none: "No Execution Anchor yet",
  draft: "Draft awaiting CG completion",
  awaiting_confirmation: "Awaiting CG confirmation",
  confirmed: "Confirmed",
  rejected: "Rejected",
};

const STATE_BADGE_STATUS: Record<
  DepartmentExecutionAnchorState,
  StatusBadgeStatus
> = {
  none: "neutral",
  draft: "attention",
  awaiting_confirmation: "attention",
  confirmed: "confirmed",
  rejected: "blocking",
};

export function executionAnchorStateLabel(
  state: DepartmentExecutionAnchorState,
  revisionNumber: number | null,
): string {
  const label = STATE_LABEL[state];
  if (state === "confirmed" && revisionNumber !== null) {
    return `${label} (Revision ${revisionNumber})`;
  }
  return label;
}

export function executionAnchorStateBadgeStatus(
  state: DepartmentExecutionAnchorState,
): StatusBadgeStatus {
  return STATE_BADGE_STATUS[state];
}

/** Step 9B-3: which real source object contributed a row's
 * `last_updated_at` -- rendered as a short, human-readable phrase, never
 * the raw internal discriminator string. */
const LAST_UPDATED_SOURCE_LABEL: Record<
  DepartmentExecutionLastUpdatedSource,
  string
> = {
  task_created: "Task created",
  execution_anchor_revision: "Execution Anchor updated",
  version: "Production Version recorded",
  dependency: "Dependency recorded",
  escalation: "Escalation recorded",
  alignment_assessment: "Alignment Assessment generated",
};

export function lastUpdatedSourceLabel(
  source: DepartmentExecutionLastUpdatedSource,
): string {
  return LAST_UPDATED_SOURCE_LABEL[source];
}

/** Step 9B-3 owner-validation correction: CG's own Current-focus copy
 * (`cg_inbox.current_focus`) is written in CG's second person ("your
 * confirmation", "your interpretation") for CG's own Review Inbox. That
 * copy must never be rendered unqualified on a VFX page -- it would read
 * as if it were addressed to the VFX Supervisor, and would visually
 * contradict a separately-shown advisory alignment concern or the "no
 * open escalation" line on the same row. This is role-explicit,
 * role-neutral copy keyed only on the real `current_focus_type`
 * discriminator -- never a second focus-ranking algorithm, only a
 * different rendering of the same real state. */
const CG_TASK_FOCUS_LABEL: Record<CgCurrentFocusType, string> = {
  execution_anchor_gate_pending:
    "CG task focus: Execution Anchor draft awaiting CG confirmation.",
  execution_anchor_draft_needs_review:
    "CG task focus: Execution Anchor draft in progress.",
  dependency_needs_attention:
    "CG task focus: an unresolved dependency needs CG interpretation.",
  version_review_available:
    "CG task focus: a Production Version is ready for CG review.",
  none: "No current CG action is required for this Task.",
};

export function cgTaskFocusLabel(focusType: CgCurrentFocusType): string {
  return CG_TASK_FOCUS_LABEL[focusType];
}

/** Step 9B-3 owner-validation correction: a Task-scoped Version
 * (`Version.task_id === task.task_id`) must be visibly distinguished
 * from the Step 8C-6/8C-7 nullable-`task_id` Shot-level fallback -- the
 * latter is not explicitly linked to this Task in ICAS, even when it is
 * the only Version returned. */
const VERSION_SCOPE_LABEL: Record<DepartmentExecutionVersionScope, string> = {
  task: "Task-linked Version",
  shot_unscoped:
    "Shot-level Version fallback — not linked to this Task in ICAS",
};

export function latestVersionScopeLabel(
  scope: DepartmentExecutionVersionScope | null,
): string | null {
  return scope === null ? null : VERSION_SCOPE_LABEL[scope];
}
