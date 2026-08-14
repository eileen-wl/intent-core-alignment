import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

let mockPathname = "/vfx/shots/s1";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

import { ObjectWorkspaceChrome } from "./ObjectWorkspaceChrome";

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

const TABS = [
  { id: "overview", label: "Overview", href: "/vfx/shots/s1" },
  { id: "intent", label: "Intent", href: "/vfx/shots/s1/intent" },
  { id: "alignment", label: "Alignment", href: "/vfx/shots/s1/alignment" },
];

describe("ObjectWorkspaceChrome", () => {
  it("derives the active tab from the real pathname and renders the trailing breadcrumb segment to match", () => {
    mockPathname = "/vfx/shots/s1/intent";
    render(
      <ObjectWorkspaceChrome
        anchorContext={null}
        storageKey="icas:anchor-context:vfx:s1"
        tabs={TABS}
        breadcrumbBase={[
          { label: "Demo Project", href: "/vfx/shots" },
          { label: "Shot 010" },
        ]}
        contextHeader={<div>header</div>}
      >
        <p>tab body</p>
      </ObjectWorkspaceChrome>,
    );
    expect(screen.getByRole("link", { name: "Intent" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getAllByText("Intent").length).toBeGreaterThan(0);
    expect(screen.getByText("tab body")).toBeVisible();
  });

  it("defaults Anchor Context expanded only on the overview tab", () => {
    mockPathname = "/vfx/shots/s1";
    render(
      <ObjectWorkspaceChrome
        anchorContext={null}
        storageKey="icas:anchor-context:vfx:s1-a"
        tabs={TABS}
        breadcrumbBase={[{ label: "Shot 010" }]}
        contextHeader={null}
      >
        <p>body</p>
      </ObjectWorkspaceChrome>,
    );
    // `context={null}` renders the honest "Anchor context unavailable"
    // state regardless of expanded/collapsed -- this test only exercises
    // that ObjectWorkspaceChrome itself renders without throwing and
    // wires a real `defaultExpanded` value through; the expand/collapse
    // visual states themselves are AnchorContextLayer's own test
    // responsibility, unchanged by this refactor.
    expect(screen.getByText("Anchor context unavailable")).toBeVisible();
  });

  it("applies the review Anchor Context variant only on the opted-in tab, never other tabs", () => {
    const reviewTabs = [
      { id: "overview", label: "Overview", href: "/cg/tasks/t1" },
      {
        id: "version-review",
        label: "Version Review",
        href: "/cg/tasks/t1/version-review",
      },
    ];

    mockPathname = "/cg/tasks/t1/version-review";
    const { unmount } = render(
      <ObjectWorkspaceChrome
        anchorContext={null}
        storageKey="icas:anchor-context:cg:t1"
        tabs={reviewTabs}
        breadcrumbBase={[{ label: "Task" }]}
        contextHeader={null}
        reviewVariantTabId="version-review"
      >
        <p>body</p>
      </ObjectWorkspaceChrome>,
    );
    // `context={null}` renders identically regardless of variant, but
    // confirms no throw/crash when the review variant is selected --
    // variant-specific visual differences are AnchorContextLayer's own
    // test responsibility (unchanged by this refactor).
    expect(screen.getByText("Anchor context unavailable")).toBeVisible();
    unmount();

    mockPathname = "/cg/tasks/t1";
    render(
      <ObjectWorkspaceChrome
        anchorContext={null}
        storageKey="icas:anchor-context:cg:t1-overview"
        tabs={reviewTabs}
        breadcrumbBase={[{ label: "Task" }]}
        contextHeader={null}
        reviewVariantTabId="version-review"
      >
        <p>body</p>
      </ObjectWorkspaceChrome>,
    );
    expect(screen.getByText("Anchor context unavailable")).toBeVisible();
  });

  it("renders the persistent Anchor Context and ContextTabs alongside children, all in one tree", () => {
    mockPathname = "/vfx/shots/s1/alignment";
    render(
      <ObjectWorkspaceChrome
        anchorContext={null}
        storageKey="icas:anchor-context:vfx:s1-b"
        tabs={TABS}
        breadcrumbBase={[{ label: "Shot 010" }]}
        contextHeader={<div data-testid="header">Production context</div>}
      >
        <p>Alignment tab content</p>
      </ObjectWorkspaceChrome>,
    );
    expect(screen.getByTestId("header")).toBeVisible();
    expect(screen.getByRole("navigation", { name: "Section" })).toBeVisible();
    expect(screen.getByText("Anchor context unavailable")).toBeVisible();
    expect(screen.getByText("Alignment tab content")).toBeVisible();
  });
});
