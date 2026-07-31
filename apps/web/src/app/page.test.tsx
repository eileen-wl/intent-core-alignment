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

describe("/ Home page (Step 7C-1 locked IA §1)", () => {
  it("renders the Role-selection Home when no role session exists", async () => {
    cookieStore.get.mockReturnValue(undefined);
    const result = await HomePage();
    expect(result.type).toBe(RoleSelectionHome);
  });

  it("redirects straight to the role's workspace when a valid role session already exists", async () => {
    cookieStore.get.mockReturnValue({ value: "vfx_supervisor" });
    await expect(HomePage()).rejects.toThrow();
    expect(redirectSpy).toHaveBeenCalledWith("/vfx");
  });

  it("renders the Role-selection Home rather than redirecting for a garbage/invalid cookie value", async () => {
    cookieStore.get.mockReturnValue({ value: "not-a-real-role" });
    const result = await HomePage();
    expect(result.type).toBe(RoleSelectionHome);
    expect(redirectSpy).not.toHaveBeenCalled();
  });
});
