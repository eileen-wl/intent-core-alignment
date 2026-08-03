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

const { fetchVfxInboxMock } = vi.hoisted(() => ({
  fetchVfxInboxMock: vi.fn(),
}));
vi.mock("@/features/vfx/api", () => ({
  fetchVfxInbox: fetchVfxInboxMock,
  fetchVfxAnchorContextMap: vi.fn(async () => ({})),
}));

vi.mock("../../demo/actions", () => ({
  exitRoleView: vi.fn(),
}));

import { ReviewInboxPage } from "./ReviewInboxPage";
import Page from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  cookieStore.get.mockReturnValue({ value: "vfx_supervisor" });
});

describe("/vfx/inbox page", () => {
  it("redirects to / when no VFX Supervisor role session exists", async () => {
    cookieStore.get.mockReturnValue(undefined);
    await expect(Page()).rejects.toThrow();
    expect(redirectSpy).toHaveBeenCalledWith("/");
  });

  it("renders ReviewInboxPage with the fetched inbox on success", async () => {
    const inbox = { items: [], generated_at: "2026-01-01T00:00:00Z" };
    fetchVfxInboxMock.mockResolvedValue(inbox);

    const result = await Page();

    expect(result.type).toBe(ReviewInboxPage);
    expect(result.props.inbox).toBe(inbox);
  });

  it("renders ReviewInboxPage with a null inbox when the fetch fails, rather than throwing", async () => {
    fetchVfxInboxMock.mockRejectedValue(new Error("network error"));

    const result = await Page();

    expect(result.type).toBe(ReviewInboxPage);
    expect(result.props.inbox).toBeNull();
  });
});
