import type {
  CgInboxItemRead,
  DecisionRead,
  ExecutionAnchorRevisionRead,
  ReviewNoteRead,
  TaskDependencyRead,
} from "@intent-core/contracts";
import { describe, expect, it } from "vitest";

import type { SelectCurrentExecutionDirectionInput } from "./selectCurrentExecutionDirection";
import { selectCurrentExecutionDirection } from "./selectCurrentExecutionDirection";

function item(overrides: Partial<CgInboxItemRead> = {}): CgInboxItemRead {
  return {
    task_id: "t1",
    task_name: "Lighting Pass",
    department: "lighting",
    task_source: "manual",
    shot_id: "s1",
    shot_name: "Shot 010",
    project_id: "p1",
    project_name: "D1 Demo Project",
    execution_anchor_state: "confirmed",
    active_execution_anchor_revision_id: "ea1",
    active_execution_anchor_summary: "24fps, no motion blur.",
    pending_human_gate_id: null,
    latest_version_id: "v1",
    latest_version_name: "v004",
    latest_version_number: 4,
    open_dependency_count: 0,
    current_focus: {
      focus_type: "none",
      title: "Nothing requires your attention",
      explanation: "",
      target_route: "/cg/tasks/t1",
      primary_action_label: null,
      actionable: false,
    },
    sort_rank: 0,
    ...overrides,
  };
}

