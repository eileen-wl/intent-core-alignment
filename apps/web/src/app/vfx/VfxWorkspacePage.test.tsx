import type { VfxInboxItemRead, VfxInboxRead } from "@intent-core/contracts";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { VfxWorkspacePage } from "./VfxWorkspacePage";

afterEach(() => {
  cleanup();
});

function buildItem(
  overrides: Partial<VfxInboxItemRead> = {},
): VfxInboxItemRead {
  return {
    project_id: "11111111-1111-1111-1111-111111111111",
    project_name: "D1 Demo Project",
    shot_id: "22222222-2222-2222-2222-222222222222",
    shot_name: "Shot 010 — Final confrontation",
    shot_source: "manual",
    core_anchor_state: "confirmed",
    active_core_anchor_revision_id: "33333333-3333-3333-3333-333333333333",
    active_core_anchor_summary: "A restrained dusk confrontation.",
    pending_human_gate_id: null,
    relevant_task_id: "44444444-4444-4444-4444-444444444444",
    relevant_task_name: "Compositing Review",
    relevant_version_id: "55555555-5555-5555-5555-555555555555",
    relevant_version_name: "D1_STEP3_VFX_REVIEW_001",
    relevant_version_number: 1,
    pairing_established: true,
    latest_assessment_id: "66666666-6666-6666-6666-666666666666",
    latest_assessment_created_at: "2026-07-30T00:00:00Z",
    latest_signal_id: "77777777-7777-7777-7777-777777777777",
    latest_signal_attention_level: "high",
    latest_signal_summary: "Attention is needed on this assessment.",
    re_anchor_proposal_present: false,
    current_focus: {
      focus_type: "core_anchor_gate_pending",
      title: "Core Anchor draft awaiting your confirmation",
      explanation:
        "A proposed revision to the shared creative intent is ready for your review.",
      target_route: "/vfx/shots/22222222-2222-2222-2222-222222222222/intent",
      primary_action_label: "Review and confirm",
      actionable: true,
    },
    next_candidates: [],
    sort_rank: 0,
    ...overrides,
  };
}

function inactiveItem(
  overrides: Partial<VfxInboxItemRead> = {},
): VfxInboxItemRead {
  return buildItem({
    latest_signal_attention_level: null,
    current_focus: {
      focus_type: "none",
      title: "Nothing requires your attention on this Shot right now",
      explanation: "",
      target_route: "/vfx/shots/s",
      primary_action_label: null,
      actionable: false,
    },
    ...overrides,
  });
}

function buildInbox(items: VfxInboxItemRead[]): VfxInboxRead {
  return { items, generated_at: "2026-07-30T00:00:00Z" };
}

