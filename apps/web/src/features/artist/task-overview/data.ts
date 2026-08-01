import type {
  ArtistAgentGuidanceRead,
  ArtistInboxItemRead,
  CoreAnchorRevisionRead,
  ExecutionAnchorRevisionRead,
  TaskDependencyRead,
} from "@intent-core/contracts";

import {
  fetchArtistInboxItem,
  getCoreAnchor,
  getExecutionAnchor,
  listArtistGuidancesForVersion,
  listCoreAnchorRevisions,
  listDependenciesForTask,
  listExecutionAnchorRevisions,
} from "@/features/artist/api";

/** `/artist/tasks/:taskId` (Step 7C-5) -- real read-only context split
 * into WHY (confirmed Core Anchor), HOW (confirmed Execution Anchor),
 * and WHAT TO DO NOW (Artist guidance + current focus). Both Anchors are
 * read-only display only here -- the Artist can never edit or confirm
 * either from this workspace. */
export interface TaskOverviewData {
  item: ArtistInboxItemRead;
  /** The Shot's confirmed Core Anchor revision, or `null` when none is
   * confirmed yet -- an honest read-only reference, never editable. */
  coreAnchorRevision: CoreAnchorRevisionRead | null;
  /** The Task's confirmed Execution Anchor revision, or `null` when none
   * is confirmed yet -- an honest read-only reference, never editable. */
  executionAnchorRevision: ExecutionAnchorRevisionRead | null;
  /** The newest ArtistAgentGuidance for the Task's latest Version, or
   * `null` when none has been generated yet. */
  latestGuidance: ArtistAgentGuidanceRead | null;
  /** Every real recorded dependency/conflict/escalation for this Task. */
  dependencies: TaskDependencyRead[];
}

export async function loadTaskOverviewData(taskId: string): Promise<TaskOverviewData | null> {
  const item = await fetchArtistInboxItem(taskId);
  if (item === null) {
    return null;
  }

  const [coreAnchor, executionAnchor, dependencies] = await Promise.all([
    getCoreAnchor(item.shot_id),
    getExecutionAnchor(taskId),
    listDependenciesForTask(taskId),
  ]);

  let coreAnchorRevision: CoreAnchorRevisionRead | null = null;
  if (coreAnchor !== null && coreAnchor.active_revision_id !== null) {
    const revisions = await listCoreAnchorRevisions(item.shot_id);
    coreAnchorRevision =
      revisions.find((revision) => revision.id === coreAnchor.active_revision_id) ?? null;
  }

  let executionAnchorRevision: ExecutionAnchorRevisionRead | null = null;
  if (executionAnchor !== null && executionAnchor.active_revision_id !== null) {
    const revisions = await listExecutionAnchorRevisions(taskId);
    executionAnchorRevision =
      revisions.find((revision) => revision.id === executionAnchor.active_revision_id) ?? null;
  }

  let latestGuidance: ArtistAgentGuidanceRead | null = null;
  if (item.latest_version_id !== null) {
    const guidances = await listArtistGuidancesForVersion(item.latest_version_id);
    latestGuidance =
      guidances.find((guidance) => guidance.task_id === taskId) ?? guidances[0] ?? null;
  }

  return {
    item,
    coreAnchorRevision,
    executionAnchorRevision,
    latestGuidance,
    dependencies,
  };
}
