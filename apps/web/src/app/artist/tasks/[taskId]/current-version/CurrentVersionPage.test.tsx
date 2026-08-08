import type {
  ArtistAgentGuidanceRead,
  ArtistInboxItemRead,
  CrossRoleAssessmentRead,
  ExecutionAnchorRevisionRead,
  ReviewNoteRead,
  VersionRead,
} from "@intent-core/contracts";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/artist/tasks/t1/current-version",
}));

const { generateArtistGuidanceActionMock, publishResolvedVersionActionMock } =
  vi.hoisted(() => ({
    generateArtistGuidanceActionMock: vi.fn(),
    publishResolvedVersionActionMock: vi.fn(),
  }));
vi.mock("@/features/artist/actions", () => ({
  generateArtistGuidanceAction: generateArtistGuidanceActionMock,
  publishResolvedVersionAction: publishResolvedVersionActionMock,
}));

import type { CurrentVersionData } from "@/features/artist/current-version/data";
import { CurrentVersionPage } from "./CurrentVersionPage";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function item(
  overrides: Partial<ArtistInboxItemRead> = {},
): ArtistInboxItemRead {
  return {
    task_id: "t1",
    task_name: "Compositing Review",
    department: "compositing",
    task_source: "manual",
    shot_id: "s1",
    shot_name: "Shot 010",
    project_id: "p1",
    project_name: "D1 Demo Project",
    execution_anchor_state: "confirmed",
    active_execution_anchor_revision_id: "ea1",
    active_execution_anchor_summary:
      "Keep the silhouette readable against the backlight.",
    latest_version_id: "v1",
    latest_version_name: "SH010_v001",
    latest_version_number: 1,
    guidance_state: "none",
    latest_guidance_id: null,
    open_review_note_count: 1,
    open_dependency_count: 0,
    current_focus: {
      focus_type: "guidance_available",
      title: "New Artist guidance is available",
      explanation: "Real guidance has been generated for the latest Version.",
      target_route: "/artist/tasks/t1",
      primary_action_label: "Review guidance",
      actionable: true,
    },
    sort_rank: 0,
    ...overrides,
  };
}

