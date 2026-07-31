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
    pending_human_gate_id: "gate-1",
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
      title: "Core Anchor draft awaiting your confirmation",
      explanation: "A proposed revision to the shared creative intent is ready for your review.",
      target_route: "/vfx/shots/s1/intent",
      primary_action_label: "Review and confirm",
      actionable: true,
    },
    next_candidates: [],
    sort_rank: 1,
    ...overrides,
  };
}

function inactiveItem(overrides: Partial<VfxInboxItemRead> = {}): VfxInboxItemRead {
  return buildItem({
    current_focus: {
      focus_type: "none",
      title: "Nothing requires your attention on this Shot right now",
      explanation: "",
      target_route: "/vfx/shots/s2",
      primary_action_label: null,
      actionable: false,
    },
    ...overrides,
  });
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

  it("shows an honest clear-inbox empty state when no work items exist, with a route to Shots", () => {
    render(
      <ReviewInboxPage inbox={buildInbox([inactiveItem({ shot_id: "s2" })])} onExitRole={vi.fn()} />,
    );
    expect(screen.getByText("Review Inbox is clear")).toBeVisible();
    expect(
      screen.getByText("No review or interpretation currently requires your attention."),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Browse Shots →" })).toHaveAttribute(
      "href",
      "/vfx/shots",
    );
  });

  it("only actionable work items appear, with the required action as the primary title", () => {
    render(
      <ReviewInboxPage
        inbox={buildInbox([
          buildItem({ shot_id: "s1" }),
          inactiveItem({ shot_id: "s2" }),
        ])}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText("Showing 1 items requiring review")).toBeVisible();
    expect(screen.getByText("Core Anchor draft awaiting your confirmation")).toBeVisible();
  });

  it("shows the honest category and Shot as supporting context, not the primary title", () => {
    render(<ReviewInboxPage inbox={buildInbox([buildItem({ shot_id: "s1" })])} onExitRole={vi.fn()} />);
    expect(screen.getByText("Core Anchor confirmation")).toBeVisible();
    const title = screen.getByText("Core Anchor draft awaiting your confirmation");
    const row = title.closest("a");
    expect(row).toHaveTextContent("Shot 010 — Final confrontation");
    // Shot name must not itself be the row's <a> accessible name lead --
    // the required-action title comes first in reading order.
    expect(row?.textContent?.indexOf("Core Anchor draft awaiting your confirmation")).toBeLessThan(
      row?.textContent?.indexOf("Shot 010 — Final confrontation") ?? -1,
    );
  });

  it("never fabricates HumanGate/Assessment/Proposal/Decision language on a work-item row", () => {
    render(<ReviewInboxPage inbox={buildInbox([buildItem({ shot_id: "s1" })])} onExitRole={vi.fn()} />);
    const row = screen.getByText("Core Anchor draft awaiting your confirmation").closest("a");
    for (const forbidden of ["HumanGate", "Human Gate", "Decision", "Escalat", "Proposal"]) {
      expect(row?.textContent ?? "").not.toMatch(new RegExp(forbidden, "i"));
    }
  });

  it("routes Core Anchor work to Intent, and alignment-family work to Shot Overview (never an unimplemented route)", () => {
    render(
      <ReviewInboxPage
        inbox={buildInbox([
          buildItem({
            shot_id: "s1",
            current_focus: {
              focus_type: "core_anchor_draft_needs_review",
              title: "Core Anchor draft in progress",
              explanation: "A draft revision exists but has not yet been submitted for confirmation.",
              target_route: "/vfx/shots/s1/intent",
              primary_action_label: "Review draft",
              actionable: true,
            },
          }),
          buildItem({
            shot_id: "s2",
            shot_name: "Shot 020",
            current_focus: {
              focus_type: "re_anchor_proposal_present",
              title: "Re-anchor proposal available for consideration",
              explanation: "The latest assessment includes an advisory suggestion for the Core Anchor.",
              target_route: "/vfx/shots/s2/alignment",
              primary_action_label: "Review proposal",
              actionable: true,
            },
          }),
        ])}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByText("Core Anchor draft in progress").closest("a"),
    ).toHaveAttribute("href", "/vfx/shots/s1/intent");
    expect(
      screen.getByText("Re-anchor proposal available for consideration").closest("a"),
    ).toHaveAttribute("href", "/vfx/shots/s2");
  });

  it("supports two work items that reference the same Shot", () => {
    render(
      <ReviewInboxPage
        inbox={buildInbox([
          buildItem({
            shot_id: "s1",
            current_focus: {
              focus_type: "core_anchor_gate_pending",
              title: "Core Anchor draft awaiting your confirmation",
              explanation: "explanation A",
              target_route: "/vfx/shots/s1/intent",
              primary_action_label: "Review and confirm",
              actionable: true,
            },
          }),
          buildItem({
            shot_id: "s1",
            current_focus: {
              focus_type: "re_anchor_proposal_present",
              title: "Re-anchor proposal available for consideration",
              explanation: "explanation B",
              target_route: "/vfx/shots/s1/alignment",
              primary_action_label: "Review proposal",
              actionable: true,
            },
          }),
        ])}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText("Showing 2 items requiring review")).toBeVisible();
    expect(screen.getByText("Core Anchor draft awaiting your confirmation")).toBeVisible();
    expect(screen.getByText("Re-anchor proposal available for consideration")).toBeVisible();
  });
});
