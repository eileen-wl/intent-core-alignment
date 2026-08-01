import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ContextTabs } from "./ContextTabs";

afterEach(() => {
  cleanup();
});

const TABS = [
  { id: "overview", label: "Overview", href: "/vfx/shots/s1" },
  { id: "intent", label: "Intent", href: "/vfx/shots/s1/intent" },
  { id: "alignment", label: "Alignment", href: "/vfx/shots/s1/alignment" },
];

describe("ContextTabs", () => {
  it("renders every tab as a route-backed link", () => {
    render(<ContextTabs tabs={TABS} activeTabId="overview" />);
    for (const tab of TABS) {
      expect(screen.getByRole("link", { name: tab.label })).toHaveAttribute(
        "href",
        tab.href,
      );
    }
  });

  it("marks only the active tab as current", () => {
    render(<ContextTabs tabs={TABS} activeTabId="intent" />);
    expect(screen.getByRole("link", { name: "Intent" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.getByRole("link", { name: "Alignment" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("exposes an accessible section navigation landmark", () => {
    render(<ContextTabs tabs={TABS} activeTabId="overview" />);
    expect(screen.getByRole("navigation", { name: "Section" })).toBeVisible();
  });

  it("renders an unimplemented tab as a disabled, non-navigable 'Upcoming' placeholder", () => {
    const tabs = [
      ...TABS,
      {
        id: "activity",
        label: "Activity",
        href: "/vfx/shots/s1/activity",
        implemented: false,
      },
    ];
    render(<ContextTabs tabs={tabs} activeTabId="overview" />);
    expect(
      screen.queryByRole("link", { name: "Activity" }),
    ).not.toBeInTheDocument();
    const label = screen.getByText("Activity");
    expect(label).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Upcoming")).toBeVisible();
  });
});
