import type {
  CoreAnchorRevisionRead,
  CrossRoleAssessmentRead,
  CrossRoleFinding,
  VersionRead,
  VfxInboxItemRead,
} from "@intent-core/contracts";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/vfx/shots/s1/alignment",
}));

import type { AlignmentWorkspaceData } from "@/features/vfx/alignment-workspace/data";
import { AlignmentWorkspacePage } from "./AlignmentWorkspacePage";

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

function finding(overrides: Partial<CrossRoleFinding> = {}): CrossRoleFinding {
  return {
    summary: "The emotional restraint reads clearly across departments.",
    why_it_matters: "Keeps the core intent legible.",
    affected_roles: ["vfx_supervisor"],
    priority: "low",
    evidence: [],
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
      shared_intent_read: finding(),
      role_perspectives: [],
      agreements: [finding({ summary: "Restraint reads clearly." })],
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

function revision(
  overrides: Partial<CoreAnchorRevisionRead> = {},
): CoreAnchorRevisionRead {
  return {
    id: "r1",
    core_anchor_id: "ca1",
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

function data(
  overrides: Partial<AlignmentWorkspaceData> = {},
): AlignmentWorkspaceData {
  return {
    item: item(),
    assessments: [assessment()],
    versionsById: new Map([["v1", version()]]),
    revisionsById: new Map([["r1", revision()]]),
    ...overrides,
  };
}

describe("AlignmentWorkspacePage", () => {
  it("renders Project > Shot > Alignment breadcrumbs and all five real Context Tabs, Alignment active", () => {
    render(
      <AlignmentWorkspacePage
        shotId="s1"
        data={data()}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("link", { name: "D1 Demo Project" }),
    ).toHaveAttribute("href", "/vfx/shots");
    for (const [label, href] of [
      ["Overview", "/vfx/shots/s1"],
      ["Intent", "/vfx/shots/s1/intent"],
      ["Versions", "/vfx/shots/s1/versions"],
      ["Activity", "/vfx/shots/s1/activity"],
    ] as const) {
      expect(screen.getByRole("link", { name: label })).toHaveAttribute(
        "href",
        href,
      );
    }
    expect(screen.getByRole("link", { name: "Alignment" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("shows an honest unavailable state when the API could not be reached", () => {
    render(
      <AlignmentWorkspacePage
        shotId="s1"
        data={null}
        unavailable
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText("This Shot is unavailable")).toBeVisible();
  });

  it("shows the honest empty state when no Alignment Assessment has ever been recorded, and generation is not ready", () => {
    render(
      <AlignmentWorkspacePage
        shotId="s1"
        data={data({ assessments: [] })}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByText(
        "No Alignment Assessment has been recorded for this Shot yet.",
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Generate Assessment" }),
    ).not.toBeInTheDocument();
  });

  it("shows a task-aware generation-ready state with a real Generate Assessment action when role outputs are available but no Assessment exists yet", () => {
    render(
      <AlignmentWorkspacePage
        shotId="s1"
        data={data({
          assessments: [],
          item: item({
            generation_ready_task_id: "t1",
            generation_ready_version_id: "v1",
          }),
        })}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByText(
        "A new Cross-role Assessment can be generated for this Shot",
      ),
    ).toBeVisible();
    expect(screen.getAllByText(/SH010_v001 \(v1\)/).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: "Generate Assessment" }),
    ).toBeVisible();
    expect(
      screen.queryByText(
        "No Alignment Assessment has been recorded for this Shot yet.",
      ),
    ).not.toBeInTheDocument();
  });

  it("renders real assessment content: assessed Version, Core Anchor used, and findings", () => {
    render(
      <AlignmentWorkspacePage
        shotId="s1"
        data={data()}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByText("The Version stays close to the confirmed Core Anchor."),
    ).toBeVisible();
    expect(screen.getAllByText("SH010_v001 (v1)").length).toBeGreaterThan(0);
    expect(screen.getByText(/Revision 1/)).toBeVisible();
    expect(screen.getByText("Restraint reads clearly.")).toBeVisible();
    expect(screen.getByText("Aligned findings (1)")).toBeVisible();
  });

  it("groups the assessed Version/Core Anchor under Production Evidence, findings under Agent Interpretation, and shows an honest Human Decision state (Step 9B-2)", () => {
    render(
      <AlignmentWorkspacePage
        shotId="s1"
        data={data()}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    const evidenceHeading = screen.getByText("Production Evidence");
    const agentHeading = screen.getByText("Agent Interpretation");
    const humanDecisionHeading = screen.getByText(
      "Human Decision and Provenance",
    );
    expect(evidenceHeading).toBeVisible();
    expect(agentHeading).toBeVisible();
    expect(humanDecisionHeading).toBeVisible();

    const evidenceSection = evidenceHeading.closest(
      "[data-evidence-layer]",
    ) as HTMLElement;
    expect(
      within(evidenceSection).getAllByText("SH010_v001 (v1)").length,
    ).toBeGreaterThan(0);
    expect(within(evidenceSection).getByText(/Revision 1/)).toBeVisible();

    const agentSection = agentHeading.closest(
      "[data-evidence-layer]",
    ) as HTMLElement;
    expect(
      within(agentSection).getByText("Aligned findings (1)"),
    ).toBeVisible();

    // Owner-validation correction: the CrossRoleAssessment executive
    // summary card must never render inside Production Evidence -- it
    // is Agent Interpretation, even though it references a real
    // Version/Core Anchor.
    expect(
      within(evidenceSection).queryByText(
        "The Version stays close to the confirmed Core Anchor.",
      ),
    ).not.toBeInTheDocument();
    expect(
      within(agentSection).getByText(
        "The Version stays close to the confirmed Core Anchor.",
      ),
    ).toBeVisible();
    expect(within(agentSection).getByText("AI interpretation")).toBeVisible();

    // No Decision object is attached to a CrossRoleAssessment -- the
    // Human Decision layer states this honestly rather than
    // manufacturing one from the Agent's findings.
    const humanDecisionSection = humanDecisionHeading.closest(
      "[data-evidence-layer]",
    ) as HTMLElement;
    expect(
      within(humanDecisionSection).getByText(
        /No Human Decision has been recorded directly against this assessment/,
      ),
    ).toBeVisible();
  });

  it("keeps human-review-required as a pending action inside Agent Interpretation's Recommended next action, never inside Human Decision and Provenance (Step 9B-2 correction)", () => {
    render(
      <AlignmentWorkspacePage
        shotId="s1"
        data={data()}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    const agentSection = screen
      .getByText("Agent Interpretation")
      .closest("[data-evidence-layer]") as HTMLElement;
    const humanDecisionSection = screen
      .getByText("Human Decision and Provenance")
      .closest("[data-evidence-layer]") as HTMLElement;

    expect(
      within(agentSection).getByText("Human review required"),
    ).toBeVisible();
    expect(
      within(humanDecisionSection).queryByText("Human review required"),
    ).not.toBeInTheDocument();
  });

  it("formats a Finding's Affects list as human-readable role labels, never raw HumanRole enums (Step 9B-2 correction)", () => {
    render(
      <AlignmentWorkspacePage
        shotId="s1"
        data={data({
          assessments: [
            assessment({
              assessment_output: {
                executive_summary: "Restraint reads clearly across roles.",
                shared_intent_read: finding(),
                role_perspectives: [],
                agreements: [
                  finding({
                    summary: "Restraint reads clearly.",
                    affected_roles: [
                      "vfx_supervisor",
                      "cg_supervisor",
                      "artist",
                    ],
                  }),
                ],
                cross_role_tensions: [],
                local_optimum_risks: [],
                unresolved_dependencies: [],
                human_coordination_priorities: [],
                re_anchor_proposal: null,
                evidence_gaps: [],
              },
            }),
          ],
        })}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByText("Affects: VFX Supervisor, CG Supervisor, Artist"),
    ).toBeVisible();
    expect(screen.queryByText(/vfx_supervisor/)).not.toBeInTheDocument();
    expect(screen.queryByText(/cg_supervisor/)).not.toBeInTheDocument();
  });

  it("never fabricates a percentage or numeric alignment score", () => {
    render(
      <AlignmentWorkspacePage
        shotId="s1"
        data={data()}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it("shows the real human-review-required state honestly, from the real Intent Signal", () => {
    render(
      <AlignmentWorkspacePage
        shotId="s1"
        data={data()}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByText(
        "Human review is required -- the VFX Supervisor should interpret these findings.",
      ),
    ).toBeVisible();
  });

  it("shows low-attention assessments as not requiring human review", () => {
    render(
      <AlignmentWorkspacePage
        shotId="s1"
        data={data({
          assessments: [
            assessment({
              intent_signal: {
                ...assessment().intent_signal,
                attention_level: "low",
                signal_output: {
                  ...assessment().intent_signal.signal_output,
                  attention_level: "low",
                  label: "low_attention",
                },
              },
            }),
          ],
        })}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByText("No human review is required based on this assessment."),
    ).toBeVisible();
  });

  it("Re-anchor Proposal's Review proposal action leads to Intent, never confirms anything itself", () => {
    render(
      <AlignmentWorkspacePage
        shotId="s1"
        data={data({
          assessments: [
            assessment({
              re_anchor_proposal: {
                id: "prop1",
                cross_role_assessment_id: "a1",
                project_id: "p1",
                shot_id: "s1",
                current_core_anchor_revision_id: "r1",
                proposal_output: {
                  reason_for_consideration:
                    "A repeated cross-role tension on pacing.",
                  preserved_elements: [],
                  proposed_fields: [],
                  adoption_risks: [],
                  questions_for_human_vfx_supervisor: [],
                  evidence: [],
                },
                created_at: "2026-01-03T00:00:00Z",
              },
            }),
          ],
        })}
        unavailable={false}
        onExitRole={vi.fn()}
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

  it("shows an honest absence line when no Re-anchor Proposal exists for the current assessment", () => {
    render(
      <AlignmentWorkspacePage
        shotId="s1"
        data={data()}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByText(
        "No Re-anchor Proposal exists for the current assessment.",
      ),
    ).toBeVisible();
  });

  it("shows the compact human-authority line stating Agent assessment is advisory", () => {
    render(
      <AlignmentWorkspacePage
        shotId="s1"
        data={data()}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText(/advisory only/)).toBeVisible();
  });

  it("lists older assessments as real Assessment history", () => {
    const current = assessment({
      id: "a2",
      created_at: "2026-01-05T00:00:00Z",
    });
    const older = assessment({
      id: "a1",
      created_at: "2026-01-01T00:00:00Z",
      assessment_output: {
        ...assessment().assessment_output,
        executive_summary: "An earlier assessment summary.",
      },
    });
    render(
      <AlignmentWorkspacePage
        shotId="s1"
        data={data({ assessments: [current, older] })}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText("Assessment history")).toBeVisible();
    expect(screen.getByText("An earlier assessment summary.")).toBeVisible();
  });
});
