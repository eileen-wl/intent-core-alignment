import type { VfxInboxItemRead, VfxInboxRead } from "@intent-core/contracts";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ShotsListPage } from "./ShotsListPage";

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
      focus_type: "none",
      title: "Nothing requires your attention on this Shot right now",
      explanation: "",
      target_route: "/vfx/shots/s1",
      primary_action_label: null,
      actionable: false,
    },
    next_candidates: [],
    sort_rank: 1,
    ...overrides,
  };
}

function buildInbox(items: VfxInboxItemRead[]): VfxInboxRead {
  return { items, generated_at: "2026-01-01T00:00:00Z" };
}

describe("ShotsListPage", () => {
  it("marks Shots current in the sidebar", () => {
    render(<ShotsListPage inbox={buildInbox([])} onExitRole={vi.fn()} />);
    expect(screen.getByRole("link", { name: "Shots" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("shows an honest error state when the Inbox failed to load", () => {
    render(<ShotsListPage inbox={null} onExitRole={vi.fn()} />);
    expect(screen.getByText("Shots is unavailable")).toBeVisible();
  });

  it("shows an honest empty state when there are no Shots at all", () => {
    render(<ShotsListPage inbox={buildInbox([])} onExitRole={vi.fn()} />);
    expect(screen.getByText("No Shots exist yet")).toBeVisible();
  });

  it("includes an uninitialized Shot (zero Core Anchor state) with no special hiding", () => {
    render(
      <ShotsListPage
        inbox={buildInbox([
          buildItem({
            shot_id: "uninit-1",
            shot_name: "Shot 020 — Awaiting creative intent",
            core_anchor_state: "none",
            relevant_task_name: null,
            relevant_task_id: null,
          }),
        ])}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText("Shot 020 — Awaiting creative intent")).toBeVisible();
    expect(screen.getByText("No Core Anchor", { selector: "span" })).toBeVisible();
  });

  it("filters by Project", async () => {
    render(
      <ShotsListPage
        inbox={buildInbox([
          buildItem({ shot_id: "s1", project_name: "D1 Demo Project", shot_name: "Shot A" }),
          buildItem({ shot_id: "s2", project_name: "Other Project", shot_name: "Shot B" }),
        ])}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText("Showing 2 of 2 Shots")).toBeVisible();

    const projectSelect = screen.getByLabelText("Project");
    await userEvent.selectOptions(projectSelect, "Other Project");

    expect(screen.getByText("Showing 1 of 2 Shots")).toBeVisible();
    expect(screen.getByText("Shot B")).toBeVisible();
    expect(screen.queryByText("Shot A")).not.toBeInTheDocument();
  });

  it("filters by Core Anchor state", async () => {
    render(
      <ShotsListPage
        inbox={buildInbox([
          buildItem({ shot_id: "s1", shot_name: "Shot A", core_anchor_state: "confirmed" }),
          buildItem({ shot_id: "s2", shot_name: "Shot B", core_anchor_state: "none" }),
        ])}
        onExitRole={vi.fn()}
      />,
    );

    const stateSelect = screen.getByLabelText("Core Anchor state");
    await userEvent.selectOptions(stateSelect, "confirmed");

    expect(screen.getByText("Showing 1 of 2 Shots")).toBeVisible();
    expect(screen.getByText("Shot A")).toBeVisible();
    expect(screen.queryByText("Shot B")).not.toBeInTheDocument();
  });

  it("shows an honest no-matches state when filters exclude every Shot", async () => {
    render(
      <ShotsListPage
        inbox={buildInbox([
          buildItem({ shot_id: "s1", project_name: "D1 Demo Project" }),
        ])}
        onExitRole={vi.fn()}
      />,
    );
    const projectSelect = screen.getByLabelText("Project");
    await userEvent.selectOptions(projectSelect, "D1 Demo Project");
    const stateSelect = screen.getByLabelText("Core Anchor state");
    await userEvent.selectOptions(stateSelect, "draft_pending");

    expect(screen.getByText("No Shots match these filters")).toBeVisible();
  });

  it("opening a row goes to the Shot's own Overview", () => {
    render(
      <ShotsListPage inbox={buildInbox([buildItem({ shot_id: "s1" })])} onExitRole={vi.fn()} />,
    );
    const links = screen.getAllByRole("link");
    expect(links.some((link) => link.getAttribute("href") === "/vfx/shots/s1")).toBe(true);
  });
});
