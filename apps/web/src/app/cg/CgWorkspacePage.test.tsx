import type {
  AnchorContextSummaryRead,
  CgInboxItemRead,
  CgInboxRead,
} from "@intent-core/contracts";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CgWorkspacePage } from "./CgWorkspacePage";

afterEach(cleanup);

function item(
  id: string,
  state: CgInboxItemRead["execution_anchor_state"] = "none",
  openDependencyCount = 0,
  focusType: CgInboxItemRead["current_focus"]["focus_type"] = "none",
): CgInboxItemRead {
  return {
    task_id: id,
    task_name: `Lighting ${id}`,
    department: "lighting",
    task_source: "manual",
    shot_id: `shot-${id}`,
    shot_name: `Shot ${id}`,
    project_id: "project-1",
    project_name: "Demo Project",
    execution_anchor_state: state,
    active_execution_anchor_revision_id: null,
    active_execution_anchor_summary: null,
    pending_human_gate_id: null,
    latest_version_id: null,
    latest_version_name: null,
    latest_version_number: null,
    open_dependency_count: openDependencyCount,
    current_focus: {
      focus_type: focusType,
      title: "Nothing requires your attention on this Task right now",
      explanation: "No current focus.",
      target_route: `/cg/tasks/${id}`,
      primary_action_label: null,
      actionable: false,
    },
    sort_rank: 0,
  };
}

function summary(id: string): AnchorContextSummaryRead {
  return {
    role: "cg_supervisor",
    shot_id: `shot-${id}`,
    task_id: id,
    core_anchor_state: "confirmed",
    core_anchor_revision_number: 1,
    core_direction: "Keep the confrontation restrained.",
    execution_context_state: "missing",
    execution_anchor_revision_number: null,
    execution_direction: null,
    based_on_core_anchor_revision_number: null,
    attention_level: "not_assessed",
    attention_summary: null,
    guidance_state: "unavailable",
    readiness_state: "action_required",
    readiness_detail: "The department translation is missing.",
    open_vfx_escalation: false,
    next_action: {
      title: "Create the Execution Anchor",
      why_now: "Confirmed Core direction needs a department translation.",
      downstream_effect: "Artists will receive confirmed execution direction.",
      target_route: `/cg/tasks/${id}/execution`,
      action_label: "Open Execution",
      executable: true,
    },
  };
}

function inbox(items: CgInboxItemRead[]): CgInboxRead {
  return { items, generated_at: "2026-08-03T00:00:00Z" };
}

