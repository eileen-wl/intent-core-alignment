import type {
  ArtistInboxItemRead,
  ArtistInboxRead,
} from "@intent-core/contracts";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TasksListPage } from "./TasksListPage";

afterEach(() => {
  cleanup();
});

function buildItem(
  overrides: Partial<ArtistInboxItemRead> = {},
): ArtistInboxItemRead {
  return {
    task_id: "t1",
    task_name: "Compositing Review",
    department: "compositing",
    task_source: "manual",
    shot_id: "s1",
    shot_name: "Shot 010",
    project_id: "p1",
    project_name: "D1 Demo Project",
    execution_anchor_state: "confirmed",
    active_execution_anchor_revision_id: "ea1",
    active_execution_anchor_summary:
      "Keep the silhouette readable against the backlight.",
    latest_version_id: null,
    latest_version_name: null,
    latest_version_number: null,
    guidance_state: "none",
    latest_guidance_id: null,
    open_review_note_count: 0,
    open_dependency_count: 0,
    current_focus: {
      focus_type: "none",
      title: "Nothing requires your attention on this Task right now",
      explanation: "Nothing requires your attention on this Task right now.",
      target_route: "/artist/tasks/t1",
      primary_action_label: null,
      actionable: false,
    },
    sort_rank: 0,
    ...overrides,
  };
}

function buildInbox(items: ArtistInboxItemRead[]): ArtistInboxRead {
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
          buildItem({ task_id: "t1", task_name: "Compositing Review" }),
          buildItem({ task_id: "t2", task_name: "Lighting Pass" }),
        ])}
      />,
    );
    expect(screen.getByText("Showing 2 of 2 Tasks")).toBeVisible();
    expect(screen.getByText("Compositing Review").closest("a")).toHaveAttribute(
      "href",
      "/artist/tasks/t1",
    );
    expect(screen.getByText("Lighting Pass").closest("a")).toHaveAttribute(
      "href",
      "/artist/tasks/t2",
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
    expect(screen.queryByText("Compositing Review")).not.toBeInTheDocument();
  });

  it("Guidance state filter narrows the list to that state only", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    render(
      <TasksListPage
        inbox={buildInbox([
          buildItem({
            task_id: "t1",
            guidance_state: "outdated",
            task_name: "Outdated Task",
          }),
          buildItem({
            task_id: "t2",
            guidance_state: "none",
            task_name: "No Guidance Task",
          }),
        ])}
      />,
    );
    await userEvent.selectOptions(
      screen.getByLabelText("Guidance state"),
      "Guidance outdated",
    );
    expect(screen.getByText("Showing 1 of 2 Tasks")).toBeVisible();
    expect(screen.getByText("Outdated Task")).toBeVisible();
    expect(screen.queryByText("No Guidance Task")).not.toBeInTheDocument();
  });

  it("Latest Version filter narrows the list correctly", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    render(
      <TasksListPage
        inbox={buildInbox([
          buildItem({
            task_id: "t1",
            task_name: "Has Version",
            latest_version_id: "v1",
            latest_version_name: "v001",
          }),
          buildItem({ task_id: "t2", task_name: "No Version" }),
        ])}
      />,
    );
    await userEvent.selectOptions(
      screen.getByLabelText("Latest Version"),
      "Has a Version",
    );
    expect(screen.getByText("Showing 1 of 2 Tasks")).toBeVisible();
    expect(screen.getByText("Has Version")).toBeVisible();
    expect(screen.queryByText("No Version")).not.toBeInTheDocument();
  });

  it("shows an honest no-match state when filters exclude every Task", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    render(
      <TasksListPage
        inbox={buildInbox([buildItem({ guidance_state: "none" })])}
      />,
    );
    await userEvent.selectOptions(
      screen.getByLabelText("Guidance state"),
      "Guidance outdated",
    );
    expect(screen.getByText("No Tasks match these filters")).toBeVisible();
  });

  it("no longer offers the action-queue 'Requiring attention only' filter", () => {
    render(<TasksListPage inbox={buildInbox([buildItem()])} />);
    expect(
      screen.queryByText("Requiring attention only"),
    ).not.toBeInTheDocument();
  });

  it("leads with the Task's own real Guidance state, not Execution Anchor state, and never next_action.title or current_focus.title", () => {
    render(
      <TasksListPage
        inbox={buildInbox([
          buildItem({
            guidance_state: "outdated",
            execution_anchor_state: "confirmed",
            current_focus: {
              focus_type: "guidance_available",
              title: "New Guidance is available",
              explanation: "Confirmed Guidance is ready to read.",
              target_route: "/artist/tasks/t1",
              primary_action_label: "Open Task",
              actionable: true,
            },
          }),
        ])}
      />,
    );
    // Guidance state is the leading badge.
    const tile = within(
      screen.getByText("Compositing Review").closest("a") as HTMLElement,
    );
    expect(tile.getByText("Guidance outdated")).toBeVisible();
    // Execution Anchor state is real and present, but only as a
    // supporting fact -- never the Current-focus reason text.
    expect(tile.getByText(/Confirmed/)).toBeVisible();
    expect(
      screen.queryByText("New Guidance is available"),
    ).not.toBeInTheDocument();
  });

  it("omits the meaningless zero-feedback line but shows a real Review Note count", () => {
    render(
      <TasksListPage
        inbox={buildInbox([
          buildItem({
            task_id: "t1",
            task_name: "Quiet Task",
            open_review_note_count: 0,
          }),
          buildItem({
            task_id: "t2",
            task_name: "Noted Task",
            open_review_note_count: 1,
          }),
        ])}
      />,
    );
    expect(
      screen.queryByText("No Review Notes recorded"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("1 Review Note recorded")).toBeVisible();
  });

  it("renders object-first: no full AnchorContextSummary, no action-oriented CTA", () => {
    render(<TasksListPage inbox={buildInbox([buildItem()])} />);
    expect(
      screen.queryByText("Anchor context unavailable"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Open Task →")).toBeVisible();
  });

  it("groups Tasks by their real parent Shot, identifying each Shot once and listing its own Tasks beneath it", () => {
    render(
      <TasksListPage
        inbox={buildInbox([
          buildItem({
            task_id: "t1",
            task_name: "Comp Pass",
            shot_id: "s1",
            shot_name: "Shot 010",
          }),
          buildItem({
            task_id: "t2",
            task_name: "Lighting Pass",
            shot_id: "s2",
            shot_name: "Shot 020",
          }),
          buildItem({
            task_id: "t3",
            task_name: "Comp Revision",
            shot_id: "s1",
            shot_name: "Shot 010",
          }),
        ])}
      />,
    );
    expect(screen.getAllByRole("region")).toHaveLength(2);
    const shot010 = screen.getByRole("region", { name: "Shot 010" });
    expect(within(shot010).getByText("Comp Pass")).toBeVisible();
    expect(within(shot010).getByText("Comp Revision")).toBeVisible();
    expect(within(shot010).getByText("2 Tasks")).toBeVisible();
    const shot020 = screen.getByRole("region", { name: "Shot 020" });
    expect(within(shot020).getByText("Lighting Pass")).toBeVisible();
    expect(within(shot020).queryByText("Comp Pass")).not.toBeInTheDocument();
  });
});
