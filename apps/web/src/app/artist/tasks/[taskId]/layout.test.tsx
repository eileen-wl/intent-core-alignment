import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let mockPathname = "/artist/tasks/t1";
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
    "X-Actor-Role": "artist",
    "X-Actor-Id": "artist-1",
  }),
}));

const { fetchArtistInboxItemMock, fetchArtistAnchorContextOrNullMock } =
  vi.hoisted(() => ({
    fetchArtistInboxItemMock: vi.fn(),
    fetchArtistAnchorContextOrNullMock: vi.fn(),
  }));
vi.mock("@/features/artist/api", () => ({
  fetchArtistInboxItem: fetchArtistInboxItemMock,
  fetchArtistAnchorContextOrNull: fetchArtistAnchorContextOrNullMock,
}));

import ArtistTaskLayout from "./layout";

const params = Promise.resolve({ taskId: "t1" });
const identity = {
  role: "artist" as const,
  actorId: "artist-1",
  displayName: "Lena Park",
};

const item = {
  task_id: "t1",
  task_name: "Compositing Review",
  shot_id: "s1",
  shot_name: "Shot 010",
  project_id: "p1",
  project_name: "D1 Demo Project",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPathname = "/artist/tasks/t1";
  resolveIdentityMock.mockResolvedValue(identity);
  fetchArtistAnchorContextOrNullMock.mockResolvedValue(null);
});

afterEach(() => {
  cleanup();
});

describe("ArtistTaskLayout", () => {
  it("redirects to / when the resolved identity is not an artist", async () => {
    resolveIdentityMock.mockResolvedValue({
      ...identity,
      role: "cg_supervisor",
    });

    await expect(
      ArtistTaskLayout({ params, children: <p>tab body</p> }),
    ).rejects.toThrow("NEXT_REDIRECT:/");
    expect(redirectSpy).toHaveBeenCalledWith("/");
  });

  it("shows an honest not-found state and never renders children when the Task does not exist", async () => {
    fetchArtistInboxItemMock.mockResolvedValue(null);

    const element = await ArtistTaskLayout({
      params,
      children: <p>tab body</p>,
    });
    render(element);

    expect(screen.getByText("This Task could not be found")).toBeVisible();
    expect(screen.queryByText("tab body")).not.toBeInTheDocument();
  });

  it("renders the persistent chrome with only the three Artist tabs, and the given tab body -- ?version= selection stays a leaf-page concern this layout never touches", async () => {
    fetchArtistInboxItemMock.mockResolvedValue(item);
    mockPathname = "/artist/tasks/t1/current-version";

    const element = await ArtistTaskLayout({
      params,
      children: <p>current-version tab body</p>,
    });
    render(element);

    expect(screen.getByRole("link", { name: "Task Overview" })).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Current Version" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("link", { name: "Feedback History" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("link", { name: "Intent" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Execution" }),
    ).not.toBeInTheDocument();
    // The layout receives no `?version=` information at all -- it only
    // ever fetches the shared Task identity/Anchor Context and renders
    // whatever leaf page.tsx (which does read `?version=`) passed as
    // children.
    expect(screen.getByText("current-version tab body")).toBeVisible();
  });

  it("fetches the Task identity and Anchor Context exactly once per render, not once per tab", async () => {
    fetchArtistInboxItemMock.mockResolvedValue(item);

    await ArtistTaskLayout({ params, children: <p>tab body</p> });

    expect(fetchArtistInboxItemMock).toHaveBeenCalledTimes(1);
    expect(fetchArtistInboxItemMock).toHaveBeenCalledWith("t1");
    expect(fetchArtistAnchorContextOrNullMock).toHaveBeenCalledTimes(1);
  });
});
