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
const SUPERSEDED = {
  id: "r1",
  status: "superseded",
  source_intent_decomposition_id: null,
  supersedes_revision_id: null,
  created_by_agent_run_id: null,
  context_snapshot_id: null,
};
const LATER_CONFIRMED = {
  id: "r2",
  status: "confirmed",
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
      .mockResolvedValueOnce(jsonResponse(200, [])) // listContextReconstructionsForShot
      .mockResolvedValueOnce(jsonResponse(200, [])); // listDecisionsForRevision

    const result = await loadIntentWorkspaceData("s1");
    expect(result?.confirmedRevision).toEqual(CONFIRMED);
    expect(result?.draftRevision).toBeNull();
    expect(result?.draftHumanGate).toBeNull();
    expect(result?.evidenceData?.evidence).toEqual([]);
    expect(result?.evidenceData?.decompositions).toEqual([]);
    // A first-ever confirmation has no previous revision to compare
    // against -- honest null, never fabricated.
    expect(result?.previousConfirmedRevision).toBeNull();
    // No Decision has been recorded in this fixture -- honest null,
    // never a fabricated placeholder rationale.
    expect(result?.confirmedDecisionRationale).toBeNull();
  });

  it("fetches the real confirming Decision's rationale for a confirmed-only Shot", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, ITEM))
      .mockResolvedValueOnce(jsonResponse(200, [CONFIRMED]))
      .mockResolvedValueOnce(jsonResponse(200, []))
      .mockResolvedValueOnce(jsonResponse(200, []))
      .mockResolvedValueOnce(
        jsonResponse(200, [
          { id: "d1", decision_type: "confirm_core_anchor", rationale: "Matches the director's note." },
        ]),
      );

    const result = await loadIntentWorkspaceData("s1");
    expect(result?.confirmedDecisionRationale).toBe("Matches the director's note.");
  });

  it("derives previousConfirmedRevision from the already-fetched revisions list (no extra API call)", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, ITEM))
      .mockResolvedValueOnce(jsonResponse(200, [SUPERSEDED, LATER_CONFIRMED]))
      .mockResolvedValueOnce(jsonResponse(200, [])) // decompositions
      .mockResolvedValueOnce(jsonResponse(200, [])) // reconstructions
      .mockResolvedValueOnce(jsonResponse(200, [])); // decisions

    const result = await loadIntentWorkspaceData("s1");
    expect(result?.confirmedRevision).toEqual(LATER_CONFIRMED);
    expect(result?.previousConfirmedRevision).toEqual(SUPERSEDED);
    // Exactly the calls the confirmed-only branch makes -- no dedicated
    // fetch was added for the superseded revision itself.
    expect(fetchMock).toHaveBeenCalledTimes(5);
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
    // Revision Draft never renders the Decision-and-provenance card, so
    // no Decisions fetch is issued while a draft is in progress -- exactly
    // the 5 calls above, never a 6th.
    expect(result?.confirmedDecisionRationale).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("resolves the never-confirmed, no-draft state with null evidence data", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, ITEM))
      .mockResolvedValueOnce(jsonResponse(200, []));

    const result = await loadIntentWorkspaceData("s1");
    expect(result?.confirmedRevision).toBeNull();
    expect(result?.draftRevision).toBeNull();
    expect(result?.evidenceData).toBeNull();
    expect(result?.previousConfirmedRevision).toBeNull();
    expect(result?.confirmedDecisionRationale).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
