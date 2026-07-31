import { describe, expect, it } from "vitest";

import { ROLE_SIDEBAR_ITEMS } from "./roleNavigation";

describe("ROLE_SIDEBAR_ITEMS.vfx_supervisor", () => {
  it("is exactly Workspace Home, Review Inbox, Shots -- Step 7C-1 locked IA §2", () => {
    expect(ROLE_SIDEBAR_ITEMS.vfx_supervisor).toEqual([
      { id: "workspace-home", label: "Workspace Home", href: "/vfx", implemented: true },
      { id: "review-inbox", label: "Review Inbox", href: "/vfx/inbox", implemented: true },
      { id: "shots", label: "Shots", href: "/vfx/shots", implemented: true },
    ]);
  });

  it("never includes the retired Alignment Inbox, Projects, Intent Signals, or Integrations entries", () => {
    const labels = ROLE_SIDEBAR_ITEMS.vfx_supervisor.map((item) => item.label);
    for (const retired of ["Alignment Inbox", "Projects", "Intent Signals", "Integrations"]) {
      expect(labels).not.toContain(retired);
    }
  });
});
