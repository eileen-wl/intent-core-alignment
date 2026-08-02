import type {
  ArtistAgentGuidanceRead,
  ArtistInboxItemRead,
  CoreAnchorRevisionRead,
  ExecutionAnchorRevisionRead,
  ReviewNoteRead,
  TaskDependencyRead,
} from "@intent-core/contracts";

import type {
  WorkingDirectionItem,
  WorkingDirectionSection,
} from "@/lib/workingDirection";

/** Explicit input for the pure selector below -- its own local shape (a
 * subset of `./data.ts`'s `TaskOverviewData`), not a reference to that
 * interface, so this module has no import-time dependency on the
 * loader and stays trivially unit-testable with a hand-built fixture. */
export interface SelectCurrentWorkingDirectionInput {
  item: ArtistInboxItemRead;
  coreAnchorRevision: CoreAnchorRevisionRead | null;
  executionAnchorRevision: ExecutionAnchorRevisionRead | null;
  latestGuidance: ArtistAgentGuidanceRead | null;
  dependencies: TaskDependencyRead[];
  latestReviewNote: ReviewNoteRead | null;
}

/** Step 9B-1: pure, deterministic selector for Artist's Current Working
 * Direction. No I/O, no LLM call. Both Anchors are read-only references
 * here -- the Artist can never confirm, reject, or edit either, and
 * this selector never exposes a control implying otherwise (it produces
 * data only; `WorkingDirectionSection`'s renderer has no action
 * controls at all). */
export function selectCurrentWorkingDirection(
  data: SelectCurrentWorkingDirectionInput,
): WorkingDirectionSection {
  const taskId = data.item.task_id;
  const coreAnchor = data.coreAnchorRevision;
  const executionAnchor = data.executionAnchorRevision;

  const items: WorkingDirectionItem[] = [];

  items.push({
    id: "what-to-do",
    label: "What you are being asked to do",
    value:
      executionAnchor?.technical_boundaries ??
      "No confirmed Execution Anchor yet.",
    authority: "human-confirmed",
    sourceType: "execution_anchor_revision",
    sourceId: executionAnchor?.id,
    timestamp: executionAnchor?.confirmed_at ?? undefined,
    detail: executionAnchor ? "Confirmed by CG Supervisor" : undefined,
  });

  items.push({
    id: "why-it-matters",
    label: "Why this matters",
    value: coreAnchor?.core_summary ?? "No confirmed Core Anchor yet.",
    authority: "human-confirmed",
    sourceType: "core_anchor_revision",
    sourceId: coreAnchor?.id,
    detail: coreAnchor ? "Confirmed by VFX Supervisor" : undefined,
  });

  items.push({
    id: "must-remain-unchanged",
    label: "What must remain unchanged",
    value: coreAnchor
      ? joinOrFallback(
          coreAnchor.constraints.map((c) => c.content),
          "No Constraints recorded on the confirmed Core Anchor.",
        )
      : "No confirmed Core Anchor yet.",
    authority: "human-confirmed",
    sourceType: "core_anchor_revision",
    sourceId: coreAnchor?.id,
    detail: coreAnchor ? "Confirmed by VFX Supervisor" : undefined,
  });

  items.push({
    id: "may-explore",
    label: "What you may explore",
    value:
      executionAnchor?.allowed_refinements ??
      "No confirmed Execution Anchor yet.",
    authority: "human-confirmed",
    sourceType: "execution_anchor_revision",
    sourceId: executionAnchor?.id,
    detail: executionAnchor ? "Confirmed by CG Supervisor" : undefined,
  });

  items.push({
    id: "latest-feedback",
    label: "Latest feedback",
    value: data.latestReviewNote?.content ?? "No new feedback.",
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
    href: `/artist/tasks/${taskId}/feedback-history`,
  });

  items.push({
    id: "current-version",
    label: "Current Production Version",
    value: data.item.latest_version_name
      ? `${data.item.latest_version_name}${
          data.item.latest_version_number
            ? ` (v${data.item.latest_version_number})`
            : ""
        }`
      : "No production Version linked yet.",
    authority: "production-fact",
    sourceType: "version",
    sourceId: data.item.latest_version_id ?? undefined,
    href: `/artist/tasks/${taskId}/current-version`,
  });

  items.push({
    id: "artist-guidance",
    label: "Artist Agent guidance",
    value:
      data.latestGuidance?.guidance_output.executive_summary ??
      "No Artist guidance has been generated yet.",
    authority: "ai-interpretation",
    sourceType: "artist_agent_guidance",
    sourceId: data.latestGuidance?.id,
    timestamp: data.latestGuidance?.created_at,
    detail: data.latestGuidance ? "Artist Agent guidance" : undefined,
    href: `/artist/tasks/${taskId}/current-version`,
  });

  const focus = data.item.current_focus;
  items.push({
    id: "next-action",
    label: "What to do next",
    value: focus.actionable
      ? focus.title
      : "No pending role action on this Task right now.",
    authority: focus.actionable ? "human-review-required" : "production-fact",
    sourceType: "current_focus",
    detail: focus.actionable ? "Derived current focus" : undefined,
    href: focus.actionable ? focus.target_route : undefined,
  });

  const openDependencies = data.dependencies.filter(
    (dependency) => dependency.status === "open",
  );
  items.push({
    id: "ask-cg",
    label: "When to ask CG for clarification",
    value:
      openDependencies.length === 0
        ? "No open dependency currently requires CG clarification."
        : openDependencies[0].description,
    authority: "production-fact",
    sourceType: "task_dependency",
    sourceId: openDependencies[0]?.id,
  });

  return { title: "Current Working Direction", items };
}

function joinOrFallback(values: string[], fallback: string): string {
  return values.length === 0 ? fallback : values.join("; ");
}