describe("CgWorkspacePage", () => {
  it("renders honest error and empty states", () => {
    const { rerender } = render(<CgWorkspacePage inbox={null} />);
    expect(screen.getByText("Workspace Home is unavailable")).toBeVisible();
    rerender(<CgWorkspacePage inbox={inbox([])} />);
    expect(screen.getByText("No Tasks exist yet")).toBeVisible();
  });

  it("shows an honest empty state when no Task needs a technical decision", () => {
    render(
      <CgWorkspacePage inbox={inbox([item("t1")])} anchorActions={null} />,
    );
    const primary = screen.getByRole("region", {
      name: "Primary technical focus",
    });
    expect(
      within(primary).getByText("Nothing needs a technical decision right now"),
    ).toBeVisible();
    expect(
      screen.queryByRole("region", { name: "Also at risk" }),
    ).not.toBeInTheDocument();
  });

  it("renders exactly one Primary Technical Focus and no secondary region for a single priority Task", () => {
    render(
      <CgWorkspacePage
        inbox={inbox([item("t1")])}
        anchorActions={{ items: [summary("t1")], total_count: 1, limit: 5 }}
      />,
    );
    const primary = screen.getByRole("region", {
      name: "Primary technical focus",
    });
    expect(within(primary).getByText("Lighting t1 · Shot t1")).toBeVisible();
    expect(
      within(primary).getByText("Create the Execution Anchor"),
    ).toBeVisible();
    expect(within(primary).getByText("Open Execution →")).toBeVisible();
    expect(
      screen.queryByRole("region", { name: "Also at risk" }),
    ).not.toBeInTheDocument();
  });

  it("enforces the Home content ceiling: 1 Primary Technical Focus + at most 2 secondary Tasks, even with many eligible Tasks", () => {
    const items = Array.from({ length: 7 }, (_, index) => item(`t${index}`));
    render(
      <CgWorkspacePage
        inbox={inbox(items)}
        anchorActions={{
          items: items.map((row) => summary(row.task_id)),
          total_count: 7,
          limit: 5,
        }}
      />,
    );

    const primary = screen.getByRole("region", {
      name: "Primary technical focus",
    });
    expect(within(primary).getByText("Lighting t0 · Shot t0")).toBeVisible();

    const secondary = screen.getByRole("region", { name: "Also at risk" });
    const secondaryItems = within(secondary).getAllByRole("listitem");
    expect(secondaryItems).toHaveLength(2);
    expect(within(secondary).getByText("Lighting t1")).toBeVisible();
    expect(within(secondary).getByText("Lighting t2")).toBeVisible();
    expect(
      within(secondary).queryByText("Lighting t3"),
    ).not.toBeInTheDocument();
    expect(
      within(secondary).queryByLabelText("Production context"),
    ).not.toBeInTheDocument();
  });

  it("shows a compact, non-imperative state signal for each secondary Task instead of the imperative next-action title", () => {
    render(
      <CgWorkspacePage
        inbox={inbox([
          item("t1", "none", 0, "execution_anchor_gate_pending"),
          item("t2", "confirmed", 1, "dependency_needs_attention"),
          item("t3", "confirmed", 0, "version_review_available"),
        ])}
        anchorActions={{
          items: [summary("t1"), summary("t2"), summary("t3")],
          total_count: 3,
          limit: 5,
        }}
      />,
    );
    const secondary = screen.getByRole("region", { name: "Also at risk" });
    expect(within(secondary).getByText("Open dependency")).toBeVisible();
    expect(
      within(secondary).getByText("Version ready for review"),
    ).toBeVisible();
    expect(
      within(secondary).queryByText("Create the Execution Anchor"),
    ).not.toBeInTheDocument();
  });

  it("falls back to the Task's real Execution Anchor state, never a false 'No open signal', when current focus is none", () => {
    render(
      <CgWorkspacePage
        inbox={inbox([
          item("t1", "none", 0, "execution_anchor_gate_pending"),
          item("t2", "none", 0, "none"),
          item("t3", "confirmed", 0, "none"),
        ])}
        anchorActions={{
          items: [summary("t1"), summary("t2"), summary("t3")],
          total_count: 3,
          limit: 5,
        }}
      />,
    );
    const secondary = screen.getByRole("region", { name: "Also at risk" });
    expect(
      within(secondary).getByText("Execution Anchor missing"),
    ).toBeVisible();
    expect(within(secondary).getByText("Other execution focus")).toBeVisible();
    expect(
      within(secondary).queryByText("No open signal"),
    ).not.toBeInTheDocument();
  });

  it("visually splits primary role-state metrics from supporting metrics without dropping any aggregate fact", () => {
    render(
      <CgWorkspacePage
        inbox={inbox([
          item("confirmed-1", "confirmed", 2),
          item("draft", "draft_pending"),
          item("none", "none"),
        ])}
        anchorActions={{
          items: [summary("confirmed-1")],
          total_count: 1,
          limit: 5,
        }}
      />,
    );
    const scope = within(
      screen.getByRole("region", { name: "Scope overview" }),
    );
    expect(scope.getByText("Confirmed Execution Anchors")).toBeVisible();
    expect(scope.getByText("Missing Execution Anchors")).toBeVisible();
    expect(scope.getByText("Tasks with open Dependencies")).toBeVisible();
    expect(scope.getByText(/Awaiting Anchor action/)).toBeVisible();
    expect(scope.getByText(/Ready for Version review/)).toBeVisible();
  });

  it("communicates real execution-direction coverage and dependency pressure, not a bare count", () => {
    render(
      <CgWorkspacePage
        inbox={inbox([
          item("confirmed-1", "confirmed", 2),
          item("confirmed-2", "confirmed"),
          item("draft", "draft_pending"),
          item("none", "none"),
        ])}
        anchorActions={{
          items: [summary("confirmed-1")],
          total_count: 1,
          limit: 5,
        }}
      />,
    );
    const health = screen.getByRole("region", { name: "Execution readiness" });
    expect(
      within(health).getByText(
        "2 of 4 Tasks have confirmed execution direction (1 awaiting confirmation, 1 missing execution direction).",
      ),
    ).toBeVisible();
    expect(
      within(health).getByText("1 Task is blocked by open dependencies."),
    ).toBeVisible();
  });

  it("disambiguates the Primary Technical Focus status badge as specifically the Execution Anchor", () => {
    render(
      <CgWorkspacePage
        inbox={inbox([item("t1", "confirmed")])}
        anchorActions={{ items: [summary("t1")], total_count: 1, limit: 5 }}
      />,
    );
    const primary = screen.getByRole("region", {
      name: "Primary technical focus",
    });
    expect(
      within(primary).getByText("Execution Anchor confirmed"),
    ).toBeVisible();
    expect(within(primary).queryByText("Confirmed")).not.toBeInTheDocument();
  });

  it("keeps the Scope overview counts and routes present", () => {
    render(
      <CgWorkspacePage
        inbox={inbox([item("confirmed", "confirmed"), item("missing", "none")])}
        anchorActions={{
          items: [summary("confirmed")],
          total_count: 1,
          limit: 5,
        }}
      />,
    );
    const scope = within(
      screen.getByRole("region", { name: "Scope overview" }),
    );
    expect(
      scope.getByText("Confirmed Execution Anchors").closest("div"),
    ).toHaveTextContent("1");
    expect(
      scope.getByText("Missing Execution Anchors").closest("div"),
    ).toHaveTextContent("1");
    expect(
      screen.getByRole("link", { name: "View all Tasks →" }),
    ).toHaveAttribute("href", "/cg/tasks");
    expect(
      screen.getByRole("link", { name: "Go to Review Inbox →" }),
    ).toHaveAttribute("href", "/cg/inbox");
  });
});
