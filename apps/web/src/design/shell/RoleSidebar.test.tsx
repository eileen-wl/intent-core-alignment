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
    const current = screen.getByRole("link", { name: "Workspace Home" });
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
    expect(
      screen.getByRole("link", { name: "Review Inbox" }),
    ).not.toHaveAttribute("aria-current");
    expect(
      screen.getByRole("link", { name: "Shots" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("never lets /vfx boundary-prefix-match every VFX page (Step 7C-1 locked IA §6)", () => {
    render(
      <RoleSidebar
        items={ROLE_SIDEBAR_ITEMS.vfx_supervisor}
        currentPath="/vfx/shots"
      />,
    );
    expect(
      screen.getByRole("link", { name: "Shots" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("link", { name: "Workspace Home" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("keeps Shots active for every /vfx/shots/[shotId] secondary page", () => {
    render(
      <RoleSidebar
        items={ROLE_SIDEBAR_ITEMS.vfx_supervisor}
        currentPath="/vfx/shots/s1/intent"
      />,
    );
    expect(
      screen.getByRole("link", { name: "Shots" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("link", { name: "Workspace Home" }),
    ).not.toHaveAttribute("aria-current");
    expect(
      screen.getByRole("link", { name: "Review Inbox" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("marks Review Inbox current for /vfx/inbox, distinct from Workspace Home and Shots", () => {
    render(
      <RoleSidebar
        items={ROLE_SIDEBAR_ITEMS.vfx_supervisor}
        currentPath="/vfx/inbox"
      />,
    );
    expect(
      screen.getByRole("link", { name: "Review Inbox" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("link", { name: "Workspace Home" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("renders unimplemented items as disabled, non-navigable placeholders", () => {
    render(
      <RoleSidebar
        items={ROLE_SIDEBAR_ITEMS.cg_supervisor}
        currentPath="/cg"
      />,
    );
    expect(
      screen.queryByRole("link", { name: "Tasks" }),
    ).not.toBeInTheDocument();
    const tasks = screen.getByText("Tasks");
    expect(tasks).toHaveAttribute("aria-disabled", "true");
    expect(screen.getAllByText("Upcoming").length).toBeGreaterThan(0);
  });

  it("renders the correct locked item set for each role", () => {
    const { unmount } = render(
      <RoleSidebar
        items={ROLE_SIDEBAR_ITEMS.vfx_supervisor}
        currentPath="/vfx"
      />,
    );
    expect(screen.getByRole("link", { name: "Workspace Home" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Review Inbox" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Shots" })).toBeVisible();
    unmount();

    const cg = render(
      <RoleSidebar
        items={ROLE_SIDEBAR_ITEMS.cg_supervisor}
        currentPath="/cg"
      />,
    );
    expect(screen.getByRole("link", { name: "Execution Inbox" })).toBeVisible();
    expect(screen.getByText("Tasks")).toBeVisible();
    cg.unmount();

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
