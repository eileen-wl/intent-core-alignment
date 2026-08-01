import type { CgInboxItemRead } from "@intent-core/contracts";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TaskOverviewData } from "@/features/cg/task-overview/data";
import { TaskOverviewPage } from "./TaskOverviewPage";

afterEach(() => {
  cleanup();
});

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
    current_focus: {
      focus_type: "execution_anchor_gate_pending",
      title: "Execution Anchor draft awaiting your confirmation",
      explanation: "A proposed department execution translation is ready for your review.",
      target_route: "/cg/tasks/t1/execution",
      primary_action_label: "Review and confirm",
      actionable: true,
    },
    sort_rank: 0,
    ...overrides,
  };
}

function data(overrides: Partial<TaskOverviewData> = {}): TaskOverviewData {
  return {
    item: item(),
    coreAnchorSummary: null,
    dependencies: [],
    recentActivity: [],
    ...overrides,
  };
}

describe("TaskOverviewPage", () => {
  it("renders Project > Shot > Task > Overview breadcrumbs and all five real Context Tabs, Overview active", () => {
    render(<TaskOverviewPage taskId="t1" data={data()} unavailable={false} onExitRole={vi.fn()} />);
    expect(screen.getByRole("link", { name: "D1 Demo Project" })).toHaveAttribute(
      "href",
      "/cg/tasks",
    );
    for (const [label, href] of [
      ["Execution", "/cg/tasks/t1/execution"],
      ["Version Review", "/cg/tasks/t1/version-review"],
      ["Dependencies", "/cg/tasks/t1/dependencies"],
      ["Activity", "/cg/tasks/t1/activity"],
    ] as const) {
      expect(screen.getByRole("link", { name: label })).toHaveAttribute("href", href);
    }
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("Tasks stays the active sidebar item, never Review Inbox", () => {
    render(<TaskOverviewPage taskId="t1" data={data()} unavailable={false} onExitRole={vi.fn()} />);
    expect(screen.getByRole("link", { name: "Tasks" })).toHaveAttribute("aria-current", "page");
  });

  it("shows an honest unavailable state when the API could not be reached", () => {
    render(<TaskOverviewPage taskId="t1" data={null} unavailable onExitRole={vi.fn()} />);
    expect(screen.getByText("This Task is unavailable")).toBeVisible();
  });

  it("renders exactly one Current focus with its real primary action", () => {
    render(<TaskOverviewPage taskId="t1" data={data()} unavailable={false} onExitRole={vi.fn()} />);
    expect(
      screen.getByText("Execution Anchor draft awaiting your confirmation"),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Review and confirm" })).toHaveAttribute(
      "href",
      "/cg/tasks/t1/execution",
    );
  });

  it("shows Core Anchor context as honestly read-only, never an edit control", () => {
    render(
      <TaskOverviewPage
        taskId="t1"
        data={data({ coreAnchorSummary: "A restrained dusk confrontation." })}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText("Confirmed Core Anchor (read-only)")).toBeVisible();
    expect(screen.getByText("A restrained dusk confrontation.")).toBeVisible();
    expect(screen.queryByRole("button", { name: /confirm/i })).not.toBeInTheDocument();
  });

  it("honestly states no Core Anchor when none is confirmed", () => {
    render(<TaskOverviewPage taskId="t1" data={data()} unavailable={false} onExitRole={vi.fn()} />);
    expect(
      screen.getByText("No Core Anchor is confirmed for this Shot yet."),
    ).toBeVisible();
  });

  it("shows an honest empty Activity state for a genuinely bare Task", () => {
    render(<TaskOverviewPage taskId="t1" data={data()} unavailable={false} onExitRole={vi.fn()} />);
    expect(screen.getByText("No recorded activity exists for this Task yet.")).toBeVisible();
  });
});
