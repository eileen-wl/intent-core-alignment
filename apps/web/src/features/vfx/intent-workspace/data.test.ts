import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadIntentWorkspaceData } from "./data";

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
const CONFIRMED = {
  id: "r1",
  status: "confirmed",
  source_intent_decomposition_id: null,
  supersedes_revision_id: null,
  created_by_agent_run_id: null,
  context_snapshot_id: null,
};
const DRAFT = {
  id: "r2",
  status: "draft",
  source_intent_decomposition_id: null,
  supersedes_revision_id: "r1",
  created_by_agent_run_id: null,
  context_snapshot_id: null,
};

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("loadIntentWorkspaceData", () => {
  it("returns null on a real 404 (Shot not found), issuing no further calls", async () => {
    fetchMock.mockResolvedValue(jsonResponse(404, { detail: "not found" }));
    const result = await loadIntentWorkspaceData("missing-shot");
    expect(result).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("propagates a genuine API failure instead of collapsing it into null", async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { detail: "boom" }));
    await expect(loadIntentWorkspaceData("s1")).rejects.toMatchObject({ status: 500 });
  });

  it("resolves confirmed-only state (no draft) and includes evidence data for the confirmed revision", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, ITEM)) // fetchVfxInboxItem
      .mockResolvedValueOnce(jsonResponse(200, [CONFIRMED])) // listCoreAnchorRevisions
      .mockResolvedValueOnce(jsonResponse(200, [])) // listIntentDecompositionsForShot
      .mockResolvedValueOnce(jsonResponse(200, [])); // listContextReconstructionsForShot

    const result = await loadIntentWorkspaceData("s1");
    expect(result?.confirmedRevision).toEqual(CONFIRMED);
    expect(result?.draftRevision).toBeNull();
    expect(result?.draftHumanGate).toBeNull();
    expect(result?.evidenceData?.evidence).toEqual([]);
    expect(result?.evidenceData?.decompositions).toEqual([]);
  });

  it("resolves draft state, fetches the draft's HumanGate, and cites the superseded revision as evidence", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, ITEM))
      .mockResolvedValueOnce(jsonResponse(200, [CONFIRMED, DRAFT]))
      .mockResolvedValueOnce(jsonResponse(200, { id: "gate-1", status: "pending" }))
      .mockResolvedValueOnce(jsonResponse(200, [])) // decompositions
      .mockResolvedValueOnce(jsonResponse(200, [])); // reconstructions

    const result = await loadIntentWorkspaceData("s1");
    expect(result?.draftRevision).toEqual(DRAFT);
    expect(result?.draftHumanGate).toEqual({ id: "gate-1", status: "pending" });
    expect(result?.evidenceData?.evidence).toEqual([
      { source_type: "core_anchor_revision", source_id: "r1", label: "Previous confirmed revision" },
    ]);
  });

  it("resolves the never-confirmed, no-draft state with null evidence data", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, ITEM))
      .mockResolvedValueOnce(jsonResponse(200, []));

    const result = await loadIntentWorkspaceData("s1");
    expect(result?.confirmedRevision).toBeNull();
    expect(result?.draftRevision).toBeNull();
    expect(result?.evidenceData).toBeNull();
  });
});
