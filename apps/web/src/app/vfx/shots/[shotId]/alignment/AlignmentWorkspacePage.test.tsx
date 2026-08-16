import type {
  CoreAnchorRevisionRead,
  CrossRoleAssessmentRead,
  CrossRoleFinding,
  DepartmentExecutionOverviewRead,
  VersionRead,
  VfxInboxItemRead,
} from "@intent-core/contracts";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/vfx/shots/s1/alignment",
}));

const { generateAssessmentActionMock } = vi.hoisted(() => ({
  generateAssessmentActionMock: vi.fn(),
}));
vi.mock("@/features/vfx/alignment-workspace/actions", () => ({
  generateAssessmentAction: generateAssessmentActionMock,
}));

import userEvent from "@testing-library/user-event";
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

function departmentTask(
  overrides: Partial<DepartmentExecutionOverviewRead["tasks"][number]> = {},
): DepartmentExecutionOverviewRead["tasks"][number] {
  return {
    task_id: "t1",
    task_name: "Animation Pass",
    department: "animation",
    task_source: "manual",
    execution_anchor_state: "confirmed",
    execution_anchor_revision_number: 2,
    execution_anchor_summary: null,
    latest_version_id: "v1",
    latest_version_name: "Anim R2",
    latest_version_number: 2,
    latest_version_source: "manual",
    latest_version_scope: "task",
    current_focus_type: "none",
    current_focus_title: "Nothing requires attention",
    current_focus_actionable: false,
    open_dependency_count: 0,
    top_open_dependency_description: null,
    top_open_dependency_severity: null,
    alignment_concern_summary: null,
    alignment_concern_attention_level: null,
    open_escalation: false,
    open_escalation_summary: null,
    last_updated_at: "2026-08-01T00:00:00Z",
    last_updated_source: "task_created",
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
    departmentExecutionOverview: null,
    ...overrides,
  };
}

