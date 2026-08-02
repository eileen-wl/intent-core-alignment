import type {
  CgInboxItemRead,
  DecisionRead,
  ExecutionAnchorRevisionRead,
  ReviewNoteRead,
  TaskActivityEventRead,
  TaskDependencyRead,
} from "@intent-core/contracts";

import {
  fetchCgInboxItem,
  getCoreAnchor,
  getTaskActivity,
  listCoreAnchorRevisions,
  listDependenciesForTask,
  listExecutionAnchorRevisionDecisions,
  listExecutionAnchorRevisions,
  listReviewNotesForVersion,
} from "@/features/cg/api";
import { getEffectiveTimestamp } from "@/lib/effectiveTimestamp";
import type { WorkingDirectionSection } from "@/lib/workingDirection";
import { selectCurrentExecutionDirection } from "./selectCurrentExecutionDirection";

/** `/cg/tasks/:taskId` (Step 7C-4, extended Step 9B-1) -- current focus,
 * Core Anchor read-only context, Execution Anchor summary, latest
 * Production Version, unresolved dependencies, recent activity, and the
 * Current Execution Direction summary. Core Anchor context is read-only
 * display only here: the CG Supervisor cannot edit or confirm it from
 * this page. */
export interface TaskOverviewData {
  item: CgInboxItemRead;
  /** The Shot's confirmed Core Anchor `core_summary`, or `null` when
   * none is confirmed yet -- an honest read-only reference, never
   * editable from this workspace. */
  coreAnchorSummary: string | null;
  /** The Task's currently confirmed Execution Anchor revision (with its
   * real flat content fields), or `null` when none is confirmed yet.
   * A draft revision is never returned here. */
  confirmedExecutionAnchorRevision: ExecutionAnchorRevisionRead | null;
  /** The real confirm Decision(s) for `confirmedExecutionAnchorRevision`
   * (Step 9B-1's new `listExecutionAnchorRevisionDecisions` read),
   * honestly empty when none is confirmed yet or the confirm Decision
   * carries no rationale. */
  executionAnchorDecisions: DecisionRead[];
  /** Every real recorded dependency/conflict/escalation for this Task,
   * newest first (backend ordering). */
  dependencies: TaskDependencyRead[];
  /** A short, real slice of this Task's Activity timeline (already
   * newest-first from the backend) -- the full timeline lives on the
   * Activity tab. */
  recentActivity: TaskActivityEventRead[];
  /** The newest Review Note on `item.latest_version_id`, by effective
   * timestamp -- `null` when there is no latest Version or it has no
   * Review Notes yet. */
  latestReviewNote: ReviewNoteRead | null;
  /** Derived, read-only Current Execution Direction summary (Step
   * 9B-1) -- never a new authoritative object. */
  workingDirection: WorkingDirectionSection;
}

const RECENT_ACTIVITY_COUNT = 5;

export async function loadTaskOverviewData(
  taskId: string,
): Promise<TaskOverviewData | null> {
  const item = await fetchCgInboxItem(taskId);
  if (item === null) {
    return null;
  }

  const [coreAnchor, executionRevisions, dependencies, activity] =
    await Promise.all([
      getCoreAnchor(item.shot_id),
      listExecutionAnchorRevisions(taskId),
      listDependenciesForTask(taskId),
      getTaskActivity(taskId),
    ]);

  let coreAnchorSummary: string | null = null;
  if (coreAnchor !== null && coreAnchor.active_revision_id !== null) {
    const revisions = await listCoreAnchorRevisions(item.shot_id);
    const activeRevision = revisions.find(
      (revision) => revision.id === coreAnchor.active_revision_id,
    );
    coreAnchorSummary = activeRevision?.core_summary ?? null;
  }

  const confirmedExecutionAnchorRevision =
    executionRevisions.find((revision) => revision.status === "confirmed") ??
    null;

  const executionAnchorDecisions = confirmedExecutionAnchorRevision
    ? await listExecutionAnchorRevisionDecisions(
        confirmedExecutionAnchorRevision.id,
      )
    : [];

  let latestReviewNote: ReviewNoteRead | null = null;
  if (item.latest_version_id) {
    const notes = await listReviewNotesForVersion(item.latest_version_id);
    const sortedNotes = [...notes].sort(
      (a, b) => getEffectiveTimestamp(b) - getEffectiveTimestamp(a),
    );
    latestReviewNote = sortedNotes[0] ?? null;
  }

  const data = {
    item,
    coreAnchorSummary,
    confirmedExecutionAnchorRevision,
    executionAnchorDecisions,
    dependencies,
    recentActivity: activity.events.slice(0, RECENT_ACTIVITY_COUNT),
    latestReviewNote,
  };

  return { ...data, workingDirection: selectCurrentExecutionDirection(data) };
}
