import type { VfxInboxItemRead } from "@intent-core/contracts";

/** VFX role-worded Signal wording (docs/step-7/06_STEP_7_LOCKED_SOURCE_OF_TRUTH.md
 * §8: "VFX: Human review required"), applied to the real, persisted
 * `attention_level` -- never a fabricated word not backed by a real
 * Signal. Shared between the Inbox row and the Shot Overview so the two
 * surfaces never describe the same Signal differently. */
export function signalStateLabel(
  attentionLevel: VfxInboxItemRead["latest_signal_attention_level"],
): string {
  switch (attentionLevel) {
    case "high":
      return "Human review required";
    case "medium":
      return "Attention needed";
    case "low":
      return "Low attention";
    default:
      return "No signal";
  }
}

/** Independent Task/Version display text (docs/step-7/15_STEP_7C0C_...md
 * §3.1) -- always two separate facts, never joined into one label even
 * when both are present, and honest about absence rather than omitting
 * silently. */
export function taskDisplayText(item: VfxInboxItemRead): string {
  return item.relevant_task_name ?? "No Task recorded yet";
}

export function versionDisplayText(item: VfxInboxItemRead): string {
  if (!item.relevant_version_name) {
    return "No Version recorded yet";
  }
  return item.relevant_version_number
    ? `${item.relevant_version_name} (v${item.relevant_version_number})`
    : item.relevant_version_name;
}
