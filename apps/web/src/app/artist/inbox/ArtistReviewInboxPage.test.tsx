import type {
  ArtistInboxItemRead,
  ArtistInboxRead,
} from "@intent-core/contracts";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

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
  it("shows an honest error state when the Inbox failed to load", () => {
    render(<ArtistReviewInboxPage inbox={null} />);
    expect(screen.getByText("Review Inbox is unavailable")).toBeVisible();
  });

  it("shows an honest clear-inbox empty state when no work items exist, with a route to Tasks", () => {
    render(
      <ArtistReviewInboxPage
        inbox={buildInbox([inactiveItem({ task_id: "t2" })])}
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
      />,
    );
    expect(screen.getByText("Showing 1 items requiring review")).toBeVisible();
    expect(screen.getByText("Artist guidance is outdated")).toBeVisible();
  });

  it("routes guidance work to the real Task Overview route", () => {
    render(
      <ArtistReviewInboxPage
        inbox={buildInbox([buildItem({ task_id: "t1" })])}
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
              primary_action_label: "Read feedback",
              actionable: true,
            },
          }),
        ])}
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
      />,
    );
    expect(
      screen
        .getByText("An unresolved dependency needs your attention")
        .closest("a"),
    ).toHaveAttribute("href", "/artist/tasks/t1");
  });

  it("groups work items under their own honest category as a heading", () => {
    render(
      <ArtistReviewInboxPage
        inbox={buildInbox([
          buildItem({ task_id: "t1" }),
          buildItem({
            task_id: "t2",
            current_focus: {
              focus_type: "review_note_needs_response",
              title: "A Review Note is awaiting your response",
              explanation: "explanation",
              target_route: "/artist/tasks/t2/current-version",
              primary_action_label: "Read feedback",
              actionable: true,
            },
          }),
        ])}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Guidance update — 1 item" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Feedback — 1 item" }),
    ).toBeVisible();
  });

  it("groups Guidance available and Dependency review alongside Guidance update and Feedback in one multi-group Inbox (Worklist family migration real-state coverage)", () => {
    render(
      <ArtistReviewInboxPage
        inbox={buildInbox([
          buildItem({ task_id: "t1" }),
          buildItem({
            task_id: "t2",
            current_focus: {
              focus_type: "review_note_needs_response",
              title: "A Review Note is awaiting your response",
              explanation: "explanation",
              target_route: "/artist/tasks/t2/current-version",
              primary_action_label: "Read feedback",
              actionable: true,
            },
          }),
          buildItem({
            task_id: "t3",
            current_focus: {
              focus_type: "guidance_available",
              title: "New Artist guidance is ready",
              explanation: "explanation",
              target_route: "/artist/tasks/t3/current-version",
              primary_action_label: "Open Current Version",
              actionable: true,
            },
          }),
          buildItem({
            task_id: "t4",
            current_focus: {
              focus_type: "dependency_needs_attention",
              title: "An unresolved dependency needs your attention",
              explanation: "explanation",
              target_route: "/artist/tasks/t4",
              primary_action_label: "Review Task",
              actionable: true,
            },
          }),
        ])}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Guidance update — 1 item" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Feedback — 1 item" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Guidance available — 1 item" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Dependency review — 1 item" }),
    ).toBeVisible();
  });

  it("shows the item's own real action label instead of the generic fallback when no Anchor Context hint is available (Worklist family migration)", () => {
    render(
      <ArtistReviewInboxPage
        inbox={buildInbox([buildItem({ task_id: "t1" })])}
      />,
    );
    expect(screen.getByText(/Review Task/)).toBeVisible();
    expect(screen.queryByText(/Review item →/)).not.toBeInTheDocument();
  });

  it("shows a real, object-specific Guidance status badge on the row, matching the locked VFX row's own object-specific wording", () => {
    render(
      <ArtistReviewInboxPage
        inbox={buildInbox([
          buildItem({ task_id: "t1", guidance_state: "outdated" }),
        ])}
      />,
    );
    const row = screen
      .getByText("Artist guidance is outdated")
      .closest("a") as HTMLElement;
    expect(within(row).getByText("Guidance outdated")).toBeVisible();
  });

  it("also shows the real Guidance status badge on a Guidance available row (semantic-status correction: Guidance categories keep the badge)", () => {
    render(
      <ArtistReviewInboxPage
        inbox={buildInbox([
          buildItem({
            task_id: "t1",
            guidance_state: "none",
            current_focus: {
              focus_type: "guidance_available",
              title: "Artist guidance can be generated for this Task",
              explanation: "explanation",
              target_route: "/artist/tasks/t1",
              primary_action_label: "Generate guidance",
              actionable: true,
            },
          }),
        ])}
      />,
    );
    const row = screen
      .getByText("Artist guidance can be generated for this Task")
      .closest("a") as HTMLElement;
    expect(within(row).getByText("No guidance yet")).toBeVisible();
  });

  it("shows the real review-note fact, not the Guidance badge, on a Feedback row (semantic-status correction)", () => {
    render(
      <ArtistReviewInboxPage
        inbox={buildInbox([
          buildItem({
            task_id: "t1",
            guidance_state: "none",
            open_review_note_count: 1,
            current_focus: {
              focus_type: "review_note_needs_response",
              title: "A Review Note is awaiting your response",
              explanation: "explanation",
              target_route: "/artist/tasks/t1/current-version",
              primary_action_label: "Read feedback",
              actionable: true,
            },
          }),
        ])}
      />,
    );
    const row = screen
      .getByText("A Review Note is awaiting your response")
      .closest("a") as HTMLElement;
    expect(within(row).getByText("1 Review Note recorded")).toBeVisible();
    expect(within(row).queryByText(/Guidance/)).not.toBeInTheDocument();
  });

  it("shows the real dependency count, not the Guidance badge, on a Dependency review row (semantic-status correction)", () => {
    render(
      <ArtistReviewInboxPage
        inbox={buildInbox([
          buildItem({
            task_id: "t1",
            guidance_state: "none",
            open_dependency_count: 3,
            current_focus: {
              focus_type: "dependency_needs_attention",
              title: "An unresolved dependency needs your attention",
              explanation: "explanation",
              target_route: "/artist/tasks/t1",
              primary_action_label: "Review Task",
              actionable: true,
            },
          }),
        ])}
      />,
    );
    const row = screen
      .getByText("An unresolved dependency needs your attention")
      .closest("a") as HTMLElement;
    expect(within(row).getByText("3 open dependencies")).toBeVisible();
    expect(within(row).queryByText(/Guidance/)).not.toBeInTheDocument();
  });

  it("shows one compact production-context rail (Project · Shot · Task) without a repeated PRODUCTION CONTEXT label prefix", () => {
    render(
      <ArtistReviewInboxPage
        inbox={buildInbox([buildItem({ task_id: "t1" })])}
      />,
    );
    expect(
      screen.getByText(
        "D1 Demo Project · Shot 010 · Compositing Review (compositing)",
      ),
    ).toBeVisible();
    expect(screen.queryByText(/PRODUCTION CONTEXT/i)).not.toBeInTheDocument();
  });

  it("shows a semantic type icon at the group heading for a recognized category, matching the locked VFX Review Inbox's own group-heading grammar", () => {
    render(
      <ArtistReviewInboxPage
        inbox={buildInbox([
          buildItem({
            task_id: "t1",
            current_focus: {
              focus_type: "review_note_needs_response",
              title: "A Review Note is awaiting your response",
              explanation: "explanation",
              target_route: "/artist/tasks/t1/current-version",
              primary_action_label: "Read feedback",
              actionable: true,
            },
          }),
        ])}
      />,
    );
    const heading = screen.getByRole("heading", { name: /Feedback/ });
    expect(heading.querySelector("svg")).toBeTruthy();
  });

  it("shows the current worklist count before the filter controls, matching the locked VFX Review Inbox's own page rhythm", () => {
    render(
      <ArtistReviewInboxPage
        inbox={buildInbox([buildItem({ task_id: "t1" })])}
      />,
    );
    const count = screen.getByText("Showing 1 items requiring review");
    const filters = screen.getByRole("combobox", { name: "Project" });
    expect(
      count.compareDocumentPosition(filters) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("always shows the Project filter, even when every work item shares one Project", () => {
    render(
      <ArtistReviewInboxPage
        inbox={buildInbox([buildItem({ task_id: "t1" })])}
      />,
    );
    expect(
      screen.getByRole("combobox", { name: "Project" }),
    ).toBeInTheDocument();
  });

  it("always shows the Guidance state filter", () => {
    render(
      <ArtistReviewInboxPage
        inbox={buildInbox([buildItem({ task_id: "t1" })])}
      />,
    );
    expect(
      screen.getByRole("combobox", { name: "Guidance state" }),
    ).toBeInTheDocument();
  });

  it("filters work items to the selected Guidance state", () => {
    render(
      <ArtistReviewInboxPage
        inbox={buildInbox([
          buildItem({ task_id: "t1", guidance_state: "outdated" }),
          buildItem({
            task_id: "t2",
            guidance_state: "current",
            current_focus: {
              focus_type: "review_note_needs_response",
              title: "A Review Note is awaiting your response",
              explanation: "explanation",
              target_route: "/artist/tasks/t2/current-version",
              primary_action_label: "Read feedback",
              actionable: true,
            },
          }),
        ])}
      />,
    );
    expect(screen.getByText("Showing 2 items requiring review")).toBeVisible();

    fireEvent.change(screen.getByRole("combobox", { name: "Guidance state" }), {
      target: { value: "outdated" },
    });

    expect(screen.getByText("Showing 1 items requiring review")).toBeVisible();
    expect(screen.getByText("Artist guidance is outdated")).toBeVisible();
  });

  it("shows a Department filter only when a Department is present, and filters by it", () => {
    render(
      <ArtistReviewInboxPage
        inbox={buildInbox([
          buildItem({
            task_id: "t1",
            department: "compositing",
            project_id: "p1",
            project_name: "Alpha",
          }),
          buildItem({
            task_id: "t2",
            department: "lighting",
            project_id: "p1",
            project_name: "Alpha",
            current_focus: {
              focus_type: "dependency_needs_attention",
              title: "An unresolved dependency needs your attention",
              explanation: "explanation",
              target_route: "/artist/tasks/t2",
              primary_action_label: "Review Task",
              actionable: true,
            },
          }),
        ])}
      />,
    );
    expect(screen.getByText("Showing 2 items requiring review")).toBeVisible();

    fireEvent.change(screen.getByRole("combobox", { name: "Department" }), {
      target: { value: "compositing" },
    });

    expect(screen.getByText("Showing 1 items requiring review")).toBeVisible();
  });

  it("does not show a Department filter when no work item has one", () => {
    render(
      <ArtistReviewInboxPage
        inbox={buildInbox([buildItem({ task_id: "t1", department: null })])}
      />,
    );
    expect(
      screen.queryByRole("combobox", { name: "Department" }),
    ).not.toBeInTheDocument();
  });

  it("filters work items to the selected Project", () => {
    render(
      <ArtistReviewInboxPage
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
