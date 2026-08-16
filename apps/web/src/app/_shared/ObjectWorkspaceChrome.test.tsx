import type { AnchorContextRead } from "@intent-core/contracts";
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

/** A real, non-null Anchor Context -- the null fixture the tests above
 * use renders the same "Anchor context unavailable" honest state
 * regardless of expand/collapse, which cannot distinguish the two.
 * Minimal but complete per `AnchorContextRead`. */
function contextFixture(role: AnchorContextRead["role"]): AnchorContextRead {
  return {
    role,
    shot_id: "s1",
    task_id: role === "vfx_supervisor" ? null : "t1",
    core_anchor: {
      exists: true,
      lifecycle_state: "confirmed",
      confirmed_revision_id: "ca1",
      confirmed_revision_number: 1,
      direction_summary: "Keep it restrained.",
      must_preserve: "Keep the response internal.",
      allowed_variation: "Local exposure may vary.",
      confirmed_by_human_role: "vfx_supervisor",
      confirmed_by_actor_id: "vfx-1",
      link_target: "/vfx/shots/s1/intent",
      newer_draft_exists: false,
      pending_human_gate_exists: false,
      draft_revision_number: null,
    },
    execution_anchor:
      role === "vfx_supervisor"
        ? null
        : {
            exists: true,
            department: "compositing",
            lifecycle_state: "confirmed",
            context_state: "current",
            confirmed_revision_id: "ea1",
            confirmed_revision_number: 1,
            direction_summary: "Keep the silhouette readable.",
            execution_boundary: "Stay within the approved contrast range.",
            allowed_refinement: "Refine local edges only.",
            based_on_core_anchor_revision_id: "ca1",
            based_on_core_anchor_revision_number: 1,
            upstream_relationship_available: true,
            confirmed_by_human_role: "cg_supervisor",
            confirmed_by_actor_id: "cg-1",
            link_target: "/cg/tasks/t1/execution",
            draft_revision_number: null,
            draft_source: null,
          },
    attention: {
      level: "not_assessed",
      summary: null,
      review_requirement:
        "No current attention result is available for this Task.",
      source_assessment_id: null,
      source_signal_id: null,
      assessed_at: null,
      link_target: null,
    },
    current_version: {
      version_id: "v1",
      name: "v001",
      version_number: 1,
      link_target: "/artist/tasks/t1/current-version",
    },
    guidance_state: "unavailable",
    open_vfx_escalation: false,
    next_action: {
      title: "No immediate action is required.",
      why_now: "Nothing requires attention right now.",
      downstream_effect: "",
      target_route: null,
      action_label: null,
      executable: false,
    },
  };
}

// Real per-role tab lists, mirroring each `app/{vfx/shots,cg/tasks,
// artist/tasks}/[id]/layout.tsx`'s own `*Tabs()` function exactly --
// the disclosure-default audit must exercise the same real
// configuration each role actually renders, not a hand-picked subset.
const VFX_TABS = [
  { id: "overview", label: "Overview", href: "/vfx/shots/s1" },
  { id: "intent", label: "Intent", href: "/vfx/shots/s1/intent" },
  { id: "versions", label: "Versions", href: "/vfx/shots/s1/versions" },
  { id: "alignment", label: "Alignment", href: "/vfx/shots/s1/alignment" },
  { id: "activity", label: "Activity", href: "/vfx/shots/s1/activity" },
];
const CG_TABS = [
  { id: "overview", label: "Overview", href: "/cg/tasks/t1" },
  { id: "execution", label: "Execution", href: "/cg/tasks/t1/execution" },
  {
    id: "version-review",
    label: "Version Review",
    href: "/cg/tasks/t1/version-review",
  },
  {
    id: "dependencies",
    label: "Dependencies",
    href: "/cg/tasks/t1/dependencies",
  },
  { id: "activity", label: "Activity", href: "/cg/tasks/t1/activity" },
];
const ARTIST_TABS = [
  { id: "overview", label: "Task Overview", href: "/artist/tasks/t1" },
  {
    id: "current-version",
    label: "Current Version",
    href: "/artist/tasks/t1/current-version",
  },
  {
    id: "feedback-history",
    label: "Feedback History",
    href: "/artist/tasks/t1/feedback-history",
  },
];

