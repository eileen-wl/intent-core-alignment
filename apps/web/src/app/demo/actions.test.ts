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

import { DEMO_ROLE_COOKIE } from "@/lib/demoIdentity";
import { enterDemoRole, exitRoleView } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
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

    await expect(enterDemoRole("vfx_supervisor")).rejects.toThrow();
    const secondCall = cookieStore.set.mock.calls[0];

    expect(firstCall).toEqual(secondCall);
  });

  it("redirects to / for an invalid role", async () => {
    // @ts-expect-error -- deliberately invalid input
    await expect(enterDemoRole("producer")).rejects.toThrow();
    expect(redirectSpy).toHaveBeenCalledWith("/");
  });

  it("redirects to a returnTo that matches the entered role's own prefix", async () => {
    await expect(
      enterDemoRole("cg_supervisor", "/cg/tasks/t1/execution"),
    ).rejects.toThrow();
    expect(redirectSpy).toHaveBeenCalledWith("/cg/tasks/t1/execution");
  });

  it("falls back to the role home when returnTo belongs to a different role", async () => {
    await expect(
      enterDemoRole("cg_supervisor", "/vfx/shots/s1/intent"),
    ).rejects.toThrow();
    expect(redirectSpy).toHaveBeenCalledWith("/cg");
  });

  it("falls back to the role home when returnTo is an absolute URL (open-redirect guard)", async () => {
    await expect(
      enterDemoRole("cg_supervisor", "https://evil.example/cg"),
    ).rejects.toThrow();
    expect(redirectSpy).toHaveBeenCalledWith("/cg");
  });

  it("falls back to the role home when returnTo is protocol-relative (open-redirect guard)", async () => {
    await expect(
      enterDemoRole("cg_supervisor", "//evil.example/cg"),
    ).rejects.toThrow();
    expect(redirectSpy).toHaveBeenCalledWith("/cg");
  });

  it("falls back to the role home when returnTo is omitted", async () => {
    await expect(enterDemoRole("cg_supervisor")).rejects.toThrow();
    expect(redirectSpy).toHaveBeenCalledWith("/cg");
  });
});

describe("exitRoleView", () => {
  it("clears the role cookie and redirects to / (Step 7C-1 Role-selection Home)", async () => {
    await expect(exitRoleView()).rejects.toThrow();
    expect(cookieStore.delete).toHaveBeenCalledWith(DEMO_ROLE_COOKIE);
    expect(redirectSpy).toHaveBeenCalledWith("/");
  });
});
