import type {
  ArtistAgentGuidanceRead,
  ArtistInboxItemRead,
  CoreAnchorRevisionRead,
  ExecutionAnchorRevisionRead,
  ReviewNoteRead,
  TaskDependencyRead,
} from "@intent-core/contracts";
import { describe, expect, it } from "vitest";

import type { SelectCurrentWorkingDirectionInput } from "./selectCurrentWorkingDirection";
import { selectCurrentWorkingDirection } from "./selectCurrentWorkingDirection";

function item(
  overrides: Partial<ArtistInboxItemRead> = {},
): ArtistInboxItemRead {
  return {
    task_id: "t1",
    task_name: "Compositing Review",
    department: "compositing",
    task_source: "manual",
    shot_id: "s1",
    shot_name: "Shot 010",
    project_id: "p1",
    project_name: "D1 Demo Project",
    execution_anchor_state: "confirmed",
    active_execution_anchor_revision_id: "ea1",
    active_execution_anchor_summary: "Keep the silhouette readable.",
    latest_version_id: "v1",
    latest_version_name: "v004",
    latest_version_number: 4,
    guidance_state: "current",
    latest_guidance_id: "g1",
    open_review_note_count: 1,
    open_dependency_count: 0,
    current_focus: {
      focus_type: "none",
      title: "Nothing requires your attention",
      explanation: "",
      target_route: "/artist/tasks/t1",
      primary_action_label: null,
      actionable: false,
    },
    sort_rank: 0,
    ...overrides,
  };
}

function coreAnchorRevision(
  overrides: Partial<CoreAnchorRevisionRead> = {},
): CoreAnchorRevisionRead {
  return {
    id: "ca-rev1",
    core_anchor_id: "ca1",
    revision_number: 1,
    status: "confirmed",
    shot_objective: null,
    emotional_tone: null,
    visual_focus: null,
    rhythm_intensity: null,
    character_relationship: null,
    narrative_priority: null,
    core_summary: "A restrained dusk confrontation.",
    created_by_actor_kind: "human",
    created_by_actor_id: "vfx-1",
    created_by_human_role: "vfx_supervisor",
    created_by_agent_type: null,
    created_by_agent_run_id: null,
    context_snapshot_id: null,
    confirmed_by_human_role: "vfx_supervisor",
    confirmed_by_actor_id: "vfx-1",
    confirmed_at: "2026-08-01T00:00:00Z",
    supersedes_revision_id: null,
    source_intent_decomposition_id: null,
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    constraints: [],
    variation_zones: [],
    drift_risks: [],
    references: [],
    open_questions: [],
    ...overrides,
  };
}