function revision(
  overrides: Partial<ExecutionAnchorRevisionRead> = {},
): ExecutionAnchorRevisionRead {
  return {
    id: "ea-rev1",
    execution_anchor_id: "ea1",
    core_anchor_revision_id: "ca1",
    revision_number: 1,
    status: "confirmed",
    technical_boundaries: "24fps, no motion blur.",
    parameter_ranges: null,
    delivery_conditions: null,
    production_ready_criteria: "Final render, no watermark.",
    downstream_dependencies: null,
    publish_requirements: null,
    allowed_refinements: null,
    escalation_conditions: null,
    created_by_actor_kind: "human",
    created_by_actor_id: "cg-1",
    created_by_human_role: "cg_supervisor",
    created_by_agent_type: null,
    created_by_agent_run_id: null,
    confirmed_by_human_role: "cg_supervisor",
    confirmed_by_actor_id: "cg-1",
    confirmed_at: "2026-08-01T00:00:00Z",
    supersedes_revision_id: null,
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

function decision(overrides: Partial<DecisionRead> = {}): DecisionRead {
  return {
    id: "d1",
    decision_type: "confirm_execution_anchor",
    owning_human_role: "cg_supervisor",
    actor_kind: "human",
    actor_id: "cg-1",
    actor_human_role: "cg_supervisor",
    rationale: "Matches the confirmed Core Anchor exactly.",
    entity_type: "execution_anchor_revision",
    entity_id: "ea-rev1",
    write_back_requested: false,
    supersedes_decision_id: null,
    created_at: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

function note(overrides: Partial<ReviewNoteRead> = {}): ReviewNoteRead {
  return {
    id: "n1",
    version_id: "v1",
    content: "Contrast reads slightly hot.",
    source: "manual",
    created_by_actor_kind: "human",
    created_by_actor_id: "vfx-1",
    created_by_human_role: "vfx_supervisor",
    created_at: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

function dependency(
  overrides: Partial<TaskDependencyRead> = {},
): TaskDependencyRead {
  return {
    id: "dep1",
    project_id: "p1",
    shot_id: "s1",
    task_id: "t1",
    related_version_id: null,
    kind: "dependency",
    status: "open",
    description: "Waiting on Layout to lock camera.",
    severity: "medium",
    escalated_to_role: null,
    created_by_actor_kind: "human",
    created_by_actor_id: "cg-1",
    created_by_human_role: "cg_supervisor",
    created_at: "2026-08-01T00:00:00Z",
    resolved_by_actor_id: null,
    resolved_by_human_role: null,
    resolved_at: null,
    related_cross_role_assessment_id: null,
    ...overrides,
  };
}

function baseData(
  overrides: Partial<SelectCurrentExecutionDirectionInput> = {},
): SelectCurrentExecutionDirectionInput {
  return {
    item: item(),
    coreAnchorSummary: null,
    confirmedExecutionAnchorRevision: null,
    executionAnchorDecisions: [],
    dependencies: [],
    latestReviewNote: null,
    ...overrides,
  };
}

describe("selectCurrentExecutionDirection", () => {
  it("uses the confirmed Execution Anchor revision, never a draft, for the Task goal", () => {
    const section = selectCurrentExecutionDirection(
      baseData({ confirmedExecutionAnchorRevision: revision() }),
    );
    const goal = section.items.find((i) => i.id === "task-goal");
    expect(goal?.value).toBe("24fps, no motion blur.");
    expect(goal?.authority).toBe("human-confirmed");
  });

  it("produces an honest pending state when no Execution Anchor is confirmed (draft-only Task), never labelled human-confirmed", () => {
    const section = selectCurrentExecutionDirection(
      baseData({ confirmedExecutionAnchorRevision: null }),
    );
    const goal = section.items.find((i) => i.id === "task-goal");
    const criteria = section.items.find(
      (i) => i.id === "production-ready-criteria",
    );
    expect(goal?.value).toBe("No confirmed Execution Anchor yet.");
    expect(goal?.authority).toBeUndefined();
    expect(criteria?.authority).toBeUndefined();
  });

  it("never labels a missing confirmed Core Anchor context as human-confirmed", () => {
    const section = selectCurrentExecutionDirection(
      baseData({ coreAnchorSummary: null }),
    );
    const context = section.items.find((i) => i.id === "core-anchor-context");
    expect(context?.value).toBe("No confirmed Core Anchor yet.");
    expect(context?.authority).toBeUndefined();

    const withSummary = selectCurrentExecutionDirection(
      baseData({ coreAnchorSummary: "A restrained dusk confrontation." }),
    );
    const contextWithSummary = withSummary.items.find(
      (i) => i.id === "core-anchor-context",
    );
    expect(contextWithSummary?.authority).toBe("human-confirmed");
  });

  it("retains Human-confirmed authority and provenance for populated production-ready criteria on a confirmed revision", () => {
    const section = selectCurrentExecutionDirection(
      baseData({ confirmedExecutionAnchorRevision: revision() }),
    );
    const criteria = section.items.find(
      (i) => i.id === "production-ready-criteria",
    );
    expect(criteria?.value).toBe("Final render, no watermark.");
    expect(criteria?.authority).toBe("human-confirmed");
    expect(criteria?.detail).toBe("Confirmed by CG Supervisor");
  });

  it("distinguishes a missing confirmed Execution Anchor from a confirmed Anchor with an empty optional field", () => {
    // Confirmed parent, but production_ready_criteria itself was never
    // recorded -- must not read as "no confirmed Execution Anchor" and
    // must not inherit the parent's Human-confirmed authority or
    // confirmation provenance.
    const section = selectCurrentExecutionDirection(
      baseData({
        confirmedExecutionAnchorRevision: revision({
          production_ready_criteria: null,
        }),
      }),
    );
    const criteria = section.items.find(
      (i) => i.id === "production-ready-criteria",
    );
    expect(criteria?.value).toBe(
      "No production-ready criteria have been recorded in the confirmed Execution Anchor.",
    );
    expect(criteria?.value).not.toBe("No confirmed Execution Anchor yet.");
    expect(criteria?.authority).toBeUndefined();
    expect(criteria?.detail).toBeUndefined();
    // The parent Execution Anchor is still confirmed elsewhere on the
    // same section (task-goal), unaffected by this one empty field.
    const goal = section.items.find((i) => i.id === "task-goal");
    expect(goal?.authority).toBe("human-confirmed");
  });

  it("never treats a draft-only Execution Anchor as confirmed for production-ready criteria", () => {
    const section = selectCurrentExecutionDirection(
      baseData({ confirmedExecutionAnchorRevision: null }),
    );
    const criteria = section.items.find(
      (i) => i.id === "production-ready-criteria",
    );
    expect(criteria?.value).toBe("No confirmed Execution Anchor yet.");
    expect(criteria?.authority).toBeUndefined();
  });

  it("shows an honest provenance limitation when no confirmation Decision/rationale exists", () => {
    const section = selectCurrentExecutionDirection(
      baseData({
        confirmedExecutionAnchorRevision: revision(),
        executionAnchorDecisions: [],
      }),
    );
    const goal = section.items.find((i) => i.id === "task-goal");
    expect(goal?.detail).toBe("Confirmed by CG Supervisor");
  });

  it("includes the confirm Decision's real rationale when available, never a fabricated one", () => {
    const section = selectCurrentExecutionDirection(
      baseData({
        confirmedExecutionAnchorRevision: revision(),
        executionAnchorDecisions: [decision()],
      }),
    );
    const goal = section.items.find((i) => i.id === "task-goal");
    expect(goal?.detail).toContain(
      "Matches the confirmed Core Anchor exactly.",
    );
  });

  it("categorises dependencies as production fact, never Agent interpretation", () => {
    const section = selectCurrentExecutionDirection(
      baseData({ dependencies: [dependency()] }),
    );
    const deps = section.items.find((i) => i.id === "current-dependencies");
    expect(deps?.authority).toBe("production-fact");
    expect(deps?.value).toContain("1 open");
  });

  it("categorises the latest Version/Review Note as production evidence", () => {
    const section = selectCurrentExecutionDirection(
      baseData({ latestReviewNote: note() }),
    );
    const feedback = section.items.find(
      (i) => i.id === "latest-version-feedback",
    );
    expect(feedback?.authority).toBe("production-fact");
    expect(feedback?.value).toBe("Contrast reads slightly hot.");
  });

  it("uses Task-scoped latest Version context (item.latest_version_* is already Task-scoped upstream)", () => {
    const section = selectCurrentExecutionDirection(
      baseData({
        item: item({ latest_version_name: "v004", latest_version_number: 4 }),
        latestReviewNote: note(),
      }),
    );
    const feedback = section.items.find(
      (i) => i.id === "latest-version-feedback",
    );
    expect(feedback?.detail).toBe("From v004 (v4)");
  });

  it("labels the pending-action line as human-review-required only when current_focus is actionable", () => {
    const actionable = selectCurrentExecutionDirection(
      baseData({
        item: item({
          current_focus: {
            focus_type: "execution_anchor_gate_pending",
            title: "Confirm the pending draft",
            explanation: "",
            target_route: "/cg/tasks/t1/execution",
            primary_action_label: "Review",
            actionable: true,
          },
        }),
      }),
    );
    const next = actionable.items.find((i) => i.id === "next-action");
    expect(next?.authority).toBe("human-review-required");

    const none = selectCurrentExecutionDirection(baseData());
    const nextNone = none.items.find((i) => i.id === "next-action");
    expect(nextNone?.authority).toBe("production-fact");
  });

  it("uses real, existing role-appropriate navigation destinations only", () => {
    const section = selectCurrentExecutionDirection(
      baseData({ confirmedExecutionAnchorRevision: revision() }),
    );
    for (const item of section.items) {
      if (item.href) {
        expect(item.href.startsWith("/cg/tasks/t1")).toBe(true);
      }
    }
  });

  it("never renders a raw id in any visible summary value", () => {
    const section = selectCurrentExecutionDirection(
      baseData({
        confirmedExecutionAnchorRevision: revision({ id: "8b4f11eb-uuid" }),
        latestReviewNote: note({ id: "8b4f11eb-uuid-2" }),
        dependencies: [dependency({ id: "8b4f11eb-uuid-3" })],
      }),
    );
    for (const item of section.items) {
      expect(item.value).not.toContain("8b4f11eb");
      expect(item.detail ?? "").not.toContain("8b4f11eb");
    }
  });

  it("excerpts long Review Note content rather than showing it in full, while preserving the source link", () => {
    const longContent =
      "Contrast reads slightly hot across the whole sequence, particularly in the highlight rolloff around the practical lights in the background plate -- please pull it back half a stop before the next pass.";
    const section = selectCurrentExecutionDirection(
      baseData({ latestReviewNote: note({ content: longContent }) }),
    );
    const feedback = section.items.find(
      (i) => i.id === "latest-version-feedback",
    );
    expect(feedback?.value.length).toBeLessThan(longContent.length);
    expect(feedback?.value.endsWith("…")).toBe(true);
    expect(longContent.startsWith(feedback!.value.slice(0, -1))).toBe(true);
    expect(feedback?.href).toBe("/cg/tasks/t1/version-review");
  });

  it("shows the escalate-to-VFX line only from a real open escalation Dependency", () => {
    const section = selectCurrentExecutionDirection(baseData());
    const escalate = section.items.find((i) => i.id === "escalate-to-vfx");
    expect(escalate?.value).toBe("No open escalation to VFX for this Task.");

    const withEscalation = selectCurrentExecutionDirection(
      baseData({
        dependencies: [
          dependency({
            kind: "escalation",
            status: "open",
            description: "Needs VFX input on contrast drift.",
          }),
        ],
      }),
    );
    const escalate2 = withEscalation.items.find(
      (i) => i.id === "escalate-to-vfx",
    );
    expect(escalate2?.value).toBe("Needs VFX input on contrast drift.");
  });
});
