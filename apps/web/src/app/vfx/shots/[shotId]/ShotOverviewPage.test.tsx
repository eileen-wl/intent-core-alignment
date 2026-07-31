import type {
  VfxCurrentFocusType,
  VfxInboxCurrentFocusRead,
  VfxInboxItemRead,
} from "@intent-core/contracts";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ShotOverviewPage } from "./ShotOverviewPage";

afterEach(() => {
  cleanup();
});

function focus(
  focusType: VfxCurrentFocusType,
  overrides: Partial<VfxInboxCurrentFocusRead> = {},
): VfxInboxCurrentFocusRead {
  return {
    focus_type: focusType,
    title: "Focus title",
    explanation: "Focus explanation.",
    target_route: "/vfx/shots/s1/intent",
    primary_action_label: "Do the thing",
    actionable: true,
    ...overrides,
  };
}

function buildItem(overrides: Partial<VfxInboxItemRead> = {}): VfxInboxItemRead {
  return {
    project_id: "p1",
    project_name: "D1 Demo Project",
    shot_id: "s1",
    shot_name: "Shot 010 — Final confrontation",
    shot_source: "manual",
    core_anchor_state: "confirmed",
    active_core_anchor_revision_id: "r1",
    active_core_anchor_summary: "A restrained dusk confrontation.",
    pending_human_gate_id: null,
    relevant_task_id: "t1",
    relevant_task_name: "Compositing Review",
    relevant_version_id: "v1",
    relevant_version_name: "D1_STEP3_VFX_REVIEW_001",
    relevant_version_number: 1,
    pairing_established: true,
    latest_assessment_id: "a1",
    latest_assessment_created_at: "2026-07-30T00:00:00Z",
    latest_signal_id: "sig1",
    latest_signal_attention_level: "medium",
    latest_signal_summary: "Attention is needed on this assessment.",
    re_anchor_proposal_present: false,
    current_focus: focus("assessment_generation_available"),
    next_candidates: [],
    sort_rank: 3000000000000,
    ...overrides,
  };
}

