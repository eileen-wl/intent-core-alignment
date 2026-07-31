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

  it("renders the VFX role sidebar with Workspace Home current", () => {
    render(<VfxWorkspacePage inbox={buildInbox([])} onExitRole={vi.fn()} />);
    expect(
      screen.getByRole("link", { name: "Workspace Home" }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("shows the Workspace Home title", () => {
    render(<VfxWorkspacePage inbox={buildInbox([])} onExitRole={vi.fn()} />);
    expect(
      screen.getByRole("heading", { name: "Workspace Home" }),
    ).toBeVisible();
  });

  it("shows an honest empty state when there are no Shots", () => {
    render(<VfxWorkspacePage inbox={buildInbox([])} onExitRole={vi.fn()} />);
    expect(screen.getByText("No Shots exist yet")).toBeVisible();
  });

  it("shows an honest error state when the Inbox failed to load", () => {
    render(<VfxWorkspacePage inbox={null} onExitRole={vi.fn()} />);
    expect(screen.getByText("Workspace Home is unavailable")).toBeVisible();
    expect(screen.queryByText("No Shots exist yet")).not.toBeInTheDocument();
  });

  it("shows real summary counts, never fabricated metrics", () => {
    render(
      <VfxWorkspacePage
        inbox={buildInbox([
          buildItem(),
          buildItem({
            shot_id: "s2",
            latest_signal_attention_level: null,
            current_focus: {
              focus_type: "none",
              title: "Nothing requires your attention on this Shot right now",
              explanation: "",
              target_route: "/vfx/shots/s2",
              primary_action_label: null,
              actionable: false,
            },
          }),
        ])}
        onExitRole={vi.fn()}
      />,
    );
    const totalCard = screen.getByText("Total Shots").closest("div") as HTMLElement;
    expect(totalCard).toHaveTextContent("2");
    expect(screen.getByText("Requiring attention")).toBeVisible();
  });

  it("lists at most the 5 most important Shots, in the backend's real priority order", () => {
    const items = Array.from({ length: 7 }, (_, i) =>
      buildItem({ shot_id: `s${i}`, shot_name: `Shot ${i}`, sort_rank: 7 - i }),
    );
    const { container } = render(
      <VfxWorkspacePage inbox={buildInbox(items)} onExitRole={vi.fn()} />,
    );
    const rows = container.querySelectorAll('main div[role="list"] > [role="listitem"]');
    expect(rows.length).toBe(5);
    expect(screen.getByText("Shot 0")).toBeVisible();
    expect(screen.queryByText("Shot 6")).not.toBeInTheDocument();
  });

  it("links into Review Inbox and Shots", () => {
    render(
      <VfxWorkspacePage inbox={buildInbox([buildItem()])} onExitRole={vi.fn()} />,
    );
    expect(
      screen.getByRole("link", { name: "Go to Review Inbox →" }),
    ).toHaveAttribute("href", "/vfx/inbox");
    expect(
      screen.getAllByRole("link", { name: /Shots/ }).some((link) => link.getAttribute("href") === "/vfx/shots"),
    ).toBe(true);
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
