import type {
  DepartmentExecutionAnchorState,
  DepartmentExecutionLastUpdatedSource,
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