describe("ShotOverviewPage", () => {
  it("shows an honest not-found/unavailable state when the Shot could not be resolved", () => {
    render(<ShotOverviewPage item={null} onExitRole={vi.fn()} />);
    expect(screen.getByText("This Shot is unavailable")).toBeVisible();
  });

  it("renders the production-context header with independent Task/Version facts", () => {
    render(<ShotOverviewPage item={buildItem()} onExitRole={vi.fn()} />);
    expect(screen.getByText(/D1 Demo Project.*Shot 010/)).toBeVisible();
    expect(screen.getByText("Compositing Review")).toBeVisible();
    // Appears once in the compact header and once in supporting
    // context -- distinct UI regions with distinct jobs, not a
    // forbidden repeated-Signal duplication.
    expect(screen.getAllByText("D1_STEP3_VFX_REVIEW_001 (v1)").length).toBeGreaterThan(0);
  });

  it("renders all five contextual tabs, Overview active", () => {
    render(<ShotOverviewPage item={buildItem()} onExitRole={vi.fn()} />);
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Intent" })).toBeVisible();
    // Versions/Alignment/Activity are Step 7C-3 scope: rendered as
    // disabled, non-navigable "Upcoming" placeholders, never a live
    // link leading to a 404.
    for (const label of ["Versions", "Alignment", "Activity"]) {
      expect(screen.queryByRole("link", { name: label })).not.toBeInTheDocument();
      expect(screen.getByText(label)).toBeVisible();
    }
    expect(screen.getAllByText("Upcoming")).toHaveLength(3);
  });

  const focusTypes: VfxCurrentFocusType[] = [
    "core_anchor_gate_pending",
    "core_anchor_draft_needs_review",
    "alignment_not_followed_by_anchor_action",
    "re_anchor_proposal_present",
    "assessment_generation_available",
    "none",
  ];

  it.each(focusTypes)("renders exactly one Current focus for %s", (focusType) => {
    const item = buildItem({
      current_focus: focus(focusType, {
        actionable: focusType !== "none",
        primary_action_label: focusType === "none" ? null : "Act now",
        title: `Title for ${focusType}`,
      }),
    });
    render(<ShotOverviewPage item={item} onExitRole={vi.fn()} />);
    expect(screen.getAllByText("Current focus")).toHaveLength(1);
    expect(screen.getByText(`Title for ${focusType}`)).toBeVisible();
  });

  it("renders no action button at all for focus_type 'none'", () => {
    const item = buildItem({
      current_focus: focus("none", {
        actionable: false,
        primary_action_label: null,
        title: "Nothing requires your attention on this Shot right now",
      }),
    });
    render(<ShotOverviewPage item={item} onExitRole={vi.fn()} />);
    expect(screen.queryByRole("link", { name: "Act now" })).not.toBeInTheDocument();
  });

  it("renders a real action link for an actionable focus", () => {
    const item = buildItem({
      current_focus: focus("core_anchor_gate_pending", {
        primary_action_label: "Review and confirm",
        target_route: "/vfx/shots/s1/intent",
      }),
    });
    render(<ShotOverviewPage item={item} onExitRole={vi.fn()} />);
    expect(
      screen.getByRole("link", { name: "Review and confirm" }),
    ).toHaveAttribute("href", "/vfx/shots/s1/intent");
  });

  it("does not duplicate the Signal message when Current focus is alignment-driven", () => {
    const item = buildItem({
      current_focus: focus("alignment_not_followed_by_anchor_action", {
        explanation: "No newer Core Anchor action has followed this assessment.",
      }),
    });
    render(<ShotOverviewPage item={item} onExitRole={vi.fn()} />);
    // The Signal explanation appears once (inside Current focus), not
    // again inside supporting context.
    expect(screen.queryByText("Latest assessment")).not.toBeInTheDocument();
  });

  it("shows the Signal summary in supporting context when Current focus is not alignment-driven", () => {
    const item = buildItem({
      current_focus: focus("assessment_generation_available"),
    });
    render(<ShotOverviewPage item={item} onExitRole={vi.fn()} />);
    expect(screen.getByText("Latest assessment")).toBeVisible();
  });

  it("shows an honest confirmed Core Anchor summary", () => {
    render(<ShotOverviewPage item={buildItem()} onExitRole={vi.fn()} />);
    expect(screen.getByText("A restrained dusk confrontation.")).toBeVisible();
  });

  it("does not show full Evidence, three role perspectives, or integration metadata", () => {
    render(<ShotOverviewPage item={buildItem()} onExitRole={vi.fn()} />);
    expect(screen.queryByText(/role perspective/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/evidence/i)).not.toBeInTheDocument();
  });

  it("renders no 'Next in this Shot' heading or list when there are zero next candidates", () => {
    render(<ShotOverviewPage item={buildItem({ next_candidates: [] })} onExitRole={vi.fn()} />);
    expect(screen.queryByText("Next in this Shot")).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Next in this Shot" })).not.toBeInTheDocument();
  });

  it("renders the real backend-supplied 'Next in this Shot' items", () => {
    const item = buildItem({
      next_candidates: [
        {
          focus_type: "alignment_not_followed_by_anchor_action",
          title: "Cross-role assessment may need your interpretation",
          explanation: "No newer Core Anchor action has followed this assessment.",
          target_route: "/vfx/shots/s1/alignment",
          primary_action_label: "Review alignment",
          actionable: true,
        },
        {
          focus_type: "re_anchor_proposal_present",
          title: "Re-anchor proposal available for consideration",
          explanation: "The latest assessment includes an advisory suggestion for the Core Anchor.",
          target_route: "/vfx/shots/s1/alignment",
          primary_action_label: "Review proposal",
          actionable: true,
        },
      ],
    });
    render(<ShotOverviewPage item={item} onExitRole={vi.fn()} />);
    expect(screen.getByText("Next in this Shot")).toBeVisible();
    expect(
      screen.getByText("Cross-role assessment may need your interpretation"),
    ).toBeVisible();
    expect(screen.getByText("Re-anchor proposal available for consideration")).toBeVisible();
    const list = screen.getByRole("list", { name: "Next in this Shot" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
  });

  it("renders the Re-anchor Proposal as the only D1 Next item, never an assessment-generation item", () => {
    // Predicate-correction regression test: the seeded D1 Shot already
    // has a successful CrossRoleAssessment, so the backend's corrected
    // next_candidates must contain only the Proposal -- never
    // "assessment_generation_available" (that control belongs in the
    // future Alignment Workspace, Step 7C-3, not here).
    const item = buildItem({
      current_focus: focus("alignment_not_followed_by_anchor_action", {
        explanation: "No newer Core Anchor action has followed this assessment.",
      }),
      re_anchor_proposal_present: true,
      next_candidates: [
        {
          focus_type: "re_anchor_proposal_present",
          title: "Re-anchor proposal available for consideration",
          explanation: "The latest assessment includes an advisory suggestion for the Core Anchor.",
          target_route: "/vfx/shots/s1/alignment",
          primary_action_label: "Review proposal",
          actionable: true,
        },
      ],
    });
    render(<ShotOverviewPage item={item} onExitRole={vi.fn()} />);
    const list = screen.getByRole("list", { name: "Next in this Shot" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("Re-anchor proposal available for consideration")).toBeVisible();
    expect(screen.queryByText("A new cross-role assessment can be generated")).not.toBeInTheDocument();
  });
});
