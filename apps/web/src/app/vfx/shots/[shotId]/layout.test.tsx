import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const redirectSpy = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (destination: string) => {
    redirectSpy(destination);
    throw new Error(`NEXT_REDIRECT:${destination}`);
  },
  usePathname: () => "/vfx/shots/s1",
}));

const { resolveIdentityMock } = vi.hoisted(() => ({
  resolveIdentityMock: vi.fn(),
}));
vi.mock("@/features/session/identity", () => ({
  resolveIdentity: resolveIdentityMock,
  actorHeaders: () => ({
    "X-Actor-Role": "vfx_supervisor",
    "X-Actor-Id": "vfx-1",
  }),
}));

const { fetchVfxInboxItemMock, fetchVfxAnchorContextOrNullMock } = vi.hoisted(
  () => ({
    fetchVfxInboxItemMock: vi.fn(),
    fetchVfxAnchorContextOrNullMock: vi.fn(),
  }),
);
vi.mock("@/features/vfx/api", () => ({
  fetchVfxInboxItem: fetchVfxInboxItemMock,
  fetchVfxAnchorContextOrNull: fetchVfxAnchorContextOrNullMock,
}));

import VfxShotLayout from "./layout";

const params = Promise.resolve({ shotId: "s1" });
const identity = {
  role: "vfx_supervisor" as const,
  actorId: "vfx-1",
  displayName: "Maya Chen",
};

const item = {
  shot_id: "s1",
  shot_name: "Shot 010 — Final confrontation",
  project_id: "p1",
  project_name: "D1 Demo Project",
};

beforeEach(() => {
  vi.clearAllMocks();
  resolveIdentityMock.mockResolvedValue(identity);
  fetchVfxAnchorContextOrNullMock.mockResolvedValue(null);
});

afterEach(() => {
  cleanup();
});

describe("VfxShotLayout", () => {
  it("redirects to / when the resolved identity is not a vfx_supervisor", async () => {
    resolveIdentityMock.mockResolvedValue({
      ...identity,
      role: "artist",
    });

    await expect(
      VfxShotLayout({ params, children: <p>tab body</p> }),
    ).rejects.toThrow("NEXT_REDIRECT:/");
    expect(redirectSpy).toHaveBeenCalledWith("/");
  });

  it("shows an honest not-found state and never renders children when the Shot does not exist", async () => {
    fetchVfxInboxItemMock.mockResolvedValue(null);

    const element = await VfxShotLayout({ params, children: <p>tab body</p> });
    render(element);

    expect(screen.getByText("This Shot could not be found")).toBeVisible();
    expect(screen.queryByText("tab body")).not.toBeInTheDocument();
  });

  it("shows an honest unavailable state, distinct from not-found, when the API call throws", async () => {
    fetchVfxInboxItemMock.mockRejectedValue(new Error("network error"));

    const element = await VfxShotLayout({ params, children: <p>tab body</p> });
    render(element);

    expect(screen.getByText("This Shot is unavailable")).toBeVisible();
  });

  it("renders the persistent chrome (breadcrumb, Anchor Context, tabs) and the given children when the Shot exists", async () => {
    fetchVfxInboxItemMock.mockResolvedValue(item);

    const element = await VfxShotLayout({ params, children: <p>tab body</p> });
    render(element);

    expect(
      screen.getByRole("link", { name: "D1 Demo Project" }),
    ).toHaveAttribute("href", "/vfx/shots");
    expect(
      screen.getAllByText("Shot 010 — Final confrontation").length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("navigation", { name: "Section" })).toBeVisible();
    for (const label of [
      "Overview",
      "Intent",
      "Versions",
      "Alignment",
      "Activity",
    ]) {
      expect(screen.getByRole("link", { name: label })).toBeVisible();
    }
    expect(screen.getByText("tab body")).toBeVisible();
  });

  it("fetches the Shot identity and Anchor Context exactly once per render, not once per tab", async () => {
    fetchVfxInboxItemMock.mockResolvedValue(item);

    await VfxShotLayout({ params, children: <p>tab body</p> });

    expect(fetchVfxInboxItemMock).toHaveBeenCalledTimes(1);
    expect(fetchVfxInboxItemMock).toHaveBeenCalledWith("s1");
    expect(fetchVfxAnchorContextOrNullMock).toHaveBeenCalledTimes(1);
  });
});
