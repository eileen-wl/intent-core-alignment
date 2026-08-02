import type {
  CoreAnchorRevisionRead,
  CrossRoleAssessmentRead,
  ReviewNoteRead,
  VersionRead,
  VfxInboxItemRead,
} from "@intent-core/contracts";

import {
  fetchVfxInboxItem,
  listCoreAnchorRevisions,
  listCrossRoleAssessmentsForShot,
  listDecisionsForRevision,
  listReviewNotesForVersion,
  listVersionsForShot,
} from "@/features/vfx/api";
import { getEffectiveTimestamp } from "@/lib/effectiveTimestamp";

/** `/vfx/shots/:shotId` (Step 9B-1) -- the additional real objects the
 * Shot Overview's "Current Creative Direction" summary needs, beyond
 * the `VfxInboxItemRead` the page already fetched. Every field here
 * comes from an existing, unmodified `features/vfx/api.ts` function --
 * no new backend endpoint was required for VFX. */
export interface ShotOverviewData {
  item: VfxInboxItemRead;
  /** The Shot's currently confirmed Core Anchor revision (with its real
   * `constraints`/`variation_zones`), or `null` when none is confirmed
   * yet. A draft revision is never returned here -- Working Direction
   * must never present a draft as confirmed direction. */
  confirmedCoreAnchorRevision: CoreAnchorRevisionRead | null;
  /** The real rationale (if any) from the Decision that confirmed
   * `confirmedCoreAnchorRevision` -- `null` both when there is no
   * confirmed revision and when one exists but its Decision genuinely
   * carries no rationale. */
  confirmedDecisionRationale: string | null;
  /** The Shot's newest Version by `source_created_at ?? created_at`
   * (Shot-wide, matching the Versions page's own locked behaviour --
   * Working Direction never Task-scopes VFX). */
  latestVersion: VersionRead | null;
  /** The newest Review Note on `latestVersion`, by the same effective
   * timestamp rule. */
  latestReviewNote: ReviewNoteRead | null;
  /** The Shot's current (newest) Cross-role Assessment, or `null` when
   * none has ever been generated. */
  currentAssessment: CrossRoleAssessmentRead | null;
}

/** Returns `null` only when the Shot itself does not exist -- any other
 * failure propagates as a thrown `VfxApiError`, matching every other
 * Step 7C loader's honest-state convention. */
export async function loadShotOverviewData(
  shotId: string,
): Promise<ShotOverviewData | null> {
  const item = await fetchVfxInboxItem(shotId);
  if (item === null) {
    return null;
  }

  const [revisions, versions, assessments] = await Promise.all([
    listCoreAnchorRevisions(shotId),
    listVersionsForShot(shotId),
    listCrossRoleAssessmentsForShot(shotId),
  ]);

  const confirmedCoreAnchorRevision =
    revisions.find((revision) => revision.status === "confirmed") ?? null;

  let confirmedDecisionRationale: string | null = null;
  if (confirmedCoreAnchorRevision) {
    const decisions = await listDecisionsForRevision(
      confirmedCoreAnchorRevision.id,
    );
    const confirmDecision = decisions.find(
      (decision) => decision.decision_type === "confirm_core_anchor",
    );
    confirmedDecisionRationale = confirmDecision?.rationale ?? null;
  }

  const sortedVersions = [...versions].sort(
    (a, b) => getEffectiveTimestamp(b) - getEffectiveTimestamp(a),
  );
  const latestVersion = sortedVersions[0] ?? null;

  let latestReviewNote: ReviewNoteRead | null = null;
  if (latestVersion) {
    const notes = await listReviewNotesForVersion(latestVersion.id);
    const sortedNotes = [...notes].sort(
      (a, b) => getEffectiveTimestamp(b) - getEffectiveTimestamp(a),
    );
    latestReviewNote = sortedNotes[0] ?? null;
  }

  // listCrossRoleAssessmentsForShot already returns newest-first
  // (matches AlignmentWorkspaceData's own documented assumption).
  const currentAssessment = assessments[0] ?? null;

  return {
    item,
    confirmedCoreAnchorRevision,
    confirmedDecisionRationale,
    latestVersion,
    latestReviewNote,
    currentAssessment,
  };
}
