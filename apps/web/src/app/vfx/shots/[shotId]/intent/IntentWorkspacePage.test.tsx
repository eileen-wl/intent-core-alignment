import type {
  CoreAnchorRevisionRead,
  VfxInboxItemRead,
} from "@intent-core/contracts";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/vfx/shots/s1/intent",
}));

vi.mock("@/features/vfx/intent-workspace/actions", () => ({
  confirmCoreAnchorRevisionAction: vi.fn(),
  rejectCoreAnchorRevisionAction: vi.fn(),
  saveCoreAnchorDraftAction: vi.fn(),
  createCoreAnchorDraftFromConfirmedAction: vi.fn(),
  startBlankCoreAnchorDraftAction: vi.fn(),
}));

import type { IntentWorkspaceData } from "@/features/vfx/intent-workspace/data";
import { IntentWorkspacePage } from "./IntentWorkspacePage";

afterEach(() => {
  cleanup();
});

function item(overrides: Partial<VfxInboxItemRead> = {}): VfxInboxItemRead {
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
    sort_rank: 0,
    ...overrides,
  };
}

function revision(
  overrides: Partial<CoreAnchorRevisionRead> = {},
): CoreAnchorRevisionRead {
  return {
    id: "r1",
    core_anchor_id: "a1",
    revision_number: 1,
    status: "confirmed",
    shot_objective: null,
    emotional_tone: null,
    visual_focus: null,
    rhythm_intensity: null,
    character_relationship: null,
    narrative_priority: null,
    core_summary: "A restrained dusk confrontation.",
    created_by_actor_kind: "human",
    created_by_actor_id: "vfx-1",
    created_by_human_role: "vfx_supervisor",
    created_by_agent_type: null,
    created_by_agent_run_id: null,
    context_snapshot_id: null,
    confirmed_by_human_role: "vfx_supervisor",
    confirmed_by_actor_id: "vfx-1",
    confirmed_at: "2026-01-01T00:00:00Z",
    supersedes_revision_id: null,
    source_intent_decomposition_id: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    constraints: [],
    variation_zones: [],
    drift_risks: [],
    references: [],
    open_questions: [],
    ...overrides,
  };
}

