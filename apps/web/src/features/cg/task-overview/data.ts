import type {
  CgInboxItemRead,
  TaskActivityEventRead,
  TaskDependencyRead,
} from "@intent-core/contracts";

import {
  fetchCgInboxItem,
  getCoreAnchor,
  getTaskActivity,
  listCoreAnchorRevisions,
  listDependenciesForTask,
} from "@/features/cg/api";

/** `/cg/tasks/:taskId` (Step 7C-4) -- current focus, Core Anchor
 * read-only context, Execution Anchor summary, latest Production
 * Version, unresolved dependencies, and recent activity. Core Anchor
 * context is read-only display only here: the CG Supervisor cannot
 * edit or confirm it from this page. */
export interface TaskOverviewData {
  item: CgInboxItemRead;
  /** The Shot's confirmed Core Anchor `core_summary`, or `null` when
   * none is confirmed yet -- an honest read-only reference, never
   * editable from this workspace. */
  coreAnchorSummary: string | null;
  /** Every real recorded dependency/conflict/escalation for this Task,
   * newest first (backend ordering). */
  dependencies: TaskDependencyRead[];
  /** A short, real slice of this Task's Activity timeline (already
   * newest-first from the backend) -- the full timeline lives on the
   * Activity tab. */
  recentActivity: TaskActivityEventRead[];
}

const RECENT_ACTIVITY_COUNT = 5;

export async function loadTaskOverviewData(
  taskId: string,
): Promise<TaskOverviewData | null> {
  const item = await fetchCgInboxItem(taskId);
  if (item === null) {
    return null;
  }

  const [coreAnchor, dependencies, activity] = await Promise.all([
    getCoreAnchor(item.shot_id),
    listDependenciesForTask(taskId),
    getTaskActivity(taskId),
  ]);

  let coreAnchorSummary: string | null = null;
  if (coreAnchor !== null && coreAnchor.active_revision_id !== null) {
    const revisions = await listCoreAnchorRevisions(item.shot_id);
    const activeRevision = revisions.find(
      (revision) => revision.id === coreAnchor.active_revision_id,
    );
    coreAnchorSummary = activeRevision?.core_summary ?? null;
  }

  return {
    item,
    coreAnchorSummary,
    dependencies,
    recentActivity: activity.events.slice(0, RECENT_ACTIVITY_COUNT),
  };
}
