import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

let mockPathname = "/vfx";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

let mockLinkPending = false;
vi.mock("next/link", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/link")>();
  return {
    ...actual,
    useLinkStatus: () => ({ pending: mockLinkPending }),
  };
});

import { RoleSidebar } from "./RoleSidebar";
import { ROLE_SIDEBAR_ITEMS } from "@/lib/roleNavigation";

afterEach(() => {
  cleanup();
  mockLinkPending = false;
});

describe("RoleSidebar", () => {
  it("renders the current item as a link with aria-current", () => {
    mockPathname = "/vfx";
    render(<RoleSidebar items={ROLE_SIDEBAR_ITEMS.vfx_supervisor} />);
    const current = screen.getByRole("link", { name: "Workspace Home" });
    expect(current).toHaveAttribute("aria-current", "page");
    expect(current).toHaveAttribute("href", "/vfx");
  });

  it("does not mark a non-current implemented item as current", () => {
    mockPathname = "/vfx";
    render(<RoleSidebar items={ROLE_SIDEBAR_ITEMS.vfx_supervisor} />);
    expect(
      screen.getByRole("link", { name: "Review Inbox" }),
    ).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Shots" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("never lets /vfx boundary-prefix-match every VFX page (Step 7C-1 locked IA §6)", () => {
    mockPathname = "/vfx/shots";
    render(<RoleSidebar items={ROLE_SIDEBAR_ITEMS.vfx_supervisor} />);
    expect(screen.getByRole("link", { name: "Shots" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: "Workspace Home" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("keeps Shots active for every /vfx/shots/[shotId] secondary page", () => {
    mockPathname = "/vfx/shots/s1/intent";
    render(<RoleSidebar items={ROLE_SIDEBAR_ITEMS.vfx_supervisor} />);
    expect(screen.getByRole("link", { name: "Shots" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: "Workspace Home" }),
    ).not.toHaveAttribute("aria-current");
    expect(
      screen.getByRole("link", { name: "Review Inbox" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("marks Review Inbox current for /vfx/inbox, distinct from Workspace Home and Shots", () => {
    mockPathname = "/vfx/inbox";
    render(<RoleSidebar items={ROLE_SIDEBAR_ITEMS.vfx_supervisor} />);
    expect(screen.getByRole("link", { name: "Review Inbox" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: "Workspace Home" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("renders unimplemented items as disabled, non-navigable placeholders", () => {
    // No real role has an unimplemented sidebar item any more (VFX, CG,
    // and Artist are all fully built) -- this is the component's own
    // generic placeholder-rendering contract, exercised with a synthetic
    // fixture rather than a real role's item list.
    mockPathname = "/artist";
    render(
      <RoleSidebar
        items={[
          {
            id: "workspace-home",
            label: "Workspace Home",
            href: "/artist",
            implemented: true,
          },
          {
            id: "future-page",
            label: "Future Page",
            href: "/artist/future",
            implemented: false,
          },
        ]}
      />,
    );
    expect(
      screen.queryByRole("link", { name: "Future Page" }),
    ).not.toBeInTheDocument();
    const placeholder = screen.getByText("Future Page");
    expect(placeholder).toHaveAttribute("aria-disabled", "true");
    expect(screen.getAllByText("Upcoming").length).toBeGreaterThan(0);
  });

  it("renders the correct locked item set for each role", () => {
    mockPathname = "/vfx";
    const { unmount } = render(
      <RoleSidebar items={ROLE_SIDEBAR_ITEMS.vfx_supervisor} />,
    );
    expect(screen.getByRole("link", { name: "Workspace Home" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Review Inbox" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Shots" })).toBeVisible();
    unmount();

    mockPathname = "/cg";
    const cg = render(<RoleSidebar items={ROLE_SIDEBAR_ITEMS.cg_supervisor} />);
    expect(screen.getByRole("link", { name: "Workspace Home" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Review Inbox" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Tasks" })).toBeVisible();
    cg.unmount();

    mockPathname = "/artist";
    render(<RoleSidebar items={ROLE_SIDEBAR_ITEMS.artist} />);
    expect(screen.getByRole("link", { name: "Workspace Home" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Review Inbox" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Tasks" })).toBeVisible();
  });

  it("exposes an accessible navigation landmark", () => {
    mockPathname = "/artist";
    render(<RoleSidebar items={ROLE_SIDEBAR_ITEMS.artist} />);
    expect(
      screen.getByRole("navigation", { name: "Role navigation" }),
    ).toBeVisible();
  });

  it("gives a clicked, not-yet-current item its own pending acknowledgement, distinct from the active-selection treatment", () => {
    mockPathname = "/vfx";
    mockLinkPending = true;
    render(<RoleSidebar items={ROLE_SIDEBAR_ITEMS.vfx_supervisor} />);

    const shots = screen.getByRole("link", { name: /^Shots/ });
    // Pending is secondary/temporary, never the same signal as current
    // selection: the clicked item must not gain `aria-current`/
    // `data-current` just because its own navigation is in flight.
    expect(shots).not.toHaveAttribute("aria-current");
    expect(shots).not.toHaveAttribute("data-current");
    expect(screen.getAllByText("Loading Shots…").length).toBeGreaterThan(0);
  });
});