describe("IntentWorkspacePage", () => {
  it("shows an honest unavailable state when the API could not be reached", () => {
    render(
      <IntentWorkspacePage
        shotId="s1"
        data={null}
        unavailable
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText("This Shot is unavailable")).toBeVisible();
  });

  it("shows an honest not-found state, distinct from unavailable, for a real 404", () => {
    render(
      <IntentWorkspacePage
        shotId="s1"
        data={null}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText("This Shot could not be found")).toBeVisible();
  });

  it("renders the confirmed-only state with a Create new revision action and no draft column", () => {
    const data: IntentWorkspaceData = {
      item: item(),
      confirmedRevision: revision(),
      draftRevision: null,
      draftHumanGate: null,
      evidenceData: {
        evidence: [],
        run: null,
        snapshot: null,
        decompositions: [],
        reconstructions: [],
      },
      previousConfirmedRevision: null,
      confirmedDecisionRationale: null,
    };
    render(
      <IntentWorkspacePage
        shotId="s1"
        data={data}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText("A restrained dusk confrontation.")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Create new revision" }),
    ).toBeVisible();
    // No empty second (draft) column anywhere on the confirmed-only state.
    expect(screen.queryByText("Proposed draft")).not.toBeInTheDocument();
    // NORMAL CONFIRMED (justConfirmed=false, the default): "Create new
    // revision" is the only action -- Return to Shot Overview is a
    // Just-confirmed Success-only action.
    expect(
      screen.queryByRole("link", { name: "Return to Shot Overview" }),
    ).not.toBeInTheDocument();
  });

  it("JUST-CONFIRMED SUCCESS: renders Return to Shot Overview (primary, targets the Shot Overview route) alongside Create new revision (secondary), never as the only action", () => {
    const data: IntentWorkspaceData = {
      item: item(),
      confirmedRevision: revision(),
      draftRevision: null,
      draftHumanGate: null,
      evidenceData: {
        evidence: [],
        run: null,
        snapshot: null,
        decompositions: [],
        reconstructions: [],
      },
      previousConfirmedRevision: null,
      confirmedDecisionRationale: null,
    };
    render(
      <IntentWorkspacePage
        shotId="s1"
        data={data}
        unavailable={false}
        justConfirmed
        onExitRole={vi.fn()}
      />,
    );
    const returnLink = screen.getByRole("link", {
      name: "Return to Shot Overview",
    });
    expect(returnLink).toBeVisible();
    expect(returnLink).toHaveAttribute("href", "/vfx/shots/s1");
    expect(
      screen.getByRole("button", { name: "Create new revision" }),
    ).toBeVisible();
  });

  it("renders the never-confirmed, no-draft state with a dominant first-draft action", () => {
    const data: IntentWorkspaceData = {
      item: item({
        core_anchor_state: "none",
        active_core_anchor_revision_id: null,
      }),
      confirmedRevision: null,
      draftRevision: null,
      draftHumanGate: null,
      evidenceData: null,
      previousConfirmedRevision: null,
      confirmedDecisionRationale: null,
    };
    render(
      <IntentWorkspacePage
        shotId="s1"
        data={data}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "No Core Anchor yet" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Create first Core Anchor draft" }),
    ).toBeVisible();
  });

  it("INITIAL EMPTY: prioritizes first-draft creation and shows only honest supporting context", () => {
    const data: IntentWorkspaceData = {
      item: item({
        core_anchor_state: "none",
        active_core_anchor_revision_id: null,
      }),
      confirmedRevision: null,
      draftRevision: null,
      draftHumanGate: null,
      evidenceData: null,
      previousConfirmedRevision: null,
      confirmedDecisionRationale: null,
    };
    render(
      <IntentWorkspacePage
        shotId="s1"
        data={data}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "No Core Anchor yet" }),
    ).toBeVisible();
    expect(screen.getByText("Review available Shot context")).toBeVisible();
    expect(
      screen.getByText("Create the first Core Anchor draft"),
    ).toBeVisible();
    expect(screen.getByText("Confirm with the VFX Supervisor")).toBeVisible();
    expect(screen.getByText("Optional Agent support")).toBeVisible();
    expect(screen.getByText("Source of creative intent")).toBeVisible();
    // Real Shot context (Project/Task), never fabricated. "D1 Demo
    // Project" also appears in the breadcrumb -- assert at least one
    // instance rather than assuming a single match.
    expect(screen.getAllByText("D1 Demo Project").length).toBeGreaterThan(0);
    // Also appears in the Shot Context Header's own Task fact.
    expect(screen.getAllByText("Compositing Review").length).toBeGreaterThan(0);
    // No source evidence has been loaded yet for a Shot with neither a
    // draft nor a confirmed revision -- an honest gap, not a fabricated
    // decomposition/reconstruction summary.
    expect(
      screen.getByText(
        /No creative-intent source or supporting evidence is linked/,
      ),
    ).toBeVisible();
    expect(screen.queryByText(/HumanGate/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/View full revision history/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /View intent brief/i }),
    ).not.toBeInTheDocument();
  });

  it("renders FIRST DRAFT (no confirmed revision, one draft) without any Current confirmed column", () => {
    const data: IntentWorkspaceData = {
      item: item({
        core_anchor_state: "draft_pending",
        active_core_anchor_revision_id: null,
      }),
      confirmedRevision: null,
      draftRevision: revision({
        id: "r1",
        status: "draft",
        revision_number: 1,
      }),
      draftHumanGate: {
        id: "gate-1",
        shot_id: "s1",
        core_anchor_revision_id: "r1",
        execution_anchor_revision_id: null,
        gate_type: "core_anchor_confirmation",
        required_role: "vfx_supervisor",
        status: "pending",
        opened_at: "2026-01-01T00:00:00Z",
        resolved_at: null,
        resolved_by_actor_id: null,
        resolved_by_role: null,
        resolved_by_actor_type: null,
        rationale: null,
        decision_id: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      evidenceData: null,
      previousConfirmedRevision: null,
      confirmedDecisionRationale: null,
    };
    render(
      <IntentWorkspacePage
        shotId="s1"
        data={data}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText("Create the first Core Anchor")).toBeVisible();
    // Locked FIRST DRAFT requirement: no "Current" confirmed-revision
    // column at all, not even a falsely-labelled empty one -- REVISION
    // DRAFT must never be mistaken for FIRST DRAFT or vice versa.
    expect(screen.queryByText(/^Current:/)).not.toBeInTheDocument();
    expect(
      screen.queryByText("No Core Anchor confirmed yet."),
    ).not.toBeInTheDocument();
  });

  it("renders REVISION DRAFT (confirmed + newer draft) via CoreAnchorRevisionEditor", () => {
    const data: IntentWorkspaceData = {
      item: item(),
      confirmedRevision: revision(),
      draftRevision: revision({
        id: "r2",
        status: "draft",
        revision_number: 2,
      }),
      draftHumanGate: {
        id: "gate-1",
        shot_id: "s1",
        core_anchor_revision_id: "r2",
        execution_anchor_revision_id: null,
        gate_type: "core_anchor_confirmation",
        required_role: "vfx_supervisor",
        status: "pending",
        opened_at: "2026-01-01T00:00:00Z",
        resolved_at: null,
        resolved_by_actor_id: null,
        resolved_by_role: null,
        resolved_by_actor_type: null,
        rationale: null,
        decision_id: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      evidenceData: {
        evidence: [],
        run: null,
        snapshot: null,
        decompositions: [],
        reconstructions: [],
      },
      previousConfirmedRevision: null,
      confirmedDecisionRationale: null,
    };
    render(
      <IntentWorkspacePage
        shotId="s1"
        data={data}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText("Current: Revision 1 · Confirmed")).toBeVisible();
    expect(
      screen.getByText("Proposed: Revision 2 · Draft in progress"),
    ).toBeVisible();
  });

  it("Reject with no confirmed revision: the next data load (draft gone) returns to INITIAL EMPTY", () => {
    // Models the read model exactly as it looks the moment after a
    // Reject on a Shot that had never had a confirmed Core Anchor --
    // the rejected revision is no longer `status: "draft"`, so it is
    // simply absent from this data, same as any other never-confirmed
    // Shot.
    const data: IntentWorkspaceData = {
      item: item({
        core_anchor_state: "none",
        active_core_anchor_revision_id: null,
      }),
      confirmedRevision: null,
      draftRevision: null,
      draftHumanGate: null,
      evidenceData: null,
      previousConfirmedRevision: null,
      confirmedDecisionRationale: null,
    };
    render(
      <IntentWorkspacePage
        shotId="s1"
        data={data}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "No Core Anchor yet" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Create first Core Anchor draft" }),
    ).toBeVisible();
  });

  it("Reject with a confirmed revision already active: the next data load (draft gone) returns to NORMAL CONFIRMED", () => {
    // Models the read model the moment after rejecting a REVISION DRAFT
    // -- the previously confirmed revision is untouched and still
    // active; only the rejected draft is gone.
    const data: IntentWorkspaceData = {
      item: item(),
      confirmedRevision: revision(),
      draftRevision: null,
      draftHumanGate: null,
      evidenceData: {
        evidence: [],
        run: null,
        snapshot: null,
        decompositions: [],
        reconstructions: [],
      },
      previousConfirmedRevision: null,
      confirmedDecisionRationale: null,
    };
    render(
      <IntentWorkspacePage
        shotId="s1"
        data={data}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText("A restrained dusk confrontation.")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Create new revision" }),
    ).toBeVisible();
    expect(screen.queryByText("Proposed draft")).not.toBeInTheDocument();
    // Not the transient success presentation -- Reject never sets it.
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("renders exactly the 'Intent' tab as active", () => {
    const data: IntentWorkspaceData = {
      item: item(),
      confirmedRevision: revision(),
      draftRevision: null,
      draftHumanGate: null,
      evidenceData: {
        evidence: [],
        run: null,
        snapshot: null,
        decompositions: [],
        reconstructions: [],
      },
      previousConfirmedRevision: null,
      confirmedDecisionRationale: null,
    };
    render(
      <IntentWorkspacePage
        shotId="s1"
        data={data}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByRole("link", { name: "Intent" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("shows the compact authority line naming the Human VFX Supervisor", () => {
    const data: IntentWorkspaceData = {
      item: item(),
      confirmedRevision: revision(),
      draftRevision: null,
      draftHumanGate: null,
      evidenceData: {
        evidence: [],
        run: null,
        snapshot: null,
        decompositions: [],
        reconstructions: [],
      },
      previousConfirmedRevision: null,
      confirmedDecisionRationale: null,
    };
    render(
      <IntentWorkspacePage
        shotId="s1"
        data={data}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText(/owns Core Anchor confirmation/)).toBeVisible();
  });

  it("shows Evidence and Decomposition/Reconstruction as two independent collapsed disclosures", () => {
    const data: IntentWorkspaceData = {
      item: item(),
      confirmedRevision: revision(),
      draftRevision: null,
      draftHumanGate: null,
      evidenceData: {
        evidence: [],
        run: null,
        snapshot: null,
        decompositions: [],
        reconstructions: [],
      },
      previousConfirmedRevision: null,
      confirmedDecisionRationale: null,
    };
    const { container } = render(
      <IntentWorkspacePage
        shotId="s1"
        data={data}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    const details = container.querySelectorAll("details");
    expect(details.length).toBe(2);
    for (const detail of details) {
      expect(detail).not.toHaveAttribute("open");
    }
    // Never nested -- a <details> never contains another <details>.
    for (const detail of details) {
      expect(within(detail as HTMLElement).queryAllByRole("group")).toEqual([]);
    }
  });
});
