import type {
  VfxCurrentFocusType,
  VfxInboxCurrentFocusRead,
  VfxInboxItemRead,
} from "@intent-core/contracts";
import { describe, expect, it } from "vitest";

import {
  adaptCurrentFocusToWorkItems,
  adaptEscalationWorkItems,
  adaptVersionReviewWorkItems,
} from "./workItem";

function focus(
  focusType: VfxCurrentFocusType,
  overrides: Partial<VfxInboxCurrentFocusRead> = {},
): VfxInboxCurrentFocusRead {
  return {
    focus_type: focusType,
    title: `Title for ${focusType}`,
    explanation: `Explanation for ${focusType}`,
    target_route: "/vfx/shots/s1/alignment",
    primary_action_label: "Act now",
    actionable: focusType !== "none",
    ...overrides,
  };
}

function item(overrides: Partial<VfxInboxItemRead> = {}): VfxInboxItemRead {
  return {
    project_id: "p1",
    project_name: "D1 Demo Project",
    shot_id: "s1",
    shot_name: "Shot 010 — Final confrontation",
    shot_source: "manual",
    core_anchor_state: "confirmed",
    active_core_anchor_revision_id: "r1",
    active_core_anchor_summary: "A restrained dusk confrontation.",
    pending_human_gate_id: null,
    relevant_task_id: "t1",
    relevant_task_name: "Compositing Review",
    relevant_version_id: "v1",
    relevant_version_name: "D1_STEP3_VFX_REVIEW_001",
    relevant_version_number: 1,
    pairing_established: true,
    latest_assessment_id: null,
    latest_assessment_created_at: null,
    latest_signal_id: null,
    latest_signal_attention_level: null,
    latest_signal_summary: null,
    re_anchor_proposal_present: false,
    current_focus: focus("core_anchor_gate_pending"),
    next_candidates: [],
    sort_rank: 0,
    ...overrides,
  };
}

