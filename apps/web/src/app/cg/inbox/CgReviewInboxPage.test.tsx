import type { CgInboxItemRead, CgInboxRead } from "@intent-core/contracts";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CgReviewInboxPage } from "./CgReviewInboxPage";

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
      explanation:
        "A proposed department execution translation is ready for your review.",
      target_route: "/cg/tasks/t1/execution",
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
    current_focus: {
      focus_type: "none",
      title: "Nothing requires your attention on this Task right now",
      explanation: "Nothing requires your attention on this Task right now.",
      target_route: "/cg/tasks/t2",
      primary_action_label: null,
      actionable: false,
    },
    ...overrides,
  });
}

function buildInbox(items: CgInboxItemRead[]): CgInboxRead {
  return { items, generated_at: "2026-01-01T00:00:00Z" };
}

describe("CgReviewInboxPage", () => {
  it("shows an honest error state when the Inbox failed to load", () => {
    render(<CgReviewInboxPage inbox={null} />);
    expect(screen.getByText("Review Inbox is unavailable")).toBeVisible();
  });

  it("shows an honest clear-inbox empty state when no work items exist, with a route to Tasks", () => {
    render(
      <CgReviewInboxPage
        inbox={buildInbox([inactiveItem({ task_id: "t2" })])}
      />,
    );
    expect(screen.getByText("Review Inbox is clear")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Browse Tasks →" }),
    ).toHaveAttribute("href", "/cg/tasks");
  });

  it("only actionable work items appear, with the required action as the primary title", () => {
    render(
      <CgReviewInboxPage
        inbox={buildInbox([
          buildItem({ task_id: "t1" }),
          inactiveItem({ task_id: "t2" }),
        ])}
      />,
    );
    expect(screen.getByText("Showing 1 items requiring review")).toBeVisible();
    expect(
      screen.getByText("Execution Anchor draft awaiting your confirmation"),
    ).toBeVisible();
  });

  it("routes Execution work to the real Execution route", () => {
    render(
      <CgReviewInboxPage inbox={buildInbox([buildItem({ task_id: "t1" })])} />,
    );
    expect(
      screen
        .getByText("Execution Anchor draft awaiting your confirmation")
        .closest("a"),
    ).toHaveAttribute("href", "/cg/tasks/t1/execution");
  });

  it("routes dependency work to the real Dependencies route", () => {
    render(
      <CgReviewInboxPage
        inbox={buildInbox([
          buildItem({
            task_id: "t1",
            current_focus: {
              focus_type: "dependency_needs_attention",
              title: "An unresolved dependency needs your interpretation",
              explanation:
                "A real recorded dependency or cross-role conflict is still open.",
              target_route: "/cg/tasks/t1/dependencies",
              primary_action_label: "Review dependencies",
              actionable: true,
            },
          }),
        ])}
      />,
    );
    expect(
      screen
        .getByText("An unresolved dependency needs your interpretation")
        .closest("a"),
    ).toHaveAttribute("href", "/cg/tasks/t1/dependencies");
  });

  it("routes version review work to the real Version Review route", () => {
    render(
      <CgReviewInboxPage
        inbox={buildInbox([
          buildItem({
            task_id: "t1",
            current_focus: {
              focus_type: "version_review_available",
              title: "A Production Version is ready for CG review",
              explanation: "No CG Supervisor review has been recorded yet.",
              target_route: "/cg/tasks/t1/version-review",
              primary_action_label: "Review version",
              actionable: true,
            },
          }),
        ])}
      />,
    );
    expect(
      screen
        .getByText("A Production Version is ready for CG review")
        .closest("a"),
    ).toHaveAttribute("href", "/cg/tasks/t1/version-review");
  });

  it("groups work items under their own honest category as a heading", () => {
    render(
      <CgReviewInboxPage
        inbox={buildInbox([
          buildItem({ task_id: "t1" }),
          buildItem({
            task_id: "t2",
            current_focus: {
              focus_type: "dependency_needs_attention",
              title: "An unresolved dependency needs your interpretation",
              explanation: "explanation",
              target_route: "/cg/tasks/t2/dependencies",
              primary_action_label: "Review dependencies",
              actionable: true,
            },
          }),
        ])}
      />,
    );
    expect(
      screen.getByRole("heading", {
        name: "Execution Anchor confirmation — 1 item",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", {
        name: "Dependency review — 1 item",
      }),
    ).toBeVisible();
  });

  it("always shows the Project filter, even when every work item shares one Project", () => {
    render(
      <CgReviewInboxPage inbox={buildInbox([buildItem({ task_id: "t1" })])} />,
    );
    expect(
      screen.getByRole("combobox", { name: "Project" }),
    ).toBeInTheDocument();
  });

  it("always shows the Execution Anchor state filter", () => {
    render(
      <CgReviewInboxPage inbox={buildInbox([buildItem({ task_id: "t1" })])} />,
    );
    expect(
      screen.getByRole("combobox", { name: "Execution Anchor state" }),
    ).toBeInTheDocument();
  });

  it("filters work items to the selected Execution Anchor state", () => {
    render(
      <CgReviewInboxPage
        inbox={buildInbox([
          buildItem({ task_id: "t1", execution_anchor_state: "confirmed" }),
          buildItem({
            task_id: "t2",
            execution_anchor_state: "draft_pending",
            current_focus: {
              focus_type: "execution_anchor_draft_needs_review",
              title: "Execution Anchor draft in progress",
              explanation: "explanation",
              target_route: "/cg/tasks/t2/execution",
              primary_action_label: "Review draft",
              actionable: true,
            },
          }),
        ])}
      />,
    );
    expect(screen.getByText("Showing 2 items requiring review")).toBeVisible();

    fireEvent.change(
      screen.getByRole("combobox", { name: "Execution Anchor state" }),
      { target: { value: "confirmed" } },
    );

    expect(screen.getByText("Showing 1 items requiring review")).toBeVisible();
    expect(
      screen.getByText("Execution Anchor draft awaiting your confirmation"),
    ).toBeVisible();
  });

  it("shows a Department filter only when a Department is present, and filters by it", () => {
    render(
      <CgReviewInboxPage
        inbox={buildInbox([
          buildItem({
            task_id: "t1",
            department: "lighting",
            project_id: "p1",
            project_name: "Alpha",
          }),
          buildItem({
            task_id: "t2",
            department: "animation",
            project_id: "p1",
            project_name: "Alpha",
            current_focus: {
              focus_type: "dependency_needs_attention",
              title: "An unresolved dependency needs your interpretation",
              explanation: "explanation",
              target_route: "/cg/tasks/t2/dependencies",
              primary_action_label: "Review dependencies",
              actionable: true,
            },
          }),
        ])}
      />,
    );
    expect(screen.getByText("Showing 2 items requiring review")).toBeVisible();

    fireEvent.change(screen.getByRole("combobox", { name: "Department" }), {
      target: { value: "lighting" },
    });

    expect(screen.getByText("Showing 1 items requiring review")).toBeVisible();
  });

  it("does not show a Department filter when no work item has one", () => {
    render(
      <CgReviewInboxPage
        inbox={buildInbox([buildItem({ task_id: "t1", department: null })])}
      />,
    );
    expect(
      screen.queryByRole("combobox", { name: "Department" }),
    ).not.toBeInTheDocument();
  });

  it("shows the item's own real action label instead of the generic fallback when no Anchor Context hint is available (Worklist family migration)", () => {
    render(
      <CgReviewInboxPage inbox={buildInbox([buildItem({ task_id: "t1" })])} />,
    );
    expect(screen.getByText(/Review and confirm/)).toBeVisible();
    expect(screen.queryByText(/Review item →/)).not.toBeInTheDocument();
  });

  it("shows a real, object-specific Execution Anchor status badge on the row, matching the locked VFX row's own object-specific wording", () => {
    render(
      <CgReviewInboxPage
        inbox={buildInbox([
          buildItem({ task_id: "t1", execution_anchor_state: "draft_pending" }),
        ])}
      />,
    );
    expect(screen.getByText("Execution Anchor draft pending")).toBeVisible();
  });

  it("shows the real dependency count, not the Execution Anchor badge, on a Dependency review row (semantic-status correction)", () => {
    render(
      <CgReviewInboxPage
        inbox={buildInbox([
          buildItem({
            task_id: "t1",
            execution_anchor_state: "confirmed",
            open_dependency_count: 2,
            current_focus: {
              focus_type: "dependency_needs_attention",
              title: "An unresolved dependency needs your interpretation",
              explanation: "explanation",
              target_route: "/cg/tasks/t1/dependencies",
              primary_action_label: "Review dependencies",
              actionable: true,
            },
          }),
        ])}
      />,
    );
    const row = screen
      .getByText("An unresolved dependency needs your interpretation")
      .closest("a") as HTMLElement;
    expect(within(row).getByText("2 open dependencies")).toBeVisible();
    expect(within(row).queryByText(/Execution Anchor/)).not.toBeInTheDocument();
  });

  it("shows no status element at all on a Version review row, since Execution Anchor state is always confirmed for this category and would be redundant on every row", () => {
    render(
      <CgReviewInboxPage
        inbox={buildInbox([
          buildItem({
            task_id: "t1",
            execution_anchor_state: "confirmed",
            current_focus: {
              focus_type: "version_review_available",
              title: "A Production Version is ready for CG review",
              explanation: "No CG Supervisor review has been recorded yet.",
              target_route: "/cg/tasks/t1/version-review",
              primary_action_label: "Review version",
              actionable: true,
            },
          }),
        ])}
      />,
    );
    const row = screen
      .getByText("A Production Version is ready for CG review")
      .closest("a") as HTMLElement;
    expect(within(row).queryByText(/Execution Anchor/)).not.toBeInTheDocument();
    expect(within(row).queryByText(/open dependenc/)).not.toBeInTheDocument();
  });

  it("shows one compact production-context rail (Project · Shot · Task) without a repeated PRODUCTION CONTEXT label prefix", () => {
    render(
      <CgReviewInboxPage inbox={buildInbox([buildItem({ task_id: "t1" })])} />,
    );
    expect(
      screen.getByText("D1 Demo Project · Shot 010 · Lighting Pass (lighting)"),
    ).toBeVisible();
    expect(screen.queryByText(/PRODUCTION CONTEXT/i)).not.toBeInTheDocument();
  });

  it("shows a semantic type icon at the group heading for a recognized category, matching the locked VFX Review Inbox's own group-heading grammar", () => {
    render(
      <CgReviewInboxPage inbox={buildInbox([buildItem({ task_id: "t1" })])} />,
    );
    const heading = screen.getByRole("heading", {
      name: /Execution Anchor confirmation/,
    });
    expect(heading.querySelector("svg")).toBeTruthy();
  });

  it("shows the current worklist count before the filter controls, matching the locked VFX Review Inbox's own page rhythm", () => {
    render(
      <CgReviewInboxPage inbox={buildInbox([buildItem({ task_id: "t1" })])} />,
    );
    const count = screen.getByText("Showing 1 items requiring review");
    const filters = screen.getByRole("combobox", { name: "Project" });
    expect(
      count.compareDocumentPosition(filters) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("filters work items to the selected Project", () => {
    render(
      <CgReviewInboxPage
        inbox={buildInbox([
          buildItem({ task_id: "t1", project_id: "p1", project_name: "Alpha" }),
          buildItem({ task_id: "t2", project_id: "p2", project_name: "Beta" }),
        ])}
      />,
    );
    expect(screen.getByText("Showing 2 items requiring review")).toBeVisible();

    fireEvent.change(screen.getByRole("combobox", { name: "Project" }), {
      target: { value: "Alpha" },
    });

    expect(screen.getByText("Showing 1 items requiring review")).toBeVisible();
  });
});
