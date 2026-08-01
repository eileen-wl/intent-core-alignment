import type { CgInboxItemRead, CgInboxRead } from "@intent-core/contracts";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TasksListPage } from "./TasksListPage";

afterEach(() => {
  cleanup();
});

function buildItem(overrides: Partial<CgInboxItemRead> = {}): CgInboxItemRead {
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
    active_execution_anchor_revision_id: "r1",
    active_execution_anchor_summary: "24fps, no motion blur.",
    pending_human_gate_id: null,
    latest_version_id: null,
    latest_version_name: null,
    latest_version_number: null,
    open_dependency_count: 0,
    current_focus: {
      focus_type: "none",
      title: "Nothing requires your attention on this Task right now",
      explanation: "Nothing requires your attention on this Task right now.",
      target_route: "/cg/tasks/t1",
      primary_action_label: null,
      actionable: false,
    },
    sort_rank: 0,
    ...overrides,
  };
}

function buildInbox(items: CgInboxItemRead[]): CgInboxRead {
  return { items, generated_at: "2026-01-01T00:00:00Z" };
}

describe("TasksListPage", () => {
  it("marks Tasks current in the sidebar", () => {
    render(<TasksListPage inbox={buildInbox([buildItem()])} onExitRole={vi.fn()} />);
    expect(screen.getByRole("link", { name: "Tasks" })).toHaveAttribute("aria-current", "page");
  });

  it("shows an honest error state when Tasks failed to load", () => {
    render(<TasksListPage inbox={null} onExitRole={vi.fn()} />);
    expect(screen.getByText("Tasks is unavailable")).toBeVisible();
  });

  it("shows an honest empty state when no Tasks exist", () => {
    render(<TasksListPage inbox={buildInbox([])} onExitRole={vi.fn()} />);
    expect(screen.getByText("No Tasks exist yet")).toBeVisible();
  });

  it("renders every real Task, and opening one leads to Task Overview", () => {
    render(
      <TasksListPage
        inbox={buildInbox([
          buildItem({ task_id: "t1", task_name: "Lighting Pass" }),
          buildItem({ task_id: "t2", task_name: "Comp" }),
        ])}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText("Showing 2 of 2 Tasks")).toBeVisible();
    expect(screen.getByText("Lighting Pass").closest("a")).toHaveAttribute(
      "href",
      "/cg/tasks/t1",
    );
    expect(screen.getByText("Comp").closest("a")).toHaveAttribute("href", "/cg/tasks/t2");
  });

  it("Project filter narrows the list to that Project's Tasks only", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    render(
      <TasksListPage
        inbox={buildInbox([
          buildItem({ task_id: "t1", project_name: "D1 Demo Project" }),
          buildItem({ task_id: "t2", project_name: "D2 Other Project", task_name: "Other Task" }),
        ])}
        onExitRole={vi.fn()}
      />,
    );
    await userEvent.selectOptions(screen.getByLabelText("Project"), "D2 Other Project");
    expect(screen.getByText("Showing 1 of 2 Tasks")).toBeVisible();
    expect(screen.getByText("Other Task")).toBeVisible();
    expect(screen.queryByText("Lighting Pass")).not.toBeInTheDocument();
  });

  it("shows an honest no-match state when filters exclude every Task", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    render(<TasksListPage inbox={buildInbox([buildItem()])} onExitRole={vi.fn()} />);
    await userEvent.click(screen.getByLabelText("Requiring attention only"));
    expect(screen.getByText("No Tasks match these filters")).toBeVisible();
  });
});
