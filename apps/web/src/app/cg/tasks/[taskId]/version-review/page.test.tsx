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

const { loadVersionReviewWorkspaceDataMock } = vi.hoisted(() => ({
  loadVersionReviewWorkspaceDataMock: vi.fn(),
}));
vi.mock("@/features/cg/version-review-workspace/data", () => ({
  loadVersionReviewWorkspaceData: loadVersionReviewWorkspaceDataMock,
}));

import { VersionReviewPage } from "./VersionReviewPage";
import Page from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  cookieStore.get.mockReturnValue({ value: "cg_supervisor" });
});

const params = Promise.resolve({ taskId: "t1" });

/** The role gate itself now runs in `app/cg/layout.tsx`; this
 * defensive, unreachable-in-practice check exists purely as a
 * fallback. Its redirect target stays `/demo` (a permanent,
 * deterministic redirect to `/`), matching the pre-refactor behavior of
 * this leaf-page check exactly. */
describe("/cg/tasks/:taskId/version-review page", () => {
  it("redirects to /demo when the demo role cookie is not cg_supervisor", async () => {
    cookieStore.get.mockReturnValue(undefined);
    await expect(Page({ params })).rejects.toThrow("NEXT_REDIRECT:/demo");
    expect(redirectSpy).toHaveBeenCalledWith("/demo");
  });

  it("passes the real loaded data through to VersionReviewPage", async () => {
    const data = {
      item: { task_id: "t1" },
      versions: [],
      coreAnchorSummary: null,
      coreAnchorRevisionNumber: null,
      coreAnchorStatus: null,
      activeExecutionRevision: null,
      cgSupervisorReviews: [],
    };
    loadVersionReviewWorkspaceDataMock.mockResolvedValue(data);

    const result = await Page({ params });

    expect(result.type).toBe(VersionReviewPage);
    expect(result.props.taskId).toBe("t1");
    expect(result.props.data).toBe(data);
  });

  it("passes a null data prop, rather than throwing, when the API call fails", async () => {
    loadVersionReviewWorkspaceDataMock.mockRejectedValue(new Error("boom"));

    const result = await Page({ params });

    expect(result.props.data).toBeNull();
  });
});
