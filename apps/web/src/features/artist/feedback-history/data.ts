import type {
  ArtistFeedbackHistoryRead,
  ArtistInboxItemRead,
} from "@intent-core/contracts";

import {
  fetchArtistInboxItem,
  getTaskFeedbackHistory,
  listVersionsForShot,
} from "@/features/artist/api";
import { isVersionInTaskScope } from "@/lib/taskScopedVersions";

/** `/artist/tasks/:taskId/feedback-history` (Step 7C-5) -- the real,
 * newest-first Feedback History timeline for this Task. This is the
 * Artist-facing history surface -- there is deliberately no separate
 * Activity tab in the Artist workspace.
 *
 * Step 8C-6/8C-7 correction: `build_task_feedback_history` (apps/api)
 * sources its `version_recorded`/`review_note_recorded` events from
 * every Version under this Task's *Shot*, not this Task specifically
 * -- an already-existing gap, unlike every other event source in that
 * same aggregate (Artist guidance/CG review/Cross-role Assessment/
 * Dependency/Execution Anchor Decision events), which is already
 * correctly `task_id`-scoped server-side. Rather than change that
 * backend aggregate's query shape for this frontend-integration slice,
 * this loader fetches the Shot's real Version list a second time
 * (already a normal read, no write) and filters out any event whose
 * `related_version_id` points at a Version belonging to a *different*
 * real Task -- the same compatibility rule every other Task Workspace
 * page now applies (see `@/lib/taskScopedVersions`). An event with no
 * `related_version_id` (e.g. an Execution Anchor Decision, a
 * Dependency) is never affected -- those event sources were already
 * correctly Task-scoped. A related Version this fetch cannot verify is
 * excluded (fails closed), never shown as if confirmed in-scope. */
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

  const [history, shotVersions] = await Promise.all([
    getTaskFeedbackHistory(taskId),
    listVersionsForShot(item.shot_id),
  ]);

  const versionsById = new Map(
    shotVersions.map((version) => [version.id, version]),
  );
  const events = history.events.filter((event) => {
    if (event.related_version_id == null) {
      return true;
    }
    const relatedVersion = versionsById.get(event.related_version_id);
    if (relatedVersion == null) {
      return false;
    }
    return isVersionInTaskScope(relatedVersion, taskId);
  });

  return { item, history: { ...history, events } };
}