describe("adaptCurrentFocusToWorkItems", () => {
  it("creates a work item only for actionable focus records", () => {
    const items = [
      item({ shot_id: "s1", current_focus: focus("core_anchor_gate_pending") }),
      item({
        shot_id: "s2",
        current_focus: focus("none", {
          title: "Nothing requires your attention on this Shot right now",
          explanation: "",
          primary_action_label: null,
        }),
      }),
    ];
    const workItems = adaptCurrentFocusToWorkItems(items);
    expect(workItems).toHaveLength(1);
    expect(workItems[0].shot?.id).toBe("s1");
  });

  it("returns an honest empty collection when nothing is actionable", () => {
    const items = [
      item({ current_focus: focus("none", { primary_action_label: null }) }),
    ];
    expect(adaptCurrentFocusToWorkItems(items)).toEqual([]);
  });

  const actionableTypes: {
    focusType: VfxCurrentFocusType;
    category: string;
    route: string;
  }[] = [
    {
      focusType: "core_anchor_gate_pending",
      category: "Core Anchor confirmation",
      route: "/vfx/shots/s1/intent",
    },
    {
      focusType: "core_anchor_draft_needs_review",
      category: "Draft review",
      route: "/vfx/shots/s1/intent",
    },
    {
      focusType: "alignment_not_followed_by_anchor_action",
      category: "Alignment interpretation",
      route: "/vfx/shots/s1/alignment",
    },
    {
      focusType: "re_anchor_proposal_present",
      category: "Alignment interpretation",
      route: "/vfx/shots/s1/alignment",
    },
    {
      focusType: "assessment_generation_available",
      category: "Attention required",
      route: "/vfx/shots/s1/alignment",
    },
  ];

  it.each(actionableTypes)(
    "maps $focusType to an honest category and the locked route target",
    ({ focusType, category, route }) => {
      const workItems = adaptCurrentFocusToWorkItems([
        item({ shot_id: "s1", current_focus: focus(focusType) }),
      ]);
      expect(workItems).toHaveLength(1);
      expect(workItems[0].category).toBe(category);
      expect(workItems[0].route).toBe(route);
      // The required action title is the backend's own honest title --
      // never a fabricated label.
      expect(workItems[0].title).toBe(`Title for ${focusType}`);
    },
  );

  it("routes alignment-family focus types to the real Alignment route, matching the backend's own target_route now that it exists", () => {
    const workItems = adaptCurrentFocusToWorkItems([
      item({
        shot_id: "s1",
        current_focus: focus("alignment_not_followed_by_anchor_action", {
          target_route: "/vfx/shots/s1/alignment",
        }),
      }),
    ]);
    expect(workItems[0].route).toBe("/vfx/shots/s1/alignment");
  });

  it("still re-derives the route independently rather than blindly forwarding a mismatched target_route", () => {
    // Even if a future backend response disagreed with this adapter's
    // own locked rule, the adapter must not blindly trust it -- proven
    // here by supplying a deliberately wrong target_route and checking
    // the adapter's own rule still wins.
    const workItems = adaptCurrentFocusToWorkItems([
      item({
        shot_id: "s1",
        current_focus: focus("core_anchor_gate_pending", {
          target_route: "/vfx/shots/s1/alignment",
        }),
      }),
    ]);
    expect(workItems[0].route).toBe("/vfx/shots/s1/intent");
  });

  it("uses a stable id namespaced by source type and focus type, never shotId alone", () => {
    const workItems = adaptCurrentFocusToWorkItems([
      item({ shot_id: "s1", current_focus: focus("core_anchor_gate_pending") }),
    ]);
    expect(workItems[0].id).toBe("current_focus:s1:core_anchor_gate_pending");
    expect(workItems[0].id).not.toBe("s1");
  });

  it("supports two work items referencing the same Shot without id collisions", () => {
    // Contrived at the array level (today's real backend emits at most
    // one current_focus per Shot) specifically to prove the model and
    // adapter never assume shotId is unique across work items -- the
    // property Step 7C-3's multi-source aggregation depends on.
    const workItems = adaptCurrentFocusToWorkItems([
      item({ shot_id: "s1", current_focus: focus("core_anchor_gate_pending") }),
      item({
        shot_id: "s1",
        current_focus: focus("re_anchor_proposal_present"),
      }),
    ]);
    expect(workItems).toHaveLength(2);
    expect(workItems[0].shot?.id).toBe("s1");
    expect(workItems[1].shot?.id).toBe("s1");
    expect(workItems[0].id).not.toBe(workItems[1].id);
  });

  it("handles missing optional Task/Version fields safely, without fabricating them", () => {
    const workItems = adaptCurrentFocusToWorkItems([
      item({
        relevant_task_id: null,
        relevant_task_name: null,
        relevant_version_id: null,
        relevant_version_name: null,
        relevant_version_number: null,
      }),
    ]);
    expect(workItems[0].task).toBeUndefined();
    expect(workItems[0].version).toBeUndefined();
  });

  it("never sets a persisted status -- current_focus has no such field", () => {
    const workItems = adaptCurrentFocusToWorkItems([item()]);
    expect(workItems[0].status).toBeUndefined();
  });

  it("preserves the backend's real sort_rank rather than re-deriving one", () => {
    const workItems = adaptCurrentFocusToWorkItems([item({ sort_rank: 42 })]);
    expect(workItems[0].sortRank).toBe(42);
  });
});

