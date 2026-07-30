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
import { enterDemoRole, exitRoleView, startGuidedDemonstration } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("enterDemoRole", () => {
  it("sets the session-scoped, httpOnly Demo cookie and redirects to /vfx for vfx_supervisor", async () => {
    await expect(enterDemoRole("vfx_supervisor")).rejects.toThrow();
    expect(cookieStore.set).toHaveBeenCalledWith(
      DEMO_ROLE_COOKIE,
      "vfx_supervisor",
      expect.objectContaining({ httpOnly: true }),
    );
    // No maxAge/expires -- session-scoped, matches docs/step-7's
    // "session-scoped Demo identity" requirement.
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

  it("uses the identical mechanism for the guided-demo role and a direct role entry", async () => {
    await expect(enterDemoRole("vfx_supervisor")).rejects.toThrow();
    const firstCall = cookieStore.set.mock.calls[0];

    vi.clearAllMocks();

    await expect(enterDemoRole("vfx_supervisor")).rejects.toThrow();
    const secondCall = cookieStore.set.mock.calls[0];

    expect(firstCall).toEqual(secondCall);
  });
});

describe("startGuidedDemonstration", () => {
  it("sets the VFX Supervisor Demo cookie and redirects to the resolved D1 Shot", async () => {
    resolveD1DemoShotIdMock.mockResolvedValue("11111111-1111-1111-1111-111111111111");

    await expect(startGuidedDemonstration()).rejects.toThrow();

    expect(cookieStore.set).toHaveBeenCalledWith(
      DEMO_ROLE_COOKIE,
      "vfx_supervisor",
      expect.objectContaining({ httpOnly: true }),
    );
    expect(redirectSpy).toHaveBeenCalledWith(
      "/vfx/shots/11111111-1111-1111-1111-111111111111",
    );
  });

  it("redirects back to /demo with an honest error when resolution fails", async () => {
    resolveD1DemoShotIdMock.mockRejectedValue(new Error("unavailable"));

    await expect(startGuidedDemonstration()).rejects.toThrow();

    expect(redirectSpy).toHaveBeenCalledWith("/demo?guidedError=1");
    // Identity is still established before the failure -- a retry via
    // the direct role card would work even if the guided path failed.
    expect(cookieStore.set).toHaveBeenCalledWith(
      DEMO_ROLE_COOKIE,
      "vfx_supervisor",
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it("never redirects to a raw UUID-bearing route without resolving it first", async () => {
    resolveD1DemoShotIdMock.mockResolvedValue("22222222-2222-2222-2222-222222222222");
    await expect(startGuidedDemonstration()).rejects.toThrow();
    expect(resolveD1DemoShotIdMock).toHaveBeenCalled();
  });
});

describe("exitRoleView", () => {
  it("clears the Demo cookie and redirects to /demo", async () => {
    await expect(exitRoleView()).rejects.toThrow();
    expect(cookieStore.delete).toHaveBeenCalledWith(DEMO_ROLE_COOKIE);
    expect(redirectSpy).toHaveBeenCalledWith("/demo");
  });
});
