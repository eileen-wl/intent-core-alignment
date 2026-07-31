import type { CoreAnchorRevisionRead } from "@intent-core/contracts";
import { describe, expect, it } from "vitest";

import { computeChangeSummary, summarizeEstablishedContent } from "./changeSummary";

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

  it("does not falsely report a change when a scalar field is null on the confirmed side and normalized to an empty string on the draft side", () => {
    // `CoreAnchorRevisionEditor` passes `computeChangeSummary` a merged
    // draft object built from live form state, whose scalars are always
    // strings (`toFormState` normalizes `null` to `""`). A field that is
    // genuinely empty on both sides must not read as changed just
    // because one side is `null` and the other is `""`.
    const confirmed = revision({ emotional_tone: null });
    const draftWithNormalizedEmptyString = { ...revision({ id: "r2", status: "draft" }), emotional_tone: "" };
    expect(computeChangeSummary(confirmed, draftWithNormalizedEmptyString)).toEqual([]);
  });
});

describe("summarizeEstablishedContent", () => {
  it("reports real populated content as established, never fabricated categories", () => {
    const revisionData = revision({
      core_summary: "A restrained dusk confrontation.",
      constraints: [
        { id: "c1", order_index: 0, content: "No character dialogue", created_at: "2026-01-01T00:00:00Z" },
      ],
      variation_zones: [
        { id: "z1", order_index: 0, content: "Camera angle", created_at: "2026-01-01T00:00:00Z" },
        { id: "z2", order_index: 1, content: "Negative space", created_at: "2026-01-01T00:00:00Z" },
      ],
      open_questions: [],
    });
    const summary = summarizeEstablishedContent(revisionData);
    expect(summary).toContain("Shared creative direction established");
    expect(summary).toContain("1 confirmed constraint");
    expect(summary).toContain("2 confirmed variation boundaries");
    // No open questions in this fixture -- honestly absent, not a "0
    // recorded open questions" fabricated line.
    expect(summary.some((item) => item.includes("open question"))).toBe(false);
  });

  it("reports nothing for a revision with no populated content, never a fabricated placeholder", () => {
    const revisionData = revision({
      core_summary: null,
      shot_objective: null,
      constraints: [],
      variation_zones: [],
      open_questions: [],
    });
    expect(summarizeEstablishedContent(revisionData)).toEqual([]);
  });
});