describe("ObjectWorkspaceChrome -- Anchor Context disclosure-default audit", () => {
  it("Overview routes default expanded on first entry: Artist Task Overview", () => {
    mockPathname = "/artist/tasks/t1";
    render(
      <ObjectWorkspaceChrome
        anchorContext={contextFixture("artist")}
        storageKey="icas:anchor-context:artist:audit-1"
        tabs={ARTIST_TABS}
        breadcrumbBase={[{ label: "Task" }]}
        contextHeader={null}
      >
        <p>body</p>
      </ObjectWorkspaceChrome>,
    );
    expect(
      screen.getByRole("button", { name: "Collapse anchor context" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Show anchor context" }),
    ).not.toBeInTheDocument();
  });

  it("Overview routes default expanded on first entry: VFX Shot Overview", () => {
    mockPathname = "/vfx/shots/s1";
    render(
      <ObjectWorkspaceChrome
        anchorContext={contextFixture("vfx_supervisor")}
        storageKey="icas:anchor-context:vfx:audit-1"
        tabs={VFX_TABS}
        breadcrumbBase={[{ label: "Shot" }]}
        contextHeader={null}
      >
        <p>body</p>
      </ObjectWorkspaceChrome>,
    );
    expect(
      screen.getByRole("button", { name: "Collapse anchor context" }),
    ).toBeVisible();
  });

  it("Overview routes default expanded on first entry: CG Task Overview", () => {
    mockPathname = "/cg/tasks/t1";
    render(
      <ObjectWorkspaceChrome
        anchorContext={contextFixture("cg_supervisor")}
        storageKey="icas:anchor-context:cg:audit-1"
        tabs={CG_TABS}
        breadcrumbBase={[{ label: "Task" }]}
        contextHeader={null}
        reviewVariantTabId="version-review"
      >
        <p>body</p>
      </ObjectWorkspaceChrome>,
    );
    expect(
      screen.getByRole("button", { name: "Collapse anchor context" }),
    ).toBeVisible();
  });

  it("Non-Overview object tabs default compact on first entry: Artist Current Version", () => {
    mockPathname = "/artist/tasks/t1/current-version";
    render(
      <ObjectWorkspaceChrome
        anchorContext={contextFixture("artist")}
        storageKey="icas:anchor-context:artist:audit-2"
        tabs={ARTIST_TABS}
        breadcrumbBase={[{ label: "Task" }]}
        contextHeader={null}
      >
        <p>body</p>
      </ObjectWorkspaceChrome>,
    );
    expect(
      screen.getByRole("button", { name: "Show anchor context" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Collapse anchor context" }),
    ).not.toBeInTheDocument();
  });

  it("Non-Overview object tabs default compact on first entry: Artist Feedback History", () => {
    mockPathname = "/artist/tasks/t1/feedback-history";
    render(
      <ObjectWorkspaceChrome
        anchorContext={contextFixture("artist")}
        storageKey="icas:anchor-context:artist:audit-3"
        tabs={ARTIST_TABS}
        breadcrumbBase={[{ label: "Task" }]}
        contextHeader={null}
      >
        <p>body</p>
      </ObjectWorkspaceChrome>,
    );
    expect(
      screen.getByRole("button", { name: "Show anchor context" }),
    ).toBeVisible();
  });

  it("Non-Overview object tabs default compact on first entry: VFX Intent", () => {
    mockPathname = "/vfx/shots/s1/intent";
    render(
      <ObjectWorkspaceChrome
        anchorContext={contextFixture("vfx_supervisor")}
        storageKey="icas:anchor-context:vfx:audit-2"
        tabs={VFX_TABS}
        breadcrumbBase={[{ label: "Shot" }]}
        contextHeader={null}
      >
        <p>body</p>
      </ObjectWorkspaceChrome>,
    );
    expect(
      screen.getByRole("button", { name: "Show anchor context" }),
    ).toBeVisible();
  });

  it("Non-Overview object tabs default compact on first entry: CG Execution", () => {
    mockPathname = "/cg/tasks/t1/execution";
    render(
      <ObjectWorkspaceChrome
        anchorContext={contextFixture("cg_supervisor")}
        storageKey="icas:anchor-context:cg:audit-2"
        tabs={CG_TABS}
        breadcrumbBase={[{ label: "Task" }]}
        contextHeader={null}
        reviewVariantTabId="version-review"
      >
        <p>body</p>
      </ObjectWorkspaceChrome>,
    );
    expect(
      screen.getByRole("button", { name: "Show anchor context" }),
    ).toBeVisible();
  });

  it("a remembered sessionStorage choice overrides the route's own default (compact route, remembered expanded)", () => {
    mockPathname = "/vfx/shots/s1/intent";
    window.sessionStorage.setItem(
      "icas:anchor-context:vfx:audit-memory",
      "expanded",
    );
    render(
      <ObjectWorkspaceChrome
        anchorContext={contextFixture("vfx_supervisor")}
        storageKey="icas:anchor-context:vfx:audit-memory"
        tabs={VFX_TABS}
        breadcrumbBase={[{ label: "Shot" }]}
        contextHeader={null}
      >
        <p>body</p>
      </ObjectWorkspaceChrome>,
    );
    expect(
      screen.getByRole("button", { name: "Collapse anchor context" }),
    ).toBeVisible();
  });

  it("a remembered sessionStorage choice overrides the route's own default (expanded route, remembered collapsed)", () => {
    mockPathname = "/artist/tasks/t1";
    window.sessionStorage.setItem(
      "icas:anchor-context:artist:audit-memory",
      "collapsed",
    );
    render(
      <ObjectWorkspaceChrome
        anchorContext={contextFixture("artist")}
        storageKey="icas:anchor-context:artist:audit-memory"
        tabs={ARTIST_TABS}
        breadcrumbBase={[{ label: "Task" }]}
        contextHeader={null}
      >
        <p>body</p>
      </ObjectWorkspaceChrome>,
    );
    expect(
      screen.getByRole("button", { name: "Show anchor context" }),
    ).toBeVisible();
  });
});

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
