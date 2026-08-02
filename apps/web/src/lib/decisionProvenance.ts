import type { DecisionRead } from "@intent-core/contracts";

import { humanRoleLabel } from "./humanRoleLabel";

/** Step 9B-2: the standard `MetadataRow` items for a `Decision`'s
 * Human Decision and Provenance block -- reused everywhere a real
 * persisted `Decision` is shown (VFX Intent, VFX Alignment, CG
 * Execution), so actor/rationale/timestamp/supersession render
 * identically instead of each page re-deriving its own copy. Never
 * fabricates a rationale when none was recorded. `sourceId`-shaped
 * values (the superseded Decision's own id) are deliberately never
 * rendered here -- only the fact that supersession happened. The
 * actor role always renders through `humanRoleLabel` (Step 9B-2
 * owner-validation correction) -- never the raw persisted enum. */
export function decisionProvenanceItems(
  decision: DecisionRead,
): { label: string; value: string }[] {
  const items = [
    {
      label: "Actor role",
      value: humanRoleLabel(decision.actor_human_role),
    },
    {
      label: "Rationale",
      value: decision.rationale || "No rationale was provided.",
    },
    {
      label: "Decided at",
      value: new Date(decision.created_at).toLocaleString(),
    },
  ];
  if (decision.supersedes_decision_id) {
    items.push({ label: "Supersedes", value: "An earlier Decision" });
  }
  return items;
}

const DECISION_ACTION_LABEL: Record<string, string> = {
  confirm_core_anchor: "Confirmed",
  reject_core_anchor: "Rejected",
  confirm_execution_anchor: "Confirmed",
  reject_execution_anchor: "Rejected",
};

const DECISION_ENTITY_LABEL: Record<string, string> = {
  core_anchor_revision: "Core Anchor revision",
  execution_anchor_revision: "Execution Anchor revision",
};

/** Step 9B-2 owner-validation correction: a concise, real Decision
 * outcome statement (e.g. "Confirmed Execution Anchor revision 2"),
 * derived only from the actual persisted `decision_type`/`entity_type`
 * and the real revision number of the object the Decision applies to
 * -- never inferred from an Anchor's own state when no Decision record
 * is available (callers must not call this without a real `decision`).
 * Handles both confirm and reject outcomes identically -- whichever
 * decision a caller has is rendered honestly. */
export function decisionOutcomeStatement(
  decision: DecisionRead,
  revisionNumber: number,
): string {
  const action = DECISION_ACTION_LABEL[decision.decision_type] ?? "Recorded";
  const entity = DECISION_ENTITY_LABEL[decision.entity_type] ?? "revision";
  return `${action} ${entity} ${revisionNumber}`;
}
