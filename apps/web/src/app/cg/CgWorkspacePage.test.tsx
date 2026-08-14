import type {
  AnchorContextSummaryRead,
  CgInboxItemRead,
  CgInboxRead,
} from "@intent-core/contracts";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CgWorkspacePage } from "./CgWorkspacePage";

afterEach(cleanup);

function item(
  id: string,
  state: CgInboxItemRead["execution_anchor_state"] = "none",
): CgInboxItemRead {
  return {
    task_id: id,
    task_name: `Lighting ${id}`,
    department: "lighting",
    task_source: "manual",
    shot_id: `shot-${id}`,
    shot_name: `Shot ${id}`,
    project_id: "project-1",
    project_name: "Demo Project",
    execution_anchor_state: state,
    active_execution_anchor_revision_id: null,
    active_execution_anchor_summary: null,
    pending_human_gate_id: null,
    latest_version_id: null,
    latest_version_name: null,
    latest_version_number: null,
    open_dependency_count: 0,
    current_focus: {
      focus_type: "none",
      title: "Nothing requires your attention on this Task right now",
      explanation: "No current focus.",
      target_route: `/cg/tasks/${id}`,
      primary_action_label: null,
      actionable: false,
    },
    sort_rank: 0,
  };
}

function summary(id: string): AnchorContextSummaryRead {
  return {
    role: "cg_supervisor",
    shot_id: `shot-${id}`,
    task_id: id,
    core_anchor_state: "confirmed",
    core_anchor_revision_number: 1,
    core_direction: "Keep the confrontation restrained.",
    execution_context_state: "missing",
    execution_anchor_revision_number: null,
    execution_direction: null,
    based_on_core_anchor_revision_number: null,
    attention_level: "not_assessed",
    attention_summary: null,
    guidance_state: "unavailable",
    readiness_state: "action_required",
    readiness_detail: "The department translation is missing.",
    open_vfx_escalation: false,
    next_action: {
      title: "Create the Execution Anchor",
      why_now: "Confirmed Core direction needs a department translation.",
      downstream_effect: "Artists will receive confirmed execution direction.",
      target_route: `/cg/tasks/${id}/execution`,
      action_label: "Open Execution",
      executable: true,
    },
  };
}

function inbox(items: CgInboxItemRead[]): CgInboxRead {
  return { items, generated_at: "2026-08-03T00:00:00Z" };
}

describe("CgWorkspacePage", () => {
  it("renders honest error and empty states", () => {
    const { rerender } = render(<CgWorkspacePage inbox={null} />);
    expect(screen.getByText("Workspace Home is unavailable")).toBeVisible();
    rerender(<CgWorkspacePage inbox={inbox([])} />);
    expect(screen.getByText("No Tasks exist yet")).toBeVisible();
  });

  it("puts bounded Execution Anchor actions before readiness counts", () => {
    const items = Array.from({ length: 7 }, (_, index) => item(`t${index}`));
    render(
      <CgWorkspacePage
        inbox={inbox(items)}
        anchorActions={{
          items: items.slice(0, 5).map((row) => summary(row.task_id)),
          total_count: 7,
          limit: 5,
        }}
      />,
    );
    const actions = screen.getByRole("region", {
      name: "Execution Anchor actions",
    });
    expect(within(actions).getAllByRole("listitem")).toHaveLength(5);
    expect(
      within(actions).getAllByText(/Core Anchor R1/).length,
    ).toBeGreaterThan(0);
    expect(
      within(actions).getAllByText(/Execution Anchor not confirmed/).length,
    ).toBeGreaterThan(0);
    expect(
      within(actions).getAllByLabelText("Production context"),
    ).toHaveLength(5);
    const readiness = screen.getByRole("region", {
      name: "Department anchor readiness",
    });
    expect(
      actions.compareDocumentPosition(readiness) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("uses readiness language instead of the stale none-focus message", () => {
    render(
      <CgWorkspacePage
        inbox={inbox([item("t1")])}
        anchorActions={{ items: [summary("t1")], total_count: 1, limit: 5 }}
      />,
    );
    expect(
      screen.getAllByText("Create the Execution Anchor").length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByText(
        "Nothing requires your attention on this Task right now",
      ),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Open Execution →")).toBeVisible();
  });

  it("does not describe high attention as a formal escalation", () => {
    const high = {
      ...summary("t1"),
      attention_level: "high" as const,
      open_vfx_escalation: false,
    };
    render(
      <CgWorkspacePage
        inbox={inbox([item("t1")])}
        anchorActions={{ items: [high], total_count: 1, limit: 5 }}
      />,
    );
    expect(screen.getByText(/high · action required/)).toBeVisible();
    expect(screen.queryByText(/formal escalation/i)).not.toBeInTheDocument();
  });
});
