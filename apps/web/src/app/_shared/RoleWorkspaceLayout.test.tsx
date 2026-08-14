import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectSpy = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (destination: string) => {
    redirectSpy(destination);
    throw new Error(`NEXT_REDIRECT:${destination}`);
  },
  usePathname: () => "/vfx",
}));

const { resolveIdentityMock } = vi.hoisted(() => ({
  resolveIdentityMock: vi.fn(),
}));
vi.mock("@/features/session/identity", () => ({
  resolveIdentity: resolveIdentityMock,
}));

vi.mock("../demo/actions", () => ({
  exitRoleView: vi.fn(),
}));

import { RoleWorkspaceLayout } from "./RoleWorkspaceLayout";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RoleWorkspaceLayout", () => {
  it("redirects to / when the resolved identity's role does not match", async () => {
    resolveIdentityMock.mockResolvedValue({
      role: "cg_supervisor",
      actorId: "cg-1",
      displayName: "Daniel Ross",
    });

    await expect(
      RoleWorkspaceLayout({
        role: "vfx_supervisor",
        children: <p>content</p>,
      }),
    ).rejects.toThrow("NEXT_REDIRECT:/");
    expect(redirectSpy).toHaveBeenCalledWith("/");
  });

  it("redirects to / when no identity is resolved at all", async () => {
    resolveIdentityMock.mockResolvedValue(null);

    await expect(
      RoleWorkspaceLayout({
        role: "artist",
        children: <p>content</p>,
      }),
    ).rejects.toThrow("NEXT_REDIRECT:/");
  });

  it("renders AppShell with the resolved role's identity, sidebar, and the given children when the role matches", async () => {
    resolveIdentityMock.mockResolvedValue({
      role: "vfx_supervisor",
      actorId: "vfx-1",
      displayName: "Maya Chen",
    });

    const element = await RoleWorkspaceLayout({
      role: "vfx_supervisor",
      children: <h1>Workspace Home</h1>,
    });
    render(element);

    expect(screen.getByText("ICAS")).toBeVisible();
    expect(
      screen.getByRole("navigation", { name: "Role navigation" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Shots" })).toBeVisible();
    expect(
      screen.getByRole("heading", { level: 1, name: "Workspace Home" }),
    ).toBeVisible();
  });
});
