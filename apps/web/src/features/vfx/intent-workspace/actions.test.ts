import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { cookieStore, revalidatePathMock } = vi.hoisted(() => ({
  cookieStore: { get: vi.fn() },
  revalidatePathMock: vi.fn(),
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));
vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

import {
  confirmCoreAnchorRevisionAction,
  createCoreAnchorDraftFromConfirmedAction,
  rejectCoreAnchorRevisionAction,
  saveCoreAnchorDraftAction,
  startBlankCoreAnchorDraftAction,
} from "./actions";

const fetchMock = vi.fn();

const DRAFT_REVISION = { id: "r-draft", status: "draft", revision_number: 2 };
const PENDING_GATE = { id: "gate-1", status: "pending" };

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    json: async () => body,
  };
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  cookieStore.get.mockReturnValue({ value: "vfx_supervisor" });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("server-resolved identity boundary", () => {
  it("rejects every mutation when no VFX Supervisor Demo role is active, without ever calling fetch", async () => {
    cookieStore.get.mockReturnValue(undefined);

    const result = await createCoreAnchorDraftFromConfirmedAction("shot-1");
    expect(result).toEqual({
      ok: false,
      error: {
        kind: "forbidden",
        message: "Core Anchor confirmation is owned by the VFX Supervisor.",
      },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a different Demo role (e.g. CG Supervisor)", async () => {
    cookieStore.get.mockReturnValue({ value: "cg_supervisor" });
    const result = await confirmCoreAnchorRevisionAction("shot-1", "r-draft", "gate-1", "why");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("forbidden");
  });

  it("never returns an actor id anywhere in a successful result", async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { ...DRAFT_REVISION }));
    const result = await createCoreAnchorDraftFromConfirmedAction("shot-1");
    expect(JSON.stringify(result)).not.toMatch(/vfx-1/);
  });
});

describe("createCoreAnchorDraftFromConfirmedAction", () => {
  it("calls the from-confirmed endpoint with trusted actor headers and revalidates Intent/Overview/Inbox", async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, DRAFT_REVISION));
    const result = await createCoreAnchorDraftFromConfirmedAction("shot-1");

    expect(result).toEqual({ ok: true, revision: DRAFT_REVISION });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/intent/shots/shot-1/core-anchor/drafts/from-confirmed"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "X-Actor-Role": "vfx_supervisor", "X-Actor-Id": "vfx-1" }),
      }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/vfx/shots/shot-1/intent");
    expect(revalidatePathMock).toHaveBeenCalledWith("/vfx/shots/shot-1");
    expect(revalidatePathMock).toHaveBeenCalledWith("/vfx");
  });

  it("maps a 409 (draft already exists) to a conflict result", async () => {
    fetchMock.mockResolvedValue(jsonResponse(409, { detail: "draft already exists" }));
    const result = await createCoreAnchorDraftFromConfirmedAction("shot-1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("conflict");
  });

  it("maps a network failure to an unavailable result", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const result = await createCoreAnchorDraftFromConfirmedAction("shot-1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("network");
  });
});

describe("startBlankCoreAnchorDraftAction", () => {
  it("calls the plain draft-creation endpoint", async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { id: "r-blank", status: "draft" }));
    const result = await startBlankCoreAnchorDraftAction("shot-1");
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/intent/shots/shot-1/core-anchor/drafts"),
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("saveCoreAnchorDraftAction", () => {
  it("validates the revision belongs to the Shot before saving", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, [])); // listCoreAnchorRevisions -> empty
    const result = await saveCoreAnchorDraftAction("shot-1", "r-draft", { core_summary: "x" });
    expect(result).toEqual({
      ok: false,
      error: { kind: "not_found", message: "That revision does not belong to this Shot." },
    });
  });

  it("saves successfully and revalidates only the Intent route", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, [DRAFT_REVISION])) // listCoreAnchorRevisions
      .mockResolvedValueOnce(jsonResponse(200, { ...DRAFT_REVISION, core_summary: "Updated" }));

    const result = await saveCoreAnchorDraftAction("shot-1", "r-draft", { core_summary: "Updated" });
    expect(result.ok).toBe(true);
    expect(revalidatePathMock).toHaveBeenCalledWith("/vfx/shots/shot-1/intent");
    expect(revalidatePathMock).not.toHaveBeenCalledWith("/vfx/shots/shot-1");
    expect(revalidatePathMock).not.toHaveBeenCalledWith("/vfx");
  });
});

