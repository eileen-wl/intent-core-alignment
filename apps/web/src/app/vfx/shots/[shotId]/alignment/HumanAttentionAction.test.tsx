import type {
  CrossRoleAssessmentRead,
  VersionRead,
  VfxInboxItemRead,
} from "@intent-core/contracts";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/vfx/shots/s1/alignment",
}));

import {
  deriveHumanAttentionState,
  HumanAttentionAction,
} from "./HumanAttentionAction";

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
    relevant_version_name: "SH010_v001",
    relevant_version_number: 1,
    pairing_established: true,
    latest_assessment_id: "a1",
    latest_assessment_created_at: "2026-01-03T00:00:00Z",
    latest_signal_id: "sig1",
    latest_signal_attention_level: "high",
    latest_signal_summary: "Human review required.",
    re_anchor_proposal_present: false,
    current_focus: {
      focus_type: "alignment_not_followed_by_anchor_action",
      title: "Cross-role assessment may need your interpretation",
      explanation: "No newer Core Anchor action has followed this assessment.",
      target_route: "/vfx/shots/s1/alignment",
      primary_action_label: "Review alignment",
      actionable: true,
    },
    next_candidates: [],
    sort_rank: 0,
    ...overrides,
  };
}

function assessment(
  overrides: Partial<CrossRoleAssessmentRead> = {},
): CrossRoleAssessmentRead {
  return {
    id: "a1",
    project_id: "p1",
    shot_id: "s1",
    task_id: "t1",
    version_id: "v1",
    core_anchor_revision_id: "r1",
    execution_anchor_revision_id: "er1",
    vfx_supervisor_review_id: "vr1",
    cg_supervisor_review_id: "cr1",
    artist_agent_guidance_id: "ag1",
    context_snapshot_id: "cs1",
    agent_run_id: "run1",
    assessment_output: {
      executive_summary:
        "The Version stays close to the confirmed Core Anchor.",
      shared_intent_read: {
        summary: "shared",
        why_it_matters: "why",
        affected_roles: [],
        priority: "low",
        evidence: [],
      },
      role_perspectives: [],
      agreements: [],
      cross_role_tensions: [],
      local_optimum_risks: [],
      unresolved_dependencies: [],
      human_coordination_priorities: [],
      re_anchor_proposal: null,
      evidence_gaps: [],
    },
    created_at: "2026-01-03T00:00:00Z",
    intent_signal: {
      id: "sig1",
      cross_role_assessment_id: "a1",
      project_id: "p1",
      shot_id: "s1",
      task_id: "t1",
      version_id: "v1",
      attention_level: "high",
      signal_output: {
        attention_level: "high",
        label: "human_review_required",
        summary: "Human review required based on a cross-role tension.",
        drivers: [],
        role_coverage: {
          vfx_supervisor: true,
          cg_supervisor: true,
          artist: true,
        },
        re_anchor_proposal_present: false,
        caveats: [],
      },
      created_at: "2026-01-03T00:00:00Z",
    },
    re_anchor_proposal: null,
    ...overrides,
  };
}

const PROPOSAL = {
  id: "prop1",
  cross_role_assessment_id: "a1",
  project_id: "p1",
  shot_id: "s1",
  current_core_anchor_revision_id: "r1",
  proposal_output: {
    reason_for_consideration: "A repeated cross-role tension on pacing.",
    preserved_elements: [],
    proposed_fields: [],
    adoption_risks: [],
    questions_for_human_vfx_supervisor: [],
    evidence: [],
  },
  created_at: "2026-01-03T00:00:00Z",
};

