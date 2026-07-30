import type { CoreAnchorRevisionRead } from "@intent-core/contracts";
import { describe, expect, it } from "vitest";

import { computeChangeSummary } from "./changeSummary";

function revision(overrides: Partial<CoreAnchorRevisionRead> = {}): CoreAnchorRevisionRead {
  return {
    id: "r1",
    core_anchor_id: "a1",
    revision_number: 1,
    status: "confirmed",
    shot_objective: "Keep it restrained",
    emotional_tone: null,
    visual_focus: null,
    rhythm_intensity: null,
    character_relationship: null,
    narrative_priority: null,
    core_summary: "Quiet dread",
    created_by_actor_kind: "human",
    created_by_actor_id: "vfx-1",
    created_by_human_role: "vfx_supervisor",
    created_by_agent_type: null,
    created_by_agent_run_id: null,
    context_snapshot_id: null,
    confirmed_by_human_role: "vfx_supervisor",
    confirmed_by_actor_id: "vfx-1",
    confirmed_at: "2026-01-01T00:00:00Z",
    supersedes_revision_id: null,
    source_intent_decomposition_id: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    constraints: [],
    variation_zones: [],
    drift_risks: [],
    references: [],
    open_questions: [],
    ...overrides,
  };
}

describe("computeChangeSummary", () => {
  it("reports no changes when the draft is identical to the confirmed revision", () => {
    const confirmed = revision();
    const draft = revision({ id: "r2", status: "draft" });
    expect(computeChangeSummary(confirmed, draft)).toEqual([]);
  });

  it("reports a scalar field change", () => {
    const confirmed = revision();
    const draft = revision({ id: "r2", status: "draft", core_summary: "A colder read" });
    expect(computeChangeSummary(confirmed, draft)).toEqual(["Core summary changed"]);
  });

  it("reports added collection items", () => {
    const confirmed = revision();
    const draft = revision({
      id: "r2",
      status: "draft",
      constraints: [
        { id: "c1", order_index: 0, content: "No jump cuts", created_at: "2026-01-01T00:00:00Z" },
      ],
    });
    expect(computeChangeSummary(confirmed, draft)).toEqual(["1 constraint added"]);
  });

  it("reports removed collection items", () => {
    const confirmed = revision({
      constraints: [
        { id: "c1", order_index: 0, content: "No jump cuts", created_at: "2026-01-01T00:00:00Z" },
      ],
    });
    const draft = revision({ id: "r2", status: "draft", constraints: [] });
    expect(computeChangeSummary(confirmed, draft)).toEqual(["1 constraint removed"]);
  });

  it("reports edited collection content at the same count", () => {
    const confirmed = revision({
      open_questions: [
        { id: "q1", order_index: 0, question: "Long take or cut?", created_at: "2026-01-01T00:00:00Z" },
      ],
    });
    const draft = revision({
      id: "r2",
      status: "draft",
      open_questions: [
        {
          id: "q1",
          order_index: 0,
          question: "Long take, or is a cut acceptable?",
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
    });
    expect(computeChangeSummary(confirmed, draft)).toEqual(["open questions edited"]);
  });

  it("treats every populated draft field as new content when nothing was ever confirmed", () => {
    const draft = revision({
      id: "r2",
      status: "draft",
      core_summary: "Quiet dread",
      constraints: [
        { id: "c1", order_index: 0, content: "No jump cuts", created_at: "2026-01-01T00:00:00Z" },
      ],
    });
    const summary = computeChangeSummary(null, draft);
    expect(summary).toContain("Core summary changed");
    expect(summary).toContain("1 constraint added");
  });
});
