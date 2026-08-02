import type {
  CoreAnchorRevisionRead,
  ReviewNoteRead,
  VersionRead,
  VfxInboxItemRead,
} from "@intent-core/contracts";
import { describe, expect, it } from "vitest";

import type { ShotOverviewData } from "./data";
import { selectCurrentCreativeDirection } from "./selectCurrentCreativeDirection";

function item(overrides: Partial<VfxInboxItemRead> = {}): VfxInboxItemRead {
  return {
    project_id: "p1",
    project_name: "D1 Demo Project",
    shot_id: "s1",
    shot_name: "Shot 010",
    shot_source: "manual",
    core_anchor_state: "confirmed",
    active_core_anchor_revision_id: "r1",
    active_core_anchor_summary: "A restrained dusk confrontation.",
    pending_human_gate_id: null,
    relevant_task_id: "t1",
    relevant_task_name: "Compositing Review",
    relevant_version_id: "v1",
    relevant_version_name: "v001",
    relevant_version_number: 1,
    pairing_established: true,
    latest_assessment_id: null,
    latest_assessment_created_at: null,
    latest_signal_id: null,
    latest_signal_attention_level: null,
    latest_signal_summary: null,
    re_anchor_proposal_present: false,
    current_focus: {
      focus_type: "none",
      title: "Nothing requires your attention",
      explanation: "",
      target_route: "/vfx/shots/s1",
      primary_action_label: null,
      actionable: false,
    },
    next_candidates: [],
    sort_rank: 0,
    ...overrides,
  };
}

