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
  ContextSnapshotRead,
  CoreAnchorRevisionRead,
  DecisionRead,
  ReviewNoteRead,
  VersionRead,
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

interface Fixture {
  version: VersionRead | null;
  reviewNotes: ReviewNoteRead[];
  coreAnchorRevisions: CoreAnchorRevisionRead[];
  assessments: AlignmentAssessmentRead[];
  decisions: Record<string, DecisionRead[]>;
  agentRuns: Record<string, AgentRunRead>;
  contextSnapshots: Record<string, ContextSnapshotRead>;
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
    agentRuns: { "run-1": agentRun() },
    contextSnapshots: { "snapshot-1": contextSnapshot() },
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
    expect(screen.getByText(/cg_supervisor/)).toBeInTheDocument();
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
});
