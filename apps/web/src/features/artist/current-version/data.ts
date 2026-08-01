import type {
  ArtistAgentGuidanceRead,
  ArtistInboxItemRead,
  CGSupervisorReviewRead,
  CoreAnchorRevisionRead,
  CrossRoleAssessmentRead,
  ExecutionAnchorRevisionRead,
  ReviewNoteRead,
  VersionRead,
} from "@intent-core/contracts";

import {
  fetchArtistInboxItem,
  getCoreAnchor,
  getExecutionAnchor,
  listArtistGuidancesForVersion,
  listCgSupervisorReviews,
  listCoreAnchorRevisions,
  listCrossRoleAssessmentsForVersion,
  listExecutionAnchorRevisions,
  listReviewNotesForVersion,
  listVersionsForShot,
} from "@/features/artist/api";

/** `/artist/tasks/:taskId/current-version` (Step 7C-5) -- real
 * Production Versions for the Task's Shot (the repository's established
 * convention: a Task's associated Versions are its Shot's Versions, no
 * persisted Task<->Version link exists), the selected Version's Review
 * Notes, applicable Artist guidance, active Anchor context, and related
 * cross-role evidence where it genuinely exists. Never confuses a
 * Production Version with an Anchor Revision -- these are always kept
 * as clearly distinct objects. */
export interface CurrentVersionData {
  item: ArtistInboxItemRead;
  /** Every real recorded Version for this Task's Shot, newest first. */
  versions: VersionRead[];
  /** The Version currently selected (via `?version=`, or the newest by
   * default) -- `null` only when no Version exists yet at all. */
  selectedVersion: VersionRead | null;
  reviewNotes: ReviewNoteRead[];
  /** Every real ArtistAgentGuidance generated for this Task against the
   * selected Version, newest first. */
  guidances: ArtistAgentGuidanceRead[];
  coreAnchorRevision: CoreAnchorRevisionRead | null;
  executionAnchorRevision: ExecutionAnchorRevisionRead | null;
  cgSupervisorReviews: CGSupervisorReviewRead[];
  crossRoleAssessments: CrossRoleAssessmentRead[];
}

export async function loadCurrentVersionData(
  taskId: string,
  selectedVersionId?: string,
): Promise<CurrentVersionData | null> {
  const item = await fetchArtistInboxItem(taskId);
  if (item === null) {
    return null;
  }

  const [versions, coreAnchor, executionAnchor] = await Promise.all([
    listVersionsForShot(item.shot_id),
    getCoreAnchor(item.shot_id),
    getExecutionAnchor(taskId),
  ]);

  const sortedVersions = [...versions].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const selectedVersion =
    (selectedVersionId ? sortedVersions.find((version) => version.id === selectedVersionId) : null) ??
    sortedVersions[0] ??
    null;

  const [reviewNotes, guidancesForVersion, crossRoleAssessments] = selectedVersion
    ? await Promise.all([
        listReviewNotesForVersion(selectedVersion.id),
        listArtistGuidancesForVersion(selectedVersion.id),
        listCrossRoleAssessmentsForVersion(selectedVersion.id, taskId),
      ])
    : [[], [], []];

  const guidances = guidancesForVersion
    .filter((guidance) => guidance.task_id === taskId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  let coreAnchorRevision: CoreAnchorRevisionRead | null = null;
  if (coreAnchor !== null && coreAnchor.active_revision_id !== null) {
    const revisions = await listCoreAnchorRevisions(item.shot_id);
    coreAnchorRevision =
      revisions.find((revision) => revision.id === coreAnchor.active_revision_id) ?? null;
  }

  let executionAnchorRevision: ExecutionAnchorRevisionRead | null = null;
  let cgSupervisorReviews: CGSupervisorReviewRead[] = [];
  if (executionAnchor !== null && executionAnchor.active_revision_id !== null) {
    const revisions = await listExecutionAnchorRevisions(taskId);
    executionAnchorRevision =
      revisions.find((revision) => revision.id === executionAnchor.active_revision_id) ?? null;
    if (executionAnchorRevision !== null) {
      cgSupervisorReviews = await listCgSupervisorReviews(executionAnchorRevision.id);
    }
  }

  return {
    item,
    versions: sortedVersions,
    selectedVersion,
    reviewNotes,
    guidances,
    coreAnchorRevision,
    executionAnchorRevision,
    cgSupervisorReviews,
    crossRoleAssessments,
  };
}
