import type { ArtistInboxItemRead } from "@intent-core/contracts";

/** Artist role-worded shared display helpers -- mirrors
 * `app/cg/cgWording.ts`'s shape (shared between row components and
 * context headers so no two surfaces describe the same real state
 * differently), Artist-specific vocabulary. */
export function executionAnchorStateLabel(
  state: ArtistInboxItemRead["execution_anchor_state"],
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

export function guidanceStateLabel(
  state: ArtistInboxItemRead["guidance_state"],
): string {
  switch (state) {
    case "current":
      return "Guidance up to date";
    case "outdated":
      return "Guidance outdated";
    default:
      return "No guidance yet";
  }
}

export function versionDisplayText(item: ArtistInboxItemRead): string {
  if (!item.latest_version_name) {
    return "No Version recorded yet";
  }
  return item.latest_version_number
    ? `${item.latest_version_name} (v${item.latest_version_number})`
    : item.latest_version_name;
}
