import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VfxApiError, fetchVfxInbox, fetchVfxInboxItem } from "./api";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("fetchVfxInbox", () => {
  it("returns the parsed Inbox on success", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], generated_at: "2026-07-30T00:00:00Z" }),
    });
    const inbox = await fetchVfxInbox();
    expect(inbox.items).toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/vfx/inbox",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("throws a VfxApiError with the real status and detail on failure", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => ({ detail: "boom" }),
    });
    await expect(fetchVfxInbox()).rejects.toMatchObject({
      status: 500,
      detail: "boom",
    });
  });

  it("throws a VfxApiError with status 0 on a network failure", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    await expect(fetchVfxInbox()).rejects.toMatchObject({ status: 0 });
  });
});

describe("fetchVfxInboxItem", () => {
  it("returns the item on success", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ shot_id: "s1" }),
    });
    const item = await fetchVfxInboxItem("s1");
    expect(item).toEqual({ shot_id: "s1" });
  });

  it("returns null on a real 404 (Shot not found)", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: async () => ({ detail: "Shot not found" }),
    });
    const item = await fetchVfxInboxItem("missing");
    expect(item).toBeNull();
  });

  it("rethrows a VfxApiError for a non-404 failure", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => ({ detail: "boom" }),
    });
    await expect(fetchVfxInboxItem("s1")).rejects.toBeInstanceOf(VfxApiError);
  });
});
