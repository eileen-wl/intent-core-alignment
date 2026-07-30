import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieStore = { get: vi.fn() };
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

import { actorHeaders, resolveIdentity } from "./identity";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveIdentity", () => {
  it("resolves the VFX Supervisor identity from the Demo cookie", async () => {
    cookieStore.get.mockReturnValue({ value: "vfx_supervisor" });
    const identity = await resolveIdentity();
    expect(identity).toEqual({
      role: "vfx_supervisor",
      actorId: "vfx-1",
      displayName: "Maya Chen",
    });
  });

  it("resolves distinct identities for CG Supervisor and Artist", async () => {
    cookieStore.get.mockReturnValue({ value: "cg_supervisor" });
    expect(await resolveIdentity()).toEqual({
      role: "cg_supervisor",
      actorId: "cg-1",
      displayName: "Daniel Ross",
    });

    cookieStore.get.mockReturnValue({ value: "artist" });
    expect(await resolveIdentity()).toEqual({
      role: "artist",
      actorId: "artist-1",
      displayName: "Lena Park",
    });
  });

  it("returns null when no Demo role cookie is present", async () => {
    cookieStore.get.mockReturnValue(undefined);
    expect(await resolveIdentity()).toBeNull();
  });

  it("returns null for an unsupported/invalid role value", async () => {
    cookieStore.get.mockReturnValue({ value: "producer" });
    expect(await resolveIdentity()).toBeNull();
  });
});

describe("actorHeaders", () => {
  it("produces the trusted X-Actor-Role/X-Actor-Id headers from a resolved identity", () => {
    const headers = actorHeaders({
      role: "vfx_supervisor",
      actorId: "vfx-1",
      displayName: "Maya Chen",
    });
    expect(headers).toEqual({
      "X-Actor-Role": "vfx_supervisor",
      "X-Actor-Id": "vfx-1",
    });
  });
});
