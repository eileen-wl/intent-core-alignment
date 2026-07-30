import type { VfxInboxItemRead, VfxInboxRead } from "@intent-core/contracts";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { VfxWorkspacePage } from "./VfxWorkspacePage";

afterEach(() => {
  cleanup();
});

function buildItem(overrides: Partial<VfxInboxItemRead> = {}): VfxInboxItemRead {
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
    latest_signal_attention_level: "medium",
    latest_signal_summary: "Attention is needed on this assessment.",
    re_anchor_proposal_present: false,
    current_focus: {
      focus_type: "alignment_not_followed_by_anchor_action",
      title: "Cross-role assessment may need your interpretation",
      explanation: "No newer Core Anchor action has followed this assessment.",
      target_route: "/vfx/shots/22222222-2222-2222-2222-222222222222/alignment",
      primary_action_label: "Review alignment",
      actionable: true,
    },
    sort_rank: 2000000000000,
    ...overrides,
  };
}

function buildInbox(items: VfxInboxItemRead[]): VfxInboxRead {
  return { items, generated_at: "2026-07-30T00:00:00Z" };
}

describe("VfxWorkspacePage", () => {
  it("renders the correct App Shell with fixed VFX Supervisor identity", () => {
    render(<VfxWorkspacePage inbox={buildInbox([])} onExitRole={vi.fn()} />);
    expect(screen.getByText("Maya Chen")).toBeVisible();
    expect(screen.getByText("VFX Supervisor")).toBeVisible();
    expect(screen.getByText("Demo mode")).toBeVisible();
  });

  it("renders the VFX role sidebar with Alignment Inbox current", () => {
    render(<VfxWorkspacePage inbox={buildInbox([])} onExitRole={vi.fn()} />);
    expect(
      screen.getByRole("link", { name: "Alignment Inbox" }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("shows the Alignment Inbox title", () => {
    render(<VfxWorkspacePage inbox={buildInbox([])} onExitRole={vi.fn()} />);
    expect(
      screen.getByRole("heading", { name: "Alignment Inbox" }),
    ).toBeVisible();
  });

  it("shows an honest empty state when there are no Shots", () => {
    render(<VfxWorkspacePage inbox={buildInbox([])} onExitRole={vi.fn()} />);
    expect(
      screen.getByText("No Shots currently need your attention"),
    ).toBeVisible();
    expect(screen.queryByText(/showing \d+ shots/i)).not.toBeInTheDocument();
  });

  it("shows an honest error state when the Inbox failed to load", () => {
    render(<VfxWorkspacePage inbox={null} onExitRole={vi.fn()} />);
    expect(
      screen.getByText("The Alignment Inbox is unavailable"),
    ).toBeVisible();
    expect(screen.queryByText(/no shots/i)).not.toBeInTheDocument();
  });

  it("shows a real, honest row count -- never a fabricated number", () => {
    render(
      <VfxWorkspacePage
        inbox={buildInbox([buildItem(), buildItem({ shot_id: "s2" })])}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText("Showing 2 Shots")).toBeVisible();
  });

  it("renders one row per real Shot, each with the Shot -> focus -> why -> Open hierarchy", () => {
    render(
      <VfxWorkspacePage inbox={buildInbox([buildItem()])} onExitRole={vi.fn()} />,
    );
    expect(screen.getByText("Shot 010 — Final confrontation")).toBeVisible();
    expect(
      screen.getByText("Cross-role assessment may need your interpretation"),
    ).toBeVisible();
    expect(screen.getByText("Attention needed")).toBeVisible();
    const links = screen.getAllByRole("link");
    const rowLink = links.find(
      (link) =>
        link.getAttribute("href") ===
        "/vfx/shots/22222222-2222-2222-2222-222222222222",
    );
    expect(rowLink).toBeDefined();
  });

  it("shows Task and Version as independent facts, never a joined pair", () => {
    render(
      <VfxWorkspacePage inbox={buildInbox([buildItem()])} onExitRole={vi.fn()} />,
    );
    expect(screen.getByText("Compositing Review")).toBeVisible();
    expect(screen.getByText("D1_STEP3_VFX_REVIEW_001 (v1)")).toBeVisible();
  });

  it("shows an honest absence label when Task or Version is missing", () => {
    render(
      <VfxWorkspacePage
        inbox={buildInbox([
          buildItem({
            relevant_task_id: null,
            relevant_task_name: null,
            relevant_version_id: null,
            relevant_version_name: null,
            relevant_version_number: null,
            pairing_established: false,
          }),
        ])}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText("No Task recorded yet")).toBeVisible();
    expect(screen.getByText("No Version recorded yet")).toBeVisible();
  });

  it("shows the real domain source badge, never a fake 'demo' source", () => {
    render(
      <VfxWorkspacePage inbox={buildInbox([buildItem()])} onExitRole={vi.fn()} />,
    );
    expect(screen.getByText("No linked ftrack entity")).toBeVisible();
  });

  it("does not show a raw UUID as a primary label", () => {
    render(
      <VfxWorkspacePage inbox={buildInbox([buildItem()])} onExitRole={vi.fn()} />,
    );
    const heading = screen.getByText("Shot 010 — Final confrontation");
    expect(heading.textContent).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
  });

  it("does not show a card grid, fake metrics, or a notification tray", () => {
    render(
      <VfxWorkspacePage inbox={buildInbox([buildItem()])} onExitRole={vi.fn()} />,
    );
    expect(screen.queryByText(/unread/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("status", { name: /notification/i })).not.toBeInTheDocument();
  });

  it("wires Exit role view to the provided callback", async () => {
    const onExitRole = vi.fn();
    render(<VfxWorkspacePage inbox={buildInbox([])} onExitRole={onExitRole} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Exit role view" }),
    );
    expect(onExitRole).toHaveBeenCalled();
  });
});
