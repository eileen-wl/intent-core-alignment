import type {
  AnchorContextSummaryRead,
  ArtistInboxItemRead,
  ArtistInboxRead,
} from "@intent-core/contracts";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ArtistWorkspacePage } from "./ArtistWorkspacePage";

afterEach(cleanup);

function item(
  id: string,
  focusType: ArtistInboxItemRead["current_focus"]["focus_type"] = "none",
): ArtistInboxItemRead {
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
      focus_type: focusType,
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

  it("shows an honest empty state when nothing is ready, and still counts Waiting", () => {
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
    const current = screen.getByRole("region", { name: "Current work" });
    expect(
      within(current).getByText("Nothing is ready to work on right now"),
    ).toBeVisible();
    expect(
      screen.queryByRole("region", { name: "Up next" }),
    ).not.toBeInTheDocument();
    // Waiting Tasks are never individually enumerated -- only counted.
    expect(screen.queryByText("Shot unready")).not.toBeInTheDocument();
    const workState = within(
      screen.getByRole("region", { name: "Work state" }),
    );
    expect(
      workState.getByText("Waiting upstream").closest("div"),
    ).toHaveTextContent("1");
  });

  it("uses the same Why/How/What-to-do-now presentation for exactly one ready Task", () => {
    render(
      <ArtistWorkspacePage
        inbox={inbox([item("one")])}
        readyTasks={{
          items: [summary("one", "ready_to_work")],
          total_count: 1,
          limit: 5,
        }}
        waitingTasks={{ items: [], total_count: 0, limit: 5 }}
      />,
    );
    const current = within(
      screen.getByRole("region", { name: "Current work" }),
    );
    expect(current.getByText(/Why —/)).toBeVisible();
    expect(current.getByText(/How —/)).toBeVisible();
    expect(current.getByText(/What to do now —/)).toBeVisible();
    expect(current.getByText("Open Current Version →")).toBeVisible();
    expect(
      screen.queryByRole("region", { name: "Up next" }),
    ).not.toBeInTheDocument();
  });

  it("uses the identical Current Work presentation and enforces the ceiling when multiple Tasks are ready", () => {
    const items = Array.from({ length: 4 }, (_, index) => item(`r${index}`));
    render(
      <ArtistWorkspacePage
        inbox={inbox(items)}
        readyTasks={{
          items: items.map((row) => summary(row.task_id, "ready_to_work")),
          total_count: 4,
          limit: 5,
        }}
        waitingTasks={{ items: [], total_count: 0, limit: 5 }}
      />,
    );

    // Same Why/How/What-to-do-now presentation as the single-ready case
    // -- not a different layout.
    const current = within(
      screen.getByRole("region", { name: "Current work" }),
    );
    expect(current.getByText(/Why —/)).toBeVisible();
    expect(current.getByText(/How —/)).toBeVisible();
    expect(current.getByText(/What to do now —/)).toBeVisible();

    const upNext = screen.getByRole("region", { name: "Up next" });
    const upNextItems = within(upNext).getAllByRole("listitem");
    expect(upNextItems).toHaveLength(2);
    expect(within(upNext).getByText("Compositing r1")).toBeVisible();
    expect(within(upNext).getByText("Compositing r2")).toBeVisible();
    expect(
      within(upNext).queryByText("Compositing r3"),
    ).not.toBeInTheDocument();
  });

  it("strips internal generator/source labels and keeps only the direction's own first clause", () => {
    render(
      <ArtistWorkspacePage
        inbox={inbox([item("one")])}
        readyTasks={{
          items: [
            {
              ...summary("one", "ready_to_work"),
              core_direction:
                "[Core Agent draft - deterministic placeholder, review required] Keep the confrontation restrained. A longer explanation of local department nuance follows here.",
              execution_direction:
                "[CG Agent execution anchor draft - deterministic placeholder, review required] Keep faces readable without a heroic lift. Stronger bloom and brighter particles are each locally defensible refinements.",
            },
          ],
          total_count: 1,
          limit: 5,
        }}
        waitingTasks={{ items: [], total_count: 0, limit: 5 }}
      />,
    );
    const current = within(
      screen.getByRole("region", { name: "Current work" }),
    );
    expect(
      screen.queryByText(/deterministic placeholder/),
    ).not.toBeInTheDocument();
    expect(
      current.getByText(/Keep the confrontation restrained\./),
    ).toBeVisible();
    expect(
      screen.queryByText(/local department nuance/),
    ).not.toBeInTheDocument();
    expect(
      current.getByText(/Keep faces readable without a heroic lift\./),
    ).toBeVisible();
    expect(
      screen.queryByText(/locally defensible refinements/),
    ).not.toBeInTheDocument();
  });

  it("cleans up an orphaned punctuation artifact left behind by generator-label stripping", () => {
    render(
      <ArtistWorkspacePage
        inbox={inbox([item("one")])}
        readyTasks={{
          items: [
            {
              ...summary("one", "ready_to_work"),
              execution_direction:
                'Avoid heroic spectacle." [CG Agent execution anchor draft - D1 combined-intensity ceiling translation].',
            },
          ],
          total_count: 1,
          limit: 5,
        }}
        waitingTasks={{ items: [], total_count: 0, limit: 5 }}
      />,
    );
    const current = within(
      screen.getByRole("region", { name: "Current work" }),
    );
    expect(screen.queryByText(/\.\s+\./)).not.toBeInTheDocument();
    expect(current.getByText(/Avoid heroic spectacle\./)).toBeVisible();
  });

  it("does not claim an unsupported 'what changed' capability in the header", () => {
    render(
      <ArtistWorkspacePage
        inbox={inbox([item("one")])}
        readyTasks={{ items: [], total_count: 0, limit: 5 }}
        waitingTasks={{ items: [], total_count: 0, limit: 5 }}
      />,
    );
    expect(screen.queryByText(/what changed/i)).not.toBeInTheDocument();
  });

  it("shows a compact, non-imperative state signal for each Up Next Task instead of the imperative next-action title", () => {
    render(
      <ArtistWorkspacePage
        inbox={inbox([
          item("r0"),
          item("r1", "guidance_available"),
          item("r2", "dependency_needs_attention"),
        ])}
        readyTasks={{
          items: [
            summary("r0", "ready_to_work"),
            summary("r1", "ready_to_work"),
            summary("r2", "ready_to_work"),
          ],
          total_count: 3,
          limit: 5,
        }}
        waitingTasks={{ items: [], total_count: 0, limit: 5 }}
      />,
    );
    const upNext = screen.getByRole("region", { name: "Up next" });
    expect(within(upNext).getByText("Guidance available")).toBeVisible();
    expect(within(upNext).getByText("Open dependency")).toBeVisible();
    expect(
      within(upNext).queryByText("Continue within current Guidance"),
    ).not.toBeInTheDocument();
  });

  it("falls back to the real 'Ready to work' state, never a false 'No open signal', when current focus is none", () => {
    render(
      <ArtistWorkspacePage
        inbox={inbox([item("r0"), item("r1"), item("r2")])}
        readyTasks={{
          items: [
            summary("r0", "ready_to_work"),
            summary("r1", "ready_to_work"),
            summary("r2", "ready_to_work"),
          ],
          total_count: 3,
          limit: 5,
        }}
        waitingTasks={{ items: [], total_count: 0, limit: 5 }}
      />,
    );
    const upNext = screen.getByRole("region", { name: "Up next" });
    expect(within(upNext).getAllByText("Ready to work")).toHaveLength(2);
    expect(
      within(upNext).queryByText("No open signal"),
    ).not.toBeInTheDocument();
  });

  it("visually splits primary role-state metrics from supporting metrics without dropping any aggregate fact", () => {
    render(
      <ArtistWorkspacePage
        inbox={inbox([
          item("ready", "guidance_available"),
          item("waiting", "review_note_needs_response"),
        ])}
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
    const workState = within(
      screen.getByRole("region", { name: "Work state" }),
    );
    expect(workState.getByText("Ready to work")).toBeVisible();
    expect(workState.getByText("Waiting upstream")).toBeVisible();
    expect(workState.getByText(/New or updated guidance/)).toBeVisible();
    expect(workState.getByText(/Feedback requiring response/)).toBeVisible();
    expect(workState.getByText(/Blocked Tasks/)).toBeVisible();
  });

  it("keeps the Work state counts and routes present", () => {
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
    const workState = within(
      screen.getByRole("region", { name: "Work state" }),
    );
    expect(
      workState.getByText("Ready to work").closest("div"),
    ).toHaveTextContent("1");
    expect(
      workState.getByText("Waiting upstream").closest("div"),
    ).toHaveTextContent("1");
    expect(
      screen.getByRole("link", { name: "View all Tasks →" }),
    ).toHaveAttribute("href", "/artist/tasks");
    expect(
      screen.getByRole("link", { name: "Go to Review Inbox →" }),
    ).toHaveAttribute("href", "/artist/inbox");
  });
});
