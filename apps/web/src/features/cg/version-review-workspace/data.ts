import type {
  CGSupervisorReviewRead,
  CgInboxItemRead,
  CoreAnchorRevisionRead,
  ExecutionAnchorRevisionRead,
  ReviewNoteRead,
  VersionRead,
} from "@intent-core/contracts";

import {
  fetchCgInboxItem,
  getCoreAnchor,
  listCgSupervisorReviews,
  listCoreAnchorRevisions,
  listExecutionAnchorRevisions,
  listReviewNotesForVersion,
  listVersionsForShot,
} from "@/features/cg/api";
import { getEffectiveTimestamp } from "@/lib/effectiveTimestamp";
import { filterVersionsForTask } from "@/lib/taskScopedVersions";

/** `/cg/tasks/:taskId/version-review` (Step 7C-4, Task-scoped since
 * Step 8C-6/8C-7). Starts from the Task's Shot's full Version list,
 * then keeps only Versions that belong to this Task: a real
 * `task_id` match (a ftrack-synced Version), or a null `task_id` (the
 * existing manual/legacy compatibility fallback --
 * `versions_and_feedback.models.Version`'s own module docstring: "a
 * Shot may have several Tasks and several Versions with no join
 * between them" for manual rows, unchanged). A Version linked to a
 * *different* real Task under the same Shot is excluded -- see
 * `@/lib/taskScopedVersions`. */
export interface VersionReviewEntry {
  version: VersionRead;
  reviewNotes: ReviewNoteRead[];
}

export interface VersionReviewWorkspaceData {
  item: CgInboxItemRead;
  versions: VersionReviewEntry[];
  coreAnchorSummary: string | null;
  activeExecutionRevision: ExecutionAnchorRevisionRead | null;
  cgSupervisorReviews: CGSupervisorReviewRead[];
}

export async function loadVersionReviewWorkspaceData(
  taskId: string,
): Promise<VersionReviewWorkspaceData | null> {
  const item = await fetchCgInboxItem(taskId);
  if (item === null) {
    return null;
  }

  const [shotVersions, coreAnchor, executionRevisions] = await Promise.all([
    listVersionsForShot(item.shot_id),
    getCoreAnchor(item.shot_id),
    listExecutionAnchorRevisions(taskId),
  ]);

  // Task-scoped filtering happens before sorting/selection (Step
  // 8C-6/8C-7) -- a Version linked to a different Task under the same
  // Shot must never reach this Task Workspace at all, not merely be
  // hidden after being chosen as "the" selected Version.
  const taskVersions = filterVersionsForTask(shotVersions, taskId).sort(
    (a, b) => getEffectiveTimestamp(a) - getEffectiveTimestamp(b),
  );

  const versionEntries: VersionReviewEntry[] = await Promise.all(
    taskVersions.map(async (version) => ({
      version,
      reviewNotes: [...(await listReviewNotesForVersion(version.id))].sort(
        (a, b) => getEffectiveTimestamp(a) - getEffectiveTimestamp(b),
      ),
    })),
  );

  let coreAnchorSummary: string | null = null;
  if (coreAnchor !== null && coreAnchor.active_revision_id !== null) {
    const coreRevisions: CoreAnchorRevisionRead[] =
      await listCoreAnchorRevisions(item.shot_id);
    coreAnchorSummary =
      coreRevisions.find(
        (revision) => revision.id === coreAnchor.active_revision_id,
      )?.core_summary ?? null;
  }

  const activeExecutionRevision =
    executionRevisions.find((revision) => revision.status === "confirmed") ??
    null;
  const cgSupervisorReviews = activeExecutionRevision
    ? await listCgSupervisorReviews(activeExecutionRevision.id)
    : [];

  return {
    item,
    versions: versionEntries,
    coreAnchorSummary,
    activeExecutionRevision,
    cgSupervisorReviews,
  };
}
