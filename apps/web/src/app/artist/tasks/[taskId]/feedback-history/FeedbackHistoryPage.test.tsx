import type { ArtistFeedbackEventRead, ArtistInboxItemRead } from "@intent-core/contracts";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { FeedbackHistoryData } from "@/features/artist/feedback-history/data";
import { FeedbackHistoryPage } from "./FeedbackHistoryPage";

afterEach(() => {
  cleanup();
});

function item(overrides: Partial<ArtistInboxItemRead> = {}): ArtistInboxItemRead {
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
    active_execution_anchor_summary: null,
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

function event(overrides: Partial<ArtistFeedbackEventRead> = {}): ArtistFeedbackEventRead {
  return {
    id: "e1",
    event_type: "review_note_recorded",
    occurred_at: "2026-01-01T00:00:00Z",
    actor_kind: "human",
    actor_id: "cg-1",
    actor_human_role: "cg_supervisor",
    summary: "Review Note recorded on SH010_v001",
    related_entity_type: "review_note",
    related_entity_id: "n1",
    related_version_id: "v1",
    route: "/artist/tasks/t1/current-version",
    ...overrides,
  };
}

function data(overrides: Partial<FeedbackHistoryData> = {}): FeedbackHistoryData {
  return {
    item: item(),
    history: { task_id: "t1", events: [event()] },
    ...overrides,
  };
}

describe("FeedbackHistoryPage", () => {
  it("renders Project > Shot > Task > Feedback History breadcrumbs, tab active", () => {
    render(<FeedbackHistoryPage taskId="t1" data={data()} unavailable={false} onExitRole={vi.fn()} />);
    expect(screen.getByRole("link", { name: "Feedback History" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("does not appear as its own tab labeled Activity", () => {
    render(<FeedbackHistoryPage taskId="t1" data={data()} unavailable={false} onExitRole={vi.fn()} />);
    expect(screen.queryByRole("link", { name: "Activity" })).not.toBeInTheDocument();
  });

  it("shows an honest unavailable state when the API could not be reached", () => {
    render(<FeedbackHistoryPage taskId="t1" data={null} unavailable onExitRole={vi.fn()} />);
    expect(screen.getByText("This Task is unavailable")).toBeVisible();
  });

  it("shows the honest empty state when no feedback has ever been recorded", () => {
    render(
      <FeedbackHistoryPage
        taskId="t1"
        data={data({ history: { task_id: "t1", events: [] } })}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText("No feedback has been recorded for this Task yet.")).toBeVisible();
  });

  it("renders real records in the exact order the backend delivers (already newest-first)", () => {
    const events = [
      event({
        id: "e2",
        event_type: "artist_guidance_generated",
        summary: "New Artist guidance generated for SH010_v001",
        occurred_at: "2026-01-02T00:00:00Z",
      }),
      event({
        id: "e1",
        event_type: "review_note_recorded",
        summary: "A Review Note was recorded on SH010_v001",
        occurred_at: "2026-01-01T00:00:00Z",
      }),
    ];
    render(
      <FeedbackHistoryPage
        taskId="t1"
        data={data({ history: { task_id: "t1", events } })}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    const timeline = screen.getByRole("list", { name: "Task feedback history" });
    const items = within(timeline).getAllByRole("listitem");
    expect(within(items[0]).getByText("Artist guidance generated")).toBeVisible();
    expect(within(items[1]).getByText("Review Note recorded")).toBeVisible();
  });

  it("routes a Review Note event to Current Version and a dependency event to Task Overview", () => {
    render(
      <FeedbackHistoryPage
        taskId="t1"
        data={data({
          history: {
            task_id: "t1",
            events: [
              event({
                id: "n1",
                event_type: "review_note_recorded",
                summary: "Review Note recorded",
                route: "/artist/tasks/t1/current-version",
              }),
              event({
                id: "d1",
                event_type: "dependency_recorded",
                summary: "Dependency recorded",
                route: "/artist/tasks/t1",
                related_entity_type: "task_dependency",
                related_entity_id: "dep1",
                related_version_id: null,
              }),
            ],
          },
        })}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    const links = screen.getAllByRole("link", { name: "Open →" });
    expect(links[0]).toHaveAttribute("href", "/artist/tasks/t1/current-version");
    expect(links[1]).toHaveAttribute("href", "/artist/tasks/t1");
  });

  it("does not fabricate a read or resolved state anywhere on the page", () => {
    render(<FeedbackHistoryPage taskId="t1" data={data()} unavailable={false} onExitRole={vi.fn()} />);
    expect(screen.queryByText(/\bread\b/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\bresolved\b/i)).not.toBeInTheDocument();
  });
});
