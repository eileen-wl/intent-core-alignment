import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ROLE_SIDEBAR_ITEMS } from "@/lib/roleNavigation";
import { AppShell } from "./AppShell";

afterEach(() => {
  cleanup();
});

describe("AppShell", () => {
  it("composes the top bar, role sidebar, and main content region", () => {
    render(
      <AppShell
        name="Maya Chen"
        role="VFX Supervisor"
        onExitRole={vi.fn()}
        sidebarItems={ROLE_SIDEBAR_ITEMS.vfx_supervisor}
        currentPath="/vfx"
      >
        <h1>Workspace Home</h1>
      </AppShell>,
    );

    expect(screen.getByText("ICAS")).toBeVisible();
    expect(
      screen.getByRole("navigation", { name: "Role navigation" }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Workspace Home" }),
    ).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("main")).toBeVisible();
    expect(
      screen.getByRole("heading", { level: 1, name: "Workspace Home" }),
    ).toBeVisible();
  });

  it("renders exactly one main landmark", () => {
    render(
      <AppShell
        name="Maya Chen"
        role="VFX Supervisor"
        onExitRole={vi.fn()}
        sidebarItems={ROLE_SIDEBAR_ITEMS.vfx_supervisor}
        currentPath="/vfx"
      >
        <p>Content</p>
      </AppShell>,
    );
    expect(screen.getAllByRole("main")).toHaveLength(1);
  });
});
