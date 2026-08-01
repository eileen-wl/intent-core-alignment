import type { CgInboxItemRead, CgInboxRead } from "@intent-core/contracts";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
      explanation: "A proposed department execution translation is ready for your review.",
      target_route: "/cg/tasks/t1/execution",
      primary_action_label: "Review and confirm",
      actionable: true,
    },
    sort_rank: 0,
    ...overrides,
  };
}

function inactiveItem(overrides: Partial<CgInboxItemRead> = {}): CgInboxItemRead {
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
  it("marks Review Inbox current in the sidebar", () => {
    render(<CgReviewInboxPage inbox={buildInbox([])} onExitRole={vi.fn()} />);
    expect(screen.getByRole("link", { name: "Review Inbox" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("shows an honest error state when the Inbox failed to load", () => {
    render(<CgReviewInboxPage inbox={null} onExitRole={vi.fn()} />);
    expect(screen.getByText("Review Inbox is unavailable")).toBeVisible();
  });

  it("shows an honest clear-inbox empty state when no work items exist, with a route to Tasks", () => {
    render(
      <CgReviewInboxPage inbox={buildInbox([inactiveItem({ task_id: "t2" })])} onExitRole={vi.fn()} />,
    );
    expect(screen.getByText("Review Inbox is clear")).toBeVisible();
    expect(screen.getByRole("link", { name: "Browse Tasks →" })).toHaveAttribute(
      "href",
      "/cg/tasks",
    );
  });

  it("only actionable work items appear, with the required action as the primary title", () => {
    render(
      <CgReviewInboxPage
        inbox={buildInbox([buildItem({ task_id: "t1" }), inactiveItem({ task_id: "t2" })])}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText("Showing 1 items requiring review")).toBeVisible();
    expect(screen.getByText("Execution Anchor draft awaiting your confirmation")).toBeVisible();
  });

  it("routes Execution work to the real Execution route", () => {
    render(
      <CgReviewInboxPage inbox={buildInbox([buildItem({ task_id: "t1" })])} onExitRole={vi.fn()} />,
    );
    expect(
      screen.getByText("Execution Anchor draft awaiting your confirmation").closest("a"),
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
              explanation: "A real recorded dependency or cross-role conflict is still open.",
              target_route: "/cg/tasks/t1/dependencies",
              primary_action_label: "Review dependencies",
              actionable: true,
            },
          }),
        ])}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByText("An unresolved dependency needs your interpretation").closest("a"),
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
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByText("A Production Version is ready for CG review").closest("a"),
    ).toHaveAttribute("href", "/cg/tasks/t1/version-review");
  });
});