function version(overrides: Partial<VersionRead> = {}): VersionRead {
  return {
    id: "v1",
    shot_id: "s1",
    name: "SH010_v001",
    version_number: 1,
    description: "",
    source: "manual",
    created_by_actor_kind: "human",
    created_by_actor_id: "vfx-1",
    created_by_human_role: "vfx_supervisor",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("deriveHumanAttentionState", () => {
  it("is not_ready when no assessment exists and generation is not ready", () => {
    expect(deriveHumanAttentionState(item(), null)).toEqual({
      kind: "not_ready",
    });
  });

  it("is generate_first when no assessment exists and generation is ready", () => {
    expect(
      deriveHumanAttentionState(
        item({
          generation_ready_task_id: "t1",
          generation_ready_version_id: "v1",
        }),
        null,
      ),
    ).toEqual({ kind: "generate_first", taskId: "t1", versionId: "v1" });
  });

  it("is review_proposal when an assessment with a Re-anchor Proposal exists and no newer reassessment is ready", () => {
    const current = assessment({ re_anchor_proposal: PROPOSAL });
    expect(deriveHumanAttentionState(item(), current)).toEqual({
      kind: "review_proposal",
      current,
      proposal: PROPOSAL,
    });
  });

  it("is interpret_only (low attention) when no proposal exists and attention is low", () => {
    const current = assessment({
      intent_signal: { ...assessment().intent_signal, attention_level: "low" },
    });
    expect(deriveHumanAttentionState(item(), current)).toEqual({
      kind: "interpret_only",
      current,
      lowAttention: true,
    });
  });

  it("is interpret_only (non-low attention) when no proposal exists and attention is not low", () => {
    const current = assessment();
    expect(deriveHumanAttentionState(item(), current)).toEqual({
      kind: "interpret_only",
      current,
      lowAttention: false,
    });
  });

  it("prioritizes reassessment over an existing Re-anchor Proposal -- owner-locked priority rule", () => {
    const current = assessment({ re_anchor_proposal: PROPOSAL });
    const state = deriveHumanAttentionState(
      item({
        generation_ready_task_id: "t1",
        generation_ready_version_id: "v2",
      }),
      current,
    );
    expect(state).toEqual({
      kind: "reassessment_priority",
      taskId: "t1",
      versionId: "v2",
      supersededProposal: PROPOSAL,
    });
  });

  it("is reassessment_priority with no superseded proposal when the current assessment has none", () => {
    const current = assessment();
    const state = deriveHumanAttentionState(
      item({
        generation_ready_task_id: "t1",
        generation_ready_version_id: "v2",
      }),
      current,
    );
    expect(state).toEqual({
      kind: "reassessment_priority",
      taskId: "t1",
      versionId: "v2",
      supersededProposal: null,
    });
  });
});

describe("HumanAttentionAction", () => {
  it("renders the not-ready state with a real navigation route, never a fabricated primary action", () => {
    render(
      <HumanAttentionAction
        shotId="s1"
        item={item()}
        current={null}
        versionsById={new Map()}
      />,
    );
    expect(
      screen.getByText("Cross-role Assessment is not ready yet"),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /generate/i }),
    ).not.toBeInTheDocument();
  });

  it("renders the generate-first state with the real Generate Assessment action", () => {
    render(
      <HumanAttentionAction
        shotId="s1"
        item={item({
          generation_ready_task_id: "t1",
          generation_ready_version_id: "v1",
        })}
        current={null}
        versionsById={new Map([["v1", version()]])}
      />,
    );
    expect(
      screen.getByText(
        "A new Cross-role Assessment can be generated for this Shot",
      ),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Generate Assessment" }),
    ).toBeVisible();
  });

  it("renders the review-proposal state with a real link to Intent, never a confirm/reject control", () => {
    render(
      <HumanAttentionAction
        shotId="s1"
        item={item()}
        current={assessment({ re_anchor_proposal: PROPOSAL })}
        versionsById={new Map([["v1", version()]])}
      />,
    );
    expect(
      screen.getByText("A repeated cross-role tension on pacing."),
    ).toBeVisible();
    const link = screen.getByRole("link", { name: "Review proposal →" });
    expect(link).toHaveAttribute("href", "/vfx/shots/s1/intent");
    expect(
      screen.queryByRole("button", { name: /confirm/i }),
    ).not.toBeInTheDocument();
  });

  it("renders the interpret-only state honestly, with no fabricated action, when attention requires review", () => {
    render(
      <HumanAttentionAction
        shotId="s1"
        item={item()}
        current={assessment()}
        versionsById={new Map([["v1", version()]])}
      />,
    );
    expect(
      screen.getByText(
        "Human review is required -- the VFX Supervisor should interpret these findings.",
      ),
    ).toBeVisible();
    expect(
      screen.getByText(
        "No Re-anchor Proposal exists for the current assessment.",
      ),
    ).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders the interpret-only state as no-review-needed when attention is low", () => {
    render(
      <HumanAttentionAction
        shotId="s1"
        item={item()}
        current={assessment({
          intent_signal: {
            ...assessment().intent_signal,
            attention_level: "low",
          },
        })}
        versionsById={new Map([["v1", version()]])}
      />,
    );
    expect(
      screen.getByText("No human review is required based on this assessment."),
    ).toBeVisible();
  });

  it("makes reassessment primary and keeps the superseded proposal visible but clearly secondary", () => {
    render(
      <HumanAttentionAction
        shotId="s1"
        item={item({
          generation_ready_task_id: "t1",
          generation_ready_version_id: "v2",
        })}
        current={assessment({ re_anchor_proposal: PROPOSAL })}
        versionsById={
          new Map([
            [
              "v2",
              version({ id: "v2", name: "SH010_v002", version_number: 2 }),
            ],
          ])
        }
      />,
    );
    expect(
      screen.getByRole("button", {
        name: "Generate new Cross-role Assessment",
      }),
    ).toBeVisible();
    expect(screen.getByText("From the previous assessment")).toBeVisible();
    expect(
      screen.getByText("A repeated cross-role tension on pacing."),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Review proposal →" }),
    ).toHaveAttribute("href", "/vfx/shots/s1/intent");
  });

  it("does not render a superseded-proposal note when reassessment is ready and no proposal exists", () => {
    render(
      <HumanAttentionAction
        shotId="s1"
        item={item({
          generation_ready_task_id: "t1",
          generation_ready_version_id: "v2",
        })}
        current={assessment()}
        versionsById={
          new Map([
            [
              "v2",
              version({ id: "v2", name: "SH010_v002", version_number: 2 }),
            ],
          ])
        }
      />,
    );
    expect(
      screen.queryByText("From the previous assessment"),
    ).not.toBeInTheDocument();
  });

  it("preserves the Human authority statement", () => {
    render(
      <HumanAttentionAction
        shotId="s1"
        item={item()}
        current={null}
        versionsById={new Map()}
      />,
    );
    expect(screen.getByText(/advisory only/)).toBeVisible();
  });

  it("shows the honest 'no direct Human Decision' note whenever a current assessment exists", () => {
    render(
      <HumanAttentionAction
        shotId="s1"
        item={item()}
        current={assessment()}
        versionsById={new Map([["v1", version()]])}
      />,
    );
    expect(
      screen.getByText(
        /No Human Decision has been recorded directly against this assessment/,
      ),
    ).toBeVisible();
  });
});
