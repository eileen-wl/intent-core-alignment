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
  attentionLevel: VfxInboxItemRead["latest_signal_attention_level"] = null,
  focusType: VfxInboxItemRead["current_focus"]["focus_type"] = "core_anchor_gate_pending",
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
    latest_signal_attention_level: attentionLevel,
    latest_signal_summary: null,
    re_anchor_proposal_present: false,
    current_focus: {
      focus_type: focusType,
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

  it("shows an honest empty state when no Shot needs creative attention", () => {
    render(
      <VfxWorkspacePage inbox={inbox([item("s1")])} anchorActions={null} />,
    );
    const primary = screen.getByRole("region", { name: "Primary focus" });
    expect(
      within(primary).getByText(
        "Nothing needs your creative attention right now",
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole("region", { name: "Also worth a look" }),
    ).not.toBeInTheDocument();
  });

  it("renders exactly one Primary Focus and no secondary region for a single priority Shot", () => {
    render(
      <VfxWorkspacePage
        inbox={inbox([item("s1")])}
        anchorActions={{ items: [summary("s1")], total_count: 1, limit: 5 }}
      />,
    );
    const primary = screen.getByRole("region", { name: "Primary focus" });
    expect(within(primary).getByText("Shot s1 · Demo Project")).toBeVisible();
    expect(
      within(primary).getByText("Review Core Anchor revision"),
    ).toBeVisible();
    expect(within(primary).getByText("Review revision →")).toBeVisible();
    expect(
      screen.queryByRole("region", { name: "Also worth a look" }),
    ).not.toBeInTheDocument();
  });

  it("enforces the Home content ceiling: 1 Primary Focus + at most 2 secondary Shots, even with many eligible Shots", () => {
    const items = Array.from({ length: 7 }, (_, index) => item(`s${index}`));
    render(
      <VfxWorkspacePage
        inbox={inbox(items)}
        anchorActions={{
          items: items.map((row) => summary(row.shot_id)),
          total_count: 7,
          limit: 5,
        }}
      />,
    );

    const primary = screen.getByRole("region", { name: "Primary focus" });
    expect(within(primary).getByText("Shot s0 · Demo Project")).toBeVisible();

    const secondary = screen.getByRole("region", {
      name: "Also worth a look",
    });
    const secondaryItems = within(secondary).getAllByRole("listitem");
    expect(secondaryItems).toHaveLength(2);
    expect(within(secondary).getByText("Shot s1")).toBeVisible();
    expect(within(secondary).getByText("Shot s2")).toBeVisible();
    expect(within(secondary).queryByText("Shot s3")).not.toBeInTheDocument();

    // The secondary rows are a reduced signal only -- no full Anchor
    // summary block, no ftrack badge, no production-context line.
    expect(
      within(secondary).queryByLabelText("Production context"),
    ).not.toBeInTheDocument();
  });

  it("shows a compact, non-imperative state signal for each secondary Shot instead of the imperative next-action title", () => {
    render(
      <VfxWorkspacePage
        inbox={inbox([
          item("s1", "confirmed", null, "core_anchor_gate_pending"),
          item("s2", "none", null, "alignment_not_followed_by_anchor_action"),
          item("s3", "confirmed", null, "re_anchor_proposal_present"),
        ])}
        anchorActions={{
          items: [summary("s1"), summary("s2"), summary("s3")],
          total_count: 3,
          limit: 5,
        }}
      />,
    );
    const secondary = screen.getByRole("region", {
      name: "Also worth a look",
    });
    expect(
      within(secondary).getByText("Assessment needs interpretation"),
    ).toBeVisible();
    expect(
      within(secondary).getByText("Re-anchor proposal available"),
    ).toBeVisible();
    expect(
      within(secondary).queryByText("Review Core Anchor revision"),
    ).not.toBeInTheDocument();
  });

  it("falls back to the Shot's real Core Anchor state, never a false 'No open signal', when current focus is none", () => {
    render(
      <VfxWorkspacePage
        inbox={inbox([
          item("s1", "confirmed", null, "core_anchor_gate_pending"),
          item("s2", "none", null, "none"),
          item("s3", "confirmed", null, "none"),
        ])}
        anchorActions={{
          items: [summary("s1"), summary("s2"), summary("s3")],
          total_count: 3,
          limit: 5,
        }}
      />,
    );
    const secondary = screen.getByRole("region", {
      name: "Also worth a look",
    });
    expect(within(secondary).getByText("Core Anchor missing")).toBeVisible();
    expect(within(secondary).getByText("Other creative focus")).toBeVisible();
    expect(
      within(secondary).queryByText("No open signal"),
    ).not.toBeInTheDocument();
  });

  it("visually splits primary role-state metrics from supporting metrics without dropping any aggregate fact", () => {
    render(
      <VfxWorkspacePage
        inbox={inbox([
          item("confirmed-1", "confirmed", "high"),
          item("draft", "draft_pending"),
          item("none", "none"),
        ])}
        anchorActions={{
          items: [summary("confirmed-1")],
          total_count: 1,
          limit: 5,
        }}
      />,
    );
    const scope = within(
      screen.getByRole("region", { name: "Scope overview" }),
    );
    expect(scope.getByText("Confirmed Core Anchors")).toBeVisible();
    expect(scope.getByText("Shots needing attention")).toBeVisible();
    expect(scope.getByText(/Draft \/ pending review/)).toBeVisible();
    expect(scope.getByText(/No Core Anchor/)).toBeVisible();
    expect(scope.getByText(/Medium attention/)).toBeVisible();
    expect(scope.getByText(/High attention/)).toBeVisible();
  });

  it("foregrounds a derived Shots-needing-attention primary metric instead of a lone High attention count that hides real Medium attention", () => {
    render(
      <VfxWorkspacePage
        inbox={inbox([
          item("s1", "confirmed", "medium"),
          item("s2", "confirmed", null),
        ])}
        anchorActions={{ items: [summary("s1")], total_count: 1, limit: 5 }}
      />,
    );
    const scope = within(
      screen.getByRole("region", { name: "Scope overview" }),
    );
    expect(
      scope.getByText("Shots needing attention").closest("div"),
    ).toHaveTextContent("1");
    expect(scope.getByText(/High attention/)).toHaveTextContent("0");
    expect(scope.getByText(/Medium attention/)).toHaveTextContent("1");
  });

  it("communicates real creative-direction coverage and attention distribution, not a bare count", () => {
    render(
      <VfxWorkspacePage
        inbox={inbox([
          item("confirmed-1", "confirmed", "high"),
          item("confirmed-2"),
          item("draft", "draft_pending"),
          item("none", "none"),
        ])}
        anchorActions={{
          items: [summary("confirmed-1")],
          total_count: 1,
          limit: 5,
        }}
      />,
    );
    const health = screen.getByRole("region", {
      name: "Creative direction health",
    });
    expect(
      within(health).getByText(
        "2 of 4 Shots have confirmed creative direction (1 draft, 1 does not yet have a Core Anchor).",
      ),
    ).toBeVisible();
    expect(within(health).getByText("1 at high attention.")).toBeVisible();
  });

  it("disambiguates the Primary Focus status badge as specifically the Core Anchor", () => {
    render(
      <VfxWorkspacePage
        inbox={inbox([item("s1")])}
        anchorActions={{ items: [summary("s1")], total_count: 1, limit: 5 }}
      />,
    );
    const primary = screen.getByRole("region", { name: "Primary focus" });
    expect(within(primary).getByText("Core Anchor confirmed")).toBeVisible();
    expect(within(primary).queryByText("Confirmed")).not.toBeInTheDocument();
  });

  it("keeps the Scope overview counts and routes present", () => {
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
    const scope = within(
      screen.getByRole("region", { name: "Scope overview" }),
    );
    expect(
      scope.getByText("Confirmed Core Anchors").closest("div"),
    ).toHaveTextContent("1");
    expect(scope.getByText("No Core Anchor")).toHaveTextContent("1");
    expect(
      screen.getByRole("link", { name: "View all Shots →" }),
    ).toHaveAttribute("href", "/vfx/shots");
    expect(
      screen.getByRole("link", { name: "Go to Review Inbox →" }),
    ).toHaveAttribute("href", "/vfx/inbox");
  });
});
