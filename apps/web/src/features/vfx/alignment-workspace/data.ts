import type {
  CoreAnchorRevisionRead,
  AgentRunRead,
  ContextSnapshotRead,
  CrossRoleAssessmentRead,
  DepartmentExecutionOverviewRead,
  VersionRead,
  VfxInboxItemRead,
} from "@intent-core/contracts";

import {
  fetchDepartmentExecutionOverview,
  fetchVfxInboxItem,
  listCoreAnchorRevisions,
  listCrossRoleAssessmentsForShot,
  listVersionsForShot,
  getAgentRun,
  getContextSnapshot,
} from "@/features/vfx/api";

/** `/vfx/shots/:shotId/alignment` (Step 7C-3) -- whether the reviewed
 * production work aligns with the active Core Anchor, and where human
 * interpretation is required. `CrossRoleAssessment` (with its attached
 * `intent_signal` and, when one exists, `re_anchor_proposal`) is the one
 * real, already-persisted assessment concept this page reads -- the
 * same one `vfx_inbox`'s Current-focus derivation already treats as
 * canonical. The separate, simpler `AlignmentAssessment` (Step 4b) is
 * deliberately not surfaced here: introducing a second "assessment"
 * concept on the same page would contradict "no competing source of
 * truth". */
export interface AlignmentWorkspaceData {
  item: VfxInboxItemRead;
  /** Newest first. `assessments[0]`, when present, is the current
   * assessment; the rest is real assessment history. Honestly empty
   * when no Cross-role Assessment has ever been generated for this
   * Shot. */
  assessments: CrossRoleAssessmentRead[];
  /** Real Version name/number lookup for `assessment.version_id` --
   * never a fabricated label when a Version was since deleted (never
   * happens today; kept `| undefined`-safe regardless). */
  versionsById: Map<string, VersionRead>;
  /** Real Core Anchor Revision lookup for
   * `assessment.core_anchor_revision_id`, so the page can show the real
   * revision number/summary that was active when the assessment ran. */
  revisionsById: Map<string, CoreAnchorRevisionRead>;
  currentRun?: AgentRunRead | null;
  currentSnapshot?: ContextSnapshotRead | null;
  /** VFX Alignment structural pass: the Shot's real Tasks and their
   * Execution Anchor/Version/alignment-concern state, one row per real
   * `Task.id` -- the same read model `ShotOverviewPage`'s Department
   * Execution Overview already uses (`fetchDepartmentExecutionOverview`,
   * no new endpoint). `null` when the role-gated backend call itself
   * fails, so the Department Execution Strip can render its own honest
   * "unavailable" state without failing the whole Alignment page. */
  departmentExecutionOverview: DepartmentExecutionOverviewRead | null;
}

/** Returns `null` only when the Shot itself does not exist -- any other
 * failure propagates as a thrown `VfxApiError`.
 *
 * `actorHeaders` (VFX Alignment structural pass): the trusted,
 * server-resolved VFX Supervisor identity, forwarded only to the one
 * role-gated call (`fetchDepartmentExecutionOverview`) -- every other
 * call in this loader remains an unauthenticated read, unchanged. */
export async function loadAlignmentWorkspaceData(
  shotId: string,
  actorHeaders: Record<string, string>,
): Promise<AlignmentWorkspaceData | null> {
  const item = await fetchVfxInboxItem(shotId);
  if (item === null) {
    return null;
  }

  const [assessments, versions, revisions, departmentExecutionOverview] =
    await Promise.all([
      listCrossRoleAssessmentsForShot(shotId),
      listVersionsForShot(shotId),
      listCoreAnchorRevisions(shotId),
      fetchDepartmentExecutionOverview(shotId, actorHeaders).catch(() => null),
    ]);

  const currentRun = assessments[0]?.agent_run_id
    ? await getAgentRun(assessments[0].agent_run_id)
    : null;
  const currentSnapshot = assessments[0]?.context_snapshot_id
    ? await getContextSnapshot(assessments[0].context_snapshot_id)
    : null;

  return {
    item,
    assessments,
    versionsById: new Map(versions.map((version) => [version.id, version])),
    revisionsById: new Map(
      revisions.map((revision) => [revision.id, revision]),
    ),
    currentRun,
    currentSnapshot,
    departmentExecutionOverview,
  };
}
