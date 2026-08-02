import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadVersionsWorkspaceData } from "./data";

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
  shot_id: "s1",
  project_name: "D1 Demo Project",
  shot_name: "Shot 010",
};
const VERSION_OLD = {
  id: "v1",
  shot_id: "s1",
  name: "SH010_v001",
  version_number: 1,
  description: "First pass.",
  source: "manual",
  created_by_actor_kind: "human",
  created_by_actor_id: "vfx-1",
  created_by_human_role: "vfx_supervisor",
  created_at: "2026-01-01T00:00:00Z",
};
const VERSION_NEW = {
  ...VERSION_OLD,
  id: "v2",
  name: "SH010_v002",
  version_number: 2,
  created_at: "2026-02-01T00:00:00Z",
};

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("loadVersionsWorkspaceData", () => {
  it("returns null on a real 404 (Shot not found)", async () => {
    fetchMock.mockResolvedValue(jsonResponse(404, { detail: "not found" }));
    const result = await loadVersionsWorkspaceData("missing-shot");
    expect(result).toBeNull();
  });

  it("propagates a genuine API failure instead of collapsing it into null", async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { detail: "boom" }));
    await expect(loadVersionsWorkspaceData("s1")).rejects.toMatchObject({
      status: 500,
    });
  });

  it("sorts real Production Versions newest first and attaches each Version's real Review Notes", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, ITEM)) // fetchVfxInboxItem
      .mockResolvedValueOnce(jsonResponse(200, [VERSION_OLD, VERSION_NEW])) // listVersionsForShot (oldest first, real backend order)
      .mockResolvedValueOnce(jsonResponse(200, [])) // listCrossRoleAssessmentsForShot
      .mockResolvedValueOnce(
        jsonResponse(200, [
          {
            id: "n1",
            version_id: "v2",
            content: "Tighten the timing.",
            source: "manual",
            created_by_actor_kind: "human",
            created_by_actor_id: "vfx-1",
            created_by_human_role: "vfx_supervisor",
            created_at: "2026-02-02T00:00:00Z",
          },
        ]),
      ) // review notes for v2 (newest, fetched first)
      .mockResolvedValueOnce(jsonResponse(200, [])); // review notes for v1

    const result = await loadVersionsWorkspaceData("s1");
    expect(result?.versions.map((entry) => entry.version.id)).toEqual([
      "v2",
      "v1",
    ]);
    expect(result?.versions[0].reviewNotes).toHaveLength(1);
    expect(result?.versions[1].reviewNotes).toEqual([]);
  });

  it("honestly returns an empty versions array when the Shot has no Production Versions", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, ITEM))
      .mockResolvedValueOnce(jsonResponse(200, []))
      .mockResolvedValueOnce(jsonResponse(200, []));

    const result = await loadVersionsWorkspaceData("s1");
    expect(result?.versions).toEqual([]);
  });

  it("groups real Cross-role Assessments by their real version_id, never fabricating a relationship", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, ITEM))
      .mockResolvedValueOnce(jsonResponse(200, [VERSION_OLD]))
      .mockResolvedValueOnce(
        jsonResponse(200, [
          { id: "a1", version_id: "v1", shot_id: "s1" },
          { id: "a2", version_id: "v1", shot_id: "s1" },
        ]),
      )
      .mockResolvedValueOnce(jsonResponse(200, []));

    const result = await loadVersionsWorkspaceData("s1");
    expect(result?.assessmentsByVersionId.get("v1")).toHaveLength(2);
    expect(result?.assessmentsByVersionId.get("v2")).toBeUndefined();
  });

  it("stays Shot-wide: includes Versions linked to different Tasks and Versions with no Task link at all (Step 8C-6/8C-7)", async () => {
    const versionTaskA = { ...VERSION_OLD, id: "v1", task_id: "task-a" };
    const versionTaskB = { ...VERSION_NEW, id: "v2", task_id: "task-b" };
    const versionNoTask = {
      ...VERSION_OLD,
      id: "v3",
      task_id: null,
      created_at: "2026-03-01T00:00:00Z",
    };
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, ITEM))
      .mockResolvedValueOnce(
        jsonResponse(200, [versionTaskA, versionTaskB, versionNoTask]),
      )
      .mockResolvedValueOnce(jsonResponse(200, []))
      .mockResolvedValueOnce(jsonResponse(200, []))
      .mockResolvedValueOnce(jsonResponse(200, []))
      .mockResolvedValueOnce(jsonResponse(200, []));

    const result = await loadVersionsWorkspaceData("s1");
    expect(result?.versions.map((entry) => entry.version.id)).toEqual([
      "v3",
      "v2",
      "v1",
    ]);
  });

  it("orders Versions and Review Notes by source_created_at when present, not by created_at (Step 8C-6/8C-7)", async () => {
    // Both share the same ICAS-ingestion created_at (a single backfill
    // sync run), but their real ftrack source_created_at values are far
    // apart -- source_created_at must win the sort.
    const versionEarlySource = {
      ...VERSION_OLD,
      id: "v1",
      created_at: "2026-05-01T00:00:00Z",
      source_created_at: "2020-01-01T00:00:00Z",
    };
    const versionLateSource = {
      ...VERSION_OLD,
      id: "v2",
      created_at: "2026-05-01T00:00:00Z",
      source_created_at: "2024-01-01T00:00:00Z",
    };
    const noteEarlySource = {
      id: "n1",
      version_id: "v2",
      content: "Earlier by ftrack source time.",
      source: "ftrack",
      created_by_actor_kind: "system",
      created_by_actor_id: "ftrack",
      created_by_human_role: null,
      created_at: "2026-05-01T00:00:00Z",
      source_created_at: "2019-01-01T00:00:00Z",
    };
    const noteLateSource = {
      id: "n2",
      version_id: "v2",
      content: "Later by ftrack source time.",
      source: "ftrack",
      created_by_actor_kind: "system",
      created_by_actor_id: "ftrack",
      created_by_human_role: null,
      created_at: "2026-05-01T00:00:00Z",
      source_created_at: "2023-01-01T00:00:00Z",
    };
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, ITEM))
      .mockResolvedValueOnce(
        jsonResponse(200, [versionEarlySource, versionLateSource]),
      )
      .mockResolvedValueOnce(jsonResponse(200, []))
      .mockResolvedValueOnce(
        jsonResponse(200, [noteLateSource, noteEarlySource]),
      ) // v2's notes, fetched first (newest version first)
      .mockResolvedValueOnce(jsonResponse(200, [])); // v1's notes

    const result = await loadVersionsWorkspaceData("s1");
    expect(result?.versions.map((entry) => entry.version.id)).toEqual([
      "v2",
      "v1",
    ]);
    expect(result?.versions[0].reviewNotes.map((note) => note.id)).toEqual([
      "n1",
      "n2",
    ]);
  });
});
