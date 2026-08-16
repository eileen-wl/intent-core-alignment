import type { CgInboxItemRead, CgInboxRead } from "@intent-core/contracts";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

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
  it("shows an honest error state when Tasks failed to load", () => {
    render(<TasksListPage inbox={null} />);
    expect(screen.getByText("Tasks is unavailable")).toBeVisible();
  });

  it("shows an honest empty state when no Tasks exist", () => {
    render(<TasksListPage inbox={buildInbox([])} />);
    expect(screen.getByText("No Tasks exist yet")).toBeVisible();
  });

  it("renders every real Task, and opening one leads to Task Overview", () => {
    render(
      <TasksListPage
        inbox={buildInbox([
          buildItem({ task_id: "t1", task_name: "Lighting Pass" }),
          buildItem({ task_id: "t2", task_name: "Comp" }),
        ])}
      />,
    );
    expect(screen.getByText("Showing 2 of 2 Tasks")).toBeVisible();
    expect(screen.getByText("Lighting Pass").closest("a")).toHaveAttribute(
      "href",
      "/cg/tasks/t1",
    );
    expect(screen.getByText("Comp").closest("a")).toHaveAttribute(
      "href",
      "/cg/tasks/t2",
    );
  });

  it("Project filter narrows the list to that Project's Tasks only", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    render(
      <TasksListPage
        inbox={buildInbox([
          buildItem({ task_id: "t1", project_name: "D1 Demo Project" }),
          buildItem({
            task_id: "t2",
            project_name: "D2 Other Project",
            task_name: "Other Task",
          }),
        ])}
      />,
    );
    await userEvent.selectOptions(
      screen.getByLabelText("Project"),
      "D2 Other Project",
    );
    expect(screen.getByText("Showing 1 of 2 Tasks")).toBeVisible();
    expect(screen.getByText("Other Task")).toBeVisible();
    expect(screen.queryByText("Lighting Pass")).not.toBeInTheDocument();
  });

  it("shows an honest no-match state when filters exclude every Task", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    render(
      <TasksListPage
        inbox={buildInbox([buildItem({ execution_anchor_state: "confirmed" })])}
      />,
    );
    await userEvent.selectOptions(
      screen.getByLabelText("Execution Anchor state"),
      "No Execution Anchor",
    );
    expect(screen.getByText("No Tasks match these filters")).toBeVisible();
  });

  it("Execution Anchor state filter narrows the list to that state only", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    render(
      <TasksListPage
        inbox={buildInbox([
          buildItem({
            task_id: "t1",
            task_name: "Confirmed Task",
            execution_anchor_state: "confirmed",
          }),
          buildItem({
            task_id: "t2",
            task_name: "Missing Anchor Task",
            execution_anchor_state: "none",
          }),
        ])}
      />,
    );
    await userEvent.selectOptions(
      screen.getByLabelText("Execution Anchor state"),
      "No Execution Anchor",
    );
    expect(screen.getByText("Showing 1 of 2 Tasks")).toBeVisible();
    expect(screen.getByText("Missing Anchor Task")).toBeVisible();
    expect(screen.queryByText("Confirmed Task")).not.toBeInTheDocument();
  });

  it("no longer offers the action-queue 'Requiring attention only' filter", () => {
    render(<TasksListPage inbox={buildInbox([buildItem()])} />);
    expect(
      screen.queryByText("Requiring attention only"),
    ).not.toBeInTheDocument();
  });

  it("renders object-first: no full AnchorContextSummary, no action-oriented CTA", () => {
    render(
      <TasksListPage
        inbox={buildInbox([
          buildItem({
            current_focus: {
              focus_type: "dependency_needs_attention",
              title: "An unresolved dependency needs your interpretation",
              explanation: "A real recorded dependency is still open.",
              target_route: "/cg/tasks/t1/dependencies",
              primary_action_label: "Review dependencies",
              actionable: true,
            },
          }),
        ])}
      />,
    );
    expect(
      screen.queryByText("Anchor context unavailable"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("An unresolved dependency needs your interpretation"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Review dependencies")).not.toBeInTheDocument();
    expect(screen.getByText("Open Task →")).toBeVisible();
  });

  it("organizes Tasks into Department sections, with an honest trailing group for Tasks with no recorded Department", () => {
    render(
      <TasksListPage
        inbox={buildInbox([
          buildItem({
            task_id: "t1",
            task_name: "Lighting Task",
            department: "lighting",
          }),
          buildItem({
            task_id: "t2",
            task_name: "Comp Task",
            department: "compositing",
          }),
          buildItem({
            task_id: "t3",
            task_name: "Unassigned Task",
            department: null,
          }),
        ])}
      />,
    );
    const lighting = screen.getByRole("region", { name: "lighting" });
    expect(within(lighting).getByText("Lighting Task")).toBeVisible();
    const compositing = screen.getByRole("region", { name: "compositing" });
    expect(within(compositing).getByText("Comp Task")).toBeVisible();
    const unassigned = screen.getByRole("region", {
      name: "No department recorded",
    });
    expect(within(unassigned).getByText("Unassigned Task")).toBeVisible();
  });

  it("omits the meaningless zero-dependency line but shows a real open-dependency count", () => {
    render(
      <TasksListPage
        inbox={buildInbox([
          buildItem({
            task_id: "t1",
            task_name: "Quiet Task",
            open_dependency_count: 0,
          }),
          buildItem({
            task_id: "t2",
            task_name: "Blocked Task",
            open_dependency_count: 2,
          }),
        ])}
      />,
    );
    expect(screen.queryByText("No open dependencies")).not.toBeInTheDocument();
    expect(screen.getByText("2 open dependencies")).toBeVisible();
  });

  it("merges the same Department into one section regardless of casing or stray whitespace", () => {
    render(
      <TasksListPage
        inbox={buildInbox([
          buildItem({
            task_id: "t1",
            task_name: "Task A",
            department: "Animation",
          }),
          buildItem({
            task_id: "t2",
            task_name: "Task B",
            department: "animation",
          }),
          buildItem({
            task_id: "t3",
            task_name: "Task C",
            department: " Animation ",
          }),
        ])}
      />,
    );
    expect(screen.getAllByRole("region")).toHaveLength(1);
    const animation = screen.getByRole("region", { name: "Animation" });
    expect(within(animation).getByText("Task A")).toBeVisible();
    expect(within(animation).getByText("Task B")).toBeVisible();
    expect(within(animation).getByText("Task C")).toBeVisible();
    expect(within(animation).getByText("3 Tasks")).toBeVisible();
  });

  it("never merges genuinely different Department words without evidence they mean the same thing", () => {
    render(
      <TasksListPage
        inbox={buildInbox([
          buildItem({
            task_id: "t1",
            task_name: "Short-form Task",
            department: "comp",
          }),
          buildItem({
            task_id: "t2",
            task_name: "Long-form Task",
            department: "compositing",
          }),
        ])}
      />,
    );
    expect(screen.getAllByRole("region")).toHaveLength(2);
    const comp = screen.getByRole("region", { name: "comp" });
    expect(within(comp).getByText("Short-form Task")).toBeVisible();
    const compositing = screen.getByRole("region", { name: "compositing" });
    expect(within(compositing).getByText("Long-form Task")).toBeVisible();
  });
});
