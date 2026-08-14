import type {
  AnchorContextSummaryRead,
  ArtistInboxItemRead,
  ArtistInboxRead,
} from "@intent-core/contracts";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ArtistWorkspacePage } from "./ArtistWorkspacePage";

afterEach(cleanup);

function item(id: string): ArtistInboxItemRead {
  return {
    task_id: id,
    task_name: `Compositing ${id}`,
    department: "compositing",
    task_source: "manual",
    shot_id: `shot-${id}`,
    shot_name: `Shot ${id}`,
    project_id: "project-1",
    project_name: "Demo Project",
    execution_anchor_state: "confirmed",
    active_execution_anchor_revision_id: "execution-1",
    active_execution_anchor_summary: "Keep faces readable.",
    latest_version_id: "version-1",
    latest_version_name: "comp_v003",
    latest_version_number: 3,
    guidance_state: "current",
    latest_guidance_id: "guidance-1",
    open_review_note_count: 0,
    open_dependency_count: 0,
    current_focus: {
      focus_type: "none",
      title: "Nothing requires your attention on this Task right now",
      explanation: "No review action.",
      target_route: `/artist/tasks/${id}`,
      primary_action_label: null,
      actionable: false,
    },
    sort_rank: 0,
  };
}

function summary(
  id: string,
  readiness: "ready_to_work" | "waiting_upstream",
): AnchorContextSummaryRead {
  const ready = readiness === "ready_to_work";
  return {
    role: "artist",
    shot_id: `shot-${id}`,
    task_id: id,
    core_anchor_state: ready ? "confirmed" : "missing",
    core_anchor_revision_number: ready ? 1 : null,
    core_direction: ready ? "Keep the confrontation restrained." : null,
    execution_context_state: ready ? "current" : "missing",
    execution_anchor_revision_number: ready ? 2 : null,
    execution_direction: ready
      ? "Keep faces readable without a heroic lift."
      : null,
    based_on_core_anchor_revision_number: ready ? 1 : null,
    attention_level: "not_assessed",
    attention_summary: null,
    guidance_state: ready ? "current" : "missing",
    readiness_state: readiness,
    readiness_detail: ready
      ? "Confirmed direction and current Guidance are available."
      : "Core Anchor confirmation is required from the VFX Supervisor.",
    open_vfx_escalation: false,
    next_action: {
      title: ready
        ? "Continue within current Guidance"
        : "Core Anchor confirmation is required",
      why_now: ready
        ? "The Task is executable."
        : "Shared direction is missing.",
      downstream_effect: ready
        ? "The next Version stays aligned."
        : "CG must wait for VFX.",
      target_route: ready ? `/artist/tasks/${id}/current-version` : null,
      action_label: ready ? "Open Current Version" : null,
      executable: ready,
    },
  };
}

function inbox(items: ArtistInboxItemRead[]): ArtistInboxRead {
  return { items, generated_at: "2026-08-03T00:00:00Z" };
}

describe("ArtistWorkspacePage", () => {
  it("renders honest error and empty states", () => {
    const { rerender } = render(<ArtistWorkspacePage inbox={null} />);
    expect(screen.getByText("Workspace Home is unavailable")).toBeVisible();
    rerender(<ArtistWorkspacePage inbox={inbox([])} />);
    expect(screen.getByText("No Tasks exist yet")).toBeVisible();
  });

  it("separates ready work from waiting upstream and puts counts below", () => {
    render(
      <ArtistWorkspacePage
        inbox={inbox([item("ready"), item("waiting")])}
        readyTasks={{
          items: [summary("ready", "ready_to_work")],
          total_count: 1,
          limit: 5,
        }}
        waitingTasks={{
          items: [summary("waiting", "waiting_upstream")],
          total_count: 1,
          limit: 5,
        }}
      />,
    );
    const ready = screen.getByRole("region", { name: "Ready to work" });
    const waiting = screen.getByRole("region", {
      name: "Waiting for upstream direction",
    });
    const counts = screen.getByRole("region", { name: "Task overview" });
    expect(within(ready).getByText("Why")).toBeVisible();
    expect(
      within(waiting).getAllByText("Core Anchor confirmation is required")
        .length,
    ).toBeGreaterThan(0);
    expect(within(waiting).getByLabelText("Production context")).toBeVisible();
    expect(
      ready.compareDocumentPosition(counts) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("shows the large WHY HOW WHAT briefing only for exactly one proven ready Task", () => {
    const readySummary = summary("one", "ready_to_work");
    const { rerender } = render(
      <ArtistWorkspacePage
        inbox={inbox([item("one"), item("two")])}
        readyTasks={{ items: [readySummary], total_count: 1, limit: 5 }}
        waitingTasks={{ items: [], total_count: 0, limit: 5 }}
      />,
    );
    expect(screen.getByText("What to do now")).toBeVisible();

    rerender(
      <ArtistWorkspacePage
        inbox={inbox([item("one"), item("two")])}
        readyTasks={{
          items: [readySummary, summary("two", "ready_to_work")],
          total_count: 2,
          limit: 5,
        }}
        waitingTasks={{ items: [], total_count: 0, limit: 5 }}
      />,
    );
    expect(screen.queryByText("What to do now")).not.toBeInTheDocument();
    expect(
      within(
        screen.getByRole("region", { name: "Ready to work" }),
      ).getAllByRole("listitem"),
    ).toHaveLength(2);
  });

  it("never promotes a ranked but unready first Task as current direction", () => {
    render(
      <ArtistWorkspacePage
        inbox={inbox([item("unready")])}
        readyTasks={{ items: [], total_count: 0, limit: 5 }}
        waitingTasks={{
          items: [summary("unready", "waiting_upstream")],
          total_count: 1,
          limit: 5,
        }}
      />,
    );
    expect(screen.getByText("No Tasks are ready to work")).toBeVisible();
    expect(
      screen.queryByText("My current working direction"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "Nothing requires your attention on this Task right now",
      ),
    ).not.toBeInTheDocument();
  });
});
