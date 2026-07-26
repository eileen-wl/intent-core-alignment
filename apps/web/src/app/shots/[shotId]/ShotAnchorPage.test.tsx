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
  ContextSnapshotRead,
  CoreAnchorRead,
  CoreAnchorRevisionRead,
  DecisionRead,
  ExecutionAnchorRead,
  ExecutionAnchorRevisionRead,
  IntentBriefRead,
  ShotRead,
  TaskRead,
  VersionRead,
} from "@intent-core/contracts";

import { ShotAnchorPage } from "./ShotAnchorPage";

const NOW = "2026-01-01T00:00:00Z";

function shot(overrides: Partial<ShotRead> = {}): ShotRead {
  return {
    id: "shot-1",
    project_id: "proj-1",
    name: "SH010",
    source: "manual",
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function brief(overrides: Partial<IntentBriefRead> = {}): IntentBriefRead {
  return {
    id: "brief-1",
    shot_id: "shot-1",
    raw_text: "Keep the dread quiet and let it build.",
    source: "manual",
    created_by_actor_kind: "human",
    created_by_actor_id: "vfx-1",
    created_by_human_role: "vfx_supervisor",
    source_external_id: null,
    created_at: NOW,
    ...overrides,
  };
}

function coreAnchor(overrides: Partial<CoreAnchorRead> = {}): CoreAnchorRead {
  return {
    id: "anchor-1",
    shot_id: "shot-1",
    active_revision_id: "rev-confirmed",
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function revision(
  overrides: Partial<CoreAnchorRevisionRead>,
): CoreAnchorRevisionRead {
  return {
    id: "rev-x",
    core_anchor_id: "anchor-1",
    revision_number: 1,
    status: "draft",
    shot_objective: null,
    emotional_tone: null,
    visual_focus: null,
    rhythm_intensity: null,
    character_relationship: null,
    narrative_priority: null,
    core_summary: null,
    created_by_actor_kind: "human",
    created_by_actor_id: "vfx-1",
    created_by_human_role: "vfx_supervisor",
    created_by_agent_type: null,
    created_by_agent_run_id: null,
    context_snapshot_id: null,
    confirmed_by_human_role: null,
    confirmed_by_actor_id: null,
    confirmed_at: null,
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

function task(overrides: Partial<TaskRead> = {}): TaskRead {
  return {
    id: "task-1",
    shot_id: "shot-1",
    name: "Anim block",
    department: "animation",
    source: "manual",
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function executionAnchor(
  overrides: Partial<ExecutionAnchorRead> = {},
): ExecutionAnchorRead {
  return {
    id: "ea-1",
    task_id: "task-1",
    active_revision_id: null,
    is_stale: false,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function executionAnchorRevision(
  overrides: Partial<ExecutionAnchorRevisionRead>,
): ExecutionAnchorRevisionRead {
  return {
    id: "ea-rev-1",
    execution_anchor_id: "ea-1",
    core_anchor_revision_id: "rev-confirmed",
    revision_number: 1,
    status: "confirmed",
    technical_boundaries: null,
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
    confirmed_at: NOW,
    supersedes_revision_id: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function decision(overrides: Partial<DecisionRead> = {}): DecisionRead {
  return {
    id: "decision-1",
    decision_type: "confirm_core_anchor",
    owning_human_role: "vfx_supervisor",
    actor_kind: "human",
    actor_id: "vfx-1",
    actor_human_role: "vfx_supervisor",
    rationale: "matches the brief",
    entity_type: "core_anchor_revision",
    entity_id: "rev-confirmed",
    write_back_requested: false,
    supersedes_decision_id: null,
    created_at: NOW,
    ...overrides,
  };
}

function agentRun(overrides: Partial<AgentRunRead> = {}): AgentRunRead {
  return {
    id: "run-123",
    shot_id: "shot-1",
    context_snapshot_id: "snapshot-1",
    agent_type: "core_agent",
    capability: "core_anchor_drafting",
    provider: "deterministic",
    status: "succeeded",
    result_revision_id: "rev-draft",
    error: null,
    started_at: NOW,
    completed_at: NOW,
    ...overrides,
  };
}

function version(overrides: Partial<VersionRead> = {}): VersionRead {
  return {
    id: "version-1",
    shot_id: "shot-1",
    name: "SH010_render_v001",
    version_number: 1,
    description: "First render pass.",
    source: "manual",
    created_by_actor_kind: "human",
    created_by_actor_id: "vfx-1",
    created_by_human_role: "vfx_supervisor",
    created_at: NOW,
    ...overrides,
  };
}

function contextSnapshot(
  overrides: Partial<ContextSnapshotRead> = {},
): ContextSnapshotRead {
  return {
    id: "snapshot-1",
    shot_id: "shot-1",
    payload: { shot: { id: "shot-1", name: "SH010", source: "manual" } },
    created_at: NOW,
    ...overrides,
  };
}

interface Fixture {
  shot: ShotRead | null;
  briefs: IntentBriefRead[];
  coreAnchor: CoreAnchorRead | null;
  revisions: CoreAnchorRevisionRead[];
  decisions: Record<string, DecisionRead[]>;
  tasks: TaskRead[];
  executionAnchors: Record<string, ExecutionAnchorRead | null>;
  executionAnchorRevisions: Record<string, ExecutionAnchorRevisionRead>;
  agentRuns: Record<string, AgentRunRead>;
  contextSnapshots: Record<string, ContextSnapshotRead>;
  versions: VersionRead[];
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: async () => body,
  } as Response;
}

/** Installs a stateful `fetch` mock backed by `fixture`, mutating it the
 * same way the real backend would on PATCH/confirm/reject so a page
 * `reload()` sees post-mutation state -- mirrors the
 * httpx.MockTransport-style routers already used on the Python side. */
function installFetchMock(
  fixture: Fixture,
  overrides: {
    onRequest?: (
      method: string,
      path: string,
    ) => Response | Promise<Response> | null;
  } = {},
) {
  const fetchMock = vi.fn(
    async (input: string | URL, init?: RequestInit): Promise<Response> => {
      const url = new URL(String(input));
      const path = url.pathname;
      const method = init?.method ?? "GET";

      const overridden = await overrides.onRequest?.(method, path);
      if (overridden) return overridden;

      if (method === "GET" && path === "/shots/shot-1") {
        return fixture.shot
          ? jsonResponse(200, fixture.shot)
          : jsonResponse(404, { detail: "Shot not found" });
      }
      if (method === "GET" && path === "/intent/shots/shot-1/briefs") {
        return jsonResponse(200, fixture.briefs);
      }
      if (method === "GET" && path === "/intent/shots/shot-1/core-anchor") {
        return fixture.coreAnchor
          ? jsonResponse(200, fixture.coreAnchor)
          : jsonResponse(404, { detail: "Core anchor not found for shot" });
      }
      if (
        method === "GET" &&
        path === "/intent/shots/shot-1/core-anchor/revisions"
      ) {
        return jsonResponse(200, fixture.revisions);
      }
      if (method === "GET" && path === "/tasks") {
        return jsonResponse(200, fixture.tasks);
      }
      if (method === "GET" && path === "/shots/shot-1/versions") {
        return jsonResponse(200, fixture.versions);
      }
      const executionAnchorMatch =
        /^\/intent\/tasks\/([^/]+)\/execution-anchor$/.exec(path);
      if (method === "GET" && executionAnchorMatch) {
        const anchor =
          fixture.executionAnchors[executionAnchorMatch[1]] ?? null;
        return anchor
          ? jsonResponse(200, anchor)
          : jsonResponse(404, { detail: "Execution anchor not found" });
      }
      const executionRevisionMatch =
        /^\/intent\/execution-anchor-revisions\/([^/]+)$/.exec(path);
      if (method === "GET" && executionRevisionMatch) {
        const rev = fixture.executionAnchorRevisions[executionRevisionMatch[1]];
        return rev
          ? jsonResponse(200, rev)
          : jsonResponse(404, {
              detail: "Execution anchor revision not found",
            });
      }
      const decisionsMatch =
        /^\/intent\/core-anchor-revisions\/([^/]+)\/decisions$/.exec(path);
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
      const patchRevisionMatch =
        /^\/intent\/core-anchor-revisions\/([^/]+)$/.exec(path);
      if (method === "PATCH" && patchRevisionMatch) {
        const id = patchRevisionMatch[1];
        const idx = fixture.revisions.findIndex((r) => r.id === id);
        if (idx === -1)
          return jsonResponse(404, {
            detail: "Core anchor revision not found",
          });
        const changes = JSON.parse(
          String(init?.body),
        ) as Partial<CoreAnchorRevisionRead>;
        if (fixture.revisions[idx].status !== "draft") {
          return jsonResponse(409, {
            detail: "Revision is not in draft status",
          });
        }
        fixture.revisions[idx] = { ...fixture.revisions[idx], ...changes };
        return jsonResponse(200, fixture.revisions[idx]);
      }
      const confirmMatch =
        /^\/intent\/core-anchor-revisions\/([^/]+)\/confirm$/.exec(path);
      if (method === "POST" && confirmMatch) {
        const id = confirmMatch[1];
        const idx = fixture.revisions.findIndex((r) => r.id === id);
        if (idx === -1)
          return jsonResponse(404, {
            detail: "Core anchor revision not found",
          });
        if (fixture.revisions[idx].status !== "draft") {
          return jsonResponse(409, {
            detail: "Revision is not in draft status",
          });
        }
        fixture.revisions[idx] = {
          ...fixture.revisions[idx],
          status: "confirmed",
          confirmed_by_human_role: "vfx_supervisor",
          confirmed_by_actor_id: "vfx-1",
          confirmed_at: NOW,
        };
        return jsonResponse(200, fixture.revisions[idx]);
      }
      const rejectMatch =
        /^\/intent\/core-anchor-revisions\/([^/]+)\/reject$/.exec(path);
      if (method === "POST" && rejectMatch) {
        const id = rejectMatch[1];
        const idx = fixture.revisions.findIndex((r) => r.id === id);
        if (idx === -1)
          return jsonResponse(404, {
            detail: "Core anchor revision not found",
          });
        if (fixture.revisions[idx].status !== "draft") {
          return jsonResponse(409, {
            detail: "Revision is not in draft status",
          });
        }
        fixture.revisions[idx] = {
          ...fixture.revisions[idx],
          status: "rejected",
        };
        return jsonResponse(200, fixture.revisions[idx]);
      }
      if (
        method === "POST" &&
        path === "/intent/shots/shot-1/core-anchor/generate"
      ) {
        if (fixture.revisions.some((r) => r.status === "draft")) {
          return jsonResponse(409, {
            detail:
              "An editable Core Anchor draft already exists for this shot",
          });
        }
        const generated = revision({
          id: "rev-generated",
          revision_number: fixture.revisions.length + 1,
          status: "draft",
          shot_objective: "[Core Agent draft] generated objective",
          created_by_actor_kind: "agent",
          created_by_actor_id: "core_agent",
          created_by_human_role: null,
          created_by_agent_type: "core_agent",
          created_by_agent_run_id: "run-1",
        });
        fixture.revisions.push(generated);
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
    shot: shot(),
    briefs: [brief()],
    coreAnchor: coreAnchor(),
    revisions: [
      revision({
        id: "rev-confirmed",
        revision_number: 1,
        status: "confirmed",
        shot_objective: "Keep dread quiet",
        confirmed_by_human_role: "vfx_supervisor",
        confirmed_by_actor_id: "vfx-1",
        confirmed_at: NOW,
      }),
      revision({
        id: "rev-draft",
        revision_number: 2,
        status: "draft",
        shot_objective: "Slightly louder now",
      }),
    ],
    decisions: {
      "rev-confirmed": [decision({ entity_id: "rev-confirmed" })],
    },
    tasks: [task()],
    executionAnchors: {
      "task-1": executionAnchor({
        active_revision_id: "ea-rev-1",
        is_stale: true,
      }),
    },
    executionAnchorRevisions: {
      "ea-rev-1": executionAnchorRevision({
        core_anchor_revision_id: "rev-confirmed",
      }),
    },
    agentRuns: {},
    contextSnapshots: {},
    versions: [],
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ShotAnchorPage", () => {
  it("renders shot info, brief, confirmed anchor, and the current draft", async () => {
    installFetchMock(baseFixture());
    render(<ShotAnchorPage shotId="shot-1" />);

    expect(
      await screen.findByRole("heading", { name: /SH010/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Keep the dread quiet and let it build\./),
    ).toBeInTheDocument();
    expect(screen.getByText("Keep dread quiet")).toBeInTheDocument();
    expect(screen.getByLabelText("Draft revision 2")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Slightly louder now")).toBeInTheDocument();
  });

  it("shows an empty state when the shot has no Core Anchor yet", async () => {
    const fixture = baseFixture();
    fixture.coreAnchor = null;
    fixture.revisions = [];
    installFetchMock(fixture);
    render(<ShotAnchorPage shotId="shot-1" />);

    expect(
      await screen.findByText("No Core Anchor yet for this shot."),
    ).toBeInTheDocument();
  });

  it("shows stale status and the referenced Core revision for an Execution Anchor", async () => {
    installFetchMock(baseFixture());
    render(<ShotAnchorPage shotId="shot-1" />);

    expect(await screen.findByText("Status: Stale")).toBeInTheDocument();
    expect(
      screen.getByText(/References Core Anchor revision #1/),
    ).toBeInTheDocument();
  });

  it("shows a not-found state when the shot does not exist", async () => {
    const fixture = baseFixture();
    fixture.shot = null;
    installFetchMock(fixture);
    render(<ShotAnchorPage shotId="shot-1" />);

    expect(await screen.findByText("Shot not found")).toBeInTheDocument();
  });

  it("lets a VFX Supervisor edit and save a draft's fields", async () => {
    const user = userEvent.setup();
    const fixture = baseFixture();
    const fetchMock = installFetchMock(fixture);
    render(<ShotAnchorPage shotId="shot-1" />);

    const objectiveField = await screen.findByLabelText("Shot objective");
    await user.clear(objectiveField);
    await user.type(objectiveField, "Even quieter than before");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(
        ([, init]) => init?.method === "PATCH",
      );
      expect(patchCall).toBeDefined();
    });
    expect(
      await screen.findByDisplayValue("Even quieter than before"),
    ).toBeInTheDocument();
  });

  it("confirms a draft", async () => {
    const user = userEvent.setup();
    const fixture = baseFixture();
    installFetchMock(fixture);
    render(<ShotAnchorPage shotId="shot-1" />);

    await screen.findByLabelText("Draft revision 2");
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(
        screen.queryByLabelText("Draft revision 2"),
      ).not.toBeInTheDocument();
    });
    expect(
      screen.getByText("No draft revision awaiting review."),
    ).toBeInTheDocument();
  });

  it("rejects a draft", async () => {
    const user = userEvent.setup();
    const fixture = baseFixture();
    installFetchMock(fixture);
    render(<ShotAnchorPage shotId="shot-1" />);

    await screen.findByLabelText("Draft revision 2");
    await user.click(screen.getByRole("button", { name: "Reject" }));

    await waitFor(() => {
      expect(
        screen.queryByLabelText("Draft revision 2"),
      ).not.toBeInTheDocument();
    });
    expect(
      screen.getByText("No draft revision awaiting review."),
    ).toBeInTheDocument();
  });

  it("surfaces a 403 from the backend even though the UI allowed the click", async () => {
    const user = userEvent.setup();
    const fixture = baseFixture();
    installFetchMock(fixture, {
      onRequest: (method, path) =>
        method === "POST" && path.endsWith("/confirm")
          ? jsonResponse(403, {
              detail:
                "action requires a human actor with role in ['vfx_supervisor']",
            })
          : null,
    });
    render(<ShotAnchorPage shotId="shot-1" />);

    const draft = await screen.findByLabelText("Draft revision 2");
    await user.click(within(draft).getByRole("button", { name: "Confirm" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Not allowed/);
  });

  it("surfaces a 409 conflict from the backend (e.g. a concurrent edit)", async () => {
    const user = userEvent.setup();
    const fixture = baseFixture();
    installFetchMock(fixture, {
      // Simulates someone else confirming/rejecting the same draft between
      // this page's load and the user's click: the backend correctly
      // refuses because the revision is no longer in "draft" status.
      onRequest: (method, path) =>
        method === "POST" && path.endsWith("/reject")
          ? jsonResponse(409, { detail: "Revision is not in draft status" })
          : null,
    });
    render(<ShotAnchorPage shotId="shot-1" />);

    const draft = await screen.findByLabelText("Draft revision 2");
    await user.click(within(draft).getByRole("button", { name: "Reject" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Out of date/);
  });

  it("generates a new Core Agent draft and shows it after reload", async () => {
    const user = userEvent.setup();
    const fixture = baseFixture();
    fixture.revisions = fixture.revisions.filter((r) => r.status !== "draft");
    installFetchMock(fixture);
    render(<ShotAnchorPage shotId="shot-1" />);

    expect(
      await screen.findByText("No draft revision awaiting review."),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Generate draft with Core Agent" }),
    );

    expect(await screen.findByLabelText(/Draft revision/)).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("[Core Agent draft] generated objective"),
    ).toBeInTheDocument();
  });

  it("shows a loading state while a draft is being generated", async () => {
    const user = userEvent.setup();
    const fixture = baseFixture();
    fixture.revisions = fixture.revisions.filter((r) => r.status !== "draft");
    let resolveGenerate: ((response: Response) => void) | undefined;
    installFetchMock(fixture, {
      onRequest: (method, path) => {
        if (
          method === "POST" &&
          path === "/intent/shots/shot-1/core-anchor/generate"
        ) {
          return new Promise<Response>((resolve) => {
            resolveGenerate = resolve;
          });
        }
        return null;
      },
    });
    render(<ShotAnchorPage shotId="shot-1" />);

    await screen.findByText("No draft revision awaiting review.");
    const button = screen.getByRole("button", {
      name: "Generate draft with Core Agent",
    });
    void user.click(button);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Generating…" }),
      ).toBeDisabled();
    });
    // Let the held request settle so the test doesn't leak a pending
    // promise/timer into the next test. The generated revision must be
    // added to the fixture too, since the reload triggered by
    // `onGenerated()` re-fetches the revisions list from the fixture, not
    // from this response.
    const generated = revision({ id: "rev-generated", status: "draft" });
    fixture.revisions.push(generated);
    resolveGenerate?.(jsonResponse(201, generated));
    await screen.findByLabelText(/Draft revision/);
  });

  it("disables the Generate Draft action when there is no Intent Brief yet", async () => {
    const fixture = baseFixture();
    fixture.revisions = fixture.revisions.filter((r) => r.status !== "draft");
    fixture.briefs = [];
    installFetchMock(fixture);
    render(<ShotAnchorPage shotId="shot-1" />);

    const button = await screen.findByRole("button", {
      name: "Generate draft with Core Agent",
    });
    expect(button).toBeDisabled();
    expect(screen.getByText("Add an Intent Brief first.")).toBeInTheDocument();
  });

  it("surfaces a 409 when generation conflicts with an already-existing draft", async () => {
    const user = userEvent.setup();
    const fixture = baseFixture();
    fixture.revisions = fixture.revisions.filter((r) => r.status !== "draft");
    installFetchMock(fixture, {
      // Simulates someone else creating a draft between this page's load
      // and the click.
      onRequest: (method, path) =>
        method === "POST" &&
        path === "/intent/shots/shot-1/core-anchor/generate"
          ? jsonResponse(409, {
              detail:
                "An editable Core Anchor draft already exists for this shot",
            })
          : null,
    });
    render(<ShotAnchorPage shotId="shot-1" />);

    await user.click(
      await screen.findByRole("button", {
        name: "Generate draft with Core Agent",
      }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(/Out of date/);
  });

  it("surfaces a 502 when the Core Agent provider fails", async () => {
    const user = userEvent.setup();
    const fixture = baseFixture();
    fixture.revisions = fixture.revisions.filter((r) => r.status !== "draft");
    installFetchMock(fixture, {
      onRequest: (method, path) =>
        method === "POST" &&
        path === "/intent/shots/shot-1/core-anchor/generate"
          ? jsonResponse(502, {
              detail: "Core Agent draft generation failed: timeout",
            })
          : null,
    });
    render(<ShotAnchorPage shotId="shot-1" />);

    await user.click(
      await screen.findByRole("button", {
        name: "Generate draft with Core Agent",
      }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Core Agent generation failed/,
    );
  });

  it("labels the draft as a Human Review Gate and shows agent provenance", async () => {
    const fixture = baseFixture();
    fixture.revisions[1] = revision({
      id: "rev-draft",
      revision_number: 2,
      status: "draft",
      shot_objective: "Generated objective",
      created_by_actor_kind: "agent",
      created_by_actor_id: "core_agent",
      created_by_human_role: null,
      created_by_agent_type: "core_agent",
      created_by_agent_run_id: "run-123",
    });
    installFetchMock(fixture);
    render(<ShotAnchorPage shotId="shot-1" />);

    const gate = await screen.findByLabelText("Draft revision 2");
    expect(
      within(gate).getByRole("heading", {
        name: "Core Anchor Human Review Gate",
      }),
    ).toBeInTheDocument();
    expect(
      within(gate).getByText(/agent type: core_agent/),
    ).toBeInTheDocument();
    expect(within(gate).getByText(/agent run id: run-123/)).toBeInTheDocument();
    expect(within(gate).getByText("Required reviewer")).toBeInTheDocument();
    expect(within(gate).getByText("VFX Supervisor")).toBeInTheDocument();
    expect(
      within(gate).getByText(/vfx_supervisor \(vfx-1\)/),
    ).toBeInTheDocument();
  });

  it("enriches agent provenance with the AgentRun's provider/status and the ContextSnapshot's time", async () => {
    const fixture = baseFixture();
    fixture.revisions[1] = revision({
      id: "rev-draft",
      revision_number: 2,
      status: "draft",
      shot_objective: "Generated objective",
      created_by_actor_kind: "agent",
      created_by_actor_id: "core_agent",
      created_by_human_role: null,
      created_by_agent_type: "core_agent",
      created_by_agent_run_id: "run-123",
      context_snapshot_id: "snapshot-1",
    });
    fixture.agentRuns["run-123"] = agentRun({
      id: "run-123",
      status: "succeeded",
      provider: "deterministic",
    });
    fixture.contextSnapshots["snapshot-1"] = contextSnapshot({
      id: "snapshot-1",
      created_at: NOW,
    });
    installFetchMock(fixture);
    render(<ShotAnchorPage shotId="shot-1" />);

    const gate = await screen.findByLabelText("Draft revision 2");
    expect(
      await within(gate).findByText(/provider: deterministic/),
    ).toBeInTheDocument();
    expect(within(gate).getByText(/run status: succeeded/)).toBeInTheDocument();
    expect(
      within(gate).getByText(/context snapshot: snapshot-1/),
    ).toBeInTheDocument();
  });

  it("warns that confirming will make Execution Anchors stale when one is currently confirmed", async () => {
    // baseFixture's Execution Anchor is already stale (used by the "stale
    // status" test below) -- override it to not-yet-stale here, since
    // that's the situation where confirming the draft would actually
    // trigger A2's stale cascade.
    const fixture = baseFixture();
    fixture.executionAnchors["task-1"] = executionAnchor({
      active_revision_id: "ea-rev-1",
      is_stale: false,
    });
    installFetchMock(fixture);
    render(<ShotAnchorPage shotId="shot-1" />);

    const gate = await screen.findByLabelText("Draft revision 2");
    expect(
      within(gate).getByText(
        /will mark all confirmed Execution Anchors under this shot as stale/,
      ),
    ).toBeInTheDocument();
  });

  it("does not show the stale warning when there is no currently confirmed revision", async () => {
    const fixture = baseFixture();
    fixture.revisions = fixture.revisions.filter(
      (r) => r.status !== "confirmed",
    );
    installFetchMock(fixture);
    render(<ShotAnchorPage shotId="shot-1" />);

    const gate = await screen.findByLabelText("Draft revision 2");
    expect(
      within(gate).queryByText(/will mark all confirmed Execution Anchors/),
    ).not.toBeInTheDocument();
  });

  it("shows a clear success state with rationale after confirming", async () => {
    const user = userEvent.setup();
    const fixture = baseFixture();
    installFetchMock(fixture);
    render(<ShotAnchorPage shotId="shot-1" />);

    const gate = await screen.findByLabelText("Draft revision 2");
    await user.type(
      within(gate).getByLabelText("Decision rationale (optional)"),
      "looks aligned with the brief",
    );
    await user.click(within(gate).getByRole("button", { name: "Confirm" }));

    const banner = await screen.findByText(/Confirmed revision #2/);
    expect(banner).toHaveTextContent("looks aligned with the brief");
  });

  it("shows a clear success state after rejecting", async () => {
    const user = userEvent.setup();
    const fixture = baseFixture();
    installFetchMock(fixture);
    render(<ShotAnchorPage shotId="shot-1" />);

    const gate = await screen.findByLabelText("Draft revision 2");
    await user.click(within(gate).getByRole("button", { name: "Reject" }));

    expect(await screen.findByText(/Rejected revision #2/)).toBeInTheDocument();
  });

  it("does not show a decision as successful before the API call resolves", async () => {
    const user = userEvent.setup();
    const fixture = baseFixture();
    let resolveConfirm: ((response: Response) => void) | undefined;
    installFetchMock(fixture, {
      onRequest: (method, path) => {
        if (method === "POST" && path.endsWith("/confirm")) {
          return new Promise<Response>((resolve) => {
            resolveConfirm = resolve;
          });
        }
        return null;
      },
    });
    render(<ShotAnchorPage shotId="shot-1" />);

    const gate = await screen.findByLabelText("Draft revision 2");
    await user.click(within(gate).getByRole("button", { name: "Confirm" }));

    // Held open: the API call has not resolved yet, so no success state
    // must appear -- the frontend must not pretend the Gate passed.
    expect(screen.queryByText(/Confirmed revision #2/)).not.toBeInTheDocument();

    const confirmed = { ...fixture.revisions[1], status: "confirmed" as const };
    fixture.revisions[1] = confirmed;
    resolveConfirm?.(jsonResponse(200, confirmed));
    expect(
      await screen.findByText(/Confirmed revision #2/),
    ).toBeInTheDocument();
  });

  it("shows the confirmed revision's recorded decision rationale", async () => {
    installFetchMock(baseFixture());
    render(<ShotAnchorPage shotId="shot-1" />);

    expect(
      await screen.findByText(/Decision rationale: matches the brief/),
    ).toBeInTheDocument();
  });

  it("shows the required reviewer role for each Task's Execution Anchor", async () => {
    installFetchMock(baseFixture());
    render(<ShotAnchorPage shotId="shot-1" />);

    expect(
      await screen.findByText("Required reviewer: CG Supervisor"),
    ).toBeInTheDocument();
  });

  it("shows an up-to-date Execution Anchor when it is not stale", async () => {
    const fixture = baseFixture();
    fixture.executionAnchors["task-1"] = executionAnchor({
      active_revision_id: "ea-rev-1",
      is_stale: false,
    });
    installFetchMock(fixture);
    render(<ShotAnchorPage shotId="shot-1" />);

    expect(await screen.findByText("Status: Up to date")).toBeInTheDocument();
  });

  it("shows an empty state when the shot has no Versions yet", async () => {
    installFetchMock(baseFixture());
    render(<ShotAnchorPage shotId="shot-1" />);

    expect(await screen.findByText("No Versions yet.")).toBeInTheDocument();
  });

  it("lists a Version with a link to its detail page", async () => {
    const fixture = baseFixture();
    fixture.versions = [version()];
    installFetchMock(fixture);
    render(<ShotAnchorPage shotId="shot-1" />);

    const link = await screen.findByRole("link", {
      name: "SH010_render_v001",
    });
    expect(link).toHaveAttribute("href", "/shots/shot-1/versions/version-1");
    const item = link.closest("li") as HTMLElement;
    expect(within(item).getByText(/v1/)).toBeInTheDocument();
    expect(within(item).getByText("(manual)")).toBeInTheDocument();
  });

  it("shows a general error state with retry when the shot fetch fails outright", async () => {
    installFetchMock(baseFixture(), {
      onRequest: (method, path) =>
        method === "GET" && path === "/shots/shot-1"
          ? jsonResponse(500, { detail: "boom" })
          : null,
    });
    render(<ShotAnchorPage shotId="shot-1" />);

    expect(await screen.findByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
