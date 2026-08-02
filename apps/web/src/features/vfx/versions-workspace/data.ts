import type {
  CrossRoleAssessmentRead,
  ReviewNoteRead,
  VersionRead,
  VfxInboxItemRead,
} from "@intent-core/contracts";

import {
  fetchVfxInboxItem,
  listCrossRoleAssessmentsForShot,
  listReviewNotesForVersion,
  listVersionsForShot,
} from "@/features/vfx/api";
import { getEffectiveTimestamp } from "@/lib/effectiveTimestamp";

/** `/vfx/shots/:shotId/versions` (Step 7C-3) -- the Shot's production-
 * version and review-note workspace. Deliberately not Core Anchor
 * revision history: `Version`/`ReviewNote` are the real, separate
 * domain objects this page reads (see
 * `intent_core_api.versions_and_feedback.models`), never relabeled
 * `CoreAnchorRevisionRead` data. */
export interface VersionWithReviewNotes {
  version: VersionRead;
  /** Oldest first, matching the backend's own real ordering. */
  reviewNotes: ReviewNoteRead[];
}

export interface VersionsWorkspaceData {
  item: VfxInboxItemRead;
  /** Newest Production Version first. */
  versions: VersionWithReviewNotes[];
  /** Real Cross-role Assessments for this Shot, keyed by the real
   * `version_id` they were generated against -- so the selected-version
   * detail area can honestly show "no assessment yet" for a Version
   * nothing has ever assessed, rather than fabricating one. */
  assessmentsByVersionId: Map<string, CrossRoleAssessmentRead[]>;
}

function groupAssessmentsByVersion(
  assessments: CrossRoleAssessmentRead[],
): Map<string, CrossRoleAssessmentRead[]> {
  const map = new Map<string, CrossRoleAssessmentRead[]>();
  for (const assessment of assessments) {
    const existing = map.get(assessment.version_id);
    if (existing) {
      existing.push(assessment);
    } else {
      map.set(assessment.version_id, [assessment]);
    }
  }
  return map;
}

/** Returns `null` only when the Shot itself does not exist -- any other
 * failure propagates as a thrown `VfxApiError`, matching every other
 * Step 7C Workspace's honest-state convention. */
export async function loadVersionsWorkspaceData(
  shotId: string,
): Promise<VersionsWorkspaceData | null> {
  const item = await fetchVfxInboxItem(shotId);
  if (item === null) {
    return null;
  }

  const [versions, assessments] = await Promise.all([
    listVersionsForShot(shotId),
    listCrossRoleAssessmentsForShot(shotId),
  ]);

  // Backend returns oldest-first (its own real `created_at` ordering);
  // this page's required layout is newest-first. Effective timestamp
  // (`source_created_at ?? created_at`, Step 8C-6/8C-7) so a real
  // ftrack historical backfill sorts by its real ftrack creation time,
  // not by whichever moment ICAS happened to ingest it.
  const newestFirst = [...versions].sort(
    (a, b) => getEffectiveTimestamp(b) - getEffectiveTimestamp(a),
  );

  const versionsWithNotes = await Promise.all(
    newestFirst.map(async (version) => ({
      version,
      // Oldest first, matching the backend's own real ordering --
      // unchanged direction, now using the same effective-timestamp
      // basis as everywhere else.
      reviewNotes: [...(await listReviewNotesForVersion(version.id))].sort(
        (a, b) => getEffectiveTimestamp(a) - getEffectiveTimestamp(b),
      ),
    })),
  );

  return {
    item,
    versions: versionsWithNotes,
    assessmentsByVersionId: groupAssessmentsByVersion(assessments),
  };
}
