import type { VfxInboxItemRead, VfxInboxRead } from "@intent-core/contracts";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReviewInboxPage } from "./ReviewInboxPage";

afterEach(() => {
  cleanup();
});

function buildItem(
  overrides: Partial<VfxInboxItemRead> = {},
): VfxInboxItemRead {
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
      explanation:
        "A proposed revision to the shared creative intent is ready for your review.",
      target_route: "/vfx/shots/s1/intent",
      primary_action_label: "Review and confirm",
      actionable: true,
    },
    next_candidates: [],
    sort_rank: 1,
    ...overrides,
  };
}

function inactiveItem(
  overrides: Partial<VfxInboxItemRead> = {},
): VfxInboxItemRead {
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
    expect(screen.getByRole("link", { name: "Review Inbox" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("shows an honest error state when the Inbox failed to load", () => {
    render(<ReviewInboxPage inbox={null} onExitRole={vi.fn()} />);
    expect(screen.getByText("Review Inbox is unavailable")).toBeVisible();
  });

  it("shows an honest clear-inbox empty state when no work items exist, with a route to Shots", () => {
    render(
      <ReviewInboxPage
        inbox={buildInbox([inactiveItem({ shot_id: "s2" })])}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText("Review Inbox is clear")).toBeVisible();
    expect(
      screen.getByText(
        "No review or interpretation currently requires your attention.",
      ),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Browse Shots →" }),
    ).toHaveAttribute("href", "/vfx/shots");
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
    expect(
      screen.getByText("Core Anchor draft awaiting your confirmation"),
    ).toBeVisible();
  });

  it("shows the honest category as the group heading and Shot as row-level supporting context, not the primary title", () => {
    render(
      <ReviewInboxPage
        inbox={buildInbox([buildItem({ shot_id: "s1" })])}
        onExitRole={vi.fn()}
      />,
    );
    // Category identity lives once, at the group heading -- rows no
    // longer repeat it (consistency correction: same category was
    // previously duplicated on every row underneath).
    expect(
      screen.getByRole("heading", { name: /Core Anchor confirmation/ }),
    ).toBeVisible();
    const title = screen.getByText(
      "Core Anchor draft awaiting your confirmation",
    );
    const row = title.closest("a");
    expect(row).toHaveTextContent("Shot 010 — Final confrontation");
    // Shot name must not itself be the row's <a> accessible name lead --
    // the required-action title comes first in reading order.
    expect(
      row?.textContent?.indexOf("Core Anchor draft awaiting your confirmation"),
    ).toBeLessThan(
      row?.textContent?.indexOf("Shot 010 — Final confrontation") ?? -1,
    );
  });

  it("never fabricates HumanGate/Assessment/Proposal/Decision language on a work-item row", () => {
    render(
      <ReviewInboxPage
        inbox={buildInbox([buildItem({ shot_id: "s1" })])}
        onExitRole={vi.fn()}
      />,
    );
    const row = screen
      .getByText("Core Anchor draft awaiting your confirmation")
      .closest("a");
    for (const forbidden of [
      "HumanGate",
      "Human Gate",
      "Decision",
      "Escalat",
      "Proposal",
    ]) {
      expect(row?.textContent ?? "").not.toMatch(new RegExp(forbidden, "i"));
    }
  });

  it("routes Core Anchor work to Intent, and alignment-family work to Alignment", () => {
    render(
      <ReviewInboxPage
        inbox={buildInbox([
          buildItem({
            shot_id: "s1",
            current_focus: {
              focus_type: "core_anchor_draft_needs_review",
              title: "Core Anchor draft in progress",
              explanation:
                "A draft revision exists but has not yet been submitted for confirmation.",
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
              explanation:
                "The latest assessment includes an advisory suggestion for the Core Anchor.",
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
      screen
        .getByText("Re-anchor proposal available for consideration")
        .closest("a"),
    ).toHaveAttribute("href", "/vfx/shots/s2/alignment");
  });

  it("falls back to Shot Overview for an unsupported focus type", () => {
    render(
      <ReviewInboxPage
        inbox={buildInbox([
          buildItem({
            shot_id: "s3",
            shot_name: "Shot 030",
            current_focus: {
              // Cast: a focus_type the frontend does not (yet) recognise as
              // Core Anchor or Alignment family -- proving the honest,
              // safe default rather than assuming every future type is
              // Alignment-related.
              focus_type: "some_future_focus_type" as never,
              title: "Some future work",
              explanation: "explanation",
              target_route: "/vfx/shots/s3/somewhere-unbuilt",
              primary_action_label: "Do something",
              actionable: true,
            },
          }),
        ])}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText("Some future work").closest("a")).toHaveAttribute(
      "href",
      "/vfx/shots/s3",
    );
  });

  it("surfaces a real Version-review work item, routed to Versions, alongside current_focus items", () => {
    render(
      <ReviewInboxPage
        inbox={buildInbox([
          buildItem({
            shot_id: "s1",
            latest_version_without_review_id: "v9",
            latest_version_without_review_name: "SH010_v002",
            latest_version_without_review_number: 2,
          }),
        ])}
        onExitRole={vi.fn()}
      />,
    );
    // The Shot's current_focus item and the new version_review item both
    // appear -- two independent work items for the same Shot.
    expect(screen.getByText("Showing 2 items requiring review")).toBeVisible();
    expect(
      screen.getByText("New Production Version awaiting review"),
    ).toBeVisible();
    expect(
      screen.getByText("New Production Version awaiting review").closest("a"),
    ).toHaveAttribute("href", "/vfx/shots/s1/versions");
  });

  it("labels a Version review as blocked when Core Anchor readiness is missing", () => {
    render(
      <ReviewInboxPage
        inbox={buildInbox([
          inactiveItem({
            core_anchor_state: "none",
            latest_version_without_review_id: "v9",
            latest_version_without_review_name: "SH010_v002",
            latest_version_without_review_number: 2,
          }),
        ])}
        onExitRole={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: /Version review blocked/ }),
    ).toBeVisible();
    expect(
      screen.getByText("Core Anchor required before Version review"),
    ).toBeVisible();
    expect(
      screen
        .getByText("Core Anchor required before Version review")
        .closest("a"),
    ).toHaveAttribute("href", "/vfx/shots/s1/intent");
    expect(
      screen
        .getByText("Core Anchor required before Version review")
        .closest("a"),
    ).toHaveTextContent("Open Intent");
    expect(screen.getAllByText(/SH010_v002/).length).toBeGreaterThan(0);
  });

  it("never surfaces a Version-review item for a Shot the backend did not flag (not every Version is actionable)", () => {
    render(
      <ReviewInboxPage
        inbox={buildInbox([
          inactiveItem({
            shot_id: "s2",
            relevant_version_id: "v1",
            relevant_version_name: "SH010_v001",
          }),
        ])}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText("Review Inbox is clear")).toBeVisible();
    expect(
      screen.queryByText("New Production Version awaiting review"),
    ).not.toBeInTheDocument();
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
    expect(
      screen.getByText("Core Anchor draft awaiting your confirmation"),
    ).toBeVisible();
    expect(
      screen.getByText("Re-anchor proposal available for consideration"),
    ).toBeVisible();
  });

  it("groups work items under their own honest category as a heading", () => {
    render(
      <ReviewInboxPage
        inbox={buildInbox([
          buildItem({ shot_id: "s1" }),
          buildItem({
            shot_id: "s2",
            current_focus: {
              focus_type: "re_anchor_proposal_present",
              title: "Re-anchor proposal available for consideration",
              explanation: "explanation",
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
      screen.getByRole("heading", {
        name: "Core Anchor confirmation — 1 item",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", {
        name: "Alignment interpretation — 1 item",
      }),
    ).toBeVisible();
  });

  it("always shows the Project filter, even when every work item shares one Project", () => {
    render(
      <ReviewInboxPage
        inbox={buildInbox([buildItem({ shot_id: "s1" })])}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("combobox", { name: "Project" }),
    ).toBeInTheDocument();
  });

  it("always shows the Core Anchor state filter", () => {
    render(
      <ReviewInboxPage
        inbox={buildInbox([buildItem({ shot_id: "s1" })])}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("combobox", { name: "Core Anchor state" }),
    ).toBeInTheDocument();
  });

  it("filters work items to the selected Core Anchor state", () => {
    render(
      <ReviewInboxPage
        inbox={buildInbox([
          buildItem({ shot_id: "s1", core_anchor_state: "confirmed" }),
          buildItem({
            shot_id: "s2",
            core_anchor_state: "draft_pending",
            current_focus: {
              focus_type: "core_anchor_draft_needs_review",
              title: "Core Anchor draft in progress",
              explanation: "explanation",
              target_route: "/vfx/shots/s2/intent",
              primary_action_label: "Review draft",
              actionable: true,
            },
          }),
        ])}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText("Showing 2 items requiring review")).toBeVisible();

    fireEvent.change(
      screen.getByRole("combobox", { name: "Core Anchor state" }),
      { target: { value: "confirmed" } },
    );

    expect(screen.getByText("Showing 1 items requiring review")).toBeVisible();
    expect(
      screen.getByText("Core Anchor draft awaiting your confirmation"),
    ).toBeVisible();
  });

  it("filters work items to the selected Project", () => {
    render(
      <ReviewInboxPage
        inbox={buildInbox([
          buildItem({ shot_id: "s1", project_id: "p1", project_name: "Alpha" }),
          buildItem({ shot_id: "s2", project_id: "p2", project_name: "Beta" }),
        ])}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText("Showing 2 items requiring review")).toBeVisible();

    fireEvent.change(screen.getByRole("combobox", { name: "Project" }), {
      target: { value: "Alpha" },
    });

    expect(screen.getByText("Showing 1 items requiring review")).toBeVisible();
  });

  it("shows the current worklist state before the filter controls (Worklist archetype target hierarchy)", () => {
    render(
      <ReviewInboxPage
        inbox={buildInbox([buildItem({ shot_id: "s1" })])}
        onExitRole={vi.fn()}
      />,
    );
    const state = screen.getByText("Showing 1 items requiring review");
    const projectFilter = screen.getByRole("combobox", { name: "Project" });
    expect(
      state.compareDocumentPosition(projectFilter) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("drops the per-row Anchor Context summary panel (Worklist archetype density: no nested cards, no five-column blocks) while still routing correctly", () => {
    render(
      <ReviewInboxPage
        inbox={buildInbox([buildItem({ shot_id: "s1" })])}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.queryByText("Anchor context unavailable"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Readiness")).not.toBeInTheDocument();
    // The row itself is unaffected: title, category, and route remain.
    expect(
      screen.getByText("Core Anchor draft awaiting your confirmation"),
    ).toBeVisible();
  });

  it("shows the real Core Anchor state as a compact status badge on the row, with the object made explicit so it cannot be misread as the work item or Version itself being confirmed", () => {
    render(
      <ReviewInboxPage
        inbox={buildInbox([
          buildItem({ shot_id: "s1", core_anchor_state: "confirmed" }),
        ])}
        onExitRole={vi.fn()}
      />,
    );
    const row = screen
      .getByText("Core Anchor draft awaiting your confirmation")
      .closest("a") as HTMLElement;
    expect(within(row).getByText("Core Anchor confirmed")).toBeVisible();
    expect(within(row).queryByText("Confirmed")).not.toBeInTheDocument();
  });

  it("labels each real Core Anchor state explicitly, never a bare ambiguous word", () => {
    render(
      <ReviewInboxPage
        inbox={buildInbox([
          buildItem({ shot_id: "s1", core_anchor_state: "draft_pending" }),
        ])}
        onExitRole={vi.fn()}
      />,
    );
    const row = screen
      .getByText("Core Anchor draft awaiting your confirmation")
      .closest("a") as HTMLElement;
    expect(within(row).getByText("Core Anchor draft pending")).toBeVisible();
  });

  it("renders the work-item type icon once, on the group heading, and no longer repeats a category kicker/icon on every row underneath (consistency correction: the list is already grouped by category)", () => {
    render(
      <ReviewInboxPage
        inbox={buildInbox([buildItem({ shot_id: "s1" })])}
        onExitRole={vi.fn()}
      />,
    );
    const row = screen
      .getByText("Core Anchor draft awaiting your confirmation")
      .closest("a") as HTMLElement;
    expect(row.querySelector("svg")).toBeNull();
    expect(within(row).queryByText("Core Anchor confirmation")).toBeNull();

    const heading = screen.getByRole("heading", {
      name: "Core Anchor confirmation — 1 item",
    });
    expect(heading.querySelector("svg")).toBeTruthy();
  });

  it("normalizes production context to a single Project · Shot · Task · Version order with one consistent separator", () => {
    render(
      <ReviewInboxPage
        inbox={buildInbox([buildItem({ shot_id: "s1" })])}
        onExitRole={vi.fn()}
      />,
    );
    const row = screen
      .getByText("Core Anchor draft awaiting your confirmation")
      .closest("a") as HTMLElement;
    expect(
      within(row).getByText(
        "D1 Demo Project · Shot 010 — Final confrontation · Compositing Review · D1_STEP3_VFX_REVIEW_001 (v1)",
      ),
    ).toBeVisible();
  });

  it("shows ftrack linkage as quiet plain text, not a strong-cyan integration badge", () => {
    render(
      <ReviewInboxPage
        inbox={buildInbox([buildItem({ shot_id: "s1" })])}
        onExitRole={vi.fn()}
      />,
    );
    const row = screen
      .getByText("Core Anchor draft awaiting your confirmation")
      .closest("a") as HTMLElement;
    expect(within(row).getByText("No linked ftrack entity")).toBeVisible();
    // The Core Anchor badge is still a real StatusBadge (it must
    // outrank ftrack metadata); ftrack no longer shares that treatment.
    expect(
      within(row).getByText("No linked ftrack entity").closest("span")
        ?.className,
    ).not.toMatch(/badge/);
  });

  it("uses the work item's own real action label for a Version review item, never a different Shot concern's Anchor Context hint (e.g. 'Review alignment')", () => {
    render(
      <ReviewInboxPage
        inbox={buildInbox([
          buildItem({
            shot_id: "s1",
            latest_version_without_review_id: "v9",
            latest_version_without_review_name: "SH010_v002",
            latest_version_without_review_number: 2,
          }),
        ])}
        anchorContexts={{
          s1: {
            role: "vfx_supervisor",
            shot_id: "s1",
            task_id: null,
            core_anchor_revision_number: 1,
            core_anchor_state: "confirmed",
            core_direction: null,
            execution_context_state: null,
            execution_anchor_revision_number: null,
            execution_direction: null,
            based_on_core_anchor_revision_number: null,
            attention_level: "high",
            attention_summary: null,
            guidance_state: "current",
            readiness_state: "action_required",
            readiness_detail: "",
            open_vfx_escalation: false,
            next_action: {
              title: "Interpret the cross-role assessment",
              why_now: "",
              downstream_effect: "",
              target_route: "/vfx/shots/s1/alignment",
              action_label: "Review alignment",
              executable: true,
            },
          },
        }}
        onExitRole={vi.fn()}
      />,
    );
    const versionRow = screen
      .getByText("New Production Version awaiting review")
      .closest("a") as HTMLElement;
    expect(within(versionRow).getByText(/Review Version/)).toBeVisible();
    expect(
      within(versionRow).queryByText(/Review alignment/),
    ).not.toBeInTheDocument();
    expect(versionRow).toHaveAttribute("href", "/vfx/shots/s1/versions");
  });
});
