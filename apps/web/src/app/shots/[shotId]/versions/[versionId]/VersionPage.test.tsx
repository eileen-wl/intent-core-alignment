import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  AgentRunRead,
  AlignmentAssessmentRead,
  ArtistAgentGuidanceRead,
  ContextSnapshotRead,
  CoreAnchorRevisionRead,
  DecisionRead,
  ReviewNoteRead,
  TaskRead,
  VersionRead,
  VFXSupervisorReviewRead,
} from "@intent-core/contracts";

import { VersionPage } from "./VersionPage";

const NOW = "2026-01-01T00:00:00Z";

function version(overrides: Partial<VersionRead> = {}): VersionRead {
  return {
    id: "version-1",
    shot_id: "shot-1",
    name: "SH010_render_v001",
    version_number: 1,
    description: "First render pass, added camera shake.",
    source: "manual",
    created_by_actor_kind: "human",
    created_by_actor_id: "vfx-1",
    created_by_human_role: "vfx_supervisor",
    created_at: NOW,
    ...overrides,
  };
}

function reviewNote(overrides: Partial<ReviewNoteRead> = {}): ReviewNoteRead {
  return {
    id: "note-1",
    version_id: "version-1",
    content: "The shake feels too aggressive.",
    source: "manual",
    created_by_actor_kind: "human",
    created_by_actor_id: "cg-1",
    created_by_human_role: "cg_supervisor",
    created_at: NOW,
    ...overrides,
  };
}

function coreAnchorRevision(
  overrides: Partial<CoreAnchorRevisionRead> = {},
): CoreAnchorRevisionRead {
  return {
    id: "rev-confirmed",
    core_anchor_id: "anchor-1",
    revision_number: 1,
    status: "confirmed",
    shot_objective: null,
    emotional_tone: null,
    visual_focus: null,
    rhythm_intensity: null,
    character_relationship: null,
    narrative_priority: null,
    core_summary: "A restrained, cinematic chase.",
    created_by_actor_kind: "human",
    created_by_actor_id: "vfx-1",
    created_by_human_role: "vfx_supervisor",
    created_by_agent_type: null,
    created_by_agent_run_id: null,
    context_snapshot_id: null,
    confirmed_by_human_role: "vfx_supervisor",
    confirmed_by_actor_id: "vfx-1",
    confirmed_at: NOW,
    supersedes_revision_id: null,
    source_intent_decomposition_id: null,
    created_at: NOW,
    updated_at: NOW,
    constraints: [],
    variation_zones: [],
    drift_risks: [],
    references: [],
    open_questions: [],
    ...overrides,
  };
}

function assessment(
  overrides: Partial<AlignmentAssessmentRead> = {},
): AlignmentAssessmentRead {
  return {
    id: "assessment-1",
    version_id: "version-1",
    core_anchor_revision_id: "rev-confirmed",
    context_snapshot_id: "snapshot-1",
    agent_run_id: "run-1",
    alignment_state: "minor_drift",
    envelope: {
      summary:
        "The added camera shake contradicts the confirmed restrained tone.",
      observations: ["Review note flags the shake as too aggressive."],
      inferences: [
        "The Version likely departs from the confirmed emotional tone.",
      ],
      evidence: ["Review note: The shake feels too aggressive."],
      confidence: 0.8,
      open_questions: [],
      recommended_actions: ["Reduce camera shake to match the confirmed tone."],
      requires_human_gate: true,
    },
    created_at: NOW,
    ...overrides,
  };
}

function decision(overrides: Partial<DecisionRead> = {}): DecisionRead {
  return {
    id: "decision-1",
    decision_type: "accept_alignment_assessment",
    owning_human_role: "vfx_supervisor",
    actor_kind: "human",
    actor_id: "vfx-1",
    actor_human_role: "vfx_supervisor",
    rationale: null,
    entity_type: "alignment_assessment",
    entity_id: "assessment-1",
    write_back_requested: false,
    supersedes_decision_id: null,
    created_at: NOW,
    ...overrides,
  };
}

function agentRun(overrides: Partial<AgentRunRead> = {}): AgentRunRead {
  return {
    id: "run-1",
    shot_id: "shot-1",
    context_snapshot_id: "snapshot-1",
    agent_type: "core_agent",
    capability: "alignment_assessment",
    provider: "deterministic",
    model_name: null,
    prompt_version: null,
    status: "succeeded",
    result_revision_id: null,
    error: null,
    started_at: NOW,
    completed_at: NOW,
    ...overrides,
  };
}

function contextSnapshot(
  overrides: Partial<ContextSnapshotRead> = {},
): ContextSnapshotRead {
  return {
    id: "snapshot-1",
    shot_id: "shot-1",
    payload: {},
    created_at: NOW,
    ...overrides,
  };
}

