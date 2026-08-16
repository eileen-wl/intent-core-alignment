import type {
  AnchorContextRead,
  CgInboxItemRead,
  DecisionRead,
  ExecutionAnchorRevisionRead,
} from "@intent-core/contracts";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/cg/tasks/t1/execution",
}));

const {
  createExecutionAnchorDraftActionMock,
  createExecutionAnchorDraftFromConfirmedActionMock,
  generateExecutionAnchorDraftActionMock,
  saveExecutionAnchorDraftActionMock,
  confirmExecutionAnchorRevisionActionMock,
  rejectExecutionAnchorRevisionActionMock,
} = vi.hoisted(() => ({
  createExecutionAnchorDraftActionMock: vi.fn(),
  createExecutionAnchorDraftFromConfirmedActionMock: vi.fn(),
  generateExecutionAnchorDraftActionMock: vi.fn(),
  saveExecutionAnchorDraftActionMock: vi.fn(),
  confirmExecutionAnchorRevisionActionMock: vi.fn(),
  rejectExecutionAnchorRevisionActionMock: vi.fn(),
}));
vi.mock("@/features/cg/actions", () => ({
  createExecutionAnchorDraftAction: createExecutionAnchorDraftActionMock,
  createExecutionAnchorDraftFromConfirmedAction:
    createExecutionAnchorDraftFromConfirmedActionMock,
  generateExecutionAnchorDraftAction: generateExecutionAnchorDraftActionMock,
  saveExecutionAnchorDraftAction: saveExecutionAnchorDraftActionMock,
  confirmExecutionAnchorRevisionAction:
    confirmExecutionAnchorRevisionActionMock,
  rejectExecutionAnchorRevisionAction: rejectExecutionAnchorRevisionActionMock,
}));

import type { ExecutionWorkspaceData } from "@/features/cg/execution-workspace/data";
import { ExecutionPage } from "./ExecutionPage";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function item(overrides: Partial<CgInboxItemRead> = {}): CgInboxItemRead {
  return {
    task_id: "t1",
    task_name: "Lighting Pass",
    department: "lighting",
    task_source: "manual",
    shot_id: "s1",
    shot_name: "Shot 010",
    project_id: "p1",
    project_name: "D1 Demo Project",
    execution_anchor_state: "none",
    active_execution_anchor_revision_id: null,
    active_execution_anchor_summary: null,
    pending_human_gate_id: null,
    latest_version_id: null,
    latest_version_name: null,
    latest_version_number: null,
    open_dependency_count: 0,
    current_focus: {
      focus_type: "none",
      title: "Nothing requires your attention on this Task right now",
      explanation: "Nothing requires your attention on this Task right now.",
      target_route: "/cg/tasks/t1",
      primary_action_label: null,
      actionable: false,
    },
    sort_rank: 0,
    ...overrides,
  };
}