describe("VfxWorkspacePage", () => {
  it("renders the correct App Shell with fixed VFX Supervisor identity", () => {
    render(
      <VfxWorkspacePage
        inbox={buildInbox([buildItem()])}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText("Maya Chen")).toBeVisible();
    expect(screen.getByText("VFX Supervisor")).toBeVisible();
    expect(screen.getByText("Demo mode")).toBeVisible();
  });

  it("renders the VFX role sidebar with Workspace Home current", () => {
    render(
      <VfxWorkspacePage
        inbox={buildInbox([buildItem()])}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("link", { name: "Workspace Home" }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("shows an honest error state when the Inbox failed to load", () => {
    render(<VfxWorkspacePage inbox={null} onExitRole={vi.fn()} />);
    expect(screen.getByText("Workspace Home is unavailable")).toBeVisible();
  });

  it("shows an honest empty state when there are no Shots at all", () => {
    render(<VfxWorkspacePage inbox={buildInbox([])} onExitRole={vi.fn()} />);
    expect(screen.getByText("No Shots exist yet")).toBeVisible();
  });

  it("renders the Anchor overview from real Anchor and attention states", () => {
    render(
      <VfxWorkspacePage
        inbox={buildInbox([
          buildItem({ shot_id: "s1", core_anchor_state: "confirmed" }),
          inactiveItem({ shot_id: "s2", core_anchor_state: "none" }),
        ])}
        onExitRole={vi.fn()}
      />,
    );
    const overview = within(
      screen.getByRole("region", { name: "Anchor overview" }),
    );
    expect(overview.getByText("Confirmed Core Anchors")).toBeVisible();
    expect(overview.getByText("Draft / pending review")).toBeVisible();
    expect(overview.getByText("No Core Anchor")).toBeVisible();
    expect(overview.getByText("Medium attention")).toBeVisible();
    expect(overview.getByText("High attention")).toBeVisible();

    const confirmedCard = overview
      .getByText("Confirmed Core Anchors")
      .closest("div") as HTMLElement;
    expect(confirmedCard).toHaveTextContent("1");
    const noCoreAnchorCard = overview
      .getByText("No Core Anchor")
      .closest("div") as HTMLElement;
    expect(noCoreAnchorCard).toHaveTextContent("1");
  });

  it("Priority actions leads with the required action, never the Shot name, and contains at most 3 items", () => {
    const items = Array.from({ length: 5 }, (_, i) =>
      buildItem({
        shot_id: `s${i}`,
        shot_name: `Shot ${i}`,
        sort_rank: i,
        current_focus: {
          focus_type: "core_anchor_gate_pending",
          title: `Required action ${i}`,
          explanation: "explanation",
          target_route: `/vfx/shots/s${i}/intent`,
          primary_action_label: "Review and confirm",
          actionable: true,
        },
      }),
    );
    render(<VfxWorkspacePage inbox={buildInbox(items)} onExitRole={vi.fn()} />);
    const priorityActions = within(
      screen.getByRole("region", { name: "Priority actions" }),
    );
    expect(priorityActions.getByText("Required action 0")).toBeVisible();
    expect(priorityActions.getByText("Required action 1")).toBeVisible();
    expect(priorityActions.getByText("Required action 2")).toBeVisible();
    expect(
      priorityActions.queryByText("Required action 3"),
    ).not.toBeInTheDocument();
    // Shot name is present only as supporting context, not the heading.
    expect(priorityActions.getByText("Shot 0")).toBeVisible();
  });

  it("Priority actions uses the shared Review work-item model and opens Core Anchor work in Intent", () => {
    render(
      <VfxWorkspacePage
        inbox={buildInbox([
          buildItem({
            shot_id: "s1",
            current_focus: {
              focus_type: "core_anchor_gate_pending",
              title: "Core Anchor draft awaiting your confirmation",
              explanation: "explanation",
              target_route: "/vfx/shots/s1/intent",
              primary_action_label: "Review and confirm",
              actionable: true,
            },
          }),
        ])}
        onExitRole={vi.fn()}
      />,
    );
    const priorityActions = within(
      screen.getByRole("region", { name: "Priority actions" }),
    );
    const link = priorityActions
      .getByText("Core Anchor draft awaiting your confirmation")
      .closest("a");
    expect(link).toHaveAttribute("href", "/vfx/shots/s1/intent");
  });

  it("opens alignment-family work in the real Alignment Workspace", () => {
    render(
      <VfxWorkspacePage
        inbox={buildInbox([
          buildItem({
            shot_id: "s1",
            current_focus: {
              focus_type: "alignment_not_followed_by_anchor_action",
              title: "Cross-role assessment may need your interpretation",
              explanation:
                "No newer Core Anchor action has followed this assessment.",
              target_route: "/vfx/shots/s1/alignment",
              primary_action_label: "Review alignment",
              actionable: true,
            },
          }),
        ])}
        onExitRole={vi.fn()}
      />,
    );
    const priorityActions = within(
      screen.getByRole("region", { name: "Priority actions" }),
    );
    const link = priorityActions
      .getByText("Cross-role assessment may need your interpretation")
      .closest("a");
    expect(link).toHaveAttribute("href", "/vfx/shots/s1/alignment");
  });

  it("shows an honest no-priority-actions state without hiding the Anchor overview or Shots access", () => {
    render(
      <VfxWorkspacePage
        inbox={buildInbox([inactiveItem({ shot_id: "s1" })])}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByText("No priority actions require your attention"),
    ).toBeVisible();
    expect(screen.getByText("Confirmed Core Anchors")).toBeVisible();
    expect(screen.getByText("Anchor overview")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "View all Shots →" }),
    ).toBeVisible();
  });

  it("Anchor overview reflects real Core Anchor state counts", () => {
    render(
      <VfxWorkspacePage
        inbox={buildInbox([
          buildItem({ shot_id: "s1", core_anchor_state: "confirmed" }),
          inactiveItem({ shot_id: "s2", core_anchor_state: "draft_pending" }),
          inactiveItem({ shot_id: "s3", core_anchor_state: "none" }),
        ])}
        onExitRole={vi.fn()}
      />,
    );
    const overview = within(
      screen.getByRole("region", { name: "Anchor overview" }),
    );
    expect(
      overview.getByText("Confirmed Core Anchors").closest("div"),
    ).toHaveTextContent("1");
    expect(
      overview.getByText("Draft / pending review").closest("div"),
    ).toHaveTextContent("1");
    expect(
      overview.getByText("No Core Anchor").closest("div"),
    ).toHaveTextContent("1");
  });

  it("Important Shots contains at most 3 Shots and never the complete catalogue", () => {
    const items = Array.from({ length: 6 }, (_, i) =>
      inactiveItem({ shot_id: `s${i}`, shot_name: `Shot ${i}`, sort_rank: i }),
    );
    render(<VfxWorkspacePage inbox={buildInbox(items)} onExitRole={vi.fn()} />);
    expect(screen.getByText("Important Shots")).toBeVisible();
    expect(screen.getByText("Shot 0")).toBeVisible();
    expect(screen.getByText("Shot 1")).toBeVisible();
    expect(screen.getByText("Shot 2")).toBeVisible();
    expect(screen.queryByText("Shot 5")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "View all Shots →" }),
    ).toHaveAttribute("href", "/vfx/shots");
  });

  it("links Priority actions' Review Inbox action into /vfx/inbox", () => {
    render(
      <VfxWorkspacePage
        inbox={buildInbox([buildItem()])}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("link", { name: "Go to Review Inbox →" }),
    ).toHaveAttribute("href", "/vfx/inbox");
  });

  it("wires Exit role view to the provided callback", async () => {
    const onExitRole = vi.fn();
    render(
      <VfxWorkspacePage
        inbox={buildInbox([buildItem()])}
        onExitRole={onExitRole}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Exit role view" }),
    );
    expect(onExitRole).toHaveBeenCalled();
  });
});
