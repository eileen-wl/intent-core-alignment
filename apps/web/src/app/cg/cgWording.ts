import type { CgInboxItemRead } from "@intent-core/contracts";

/** CG role-worded shared display helpers -- mirrors `app/vfx/vfxWording.ts`'s
 * shape (shared between row components and context headers so no two
 * surfaces describe the same real state differently), CG-specific
 * vocabulary. */
export function executionAnchorStateLabel(
  state: CgInboxItemRead["execution_anchor_state"],
): string {
  switch (state) {
    case "confirmed":
      return "Confirmed";
    case "draft_pending":
      return "Draft pending review";
    default:
      return "No Execution Anchor";
  }
}

export function versionDisplayText(item: CgInboxItemRead): string {
  if (!item.latest_version_name) {
    return "No Version recorded yet";
  }
  return item.latest_version_number
    ? `${item.latest_version_name} (v${item.latest_version_number})`
    : item.latest_version_name;
}

export function dependencyCountLabel(count: number): string {
  if (count === 0) return "No open dependencies";
  return `${count} open ${count === 1 ? "dependency" : "dependencies"}`;
}
