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

const { loadAlignmentWorkspaceDataMock } = vi.hoisted(() => ({
  loadAlignmentWorkspaceDataMock: vi.fn(),
}));
vi.mock("@/features/vfx/alignment-workspace/data", () => ({
  loadAlignmentWorkspaceData: loadAlignmentWorkspaceDataMock,
}));

vi.mock("../../../../demo/actions", () => ({
  exitRoleView: vi.fn(),
}));

import { AlignmentWorkspacePage } from "./AlignmentWorkspacePage";
import Page from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  cookieStore.get.mockReturnValue({ value: "vfx_supervisor" });
});

const params = Promise.resolve({ shotId: "s1" });

describe("/vfx/shots/:shotId/alignment page", () => {
  it("redirects to /demo when the demo role cookie is not vfx_supervisor", async () => {
    cookieStore.get.mockReturnValue({ value: "artist" });
    await expect(Page({ params })).rejects.toThrow("NEXT_REDIRECT:/demo");
    expect(redirectSpy).toHaveBeenCalledWith("/demo");
  });

  it("passes the real loaded data through to AlignmentWorkspacePage", async () => {
    const data = {
      item: { shot_id: "s1" },
      assessments: [],
      versionsById: new Map(),
      revisionsById: new Map(),
    };
    loadAlignmentWorkspaceDataMock.mockResolvedValue(data);

    const result = await Page({ params });

    expect(result.type).toBe(AlignmentWorkspacePage);
    expect(result.props.shotId).toBe("s1");
    expect(result.props.data).toBe(data);
    expect(result.props.unavailable).toBe(false);
  });

  it("marks the page unavailable, rather than throwing, when the API call fails", async () => {
    loadAlignmentWorkspaceDataMock.mockRejectedValue(new Error("boom"));

    const result = await Page({ params });

    expect(result.props.data).toBeNull();
    expect(result.props.unavailable).toBe(true);
  });
});
