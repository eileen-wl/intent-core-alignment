import type {
  ArtistAgentGuidanceRead,
  ArtistInboxItemRead,
  CoreAnchorRevisionRead,
  ExecutionAnchorRevisionRead,
  ReviewNoteRead,
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
  listReviewNotesForVersion,
} from "@/features/artist/api";
import { getEffectiveTimestamp } from "@/lib/effectiveTimestamp";
import type { WorkingDirectionSection } from "@/lib/workingDirection";
import { selectCurrentWorkingDirection } from "./selectCurrentWorkingDirection";

/** `/artist/tasks/:taskId` (Step 7C-5, extended Step 9B-1) -- real
 * read-only context split into WHY (confirmed Core Anchor), HOW
 * (confirmed Execution Anchor), WHAT TO DO NOW (Artist guidance +
 * current focus), and the Current Working Direction summary. Both
 * Anchors are read-only display only here -- the Artist can never edit
 * or confirm either from this workspace. */
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
  /** The newest Review Note on `item.latest_version_id`, by effective
   * timestamp -- `null` when there is no latest Version or it has no
   * Review Notes yet. */
  latestReviewNote: ReviewNoteRead | null;
  /** Derived, read-only Current Working Direction summary (Step 9B-1)
   * -- never a new authoritative object. */
  workingDirection: WorkingDirectionSection;
}

export async function loadTaskOverviewData(
  taskId: string,
): Promise<TaskOverviewData | null> {
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
      revisions.find(
        (revision) => revision.id === coreAnchor.active_revision_id,
      ) ?? null;
  }

  let executionAnchorRevision: ExecutionAnchorRevisionRead | null = null;
  if (executionAnchor !== null && executionAnchor.active_revision_id !== null) {
    const revisions = await listExecutionAnchorRevisions(taskId);
    executionAnchorRevision =
      revisions.find(
        (revision) => revision.id === executionAnchor.active_revision_id,
      ) ?? null;
  }

  // State/content consistency bug fix: `listArtistGuidancesForVersion`
  // returns every ArtistAgentGuidance tied to this Version, which is
  // Shot-level, not Task-level -- a sibling Task on the same Shot can
  // have its own real guidance for the same Version. The removed
  // `?? guidances[0]` fallback let a Task with genuinely no guidance
  // of its own fall through to a *different* Task's guidance, so the
  // page rendered a populated body while `item.guidance_state`
  // (`artist_inbox/service.py`'s `_guidance_state`, a strict
  // `task_id` + `version_id` match) correctly reported "none" -- the
  // exact contradiction reported in browser. `current-version/data.ts`
  // already gets this right (`.filter((guidance) => guidance.task_id
  // === taskId)`, keeping `currentGuidance` truthfully `null` rather
  // than borrowing another Task's row); this now matches that same
  // strict-match rule, so `latestGuidance` is `null` whenever no
  // guidance genuinely belongs to this Task, exactly when
  // `item.guidance_state` is `"none"`.
  let latestGuidance: ArtistAgentGuidanceRead | null = null;
  if (item.latest_version_id !== null) {
    const guidances = await listArtistGuidancesForVersion(
      item.latest_version_id,
    );
    latestGuidance =
      guidances.find((guidance) => guidance.task_id === taskId) ?? null;
  }

  let latestReviewNote: ReviewNoteRead | null = null;
  if (item.latest_version_id !== null) {
    const notes = await listReviewNotesForVersion(item.latest_version_id);
    const sortedNotes = [...notes].sort(
      (a, b) => getEffectiveTimestamp(b) - getEffectiveTimestamp(a),
    );
    latestReviewNote = sortedNotes[0] ?? null;
  }

  const data = {
    item,
    coreAnchorRevision,
    executionAnchorRevision,
    latestGuidance,
    dependencies,
    latestReviewNote,
  };

  return { ...data, workingDirection: selectCurrentWorkingDirection(data) };
}