function vfxSupervisorReview(
  overrides: Partial<VFXSupervisorReviewRead> = {},
): VFXSupervisorReviewRead {
  return {
    id: "vfx-review-1",
    project_id: "project-1",
    shot_id: "shot-1",
    version_id: "version-1",
    context_snapshot_id: "snapshot-1",
    agent_run_id: "run-vfx-1",
    review_output: {
      executive_summary: "One constraint and one open question considered.",
      creative_direction_read: {
        summary: "Review against the confirmed restrained chase direction.",
        rationale: "Directly stated on the confirmed Core Anchor revision.",
        priority: "high",
        evidence: [
          {
            source_type: "core_anchor_revision",
            source_id: "rev-confirmed",
            label: "Confirmed Core Anchor",
          },
        ],
      },
      strengths: [],
      creative_concerns: [
        {
          summary: "Camera shake may depart from the restrained tone.",
          rationale: "A Review Note flags the shake as too aggressive.",
          priority: "medium",
          evidence: [
            {
              source_type: "review_note",
              source_id: "note-1",
              label: "Review note",
            },
          ],
        },
      ],
      review_priorities: [
        {
          summary: "Confirm the submission preserves: No jump cuts.",
          rationale:
            "Recorded Constraint on the confirmed Core Anchor revision.",
          priority: "high",
          evidence: [
            {
              source_type: "constraint",
              source_id: "constraint-1",
              label: "Constraint",
            },
          ],
        },
      ],
      proposed_feedback_notes: [
        {
          feedback:
            "Reduce the camera shake back toward the restrained direction.",
          underlying_intent:
            "The confirmed Core Anchor calls for a quiet, controlled chase.",
          priority: "high",
          evidence: [
            {
              source_type: "core_anchor_revision",
              source_id: "rev-confirmed",
              label: "Confirmed Core Anchor",
            },
          ],
        },
      ],
      questions_for_human_supervisor: [
        "Does the actual footage match the recorded description?",
      ],
      evidence_gaps: [
        "No image, video, or frame evidence is available to this Agent.",
      ],
    },
    created_at: NOW,
    ...overrides,
  };
}

