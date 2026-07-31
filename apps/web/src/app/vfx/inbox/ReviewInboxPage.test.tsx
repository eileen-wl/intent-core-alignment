import type { VfxInboxItemRead, VfxInboxRead } from "@intent-core/contracts";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReviewInboxPage } from "./ReviewInboxPage";

afterEach(() => {
  cleanup();
});

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
    latest_assessment_id: null,
    latest_assessment_created_at: null,
    latest_signal_id: null,
    latest_signal_attention_level: null,
    latest_signal_summary: null,
    re_anchor_proposal_present: false,
    current_focus: {
      focus_type: "core_anchor_gate_pending",
      title: "Confirmation required",
      explanation: "A draft is waiting on your confirmation.",
      target_route: "/vfx/shots/s1/intent",
      primary_action_label: "Review and confirm",
      actionable: true,
    },
    next_candidates: [],
    sort_rank: 1,
    ...overrides,
  };
}

function buildInbox(items: VfxInboxItemRead[]): VfxInboxRead {
  return { items, generated_at: "2026-01-01T00:00:00Z" };
}

describe("ReviewInboxPage", () => {
  it("marks Review Inbox current in the sidebar", () => {
    render(<ReviewInboxPage inbox={buildInbox([])} onExitRole={vi.fn()} />);
    expect(
      screen.getByRole("link", { name: "Review Inbox" }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("shows an honest error state when the Inbox failed to load", () => {
    render(<ReviewInboxPage inbox={null} onExitRole={vi.fn()} />);
    expect(screen.getByText("Review Inbox is unavailable")).toBeVisible();
  });

  it("shows an honest empty state when nothing is actionable", () => {
    render(
      <ReviewInboxPage
        inbox={buildInbox([
          buildItem({ current_focus: { ...buildItem().current_focus, actionable: false } }),
        ])}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText("Nothing needs your review right now")).toBeVisible();
  });

  it("filters to only actionable items, excluding non-actionable Shots", () => {
    render(
      <ReviewInboxPage
        inbox={buildInbox([
          buildItem({ shot_id: "actionable-1" }),
          buildItem({
            shot_id: "quiet-1",
            shot_name: "Shot 020 — Quiet",
            current_focus: {
              focus_type: "none",
              title: "Nothing requires your attention on this Shot right now",
              explanation: "",
              target_route: "/vfx/shots/quiet-1",
              primary_action_label: null,
              actionable: false,
            },
          }),
        ])}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText("Showing 1 items requiring review")).toBeVisible();
    expect(screen.getByText("Shot 010 — Final confrontation")).toBeVisible();
    expect(screen.queryByText("Shot 020 — Quiet")).not.toBeInTheDocument();
  });

  it("opening a row goes straight to the Shot's own Overview, never through this page as a structural parent", () => {
    render(
      <ReviewInboxPage inbox={buildInbox([buildItem({ shot_id: "s1" })])} onExitRole={vi.fn()} />,
    );
    const links = screen.getAllByRole("link");
    expect(links.some((link) => link.getAttribute("href") === "/vfx/shots/s1")).toBe(true);
  });
});