function revision(
  overrides: Partial<ExecutionAnchorRevisionRead> = {},
): ExecutionAnchorRevisionRead {
  return {
    id: "r1",
    execution_anchor_id: "ea1",
    core_anchor_revision_id: "cr1",
    revision_number: 1,
    status: "draft",
    technical_boundaries: "24fps, no motion blur.",
    parameter_ranges: null,
    delivery_conditions: null,
    production_ready_criteria: null,
    downstream_dependencies: null,
    publish_requirements: null,
    allowed_refinements: null,
    escalation_conditions: null,
    created_by_actor_kind: "human",
    created_by_actor_id: "cg-1",
    created_by_human_role: "cg_supervisor",
    created_by_agent_type: null,
    created_by_agent_run_id: null,
    confirmed_by_human_role: null,
    confirmed_by_actor_id: null,
    confirmed_at: null,
    supersedes_revision_id: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function decision(overrides: Partial<DecisionRead> = {}): DecisionRead {
  return {
    id: "d1",
    decision_type: "confirm_execution_anchor",
    owning_human_role: "cg_supervisor",
    actor_kind: "human",
    actor_id: "cg-1",
    actor_human_role: "cg_supervisor",
    rationale: "Matches the confirmed Core Anchor exactly.",
    entity_type: "execution_anchor_revision",
    entity_id: "r1",
    write_back_requested: false,
    supersedes_decision_id: null,
    created_at: "2026-01-02T00:00:00Z",
    ...overrides,
  };
}

function data(
  overrides: Partial<ExecutionWorkspaceData> = {},
): ExecutionWorkspaceData {
  return {
    item: item(),
    confirmedRevision: null,
    draftRevision: null,
    draftHumanGate: null,
    coreAnchorConfirmed: true,
    confirmDecision: null,
    ...overrides,
  };
}

/** A confirmed Execution Anchor R1 whose own upstream Core Anchor has
 * since been superseded by a confirmed R2 -- the real J3 owner-
 * validation state (`execution_anchor.context_state === "outdated"`). */
function outdatedAnchorContext(): AnchorContextRead {
  return {
    role: "cg_supervisor",
    shot_id: "s1",
    task_id: "t1",
    core_anchor: {
      exists: true,
      lifecycle_state: "confirmed",
      confirmed_revision_id: "ca2",
      confirmed_revision_number: 2,
      direction_summary: "Cap combined intensity.",
      must_preserve: "Restrained threat.",
      allowed_variation: null,
      confirmed_by_human_role: "vfx_supervisor",
      confirmed_by_actor_id: "vfx-1",
      link_target: "/vfx/shots/s1/intent",
      newer_draft_exists: false,
      pending_human_gate_exists: false,
      draft_revision_number: null,
    },
    execution_anchor: {
      exists: true,
      department: "lighting",
      lifecycle_state: "confirmed",
      context_state: "outdated",
      confirmed_revision_id: "r1",
      confirmed_revision_number: 1,
      direction_summary: "Keep faces readable without a heroic lift.",
      execution_boundary: "Stay within the approved exposure range.",
      allowed_refinement: "Refine local fill only.",
      based_on_core_anchor_revision_id: "ca1",
      based_on_core_anchor_revision_number: 1,
      upstream_relationship_available: true,
      confirmed_by_human_role: "cg_supervisor",
      confirmed_by_actor_id: "cg-1",
      link_target: "/cg/tasks/t1/execution",
      draft_revision_number: null,
      draft_source: null,
    },
    attention: {
      level: "high",
      summary:
        "Execution Anchor is based on a superseded Core Anchor revision.",
      review_requirement: "Human CG review is required.",
      source_assessment_id: null,
      source_signal_id: null,
      assessed_at: null,
      link_target: null,
    },
    current_version: {
      version_id: null,
      name: null,
      version_number: null,
      link_target: "/cg/tasks/t1/version-review",
    },
    guidance_state: "outdated",
    open_vfx_escalation: false,
    next_action: {
      title: "Retranslate Execution Anchor from the confirmed Core Anchor R2",
      why_now:
        "The confirmed Execution Anchor is based on a superseded Core Anchor revision.",
      downstream_effect:
        "A new Execution Anchor Draft is created for Human CG review.",
      target_route: "/cg/tasks/t1/execution",
      action_label: "Generate Execution Anchor draft",
      executable: true,
    },
  };
}

describe("ExecutionPage", () => {
  it("shows an honest unavailable state when the page-specific data failed to load", () => {
    render(<ExecutionPage taskId="t1" data={null} />);
    expect(screen.getByText("This page is unavailable")).toBeVisible();
  });

  it("no Execution Anchor: offers Generate as primary and Start blank draft as secondary when the Core Anchor is confirmed", () => {
    render(
      <ExecutionPage taskId="t1" data={data({ coreAnchorConfirmed: true })} />,
    );
    expect(
      screen.getByRole("button", { name: "Generate Execution Anchor draft" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Start blank draft" }),
    ).toBeVisible();
  });

  it("no Execution Anchor: honestly blocks draft creation when the Core Anchor is not confirmed", () => {
    render(
      <ExecutionPage taskId="t1" data={data({ coreAnchorConfirmed: false })} />,
    );
    expect(screen.getByText(/requires a confirmed Core Anchor/)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Generate Execution Anchor draft" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Start blank draft" }),
    ).not.toBeInTheDocument();
  });

  it("draft exists: shows the real Human CG Supervisor authority statement and content fields", () => {
    render(
      <ExecutionPage taskId="t1" data={data({ draftRevision: revision() })} />,
    );
    expect(
      screen.getByText(/owns Execution Anchor confirmation/),
    ).toBeVisible();
    expect(screen.getByText("Technical boundaries")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Confirm Execution Anchor" }),
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: "Discard draft" })).toBeVisible();
  });

  it("draft with no meaningful content: blocks Confirm and explains why, but Save stays enabled", () => {
    render(
      <ExecutionPage
        taskId="t1"
        data={data({
          draftRevision: revision({ technical_boundaries: "   " }),
        })}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Confirm Execution Anchor" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
    expect(
      screen.getByText(
        /Add at least one execution boundary, criterion, dependency, refinement or escalation condition/,
      ),
    ).toBeVisible();
  });

  it("a newly generated/created draft with real content replaces stale blank local state after a server refresh", async () => {
    const { rerender } = render(
      <ExecutionPage
        taskId="t1"
        data={data({ draftRevision: null, coreAnchorConfirmed: true })}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Generate Execution Anchor draft" }),
    ).toBeVisible();

    // Simulates the real post-action flow: a Server Action succeeds,
    // calls router.refresh(), and this same component instance
    // re-renders with a freshly loaded, non-blank draft -- it is never
    // unmounted/remounted, so a naive `useState(() => ...)` initializer
    // would keep showing the old (blank) values.
    rerender(
      <ExecutionPage
        taskId="t1"
        data={data({
          draftRevision: revision({
            id: "generated-1",
            technical_boundaries:
              "Generated: real boundaries from the confirmed Core Anchor.",
          }),
          coreAnchorConfirmed: true,
        })}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByDisplayValue(
          "Generated: real boundaries from the confirmed Core Anchor.",
        ),
      ).toBeVisible();
    });
  });

  it("confirmed revision: renders real content read-only, Core Anchor stays read-only context only, and offers a new revision from it", () => {
    render(
      <ExecutionPage
        taskId="t1"
        data={data({
          confirmedRevision: revision({
            status: "confirmed",
            confirmed_by_human_role: "cg_supervisor",
            confirmed_at: "2026-01-02T00:00:00Z",
          }),
          coreAnchorConfirmed: true,
        })}
      />,
    );
    expect(screen.getByText(/Confirmed Execution Anchor/)).toBeVisible();
    expect(screen.getByText("24fps, no motion blur.")).toBeVisible();
    expect(screen.getByText("Active Core Anchor (read-only)")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Create new revision" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Generate Execution Anchor draft" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Start blank draft" }),
    ).not.toBeInTheDocument();
  });

  it("outdated confirmed revision (J3): offers the retranslation-labelled primary action instead of the ambiguous generic Create-new-revision path", () => {
    render(
      <ExecutionPage
        taskId="t1"
        data={data({
          confirmedRevision: revision({
            status: "confirmed",
            revision_number: 1,
            confirmed_by_human_role: "cg_supervisor",
            confirmed_at: "2026-01-02T00:00:00Z",
          }),
          coreAnchorConfirmed: true,
        })}
        anchorContext={outdatedAnchorContext()}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "Generate Execution Anchor R2 draft from Core Anchor R2",
      }),
    ).toBeVisible();
    // Still available, but relabelled -- never removed, never the
    // primary/only path when the Anchor is outdated.
    expect(
      screen.getByRole("button", {
        name: "Start manually from Execution Anchor R1",
      }),
    ).toBeVisible();
    // Never the ambiguous generic label at the same time.
    expect(
      screen.queryByRole("button", { name: "Create new revision" }),
    ).not.toBeInTheDocument();
  });

  it("outdated confirmed revision (J3): the primary action calls the existing formal Agent-generate-from-confirmed-Core-Anchor action -- no demo-only shortcut", async () => {
    generateExecutionAnchorDraftActionMock.mockResolvedValue({ ok: true });
    render(
      <ExecutionPage
        taskId="t1"
        data={data({
          confirmedRevision: revision({
            status: "confirmed",
            revision_number: 1,
          }),
          coreAnchorConfirmed: true,
        })}
        anchorContext={outdatedAnchorContext()}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", {
        name: "Generate Execution Anchor R2 draft from Core Anchor R2",
      }),
    );

    expect(generateExecutionAnchorDraftActionMock).toHaveBeenCalledWith("t1");
    expect(
      createExecutionAnchorDraftFromConfirmedActionMock,
    ).not.toHaveBeenCalled();
  });

  it("current (non-outdated) confirmed revision: unchanged -- still the plain Create-new-revision action, even with an Anchor Context present", () => {
    render(
      <ExecutionPage
        taskId="t1"
        data={data({
          confirmedRevision: revision({
            status: "confirmed",
            revision_number: 1,
          }),
          coreAnchorConfirmed: true,
        })}
        anchorContext={{
          ...outdatedAnchorContext(),
          execution_anchor: {
            ...outdatedAnchorContext().execution_anchor!,
            context_state: "current",
          },
        }}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Create new revision" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /Generate Execution Anchor R/ }),
    ).not.toBeInTheDocument();
  });

  it("groups confirmed content under Production Evidence and the real confirm Decision's actor/rationale under Human Decision and Provenance (Step 9B-2)", () => {
    render(
      <ExecutionPage
        taskId="t1"
        data={data({
          confirmedRevision: revision({
            status: "confirmed",
            confirmed_by_human_role: "cg_supervisor",
            confirmed_at: "2026-01-02T00:00:00Z",
          }),
          coreAnchorConfirmed: true,
          confirmDecision: decision(),
        })}
      />,
    );
    const evidenceHeading = screen.getByText("Production Evidence");
    const humanDecisionHeading = screen.getByText(
      "Human Decision and Provenance",
    );
    expect(evidenceHeading).toBeVisible();
    expect(humanDecisionHeading).toBeVisible();

    const evidenceSection = evidenceHeading.closest(
      "[data-evidence-layer]",
    ) as HTMLElement;
    expect(
      within(evidenceSection).getByText("24fps, no motion blur."),
    ).toBeVisible();

    const humanDecisionSection = humanDecisionHeading.closest(
      "[data-evidence-layer]",
    ) as HTMLElement;
    expect(
      within(humanDecisionSection).getByText(
        "Confirmed Execution Anchor revision 1",
      ),
    ).toBeVisible();
    expect(
      within(humanDecisionSection).getByText(
        "Matches the confirmed Core Anchor exactly.",
      ),
    ).toBeVisible();
    expect(
      within(humanDecisionSection).getByText("CG Supervisor"),
    ).toBeVisible();
    expect(
      within(humanDecisionSection).queryByText("cg_supervisor"),
    ).not.toBeInTheDocument();
    // The real Decision's rationale must not also appear duplicated
    // inside the Production Evidence content.
    expect(
      within(evidenceSection).queryByText(
        "Matches the confirmed Core Anchor exactly.",
      ),
    ).not.toBeInTheDocument();
  });

  it("falls back to the revision's own confirmed-by/confirmed-at fields under Human Decision and Provenance when no Decision was found (legacy compatibility)", () => {
    render(
      <ExecutionPage
        taskId="t1"
        data={data({
          confirmedRevision: revision({
            status: "confirmed",
            confirmed_by_human_role: "cg_supervisor",
            confirmed_at: "2026-01-02T00:00:00Z",
          }),
          coreAnchorConfirmed: true,
          confirmDecision: null,
        })}
      />,
    );
    const humanDecisionSection = screen
      .getByText("Human Decision and Provenance")
      .closest("[data-evidence-layer]") as HTMLElement;
    expect(
      within(humanDecisionSection).getByText("CG Supervisor"),
    ).toBeVisible();
    expect(
      within(humanDecisionSection).queryByText("cg_supervisor"),
    ).not.toBeInTheDocument();
    // No real Decision record was found -- the outcome statement must
    // not be fabricated from the Anchor's own confirmed-by/at fields.
    expect(
      within(humanDecisionSection).queryByText(
        /Confirmed Execution Anchor revision/,
      ),
    ).not.toBeInTheDocument();
  });

  it("shows a human-readable supersession note when the confirmed revision supersedes an earlier one", () => {
    render(
      <ExecutionPage
        taskId="t1"
        data={data({
          confirmedRevision: revision({
            status: "confirmed",
            revision_number: 2,
            confirmed_by_human_role: "cg_supervisor",
            confirmed_at: "2026-01-02T00:00:00Z",
            supersedes_revision_id: "r-old",
          }),
          coreAnchorConfirmed: true,
          confirmDecision: decision(),
        })}
      />,
    );
    const humanDecisionSection = screen
      .getByText("Human Decision and Provenance")
      .closest("[data-evidence-layer]") as HTMLElement;
    expect(
      within(humanDecisionSection).getByText(
        "Confirmed Execution Anchor revision 2",
      ),
    ).toBeVisible();
    expect(
      within(humanDecisionSection).getByText(
        "Supersedes a previous Execution Anchor revision.",
      ),
    ).toBeVisible();
  });

  it("uses the state-dependent action heading: Start Execution Anchor when none exists, Revise Execution Anchor once one is confirmed", () => {
    const { rerender } = render(<ExecutionPage taskId="t1" data={data()} />);
    expect(screen.getByText("Start Execution Anchor")).toBeVisible();
    expect(
      screen.queryByText("Revise Execution Anchor"),
    ).not.toBeInTheDocument();

    rerender(
      <ExecutionPage
        taskId="t1"
        data={data({
          confirmedRevision: revision({ status: "confirmed" }),
          coreAnchorConfirmed: true,
        })}
      />,
    );
    expect(screen.getByText("Revise Execution Anchor")).toBeVisible();
    expect(
      screen.queryByText("Start Execution Anchor"),
    ).not.toBeInTheDocument();
  });

  it("still shows Draft Execution Anchor, unchanged, when a draft is in progress regardless of confirmed state", () => {
    render(
      <ExecutionPage
        taskId="t1"
        data={data({
          confirmedRevision: revision({ status: "confirmed" }),
          draftRevision: revision({ id: "r2", status: "draft" }),
          coreAnchorConfirmed: true,
        })}
      />,
    );
    expect(screen.getByText("Draft Execution Anchor")).toBeVisible();
    expect(
      screen.queryByText("Start Execution Anchor"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Revise Execution Anchor"),
    ).not.toBeInTheDocument();
  });
});
