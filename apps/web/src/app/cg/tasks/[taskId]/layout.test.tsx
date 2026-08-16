import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let mockPathname = "/cg/tasks/t1";
const redirectSpy = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (destination: string) => {
    redirectSpy(destination);
    throw new Error(`NEXT_REDIRECT:${destination}`);
  },
  usePathname: () => mockPathname,
}));

const { resolveIdentityMock } = vi.hoisted(() => ({
  resolveIdentityMock: vi.fn(),
}));
vi.mock("@/features/session/identity", () => ({
  resolveIdentity: resolveIdentityMock,
  actorHeaders: () => ({
    "X-Actor-Role": "cg_supervisor",
    "X-Actor-Id": "cg-1",
  }),
}));

const { fetchCgInboxItemMock, fetchCgAnchorContextOrNullMock } = vi.hoisted(
  () => ({
    fetchCgInboxItemMock: vi.fn(),
    fetchCgAnchorContextOrNullMock: vi.fn(),
  }),
);
vi.mock("@/features/cg/api", () => ({
  fetchCgInboxItem: fetchCgInboxItemMock,
  fetchCgAnchorContextOrNull: fetchCgAnchorContextOrNullMock,
}));

import CgTaskLayout from "./layout";

const params = Promise.resolve({ taskId: "t1" });
const identity = {
  role: "cg_supervisor" as const,
  actorId: "cg-1",
  displayName: "Daniel Ross",
};

const item = {
  task_id: "t1",
  task_name: "Lighting Pass",
  shot_id: "s1",
  shot_name: "Shot 010",
  project_id: "p1",
  project_name: "D1 Demo Project",
};

const anchorContext = {
  role: "cg_supervisor" as const,
  shot_id: "s1",
  task_id: "t1",
  core_anchor: {
    exists: true,
    lifecycle_state: "confirmed" as const,
    confirmed_revision_id: "ca1",
    confirmed_revision_number: 1,
    direction_summary: "Keep the confrontation restrained.",
    must_preserve: "Keep the response internal.",
    allowed_variation: "Local exposure may vary.",
    confirmed_by_human_role: "vfx_supervisor" as const,
    confirmed_by_actor_id: "vfx-1",
    link_target: "/vfx/shots/s1/intent",
    newer_draft_exists: false,
    pending_human_gate_exists: false,
    draft_revision_number: null,
  },
  execution_anchor: {
    exists: true,
    department: "lighting",
    lifecycle_state: "confirmed" as const,
    context_state: "current" as const,
    confirmed_revision_id: "ea1",
    confirmed_revision_number: 1,
    direction_summary: "Keep faces readable without a heroic lift.",
    execution_boundary: "Stay within the approved exposure range.",
    allowed_refinement: "Refine local fill only.",
    based_on_core_anchor_revision_id: "ca1",
    based_on_core_anchor_revision_number: 1,
    upstream_relationship_available: true,
    confirmed_by_human_role: "cg_supervisor" as const,
    confirmed_by_actor_id: "cg-1",
    link_target: "/cg/tasks/t1/execution",
    draft_revision_number: null,
    draft_source: null,
  },
  attention: {
    level: "not_assessed" as const,
    summary: null,
    review_requirement: "No current attention result is available.",
    source_assessment_id: null,
    source_signal_id: null,
    assessed_at: null,
    link_target: null,
  },
  current_version: {
    version_id: "v1",
    name: "SH010_v001",
    version_number: 1,
    link_target: "/cg/tasks/t1/version-review",
  },
  guidance_state: "unavailable" as const,
  open_vfx_escalation: false,
  next_action: {
    title: "No immediate CG action",
    why_now: "Nothing is pending.",
    downstream_effect: "None.",
    target_route: "/cg/tasks/t1",
    action_label: null,
    executable: false,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPathname = "/cg/tasks/t1";
  resolveIdentityMock.mockResolvedValue(identity);
  fetchCgAnchorContextOrNullMock.mockResolvedValue(null);
});

afterEach(() => {
  cleanup();
});

describe("CgTaskLayout", () => {
  it("redirects to / when the resolved identity is not a cg_supervisor", async () => {
    resolveIdentityMock.mockResolvedValue({ ...identity, role: "artist" });

    await expect(
      CgTaskLayout({ params, children: <p>tab body</p> }),
    ).rejects.toThrow("NEXT_REDIRECT:/");
    expect(redirectSpy).toHaveBeenCalledWith("/");
  });

  it("shows an honest not-found state and never renders children when the Task does not exist", async () => {
    fetchCgInboxItemMock.mockResolvedValue(null);

    const element = await CgTaskLayout({ params, children: <p>tab body</p> });
    render(element);

    expect(screen.getByText("This Task could not be found")).toBeVisible();
    expect(screen.queryByText("tab body")).not.toBeInTheDocument();
  });

  it("renders the persistent chrome with the standard (non-review) Anchor Context variant on Overview", async () => {
    fetchCgInboxItemMock.mockResolvedValue(item);
    fetchCgAnchorContextOrNullMock.mockResolvedValue(anchorContext);
    mockPathname = "/cg/tasks/t1";

    const element = await CgTaskLayout({ params, children: <p>tab body</p> });
    render(element);

    for (const label of [
      "Overview",
      "Execution",
      "Version Review",
      "Dependencies",
      "Activity",
    ]) {
      expect(screen.getByRole("link", { name: label })).toBeVisible();
    }
    // The review variant's collapsed-state kicker/expand button
    // ("Show full context →") only ever renders under
    // `reviewVariantTabId`'s own route -- its absence here confirms the
    // standard variant, not the review one, is active on Overview.
    expect(screen.queryByText("Show full context →")).not.toBeInTheDocument();
    expect(screen.getByText("tab body")).toBeVisible();
  });

  it("applies the LOCKED review Anchor Context variant only on Version Review, never on other CG tabs", async () => {
    fetchCgInboxItemMock.mockResolvedValue(item);
    fetchCgAnchorContextOrNullMock.mockResolvedValue(anchorContext);
    mockPathname = "/cg/tasks/t1/version-review";

    const element = await CgTaskLayout({ params, children: <p>tab body</p> });
    render(element);

    expect(
      screen.getByRole("link", { name: "Version Review" }),
    ).toHaveAttribute("aria-current", "page");
    // The review variant's own collapsed-state control -- confirms this
    // route, and only this route, received `variant="review"`.
    expect(screen.getByText("Show full context →")).toBeVisible();
    expect(screen.getByText("tab body")).toBeVisible();
  });

  it("fetches the Task identity and Anchor Context exactly once per render, not once per tab", async () => {
    fetchCgInboxItemMock.mockResolvedValue(item);

    await CgTaskLayout({ params, children: <p>tab body</p> });

    expect(fetchCgInboxItemMock).toHaveBeenCalledTimes(1);
    expect(fetchCgInboxItemMock).toHaveBeenCalledWith("t1");
    expect(fetchCgAnchorContextOrNullMock).toHaveBeenCalledTimes(1);
  });
});
