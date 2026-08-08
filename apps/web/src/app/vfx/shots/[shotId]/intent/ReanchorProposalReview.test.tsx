import type {
  CoreAnchorRevisionRead,
  CrossRoleAssessmentRead,
} from "@intent-core/contracts";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReanchorProposalReview } from "./ReanchorProposalReview";

afterEach(() => {
  cleanup();
});

const CONFIRMED_REVISION: CoreAnchorRevisionRead = {
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
};

const ASSESSMENT: CrossRoleAssessmentRead = {
  id: "assessment-1",
  project_id: "p1",
  shot_id: "s1",
  task_id: "t3",
  version_id: "v3",
  core_anchor_revision_id: "r1",
  execution_anchor_revision_id: "exec-comp",
  vfx_supervisor_review_id: "vfx-review-1",
  cg_supervisor_review_id: "cg-review-1",
  artist_agent_guidance_id: "guidance-1",
  context_snapshot_id: "snapshot-1",
  agent_run_id: "run-1",
  created_at: "2026-01-01T00:00:00Z",
  assessment_output: {
    executive_summary: "Three-department combined conflict summary.",
    shared_intent_read: {
      summary: "Shared intent",
      why_it_matters: "Why it matters",
      affected_roles: ["vfx_supervisor"],
      priority: "high",
      evidence: [
        {
          source_type: "core_anchor_revision",
          source_id: "r1",
          label: "Confirmed Core Anchor revision r1",
        },
      ],
    },
    role_perspectives: [],
    agreements: [],
    cross_role_tensions: [
      {
        summary: "Animation, Lighting, and Compositing combine into spectacle.",
        why_it_matters: "Each department's own refinement is real.",
        affected_roles: ["vfx_supervisor", "cg_supervisor", "artist"],
        priority: "high",
        evidence: [
          {
            source_type: "execution_anchor_revision",
            source_id: "exec-animation",
            label: "Animation Execution Anchor revision",
          },
        ],
      },
    ],
    local_optimum_risks: [
      {
        summary: "Animation: faster lunge, clearer impact timing.",
        why_it_matters: "Risk reading as more heroic energy.",
        affected_roles: ["cg_supervisor", "vfx_supervisor"],
        priority: "high",
        evidence: [
          {
            source_type: "execution_anchor_revision",
            source_id: "exec-animation",
            label: "Animation Execution Anchor revision",
          },
        ],
      },
    ],
    unresolved_dependencies: [],
    human_coordination_priorities: [],
    re_anchor_proposal: null,
    evidence_gaps: ["Not directly inspected footage."],
  },
  intent_signal: {
    id: "signal-1",
    cross_role_assessment_id: "assessment-1",
    project_id: "p1",
    shot_id: "s1",
    task_id: "t3",
    version_id: "v3",
    attention_level: "high",
    signal_output: {
      attention_level: "high",
      label: "human_review_required",
      summary: "Human review is warranted.",
      drivers: [],
      role_coverage: {
        vfx_supervisor: true,
        cg_supervisor: true,
        artist: true,
      },
      re_anchor_proposal_present: true,
      caveats: [],
    },
    created_at: "2026-01-01T00:00:00Z",
  },
  re_anchor_proposal: {
    id: "proposal-1",
    cross_role_assessment_id: "assessment-1",
    project_id: "p1",
    shot_id: "s1",
    current_core_anchor_revision_id: "r1",
    created_at: "2026-01-01T00:00:00Z",
    proposal_output: {
      reason_for_consideration:
        "Each department's own Execution Anchor is real evidence.",
      preserved_elements: ["Controlled, oppressive threat."],
      proposed_fields: [
        {
          field: "constraints",
          current_problem: "One combined restraint constraint exists.",
          proposed_direction:
            "Consider a combined-intensity ceiling for a future Core Anchor revision.",
          why_it_may_help: "Lets all three departments be checked together.",
          evidence: [
            {
              source_type: "execution_anchor_revision",
              source_id: "exec-animation",
              label: "Animation Execution Anchor revision",
            },
            {
              source_type: "execution_anchor_revision",
              source_id: "exec-lighting",
              label: "Lighting Execution Anchor revision",
            },
          ],
        },
      ],
      adoption_risks: ["Could read as restricting each department."],
      questions_for_human_vfx_supervisor: ["Shared or per-department?"],
      evidence: [
        {
          source_type: "core_anchor_revision",
          source_id: "r1",
          label: "Confirmed Core Anchor revision r1",
        },
        {
          source_type: "vfx_supervisor_review",
          source_id: "vfx-review-1",
          label: "VFX review",
        },
        {
          source_type: "cg_supervisor_review",
          source_id: "cg-review-1",
          label: "CG review",
        },
      ],
    },
  },
};

describe("ReanchorProposalReview", () => {
  it("surfaces the Proposal, its source Assessment/high-attention context, the combined-conflict findings, and the advisory notice", () => {
    render(
      <ReanchorProposalReview
        confirmedRevision={CONFIRMED_REVISION}
        assessment={ASSESSMENT}
        action={vi.fn()}
      />,
    );

    expect(screen.getByText("Re-anchor Proposal — Human Review")).toBeVisible();
    expect(screen.getByText("High attention")).toBeVisible();
    expect(
      screen.getByText("Three-department combined conflict summary."),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Animation, Lighting, and Compositing combine into spectacle.",
      ),
    ).toBeVisible();
    expect(
      screen.getByText("Animation: faster lunge, clearer impact timing."),
    ).toBeVisible();
    expect(
      screen.getByText(
        /combined-intensity ceiling for a future Core Anchor revision/,
      ),
    ).toBeVisible();
    expect(
      screen.getByText(
        "This Proposal is advisory only. Core Anchor R1 remains authoritative until a Human VFX Supervisor confirms a new revision.",
      ),
    ).toBeVisible();
  });

  it("calls the create-draft-from-confirmed action when the primary action is clicked -- the same action the plain Create-new-revision control already used", async () => {
    const action = vi
      .fn()
      .mockResolvedValue({ ok: true, revision: CONFIRMED_REVISION });
    render(
      <ReanchorProposalReview
        confirmedRevision={CONFIRMED_REVISION}
        assessment={ASSESSMENT}
        action={action}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", {
        name: "Create Core Anchor R2 draft from proposal",
      }),
    );

    expect(action).toHaveBeenCalledTimes(1);
  });

  it("renders nothing when the assessment has no current Re-anchor Proposal (defence in depth)", () => {
    const { container } = render(
      <ReanchorProposalReview
        confirmedRevision={CONFIRMED_REVISION}
        assessment={{ ...ASSESSMENT, re_anchor_proposal: null }}
        action={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
