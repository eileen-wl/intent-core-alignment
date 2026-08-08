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
/** Package C follow-up (current vs. historical Guidance presentation):
 * one real Guidance record paired with its own real, persisted
 * provenance -- resolved from `guidance.execution_anchor_revision_id`
 * against this Task's actual Execution Anchor revision history, never
 * recomputed/borrowed from today's live Core/Execution Anchor
 * content. A Guidance generated when Execution R1 was confirmed stays
 * reported as "R1" forever, even after Execution R2 is confirmed. */
export interface GuidanceProvenance {
  guidance: ArtistAgentGuidanceRead;
  /** This Guidance's own real Execution Anchor `revision_number` --
   * `null` only if that revision row could not be resolved (should
   * never happen for a real persisted Guidance). */
  executionAnchorRevisionNumber: number | null;
  /** True only when this Guidance's own persisted `execution_anchor_
   * revision_id` is still this Task's currently active/confirmed
   * Execution Anchor revision -- a real id comparison, never a
   * recomputation from today's Core/Execution Anchor content. */
  isCurrent: boolean;
}

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
  /** The same `guidances`, each paired with its own real provenance --
   * see `GuidanceProvenance`. Use this (not `guidances` directly) to
   * decide what "current" vs. "Historical" means for display. */
  guidancesWithProvenance: GuidanceProvenance[];
  /** The one Guidance (if any) whose own persisted Execution Anchor
   * revision is still this Task's currently active/confirmed one --
   * the only Guidance genuinely applicable to the currently confirmed
   * Execution Anchor and Core Anchor. `null` whenever no such Guidance
   * exists yet for the selected Version -- truthfully "Guidance
   * missing" for this Version, even when older, historical Guidance
   * exists for it. */
  currentGuidance: ArtistAgentGuidanceRead | null;
  coreAnchorRevision: CoreAnchorRevisionRead | null;
  executionAnchorRevision: ExecutionAnchorRevisionRead | null;
  cgSupervisorReviews: CGSupervisorReviewRead[];
  crossRoleAssessments: CrossRoleAssessmentRead[];
  /** Step 9B-4: transient, read-only ftrack media context for
   * `selectedVersion` only -- `null` when there is no selected Version,
   * or when the role-gated media call itself failed (a media-resolution
   * failure never blocks the rest of this Task page). */
  media: VersionMediaRead | null;
  /** Package C follow-up (J3 -> J4 Version-publish): true only when
   * this Task's confirmed Execution Anchor is itself based on the
   * Shot's own currently-confirmed Core Anchor revision (genuinely
   * "current", not outdated) AND no Version scoped to this Task yet
   * carries that same Execution Anchor revision number -- the real,
   * truthful signal that "the current Production Version still belongs
   * to the R1/conflict era" and a resolved Version has not been
   * published for it yet. */
  canPublishResolvedVersion: boolean;
  /** This Task's confirmed Execution Anchor revision, whenever
   * `canPublishResolvedVersion` is true -- the real source content the
   * "Publish next Version from Execution Anchor R{n}" action derives
   * its default name/description from. `null` whenever
   * `canPublishResolvedVersion` is `false`. */
  publishableExecutionAnchorRevision: ExecutionAnchorRevisionRead | null;
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

  // Package C follow-up (current vs. historical Guidance): the
  // Execution Anchor revision history is fetched once and reused both
  // to resolve today's active revision (unchanged behaviour) and to
  // resolve each individual Guidance's own real, persisted provenance
  // -- never recomputed from today's live anchor content.
  let executionAnchorRevision: ExecutionAnchorRevisionRead | null = null;
  let cgSupervisorReviews: CGSupervisorReviewRead[] = [];
  const needsExecutionAnchorRevisions =
    (executionAnchor !== null && executionAnchor.active_revision_id !== null) ||
    guidances.length > 0;
  const executionAnchorRevisionsById = new Map<
    string,
    ExecutionAnchorRevisionRead
  >();
  if (needsExecutionAnchorRevisions) {
    const revisions = await listExecutionAnchorRevisions(taskId);
    for (const revision of revisions) {
      executionAnchorRevisionsById.set(revision.id, revision);
    }
    if (
      executionAnchor !== null &&
      executionAnchor.active_revision_id !== null
    ) {
      executionAnchorRevision =
        executionAnchorRevisionsById.get(executionAnchor.active_revision_id) ??
        null;
    }
    if (executionAnchorRevision !== null) {
      cgSupervisorReviews = await listCgSupervisorReviews(
        executionAnchorRevision.id,
      );
    }
  }

  // Package C follow-up (current vs. historical Guidance): a real id
  // comparison against each Guidance's own persisted `execution_
  // anchor_revision_id` -- a Guidance generated against a now-
  // superseded Execution Anchor revision stays reported under its own
  // real revision number and is never treated as current.
  const guidancesWithProvenance: GuidanceProvenance[] = guidances.map(
    (guidance) => {
      const revision = executionAnchorRevisionsById.get(
        guidance.execution_anchor_revision_id,
      );
      return {
        guidance,
        executionAnchorRevisionNumber: revision?.revision_number ?? null,
        isCurrent:
          executionAnchorRevision !== null &&
          guidance.execution_anchor_revision_id === executionAnchorRevision.id,
      };
    },
  );
  const currentGuidance =
    guidancesWithProvenance.find((entry) => entry.isCurrent)?.guidance ?? null;

  const media = selectedVersion
    ? await fetchVersionMedia(taskId, selectedVersion.id, actorHeaders).catch(
        () => null,
      )
    : null;

  // Package C follow-up (J3 -> J4 Version-publish): "the current
  // Version still belongs to the R1/conflict era" is computed purely
  // from real data already fetched above -- no new backend field. The
  // confirmed Execution Anchor must itself be based on the Shot's own
  // currently-confirmed Core Anchor revision (the same real check the
  // backend's `context_state: "outdated"` signal uses, done here
  // directly against `core_anchor_revision_id`), and no Version scoped
  // to this Task may already carry that Execution Anchor's own
  // `revision_number` -- the "Publish" action always numbers the
  // resolved Version it creates to match, so this stays a real,
  // self-consistent signal.
  const maxPublishedVersionNumberForTask = Math.max(
    0,
    ...sortedVersions
      .filter((version) => version.task_id === taskId)
      .map((version) => version.version_number ?? 0),
  );
  const canPublishResolvedVersion =
    executionAnchorRevision !== null &&
    executionAnchorRevision.status === "confirmed" &&
    coreAnchorRevision !== null &&
    executionAnchorRevision.core_anchor_revision_id === coreAnchorRevision.id &&
    executionAnchorRevision.revision_number > maxPublishedVersionNumberForTask;

  return {
    item,
    versions: sortedVersions,
    selectedVersion,
    reviewNotes,
    guidances,
    guidancesWithProvenance,
    currentGuidance,
    coreAnchorRevision,
    executionAnchorRevision,
    cgSupervisorReviews,
    crossRoleAssessments,
    media,
    canPublishResolvedVersion,
    publishableExecutionAnchorRevision: canPublishResolvedVersion
      ? executionAnchorRevision
      : null,
  };
}