function executionAnchorRevision(
  overrides: Partial<ExecutionAnchorRevisionRead> = {},
): ExecutionAnchorRevisionRead {
  return {
    id: "ea-rev1",
    execution_anchor_id: "ea1",
    core_anchor_revision_id: "ca-rev1",
    revision_number: 1,
    status: "confirmed",
    technical_boundaries: "Keep the silhouette readable.",
    parameter_ranges: null,
    delivery_conditions: null,
    production_ready_criteria: null,
    downstream_dependencies: null,
    publish_requirements: null,
    allowed_refinements: "Rim light color may shift within warm tones.",
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

function guidance(
  overrides: Partial<ArtistAgentGuidanceRead> = {},
): ArtistAgentGuidanceRead {
  return {
    id: "g1",
    project_id: "p1",
    shot_id: "s1",
    task_id: "t1",
    version_id: "v1",
    execution_anchor_revision_id: "ea-rev1",
    context_snapshot_id: "cs1",
    agent_run_id: "run1",
    guidance_output: {
      executive_summary: "Push the rim light slightly warmer.",
      creative_intent_read: {
        summary: "s",
        why_it_matters: "w",
        priority: "medium",
        evidence: [],
      },
      task_goal: {
        summary: "s",
        why_it_matters: "w",
        priority: "medium",
        evidence: [],
      },
      current_iteration_read: {
        summary: "s",
        why_it_matters: "w",
        priority: "medium",
        evidence: [],
      },
      non_negotiables: [],
      allowed_variations: [],
      feedback_translations: [],
      iteration_priorities: [],
      cross_department_dependencies: [],
      questions_for_human_supervisor: [],
      evidence_gaps: [],
    },
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
    created_by_actor_id: "cg-1",
    created_by_human_role: "cg_supervisor",
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
    description: "Waiting on CG to confirm the Execution Anchor update.",
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
  overrides: Partial<SelectCurrentWorkingDirectionInput> = {},
): SelectCurrentWorkingDirectionInput {
  return {
    item: item(),
    coreAnchorRevision: null,
    executionAnchorRevision: null,
    latestGuidance: null,
    dependencies: [],
    latestReviewNote: null,
    ...overrides,
  };
}

describe("selectCurrentWorkingDirection", () => {
  it("uses the confirmed Anchors, never a draft, for what to do / why it matters", () => {
    const section = selectCurrentWorkingDirection(
      baseData({
        coreAnchorRevision: coreAnchorRevision(),
        executionAnchorRevision: executionAnchorRevision(),
      }),
    );
    const whatToDo = section.items.find((i) => i.id === "what-to-do");
    const why = section.items.find((i) => i.id === "why-it-matters");
    expect(whatToDo?.value).toBe("Keep the silhouette readable.");
    expect(whatToDo?.authority).toBe("human-confirmed");
    expect(why?.value).toBe("A restrained dusk confrontation.");
    expect(why?.authority).toBe("human-confirmed");
  });

  it("produces an honest pending state when no Execution Anchor is confirmed yet (draft-only), never labelled human-confirmed", () => {
    const section = selectCurrentWorkingDirection(
      baseData({ executionAnchorRevision: null, coreAnchorRevision: null }),
    );
    const whatToDo = section.items.find((i) => i.id === "what-to-do");
    const why = section.items.find((i) => i.id === "why-it-matters");
    const unchanged = section.items.find(
      (i) => i.id === "must-remain-unchanged",
    );
    const mayExplore = section.items.find((i) => i.id === "may-explore");
    expect(whatToDo?.value).toBe("No confirmed Execution Anchor yet.");
    expect(whatToDo?.authority).toBeUndefined();
    expect(why?.authority).toBeUndefined();
    expect(unchanged?.authority).toBeUndefined();
    expect(mayExplore?.authority).toBeUndefined();
  });

  it("retains Human-confirmed authority and provenance for populated Constraints and allowed refinements", () => {
    const section = selectCurrentWorkingDirection(
      baseData({
        coreAnchorRevision: coreAnchorRevision({
          constraints: [
            {
              id: "c1",
              content: "Keep the silhouette readable.",
              order_index: 0,
              created_at: "2026-08-01T00:00:00Z",
            },
          ],
        }),
        executionAnchorRevision: executionAnchorRevision(),
      }),
    );
    const unchanged = section.items.find(
      (i) => i.id === "must-remain-unchanged",
    );
    const mayExplore = section.items.find((i) => i.id === "may-explore");
    expect(unchanged?.value).toBe("Keep the silhouette readable.");
    expect(unchanged?.authority).toBe("human-confirmed");
    expect(unchanged?.detail).toBe("Confirmed by VFX Supervisor");
    expect(mayExplore?.value).toBe(
      "Rim light color may shift within warm tones.",
    );
    expect(mayExplore?.authority).toBe("human-confirmed");
    expect(mayExplore?.detail).toBe("Confirmed by CG Supervisor");
  });

  it("distinguishes a missing confirmed Execution Anchor from a confirmed Anchor with empty allowed refinements, without inheriting the parent's authority or provenance", () => {
    const section = selectCurrentWorkingDirection(
      baseData({
        executionAnchorRevision: executionAnchorRevision({
          allowed_refinements: null,
        }),
      }),
    );
    const mayExplore = section.items.find((i) => i.id === "may-explore");
    expect(mayExplore?.value).toBe(
      "No allowed refinements have been recorded in the confirmed Execution Anchor.",
    );
    expect(mayExplore?.value).not.toBe("No confirmed Execution Anchor yet.");
    expect(mayExplore?.authority).toBeUndefined();
    expect(mayExplore?.detail).toBeUndefined();
    // The parent Execution Anchor is still confirmed elsewhere on the
    // same section (what-to-do), unaffected by this one empty field.
    const whatToDo = section.items.find((i) => i.id === "what-to-do");
    expect(whatToDo?.authority).toBe("human-confirmed");
  });

  it("distinguishes a missing confirmed Core Anchor from a confirmed Anchor with empty Constraints, without inheriting the parent's authority or provenance", () => {
    const section = selectCurrentWorkingDirection(
      baseData({ coreAnchorRevision: coreAnchorRevision({ constraints: [] }) }),
    );
    const unchanged = section.items.find(
      (i) => i.id === "must-remain-unchanged",
    );
    expect(unchanged?.value).toBe(
      "No Constraints recorded on the confirmed Core Anchor.",
    );
    expect(unchanged?.value).not.toBe("No confirmed Core Anchor yet.");
    expect(unchanged?.authority).toBeUndefined();
    expect(unchanged?.detail).toBeUndefined();
  });

  it("never treats a draft-only/missing Execution Anchor as confirmed for allowed refinements", () => {
    const section = selectCurrentWorkingDirection(
      baseData({ executionAnchorRevision: null }),
    );
    const mayExplore = section.items.find((i) => i.id === "may-explore");
    expect(mayExplore?.value).toBe("No confirmed Execution Anchor yet.");
    expect(mayExplore?.authority).toBeUndefined();
  });

  it("keeps Artist Agent guidance labelled as Agent interpretation, never Human Decision", () => {
    const section = selectCurrentWorkingDirection(
      baseData({ latestGuidance: guidance() }),
    );
    const guidanceItem = section.items.find((i) => i.id === "artist-guidance");
    expect(guidanceItem?.authority).toBe("ai-interpretation");
    expect(guidanceItem?.authority).not.toBe("human-confirmed");
    expect(guidanceItem?.value).toBe("Push the rim light slightly warmer.");
  });

  it("honestly states no guidance has been generated yet when latestGuidance is null, never labelled AI interpretation", () => {
    const section = selectCurrentWorkingDirection(baseData());
    const guidanceItem = section.items.find((i) => i.id === "artist-guidance");
    expect(guidanceItem?.value).toBe(
      "No Artist guidance has been generated yet.",
    );
    expect(guidanceItem?.authority).toBeUndefined();
  });

  it("categorises the latest Version/Review Note as production evidence", () => {
    const section = selectCurrentWorkingDirection(
      baseData({ latestReviewNote: note() }),
    );
    const feedback = section.items.find((i) => i.id === "latest-feedback");
    expect(feedback?.authority).toBe("production-fact");
    expect(feedback?.value).toBe("Contrast reads slightly hot.");
  });

  it("uses Task-scoped Version context, respecting the same task_id compatibility rule the loader already applies upstream", () => {
    // The selector trusts `item.latest_version_*`/`latestReviewNote`,
    // which the loader resolves via the existing Step 8C-6/8C-7
    // Task-scoped compatibility filter (real task_id match or null) --
    // this selector never re-derives or bypasses that filter itself.
    const section = selectCurrentWorkingDirection(
      baseData({
        item: item({ latest_version_name: "v004", latest_version_number: 4 }),
      }),
    );
    const currentVersion = section.items.find(
      (i) => i.id === "current-version",
    );
    expect(currentVersion?.value).toBe("v004 (v4)");
  });

  it("labels the next-action line as human-review-required only when current_focus is actionable", () => {
    const actionable = selectCurrentWorkingDirection(
      baseData({
        item: item({
          current_focus: {
            focus_type: "guidance_available",
            title: "New guidance is available",
            explanation: "",
            target_route: "/artist/tasks/t1",
            primary_action_label: "Review",
            actionable: true,
          },
        }),
      }),
    );
    const next = actionable.items.find((i) => i.id === "next-action");
    expect(next?.authority).toBe("human-review-required");

    const none = selectCurrentWorkingDirection(baseData());
    const nextNone = none.items.find((i) => i.id === "next-action");
    expect(nextNone?.authority).toBe("production-fact");
  });

  it("uses real, existing role-appropriate navigation destinations only", () => {
    const section = selectCurrentWorkingDirection(
      baseData({ latestGuidance: guidance() }),
    );
    for (const item of section.items) {
      if (item.href) {
        expect(item.href.startsWith("/artist/tasks/t1")).toBe(true);
      }
    }
  });

  it("never renders a raw id in any visible summary value", () => {
    const section = selectCurrentWorkingDirection(
      baseData({
        coreAnchorRevision: coreAnchorRevision({ id: "8b4f11eb-uuid" }),
        executionAnchorRevision: executionAnchorRevision({
          id: "8b4f11eb-uuid-2",
        }),
        latestGuidance: guidance({ id: "8b4f11eb-uuid-3" }),
        latestReviewNote: note({ id: "8b4f11eb-uuid-4" }),
        dependencies: [dependency({ id: "8b4f11eb-uuid-5" })],
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
    const section = selectCurrentWorkingDirection(
      baseData({ latestReviewNote: note({ content: longContent }) }),
    );
    const feedback = section.items.find((i) => i.id === "latest-feedback");
    expect(feedback?.value.length).toBeLessThan(longContent.length);
    expect(feedback?.value.endsWith("…")).toBe(true);
    expect(longContent.startsWith(feedback!.value.slice(0, -1))).toBe(true);
    expect(feedback?.href).toBe("/artist/tasks/t1/feedback-history");
  });

  it("shows the ask-CG line only from a real open Dependency, and never exposes a create-escalation control (data only)", () => {
    const section = selectCurrentWorkingDirection(baseData());
    const ask = section.items.find((i) => i.id === "ask-cg");
    expect(ask?.value).toBe(
      "No open dependency currently requires CG clarification.",
    );

    const withDependency = selectCurrentWorkingDirection(
      baseData({ dependencies: [dependency()] }),
    );
    const ask2 = withDependency.items.find((i) => i.id === "ask-cg");
    expect(ask2?.value).toBe(
      "Waiting on CG to confirm the Execution Anchor update.",
    );
    expect(ask2?.authority).toBe("production-fact");
  });
});