function version(overrides: Partial<VersionRead> = {}): VersionRead {
  return {
    id: "v1",
    shot_id: "s1",
    name: "SH010_v001",
    version_number: 1,
    description: "First pass.",
    source: "manual",
    created_by_actor_kind: "human",
    created_by_actor_id: "artist-1",
    created_by_human_role: "artist",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function note(overrides: Partial<ReviewNoteRead> = {}): ReviewNoteRead {
  return {
    id: "n1",
    version_id: "v1",
    content: "Contrast reads slightly hot.",
    source: "manual",
    created_by_actor_kind: "human",
    created_by_actor_id: "cg-1",
    created_by_human_role: "cg_supervisor",
    created_at: "2026-01-02T00:00:00Z",
    ...overrides,
  };
}

function executionAnchorRevision(
  overrides: Partial<ExecutionAnchorRevisionRead> = {},
): ExecutionAnchorRevisionRead {
  return {
    id: "ea1",
    execution_anchor_id: "ea",
    core_anchor_revision_id: "ca1",
    revision_number: 1,
    status: "confirmed",
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
    confirmed_by_human_role: "cg_supervisor",
    confirmed_by_actor_id: "cg-1",
    confirmed_at: "2026-01-02T00:00:00Z",
    supersedes_revision_id: null,
    created_at: "2026-01-02T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
    ...overrides,
  };
}

function guidanceItem() {
  return {
    summary: "Summary.",
    why_it_matters: "Why it matters.",
    priority: "medium" as const,
    evidence: [
      {
        source_type: "version" as const,
        source_id: "v1",
        label: "Version v1",
      },
    ],
  };
}

function guidance(
  overrides: Partial<ArtistAgentGuidanceRead> = {},
): ArtistAgentGuidanceRead {
  return {
    id: "g1",
    project_id: "p1",
    shot_id: "s1",
    task_id: "t1",
    version_id: "v1",
    execution_anchor_revision_id: "ea1",
    context_snapshot_id: "cs1",
    agent_run_id: "run1",
    guidance_output: {
      executive_summary: "Current guidance summary.",
      creative_intent_read: guidanceItem(),
      task_goal: guidanceItem(),
      current_iteration_read: guidanceItem(),
      non_negotiables: [],
      allowed_variations: [],
      feedback_translations: [],
      iteration_priorities: [],
      cross_department_dependencies: [],
      questions_for_human_supervisor: [],
      evidence_gaps: [],
    },
    created_at: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

function data(overrides: Partial<CurrentVersionData> = {}): CurrentVersionData {
  return {
    item: item(),
    versions: [version()],
    selectedVersion: version(),
    reviewNotes: [note()],
    guidances: [],
    guidancesWithProvenance: [],
    currentGuidance: null,
    coreAnchorRevision: null,
    executionAnchorRevision: null,
    cgSupervisorReviews: [],
    crossRoleAssessments: [],
    media: null,
    canPublishResolvedVersion: false,
    publishableExecutionAnchorRevision: null,
    ...overrides,
  };
}

describe("CurrentVersionPage", () => {
  it("renders Project > Shot > Task > Current Version breadcrumbs, tab active", () => {
    render(
      <CurrentVersionPage
        taskId="t1"
        data={data()}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("link", { name: "Current Version" }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("shows an honest unavailable state when the API could not be reached", () => {
    render(
      <CurrentVersionPage
        taskId="t1"
        data={null}
        unavailable
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText("This Task is unavailable")).toBeVisible();
  });

  it("shows the honest empty state when no Production Version exists for this Task's Shot", () => {
    render(
      <CurrentVersionPage
        taskId="t1"
        data={data({ versions: [], selectedVersion: null })}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByText("No Production Version is available"),
    ).toBeVisible();
  });

  it("renders real Production Versions, never confusing them with a Core/Execution Anchor Revision", () => {
    render(
      <CurrentVersionPage
        taskId="t1"
        data={data()}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("link", { name: /SH010_v001 \(v1\)/ }),
    ).toBeVisible();
    expect(screen.queryByText(/Core Anchor Revision/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Execution Anchor Revision/),
    ).not.toBeInTheDocument();
  });

  it("links each Version row to its own ?version= route", () => {
    const versionB = version({
      id: "v2",
      name: "SH010_v002",
      version_number: 2,
    });
    render(
      <CurrentVersionPage
        taskId="t1"
        data={data({ versions: [version(), versionB] })}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("link", { name: /SH010_v002 \(v2\)/ }),
    ).toHaveAttribute("href", "/artist/tasks/t1/current-version?version=v2");
  });

  it("shows the selected Version's real Review Notes", () => {
    render(
      <CurrentVersionPage
        taskId="t1"
        data={data()}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText("Contrast reads slightly hot.")).toBeVisible();
  });

  it("shows an honest empty state when no Review Notes exist for the selected Version", () => {
    render(
      <CurrentVersionPage
        taskId="t1"
        data={data({ reviewNotes: [] })}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByText(
        "No Review Notes have been recorded for this Production Version yet.",
      ),
    ).toBeVisible();
  });

  it("shows the ftrack external author as source provenance on the selected Version and its Review Notes, not an ICAS Human role (Step 8C-6/8C-7)", () => {
    render(
      <CurrentVersionPage
        taskId="t1"
        data={data({
          selectedVersion: version({
            source: "ftrack",
            created_by_actor_kind: "system",
            created_by_human_role: null,
            external_author_id: "ext-42",
            external_author_name: "Jamie Lin",
          }),
          reviewNotes: [
            note({
              source: "ftrack",
              created_by_actor_kind: "system",
              created_by_human_role: null,
              external_author_id: "ext-42",
              external_author_name: "Jamie Lin",
            }),
          ],
        })}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getAllByText(/Source author: Jamie Lin/).length).toBe(2);
    expect(screen.queryByText(/· artist$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/cg_supervisor/)).not.toBeInTheDocument();
  });

  it("falls back to the actor kind, never a fabricated name, when an ftrack row has no external_author_name", () => {
    render(
      <CurrentVersionPage
        taskId="t1"
        data={data({
          selectedVersion: version({
            source: "ftrack",
            created_by_actor_kind: "system",
            created_by_human_role: null,
            external_author_id: "ext-42",
            external_author_name: null,
          }),
          reviewNotes: [],
        })}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText(/· system$/)).toBeVisible();
    expect(screen.queryByText(/Source author:/)).not.toBeInTheDocument();
    expect(screen.queryByText("ext-42")).not.toBeInTheDocument();
  });

  it("shows the manual Human-role author as a human-readable label when no ftrack provenance exists (Step 9B-2 correction)", () => {
    render(
      <CurrentVersionPage
        taskId="t1"
        data={data()}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText(/· Artist$/)).toBeVisible();
    expect(screen.queryByText(/· artist$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Source author:/)).not.toBeInTheDocument();
  });

  it("shows Core Anchor and Execution Anchor context as read-only", () => {
    render(
      <CurrentVersionPage
        taskId="t1"
        data={data({
          coreAnchorRevision: {
            id: "ca1",
            core_anchor_id: "cap",
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
          },
        })}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText("Active Core Anchor (read-only)")).toBeVisible();
    expect(
      screen.getByText("Active Execution Anchor (read-only)"),
    ).toBeVisible();
    expect(screen.getByText("A restrained dusk confrontation.")).toBeVisible();
  });

  it("groups Version/Anchor references under Production Evidence, Artist guidance under Agent Interpretation, and confirmed-Anchor authority references under Human Decision without duplicating the full Working Direction (Step 9B-2)", () => {
    render(
      <CurrentVersionPage
        taskId="t1"
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

    const agentSection = agentHeading.closest(
      "[data-evidence-layer]",
    ) as HTMLElement;
    expect(
      within(agentSection).getByText("Applicable Artist guidance"),
    ).toBeVisible();

    const humanDecisionSection = humanDecisionHeading.closest(
      "[data-evidence-layer]",
    ) as HTMLElement;
    expect(
      within(humanDecisionSection).getByText("Confirmed authority references"),
    ).toBeVisible();
    expect(
      within(humanDecisionSection).getByText(
        "No Core Anchor is confirmed for this Shot yet.",
      ),
    ).toBeVisible();
    expect(
      within(humanDecisionSection).getByText(
        "No Execution Anchor is confirmed for this Task yet.",
      ),
    ).toBeVisible();
  });

  it("shows only a confirmed-authority reference for the Artist role, never Decision actor/rationale/timestamp detail, and no confirm/reject/edit control (Step 9B-2 correction)", () => {
    render(
      <CurrentVersionPage
        taskId="t1"
        data={data({
          coreAnchorRevision: {
            id: "ca1",
            core_anchor_id: "cap",
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
          },
          executionAnchorRevision: {
            id: "ea1",
            execution_anchor_id: "ea",
            core_anchor_revision_id: "ca1",
            revision_number: 1,
            status: "confirmed",
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
            confirmed_by_human_role: "cg_supervisor",
            confirmed_by_actor_id: "cg-1",
            confirmed_at: "2026-01-02T00:00:00Z",
            supersedes_revision_id: null,
            created_at: "2026-01-02T00:00:00Z",
            updated_at: "2026-01-02T00:00:00Z",
          },
        })}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    const humanDecisionSection = screen
      .getByText("Human Decision and Provenance")
      .closest("[data-evidence-layer]") as HTMLElement;

    expect(
      within(humanDecisionSection).getByText(
        "Confirmed under VFX Supervisor authority.",
      ),
    ).toBeVisible();
    expect(
      within(humanDecisionSection).getByText(
        "Confirmed under CG Supervisor authority.",
      ),
    ).toBeVisible();
    expect(
      within(humanDecisionSection).getAllByText(
        "Detailed Decision provenance is not exposed in the Artist role view.",
      ).length,
    ).toBe(2);

    // No Decision actor/rationale/decided-at detail is exposed to Artist
    // -- unlike CG Execution's Human Decision section, none of these
    // real Decision-provenance labels ever render here.
    expect(
      within(humanDecisionSection).queryByText("Actor role"),
    ).not.toBeInTheDocument();
    expect(
      within(humanDecisionSection).queryByText("Rationale"),
    ).not.toBeInTheDocument();
    expect(
      within(humanDecisionSection).queryByText("Decided at"),
    ).not.toBeInTheDocument();
    expect(
      within(humanDecisionSection).queryByText("2026-01-01T00:00:00Z"),
    ).not.toBeInTheDocument();

    // No Anchor confirm/reject/edit control anywhere on the page.
    expect(
      screen.queryByRole("button", { name: /confirm/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /reject/i }),
    ).not.toBeInTheDocument();
  });

  it("never describes an unconfirmed Anchor as confirmed under Human Decision and Provenance", () => {
    render(
      <CurrentVersionPage
        taskId="t1"
        data={data({ coreAnchorRevision: null, executionAnchorRevision: null })}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    const humanDecisionSection = screen
      .getByText("Human Decision and Provenance")
      .closest("[data-evidence-layer]") as HTMLElement;
    expect(
      within(humanDecisionSection).queryByText(/Confirmed under/),
    ).not.toBeInTheDocument();
    expect(
      within(humanDecisionSection).getByText(
        "No Core Anchor is confirmed for this Shot yet.",
      ),
    ).toBeVisible();
    expect(
      within(humanDecisionSection).getByText(
        "No Execution Anchor is confirmed for this Task yet.",
      ),
    ).toBeVisible();
  });

  it("honestly shows no Agent Execution Review has been generated yet", () => {
    render(
      <CurrentVersionPage
        taskId="t1"
        data={data()}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByText(
        "No Agent Execution Review has been generated for the active Execution Anchor yet.",
      ),
    ).toBeVisible();
  });

  it("honestly shows no Cross-role Assessment involves this Version yet", () => {
    render(
      <CurrentVersionPage
        taskId="t1"
        data={data()}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByText("No Cross-role Assessment involves this Version yet."),
    ).toBeVisible();
  });

  it("real Cross-role Assessment count renders honestly once one exists", () => {
    const finding = {
      summary: "The emotional restraint reads clearly across departments.",
      why_it_matters: "Keeps the core intent legible.",
      affected_roles: ["vfx_supervisor" as const],
      priority: "low" as const,
      evidence: [],
    };
    const assessment: CrossRoleAssessmentRead = {
      id: "cra1",
      project_id: "p1",
      shot_id: "s1",
      task_id: "t1",
      version_id: "v1",
      core_anchor_revision_id: "ca1",
      execution_anchor_revision_id: "ea1",
      vfx_supervisor_review_id: "vr1",
      cg_supervisor_review_id: "cr1",
      artist_agent_guidance_id: "ag1",
      context_snapshot_id: "cs1",
      agent_run_id: "run1",
      assessment_output: {
        executive_summary:
          "The Version stays close to the confirmed Core Anchor.",
        shared_intent_read: finding,
        role_perspectives: [],
        agreements: [],
        cross_role_tensions: [],
        local_optimum_risks: [],
        unresolved_dependencies: [],
        human_coordination_priorities: [],
        re_anchor_proposal: null,
        evidence_gaps: [],
      },
      created_at: "2026-01-01T00:00:00Z",
      intent_signal: {
        id: "sig1",
        cross_role_assessment_id: "cra1",
        project_id: "p1",
        shot_id: "s1",
        task_id: "t1",
        version_id: "v1",
        attention_level: "low",
        signal_output: {
          attention_level: "low",
          label: "low_attention",
          summary: "No cross-role tension detected.",
          drivers: [],
          role_coverage: {
            vfx_supervisor: true,
            cg_supervisor: true,
            artist: true,
          },
          re_anchor_proposal_present: false,
          caveats: [],
        },
        created_at: "2026-01-01T00:00:00Z",
      },
      re_anchor_proposal: null,
    };
    render(
      <CurrentVersionPage
        taskId="t1"
        data={data({ crossRoleAssessments: [assessment] })}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText("1 Cross-role Assessment recorded.")).toBeVisible();
  });

  it("honestly shows no Artist guidance has been generated for this Version yet", () => {
    render(
      <CurrentVersionPage
        taskId="t1"
        data={data()}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByText(
        "No Artist guidance has been generated for this Version yet.",
      ),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Generate guidance" }),
    ).toBeVisible();
  });

  it("shows the current guidance for the active Execution Anchor revision and labels an older guidance against a superseded revision as Historical, using each guidance's own real provenance rather than today's live anchors", () => {
    const currentExecutionRevision = executionAnchorRevision({
      id: "ea2",
      revision_number: 2,
      confirmed_at: "2026-02-01T00:00:00Z",
      created_at: "2026-02-01T00:00:00Z",
      updated_at: "2026-02-01T00:00:00Z",
    });
    const historicalGuidance = guidance({
      id: "g-historical",
      execution_anchor_revision_id: "ea1",
      created_at: "2026-01-05T00:00:00Z",
      guidance_output: {
        ...guidance().guidance_output,
        executive_summary: "Historical guidance from the R1/conflict era.",
      },
    });
    const currentGuidance = guidance({
      id: "g-current",
      execution_anchor_revision_id: "ea2",
      created_at: "2026-02-02T00:00:00Z",
      guidance_output: {
        ...guidance().guidance_output,
        executive_summary: "Current guidance for the resolved Version.",
      },
    });
    render(
      <CurrentVersionPage
        taskId="t1"
        data={data({
          executionAnchorRevision: currentExecutionRevision,
          guidances: [currentGuidance, historicalGuidance],
          guidancesWithProvenance: [
            {
              guidance: currentGuidance,
              executionAnchorRevisionNumber: 2,
              isCurrent: true,
            },
            {
              guidance: historicalGuidance,
              executionAnchorRevisionNumber: 1,
              isCurrent: false,
            },
          ],
          currentGuidance,
        })}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );

    expect(
      screen.getAllByText("Current guidance for the resolved Version.").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText("Historical guidance from the R1/conflict era."),
    ).toBeVisible();
    expect(screen.getByText("Historical")).toBeVisible();
    expect(screen.getByText(/Execution Anchor R1/)).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Regenerate guidance" }),
    ).toBeVisible();
  });

  it("shows a truthful 'no current guidance' message and keeps old guidance labeled Historical once the Execution Anchor is reconfirmed at a newer revision, without recomputing the old guidance's provenance from today's anchors", () => {
    const currentExecutionRevision = executionAnchorRevision({
      id: "ea2",
      revision_number: 2,
    });
    const historicalGuidance = guidance({
      id: "g-historical",
      execution_anchor_revision_id: "ea1",
      guidance_output: {
        ...guidance().guidance_output,
        executive_summary:
          "Guidance generated against the earlier Execution Anchor.",
      },
    });
    render(
      <CurrentVersionPage
        taskId="t1"
        data={data({
          executionAnchorRevision: currentExecutionRevision,
          guidances: [historicalGuidance],
          guidancesWithProvenance: [
            {
              guidance: historicalGuidance,
              executionAnchorRevisionNumber: 1,
              isCurrent: false,
            },
          ],
          currentGuidance: null,
        })}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );

    expect(
      screen.getByText(
        "No current Artist guidance has been generated for Execution Anchor R2 yet.",
      ),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Guidance generated against the earlier Execution Anchor.",
      ),
    ).toBeVisible();
    expect(screen.getByText("Historical")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Generate guidance" }),
    ).toBeVisible();
  });

  it("does not invent an upload/submit/approve/complete action anywhere on the page", () => {
    render(
      <CurrentVersionPage
        taskId="t1"
        data={data()}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /upload/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /submit/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /approve/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /complete/i }),
    ).not.toBeInTheDocument();
  });

  describe("Step 9B-4 real media context", () => {
    it("renders the server-resolved media as Production Evidence for the selected Version", () => {
      render(
        <CurrentVersionPage
          taskId="t1"
          data={data({
            media: {
              version_id: "v1",
              source: "ftrack",
              ftrack_linked: true,
              media_state: "playable",
              thumbnail_url: "https://ftrack.example/thumb",
              playable_url: "https://ftrack.example/video",
              playable_media_type: "video/mp4",
              playable_component_name: "ftrackreview-mp4",
              external_web_url: null,
              resolved_at: "2026-08-01T00:00:00Z",
              url_expires_at: null,
              unavailable_reason: null,
            },
          })}
          unavailable={false}
          onExitRole={vi.fn()}
        />,
      );
      const videoEl = document.querySelector("video") as HTMLVideoElement;
      expect(videoEl).toBeTruthy();
      expect(videoEl).not.toHaveAttribute("autoplay");
      expect(videoEl).toHaveAttribute("controls");
    });

    it("shows an honest unavailable state, not a fake frame, when no media is resolved", () => {
      render(
        <CurrentVersionPage
          taskId="t1"
          data={data({ media: null })}
          unavailable={false}
          onExitRole={vi.fn()}
        />,
      );
      expect(document.querySelector("video")).toBeNull();
      expect(screen.getByText("No media context is available.")).toBeVisible();
    });

    it("does not give Artist any upload, approval, or ftrack write control from the media panel", () => {
      render(
        <CurrentVersionPage
          taskId="t1"
          data={data({
            media: {
              version_id: "v1",
              source: "ftrack",
              ftrack_linked: true,
              media_state: "thumbnail_only",
              thumbnail_url: "https://ftrack.example/thumb",
              playable_url: null,
              playable_media_type: null,
              playable_component_name: null,
              external_web_url: null,
              resolved_at: "2026-08-01T00:00:00Z",
              url_expires_at: null,
              unavailable_reason: null,
            },
          })}
          unavailable={false}
          onExitRole={vi.fn()}
        />,
      );
      expect(
        screen.queryByRole("button", { name: /Upload/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Approve/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("Package C follow-up: Publish next Version from Execution Anchor R{n}", () => {
    function executionAnchorRevision(
      overrides: Partial<ExecutionAnchorRevisionRead> = {},
    ): ExecutionAnchorRevisionRead {
      return {
        id: "ea-rev-2",
        execution_anchor_id: "ea1",
        core_anchor_revision_id: "core-rev-2",
        revision_number: 2,
        status: "confirmed",
        technical_boundaries: "Preserve the combined-intensity ceiling.",
        parameter_ranges: null,
        delivery_conditions: null,
        production_ready_criteria: null,
        downstream_dependencies: null,
        publish_requirements: null,
        allowed_refinements: "Local refinements within Animation's own range.",
        escalation_conditions: null,
        created_by_actor_kind: "agent",
        created_by_actor_id: "cg-agent",
        created_by_human_role: null,
        created_by_agent_type: "cg_supervisor_agent",
        created_by_agent_run_id: "run-1",
        confirmed_by_human_role: "cg_supervisor",
        confirmed_by_actor_id: "cg-1",
        confirmed_at: "2026-08-01T00:00:00Z",
        supersedes_revision_id: "ea-rev-1",
        created_at: "2026-08-01T00:00:00Z",
        updated_at: "2026-08-01T00:00:00Z",
        ...overrides,
      };
    }

    it("offers the Publish action once the confirmed Execution Anchor is genuinely current and unpublished", () => {
      render(
        <CurrentVersionPage
          taskId="t1"
          data={data({
            canPublishResolvedVersion: true,
            publishableExecutionAnchorRevision: executionAnchorRevision(),
          })}
          unavailable={false}
          onExitRole={vi.fn()}
        />,
      );
      expect(
        screen.getByRole("button", {
          name: "Publish next Version from Execution Anchor R2",
        }),
      ).toBeVisible();
    });

    it("does not offer the Publish action when the current Version already reflects this Execution Anchor revision", () => {
      render(
        <CurrentVersionPage
          taskId="t1"
          data={data({
            canPublishResolvedVersion: false,
            publishableExecutionAnchorRevision: null,
          })}
          unavailable={false}
          onExitRole={vi.fn()}
        />,
      );
      expect(
        screen.queryByRole("button", {
          name: /Publish next Version from Execution Anchor/,
        }),
      ).not.toBeInTheDocument();
    });

    it("calls the real publish action with this Task's id, never a fabricated Version", async () => {
      publishResolvedVersionActionMock.mockResolvedValue({ ok: true });
      const user = userEvent.setup();
      render(
        <CurrentVersionPage
          taskId="t1"
          data={data({
            canPublishResolvedVersion: true,
            publishableExecutionAnchorRevision: executionAnchorRevision(),
          })}
          unavailable={false}
          onExitRole={vi.fn()}
        />,
      );

      await user.click(
        screen.getByRole("button", {
          name: "Publish next Version from Execution Anchor R2",
        }),
      );

      expect(publishResolvedVersionActionMock).toHaveBeenCalledWith("t1");
    });

    it("surfaces the action's own error message without publishing silently succeeding", async () => {
      publishResolvedVersionActionMock.mockResolvedValue({
        ok: false,
        error: {
          kind: "conflict",
          message:
            "This Task's confirmed Execution Anchor is not yet current, or a resolved Version already exists for it.",
        },
      });
      const user = userEvent.setup();
      render(
        <CurrentVersionPage
          taskId="t1"
          data={data({
            canPublishResolvedVersion: true,
            publishableExecutionAnchorRevision: executionAnchorRevision(),
          })}
          unavailable={false}
          onExitRole={vi.fn()}
        />,
      );

      await user.click(
        screen.getByRole("button", {
          name: "Publish next Version from Execution Anchor R2",
        }),
      );

      expect(
        await screen.findByText(
          "This Task's confirmed Execution Anchor is not yet current, or a resolved Version already exists for it.",
        ),
      ).toBeVisible();
    });
  });
});
