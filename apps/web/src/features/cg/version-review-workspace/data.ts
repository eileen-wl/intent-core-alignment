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

/** `/cg/tasks/:taskId/version-review` (Step 7C-4). A Task's associated
 * Production Versions are its Shot's Versions -- no persisted
 * Task<->Version link exists in the domain (see
 * `execution_anchor_service`'s own context-snapshot assembly, which
 * relies on the same relationship); this is the honest existing-domain
 * reuse, not a fabricated Task<->Version link. */
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

  const [versions, coreAnchor, executionRevisions] = await Promise.all([
    listVersionsForShot(item.shot_id),
    getCoreAnchor(item.shot_id),
    listExecutionAnchorRevisions(taskId),
  ]);

  const versionEntries: VersionReviewEntry[] = await Promise.all(
    versions.map(async (version) => ({
      version,
      reviewNotes: await listReviewNotesForVersion(version.id),
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
