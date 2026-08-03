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

const { fetchCgInboxMock } = vi.hoisted(() => ({
  fetchCgInboxMock: vi.fn(),
}));
vi.mock("@/features/cg/api", () => ({
  fetchCgInbox: fetchCgInboxMock,
  fetchCgAnchorContextMap: vi.fn(async () => ({})),
}));

vi.mock("../../demo/actions", () => ({
  exitRoleView: vi.fn(),
}));

import { TasksListPage } from "./TasksListPage";
import Page from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  cookieStore.get.mockReturnValue({ value: "cg_supervisor" });
});

describe("/cg/tasks page", () => {
  it("redirects to /demo when the demo role cookie is not cg_supervisor", async () => {
    cookieStore.get.mockReturnValue({ value: "artist" });
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/demo");
    expect(redirectSpy).toHaveBeenCalledWith("/demo");
  });

  it("passes the real loaded inbox through to TasksListPage", async () => {
    const inbox = { items: [], generated_at: "2026-01-01T00:00:00Z" };
    fetchCgInboxMock.mockResolvedValue(inbox);

    const result = await Page();

    expect(result.type).toBe(TasksListPage);
    expect(result.props.inbox).toBe(inbox);
  });

  it("marks the page unavailable, rather than throwing, when the API call fails", async () => {
    fetchCgInboxMock.mockRejectedValue(new Error("boom"));

    const result = await Page();

    expect(result.props.inbox).toBeNull();
  });
});