describe("confirmCoreAnchorRevisionAction", () => {
  it("validates revision + pending gate before confirming, then revalidates Intent/Overview/Inbox", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, [DRAFT_REVISION])) // listCoreAnchorRevisions
      .mockResolvedValueOnce(jsonResponse(200, PENDING_GATE)) // getHumanGateForRevision
      .mockResolvedValueOnce(jsonResponse(200, { ...DRAFT_REVISION, status: "confirmed" }));

    const result = await confirmCoreAnchorRevisionAction("shot-1", "r-draft", "gate-1", "rationale");
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("/intent/core-anchor-revisions/r-draft/confirm"),
      expect.objectContaining({
        body: JSON.stringify({ rationale: "rationale", request_write_back: false }),
      }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/vfx");
  });

  it("keeps request_write_back false even though the field exists", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, [DRAFT_REVISION]))
      .mockResolvedValueOnce(jsonResponse(200, PENDING_GATE))
      .mockResolvedValueOnce(jsonResponse(200, DRAFT_REVISION));

    await confirmCoreAnchorRevisionAction("shot-1", "r-draft", "gate-1", "why");
    const confirmCall = fetchMock.mock.calls[2];
    const body = JSON.parse((confirmCall[1] as RequestInit).body as string);
    expect(body.request_write_back).toBe(false);
  });

  it("returns a stale conflict when the gate is no longer pending", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, [DRAFT_REVISION]))
      .mockResolvedValueOnce(jsonResponse(200, { ...PENDING_GATE, status: "confirmed" }));

    const result = await confirmCoreAnchorRevisionAction("shot-1", "r-draft", "gate-1", "why");
    expect(result).toEqual({
      ok: false,
      error: {
        kind: "conflict",
        message: "This was already acted on elsewhere -- reload to see the current state.",
      },
    });
  });

  it("returns a stale conflict when the gate id does not match", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, [DRAFT_REVISION]))
      .mockResolvedValueOnce(jsonResponse(200, { ...PENDING_GATE, id: "different-gate" }));

    const result = await confirmCoreAnchorRevisionAction("shot-1", "r-draft", "gate-1", "why");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("conflict");
  });

  it("returns not_found when the revision does not belong to the Shot", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, []));
    const result = await confirmCoreAnchorRevisionAction("shot-1", "r-draft", "gate-1", "why");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("not_found");
  });

  it("proceeds (never a stale conflict) when no HumanGate has ever been created for the revision -- the legacy-compatibility case the real backend confirm call resolves atomically", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, [DRAFT_REVISION])) // listCoreAnchorRevisions
      .mockResolvedValueOnce(jsonResponse(404, { detail: "not found" })) // getHumanGateForRevision -> null
      .mockResolvedValueOnce(jsonResponse(200, { ...DRAFT_REVISION, status: "confirmed" }));

    const result = await confirmCoreAnchorRevisionAction("shot-1", "r-draft", null, "why");
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("/intent/core-anchor-revisions/r-draft/confirm"),
      expect.anything(),
    );
  });

  it("still returns a stale conflict when the revision itself was already resolved elsewhere (status no longer draft)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, [{ ...DRAFT_REVISION, status: "confirmed" }]),
    );

    const result = await confirmCoreAnchorRevisionAction("shot-1", "r-draft", "gate-1", "why");
    expect(result).toEqual({
      ok: false,
      error: {
        kind: "conflict",
        message: "This was already acted on elsewhere -- reload to see the current state.",
      },
    });
    // Never even checks the gate or calls confirm once the revision
    // itself is provably no longer a draft.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("maps a 403 from the backend to forbidden", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, [DRAFT_REVISION]))
      .mockResolvedValueOnce(jsonResponse(200, PENDING_GATE))
      .mockResolvedValueOnce(jsonResponse(403, { detail: "forbidden" }));

    const result = await confirmCoreAnchorRevisionAction("shot-1", "r-draft", "gate-1", "why");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("forbidden");
  });
});

describe("rejectCoreAnchorRevisionAction", () => {
  it("rejects successfully and revalidates Intent/Overview/Inbox", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, [DRAFT_REVISION]))
      .mockResolvedValueOnce(jsonResponse(200, PENDING_GATE))
      .mockResolvedValueOnce(jsonResponse(200, { ...DRAFT_REVISION, status: "rejected" }));

    const result = await rejectCoreAnchorRevisionAction("shot-1", "r-draft", "gate-1", "why");
    expect(result.ok).toBe(true);
    expect(revalidatePathMock).toHaveBeenCalledWith("/vfx/shots/shot-1/intent");
    expect(revalidatePathMock).toHaveBeenCalledWith("/vfx/shots/shot-1");
    expect(revalidatePathMock).toHaveBeenCalledWith("/vfx");
  });
});
