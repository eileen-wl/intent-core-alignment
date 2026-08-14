import type {
  AnchorContextSummaryRead,
  VfxInboxItemRead,
  VfxInboxRead,
} from "@intent-core/contracts";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { VfxWorkspacePage } from "./VfxWorkspacePage";

afterEach(cleanup);

function item(
  id: string,
  state: VfxInboxItemRead["core_anchor_state"] = "confirmed",
): VfxInboxItemRead {
  return {
    project_id: "project-1",
    project_name: "Demo Project",
    shot_id: id,
    shot_name: `Shot ${id}`,
    shot_source: "manual",
    core_anchor_state: state,
    active_core_anchor_revision_id: state === "confirmed" ? "revision-1" : null,
    active_core_anchor_summary:
      state === "confirmed" ? "Keep the confrontation restrained." : null,
    pending_human_gate_id: null,
    relevant_task_id: null,
    relevant_task_name: null,
    relevant_version_id: null,
    relevant_version_name: null,
    relevant_version_number: null,
    pairing_established: false,
    latest_assessment_id: null,
    latest_assessment_created_at: null,
    latest_signal_id: null,
    latest_signal_attention_level: null,
    latest_signal_summary: null,
    re_anchor_proposal_present: false,
    current_focus: {
      focus_type: "core_anchor_gate_pending",
      title: "Core Anchor draft awaiting confirmation",
      explanation: "A draft needs human review.",
      target_route: `/vfx/shots/${id}/intent`,
      primary_action_label: "Review revision",
      actionable: true,
    },
    next_candidates: [],
    sort_rank: 0,
  };
}

function summary(id: string): AnchorContextSummaryRead {
  return {
    role: "vfx_supervisor",
    shot_id: id,
    task_id: null,
    core_anchor_state: "confirmed",
    core_anchor_revision_number: 1,
    core_direction: "Keep the confrontation restrained.",
    execution_context_state: null,
    execution_anchor_revision_number: null,
    execution_direction: null,
    based_on_core_anchor_revision_number: null,
    attention_level: "high",
    attention_summary: "A draft needs review.",
    guidance_state: "unavailable",
    readiness_state: "action_required",
    readiness_detail: "The VFX Supervisor must review this revision.",
    open_vfx_escalation: false,
    next_action: {
      title: "Review Core Anchor revision",
      why_now: "A draft needs human review.",
      downstream_effect: "CG translation can continue after confirmation.",
      target_route: `/vfx/shots/${id}/intent`,
      action_label: "Review revision",
      executable: true,
    },
  };
}

function inbox(items: VfxInboxItemRead[]): VfxInboxRead {
  return { items, generated_at: "2026-08-03T00:00:00Z" };
}

describe("VfxWorkspacePage", () => {
  it("renders honest error and empty states", () => {
    const { rerender } = render(<VfxWorkspacePage inbox={null} />);
    expect(screen.getByText("Workspace Home is unavailable")).toBeVisible();
    rerender(<VfxWorkspacePage inbox={inbox([])} />);
    expect(screen.getByText("No Shots exist yet")).toBeVisible();
  });

  it("puts bounded Anchor actions before scope health without a global current Anchor", () => {
    const items = Array.from({ length: 7 }, (_, index) => item(`s${index}`));
    render(
      <VfxWorkspacePage
        inbox={inbox(items)}
        anchorActions={{
          items: items.slice(0, 5).map((row) => summary(row.shot_id)),
          total_count: 7,
          limit: 5,
        }}
      />,
    );

    const actions = screen.getByRole("region", { name: "Anchor actions" });
    expect(within(actions).getAllByRole("listitem")).toHaveLength(5);
    expect(
      within(actions).getAllByText("Review Core Anchor revision").length,
    ).toBeGreaterThan(0);
    expect(within(actions).getAllByText("Anchor")).toHaveLength(5);
    expect(within(actions).getAllByText("Direction")).toHaveLength(5);
    expect(within(actions).getAllByText("Attention / state")).toHaveLength(5);
    expect(
      within(actions).getAllByLabelText("Production context"),
    ).toHaveLength(5);
    expect(screen.queryByText("Anchor overview")).not.toBeInTheDocument();
    const health = screen.getByRole("region", { name: "Anchor health" });
    expect(
      actions.compareDocumentPosition(health) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("keeps counts below actions and production browse secondary", () => {
    render(
      <VfxWorkspacePage
        inbox={inbox([item("confirmed"), item("missing", "none")])}
        anchorActions={{
          items: [summary("confirmed")],
          total_count: 1,
          limit: 5,
        }}
      />,
    );
    const health = within(
      screen.getByRole("region", { name: "Anchor health" }),
    );
    expect(
      health.getByText("Confirmed Core Anchors").closest("div"),
    ).toHaveTextContent("1");
    expect(health.getByText("No Core Anchor").closest("div")).toHaveTextContent(
      "1",
    );
    expect(
      screen.getByRole("link", { name: "View all Shots →" }),
    ).toHaveAttribute("href", "/vfx/shots");
  });

  it("uses the backend action label", () => {
    render(
      <VfxWorkspacePage
        inbox={inbox([item("s1")])}
        anchorActions={{ items: [summary("s1")], total_count: 1, limit: 5 }}
      />,
    );
    expect(screen.getByText("Review revision →")).toBeVisible();
  });
});