describe("AlignmentWorkspacePage", () => {
  it("shows an honest unavailable state when the page-specific data failed to load", () => {
    render(<AlignmentWorkspacePage shotId="s1" data={null} />);
    expect(screen.getByText("This page is unavailable")).toBeVisible();
  });

  it("shows the honest empty state when no Alignment Assessment has ever been recorded, and generation is not ready", () => {
    render(
      <AlignmentWorkspacePage shotId="s1" data={data({ assessments: [] })} />,
    );
    expect(
      screen.getByText("Cross-role Assessment is not ready yet"),
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
      screen.queryByText("Cross-role Assessment is not ready yet"),
    ).not.toBeInTheDocument();
  });

  it("renders real assessment content: assessed Version, Core Anchor used, and a compact preview summary by default", () => {
    render(<AlignmentWorkspacePage shotId="s1" data={data()} />);
    expect(
      screen.getByText("The Version stays close to the confirmed Core Anchor."),
    ).toBeVisible();
    expect(screen.getAllByText("SH010_v001 (v1)").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Revision 1/).length).toBeGreaterThan(0);
    expect(screen.getByText("View detailed assessment →")).toBeInTheDocument();
  });

  it("keeps the full findings collapsed behind disclosure by default, and makes every finding accessible once expanded", async () => {
    const user = userEvent.setup();
    render(<AlignmentWorkspacePage shotId="s1" data={data()} />);
    expect(screen.getByText("Restraint reads clearly.")).not.toBeVisible();

    await user.click(screen.getByText("View detailed assessment →"));

    expect(screen.getByText("Restraint reads clearly.")).toBeVisible();
    expect(screen.getByText("Aligned findings (1)")).toBeVisible();
  });

  it("keeps the detailed-assessment disclosure toggle as the same semantic control with matching collapsed/expanded labels, at a fixed footer position (CG-validated grammar backport)", () => {
    render(<AlignmentWorkspacePage shotId="s1" data={data()} />);

    // Both real labels live inside the same <summary> of the same
    // <details> (a native-CSS `[open]` swap, not JS state) -- which one
    // is visually shown is a CSS concern jsdom cannot compute here (no
    // stylesheet injection in this test environment), so this asserts
    // the structural facts that are reliably testable: both exact
    // labels exist in the one real control, and the native `open`
    // attribute -- the actual state driving the CSS swap -- toggles
    // correctly on click.
    const toggle = screen.getByText("View detailed assessment →");
    const details = toggle.closest("details")!;
    const summary = toggle.closest("summary")!;
    expect(details).not.toHaveAttribute("open");
    expect(
      within(summary).getByText("Collapse detailed assessment ↑"),
    ).toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle.closest("details")).toBe(details);
    expect(details).toHaveAttribute("open");
    expect(
      within(summary).getByText("View detailed assessment →"),
    ).toBeInTheDocument();
  });

  it("previews only High findings when High findings exist, ignoring lower-priority ones", () => {
    render(
      <AlignmentWorkspacePage
        shotId="s1"
        data={data({
          assessments: [
            assessment({
              assessment_output: {
                ...assessment().assessment_output,
                cross_role_tensions: [
                  finding({
                    summary: "A high-priority pacing tension.",
                    priority: "high",
                  }),
                  finding({
                    summary: "A low-priority styling note.",
                    priority: "low",
                  }),
                ],
              },
            }),
          ],
        })}
      />,
    );
    const decisionRelevantSection = screen
      .getByText("Most decision-relevant findings")
      .closest("div") as HTMLElement;
    expect(decisionRelevantSection).toBeVisible();
    expect(
      within(decisionRelevantSection).getByText(
        "A high-priority pacing tension.",
      ),
    ).toBeVisible();
    expect(
      within(decisionRelevantSection).queryByText(
        "A low-priority styling note.",
      ),
    ).not.toBeInTheDocument();
  });

  it("falls back to Medium findings when no High finding exists, even though Medium is not literally 'high'", () => {
    render(
      <AlignmentWorkspacePage
        shotId="s1"
        data={data({
          assessments: [
            assessment({
              assessment_output: {
                ...assessment().assessment_output,
                local_optimum_risks: [
                  finding({
                    summary: "A medium-priority local-optimum risk.",
                    priority: "medium",
                  }),
                ],
                unresolved_dependencies: [
                  finding({
                    summary: "A low-priority open question.",
                    priority: "low",
                  }),
                ],
              },
            }),
          ],
        })}
      />,
    );
    const decisionRelevantSection = screen
      .getByText("Most decision-relevant findings")
      .closest("div") as HTMLElement;
    expect(
      within(decisionRelevantSection).getByText(
        "A medium-priority local-optimum risk.",
      ),
    ).toBeVisible();
    expect(
      within(decisionRelevantSection).queryByText(
        "A low-priority open question.",
      ),
    ).not.toBeInTheDocument();
  });

  it("falls back to Low findings when only Low findings exist among attention-relevant categories", () => {
    render(
      <AlignmentWorkspacePage
        shotId="s1"
        data={data({
          assessments: [
            assessment({
              assessment_output: {
                ...assessment().assessment_output,
                human_coordination_priorities: [
                  finding({
                    summary: "A low-priority advisory recommendation.",
                    priority: "low",
                  }),
                ],
              },
            }),
          ],
        })}
      />,
    );
    const decisionRelevantSection = screen
      .getByText("Most decision-relevant findings")
      .closest("div") as HTMLElement;
    expect(
      within(decisionRelevantSection).getByText(
        "A low-priority advisory recommendation.",
      ),
    ).toBeVisible();
  });

  it("never uses aligned findings as decision-attention items in the preview", () => {
    render(
      <AlignmentWorkspacePage
        shotId="s1"
        data={data({
          assessments: [
            assessment({
              assessment_output: {
                ...assessment().assessment_output,
                agreements: [
                  finding({
                    summary: "Restraint reads clearly.",
                    priority: "high",
                  }),
                ],
              },
            }),
          ],
        })}
      />,
    );
    expect(
      screen.getByText("No attention-relevant findings in this assessment."),
    ).toBeVisible();
  });

  it("shows an honest empty note in the decision-relevant preview when no attention-relevant finding exists at all", () => {
    render(<AlignmentWorkspacePage shotId="s1" data={data()} />);
    expect(
      screen.getByText("No attention-relevant findings in this assessment."),
    ).toBeVisible();
  });

  it("keeps Human Attention reachable without opening the findings disclosure", () => {
    render(<AlignmentWorkspacePage shotId="s1" data={data()} />);
    expect(
      screen.getByRole("region", { name: "Human Attention" }),
    ).toBeVisible();
  });

  it("promotes the assessed Version/Core Anchor into a compact Assessment Identity line and Context Inspector, never inside a giant Anchor Context duplicate (VFX Alignment structural pass)", () => {
    render(<AlignmentWorkspacePage shotId="s1" data={data()} />);
    expect(screen.getByText(/Core Anchor used:/)).toBeVisible();
    expect(screen.getByText("Core Intent")).toBeVisible();
    expect(screen.getByText("Current Production Context")).toBeVisible();
  });

  it("shows the Alignment Signal with the real attention level, without a duplicate counts sentence, while the real finding counts remain visible via the Signal Strip and Detailed Assessment category headings", async () => {
    const user = userEvent.setup();
    render(
      <AlignmentWorkspacePage
        shotId="s1"
        data={data({
          assessments: [
            assessment({
              assessment_output: {
                ...assessment().assessment_output,
                local_optimum_risks: [finding(), finding()],
                cross_role_tensions: [finding()],
                unresolved_dependencies: [finding()],
              },
            }),
          ],
        })}
      />,
    );
    expect(screen.getByText("High attention")).toBeVisible();
    expect(screen.getByText("AI interpretation")).toBeVisible();
    // The Signal no longer repeats the counts sentence itself (removed as
    // duplicate presentation) -- the same counts remain reliably visible
    // in the Signal Strip and (once expanded) the category headings below.
    expect(
      screen.queryByText(/local risks · .* cross-role tensions/),
    ).not.toBeInTheDocument();
    for (const [label, count] of [
      ["Cross-role tensions", "1"],
      ["Local-optimum risks", "2"],
      ["Open questions", "1"],
    ] as const) {
      const item = screen.getByText(label).closest("li")!;
      expect(within(item).getByText(count)).toBeVisible();
    }

    await user.click(screen.getByText("View detailed assessment →"));
    expect(screen.getByText("Cross-role tensions (1)")).toBeVisible();
    expect(screen.getByText("Local-optimum risks (2)")).toBeVisible();
    expect(screen.getByText("Open questions (1)")).toBeVisible();
  });

  it("no longer renders the redundant Current Assessment count-summary line (removed as duplicate presentation -- the same counts live in Alignment Signal and the category headings)", () => {
    render(<AlignmentWorkspacePage shotId="s1" data={data()} />);
    expect(screen.queryByText(/Aligned findings:/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Advisory recommendations:/),
    ).not.toBeInTheDocument();
  });

  it("renders correctly pluralized natural-language copy for 2 tensions, 3 risks, and 1 dependency, always sourced from the live findings rather than the stored digits", () => {
    render(
      <AlignmentWorkspacePage
        shotId="s1"
        data={data({
          assessments: [
            assessment({
              assessment_output: {
                ...assessment().assessment_output,
                executive_summary:
                  "[Cross-role deterministic] 9 cross-role tension(s), 9 local-optimum risk(s), and " +
                  "9 unresolved dependency(ies) considered across the VFX Supervisor Agent, CG " +
                  "Supervisor Agent, and Artist Agent recorded output.",
                cross_role_tensions: [finding(), finding()],
                local_optimum_risks: [finding(), finding(), finding()],
                unresolved_dependencies: [finding()],
              },
            }),
          ],
        })}
      />,
    );
    expect(screen.queryByText(/tension\(s\)/)).not.toBeInTheDocument();
    expect(screen.queryByText(/risk\(s\)/)).not.toBeInTheDocument();
    expect(screen.queryByText(/dependency\(ies\)/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\b9\b/)).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Current assessment identifies 2 cross-role tensions, 3 local-optimum risks, and 1 unresolved dependency across the VFX Supervisor, CG Supervisor, and Artist Agent outputs.",
      ),
    ).toBeVisible();
  });

  it("uses correct singular grammar and omits the zero-count category for 1 tension, 0 risks, and 1 dependency", () => {
    render(
      <AlignmentWorkspacePage
        shotId="s1"
        data={data({
          assessments: [
            assessment({
              assessment_output: {
                ...assessment().assessment_output,
                executive_summary:
                  "[Cross-role deterministic] 1 cross-role tension(s), 0 local-optimum risk(s), and " +
                  "1 unresolved dependency(ies) considered across the VFX Supervisor Agent, CG " +
                  "Supervisor Agent, and Artist Agent recorded output.",
                cross_role_tensions: [finding()],
                local_optimum_risks: [],
                unresolved_dependencies: [finding()],
              },
            }),
          ],
        })}
      />,
    );
    expect(screen.queryByText(/\(s\)|\(ies\)/)).not.toBeInTheDocument();
    expect(screen.queryByText(/local-optimum/)).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Current assessment identifies 1 cross-role tension and 1 unresolved dependency across the VFX Supervisor, CG Supervisor, and Artist Agent outputs.",
      ),
    ).toBeVisible();
  });

  it("naturally announces that nothing is attention-relevant when every count is zero", () => {
    render(
      <AlignmentWorkspacePage
        shotId="s1"
        data={data({
          assessments: [
            assessment({
              assessment_output: {
                ...assessment().assessment_output,
                executive_summary:
                  "[Cross-role deterministic] 0 cross-role tension(s), 0 local-optimum risk(s), and " +
                  "0 unresolved dependency(ies) considered across the VFX Supervisor Agent, CG " +
                  "Supervisor Agent, and Artist Agent recorded output.",
                cross_role_tensions: [],
                local_optimum_risks: [],
                unresolved_dependencies: [],
              },
            }),
          ],
        })}
      />,
    );
    expect(
      screen.getByText(
        "Current assessment identifies no cross-role tensions, local-optimum risks, or unresolved dependencies across the VFX Supervisor, CG Supervisor, and Artist Agent outputs.",
      ),
    ).toBeVisible();
  });

  it("leaves a free-form executive summary that doesn't match the known count-template sentence unchanged", () => {
    render(
      <AlignmentWorkspacePage
        shotId="s1"
        data={data({
          assessments: [
            assessment({
              assessment_output: {
                ...assessment().assessment_output,
                executive_summary:
                  "Broadly aligned; the combined intensity still needs Human interpretation.",
                cross_role_tensions: [finding()],
              },
            }),
          ],
        })}
      />,
    );
    expect(
      screen.getByText(
        "Broadly aligned; the combined intensity still needs Human interpretation.",
      ),
    ).toBeVisible();
  });

  it("strips a known implementation-only generator prefix from the Alignment Signal", () => {
    render(
      <AlignmentWorkspacePage
        shotId="s1"
        data={data({
          assessments: [
            assessment({
              assessment_output: {
                ...assessment().assessment_output,
                executive_summary:
                  "[Cross-role deterministic] Broadly aligned across all three departments.",
              },
            }),
          ],
        })}
      />,
    );
    expect(
      screen.queryByText(/Cross-role deterministic/),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Broadly aligned across all three departments."),
    ).toBeVisible();
  });

  it("never strips bracketed text that isn't a known implementation-only generator prefix", () => {
    render(
      <AlignmentWorkspacePage
        shotId="s1"
        data={data({
          assessments: [
            assessment({
              assessment_output: {
                ...assessment().assessment_output,
                executive_summary:
                  "[Shot 010] Broadly aligned across all three departments.",
              },
            }),
          ],
        })}
      />,
    );
    expect(
      screen.getByText(
        "[Shot 010] Broadly aligned across all three departments.",
      ),
    ).toBeVisible();
  });

  it("wires the real Department Execution data into a compact Department Execution Strip", () => {
    render(
      <AlignmentWorkspacePage
        shotId="s1"
        data={data({
          departmentExecutionOverview: {
            shot_id: "s1",
            tasks: [
              departmentTask({ task_id: "t1", department: "animation" }),
              departmentTask({ task_id: "t2", department: "lighting" }),
              departmentTask({ task_id: "t3", department: "comp" }),
            ],
            generated_at: "2026-08-01T00:00:00Z",
          },
        })}
      />,
    );
    expect(screen.getByText("Department Execution")).toBeVisible();
    expect(screen.getByText("animation")).toBeVisible();
    expect(screen.getByText("lighting")).toBeVisible();
    expect(screen.getByText("comp")).toBeVisible();
  });

  it("renders nothing for Department Execution when the role-gated overview call failed, without failing the rest of the page", () => {
    render(
      <AlignmentWorkspacePage
        shotId="s1"
        data={data({ departmentExecutionOverview: null })}
      />,
    );
    expect(screen.queryByText("Department Execution")).not.toBeInTheDocument();
    expect(
      screen.getByText("The Version stays close to the confirmed Core Anchor."),
    ).toBeVisible();
  });

  it("keeps the Production Facts / AI Proposal / Human Decision separation: the executive summary is Agent-authored (AI interpretation), and the honest no-direct-decision statement stays distinct from it", () => {
    render(<AlignmentWorkspacePage shotId="s1" data={data()} />);
    const signal = screen
      .getByText("The Version stays close to the confirmed Core Anchor.")
      .closest("section") as HTMLElement;
    expect(within(signal).getByText("AI interpretation")).toBeVisible();

    const humanAttention = screen.getByRole("region", {
      name: "Human Attention",
    });
    expect(
      within(humanAttention).getByText(
        /No Human Decision has been recorded directly against this assessment/,
      ),
    ).toBeVisible();
    // The honest decision statement is never presented as Agent output.
    expect(
      within(signal).queryByText(/No Human Decision has been recorded/),
    ).not.toBeInTheDocument();
  });

  it("formats a Finding's Affects list as human-readable role labels, never raw HumanRole enums, once the detailed assessment is expanded", async () => {
    const user = userEvent.setup();
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
      />,
    );

    await user.click(screen.getByText("View detailed assessment →"));

    expect(
      screen.getByText("Affects: VFX Supervisor, CG Supervisor, Artist"),
    ).toBeVisible();
    expect(screen.queryByText(/vfx_supervisor/)).not.toBeInTheDocument();
    expect(screen.queryByText(/cg_supervisor/)).not.toBeInTheDocument();
  });

  it("never fabricates a percentage or numeric alignment score", () => {
    render(<AlignmentWorkspacePage shotId="s1" data={data()} />);
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it("shows the real human-review-required state honestly, from the real Intent Signal", () => {
    render(<AlignmentWorkspacePage shotId="s1" data={data()} />);
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
    render(<AlignmentWorkspacePage shotId="s1" data={data()} />);
    expect(
      screen.getByText(
        "No Re-anchor Proposal exists for the current assessment.",
      ),
    ).toBeVisible();
  });

  it("shows the compact human-authority statement that Agent assessment is advisory, inside the Human Attention region", () => {
    render(<AlignmentWorkspacePage shotId="s1" data={data()} />);
    expect(screen.getByText(/advisory only/)).toBeVisible();
  });

  it("lists older assessments as real, visually de-emphasized Assessment history", () => {
    const current = assessment({
      id: "a2",
      created_at: "2026-01-05T00:00:00Z",
    });
    const older = assessment({
      id: "a1",
      created_at: "2026-01-01T00:00:00Z",
    });
    render(
      <AlignmentWorkspacePage
        shotId="s1"
        data={data({ assessments: [current, older] })}
      />,
    );
    expect(screen.getByText("Assessment history")).toBeVisible();
    // The historical row's own real attention level and assessed
    // Version (from the shared default fixture, since neither is
    // overridden here) -- not the stored executive_summary text.
    expect(screen.getByText("High attention · SH010_v001")).toBeVisible();
  });

  it("sources the History row summary from that historical assessment's own attention level, Version, and severity -- never the current assessment's, and never the stored executive_summary text", () => {
    const current = assessment({
      id: "a2",
      created_at: "2026-01-05T00:00:00Z",
      version_id: "v-current",
      intent_signal: { ...assessment().intent_signal, attention_level: "low" },
      assessment_output: {
        ...assessment().assessment_output,
        executive_summary: "Free-form current summary, irrelevant here.",
        cross_role_tensions: [
          finding(),
          finding(),
          finding(),
          finding(),
          finding(),
        ],
      },
    });
    const older = assessment({
      id: "a1",
      created_at: "2026-01-01T00:00:00Z",
      version_id: "v-older",
      intent_signal: {
        ...assessment().intent_signal,
        attention_level: "high",
      },
      assessment_output: {
        ...assessment().assessment_output,
        // Deliberately stale/irrelevant -- historySummaryText never
        // reads executive_summary at all.
        executive_summary:
          "[Cross-role deterministic] 9 cross-role tension(s)...",
        local_optimum_risks: [finding({ priority: "high" })],
      },
    });
    render(
      <AlignmentWorkspacePage
        shotId="s1"
        data={data({
          assessments: [current, older],
          versionsById: new Map([
            [
              "v-current",
              version({
                id: "v-current",
                name: "Current Cut",
                version_number: 9,
              }),
            ],
            [
              "v-older",
              version({
                id: "v-older",
                name: "Earlier Cut",
                version_number: 1,
              }),
            ],
          ]),
        })}
      />,
    );
    // The History row shows the historical assessment's own attention,
    // Version, and severity -- not the current assessment's ("Current
    // Cut" legitimately appears elsewhere on the page, in Context
    // Inspector's Current Production Context, so this asserts the
    // History row's own exact text rather than document-wide absence).
    expect(
      screen.getByText(
        "High attention · Earlier Cut · 1 high-priority local-optimum risk",
      ),
    ).toBeVisible();
    expect(
      screen.queryByText(/Cross-role deterministic/),
    ).not.toBeInTheDocument();
  });

  it("regression (Golden-Journey shaped): current and historical Assessments share identical aggregate counts (2/3/1) but the History row still truthfully distinguishes the historical state via its own attention, Version, severity, and Re-anchor Proposal", () => {
    const current = assessment({
      id: "a2-resolved",
      created_at: "2026-08-08T20:22:59Z",
      version_id: "v-resolved",
      intent_signal: {
        ...assessment().intent_signal,
        attention_level: "medium",
      },
      re_anchor_proposal: null,
      assessment_output: {
        ...assessment().assessment_output,
        executive_summary:
          "[Cross-role deterministic] 1 cross-role tension(s), 0 local-optimum risk(s), and " +
          "1 unresolved dependency(ies) considered across the VFX Supervisor Agent, CG " +
          "Supervisor Agent, and Artist Agent recorded output.",
        cross_role_tensions: [
          finding({ summary: "Coordination concern.", priority: "medium" }),
          finding({
            summary: "Integration now reads as restrained, not spectacle.",
            priority: "medium",
          }),
        ],
        local_optimum_risks: [
          finding({ summary: "Animation R2 refinement.", priority: "medium" }),
          finding({ summary: "Lighting R2 refinement.", priority: "medium" }),
          finding({
            summary: "Compositing R2 refinement.",
            priority: "medium",
          }),
        ],
        unresolved_dependencies: [
          finding({ summary: "Evidence gap noted.", priority: "low" }),
        ],
      },
    });
    const historical = assessment({
      id: "a1-conflict",
      created_at: "2026-08-08T17:10:06Z",
      version_id: "v-conflict",
      intent_signal: {
        ...assessment().intent_signal,
        attention_level: "high",
      },
      re_anchor_proposal: {
        id: "rap1",
        cross_role_assessment_id: "a1-conflict",
        project_id: "p1",
        shot_id: "s1",
        current_core_anchor_revision_id: "r1",
        proposal_output: {
          reason_for_consideration:
            "Combined department intensity approaches the confirmed ceiling.",
          preserved_elements: [],
          proposed_fields: [],
          adoption_risks: [],
          questions_for_human_vfx_supervisor: [],
          evidence: [],
        },
        created_at: "2026-08-08T17:10:06Z",
      },
      assessment_output: {
        ...assessment().assessment_output,
        // Same stale stored text as `current` -- both rows in the real
        // Golden Journey DB carry this identical "1/0/1" snapshot, which
        // must never be trusted as source of truth for either row.
        executive_summary:
          "[Cross-role deterministic] 1 cross-role tension(s), 0 local-optimum risk(s), and " +
          "1 unresolved dependency(ies) considered across the VFX Supervisor Agent, CG " +
          "Supervisor Agent, and Artist Agent recorded output.",
        cross_role_tensions: [
          finding({ summary: "Coordination concern.", priority: "medium" }),
          finding({
            summary: "Shifts toward heroic, theatrical spectacle.",
            priority: "medium",
          }),
        ],
        local_optimum_risks: [
          finding({ summary: "Animation conflict.", priority: "high" }),
          finding({ summary: "Lighting conflict.", priority: "high" }),
          finding({ summary: "Compositing conflict.", priority: "high" }),
        ],
        unresolved_dependencies: [
          finding({ summary: "Evidence gap noted.", priority: "low" }),
        ],
      },
    });
    render(
      <AlignmentWorkspacePage
        shotId="s1"
        data={data({
          assessments: [current, historical],
          versionsById: new Map([
            [
              "v-resolved",
              version({
                id: "v-resolved",
                name: "Comp Resolved",
                version_number: 2,
              }),
            ],
            [
              "v-conflict",
              version({
                id: "v-conflict",
                name: "Compositing Conflict",
                version_number: 1,
              }),
            ],
          ]),
        })}
      />,
    );
    // Both assessments have identical 2 tensions / 3 risks / 1 dependency
    // totals -- confirmed against the real Golden Journey database. The
    // Signal correctly shows the current assessment's own natural-
    // language counts.
    expect(
      screen.getByText(
        "Current assessment identifies 2 cross-role tensions, 3 local-optimum risks, and 1 unresolved dependency across the VFX Supervisor, CG Supervisor, and Artist Agent outputs.",
      ),
    ).toBeVisible();
    // Despite identical totals, the History row truthfully distinguishes
    // the historical (conflict) state: higher attention, its own real
    // Version, its own higher-severity risk signal, and its own
    // Re-anchor Proposal -- none of which the current (resolved) state
    // has.
    expect(
      screen.getByText(
        "High attention · Compositing Conflict · 3 high-priority local-optimum risks · Re-anchor proposed",
      ),
    ).toBeVisible();
  });

  describe("Package C follow-up: reassessment readiness alongside a historical Assessment", () => {
    it("does not offer reassessment when no newer eligible Version/evidence exists", () => {
      render(<AlignmentWorkspacePage shotId="s1" data={data()} />);
      expect(
        screen.queryByText(
          "A newer eligible Version is ready for reassessment",
        ),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", {
          name: "Generate new Cross-role Assessment",
        }),
      ).not.toBeInTheDocument();
    });

    it("surfaces Generate new Cross-role Assessment once a newer eligible Version/evidence set is ready, without hiding the historical Assessment", () => {
      render(
        <AlignmentWorkspacePage
          shotId="s1"
          data={data({
            item: item({
              generation_ready_task_id: "t1",
              generation_ready_version_id: "v2",
            }),
            versionsById: new Map([
              ["v1", version()],
              [
                "v2",
                version({
                  id: "v2",
                  name: "SH010_v002",
                  version_number: 2,
                }),
              ],
            ]),
          })}
        />,
      );
      expect(
        screen.getByText("A newer eligible Version is ready for reassessment"),
      ).toBeVisible();
      expect(
        screen.getByRole("button", {
          name: "Generate new Cross-role Assessment",
        }),
      ).toBeVisible();
      // The historical Assessment's own content is still fully shown,
      // clearly labelled, never replaced or hidden.
      expect(screen.getByText("Historical assessment")).toBeVisible();
      expect(
        screen.getByText(
          "The Version stays close to the confirmed Core Anchor.",
        ),
      ).toBeVisible();
    });

    it("calls the real generation action with the newer eligible Task/Version pair, never the historical pair", async () => {
      generateAssessmentActionMock.mockResolvedValue({ ok: true });
      const user = userEvent.setup();
      render(
        <AlignmentWorkspacePage
          shotId="s1"
          data={data({
            item: item({
              generation_ready_task_id: "t1",
              generation_ready_version_id: "v2",
            }),
            versionsById: new Map([
              ["v1", version()],
              [
                "v2",
                version({ id: "v2", name: "SH010_v002", version_number: 2 }),
              ],
            ]),
          })}
        />,
      );

      await user.click(
        screen.getByRole("button", {
          name: "Generate new Cross-role Assessment",
        }),
      );

      expect(generateAssessmentActionMock).toHaveBeenCalledWith(
        "s1",
        "v2",
        "t1",
      );
    });

    it("keeps an existing Re-anchor Proposal visible but secondary to reassessment -- owner-locked priority rule", () => {
      render(
        <AlignmentWorkspacePage
          shotId="s1"
          data={data({
            item: item({
              generation_ready_task_id: "t1",
              generation_ready_version_id: "v2",
            }),
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
            versionsById: new Map([
              ["v1", version()],
              [
                "v2",
                version({ id: "v2", name: "SH010_v002", version_number: 2 }),
              ],
            ]),
          })}
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
    });
  });

  it("numbers Detailed Assessment findings 01/02, restarting per category (CG-validated numbered-row grammar backport)", async () => {
    const user = userEvent.setup();
    render(
      <AlignmentWorkspacePage
        shotId="s1"
        data={data({
          assessments: [
            assessment({
              assessment_output: {
                ...assessment().assessment_output,
                cross_role_tensions: [
                  finding({ summary: "First tension.", priority: "high" }),
                  finding({ summary: "Second tension.", priority: "medium" }),
                ],
                local_optimum_risks: [
                  finding({ summary: "Only risk.", priority: "low" }),
                ],
              },
            }),
          ],
        })}
      />,
    );

    await user.click(screen.getByText("View detailed assessment →"));

    const tensionsGroup = screen
      .getByText("Cross-role tensions (2)")
      .closest("section") as HTMLElement;
    const tensionsIndexes = within(tensionsGroup)
      .getAllByText(/^0\d$/)
      .map((element) => element.textContent);
    expect(tensionsIndexes).toEqual(["01", "02"]);

    const risksGroup = screen
      .getByText("Local-optimum risks (1)")
      .closest("section") as HTMLElement;
    expect(within(risksGroup).getByText("01")).toBeInTheDocument();
  });

  it("shows numbered rows with real severity, and omits the full rationale, in the default decision-relevant preview (CG-validated compact preview grammar backport)", () => {
    render(
      <AlignmentWorkspacePage
        shotId="s1"
        data={data({
          assessments: [
            assessment({
              assessment_output: {
                ...assessment().assessment_output,
                cross_role_tensions: [
                  finding({
                    summary: "A high-priority pacing tension.",
                    why_it_matters: "This should not appear in the preview.",
                    priority: "high",
                  }),
                ],
              },
            }),
          ],
        })}
      />,
    );

    const decisionRelevantSection = screen
      .getByText("Most decision-relevant findings")
      .closest("div") as HTMLElement;
    expect(within(decisionRelevantSection).getByText("01")).toBeVisible();
    expect(within(decisionRelevantSection).getByText("high")).toBeVisible();
    expect(
      within(decisionRelevantSection).getByText(
        "A high-priority pacing tension.",
      ),
    ).toBeVisible();
    expect(
      within(decisionRelevantSection).queryByText(
        "This should not appear in the preview.",
      ),
    ).not.toBeInTheDocument();
  });

  it("strips a verified generator label from a finding even when embedded mid-sentence, never only when it's a leading prefix (shared @/design stripGeneratorLabel)", async () => {
    const user = userEvent.setup();
    render(
      <AlignmentWorkspacePage
        shotId="s1"
        data={data({
          assessments: [
            assessment({
              assessment_output: {
                ...assessment().assessment_output,
                cross_role_tensions: [
                  finding({
                    summary:
                      "Execution reads hot [CG Agent execution anchor draft - D1 combined-intensity ceiling translation] against the boundary.",
                    priority: "medium",
                  }),
                ],
              },
            }),
          ],
        })}
      />,
    );

    await user.click(screen.getByText("View detailed assessment →"));

    const tensionsGroup = screen
      .getByText("Cross-role tensions (1)")
      .closest("section") as HTMLElement;
    expect(
      within(tensionsGroup).getByText(
        "Execution reads hot against the boundary.",
      ),
    ).toBeVisible();
    expect(
      screen.queryByText(/CG Agent execution anchor draft/),
    ).not.toBeInTheDocument();
  });
});
