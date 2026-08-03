import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieStore = { get: vi.fn() };
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

const redirectSpy = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (destination: string) => {
    redirectSpy(destination);
    throw new Error(`NEXT_REDIRECT:${destination}`);
  },
}));

const { fetchArtistInboxMock } = vi.hoisted(() => ({
  fetchArtistInboxMock: vi.fn(),
}));
vi.mock("@/features/artist/api", () => ({
  fetchArtistInbox: fetchArtistInboxMock,
  fetchArtistAnchorContextMap: vi.fn(async () => ({})),
}));

vi.mock("../../demo/actions", () => ({
  exitRoleView: vi.fn(),
}));

import { ArtistReviewInboxPage } from "./ArtistReviewInboxPage";
import Page from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  cookieStore.get.mockReturnValue({ value: "artist" });
});

describe("/artist/inbox page", () => {
  it("redirects to /demo when the demo role cookie is not artist", async () => {
    cookieStore.get.mockReturnValue({ value: "vfx_supervisor" });
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/demo");
    expect(redirectSpy).toHaveBeenCalledWith("/demo");
  });

  it("passes the real loaded inbox through to ArtistReviewInboxPage", async () => {
    const inbox = { items: [], generated_at: "2026-01-01T00:00:00Z" };
    fetchArtistInboxMock.mockResolvedValue(inbox);

    const result = await Page();

    expect(result.type).toBe(ArtistReviewInboxPage);
    expect(result.props.inbox).toBe(inbox);
  });

  it("marks the page unavailable, rather than throwing, when the API call fails", async () => {
    fetchArtistInboxMock.mockRejectedValue(new Error("boom"));

    const result = await Page();

    expect(result.props.inbox).toBeNull();
  });
});
