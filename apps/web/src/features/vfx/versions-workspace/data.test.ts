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
});
