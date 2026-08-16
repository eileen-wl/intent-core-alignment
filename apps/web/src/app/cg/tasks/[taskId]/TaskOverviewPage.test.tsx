import type {
  AnchorContextRead,
  CgInboxItemRead,
} from "@intent-core/contracts";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import type { TaskOverviewData } from "@/features/cg/task-overview/data";
import { TaskOverviewPage } from "./TaskOverviewPage";

afterEach(() => {
  cleanup();
});

function item(overrides: Partial<CgInboxItemRead> = {}): CgInboxItemRead {
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

function data(overrides: Partial<TaskOverviewData> = {}): TaskOverviewData {
  return {
    item: item(),
    coreAnchorSummary: null,
    confirmedExecutionAnchorRevision: null,
    executionAnchorDecisions: [],
    dependencies: [],
    recentActivity: [],
    latestReviewNote: null,
    workingDirection: { title: "Current Execution Direction", items: [] },
    ...overrides,
  };
}

function cgAnchorContext(): AnchorContextRead {
  return {
    role: "cg_supervisor",
    shot_id: "s1",
    task_id: "t1",
    core_anchor: {
      exists: true,
      lifecycle_state: "confirmed",
      confirmed_revision_id: "ca1",
      confirmed_revision_number: 1,
      direction_summary: "Keep the confrontation restrained.",
      must_preserve: "Keep the response internal.",
      allowed_variation: "Local exposure may vary.",
      confirmed_by_human_role: "vfx_supervisor",
      confirmed_by_actor_id: "vfx-1",
      link_target: "/vfx/shots/s1/intent",
      newer_draft_exists: true,
      pending_human_gate_exists: true,
      draft_revision_number: 2,
    },
    execution_anchor: {
      exists: true,
      department: "lighting",
      lifecycle_state: "confirmed",
      context_state: "current",
      confirmed_revision_id: "ea1",
      confirmed_revision_number: 1,
      direction_summary: "Keep faces readable without a heroic lift.",
      execution_boundary: "Stay within the approved exposure range.",
      allowed_refinement: "Refine local fill only.",
      based_on_core_anchor_revision_id: "ca1",
      based_on_core_anchor_revision_number: 1,
      upstream_relationship_available: true,
      confirmed_by_human_role: "cg_supervisor",
      confirmed_by_actor_id: "cg-1",
      link_target: "/cg/tasks/t1/execution",
      draft_revision_number: null,
      draft_source: null,
    },
    attention: {
      level: "high",
      summary: "VFX review is warranted for the newer intent draft.",
      review_requirement: "Human VFX review is required.",
      source_assessment_id: null,
      source_signal_id: null,
      assessed_at: null,
      link_target: null,
    },
    current_version: {
      version_id: null,
      name: null,
      version_number: null,
      link_target: "/cg/tasks/t1/version-review",
    },
    guidance_state: "unavailable",
    open_vfx_escalation: false,
    next_action: {
      title: "No immediate CG action",
      why_now: "No action is assigned to CG while VFX review remains pending.",
      downstream_effect: "VFX review may update shared direction.",
      target_route: "/cg/tasks/t1",
      action_label: null,
      executable: false,
    },
  };
}

describe("TaskOverviewPage -- Step 9B-1 Detailed context disclosure", () => {
  it("collapses the pre-existing detailed context by default, without deleting it", async () => {
    render(
      <TaskOverviewPage
        taskId="t1"
        data={data({
          coreAnchorSummary: "A restrained dusk confrontation.",
        })}
      />,
    );
    const summary = screen.getByText("Detailed context");
    expect(summary.closest("details")).not.toHaveAttribute("open");
    expect(screen.getByText("Latest Production Version")).toBeInTheDocument();
    expect(
      screen.getByText("No dependencies have been recorded for this Task yet."),
    ).toBeInTheDocument();
    await userEvent.click(summary);
    expect(summary.closest("details")).toHaveAttribute("open");
    expect(screen.getByText("Latest Production Version")).toBeVisible();
    expect(
      screen.getByText("No dependencies have been recorded for this Task yet."),
    ).toBeVisible();
  });
});

describe("TaskOverviewPage", () => {
  it("shows an honest unavailable state when the page-specific data failed to load", () => {
    render(<TaskOverviewPage taskId="t1" data={null} anchorContext={null} />);
    expect(screen.getByText("This page is unavailable")).toBeVisible();
  });

  it("renders exactly one Current focus with its real primary action", () => {
    render(<TaskOverviewPage taskId="t1" data={data()} />);
    expect(
      screen.getByText("Execution Anchor draft awaiting your confirmation"),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Review and confirm" }),
    ).toHaveAttribute("href", "/cg/tasks/t1/execution");
  });

  it("suppresses its own stale 'nothing requires attention' focus card when Anchor Context already covers pending upstream VFX review (the persistent Task layout's AnchorContextLayer owns that readiness statement)", () => {
    render(
      <TaskOverviewPage
        taskId="t1"
        data={data({
          item: item({
            execution_anchor_state: "confirmed",
            current_focus: {
              focus_type: "none",
              title: "Nothing requires your attention on this Task right now",
              explanation:
                "Nothing requires your attention on this Task right now.",
              target_route: "/cg/tasks/t1",
              primary_action_label: null,
              actionable: false,
            },
          }),
        })}
        anchorContext={cgAnchorContext()}
      />,
    );

    expect(
      screen.queryByText(
        "Nothing requires your attention on this Task right now",
      ),
    ).not.toBeInTheDocument();
  });

  it("does not duplicate Core Anchor content below the Anchor briefing", () => {
    render(
      <TaskOverviewPage
        taskId="t1"
        data={data({ coreAnchorSummary: "A restrained dusk confrontation." })}
      />,
    );
    expect(
      screen.queryByText("Confirmed Core Anchor (read-only)"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /confirm/i }),
    ).not.toBeInTheDocument();
  });

  it("keeps CG operational context below the Anchor briefing when execution is not confirmed", () => {
    render(
      <TaskOverviewPage
        taskId="t1"
        data={data()}
        anchorContext={cgAnchorContext()}
      />,
    );
    expect(screen.getByText("Execution operations")).toBeVisible();
    expect(
      screen.getByText(
        "No confirmed Execution Anchor production-ready criteria are recorded yet.",
      ),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Establish the Execution Anchor →" }),
    ).toHaveAttribute("href", "/cg/tasks/t1/execution");
    expect(screen.getByText("Detailed context")).toBeInTheDocument();
  });

  it("does not render its own second missing-direction summary when Anchor Context is absent (the persistent Task layout's AnchorContextLayer owns that honest-unavailable state)", () => {
    render(<TaskOverviewPage taskId="t1" data={data()} />);
    expect(
      screen.queryByText("No Core Anchor is confirmed for this Shot yet."),
    ).not.toBeInTheDocument();
  });

  it("renders the Current Execution Direction section with real authority badges when workingDirection has items", () => {
    render(
      <TaskOverviewPage
        taskId="t1"
        data={data({
          workingDirection: {
            title: "Current Execution Direction",
            items: [
              {
                id: "task-goal",
                label: "What this Task must achieve",
                value: "24fps, no motion blur.",
                authority: "human-confirmed",
                sourceType: "execution_anchor_revision",
                detail: "Confirmed by CG Supervisor",
                href: "/cg/tasks/t1/execution",
              },
            ],
          },
        })}
      />,
    );
    expect(screen.getByText("Current Execution Direction")).toBeVisible();
    expect(screen.getByText("24fps, no motion blur.")).toBeVisible();
    expect(screen.getByText("24fps, no motion blur.").closest("a")).toBeNull();
    expect(screen.getByRole("link", { name: "View details" })).toHaveAttribute(
      "href",
      "/cg/tasks/t1/execution",
    );
    expect(screen.getByText("Human-confirmed")).toBeVisible();
  });

  it("renders nothing extra when workingDirection has no items (honest empty state)", () => {
    render(<TaskOverviewPage taskId="t1" data={data()} />);
    expect(
      screen.queryByText("Current Execution Direction"),
    ).not.toBeInTheDocument();
  });

  it("shows an honest empty Activity state for a genuinely bare Task", async () => {
    render(<TaskOverviewPage taskId="t1" data={data()} />);
    await userEvent.click(screen.getByText("Detailed context"));
    expect(
      screen.getByText("No recorded activity exists for this Task yet."),
    ).toBeVisible();
  });
});
