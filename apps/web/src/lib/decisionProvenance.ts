import type { DecisionRead } from "@intent-core/contracts";

/** Step 9B-2: the standard `MetadataRow` items for a `Decision`'s
 * Human Decision and Provenance block -- reused everywhere a real
 * persisted `Decision` is shown (VFX Intent, VFX Alignment, CG
 * Execution), so actor/rationale/timestamp/supersession render
 * identically instead of each page re-deriving its own copy. Never
 * fabricates a rationale when none was recorded. `sourceId`-shaped
 * values (the superseded Decision's own id) are deliberately never
 * rendered here -- only the fact that supersession happened. */
export function decisionProvenanceItems(
  decision: DecisionRead,
): { label: string; value: string }[] {
  const items = [
    { label: "Actor role", value: decision.actor_human_role ?? "Unknown" },
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
