import type { CgCurrentFocusType, CgInboxCurrentFocusRead, CgInboxItemRead } from "@intent-core/contracts";
import { describe, expect, it } from "vitest";

import { adaptCgCurrentFocusToWorkItems } from "./reviewInbox";

function focus(
  focusType: CgCurrentFocusType,
  overrides: Partial<CgInboxCurrentFocusRead> = {},
): CgInboxCurrentFocusRead {
  return {
    focus_type: focusType,
    title: `Title for ${focusType}`,
    explanation: `Explanation for ${focusType}`,
    target_route: `/cg/tasks/t1/execution`,
    primary_action_label: "Act now",
    actionable: focusType !== "none",
    ...overrides,
  };
}

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
    execution_anchor_state: "draft_pending",
    active_execution_anchor_revision_id: null,
    active_execution_anchor_summary: null,
    pending_human_gate_id: "gate1",
    latest_version_id: null,
    latest_version_name: null,
    latest_version_number: null,
    open_dependency_count: 0,
    current_focus: focus("execution_anchor_gate_pending"),
    sort_rank: 0,
    ...overrides,
  };
}

describe("adaptCgCurrentFocusToWorkItems", () => {
  it("creates a work item only for actionable focus records", () => {
    const items = [
      item({ task_id: "t1", current_focus: focus("execution_anchor_gate_pending") }),
      item({
        task_id: "t2",
        current_focus: focus("none", { title: "Nothing requires your attention on this Task right now", explanation: "", primary_action_label: null }),
      }),
    ];
    const workItems = adaptCgCurrentFocusToWorkItems(items);
    expect(workItems).toHaveLength(1);
    expect(workItems[0].task.id).toBe("t1");
  });

  it("returns an honest empty collection when nothing is actionable", () => {
    const items = [item({ current_focus: focus("none", { primary_action_label: null }) })];
    expect(adaptCgCurrentFocusToWorkItems(items)).toEqual([]);
  });

  const actionableTypes: { focusType: CgCurrentFocusType; category: string; route: string }[] = [
    { focusType: "execution_anchor_gate_pending", category: "Execution Anchor confirmation", route: "/cg/tasks/t1/execution" },
    { focusType: "execution_anchor_draft_needs_review", category: "Draft review", route: "/cg/tasks/t1/execution" },
    { focusType: "dependency_needs_attention", category: "Dependency review", route: "/cg/tasks/t1/dependencies" },
    { focusType: "version_review_available", category: "Version review", route: "/cg/tasks/t1/version-review" },
  ];

  it.each(actionableTypes)(
    "maps $focusType to an honest category and trusts the backend's own target_route",
    ({ focusType, category, route }) => {
      const workItems = adaptCgCurrentFocusToWorkItems([
        item({ task_id: "t1", current_focus: focus(focusType, { target_route: route }) }),
      ]);
      expect(workItems).toHaveLength(1);
      expect(workItems[0].category).toBe(category);
      expect(workItems[0].route).toBe(route);
      expect(workItems[0].title).toBe(`Title for ${focusType}`);
    },
  );

  it("uses a stable id namespaced by source type and focus type, never taskId alone", () => {
    const workItems = adaptCgCurrentFocusToWorkItems([
      item({ task_id: "t1", current_focus: focus("execution_anchor_gate_pending") }),
    ]);
    expect(workItems[0].id).toBe("current_focus:t1:execution_anchor_gate_pending");
    expect(workItems[0].id).not.toBe("t1");
  });

  it("preserves the backend's real sort_rank rather than re-deriving one", () => {
    const workItems = adaptCgCurrentFocusToWorkItems([item({ sort_rank: 42 })]);
    expect(workItems[0].sortRank).toBe(42);
  });

  it("carries real Project/Shot/Task context, never fabricated", () => {
    const workItems = adaptCgCurrentFocusToWorkItems([
      item({ task_id: "t1", task_name: "Lighting Pass", shot_name: "Shot 010", project_name: "D1 Demo Project" }),
    ]);
    expect(workItems[0].task).toEqual({ id: "t1", name: "Lighting Pass", department: "lighting" });
    expect(workItems[0].shot.name).toBe("Shot 010");
    expect(workItems[0].project.name).toBe("D1 Demo Project");
  });
});
