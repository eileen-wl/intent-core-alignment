import type {
  ArtistInboxItemRead,
  ArtistInboxRead,
} from "@intent-core/contracts";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ArtistWorkspacePage } from "./ArtistWorkspacePage";

afterEach(() => {
  cleanup();
});

function buildItem(
  overrides: Partial<ArtistInboxItemRead> = {},
): ArtistInboxItemRead {
  return {
    task_id: "44444444-4444-4444-4444-444444444444",
    task_name: "Compositing Review",
    department: "compositing",
    task_source: "manual",
    shot_id: "22222222-2222-2222-2222-222222222222",
    shot_name: "Shot 010 — Final confrontation",
    project_id: "11111111-1111-1111-1111-111111111111",
    project_name: "D1 Demo Project",
    execution_anchor_state: "confirmed",
    active_execution_anchor_revision_id: "55555555-5555-5555-5555-555555555555",
    active_execution_anchor_summary:
      "Keep the silhouette readable against the backlight.",
    latest_version_id: "66666666-6666-6666-6666-666666666666",
    latest_version_name: "v003",
    latest_version_number: 3,
    guidance_state: "outdated",
    latest_guidance_id: "77777777-7777-7777-7777-777777777777",
    open_review_note_count: 1,
    open_dependency_count: 0,
    current_focus: {
      focus_type: "guidance_outdated",
      title: "Artist guidance is outdated",
      explanation:
        "A newer confirmed Execution Anchor exists since this guidance was generated.",
      target_route: "/artist/tasks/44444444-4444-4444-4444-444444444444",
      primary_action_label: "Review Task",
      actionable: true,
    },
    sort_rank: 0,
    ...overrides,
  };
}

function inactiveItem(
  overrides: Partial<ArtistInboxItemRead> = {},
): ArtistInboxItemRead {
  return buildItem({
    execution_anchor_state: "none",
    active_execution_anchor_revision_id: null,
    active_execution_anchor_summary: null,
    latest_version_id: null,
    latest_version_name: null,
    latest_version_number: null,
    guidance_state: "none",
    latest_guidance_id: null,
    open_review_note_count: 0,
    current_focus: {
      focus_type: "none",
      title: "Nothing requires your attention on this Task right now",
      explanation: "Nothing requires your attention on this Task right now.",
      target_route: "/artist/tasks/t",
      primary_action_label: null,
      actionable: false,
    },
    ...overrides,
  });
}

function buildInbox(items: ArtistInboxItemRead[]): ArtistInboxRead {
  return { items, generated_at: "2026-07-30T00:00:00Z" };
}

describe("ArtistWorkspacePage", () => {
  it("renders the correct App Shell with fixed Artist identity", () => {
    render(
      <ArtistWorkspacePage
        inbox={buildInbox([buildItem()])}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText("Lena Park")).toBeVisible();
    expect(screen.getByText("Artist")).toBeVisible();
  });

  it("renders the Artist role sidebar with Workspace Home current", () => {
    render(
      <ArtistWorkspacePage
        inbox={buildInbox([buildItem()])}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("link", { name: "Workspace Home" }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("shows an honest error state when the Inbox failed to load", () => {
    render(<ArtistWorkspacePage inbox={null} onExitRole={vi.fn()} />);
    expect(screen.getByText("Workspace Home is unavailable")).toBeVisible();
  });

  it("shows an honest empty state when there are no Tasks at all", () => {
    render(<ArtistWorkspacePage inbox={buildInbox([])} onExitRole={vi.fn()} />);
    expect(screen.getByText("No Tasks exist yet")).toBeVisible();
  });

  it("renders real summary metrics derived from the loaded Tasks", () => {
    render(
      <ArtistWorkspacePage
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
    expect(overview.getByText("New or updated guidance")).toBeVisible();
    expect(overview.getByText("Feedback requiring response")).toBeVisible();
    expect(overview.getByText("Blocked Tasks")).toBeVisible();

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
          focus_type: "guidance_outdated",
          title: `Required action ${i}`,
          explanation: "explanation",
          target_route: `/artist/tasks/t${i}`,
          primary_action_label: "Review Task",
          actionable: true,
        },
      }),
    );
    render(
      <ArtistWorkspacePage inbox={buildInbox(items)} onExitRole={vi.fn()} />,
    );
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

  it("Priority actions opens guidance work in the real Task Overview route", () => {
    render(
      <ArtistWorkspacePage
        inbox={buildInbox([buildItem({ task_id: "t1" })])}
        onExitRole={vi.fn()}
      />,
    );
    const priorityActions = within(
      screen.getByRole("region", { name: "Priority actions" }),
    );
    const link = priorityActions
      .getByText("Artist guidance is outdated")
      .closest("a");
    expect(link).toHaveAttribute(
      "href",
      "/artist/tasks/44444444-4444-4444-4444-444444444444",
    );
  });

  it("shows an honest no-priority-actions state without hiding overview or Tasks access", () => {
    render(
      <ArtistWorkspacePage
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
    render(
      <ArtistWorkspacePage inbox={buildInbox(items)} onExitRole={vi.fn()} />,
    );
    expect(screen.getByText("Important Tasks")).toBeVisible();
    expect(screen.getByText("Task 0")).toBeVisible();
    expect(screen.getByText("Task 1")).toBeVisible();
    expect(screen.getByText("Task 2")).toBeVisible();
    expect(screen.queryByText("Task 5")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "View all Tasks →" }),
    ).toHaveAttribute("href", "/artist/tasks");
  });

  it("links Priority actions' Review Inbox action into /artist/inbox", () => {
    render(
      <ArtistWorkspacePage
        inbox={buildInbox([buildItem()])}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("link", { name: "Go to Review Inbox →" }),
    ).toHaveAttribute("href", "/artist/inbox");
  });

  it("does not fabricate a task_name or supervisor-only Task label as Priority action text", () => {
    render(
      <ArtistWorkspacePage
        inbox={buildInbox([buildItem({ task_id: "t1" })])}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.queryByText(/supervisor clarification pending/i),
    ).not.toBeInTheDocument();
  });

  it("wires Exit role view to the provided callback", async () => {
    const onExitRole = vi.fn();
    render(
      <ArtistWorkspacePage
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
