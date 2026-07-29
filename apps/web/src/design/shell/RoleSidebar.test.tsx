import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { RoleSidebar } from "./RoleSidebar";
import { ROLE_SIDEBAR_ITEMS } from "@/lib/roleNavigation";

afterEach(() => {
  cleanup();
});

describe("RoleSidebar", () => {
  it("renders the current item as a link with aria-current", () => {
    render(
      <RoleSidebar
        items={ROLE_SIDEBAR_ITEMS.vfx_supervisor}
        currentPath="/vfx"
      />,
    );
    const current = screen.getByRole("link", { name: "Alignment Inbox" });
    expect(current).toHaveAttribute("aria-current", "page");
    expect(current).toHaveAttribute("href", "/vfx");
  });

  it("does not mark a non-current implemented item as current", () => {
    render(
      <RoleSidebar
        items={ROLE_SIDEBAR_ITEMS.vfx_supervisor}
        currentPath="/vfx"
      />,
    );
    const current = screen.getByRole("link", { name: "Alignment Inbox" });
    expect(current).toHaveAttribute("aria-current", "page");
  });

  it("renders unimplemented items as disabled, non-navigable placeholders", () => {
    render(
      <RoleSidebar
        items={ROLE_SIDEBAR_ITEMS.vfx_supervisor}
        currentPath="/vfx"
      />,
    );
    expect(
      screen.queryByRole("link", { name: "Projects" }),
    ).not.toBeInTheDocument();
    const projects = screen.getByText("Projects");
    expect(projects).toHaveAttribute("aria-disabled", "true");
    expect(screen.getAllByText("Upcoming").length).toBeGreaterThan(0);
  });

  it("renders the correct locked item set for each role", () => {
    const { unmount } = render(
      <RoleSidebar
        items={ROLE_SIDEBAR_ITEMS.cg_supervisor}
        currentPath="/cg"
      />,
    );
    expect(screen.getByRole("link", { name: "Execution Inbox" })).toBeVisible();
    expect(screen.getByText("Tasks")).toBeVisible();
    unmount();

    render(
      <RoleSidebar items={ROLE_SIDEBAR_ITEMS.artist} currentPath="/artist" />,
    );
    expect(screen.getByRole("link", { name: "My Tasks" })).toBeVisible();
    expect(screen.getByText("Intent Signals")).toBeVisible();
  });

  it("exposes an accessible navigation landmark", () => {
    render(
      <RoleSidebar items={ROLE_SIDEBAR_ITEMS.artist} currentPath="/artist" />,
    );
    expect(
      screen.getByRole("navigation", { name: "Role navigation" }),
    ).toBeVisible();
  });
});
