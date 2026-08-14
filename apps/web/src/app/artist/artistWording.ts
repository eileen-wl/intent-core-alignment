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

/** Mirrors `app/cg/cgWording.ts`'s `dependencyCountLabel` exactly --
 * same real `open_dependency_count` shape, same grammar. */
export function dependencyCountLabel(count: number): string {
  if (count === 0) return "No open dependencies";
  return `${count} open ${count === 1 ? "dependency" : "dependencies"}`;
}

/** `open_review_note_count` is presence-derived server-side (an
 * existence check, `1` if any real Review Note exists on the latest
 * Version, never a true count of every one) -- "recorded" (not
 * "unread": no read/unread tracking exists anywhere in the Review Note
 * domain model) stays accurate whether the count is exactly 1 today or
 * a real multi-note count in a future backend revision. */
export function reviewNoteCountLabel(count: number): string {
  if (count === 0) return "No Review Notes recorded";
  return `${count} Review ${count === 1 ? "Note" : "Notes"} recorded`;
}
