import type {
  ArtistInboxItemRead,
  ArtistInboxRead,
} from "@intent-core/contracts";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ArtistReviewInboxPage } from "./ArtistReviewInboxPage";

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
    latest_version_id: "v1",
    latest_version_name: "v001",
    latest_version_number: 1,
    guidance_state: "outdated",
    latest_guidance_id: "g1",
    open_review_note_count: 0,
    open_dependency_count: 0,
    current_focus: {
      focus_type: "guidance_outdated",
      title: "Artist guidance is outdated",
      explanation:
        "A newer confirmed Execution Anchor exists since this guidance was generated.",
      target_route: "/artist/tasks/t1",
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
    current_focus: {
      focus_type: "none",
      title: "Nothing requires your attention on this Task right now",
      explanation: "Nothing requires your attention on this Task right now.",
      target_route: "/artist/tasks/t2",
      primary_action_label: null,
      actionable: false,
    },
    ...overrides,
  });
}

function buildInbox(items: ArtistInboxItemRead[]): ArtistInboxRead {
  return { items, generated_at: "2026-01-01T00:00:00Z" };
}

describe("ArtistReviewInboxPage", () => {
  it("marks Review Inbox current in the sidebar", () => {
    render(
      <ArtistReviewInboxPage inbox={buildInbox([])} onExitRole={vi.fn()} />,
    );
    expect(screen.getByRole("link", { name: "Review Inbox" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("shows an honest error state when the Inbox failed to load", () => {
    render(<ArtistReviewInboxPage inbox={null} onExitRole={vi.fn()} />);
    expect(screen.getByText("Review Inbox is unavailable")).toBeVisible();
  });

  it("shows an honest clear-inbox empty state when no work items exist, with a route to Tasks", () => {
    render(
      <ArtistReviewInboxPage
        inbox={buildInbox([inactiveItem({ task_id: "t2" })])}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText("Review Inbox is clear")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Browse Tasks →" }),
    ).toHaveAttribute("href", "/artist/tasks");
  });

  it("only actionable work items appear, with the required action as the primary title", () => {
    render(
      <ArtistReviewInboxPage
        inbox={buildInbox([
          buildItem({ task_id: "t1" }),
          inactiveItem({ task_id: "t2" }),
        ])}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText("Showing 1 items requiring review")).toBeVisible();
    expect(screen.getByText("Artist guidance is outdated")).toBeVisible();
  });

  it("routes guidance work to the real Task Overview route", () => {
    render(
      <ArtistReviewInboxPage
        inbox={buildInbox([buildItem({ task_id: "t1" })])}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByText("Artist guidance is outdated").closest("a"),
    ).toHaveAttribute("href", "/artist/tasks/t1");
  });

  it("routes feedback (Review Note) work to the real Current Version route", () => {
    render(
      <ArtistReviewInboxPage
        inbox={buildInbox([
          buildItem({
            task_id: "t1",
            current_focus: {
              focus_type: "review_note_needs_response",
              title: "A Review Note is awaiting your response",
              explanation:
                "A real recorded Review Note is on the latest Production Version.",
              target_route: "/artist/tasks/t1/current-version",
              primary_action_label: "Review feedback",
              actionable: true,
            },
          }),
        ])}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByText("A Review Note is awaiting your response").closest("a"),
    ).toHaveAttribute("href", "/artist/tasks/t1/current-version");
  });

  it("routes dependency work to the real Task Overview route", () => {
    render(
      <ArtistReviewInboxPage
        inbox={buildInbox([
          buildItem({
            task_id: "t1",
            current_focus: {
              focus_type: "dependency_needs_attention",
              title: "An unresolved dependency needs your attention",
              explanation:
                "A real recorded dependency or cross-role conflict is still open.",
              target_route: "/artist/tasks/t1",
              primary_action_label: "Review Task",
              actionable: true,
            },
          }),
        ])}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen
        .getByText("An unresolved dependency needs your attention")
        .closest("a"),
    ).toHaveAttribute("href", "/artist/tasks/t1");
  });
});