describe("adaptVersionReviewWorkItems", () => {
  it("creates a work item only when the backend flags a real latest Version without a Review Note", () => {
    const workItems = adaptVersionReviewWorkItems([
      item({
        shot_id: "s1",
        latest_version_without_review_id: "v9",
        latest_version_without_review_name: "SH010_v002",
        latest_version_without_review_number: 2,
      }),
    ]);
    expect(workItems).toHaveLength(1);
    expect(workItems[0].sourceType).toBe("version_review");
    expect(workItems[0].id).toBe("version_review:v9");
    expect(workItems[0].version).toEqual({
      id: "v9",
      name: "SH010_v002",
      number: 2,
    });
    expect(workItems[0].route).toBe("/vfx/shots/s1/versions");
  });

  it("returns an honest empty collection when no Shot has an unreviewed Version", () => {
    const workItems = adaptVersionReviewWorkItems([
      item({
        latest_version_without_review_id: null,
        latest_version_without_review_name: null,
        latest_version_without_review_number: null,
      }),
    ]);
    expect(workItems).toEqual([]);
  });

  it("never fabricates a work item for a Shot the backend did not flag, even with other Version fields present", () => {
    const workItems = adaptVersionReviewWorkItems([
      item({
        relevant_version_id: "v1",
        relevant_version_name: "SH010_v001",
        latest_version_without_review_id: undefined,
        latest_version_without_review_name: undefined,
      }),
    ]);
    expect(workItems).toEqual([]);
  });

  it("preserves the backend's real sort_rank rather than re-deriving one", () => {
    const workItems = adaptVersionReviewWorkItems([
      item({
        sort_rank: 7,
        latest_version_without_review_id: "v9",
        latest_version_without_review_name: "SH010_v002",
      }),
    ]);
    expect(workItems[0].sortRank).toBe(7);
  });

  it("supports a version_review item and a current_focus item on the same Shot without id collisions", () => {
    const shot = item({
      shot_id: "s1",
      current_focus: focus("core_anchor_gate_pending"),
      latest_version_without_review_id: "v9",
      latest_version_without_review_name: "SH010_v002",
    });
    const workItems = [
      ...adaptCurrentFocusToWorkItems([shot]),
      ...adaptVersionReviewWorkItems([shot]),
    ];
    expect(workItems).toHaveLength(2);
    expect(new Set(workItems.map((w) => w.id)).size).toBe(2);
  });
});

describe("adaptEscalationWorkItems", () => {
  it("creates a work item only when the backend flags a real open CG escalation", () => {
    const workItems = adaptEscalationWorkItems([
      item({
        shot_id: "s1",
        open_cg_escalation_task_id: "t9",
        open_cg_escalation_task_name: "Lighting Pass",
        open_cg_escalation_summary:
          "Dusk tone reads too bright, needs VFX input.",
      }),
    ]);
    expect(workItems).toHaveLength(1);
    expect(workItems[0].sourceType).toBe("escalation");
    expect(workItems[0].id).toBe("escalation:t9");
    expect(workItems[0].explanation).toBe(
      "Dusk tone reads too bright, needs VFX input.",
    );
    expect(workItems[0].task).toEqual({ id: "t9", name: "Lighting Pass" });
    // No route into CG Task detail exists from VFX -- Shot Overview is
    // the honest fallback.
    expect(workItems[0].route).toBe("/vfx/shots/s1");
  });

  it("returns an honest empty collection when no Shot has an open escalation", () => {
    const workItems = adaptEscalationWorkItems([
      item({
        open_cg_escalation_task_id: null,
        open_cg_escalation_task_name: null,
        open_cg_escalation_summary: null,
      }),
    ]);
    expect(workItems).toEqual([]);
  });

  it("never fabricates a work item for a Shot the backend did not flag", () => {
    const workItems = adaptEscalationWorkItems([
      item({
        open_cg_escalation_task_id: undefined,
        open_cg_escalation_summary: undefined,
      }),
    ]);
    expect(workItems).toEqual([]);
  });

  it("preserves the backend's real sort_rank rather than re-deriving one", () => {
    const workItems = adaptEscalationWorkItems([
      item({
        sort_rank: 9,
        open_cg_escalation_task_id: "t9",
        open_cg_escalation_task_name: "Lighting Pass",
        open_cg_escalation_summary: "x",
      }),
    ]);
    expect(workItems[0].sortRank).toBe(9);
  });
});
