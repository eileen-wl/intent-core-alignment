import type { ShotActivityRead, VfxInboxItemRead } from "@intent-core/contracts";

import { fetchVfxInboxItem, getShotActivity } from "@/features/vfx/api";

/** `/vfx/shots/:shotId/activity` (Step 7C-3) -- what has happened to
 * this Shot's intent, review, and alignment over time. `activity.events`
 * is already the real, chronologically-ordered (newest first) timeline
 * `intent_core_api.activity.service.build_shot_activity` assembles from
 * persisted Core Anchor / Decision / Version / Review Note / Cross-role
 * Assessment / Re-anchor Proposal / ExternalEntityLink rows -- this page
 * never re-derives or re-orders it. */
export interface ActivityWorkspaceData {
  item: VfxInboxItemRead;
  activity: ShotActivityRead;
}

/** Returns `null` only when the Shot itself does not exist -- any other
 * failure propagates as a thrown `VfxApiError`. */
export async function loadActivityWorkspaceData(
  shotId: string,
): Promise<ActivityWorkspaceData | null> {
  const item = await fetchVfxInboxItem(shotId);
  if (item === null) {
    return null;
  }

  const activity = await getShotActivity(shotId);

  return { item, activity };
}