function task(overrides: Partial<TaskRead> = {}): TaskRead {
  return {
    id: "task-1",
    shot_id: "shot-1",
    name: "Lighting Pass",
    department: "lighting",
    source: "manual",
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function artistAgentGuidance(
  overrides: Partial<ArtistAgentGuidanceRead> = {},
): ArtistAgentGuidanceRead {
  return {
    id: "artist-guidance-1",
    project_id: "project-1",
    shot_id: "shot-1",
    task_id: "task-1",
    version_id: "version-1",
    execution_anchor_revision_id: "exec-rev-1",
    context_snapshot_id: "snapshot-1",
    agent_run_id: "run-artist-1",
    guidance_output: {
      executive_summary: "One non-negotiable and one review note considered.",
      creative_intent_read: {
        summary:
          "This Shot's confirmed direction is a quiet, controlled chase.",
        why_it_matters:
          "This is the Shot's currently confirmed Core Anchor revision.",
        priority: "high",
        evidence: [
          {
            source_type: "core_anchor_revision",
            source_id: "rev-confirmed",
            label: "Confirmed Core Anchor",
          },
        ],
      },
      task_goal: {
        summary:
          "Lighting Pass delivers against the confirmed Execution Anchor.",
        why_it_matters:
          "This is the confirmed Execution Anchor revision for this Task.",
        priority: "high",
        evidence: [
          {
            source_type: "execution_anchor_revision",
            source_id: "exec-rev-1",
            label: "Execution Anchor revision",
          },
        ],
      },
      current_iteration_read: {
        summary: "This Version is one iteration toward the Task's goal.",
        why_it_matters:
          "This is the target Version this guidance was generated for.",
        priority: "medium",
        evidence: [
          { source_type: "version", source_id: "version-1", label: "Version" },
        ],
      },
      non_negotiables: [
        {
          summary: "Must preserve: No jump cuts.",
          why_it_matters:
            "Recorded Constraint on the confirmed Core Anchor revision.",
          priority: "high",
          evidence: [
            {
              source_type: "constraint",
              source_id: "constraint-1",
              label: "Constraint",
            },
          ],
        },
      ],
      allowed_variations: [
        {
          summary: "Open to variation: Camera speed may vary slightly.",
          why_it_matters:
            "Recorded VariationZone on the confirmed Core Anchor revision.",
          priority: "low",
          evidence: [
            {
              source_type: "variation_zone",
              source_id: "variation-1",
              label: "Variation zone",
            },
          ],
        },
      ],
      feedback_translations: [
        {
          feedback_or_issue: "Review note: The shake feels too aggressive.",
          practical_action: "Reduce the camera shake in the next iteration.",
          underlying_intent:
            "This feedback was recorded by a human reviewer for this Version.",
          self_check: "Before submitting, confirm the shake has been reduced.",
          priority: "medium",
          evidence: [
            {
              source_type: "review_note",
              source_id: "note-1",
              label: "Review note",
            },
          ],
        },
      ],
      iteration_priorities: [
        {
          summary: "Confirm the next iteration preserves: No jump cuts.",
          why_it_matters:
            "Recorded Constraint on the confirmed Core Anchor revision.",
          priority: "high",
          evidence: [
            {
              source_type: "constraint",
              source_id: "constraint-1",
              label: "Constraint",
            },
          ],
        },
      ],
      cross_department_dependencies: [
        {
          summary:
            "Coordinate with the Human CG Supervisor on execution guidance.",
          why_it_matters:
            "A CG Supervisor Agent review was recorded for this Task.",
          priority: "medium",
          evidence: [
            {
              source_type: "cg_supervisor_review",
              source_id: "cg-review-1",
              label: "CG Supervisor Agent review",
            },
          ],
        },
      ],
      questions_for_human_supervisor: [
        "Does the actual submitted work match the recorded Execution Anchor content?",
      ],
      evidence_gaps: [
        "ICAS has not directly inspected footage, rendered frames, scene files, or numeric parameters.",
      ],
    },
    created_at: NOW,
    ...overrides,
  };
}

interface Fixture {
  version: VersionRead | null;
  reviewNotes: ReviewNoteRead[];
  coreAnchorRevisions: CoreAnchorRevisionRead[];
  assessments: AlignmentAssessmentRead[];
  decisions: Record<string, DecisionRead[]>;
  agentRuns: Record<string, AgentRunRead>;
  contextSnapshots: Record<string, ContextSnapshotRead>;
  vfxSupervisorReviews: VFXSupervisorReviewRead[];
  tasks: TaskRead[];
  artistAgentGuidances: ArtistAgentGuidanceRead[];
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: async () => body,
  } as Response;
}

function installFetchMock(
  fixture: Fixture,
  overrides: {
    onRequest?: (
      method: string,
      path: string,
      init?: RequestInit,
    ) => Response | Promise<Response> | null;
  } = {},
) {
  const fetchMock = vi.fn(
    async (input: string | URL, init?: RequestInit): Promise<Response> => {
      const url = new URL(String(input));
      const path = url.pathname;
      const method = init?.method ?? "GET";

      const overridden = await overrides.onRequest?.(method, path, init);
      if (overridden) return overridden;

      if (method === "GET" && path === "/versions/version-1") {
        return fixture.version
          ? jsonResponse(200, fixture.version)
          : jsonResponse(404, { detail: "Version not found" });
      }
      if (method === "GET" && path === "/versions/version-1/review-notes") {
        return jsonResponse(200, fixture.reviewNotes);
      }
      if (
        method === "GET" &&
        path === "/intent/shots/shot-1/core-anchor/revisions"
      ) {
        return jsonResponse(200, fixture.coreAnchorRevisions);
      }
      if (method === "GET" && path === "/versions/version-1/assessments") {
        return jsonResponse(200, fixture.assessments);
      }
      const decisionsMatch = /^\/assessments\/([^/]+)\/decisions$/.exec(path);
      if (method === "GET" && decisionsMatch) {
        return jsonResponse(200, fixture.decisions[decisionsMatch[1]] ?? []);
      }
      const agentRunMatch = /^\/intent\/agent-runs\/([^/]+)$/.exec(path);
      if (method === "GET" && agentRunMatch) {
        const run = fixture.agentRuns[agentRunMatch[1]];
        return run
          ? jsonResponse(200, run)
          : jsonResponse(404, { detail: "Agent run not found" });
      }
      const contextSnapshotMatch =
        /^\/intent\/context-snapshots\/([^/]+)$/.exec(path);
      if (method === "GET" && contextSnapshotMatch) {
        const snapshot = fixture.contextSnapshots[contextSnapshotMatch[1]];
        return snapshot
          ? jsonResponse(200, snapshot)
          : jsonResponse(404, { detail: "Context snapshot not found" });
      }
      if (
        method === "POST" &&
        path === "/versions/version-1/assessments/generate"
      ) {
        const generated = assessment({
          id: "assessment-generated",
          alignment_state: "aligned",
        });
        fixture.assessments.push(generated);
        return jsonResponse(201, generated);
      }
      const acceptMatch = /^\/assessments\/([^/]+)\/accept$/.exec(path);
      if (method === "POST" && acceptMatch) {
        const id = acceptMatch[1];
        const created = decision({
          id: `decision-for-${id}`,
          decision_type: "accept_alignment_assessment",
          entity_id: id,
          rationale: JSON.parse(String(init?.body ?? "{}")).rationale ?? null,
        });
        fixture.decisions[id] = [...(fixture.decisions[id] ?? []), created];
        return jsonResponse(201, created);
      }
      const rejectMatch = /^\/assessments\/([^/]+)\/reject$/.exec(path);
      if (method === "POST" && rejectMatch) {
        const id = rejectMatch[1];
        const created = decision({
          id: `decision-for-${id}`,
          decision_type: "reject_alignment_assessment",
          entity_id: id,
          rationale: JSON.parse(String(init?.body ?? "{}")).rationale ?? null,
        });
        fixture.decisions[id] = [...(fixture.decisions[id] ?? []), created];
        return jsonResponse(201, created);
      }
      if (
        method === "GET" &&
        path === "/intent/versions/version-1/vfx-supervisor-reviews"
      ) {
        return jsonResponse(200, fixture.vfxSupervisorReviews);
      }
      if (
        method === "POST" &&
        path === "/intent/versions/version-1/vfx-supervisor-reviews/generate"
      ) {
        const generated = vfxSupervisorReview({
          id: "vfx-review-generated",
          agent_run_id: "run-vfx-generated",
        });
        fixture.agentRuns["run-vfx-generated"] = agentRun({
          id: "run-vfx-generated",
          agent_type: "vfx_supervisor_agent",
          capability: "creative_review",
        });
        fixture.vfxSupervisorReviews = [
          generated,
          ...fixture.vfxSupervisorReviews,
        ];
        return jsonResponse(201, generated);
      }
      if (method === "GET" && path === "/tasks") {
        return jsonResponse(200, fixture.tasks);
      }
      if (
        method === "GET" &&
        path === "/intent/versions/version-1/artist-guidances"
      ) {
        return jsonResponse(200, fixture.artistAgentGuidances);
      }
      if (
        method === "POST" &&
        path === "/intent/versions/version-1/artist-guidances/generate"
      ) {
        const generated = artistAgentGuidance({
          id: "artist-guidance-generated",
          agent_run_id: "run-artist-generated",
        });
        fixture.agentRuns["run-artist-generated"] = agentRun({
          id: "run-artist-generated",
          agent_type: "artist_agent",
          capability: "iteration_guidance",
        });
        fixture.artistAgentGuidances = [
          generated,
          ...fixture.artistAgentGuidances,
        ];
        return jsonResponse(201, generated);
      }

      throw new Error(`Unhandled request in test: ${method} ${path}`);
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function baseFixture(): Fixture {
  return {
    version: version(),
    reviewNotes: [reviewNote()],
    coreAnchorRevisions: [coreAnchorRevision()],
    assessments: [assessment()],
    decisions: { "assessment-1": [] },
    agentRuns: {
      "run-1": agentRun(),
      "run-vfx-1": agentRun({
        id: "run-vfx-1",
        agent_type: "vfx_supervisor_agent",
        capability: "creative_review",
      }),
      "run-artist-1": agentRun({
        id: "run-artist-1",
        agent_type: "artist_agent",
        capability: "iteration_guidance",
      }),
    },
    contextSnapshots: { "snapshot-1": contextSnapshot() },
    vfxSupervisorReviews: [vfxSupervisorReview()],
    tasks: [task()],
    artistAgentGuidances: [artistAgentGuidance()],
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("VersionPage", () => {
  it("renders the Version description and its Review Notes", async () => {
    installFetchMock(baseFixture());
    render(<VersionPage shotId="shot-1" versionId="version-1" />);

    expect(
      await screen.findByRole("heading", { name: /SH010_render_v001/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("First render pass, added camera shake."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("The shake feels too aggressive."),
    ).toBeInTheDocument();
    const reviewNotesSection = screen.getByLabelText("Review notes");
    expect(
      within(reviewNotesSection).getByText(/cg_supervisor/),
    ).toBeInTheDocument();
  });

  it("shows the confirmed Core Anchor summary linking back to the shot", async () => {
    installFetchMock(baseFixture());
    render(<VersionPage shotId="shot-1" versionId="version-1" />);

    expect(
      await screen.findByText(/Revision #1 — A restrained, cinematic chase\./),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "View Shot Anchor page" }),
    ).toHaveAttribute("href", "/shots/shot-1");
  });

  it("renders every Assessment field", async () => {
    installFetchMock(baseFixture());
    render(<VersionPage shotId="shot-1" versionId="version-1" />);

    const card = await screen.findByLabelText("Assessment assessment-1");
    expect(within(card).getByText("[Minor drift]")).toBeInTheDocument();
    expect(
      within(card).getByText(/contradicts the confirmed restrained tone/),
    ).toBeInTheDocument();
    expect(
      within(card).getByText(/Review note flags the shake/),
    ).toBeInTheDocument();
    expect(
      within(card).getByText(/likely departs from the confirmed/),
    ).toBeInTheDocument();
    expect(
      within(card).getByText(/Review note: The shake feels too aggressive\./),
    ).toBeInTheDocument();
    expect(within(card).getByText("0.8")).toBeInTheDocument();
    expect(
      within(card).getByText(/Reduce camera shake to match/),
    ).toBeInTheDocument();
    expect(within(card).getByText("Yes")).toBeInTheDocument();
    expect(within(card).getByText("#1")).toBeInTheDocument();
  });

  it("shows requires_human_gate", async () => {
    installFetchMock(baseFixture());
    render(<VersionPage shotId="shot-1" versionId="version-1" />);

    const card = await screen.findByLabelText("Assessment assessment-1");
    expect(within(card).getByText("Requires human gate")).toBeInTheDocument();
    expect(within(card).getByText("Yes")).toBeInTheDocument();
  });

  it("renders DeepSeek provider provenance", async () => {
    const fixture = baseFixture();
    fixture.agentRuns["run-1"] = agentRun({ provider: "deepseek" });
    installFetchMock(fixture);
    render(<VersionPage shotId="shot-1" versionId="version-1" />);

    const card = await screen.findByLabelText("Assessment assessment-1");
    expect(
      await within(card).findByText(/provider: deepseek/),
    ).toBeInTheDocument();
    expect(
      within(card).getByText(/agent type: core_agent/),
    ).toBeInTheDocument();
  });

  it("shows Accept/Reject controls for an undecided Assessment when acting as VFX Supervisor", async () => {
    installFetchMock(baseFixture());
    render(<VersionPage shotId="shot-1" versionId="version-1" />);

    const gate = await screen.findByLabelText(
      "Alignment Assessment Human Review Gate assessment-1",
    );
    expect(within(gate).getByRole("button", { name: "Accept" })).toBeEnabled();
    expect(within(gate).getByRole("button", { name: "Reject" })).toBeEnabled();
  });

  it("disables Accept/Reject unless acting as VFX Supervisor", async () => {
    const user = userEvent.setup();
    installFetchMock(baseFixture());
    render(<VersionPage shotId="shot-1" versionId="version-1" />);

    await screen.findByLabelText(
      "Alignment Assessment Human Review Gate assessment-1",
    );
    await user.selectOptions(screen.getByLabelText("Role"), "cg_supervisor");

    const gate = screen.getByLabelText(
      "Alignment Assessment Human Review Gate assessment-1",
    );
    expect(within(gate).getByRole("button", { name: "Accept" })).toBeDisabled();
    expect(within(gate).getByRole("button", { name: "Reject" })).toBeDisabled();
  });

  it("accepts an assessment with the correct headers and body", async () => {
    const user = userEvent.setup();
    const fixture = baseFixture();
    const fetchMock = installFetchMock(fixture);
    render(<VersionPage shotId="shot-1" versionId="version-1" />);

    const gate = await screen.findByLabelText(
      "Alignment Assessment Human Review Gate assessment-1",
    );
    await user.type(
      within(gate).getByLabelText("Decision rationale (optional)"),
      "matches the confirmed tone",
    );
    await user.click(within(gate).getByRole("button", { name: "Accept" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url]) =>
        String(url).includes("/assessments/assessment-1/accept"),
      );
      expect(call).toBeDefined();
      const [, init] = call!;
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({
        "X-Actor-Role": "vfx_supervisor",
        "X-Actor-Id": "vfx-1",
      });
      expect(JSON.parse(String(init?.body))).toEqual({
        rationale: "matches the confirmed tone",
      });
    });
  });

  it("rejects an assessment with the correct headers and body", async () => {
    const user = userEvent.setup();
    const fixture = baseFixture();
    const fetchMock = installFetchMock(fixture);
    render(<VersionPage shotId="shot-1" versionId="version-1" />);

    const gate = await screen.findByLabelText(
      "Alignment Assessment Human Review Gate assessment-1",
    );
    await user.click(within(gate).getByRole("button", { name: "Reject" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url]) =>
        String(url).includes("/assessments/assessment-1/reject"),
      );
      expect(call).toBeDefined();
      const [, init] = call!;
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({
        "X-Actor-Role": "vfx_supervisor",
        "X-Actor-Id": "vfx-1",
      });
      expect(JSON.parse(String(init?.body))).toEqual({ rationale: null });
    });
  });

  it("does not show a second decision action once an Assessment has been decided", async () => {
    const fixture = baseFixture();
    fixture.decisions["assessment-1"] = [decision()];
    installFetchMock(fixture);
    render(<VersionPage shotId="shot-1" versionId="version-1" />);

    await screen.findByLabelText("Assessment assessment-1");
    expect(
      screen.queryByLabelText(
        "Alignment Assessment Human Review Gate assessment-1",
      ),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Accepted")).toBeInTheDocument();
  });

  it("shows supersession: the newer Decision's supersedes_decision_id and the older Decision labelled as superseded", async () => {
    const fixture = baseFixture();
    fixture.assessments = [
      assessment({ id: "assessment-1" }),
      assessment({ id: "assessment-2", alignment_state: "significant_drift" }),
    ];
    fixture.decisions = {
      "assessment-1": [
        decision({
          id: "decision-1",
          decision_type: "accept_alignment_assessment",
          entity_id: "assessment-1",
        }),
      ],
      "assessment-2": [
        decision({
          id: "decision-2",
          decision_type: "reject_alignment_assessment",
          entity_id: "assessment-2",
          supersedes_decision_id: "decision-1",
        }),
      ],
    };
    installFetchMock(fixture);
    render(<VersionPage shotId="shot-1" versionId="version-1" />);

    const cardA = await screen.findByLabelText("Assessment assessment-1");
    expect(
      within(cardA).getByText("Superseded by a later decision"),
    ).toBeInTheDocument();

    const cardB = screen.getByLabelText("Assessment assessment-2");
    expect(
      within(cardB).getByText(/Supersedes decision decision/),
    ).toBeInTheDocument();
  });

  it("generates a new assessment and refreshes the list", async () => {
    const user = userEvent.setup();
    const fixture = baseFixture();
    fixture.assessments = [];
    installFetchMock(fixture);
    render(<VersionPage shotId="shot-1" versionId="version-1" />);

    expect(
      await screen.findByText("No alignment assessments generated yet."),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Generate Alignment Assessment" }),
    );

    expect(
      await screen.findByLabelText("Assessment assessment-generated"),
    ).toBeInTheDocument();
  });

  it("shows a loading state while generating", async () => {
    const user = userEvent.setup();
    const fixture = baseFixture();
    fixture.assessments = [];
    let resolveGenerate: ((response: Response) => void) | undefined;
    installFetchMock(fixture, {
      onRequest: (method, path) => {
        if (
          method === "POST" &&
          path === "/versions/version-1/assessments/generate"
        ) {
          return new Promise<Response>((resolve) => {
            resolveGenerate = resolve;
          });
        }
        return null;
      },
    });
    render(<VersionPage shotId="shot-1" versionId="version-1" />);

    await screen.findByText("No alignment assessments generated yet.");
    const button = screen.getByRole("button", {
      name: "Generate Alignment Assessment",
    });
    void user.click(button);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Generating…" }),
      ).toBeDisabled();
    });
    const generated = assessment({ id: "assessment-generated" });
    fixture.assessments.push(generated);
    resolveGenerate?.(jsonResponse(201, generated));
    await screen.findByLabelText("Assessment assessment-generated");
  });

  it("shows a loading state while the page itself loads", () => {
    installFetchMock(baseFixture(), {
      onRequest: () => new Promise<Response>(() => {}),
    });
    render(<VersionPage shotId="shot-1" versionId="version-1" />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading version…");
  });

  it("shows a backend error with retry when the version fetch fails outright", async () => {
    installFetchMock(baseFixture(), {
      onRequest: (method, path) =>
        method === "GET" && path === "/versions/version-1"
          ? jsonResponse(500, { detail: "boom" })
          : null,
    });
    render(<VersionPage shotId="shot-1" versionId="version-1" />);

    expect(await screen.findByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("shows a not-found state when the version does not exist", async () => {
    const fixture = baseFixture();
    fixture.version = null;
    installFetchMock(fixture);
    render(<VersionPage shotId="shot-1" versionId="version-1" />);

    expect(await screen.findByText("Version not found")).toBeInTheDocument();
  });

  describe("VFX Supervisor Agent review (Step 3)", () => {
    it("shows an empty state when no reviews have been generated yet", async () => {
      const fixture = baseFixture();
      fixture.vfxSupervisorReviews = [];
      installFetchMock(fixture);
      render(<VersionPage shotId="shot-1" versionId="version-1" />);

      expect(
        await screen.findByText(
          "No VFX Supervisor Agent reviews generated yet.",
        ),
      ).toBeInTheDocument();
    });

    it("shows the advisory disclaimer copy", async () => {
      installFetchMock(baseFixture());
      render(<VersionPage shotId="shot-1" versionId="version-1" />);

      expect(
        await screen.findByText(/AI creative review — VFX Supervisor Agent/),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/has not visually inspected any media/),
      ).toBeInTheDocument();
    });

    it("shows a Generate button only for the VFX Supervisor role", async () => {
      const user = userEvent.setup();
      installFetchMock(baseFixture());
      render(<VersionPage shotId="shot-1" versionId="version-1" />);

      await screen.findByLabelText("VFX Supervisor Agent review");
      expect(
        screen.getByRole("button", { name: "Generate VFX Supervisor review" }),
      ).toBeInTheDocument();

      await user.selectOptions(screen.getByLabelText("Role"), "cg_supervisor");
      expect(
        screen.queryByRole("button", {
          name: "Generate VFX Supervisor review",
        }),
      ).not.toBeInTheDocument();

      await user.selectOptions(screen.getByLabelText("Role"), "artist");
      expect(
        screen.queryByRole("button", {
          name: "Generate VFX Supervisor review",
        }),
      ).not.toBeInTheDocument();
    });

    it("lets CG Supervisor and Artist read existing reviews without a Generate button", async () => {
      const user = userEvent.setup();
      installFetchMock(baseFixture());
      render(<VersionPage shotId="shot-1" versionId="version-1" />);

      await screen.findByLabelText("VFX Supervisor Agent review");
      await user.selectOptions(screen.getByLabelText("Role"), "cg_supervisor");
      const section = screen.getByLabelText("VFX Supervisor Agent review");
      expect(
        within(section).getByText(
          "Review against the confirmed restrained chase direction.",
        ),
      ).toBeInTheDocument();
      expect(
        within(section).queryByRole("button", {
          name: "Generate VFX Supervisor review",
        }),
      ).not.toBeInTheDocument();
    });

    it("generates a new review and refreshes the list", async () => {
      const user = userEvent.setup();
      const fixture = baseFixture();
      fixture.vfxSupervisorReviews = [];
      installFetchMock(fixture);
      render(<VersionPage shotId="shot-1" versionId="version-1" />);

      expect(
        await screen.findByText(
          "No VFX Supervisor Agent reviews generated yet.",
        ),
      ).toBeInTheDocument();
      await user.click(
        screen.getByRole("button", { name: "Generate VFX Supervisor review" }),
      );

      expect(
        await screen.findByLabelText(
          "VFX Supervisor review vfx-review-generated",
        ),
      ).toBeInTheDocument();
    });

    it("shows a loading state while generating", async () => {
      const user = userEvent.setup();
      const fixture = baseFixture();
      fixture.vfxSupervisorReviews = [];
      let resolveGenerate: ((response: Response) => void) | undefined;
      installFetchMock(fixture, {
        onRequest: (method, path) => {
          if (
            method === "POST" &&
            path ===
              "/intent/versions/version-1/vfx-supervisor-reviews/generate"
          ) {
            return new Promise<Response>((resolve) => {
              resolveGenerate = resolve;
            });
          }
          return null;
        },
      });
      render(<VersionPage shotId="shot-1" versionId="version-1" />);

      await screen.findByText("No VFX Supervisor Agent reviews generated yet.");
      const button = screen.getByRole("button", {
        name: "Generate VFX Supervisor review",
      });
      void user.click(button);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Generating…" }),
        ).toBeDisabled();
      });
      const generated = vfxSupervisorReview({ id: "vfx-review-generated" });
      fixture.vfxSupervisorReviews.push(generated);
      resolveGenerate?.(jsonResponse(201, generated));
      await screen.findByLabelText(
        "VFX Supervisor review vfx-review-generated",
      );
    });

    it("shows an error when generation fails", async () => {
      const user = userEvent.setup();
      installFetchMock(baseFixture(), {
        onRequest: (method, path) =>
          method === "POST" &&
          path === "/intent/versions/version-1/vfx-supervisor-reviews/generate"
            ? jsonResponse(403, { detail: "Not allowed" })
            : null,
      });
      render(<VersionPage shotId="shot-1" versionId="version-1" />);

      await user.click(
        await screen.findByRole("button", {
          name: "Generate VFX Supervisor review",
        }),
      );

      expect(await screen.findByRole("alert")).toHaveTextContent("Not allowed");
    });

    it("renders every structured section of a generated review", async () => {
      installFetchMock(baseFixture());
      render(<VersionPage shotId="shot-1" versionId="version-1" />);

      const card = await screen.findByLabelText(
        "VFX Supervisor review vfx-review-1",
      );
      expect(
        within(card).getByText(
          "One constraint and one open question considered.",
        ),
      ).toBeInTheDocument();
      expect(
        within(card).getByText(
          "Review against the confirmed restrained chase direction.",
        ),
      ).toBeInTheDocument();
      expect(
        within(card).getByText(
          "Camera shake may depart from the restrained tone.",
        ),
      ).toBeInTheDocument();
      expect(
        within(card).getByText(
          "Confirm the submission preserves: No jump cuts.",
        ),
      ).toBeInTheDocument();
      expect(
        within(card).getByText(
          "Reduce the camera shake back toward the restrained direction.",
        ),
      ).toBeInTheDocument();
      expect(
        within(card).getByText(
          "The confirmed Core Anchor calls for a quiet, controlled chase.",
        ),
      ).toBeInTheDocument();
      expect(
        within(card).getByText(
          "Does the actual footage match the recorded description?",
        ),
      ).toBeInTheDocument();
      expect(
        within(card).getByText(
          "No image, video, or frame evidence is available to this Agent.",
        ),
      ).toBeInTheDocument();
    });

    it("renders priority markers on review items and feedback notes", async () => {
      installFetchMock(baseFixture());
      render(<VersionPage shotId="shot-1" versionId="version-1" />);

      const card = await screen.findByLabelText(
        "VFX Supervisor review vfx-review-1",
      );
      expect(within(card).getAllByText("[high]").length).toBeGreaterThan(0);
      expect(within(card).getByText("[medium]")).toBeInTheDocument();
    });

    it("renders evidence references for review items", async () => {
      installFetchMock(baseFixture());
      render(<VersionPage shotId="shot-1" versionId="version-1" />);

      const card = await screen.findByLabelText(
        "VFX Supervisor review vfx-review-1",
      );
      expect(
        within(card).getAllByText(
          /Confirmed Core Anchor \(core_anchor_revision/,
        ).length,
      ).toBeGreaterThan(0);
      expect(
        within(card).getByText(/Review note \(review_note/),
      ).toBeInTheDocument();
    });

    it("shows an explicit empty state for an empty strengths list", async () => {
      installFetchMock(baseFixture());
      render(<VersionPage shotId="shot-1" versionId="version-1" />);

      const card = await screen.findByLabelText(
        "VFX Supervisor review vfx-review-1",
      );
      const strengthsHeading = within(card).getByRole("heading", {
        name: "Strengths",
      });
      expect(strengthsHeading.nextElementSibling).toHaveTextContent("None.");
    });

    it("shows Agent provenance with vfx_supervisor_agent run metadata", async () => {
      installFetchMock(baseFixture());
      render(<VersionPage shotId="shot-1" versionId="version-1" />);

      const card = await screen.findByLabelText(
        "VFX Supervisor review vfx-review-1",
      );
      expect(
        await within(card).findByText(/agent type: vfx_supervisor_agent/),
      ).toBeInTheDocument();
      expect(
        within(card).getByText(/provider: deterministic/),
      ).toBeInTheDocument();
      expect(
        within(card).getByText(/run status: succeeded/),
      ).toBeInTheDocument();
    });

    it("renders no edit, apply, accept, or reject controls", async () => {
      installFetchMock(baseFixture());
      render(<VersionPage shotId="shot-1" versionId="version-1" />);

      const card = await screen.findByLabelText(
        "VFX Supervisor review vfx-review-1",
      );
      for (const name of ["Edit", "Apply", "Accept", "Reject", "Approve"]) {
        expect(
          within(card).queryByRole("button", { name }),
        ).not.toBeInTheDocument();
      }
    });
  });

  describe("Artist Agent guidance (Step 5)", () => {
    it("shows an empty state when no guidance has been generated yet", async () => {
      const fixture = baseFixture();
      fixture.artistAgentGuidances = [];
      installFetchMock(fixture);
      render(<VersionPage shotId="shot-1" versionId="version-1" />);

      expect(
        await screen.findByText("No Artist Agent guidance generated yet."),
      ).toBeInTheDocument();
    });

    it("shows the advisory disclaimer copy", async () => {
      installFetchMock(baseFixture());
      render(<VersionPage shotId="shot-1" versionId="version-1" />);

      expect(
        await screen.findByText(/AI iteration guidance — Artist Agent/),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/does not visually inspect footage, renders/),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Human supervisors retain authority/),
      ).toBeInTheDocument();
    });

    it("shows a Generate control only for the Artist role", async () => {
      const user = userEvent.setup();
      installFetchMock(baseFixture());
      render(<VersionPage shotId="shot-1" versionId="version-1" />);

      await screen.findByLabelText("AI iteration guidance — Artist Agent");
      await user.selectOptions(screen.getByLabelText("Role"), "artist");
      expect(
        await screen.findByRole("button", { name: "Generate Artist guidance" }),
      ).toBeInTheDocument();

      await user.selectOptions(screen.getByLabelText("Role"), "vfx_supervisor");
      expect(
        screen.queryByRole("button", { name: "Generate Artist guidance" }),
      ).not.toBeInTheDocument();

      await user.selectOptions(screen.getByLabelText("Role"), "cg_supervisor");
      expect(
        screen.queryByRole("button", { name: "Generate Artist guidance" }),
      ).not.toBeInTheDocument();
    });

    it("lets VFX and CG Supervisor read existing guidance without a Generate control", async () => {
      installFetchMock(baseFixture());
      render(<VersionPage shotId="shot-1" versionId="version-1" />);

      const section = await screen.findByLabelText(
        "AI iteration guidance — Artist Agent",
      );
      expect(
        within(section).getByText(
          "One non-negotiable and one review note considered.",
        ),
      ).toBeInTheDocument();
      expect(
        within(section).queryByRole("button", {
          name: "Generate Artist guidance",
        }),
      ).not.toBeInTheDocument();
    });

    it("renders every output section", async () => {
      installFetchMock(baseFixture());
      render(<VersionPage shotId="shot-1" versionId="version-1" />);

      const card = await screen.findByLabelText(
        "Artist Agent guidance artist-guidance-1",
      );
      expect(
        within(card).getByText(
          "This Shot's confirmed direction is a quiet, controlled chase.",
        ),
      ).toBeInTheDocument();
      expect(
        within(card).getByText(
          "Lighting Pass delivers against the confirmed Execution Anchor.",
        ),
      ).toBeInTheDocument();
      expect(
        within(card).getByText(
          "This Version is one iteration toward the Task's goal.",
        ),
      ).toBeInTheDocument();
      expect(
        within(card).getByText("Must preserve: No jump cuts."),
      ).toBeInTheDocument();
      expect(
        within(card).getByText(
          "Open to variation: Camera speed may vary slightly.",
        ),
      ).toBeInTheDocument();
      expect(
        within(card).getByText(
          "Confirm the next iteration preserves: No jump cuts.",
        ),
      ).toBeInTheDocument();
      expect(
        within(card).getByText(
          "Coordinate with the Human CG Supervisor on execution guidance.",
        ),
      ).toBeInTheDocument();
      expect(
        within(card).getByText(
          "Does the actual submitted work match the recorded Execution Anchor content?",
        ),
      ).toBeInTheDocument();
      expect(
        within(card).getByText(/has not directly inspected footage/),
      ).toBeInTheDocument();
    });

    it("renders a feedback translation's practical action, underlying intent, and self-check", async () => {
      installFetchMock(baseFixture());
      render(<VersionPage shotId="shot-1" versionId="version-1" />);

      const card = await screen.findByLabelText(
        "Artist Agent guidance artist-guidance-1",
      );
      expect(
        within(card).getByText(/Review note: The shake feels too aggressive\./),
      ).toBeInTheDocument();
      expect(
        within(card).getByText(
          /Reduce the camera shake in the next iteration\./,
        ),
      ).toBeInTheDocument();
      expect(
        within(card).getByText(
          /This feedback was recorded by a human reviewer for this Version\./,
        ),
      ).toBeInTheDocument();
      expect(
        within(card).getByText(
          /Before submitting, confirm the shake has been reduced\./,
        ),
      ).toBeInTheDocument();
    });

    it("renders evidence references and Agent provenance", async () => {
      installFetchMock(baseFixture());
      render(<VersionPage shotId="shot-1" versionId="version-1" />);

      const card = await screen.findByLabelText(
        "Artist Agent guidance artist-guidance-1",
      );
      expect(
        within(card).getByText(/Confirmed Core Anchor/),
      ).toBeInTheDocument();
      await waitFor(() => {
        expect(within(card).getByText(/agent type:/)).toBeInTheDocument();
      });
      expect(within(card).getByText(/provider:/)).toBeInTheDocument();
      expect(
        within(card).getByText(/run status: succeeded/),
      ).toBeInTheDocument();
    });

    it("generates new guidance for the selected Task and refreshes the list", async () => {
      const user = userEvent.setup();
      const fixture = baseFixture();
      fixture.artistAgentGuidances = [];
      installFetchMock(fixture);
      render(<VersionPage shotId="shot-1" versionId="version-1" />);

      await screen.findByLabelText("AI iteration guidance — Artist Agent");
      await user.selectOptions(screen.getByLabelText("Role"), "artist");
      expect(
        await screen.findByText("No Artist Agent guidance generated yet."),
      ).toBeInTheDocument();
      await user.click(
        screen.getByRole("button", { name: "Generate Artist guidance" }),
      );

      expect(
        await screen.findByLabelText(
          "Artist Agent guidance artist-guidance-generated",
        ),
      ).toBeInTheDocument();
    });

    it("shows a loading state while generating", async () => {
      const user = userEvent.setup();
      const fixture = baseFixture();
      fixture.artistAgentGuidances = [];
      let resolveGenerate: ((response: Response) => void) | undefined;
      installFetchMock(fixture, {
        onRequest: (method, path) => {
          if (
            method === "POST" &&
            path === "/intent/versions/version-1/artist-guidances/generate"
          ) {
            return new Promise<Response>((resolve) => {
              resolveGenerate = resolve;
            });
          }
          return null;
        },
      });
      render(<VersionPage shotId="shot-1" versionId="version-1" />);

      await screen.findByLabelText("AI iteration guidance — Artist Agent");
      await user.selectOptions(screen.getByLabelText("Role"), "artist");
      await screen.findByText("No Artist Agent guidance generated yet.");
      const button = screen.getByRole("button", {
        name: "Generate Artist guidance",
      });
      void user.click(button);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Generating…" }),
        ).toBeDisabled();
      });
      const generated = artistAgentGuidance({
        id: "artist-guidance-generated",
      });
      fixture.artistAgentGuidances.push(generated);
      resolveGenerate?.(jsonResponse(201, generated));
      await screen.findByLabelText(
        "Artist Agent guidance artist-guidance-generated",
      );
    });

    it("renders no edit, apply, accept, reject, approve, or ranking controls", async () => {
      installFetchMock(baseFixture());
      render(<VersionPage shotId="shot-1" versionId="version-1" />);

      const card = await screen.findByLabelText(
        "Artist Agent guidance artist-guidance-1",
      );
      for (const name of [
        "Edit",
        "Apply",
        "Accept",
        "Reject",
        "Approve",
        "Rank",
      ]) {
        expect(
          within(card).queryByRole("button", { name }),
        ).not.toBeInTheDocument();
      }
    });
  });
});
