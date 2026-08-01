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

import { generateAssessmentAction } from "./actions";

const fetchMock = vi.fn();

const ASSESSMENT = { id: "a1", version_id: "v1", task_id: "t1" };

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

describe("generateAssessmentAction", () => {
  it("rejects when no VFX Supervisor Demo role is active, without ever calling fetch", async () => {
    cookieStore.get.mockReturnValue(undefined);
    const result = await generateAssessmentAction("shot-1", "v1", "t1");
    expect(result).toEqual({
      ok: false,
      error: {
        kind: "forbidden",
        message: "Generating a Cross-role Assessment is owned by the VFX Supervisor.",
      },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a different Demo role (e.g. CG Supervisor)", async () => {
    cookieStore.get.mockReturnValue({ value: "cg_supervisor" });
    const result = await generateAssessmentAction("shot-1", "v1", "t1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("forbidden");
  });

  it("calls the real generate endpoint with trusted actor headers and the real task_id, then revalidates Alignment/Overview/Inbox", async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, ASSESSMENT));
    const result = await generateAssessmentAction("shot-1", "v1", "t1");

    expect(result).toEqual({ ok: true, assessment: ASSESSMENT });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/intent/versions/v1/cross-role-assessments/generate"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "X-Actor-Role": "vfx_supervisor", "X-Actor-Id": "vfx-1" }),
        body: JSON.stringify({ task_id: "t1" }),
      }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/vfx/shots/shot-1/alignment");
    expect(revalidatePathMock).toHaveBeenCalledWith("/vfx/shots/shot-1");
    expect(revalidatePathMock).toHaveBeenCalledWith("/vfx");
  });

  it("never returns an actor id anywhere in a successful result", async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, ASSESSMENT));
    const result = await generateAssessmentAction("shot-1", "v1", "t1");
    expect(JSON.stringify(result)).not.toMatch(/vfx-1/);
  });

  it("maps a 409 (prerequisites no longer satisfied for this pair) to a conflict result", async () => {
    fetchMock.mockResolvedValue(jsonResponse(409, { detail: "prerequisites changed" }));
    const result = await generateAssessmentAction("shot-1", "v1", "t1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("conflict");
  });

  it("maps a network failure to an unavailable result", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const result = await generateAssessmentAction("shot-1", "v1", "t1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("network");
  });
});
