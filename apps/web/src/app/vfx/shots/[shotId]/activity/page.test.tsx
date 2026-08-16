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

import { ActivityWorkspacePage } from "./ActivityWorkspacePage";
import Page from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  cookieStore.get.mockReturnValue({ value: "vfx_supervisor" });
});

const params = Promise.resolve({ shotId: "s1" });

/** The role gate itself now runs in `app/vfx/layout.tsx`; this
 * defensive, unreachable-in-practice check exists purely so `identity`
 * narrows to non-null. Its redirect target stays `/demo` (a permanent,
 * deterministic redirect to `/`), matching the pre-refactor behavior of
 * this leaf-page check exactly -- see
 * docs/design/ICAS_PERSISTENT_WORKSPACE_ARCHITECTURE_IMPLEMENTATION_REPORT.md's
 * redirect-scope reconciliation. */
describe("/vfx/shots/:shotId/activity page", () => {
  it("redirects to /demo when the demo role cookie is not vfx_supervisor", async () => {
    cookieStore.get.mockReturnValue(undefined);
    await expect(Page({ params })).rejects.toThrow("NEXT_REDIRECT:/demo");
    expect(redirectSpy).toHaveBeenCalledWith("/demo");
  });

  it("passes the real loaded data through to ActivityWorkspacePage", async () => {
    const data = {
      item: { shot_id: "s1" },
      activity: { shot_id: "s1", events: [] },
    };
    loadActivityWorkspaceDataMock.mockResolvedValue(data);

    const result = await Page({ params });

    expect(result.type).toBe(ActivityWorkspacePage);
    expect(result.props.data).toBe(data);
  });

  it("passes a null data prop, rather than throwing, when the API call fails", async () => {
    loadActivityWorkspaceDataMock.mockRejectedValue(new Error("boom"));

    const result = await Page({ params });

    expect(result.props.data).toBeNull();
  });
});
