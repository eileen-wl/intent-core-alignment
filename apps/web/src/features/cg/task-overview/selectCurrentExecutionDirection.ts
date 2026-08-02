import type {
  CgInboxItemRead,
  DecisionRead,
  ExecutionAnchorRevisionRead,
  ReviewNoteRead,
  TaskDependencyRead,
} from "@intent-core/contracts";

import {
  excerptText,
  type WorkingDirectionItem,
  type WorkingDirectionSection,
} from "@/lib/workingDirection";

/** Explicit input for the pure selector below -- deliberately its own
 * local shape (a subset of `./data.ts`'s `TaskOverviewData`), not a
 * reference to that interface, so this module has no import-time
 * dependency on the loader and stays trivially unit-testable with a
 * hand-built fixture object. */
export interface SelectCurrentExecutionDirectionInput {
  item: CgInboxItemRead;
  coreAnchorSummary: string | null;
  confirmedExecutionAnchorRevision: ExecutionAnchorRevisionRead | null;
  executionAnchorDecisions: DecisionRead[];
  dependencies: TaskDependencyRead[];
  latestReviewNote: ReviewNoteRead | null;
}

/** Step 9B-1: pure, deterministic selector for CG's Current Execution
 * Direction. No I/O, no LLM call. A draft Execution Anchor revision is
 * never read here -- only `confirmedExecutionAnchorRevision`, which the
 * loader guarantees is `status === "confirmed"` or `null`. */
export function selectCurrentExecutionDirection(
  data: SelectCurrentExecutionDirectionInput,
): WorkingDirectionSection {
  const taskId = data.item.task_id;
  const revision = data.confirmedExecutionAnchorRevision;

  const confirmDecision = data.executionAnchorDecisions.find(
    (decision) => decision.decision_type === "confirm_execution_anchor",
  );

  const items: WorkingDirectionItem[] = [];

  items.push({
    id: "task-goal",
    label: "What this Task must achieve",
    value:
      revision?.technical_boundaries ?? "No confirmed Execution Anchor yet.",
    // Owner-validation correction: an absent confirmed revision is a
    // current production state, never confirmed human direction.
    authority: revision ? "human-confirmed" : undefined,
    sourceType: "execution_anchor_revision",
    sourceId: revision?.id,
    timestamp: revision?.confirmed_at ?? undefined,
    detail: revision
      ? formatConfirmedDetail(
          "CG Supervisor",
          confirmDecision?.rationale ?? null,
        )
      : undefined,
    href: `/cg/tasks/${taskId}/execution`,
  });

  items.push({
    id: "core-anchor-context",
    label: "Relevant confirmed Core Anchor context",
    value: data.coreAnchorSummary ?? "No confirmed Core Anchor yet.",
    authority: data.coreAnchorSummary ? "human-confirmed" : undefined,
    sourceType: "core_anchor_revision",
    detail: data.coreAnchorSummary ? "Confirmed by VFX Supervisor" : undefined,
  });

  const hasProductionReadyCriteria = !!revision?.production_ready_criteria;
  items.push({
    id: "production-ready-criteria",
    label: "Production-ready criteria",
    value: !revision
      ? "No confirmed Execution Anchor yet."
      : hasProductionReadyCriteria
        ? revision.production_ready_criteria!
        : "No production-ready criteria have been recorded in the confirmed Execution Anchor.",
    // A confirmed parent Execution Anchor does not make an empty
    // optional child field (production-ready criteria) confirmed
    // content -- only the actual recorded criteria inherit
    // Human-confirmed authority and confirmation provenance.
    authority: hasProductionReadyCriteria ? "human-confirmed" : undefined,
    sourceType: "execution_anchor_revision",
    sourceId: revision?.id,
    detail: hasProductionReadyCriteria
      ? "Confirmed by CG Supervisor"
      : undefined,
    href: `/cg/tasks/${taskId}/execution`,
  });

  const openDependencies = data.dependencies.filter(
    (dependency) => dependency.status === "open",
  );
  items.push({
    id: "current-dependencies",
    label: "Current dependencies",
    value:
      openDependencies.length === 0
        ? "No open dependencies for this Task."
        : `${openDependencies.length} open of ${data.dependencies.length} recorded.`,
    authority: "production-fact",
    sourceType: "task_dependency",
    href: `/cg/tasks/${taskId}/dependencies`,
  });

  items.push({
    id: "latest-version-feedback",
    label: "Latest Version and feedback",
    value: data.latestReviewNote
      ? excerptText(data.latestReviewNote.content)
      : "No new feedback.",
    authority: "production-fact",
    sourceType: "review_note",
    sourceId: data.latestReviewNote?.id,
    timestamp: data.latestReviewNote?.created_at,
    detail: data.item.latest_version_name
      ? `From ${data.item.latest_version_name}${
          data.item.latest_version_number
            ? ` (v${data.item.latest_version_number})`
            : ""
        }`
      : undefined,
    href: `/cg/tasks/${taskId}/version-review`,
  });

  const focus = data.item.current_focus;
  items.push({
    id: "next-action",
    label: "What needs your action next",
    value: focus.actionable
      ? focus.title
      : "Nothing requires your attention on this Task right now.",
    authority: focus.actionable ? "human-review-required" : "production-fact",
    sourceType: "current_focus",
    detail: focus.actionable ? "Derived current focus" : undefined,
    href: focus.actionable ? focus.target_route : undefined,
  });

  const escalations = data.dependencies.filter(
    (dependency) =>
      dependency.kind === "escalation" && dependency.status === "open",
  );
  items.push({
    id: "escalate-to-vfx",
    label: "When to escalate to VFX",
    value:
      escalations.length === 0
        ? "No open escalation to VFX for this Task."
        : escalations[0].description,
    authority: "production-fact",
    sourceType: "task_dependency",
    sourceId: escalations[0]?.id,
    href: `/cg/tasks/${taskId}/dependencies`,
  });

  return { title: "Current Execution Direction", items };
}

function formatConfirmedDetail(role: string, rationale: string | null): string {
  return rationale
    ? `Confirmed by ${role} -- ${rationale}`
    : `Confirmed by ${role}`;
}
