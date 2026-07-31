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

const { loadActivityWorkspaceDataMock } = vi.hoisted(() => ({
  loadActivityWorkspaceDataMock: vi.fn(),
}));
vi.mock("@/features/vfx/activity-workspace/data", () => ({
  loadActivityWorkspaceData: loadActivityWorkspaceDataMock,
}));

vi.mock("../../../../demo/actions", () => ({
  exitRoleView: vi.fn(),
}));

import { ActivityWorkspacePage } from "./ActivityWorkspacePage";
import Page from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  cookieStore.get.mockReturnValue({ value: "vfx_supervisor" });
});

const params = Promise.resolve({ shotId: "s1" });

describe("/vfx/shots/:shotId/activity page", () => {
  it("redirects to /demo when the demo role cookie is not vfx_supervisor", async () => {
    cookieStore.get.mockReturnValue(undefined);
    await expect(Page({ params })).rejects.toThrow("NEXT_REDIRECT:/demo");
    expect(redirectSpy).toHaveBeenCalledWith("/demo");
  });

  it("passes the real loaded data through to ActivityWorkspacePage", async () => {
    const data = { item: { shot_id: "s1" }, activity: { shot_id: "s1", events: [] } };
    loadActivityWorkspaceDataMock.mockResolvedValue(data);

    const result = await Page({ params });

    expect(result.type).toBe(ActivityWorkspacePage);
    expect(result.props.shotId).toBe("s1");
    expect(result.props.data).toBe(data);
    expect(result.props.unavailable).toBe(false);
  });

  it("marks the page unavailable, rather than throwing, when the API call fails", async () => {
    loadActivityWorkspaceDataMock.mockRejectedValue(new Error("boom"));

    const result = await Page({ params });

    expect(result.props.data).toBeNull();
    expect(result.props.unavailable).toBe(true);
  });
});
