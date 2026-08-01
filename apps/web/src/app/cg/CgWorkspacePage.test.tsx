import type { CgInboxItemRead, CgInboxRead } from "@intent-core/contracts";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CgWorkspacePage } from "./CgWorkspacePage";

afterEach(() => {
  cleanup();
});

function buildItem(overrides: Partial<CgInboxItemRead> = {}): CgInboxItemRead {
  return {
    task_id: "44444444-4444-4444-4444-444444444444",
    task_name: "Lighting Pass",
    department: "lighting",
    task_source: "manual",
    shot_id: "22222222-2222-2222-2222-222222222222",
    shot_name: "Shot 010 — Final confrontation",
    project_id: "11111111-1111-1111-1111-111111111111",
    project_name: "D1 Demo Project",
    execution_anchor_state: "draft_pending",
    active_execution_anchor_revision_id: null,
    active_execution_anchor_summary: null,
    pending_human_gate_id: "33333333-3333-3333-3333-333333333333",
    latest_version_id: null,
    latest_version_name: null,
    latest_version_number: null,
    open_dependency_count: 0,
    current_focus: {
      focus_type: "execution_anchor_gate_pending",
      title: "Execution Anchor draft awaiting your confirmation",
      explanation:
        "A proposed department execution translation is ready for your review.",
      target_route: "/cg/tasks/44444444-4444-4444-4444-444444444444/execution",
      primary_action_label: "Review and confirm",
      actionable: true,
    },
    sort_rank: 0,
    ...overrides,
  };
}

function inactiveItem(
  overrides: Partial<CgInboxItemRead> = {},
): CgInboxItemRead {
  return buildItem({
    execution_anchor_state: "none",
    pending_human_gate_id: null,
    current_focus: {
      focus_type: "none",
      title: "Nothing requires your attention on this Task right now",
      explanation: "Nothing requires your attention on this Task right now.",
      target_route: "/cg/tasks/t",
      primary_action_label: null,
      actionable: false,
    },
    ...overrides,
  });
}

function buildInbox(items: CgInboxItemRead[]): CgInboxRead {
  return { items, generated_at: "2026-07-30T00:00:00Z" };
}

describe("CgWorkspacePage", () => {
  it("renders the correct App Shell with fixed CG Supervisor identity", () => {
    render(
      <CgWorkspacePage
        inbox={buildInbox([buildItem()])}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText("Daniel Ross")).toBeVisible();
    expect(screen.getByText("CG Supervisor")).toBeVisible();
  });

  it("renders the CG role sidebar with Workspace Home current", () => {
    render(
      <CgWorkspacePage
        inbox={buildInbox([buildItem()])}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("link", { name: "Workspace Home" }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("shows an honest error state when the Inbox failed to load", () => {
    render(<CgWorkspacePage inbox={null} onExitRole={vi.fn()} />);
    expect(screen.getByText("Workspace Home is unavailable")).toBeVisible();
  });

  it("shows an honest empty state when there are no Tasks at all", () => {
    render(<CgWorkspacePage inbox={buildInbox([])} onExitRole={vi.fn()} />);
    expect(screen.getByText("No Tasks exist yet")).toBeVisible();
  });

  it("renders real summary metrics derived from the loaded Tasks", () => {
    render(
      <CgWorkspacePage
        inbox={buildInbox([
          buildItem({ task_id: "t1" }),
          inactiveItem({ task_id: "t2" }),
        ])}
        onExitRole={vi.fn()}
      />,
    );
    const overview = within(
      screen.getByRole("region", { name: "Production overview" }),
    );
    expect(overview.getByText("Total Tasks")).toBeVisible();
    expect(overview.getByText("Requiring attention")).toBeVisible();
    expect(
      overview.getByText("Execution Anchors awaiting action"),
    ).toBeVisible();
    expect(
      overview.getByText("Version reviews requiring action"),
    ).toBeVisible();
    expect(overview.getByText("Unresolved dependencies")).toBeVisible();

    const totalCard = overview
      .getByText("Total Tasks")
      .closest("div") as HTMLElement;
    expect(totalCard).toHaveTextContent("2");
  });

  it("Priority actions leads with the required action, never the Task name, and contains at most 3 items", () => {
    const items = Array.from({ length: 5 }, (_, i) =>
      buildItem({
        task_id: `t${i}`,
        task_name: `Task ${i}`,
        sort_rank: i,
        current_focus: {
          focus_type: "execution_anchor_gate_pending",
          title: `Required action ${i}`,
          explanation: "explanation",
          target_route: `/cg/tasks/t${i}/execution`,
          primary_action_label: "Review and confirm",
          actionable: true,
        },
      }),
    );
    render(<CgWorkspacePage inbox={buildInbox(items)} onExitRole={vi.fn()} />);
    const priorityActions = within(
      screen.getByRole("region", { name: "Priority actions" }),
    );
    expect(priorityActions.getByText("Required action 0")).toBeVisible();
    expect(priorityActions.getByText("Required action 1")).toBeVisible();
    expect(priorityActions.getByText("Required action 2")).toBeVisible();
    expect(
      priorityActions.queryByText("Required action 3"),
    ).not.toBeInTheDocument();
    expect(priorityActions.getByText("Task 0")).toBeVisible();
  });

  it("Priority actions opens Execution work in the real Execution route", () => {
    render(
      <CgWorkspacePage
        inbox={buildInbox([buildItem({ task_id: "t1" })])}
        onExitRole={vi.fn()}
      />,
    );
    const priorityActions = within(
      screen.getByRole("region", { name: "Priority actions" }),
    );
    const link = priorityActions
      .getByText("Execution Anchor draft awaiting your confirmation")
      .closest("a");
    expect(link).toHaveAttribute(
      "href",
      "/cg/tasks/44444444-4444-4444-4444-444444444444/execution",
    );
  });

  it("shows an honest no-priority-actions state without hiding overview or Tasks access", () => {
    render(
      <CgWorkspacePage
        inbox={buildInbox([inactiveItem({ task_id: "t1" })])}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByText("No priority actions require your attention"),
    ).toBeVisible();
    expect(screen.getByText("Total Tasks")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "View all Tasks →" }),
    ).toBeVisible();
  });

  it("Important Tasks contains at most 3 Tasks and never the complete catalogue", () => {
    const items = Array.from({ length: 6 }, (_, i) =>
      inactiveItem({ task_id: `t${i}`, task_name: `Task ${i}`, sort_rank: i }),
    );
    render(<CgWorkspacePage inbox={buildInbox(items)} onExitRole={vi.fn()} />);
    expect(screen.getByText("Important Tasks")).toBeVisible();
    expect(screen.getByText("Task 0")).toBeVisible();
    expect(screen.getByText("Task 1")).toBeVisible();
    expect(screen.getByText("Task 2")).toBeVisible();
    expect(screen.queryByText("Task 5")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "View all Tasks →" }),
    ).toHaveAttribute("href", "/cg/tasks");
  });

  it("links Priority actions' Review Inbox action into /cg/inbox", () => {
    render(
      <CgWorkspacePage
        inbox={buildInbox([buildItem()])}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("link", { name: "Go to Review Inbox →" }),
    ).toHaveAttribute("href", "/cg/inbox");
  });

  it("wires Exit role view to the provided callback", async () => {
    const onExitRole = vi.fn();
    render(
      <CgWorkspacePage
        inbox={buildInbox([buildItem()])}
        onExitRole={onExitRole}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Exit role view" }),
    );
    expect(onExitRole).toHaveBeenCalled();
  });
});
