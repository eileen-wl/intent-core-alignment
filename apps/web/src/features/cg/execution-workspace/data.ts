import type {
  CgInboxItemRead,
  DecisionRead,
  ExecutionAnchorRevisionRead,
  HumanGateRead,
} from "@intent-core/contracts";

import {
  fetchCgInboxItem,
  getCoreAnchor,
  getExecutionAnchorRevisionHumanGate,
  listExecutionAnchorRevisionDecisions,
  listExecutionAnchorRevisions,
} from "@/features/cg/api";

/** Bounded server-side read model for `/cg/tasks/:taskId/execution`
 * (Step 7C-4), mirroring `features/vfx/intent-workspace/data.ts`'s
 * shape (confirmed/draft split, draft's own HumanGate). */
export interface ExecutionWorkspaceData {
  item: CgInboxItemRead;
  /** The Task's current confirmed revision, or `null` if none has ever
   * been confirmed yet. */
  confirmedRevision: ExecutionAnchorRevisionRead | null;
  /** The Task's current draft revision (at most one can exist), or
   * `null` if none exists. */
  draftRevision: ExecutionAnchorRevisionRead | null;
  /** The draft's own HumanGate, when a draft exists. `null` for a
   * legacy pre-HumanGate draft or when there is no draft at all. */
  draftHumanGate: HumanGateRead | null;
  /** Whether the Task's Shot has a confirmed Core Anchor -- the real
   * prerequisite `execution_anchor_service.create_draft_revision`
   * enforces. Drives whether a new draft can honestly be started. */
  coreAnchorConfirmed: boolean;
  /** Step 9B-2: the real `confirm_execution_anchor` Decision for
   * `confirmedRevision`, reusing the Step 9B-1 read endpoint -- `null`
   * when there is no confirmed revision, or (legacy-compatibility) one
   * exists but genuinely has no recorded confirm Decision. Never the
   * reject Decision. */
  confirmDecision: DecisionRead | null;
}

export async function loadExecutionWorkspaceData(
  taskId: string,
  actorHeaders: Record<string, string>,
): Promise<ExecutionWorkspaceData | null> {
  const item = await fetchCgInboxItem(taskId);
  if (item === null) {
    return null;
  }

  const [coreAnchor, revisions] = await Promise.all([
    getCoreAnchor(item.shot_id),
    listExecutionAnchorRevisions(taskId),
  ]);

  const confirmedRevision =
    revisions.find((revision) => revision.status === "confirmed") ?? null;
  const draftRevision =
    revisions.find((revision) => revision.status === "draft") ?? null;
  const draftHumanGate = draftRevision
    ? await getExecutionAnchorRevisionHumanGate(draftRevision.id)
    : null;

  const confirmDecision = confirmedRevision
    ? ((
        await listExecutionAnchorRevisionDecisions(
          confirmedRevision.id,
          actorHeaders,
        )
      ).find(
        (decision) => decision.decision_type === "confirm_execution_anchor",
      ) ?? null)
    : null;

  return {
    item,
    confirmedRevision,
    draftRevision,
    draftHumanGate,
    coreAnchorConfirmed:
      coreAnchor !== null && coreAnchor.active_revision_id !== null,
    confirmDecision,
  };
}
