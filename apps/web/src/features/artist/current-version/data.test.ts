import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadCurrentVersionData } from "./data";

const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    json: async () => body,
  };
}

const ITEM = {
  task_id: "t1",
  shot_id: "s1",
  project_name: "D1 Demo Project",
  shot_name: "Shot 010",
  task_name: "Lighting Pass",
};

function makeVersion(overrides: Record<string, unknown> = {}) {
  return {
    id: "v1",
    shot_id: "s1",
    task_id: null,
    name: "SH010_v001",
    version_number: 1,
    description: "First pass.",
    source: "manual",
    created_by_actor_kind: "human",
    created_by_actor_id: "vfx-1",
    created_by_human_role: "vfx_supervisor",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("loadCurrentVersionData", () => {
  it("returns null on a real 404 (Task not found)", async () => {
    fetchMock.mockResolvedValue(jsonResponse(404, { detail: "not found" }));
    const result = await loadCurrentVersionData("missing-task");
    expect(result).toBeNull();
  });

  it("propagates a genuine API failure instead of collapsing it into null", async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { detail: "boom" }));
    await expect(loadCurrentVersionData("t1")).rejects.toMatchObject({
      status: 500,
    });
  });

  it("includes a Version linked to this Task and a Version with no Task link, but excludes a Version linked to a different Task (Step 8C-6/8C-7)", async () => {
    const versionThisTask = makeVersion({
      id: "v-this",
      task_id: "t1",
      created_at: "2026-01-01T00:00:00Z",
    });
    const versionOtherTask = makeVersion({
      id: "v-other",
      task_id: "t2",
      created_at: "2026-01-03T00:00:00Z",
    });
    const versionNoTask = makeVersion({
      id: "v-legacy",
      task_id: null,
      created_at: "2026-01-02T00:00:00Z",
    });
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, ITEM)) // fetchArtistInboxItem
      .mockResolvedValueOnce(
        jsonResponse(200, [versionThisTask, versionOtherTask, versionNoTask]),
      ) // listVersionsForShot
      .mockResolvedValueOnce(jsonResponse(200, null)) // getCoreAnchor
      .mockResolvedValueOnce(jsonResponse(200, null)) // getExecutionAnchor
      .mockResolvedValueOnce(jsonResponse(200, [])) // listReviewNotesForVersion(selected)
      .mockResolvedValueOnce(jsonResponse(200, [])) // listArtistGuidancesForVersion(selected)
      .mockResolvedValueOnce(jsonResponse(200, [])); // listCrossRoleAssessmentsForVersion(selected)

    const result = await loadCurrentVersionData("t1");
    const ids = result?.versions.map((version) => version.id);
    expect(ids).toEqual(["v-legacy", "v-this"]);
    expect(ids).not.toContain("v-other");
    // Newest task-scoped Version is selected by default -- never the
    // excluded other-Task Version, even though it is chronologically
    // newest overall.
    expect(result?.selectedVersion?.id).toBe("v-legacy");
  });

  it("never selects an out-of-scope Version even via a hand-crafted ?version= id (Step 8C-6/8C-7)", async () => {
    const versionThisTask = makeVersion({
      id: "v-this",
      task_id: "t1",
      created_at: "2026-01-01T00:00:00Z",
    });
    const versionOtherTask = makeVersion({
      id: "v-other",
      task_id: "t2",
      created_at: "2026-01-02T00:00:00Z",
    });
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, ITEM))
      .mockResolvedValueOnce(
        jsonResponse(200, [versionThisTask, versionOtherTask]),
      )
      .mockResolvedValueOnce(jsonResponse(200, null))
      .mockResolvedValueOnce(jsonResponse(200, null))
      .mockResolvedValueOnce(jsonResponse(200, []))
      .mockResolvedValueOnce(jsonResponse(200, []))
      .mockResolvedValueOnce(jsonResponse(200, []));

    const result = await loadCurrentVersionData("t1", "v-other");
    expect(result?.selectedVersion?.id).toBe("v-this");
  });

  it("orders task-scoped Versions newest first and Review Notes oldest first by effective timestamp (Step 8C-6/8C-7)", async () => {
    const versionEarly = makeVersion({
      id: "v-early",
      task_id: "t1",
      created_at: "2026-06-01T00:00:00Z",
      source_created_at: "2019-01-01T00:00:00Z",
    });
    const versionLate = makeVersion({
      id: "v-late",
      task_id: "t1",
      created_at: "2026-06-01T00:00:00Z",
      source_created_at: "2020-01-01T00:00:00Z",
    });
    const noteLate = {
      id: "n-late",
      version_id: "v-late",
      content: "Later by source time.",
      source: "ftrack",
      created_by_actor_kind: "system",
      created_by_actor_id: "ftrack",
      created_by_human_role: null,
      created_at: "2026-06-02T00:00:00Z",
      source_created_at: "2020-02-01T00:00:00Z",
    };
    const noteEarly = {
      id: "n-early",
      version_id: "v-late",
      content: "Earlier by source time.",
      source: "ftrack",
      created_by_actor_kind: "system",
      created_by_actor_id: "ftrack",
      created_by_human_role: null,
      created_at: "2026-06-02T00:00:00Z",
      source_created_at: "2020-01-15T00:00:00Z",
    };
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, ITEM))
      .mockResolvedValueOnce(jsonResponse(200, [versionEarly, versionLate]))
      .mockResolvedValueOnce(jsonResponse(200, null))
      .mockResolvedValueOnce(jsonResponse(200, null))
      .mockResolvedValueOnce(jsonResponse(200, [noteLate, noteEarly])) // notes for selected (v-late, newest)
      .mockResolvedValueOnce(jsonResponse(200, []))
      .mockResolvedValueOnce(jsonResponse(200, []));

    const result = await loadCurrentVersionData("t1");
    expect(result?.versions.map((version) => version.id)).toEqual([
      "v-late",
      "v-early",
    ]);
    expect(result?.selectedVersion?.id).toBe("v-late");
    expect(result?.reviewNotes.map((note) => note.id)).toEqual([
      "n-early",
      "n-late",
    ]);
  });

  it("honestly returns no selected Version when no Version is in this Task's scope", async () => {
    const versionOtherTask = makeVersion({ id: "v-other", task_id: "t2" });
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, ITEM))
      .mockResolvedValueOnce(jsonResponse(200, [versionOtherTask]))
      .mockResolvedValueOnce(jsonResponse(200, null))
      .mockResolvedValueOnce(jsonResponse(200, null));

    const result = await loadCurrentVersionData("t1");
    expect(result?.versions).toEqual([]);
    expect(result?.selectedVersion).toBeNull();
    expect(result?.reviewNotes).toEqual([]);
  });
});
