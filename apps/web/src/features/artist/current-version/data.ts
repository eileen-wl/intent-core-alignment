import type {
  ArtistAgentGuidanceRead,
  ArtistInboxItemRead,
  CGSupervisorReviewRead,
  CoreAnchorRevisionRead,
  CrossRoleAssessmentRead,
  ExecutionAnchorRevisionRead,
  ReviewNoteRead,
  VersionMediaRead,
  VersionRead,
} from "@intent-core/contracts";

import {
  fetchArtistInboxItem,
  fetchVersionMedia,
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
import { getEffectiveTimestamp } from "@/lib/effectiveTimestamp";
import { filterVersionsForTask } from "@/lib/taskScopedVersions";

/** `/artist/tasks/:taskId/current-version` (Step 7C-5, Task-scoped
 * since Step 8C-6/8C-7) -- real Production Versions for this Task:
 * starts from the Task's Shot's full Version list, then keeps only
 * Versions that belong to this Task (a real `task_id` match, or a null
 * `task_id` -- the existing manual/legacy compatibility fallback,
 * unchanged); a Version linked to a *different* real Task under the
 * same Shot is excluded (see `@/lib/taskScopedVersions`). Filtering
 * happens before sorting/selection, so `selectedVersion` can never be
 * an out-of-scope Version even via a hand-crafted `?version=` id. Also
 * the selected Version's Review Notes, applicable Artist guidance,
 * active Anchor context, and related cross-role evidence where it
 * genuinely exists. Never confuses a Production Version with an Anchor
 * Revision -- these are always kept as clearly distinct objects. */
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
  /** Step 9B-4: transient, read-only ftrack media context for
   * `selectedVersion` only -- `null` when there is no selected Version,
   * or when the role-gated media call itself failed (a media-resolution
   * failure never blocks the rest of this Task page). */
  media: VersionMediaRead | null;
}

export async function loadCurrentVersionData(
  taskId: string,
  actorHeaders: Record<string, string>,
  selectedVersionId?: string,
): Promise<CurrentVersionData | null> {
  const item = await fetchArtistInboxItem(taskId);
  if (item === null) {
    return null;
  }

  const [shotVersions, coreAnchor, executionAnchor] = await Promise.all([
    listVersionsForShot(item.shot_id),
    getCoreAnchor(item.shot_id),
    getExecutionAnchor(taskId),
  ]);

  // Task-scoped filtering happens before sorting/selection (Step
  // 8C-6/8C-7) -- a Version linked to a different Task under the same
  // Shot must never reach this Task Workspace at all, not merely be
  // hidden after being chosen as "the" selected Version. Effective
  // timestamp (`source_created_at ?? created_at`) keeps a real ftrack
  // historical Version sorted by its real ftrack creation time.
  const sortedVersions = filterVersionsForTask(shotVersions, taskId).sort(
    (a, b) => getEffectiveTimestamp(b) - getEffectiveTimestamp(a),
  );
  const selectedVersion =
    (selectedVersionId
      ? sortedVersions.find((version) => version.id === selectedVersionId)
      : null) ??
    sortedVersions[0] ??
    null;

  const [reviewNotesRaw, guidancesForVersion, crossRoleAssessments] =
    selectedVersion
      ? await Promise.all([
          listReviewNotesForVersion(selectedVersion.id),
          listArtistGuidancesForVersion(selectedVersion.id),
          listCrossRoleAssessmentsForVersion(selectedVersion.id, taskId),
        ])
      : [[], [], []];
  const reviewNotes = [...reviewNotesRaw].sort(
    (a, b) => getEffectiveTimestamp(a) - getEffectiveTimestamp(b),
  );

  const guidances = guidancesForVersion
    .filter((guidance) => guidance.task_id === taskId)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

  let coreAnchorRevision: CoreAnchorRevisionRead | null = null;
  if (coreAnchor !== null && coreAnchor.active_revision_id !== null) {
    const revisions = await listCoreAnchorRevisions(item.shot_id);
    coreAnchorRevision =
      revisions.find(
        (revision) => revision.id === coreAnchor.active_revision_id,
      ) ?? null;
  }

  let executionAnchorRevision: ExecutionAnchorRevisionRead | null = null;
  let cgSupervisorReviews: CGSupervisorReviewRead[] = [];
  if (executionAnchor !== null && executionAnchor.active_revision_id !== null) {
    const revisions = await listExecutionAnchorRevisions(taskId);
    executionAnchorRevision =
      revisions.find(
        (revision) => revision.id === executionAnchor.active_revision_id,
      ) ?? null;
    if (executionAnchorRevision !== null) {
      cgSupervisorReviews = await listCgSupervisorReviews(
        executionAnchorRevision.id,
      );
    }
  }

  const media = selectedVersion
    ? await fetchVersionMedia(taskId, selectedVersion.id, actorHeaders).catch(
        () => null,
      )
    : null;

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
    media,
  };
}
