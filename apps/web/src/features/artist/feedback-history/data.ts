import type {
  ArtistFeedbackHistoryRead,
  ArtistInboxItemRead,
} from "@intent-core/contracts";

import {
  fetchArtistInboxItem,
  getTaskFeedbackHistory,
} from "@/features/artist/api";

/** `/artist/tasks/:taskId/feedback-history` (Step 7C-5) -- the real,
 * newest-first Feedback History timeline for this Task. This is the
 * Artist-facing history surface -- there is deliberately no separate
 * Activity tab in the Artist workspace. */
export interface FeedbackHistoryData {
  item: ArtistInboxItemRead;
  history: ArtistFeedbackHistoryRead;
}

export async function loadFeedbackHistoryData(
  taskId: string,
): Promise<FeedbackHistoryData | null> {
  const item = await fetchArtistInboxItem(taskId);
  if (item === null) {
    return null;
  }

  const history = await getTaskFeedbackHistory(taskId);

  return { item, history };
}