function revision(
  overrides: Partial<CoreAnchorRevisionRead> = {},
): CoreAnchorRevisionRead {
  return {
    id: "rev-confirmed",
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

function version(overrides: Partial<VersionRead> = {}): VersionRead {
  return {
    id: "v1",
    shot_id: "s1",
    name: "v001",
    version_number: 1,
    description: "",
    source: "manual",
    created_by_actor_kind: "human",
    created_by_actor_id: "vfx-1",
    created_by_human_role: "vfx_supervisor",
    created_at: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

function note(overrides: Partial<ReviewNoteRead> = {}): ReviewNoteRead {
  return {
    id: "n1",
    version_id: "v1",
    content: "Tighten the timing.",
    source: "manual",
    created_by_actor_kind: "human",
    created_by_actor_id: "vfx-1",
    created_by_human_role: "vfx_supervisor",
    created_at: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

function baseData(overrides: Partial<ShotOverviewData> = {}): ShotOverviewData {
  return {
    item: item(),
    confirmedCoreAnchorRevision: null,
    confirmedDecisionRationale: null,
    latestVersion: null,
    latestReviewNote: null,
    currentAssessment: null,
    departmentExecutionOverview: null,
    ...overrides,
  };
}

describe("selectCurrentCreativeDirection", () => {
  it("uses the confirmed Core Anchor revision, never a draft, for the creative objective", () => {
    const section = selectCurrentCreativeDirection(
      baseData({ confirmedCoreAnchorRevision: revision() }),
    );
    const objective = section.items.find((i) => i.id === "creative-objective");
    expect(objective?.value).toBe("A restrained dusk confrontation.");
    expect(objective?.authority).toBe("human-confirmed");
  });

  it("produces an honest pending state when no Core Anchor is confirmed (draft-only Shot), never labelled human-confirmed", () => {
    const section = selectCurrentCreativeDirection(
      baseData({ confirmedCoreAnchorRevision: null }),
    );
    const objective = section.items.find((i) => i.id === "creative-objective");
    const unchanged = section.items.find(
      (i) => i.id === "must-remain-unchanged",
    );
    const mayVary = section.items.find((i) => i.id === "may-vary");
    expect(objective?.value).toBe("No confirmed Core Anchor yet.");
    expect(objective?.authority).toBeUndefined();
    expect(unchanged?.authority).toBeUndefined();
    expect(mayVary?.authority).toBeUndefined();
  });

  it("excerpts a long Intent Signal summary rather than showing it in full", () => {
    const longSummary =
      "Multiple cross-role tensions have accumulated between the confirmed Core Anchor and the latest Production Version, including a mismatch in the emotional tone of the confrontation beat and an unresolved question about the rim light colour temperature raised by CG.";
    const section = selectCurrentCreativeDirection(
      baseData({
        item: item({
          latest_signal_id: "sig1",
          latest_signal_attention_level: "high",
          latest_signal_summary: longSummary,
        }),
      }),
    );
    const risk = section.items.find((i) => i.id === "current-risk");
    expect(risk?.value.length).toBeLessThan(longSummary.length);
    expect(risk?.value).toContain("…");
  });

  it("never labels a missing Intent Signal as Agent interpretation", () => {
    const section = selectCurrentCreativeDirection(baseData());
    const risk = section.items.find((i) => i.id === "current-risk");
    expect(risk?.authority).toBeUndefined();
  });

  it("never labels Agent interpretation (the Intent Signal) as Human Decision", () => {
    const section = selectCurrentCreativeDirection(
      baseData({
        item: item({
          latest_signal_id: "sig1",
          latest_signal_attention_level: "high",
          latest_signal_summary: "Cross-role tension detected.",
        }),
      }),
    );
    const risk = section.items.find((i) => i.id === "current-risk");
    expect(risk?.authority).toBe("ai-interpretation");
    expect(risk?.authority).not.toBe("human-confirmed");
  });

  it("categorises the latest Version/Review Note as production evidence", () => {
    const section = selectCurrentCreativeDirection(
      baseData({
        latestVersion: version(),
        latestReviewNote: note(),
      }),
    );
    const feedback = section.items.find((i) => i.id === "latest-feedback");
    expect(feedback?.authority).toBe("production-fact");
    expect(feedback?.value).toBe("Tighten the timing.");
  });

  it("uses Shot-wide latest Version context (no Task filter applied by this selector)", () => {
    // The selector itself has no task_id concept at all -- VFX stays
    // Shot-wide by construction, matching the locked Step 8 behaviour;
    // this test proves the selector never filters `latestVersion` by
    // any Task id.
    const shotWideVersion = version({ id: "v-other-task" });
    const section = selectCurrentCreativeDirection(
      baseData({ latestVersion: shotWideVersion, latestReviewNote: note() }),
    );
    const feedback = section.items.find((i) => i.id === "latest-feedback");
    expect(feedback?.detail).toContain("v001");
  });

  it("labels the pending-action line as human-review-required only when current_focus is actionable", () => {
    const actionable = selectCurrentCreativeDirection(
      baseData({
        item: item({
          current_focus: {
            focus_type: "core_anchor_gate_pending",
            title: "Confirm the pending draft",
            explanation: "",
            target_route: "/vfx/shots/s1/intent",
            primary_action_label: "Review",
            actionable: true,
          },
        }),
      }),
    );
    const nextActionable = actionable.items.find((i) => i.id === "next-action");
    expect(nextActionable?.authority).toBe("human-review-required");
    expect(nextActionable?.href).toBe("/vfx/shots/s1/intent");

    const none = selectCurrentCreativeDirection(baseData());
    const nextNone = none.items.find((i) => i.id === "next-action");
    expect(nextNone?.authority).toBe("production-fact");
    expect(nextNone?.value).toContain("Nothing requires your attention");
  });

  it("uses real, existing role-appropriate navigation destinations only", () => {
    const section = selectCurrentCreativeDirection(
      baseData({ confirmedCoreAnchorRevision: revision() }),
    );
    for (const item of section.items) {
      if (item.href) {
        expect(item.href.startsWith("/vfx/shots/s1")).toBe(true);
      }
    }
  });

  it("honestly falls back when Constraints/Variation Zones are absent, even on a confirmed revision, without inheriting the parent's authority or provenance", () => {
    const section = selectCurrentCreativeDirection(
      baseData({ confirmedCoreAnchorRevision: revision() }),
    );
    const unchanged = section.items.find(
      (i) => i.id === "must-remain-unchanged",
    );
    const mayVary = section.items.find((i) => i.id === "may-vary");
    expect(unchanged?.value).toBe(
      "No Constraints recorded on the confirmed Core Anchor.",
    );
    expect(mayVary?.value).toBe(
      "No Variation Zones recorded on the confirmed Core Anchor.",
    );
    // Confirmed parent Core Anchor, but these two optional child fields
    // are empty -- must not inherit Human-confirmed authority or
    // confirmation provenance from the confirmed parent.
    expect(unchanged?.authority).toBeUndefined();
    expect(unchanged?.detail).toBeUndefined();
    expect(mayVary?.authority).toBeUndefined();
    expect(mayVary?.detail).toBeUndefined();
    // The parent Core Anchor is still confirmed elsewhere on the same
    // section (creative-objective), unaffected by these empty fields.
    const objective = section.items.find((i) => i.id === "creative-objective");
    expect(objective?.authority).toBe("human-confirmed");
  });

  it("retains Human-confirmed authority and provenance for populated Constraints/Variation Zones", () => {
    const section = selectCurrentCreativeDirection(
      baseData({
        confirmedCoreAnchorRevision: revision({
          constraints: [
            {
              id: "c1",
              content: "Keep the silhouette readable.",
              order_index: 0,
              created_at: "2026-08-01T00:00:00Z",
            },
          ],
          variation_zones: [
            {
              id: "v1",
              content: "Rim light colour may shift.",
              order_index: 0,
              created_at: "2026-08-01T00:00:00Z",
            },
          ],
        }),
      }),
    );
    const unchanged = section.items.find(
      (i) => i.id === "must-remain-unchanged",
    );
    const mayVary = section.items.find((i) => i.id === "may-vary");
    expect(unchanged?.value).toBe("Keep the silhouette readable.");
    expect(unchanged?.authority).toBe("human-confirmed");
    expect(unchanged?.detail).toBe("Confirmed by VFX Supervisor");
    expect(mayVary?.value).toBe("Rim light colour may shift.");
    expect(mayVary?.authority).toBe("human-confirmed");
    expect(mayVary?.detail).toBe("Confirmed by VFX Supervisor");
  });

  it("never renders a raw id in any visible summary value", () => {
    const section = selectCurrentCreativeDirection(
      baseData({
        confirmedCoreAnchorRevision: revision({ id: "8b4f11eb-uuid-shaped" }),
        latestVersion: version({ id: "8b4f11eb-uuid-shaped-2" }),
        latestReviewNote: note({ id: "8b4f11eb-uuid-shaped-3" }),
      }),
    );
    for (const item of section.items) {
      expect(item.value).not.toContain("8b4f11eb");
      expect(item.detail ?? "").not.toContain("8b4f11eb");
    }
  });

  it("excerpts long Review Note content rather than showing it in full, while preserving the source link", () => {
    const longContent =
      "Tighten the timing across the whole sequence and reconsider the pacing of the confrontation beat, especially in the final third where the cut feels rushed relative to the emotional build established earlier in the shot.";
    const section = selectCurrentCreativeDirection(
      baseData({ latestReviewNote: note({ content: longContent }) }),
    );
    const feedback = section.items.find((i) => i.id === "latest-feedback");
    expect(feedback?.value.length).toBeLessThan(longContent.length);
    expect(feedback?.value.endsWith("…")).toBe(true);
    expect(longContent.startsWith(feedback!.value.slice(0, -1))).toBe(true);
    expect(feedback?.href).toBe("/vfx/shots/s1/versions");
  });

  it("shows the escalation line as an honest production fact, not Agent interpretation", () => {
    const section = selectCurrentCreativeDirection(
      baseData({
        item: item({
          open_cg_escalation_task_id: "t2",
          open_cg_escalation_task_name: "Rotoscoping",
          open_cg_escalation_summary: "Awaiting VFX input on contrast drift.",
        }),
      }),
    );
    const escalation = section.items.find(
      (i) => i.id === "cg-artist-escalation",
    );
    expect(escalation?.authority).toBe("production-fact");
    expect(escalation?.value).toBe("Awaiting VFX input on contrast drift.");
  });
});
