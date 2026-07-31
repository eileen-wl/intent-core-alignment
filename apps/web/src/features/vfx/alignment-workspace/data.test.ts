import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadAlignmentWorkspaceData } from "./data";

const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    json: async () => body,
  };
}

const ITEM = { shot_id: "s1", project_name: "D1 Demo Project", shot_name: "Shot 010" };

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("loadAlignmentWorkspaceData", () => {
  it("returns null on a real 404 (Shot not found)", async () => {
    fetchMock.mockResolvedValue(jsonResponse(404, { detail: "not found" }));
    const result = await loadAlignmentWorkspaceData("missing-shot");
    expect(result).toBeNull();
  });

  it("propagates a genuine API failure instead of collapsing it into null", async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { detail: "boom" }));
    await expect(loadAlignmentWorkspaceData("s1")).rejects.toMatchObject({ status: 500 });
  });

  it("honestly returns an empty assessments array when none has ever been generated", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, ITEM))
      .mockResolvedValueOnce(jsonResponse(200, [])) // listCrossRoleAssessmentsForShot
      .mockResolvedValueOnce(jsonResponse(200, [])) // listVersionsForShot
      .mockResolvedValueOnce(jsonResponse(200, [])); // listCoreAnchorRevisions

    const result = await loadAlignmentWorkspaceData("s1");
    expect(result?.assessments).toEqual([]);
  });

  it("builds real Version and Core Anchor Revision lookup maps for the returned assessments", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, ITEM))
      .mockResolvedValueOnce(
        jsonResponse(200, [
          { id: "a1", version_id: "v1", core_anchor_revision_id: "r1", shot_id: "s1" },
        ]),
      )
      .mockResolvedValueOnce(jsonResponse(200, [{ id: "v1", name: "SH010_v001" }]))
      .mockResolvedValueOnce(jsonResponse(200, [{ id: "r1", revision_number: 1 }]));

    const result = await loadAlignmentWorkspaceData("s1");
    expect(result?.assessments).toHaveLength(1);
    expect(result?.versionsById.get("v1")).toMatchObject({ name: "SH010_v001" });
    expect(result?.revisionsById.get("r1")).toMatchObject({ revision_number: 1 });
  });
});
