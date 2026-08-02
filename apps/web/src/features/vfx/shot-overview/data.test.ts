import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadShotOverviewData } from "./data";

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
  current_focus: { focus_type: "none", actionable: false },
};

const CONFIRMED_REVISION = {
  id: "rev1",
  core_anchor_id: "ca1",
  revision_number: 1,
  status: "confirmed",
  core_summary: "A restrained dusk confrontation.",
  created_by_actor_kind: "human",
  created_by_actor_id: "vfx-1",
  created_by_human_role: "vfx_supervisor",
  created_at: "2026-08-01T00:00:00Z",
  constraints: [],
  variation_zones: [],
  drift_risks: [],
  references: [],
  open_questions: [],
};

const VERSION = {
  id: "v1",
  shot_id: "s1",
  name: "v001",
  version_number: 1,
  description: "",
  source: "manual",
  created_by_actor_kind: "human",
  created_by_actor_id: "vfx-1",
  created_by_human_role: "vfx_supervisor",
  created_at: "2026-08-01T00:00:00Z",
};

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("loadShotOverviewData", () => {
  it("returns null on a real 404 (Shot not found)", async () => {
    fetchMock.mockResolvedValue(jsonResponse(404, { detail: "not found" }));
    const result = await loadShotOverviewData(
      "missing-shot",
      VFX_ACTOR_HEADERS,
    );
    expect(result).toBeNull();
  });

  it("selects the confirmed revision, never a draft, and resolves its confirm Decision rationale", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, ITEM)) // fetchVfxInboxItem
      .mockResolvedValueOnce(
        jsonResponse(200, [
          { ...CONFIRMED_REVISION, id: "draft1", status: "draft" },
          CONFIRMED_REVISION,
        ]),
      ) // listCoreAnchorRevisions
      .mockResolvedValueOnce(jsonResponse(200, [])) // listVersionsForShot
      .mockResolvedValueOnce(jsonResponse(200, [])) // listCrossRoleAssessmentsForShot
      .mockResolvedValueOnce(
        jsonResponse(200, {
          shot_id: "s1",
          tasks: [],
          generated_at: "2026-08-01T00:00:00Z",
        }),
      ) // fetchDepartmentExecutionOverview
      .mockResolvedValueOnce(
        jsonResponse(200, [
          {
            id: "d1",
            decision_type: "confirm_core_anchor",
            owning_human_role: "vfx_supervisor",
            actor_kind: "human",
            actor_id: "vfx-1",
            actor_human_role: "vfx_supervisor",
            rationale: "Matches the confirmed brief.",
            entity_type: "core_anchor_revision",
            entity_id: "rev1",
            write_back_requested: false,
            supersedes_decision_id: null,
            created_at: "2026-08-01T00:00:00Z",
          },
        ]),
      ); // listDecisionsForRevision

    const result = await loadShotOverviewData("s1", VFX_ACTOR_HEADERS);
    expect(result?.confirmedCoreAnchorRevision?.id).toBe("rev1");
    expect(result?.confirmedCoreAnchorRevision?.status).toBe("confirmed");
    expect(result?.confirmedDecisionRationale).toBe(
      "Matches the confirmed brief.",
    );
  });

  it("honestly returns null confirmedCoreAnchorRevision when only a draft exists", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, ITEM))
      .mockResolvedValueOnce(
        jsonResponse(200, [
          { ...CONFIRMED_REVISION, id: "draft1", status: "draft" },
        ]),
      )
      .mockResolvedValueOnce(jsonResponse(200, []))
      .mockResolvedValueOnce(jsonResponse(200, []))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          shot_id: "s1",
          tasks: [],
          generated_at: "2026-08-01T00:00:00Z",
        }),
      ); // fetchDepartmentExecutionOverview

    const result = await loadShotOverviewData("s1", VFX_ACTOR_HEADERS);
    expect(result?.confirmedCoreAnchorRevision).toBeNull();
    expect(result?.confirmedDecisionRationale).toBeNull();
  });

  it("orders Versions by effective timestamp and attaches the newest Version's newest Review Note", async () => {
    const olderVersion = {
      ...VERSION,
      id: "v-old",
      created_at: "2026-07-01T00:00:00Z",
    };
    const newerVersion = {
      ...VERSION,
      id: "v-new",
      created_at: "2026-08-01T00:00:00Z",
    };
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, ITEM))
      .mockResolvedValueOnce(jsonResponse(200, []))
      .mockResolvedValueOnce(jsonResponse(200, [olderVersion, newerVersion]))
      .mockResolvedValueOnce(jsonResponse(200, []))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          shot_id: "s1",
          tasks: [],
          generated_at: "2026-08-01T00:00:00Z",
        }),
      ) // fetchDepartmentExecutionOverview
      .mockResolvedValueOnce(
        jsonResponse(200, [
          {
            id: "n1",
            version_id: "v-new",
            content: "Tighten the timing.",
            source: "manual",
            created_by_actor_kind: "human",
            created_by_actor_id: "vfx-1",
            created_by_human_role: "vfx_supervisor",
            created_at: "2026-08-02T00:00:00Z",
          },
        ]),
      ); // listReviewNotesForVersion(v-new)

    const result = await loadShotOverviewData("s1", VFX_ACTOR_HEADERS);
    expect(result?.latestVersion?.id).toBe("v-new");
    expect(result?.latestReviewNote?.content).toBe("Tighten the timing.");
  });

  it("honestly returns an empty state when the Shot has no Versions, Assessments, or confirmed Anchor", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, ITEM))
      .mockResolvedValueOnce(jsonResponse(200, []))
      .mockResolvedValueOnce(jsonResponse(200, []))
      .mockResolvedValueOnce(jsonResponse(200, []))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          shot_id: "s1",
          tasks: [],
          generated_at: "2026-08-01T00:00:00Z",
        }),
      ); // fetchDepartmentExecutionOverview

    const result = await loadShotOverviewData("s1", VFX_ACTOR_HEADERS);
    expect(result?.confirmedCoreAnchorRevision).toBeNull();
    expect(result?.latestVersion).toBeNull();
    expect(result?.latestReviewNote).toBeNull();
    expect(result?.currentAssessment).toBeNull();
  });

  it("uses the newest (first) real Cross-role Assessment as the current one", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, ITEM))
      .mockResolvedValueOnce(jsonResponse(200, []))
      .mockResolvedValueOnce(jsonResponse(200, []))
      .mockResolvedValueOnce(
        jsonResponse(200, [
          { id: "a-newest", version_id: "v1" },
          { id: "a-older", version_id: "v1" },
        ]),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          shot_id: "s1",
          tasks: [],
          generated_at: "2026-08-01T00:00:00Z",
        }),
      ); // fetchDepartmentExecutionOverview

    const result = await loadShotOverviewData("s1", VFX_ACTOR_HEADERS);
    expect(result?.currentAssessment?.id).toBe("a-newest");
  });

  it("attaches a real Department Execution Overview when the role-gated call succeeds (Step 9B-3)", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, ITEM))
      .mockResolvedValueOnce(jsonResponse(200, []))
      .mockResolvedValueOnce(jsonResponse(200, []))
      .mockResolvedValueOnce(jsonResponse(200, []))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          shot_id: "s1",
          tasks: [{ task_id: "t1", task_name: "Compositing Review" }],
          generated_at: "2026-08-01T00:00:00Z",
        }),
      ); // fetchDepartmentExecutionOverview

    const result = await loadShotOverviewData("s1", VFX_ACTOR_HEADERS);
    expect(result?.departmentExecutionOverview?.tasks).toHaveLength(1);
    expect(result?.departmentExecutionOverview?.tasks[0]?.task_id).toBe("t1");
  });

  it("does not fail the whole Shot Overview load when the Department Execution Overview call itself fails", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, ITEM))
      .mockResolvedValueOnce(jsonResponse(200, []))
      .mockResolvedValueOnce(jsonResponse(200, []))
      .mockResolvedValueOnce(jsonResponse(200, []))
      .mockResolvedValueOnce(
        jsonResponse(403, { detail: "action requires vfx_supervisor" }),
      ); // fetchDepartmentExecutionOverview

    const result = await loadShotOverviewData("s1", VFX_ACTOR_HEADERS);
    expect(result).not.toBeNull();
    expect(result?.item.shot_id).toBe("s1");
    expect(result?.departmentExecutionOverview).toBeNull();
  });
});
