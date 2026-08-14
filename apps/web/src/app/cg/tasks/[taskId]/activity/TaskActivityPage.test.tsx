import type {
  CgInboxItemRead,
  TaskActivityEventRead,
} from "@intent-core/contracts";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { TaskActivityWorkspaceData } from "@/features/cg/activity-workspace/data";
import { TaskActivityPage } from "./TaskActivityPage";

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
    execution_anchor_state: "confirmed",
    active_execution_anchor_revision_id: "r1",
    active_execution_anchor_summary: null,
    pending_human_gate_id: null,
    latest_version_id: null,
    latest_version_name: null,
    latest_version_number: null,
    open_dependency_count: 0,
    current_focus: {
      focus_type: "none",
      title: "Nothing requires your attention on this Task right now",
      explanation: "Nothing requires your attention on this Task right now.",
      target_route: "/cg/tasks/t1",
      primary_action_label: null,
      actionable: false,
    },
    sort_rank: 0,
    ...overrides,
  };
}

function event(
  overrides: Partial<TaskActivityEventRead> = {},
): TaskActivityEventRead {
  return {
    id: "e1",
    event_type: "execution_anchor_draft_created",
    occurred_at: "2026-01-01T00:00:00Z",
    actor_kind: "human",
    actor_id: "cg-1",
    actor_human_role: "cg_supervisor",
    summary: "Execution Anchor Revision 1 draft created",
    related_entity_type: "execution_anchor_revision",
    related_entity_id: "r1",
    route: "/cg/tasks/t1/execution",
    ...overrides,
  };
}

function data(
  overrides: Partial<TaskActivityWorkspaceData> = {},
): TaskActivityWorkspaceData {
  return {
    item: item(),
    activity: { task_id: "t1", events: [event()] },
    ...overrides,
  };
}

describe("TaskActivityPage", () => {
  it("shows an honest unavailable state when the page-specific data failed to load", () => {
    render(<TaskActivityPage data={null} />);
    expect(screen.getByText("This page is unavailable")).toBeVisible();
  });

  it("shows the honest empty state when no activity has ever been recorded", () => {
    render(
      <TaskActivityPage
        data={data({ activity: { task_id: "t1", events: [] } })}
      />,
    );
    expect(
      screen.getByText("No recorded activity exists for this Task yet."),
    ).toBeVisible();
  });

  it("renders real records in the exact order the backend delivers (already newest-first)", () => {
    const events = [
      event({
        id: "e2",
        event_type: "execution_anchor_confirmed",
        summary: "Revision 1 confirmed",
        occurred_at: "2026-01-02T00:00:00Z",
      }),
      event({
        id: "e1",
        event_type: "execution_anchor_draft_created",
        summary: "Revision 1 draft created",
        occurred_at: "2026-01-01T00:00:00Z",
      }),
    ];
    render(
      <TaskActivityPage data={data({ activity: { task_id: "t1", events } })} />,
    );
    const timeline = screen.getByRole("list", {
      name: "Task activity timeline",
    });
    const items = within(timeline).getAllByRole("listitem");
    expect(
      within(items[0]).getByText("Execution Anchor confirmed"),
    ).toBeVisible();
    expect(
      within(items[1]).getByText("Execution Anchor draft created"),
    ).toBeVisible();
  });

  it("shows real Human Decisions in the Activity timeline, distinct from the Execution Anchor event", () => {
    render(
      <TaskActivityPage
        data={data({
          activity: {
            task_id: "t1",
            events: [
              event({
                id: "e2",
                event_type: "execution_anchor_confirmed",
                summary: "Revision 1 confirmed",
              }),
              event({
                id: "e1",
                event_type: "human_decision_recorded",
                summary:
                  "Decision recorded: Human cg_supervisor confirm execution anchor (Revision 1)",
                related_entity_type: "decision",
                related_entity_id: "dec1",
              }),
            ],
          },
        })}
      />,
    );
    expect(screen.getByText("Execution Anchor confirmed")).toBeVisible();
    expect(screen.getByText("Decision recorded")).toBeVisible();
  });

  it("routes a dependency event to Dependencies and a CG review event to Version Review", () => {
    render(
      <TaskActivityPage
        data={data({
          activity: {
            task_id: "t1",
            events: [
              event({
                id: "d1",
                event_type: "dependency_recorded",
                summary: "Dependency recorded",
                route: "/cg/tasks/t1/dependencies",
              }),
              event({
                id: "r1",
                event_type: "cg_supervisor_review_generated",
                summary: "CG Supervisor review generated",
                route: "/cg/tasks/t1/version-review",
                actor_kind: "agent",
                actor_id: null,
                actor_human_role: null,
              }),
            ],
          },
        })}
      />,
    );
    const links = screen.getAllByRole("link", { name: "Open →" });
    expect(links[0]).toHaveAttribute("href", "/cg/tasks/t1/dependencies");
    expect(links[1]).toHaveAttribute("href", "/cg/tasks/t1/version-review");
  });
});
