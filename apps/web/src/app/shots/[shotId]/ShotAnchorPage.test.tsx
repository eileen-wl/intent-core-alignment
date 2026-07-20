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
  CoreAnchorRead,
  CoreAnchorRevisionRead,
  ExecutionAnchorRead,
  ExecutionAnchorRevisionRead,
  IntentBriefRead,
  ShotRead,
  TaskRead,
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
    confirmed_by_human_role: null,
    confirmed_by_actor_id: null,
    confirmed_at: null,
    supersedes_revision_id: null,
    created_at: NOW,
    updated_at: NOW,
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

interface Fixture {
  shot: ShotRead | null;
  briefs: IntentBriefRead[];
  coreAnchor: CoreAnchorRead | null;
  revisions: CoreAnchorRevisionRead[];
  tasks: TaskRead[];
  executionAnchors: Record<string, ExecutionAnchorRead | null>;
  executionAnchorRevisions: Record<string, ExecutionAnchorRevisionRead>;
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
    onRequest?: (method: string, path: string) => Response | null;
  } = {},
) {
  const fetchMock = vi.fn(
    async (input: string | URL, init?: RequestInit): Promise<Response> => {
      const url = new URL(String(input));
      const path = url.pathname;
      const method = init?.method ?? "GET";

      const overridden = overrides.onRequest?.(method, path);
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
