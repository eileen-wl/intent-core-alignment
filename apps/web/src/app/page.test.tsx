import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieStore = { get: vi.fn() };
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

const redirectSpy = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (destination: string) => {
    redirectSpy(destination);
    throw new Error(`NEXT_REDIRECT:${destination}`);
  },
}));

import { RoleSelectionHome } from "./RoleSelectionHome";
import HomePage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
});

function callHomePage(returnTo?: string) {
  return HomePage({
    searchParams: Promise.resolve(returnTo ? { returnTo } : {}),
  });
}

describe("/ Home page (Step 7C-1 locked IA §1)", () => {
  it("renders the Role-selection Home when no role session exists", async () => {
    cookieStore.get.mockReturnValue(undefined);
    const result = await callHomePage();
    expect(result.type).toBe(RoleSelectionHome);
  });

  it("redirects straight to the role's workspace when a valid role session already exists", async () => {
    cookieStore.get.mockReturnValue({ value: "vfx_supervisor" });
    await expect(callHomePage()).rejects.toThrow();
    expect(redirectSpy).toHaveBeenCalledWith("/vfx");
  });

  it("renders the Role-selection Home rather than redirecting for a garbage/invalid cookie value", async () => {
    cookieStore.get.mockReturnValue({ value: "not-a-real-role" });
    const result = await callHomePage();
    expect(result.type).toBe(RoleSelectionHome);
    expect(redirectSpy).not.toHaveBeenCalled();
  });

  it("honors a returnTo matching the existing role session's own prefix", async () => {
    cookieStore.get.mockReturnValue({ value: "cg_supervisor" });
    await expect(callHomePage("/cg/tasks/t1/execution")).rejects.toThrow();
    expect(redirectSpy).toHaveBeenCalledWith("/cg/tasks/t1/execution");
  });

  it("shows the Role-selection Home (not a silent bounce to the active role's home) for a returnTo belonging to a different role", async () => {
    cookieStore.get.mockReturnValue({ value: "vfx_supervisor" });
    const result = await callHomePage("/cg/tasks/t1/execution");
    expect(redirectSpy).not.toHaveBeenCalled();
    expect(result.type).toBe(RoleSelectionHome);
    expect(result.props.returnTo).toBe("/cg/tasks/t1/execution");
  });

  it("ignores an absolute-URL returnTo (open-redirect guard)", async () => {
    cookieStore.get.mockReturnValue({ value: "vfx_supervisor" });
    await expect(callHomePage("https://evil.example/steal")).rejects.toThrow();
    expect(redirectSpy).toHaveBeenCalledWith("/vfx");
  });

  it("ignores a protocol-relative returnTo (open-redirect guard)", async () => {
    cookieStore.get.mockReturnValue({ value: "vfx_supervisor" });
    await expect(callHomePage("//evil.example/steal")).rejects.toThrow();
    expect(redirectSpy).toHaveBeenCalledWith("/vfx");
  });

  it("passes a safe returnTo through to the Role-selection Home when no session exists", async () => {
    cookieStore.get.mockReturnValue(undefined);
    const result = await callHomePage("/cg/tasks/t1/execution");
    expect(result.type).toBe(RoleSelectionHome);
    expect(result.props.returnTo).toBe("/cg/tasks/t1/execution");
  });

  it("does not pass an unsafe returnTo through to the Role-selection Home", async () => {
    cookieStore.get.mockReturnValue(undefined);
    const result = await callHomePage("https://evil.example/steal");
    expect(result.type).toBe(RoleSelectionHome);
    expect(result.props.returnTo).toBeNull();
  });
});
