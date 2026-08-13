import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadAlignmentWorkspaceData } from "./data";

const fetchMock = vi.fn();

const VFX_ACTOR_HEADERS = {
  "X-Actor-Role": "vfx_supervisor",
  "X-Actor-Id": "vfx-1",
};

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

const EMPTY_DEPARTMENT_OVERVIEW = {
  shot_id: "s1",
  tasks: [],
  generated_at: "2026-08-01T00:00:00Z",
};

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
    const result = await loadAlignmentWorkspaceData(
      "missing-shot",
      VFX_ACTOR_HEADERS,
    );
    expect(result).toBeNull();
  });

  it("propagates a genuine API failure instead of collapsing it into null", async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { detail: "boom" }));
    await expect(
      loadAlignmentWorkspaceData("s1", VFX_ACTOR_HEADERS),
    ).rejects.toMatchObject({
      status: 500,
    });
  });

  it("honestly returns an empty assessments array when none has ever been generated", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, ITEM))
      .mockResolvedValueOnce(jsonResponse(200, [])) // listCrossRoleAssessmentsForShot
      .mockResolvedValueOnce(jsonResponse(200, [])) // listVersionsForShot
      .mockResolvedValueOnce(jsonResponse(200, [])) // listCoreAnchorRevisions
      .mockResolvedValueOnce(jsonResponse(200, EMPTY_DEPARTMENT_OVERVIEW)); // fetchDepartmentExecutionOverview

    const result = await loadAlignmentWorkspaceData("s1", VFX_ACTOR_HEADERS);
    expect(result?.assessments).toEqual([]);
  });

  it("builds real Version and Core Anchor Revision lookup maps for the returned assessments", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, ITEM))
      .mockResolvedValueOnce(
        jsonResponse(200, [
          {
            id: "a1",
            version_id: "v1",
            core_anchor_revision_id: "r1",
            shot_id: "s1",
          },
        ]),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, [{ id: "v1", name: "SH010_v001" }]),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, [{ id: "r1", revision_number: 1 }]),
      )
      .mockResolvedValueOnce(jsonResponse(200, EMPTY_DEPARTMENT_OVERVIEW)); // fetchDepartmentExecutionOverview

    const result = await loadAlignmentWorkspaceData("s1", VFX_ACTOR_HEADERS);
    expect(result?.assessments).toHaveLength(1);
    expect(result?.versionsById.get("v1")).toMatchObject({
      name: "SH010_v001",
    });
    expect(result?.revisionsById.get("r1")).toMatchObject({
      revision_number: 1,
    });
  });

  it("wires the real Department Execution Overview into the loaded data", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, ITEM))
      .mockResolvedValueOnce(jsonResponse(200, []))
      .mockResolvedValueOnce(jsonResponse(200, []))
      .mockResolvedValueOnce(jsonResponse(200, []))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          shot_id: "s1",
          tasks: [
            {
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
            },
          ],
          generated_at: "2026-08-01T00:00:00Z",
        }),
      ); // fetchDepartmentExecutionOverview

    const result = await loadAlignmentWorkspaceData("s1", VFX_ACTOR_HEADERS);
    expect(result?.departmentExecutionOverview?.tasks).toHaveLength(1);
    expect(result?.departmentExecutionOverview?.tasks[0]?.department).toBe(
      "animation",
    );
  });

  it("honestly returns a null Department Execution Overview when that one role-gated call fails, without failing the whole page", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, ITEM))
      .mockResolvedValueOnce(jsonResponse(200, []))
      .mockResolvedValueOnce(jsonResponse(200, []))
      .mockResolvedValueOnce(jsonResponse(200, []))
      .mockResolvedValueOnce(jsonResponse(500, { detail: "boom" })); // fetchDepartmentExecutionOverview

    const result = await loadAlignmentWorkspaceData("s1", VFX_ACTOR_HEADERS);
    expect(result?.departmentExecutionOverview).toBeNull();
    expect(result?.assessments).toEqual([]);
  });
});
