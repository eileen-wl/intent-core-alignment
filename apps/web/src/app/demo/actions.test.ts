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

const { resolveD1DemoShotIdMock, resolveD1GuidedDemoShotIdMock } = vi.hoisted(() => ({
  resolveD1DemoShotIdMock: vi.fn(),
  resolveD1GuidedDemoShotIdMock: vi.fn(),
}));
vi.mock("@/features/session/demoScenario", () => ({
  resolveD1DemoShotId: resolveD1DemoShotIdMock,
  resolveD1GuidedDemoShotId: resolveD1GuidedDemoShotIdMock,
}));

import { DEMO_ROLE_COOKIE } from "@/lib/demoIdentity";
import { enterDemoRole, exitRoleView, startGuidedDemonstration } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
  resolveD1DemoShotIdMock.mockResolvedValue("11111111-1111-1111-1111-111111111111");
  resolveD1GuidedDemoShotIdMock.mockResolvedValue("22222222-2222-2222-2222-222222222222");
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
    resolveD1DemoShotIdMock.mockResolvedValue("11111111-1111-1111-1111-111111111111");

    await expect(enterDemoRole("vfx_supervisor")).rejects.toThrow();
    const secondCall = cookieStore.set.mock.calls[0];

    expect(firstCall).toEqual(secondCall);
  });

  it("ensures the rich D1 scenario before landing on the Alignment Inbox for vfx_supervisor (Step 7C-2)", async () => {
    await expect(enterDemoRole("vfx_supervisor")).rejects.toThrow();
    expect(resolveD1DemoShotIdMock).toHaveBeenCalled();
    expect(resolveD1GuidedDemoShotIdMock).not.toHaveBeenCalled();
    // Destination is unchanged -- still the Inbox, never the resolved shot.
    expect(redirectSpy).toHaveBeenCalledWith("/vfx");
  });

  it("still reaches /vfx even when ensuring the rich scenario fails (best-effort, destination unchanged)", async () => {
    resolveD1DemoShotIdMock.mockRejectedValue(new Error("unavailable"));
    await expect(enterDemoRole("vfx_supervisor")).rejects.toThrow();
    expect(redirectSpy).toHaveBeenCalledWith("/vfx");
  });

  it("does not attempt to ensure any D1 scenario for cg_supervisor or artist", async () => {
    await expect(enterDemoRole("cg_supervisor")).rejects.toThrow();
    expect(resolveD1DemoShotIdMock).not.toHaveBeenCalled();
  });
});

describe("startGuidedDemonstration", () => {
  it("sets the VFX Supervisor Demo cookie and redirects to the resolved Guided D1 Shot", async () => {
    resolveD1GuidedDemoShotIdMock.mockResolvedValue("33333333-3333-3333-3333-333333333333");

    await expect(startGuidedDemonstration()).rejects.toThrow();

    expect(cookieStore.set).toHaveBeenCalledWith(
      DEMO_ROLE_COOKIE,
      "vfx_supervisor",
      expect.objectContaining({ httpOnly: true }),
    );
    expect(redirectSpy).toHaveBeenCalledWith(
      "/vfx/shots/33333333-3333-3333-3333-333333333333",
    );
    // Step 7C-2: the guided walkthrough resolves the separate guided
    // Shot, never the rich/fully-seeded one.
    expect(resolveD1DemoShotIdMock).not.toHaveBeenCalled();
  });

  it("redirects back to /demo with an honest error when resolution fails", async () => {
    resolveD1GuidedDemoShotIdMock.mockRejectedValue(new Error("unavailable"));

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
    resolveD1GuidedDemoShotIdMock.mockResolvedValue("44444444-4444-4444-4444-444444444444");
    await expect(startGuidedDemonstration()).rejects.toThrow();
    expect(resolveD1GuidedDemoShotIdMock).toHaveBeenCalled();
  });
});

describe("exitRoleView", () => {
  it("clears the Demo cookie and redirects to /demo", async () => {
    await expect(exitRoleView()).rejects.toThrow();
    expect(cookieStore.delete).toHaveBeenCalledWith(DEMO_ROLE_COOKIE);
    expect(redirectSpy).toHaveBeenCalledWith("/demo");
  });
});
