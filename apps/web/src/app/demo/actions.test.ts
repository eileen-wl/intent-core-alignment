import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieStore = { set: vi.fn(), delete: vi.fn(), get: vi.fn() };
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

const redirectSpy = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (destination: string) => {
    redirectSpy(destination);
    // The real Next.js redirect() throws a special digest error that
    // aborts the calling function -- mimic that so the code path after
    // redirect() in enterDemoRole/exitRoleView is never reached, same
    // as in production.
    throw new Error(`NEXT_REDIRECT:${destination}`);
  },
}));

const { resolveD1DemoShotIdMock } = vi.hoisted(() => ({
  resolveD1DemoShotIdMock: vi.fn(),
}));
vi.mock("@/features/session/demoScenario", () => ({
  resolveD1DemoShotId: resolveD1DemoShotIdMock,
}));

import { DEMO_ROLE_COOKIE } from "@/lib/demoIdentity";
import { enterDemoRole, exitRoleView } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
  resolveD1DemoShotIdMock.mockResolvedValue("11111111-1111-1111-1111-111111111111");
});

describe("enterDemoRole", () => {
  it("sets the session-scoped, httpOnly role cookie and redirects to /vfx for vfx_supervisor", async () => {
    await expect(enterDemoRole("vfx_supervisor")).rejects.toThrow();
    expect(cookieStore.set).toHaveBeenCalledWith(
      DEMO_ROLE_COOKIE,
      "vfx_supervisor",
      expect.objectContaining({ httpOnly: true }),
    );
    // No maxAge/expires -- session-scoped.
    expect(cookieStore.set.mock.calls[0][2]).not.toHaveProperty("maxAge");
    expect(cookieStore.set.mock.calls[0][2]).not.toHaveProperty("expires");
    expect(redirectSpy).toHaveBeenCalledWith("/vfx");
  });

  it("redirects to /cg for cg_supervisor", async () => {
    await expect(enterDemoRole("cg_supervisor")).rejects.toThrow();
    expect(redirectSpy).toHaveBeenCalledWith("/cg");
  });

  it("redirects to /artist for artist", async () => {
    await expect(enterDemoRole("artist")).rejects.toThrow();
    expect(redirectSpy).toHaveBeenCalledWith("/artist");
  });

  it("is deterministic across repeated calls for the same role", async () => {
    await expect(enterDemoRole("vfx_supervisor")).rejects.toThrow();
    const firstCall = cookieStore.set.mock.calls[0];

    vi.clearAllMocks();
    resolveD1DemoShotIdMock.mockResolvedValue("11111111-1111-1111-1111-111111111111");

    await expect(enterDemoRole("vfx_supervisor")).rejects.toThrow();
    const secondCall = cookieStore.set.mock.calls[0];

    expect(firstCall).toEqual(secondCall);
  });

  it("ensures the generic development seed data before landing on the VFX Workspace (Step 7C-1)", async () => {
    await expect(enterDemoRole("vfx_supervisor")).rejects.toThrow();
    expect(resolveD1DemoShotIdMock).toHaveBeenCalled();
    // Destination is unchanged -- still the Workspace, never a resolved shot.
    expect(redirectSpy).toHaveBeenCalledWith("/vfx");
  });

  it("still reaches /vfx even when ensuring the seed data fails (best-effort, destination unchanged)", async () => {
    resolveD1DemoShotIdMock.mockRejectedValue(new Error("unavailable"));
    await expect(enterDemoRole("vfx_supervisor")).rejects.toThrow();
    expect(redirectSpy).toHaveBeenCalledWith("/vfx");
  });

  it("also ensures the generic development seed data before landing on the CG Workspace (Step 7C-4)", async () => {
    await expect(enterDemoRole("cg_supervisor")).rejects.toThrow();
    expect(resolveD1DemoShotIdMock).toHaveBeenCalled();
    expect(redirectSpy).toHaveBeenCalledWith("/cg");
  });

  it("still reaches /cg even when ensuring the seed data fails (best-effort, destination unchanged)", async () => {
    resolveD1DemoShotIdMock.mockRejectedValue(new Error("unavailable"));
    await expect(enterDemoRole("cg_supervisor")).rejects.toThrow();
    expect(redirectSpy).toHaveBeenCalledWith("/cg");
  });

  it("does not attempt to ensure any seed data for artist", async () => {
    await expect(enterDemoRole("artist")).rejects.toThrow();
    expect(resolveD1DemoShotIdMock).not.toHaveBeenCalled();
  });

  it("redirects to / for an invalid role", async () => {
    // @ts-expect-error -- deliberately invalid input
    await expect(enterDemoRole("producer")).rejects.toThrow();
    expect(redirectSpy).toHaveBeenCalledWith("/");
  });
});

describe("exitRoleView", () => {
  it("clears the role cookie and redirects to / (Step 7C-1 Role-selection Home)", async () => {
    await expect(exitRoleView()).rejects.toThrow();
    expect(cookieStore.delete).toHaveBeenCalledWith(DEMO_ROLE_COOKIE);
    expect(redirectSpy).toHaveBeenCalledWith("/");
  });
});
