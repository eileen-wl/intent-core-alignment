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

const { loadCurrentVersionDataMock } = vi.hoisted(() => ({
  loadCurrentVersionDataMock: vi.fn(),
}));
vi.mock("@/features/artist/current-version/data", () => ({
  loadCurrentVersionData: loadCurrentVersionDataMock,
}));

import { CurrentVersionPage } from "./CurrentVersionPage";
import Page from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  cookieStore.get.mockReturnValue({ value: "artist" });
});

const params = Promise.resolve({ taskId: "t1" });
const searchParams = Promise.resolve({});

const ACTOR_HEADERS = { "X-Actor-Role": "artist", "X-Actor-Id": "artist-1" };

/** The role gate itself now runs in `app/artist/layout.tsx`; this
 * defensive, unreachable-in-practice check exists purely as a
 * fallback. Its redirect target stays `/demo` (a permanent,
 * deterministic redirect to `/`), matching the pre-refactor behavior of
 * this leaf-page check exactly. */
describe("/artist/tasks/:taskId/current-version page", () => {
  it("redirects to /demo when the demo role cookie is not artist", async () => {
    cookieStore.get.mockReturnValue(undefined);
    await expect(Page({ params, searchParams })).rejects.toThrow(
      "NEXT_REDIRECT:/demo",
    );
    expect(redirectSpy).toHaveBeenCalledWith("/demo");
  });

  it("passes the real loaded data through to CurrentVersionPage", async () => {
    const data = {
      item: { task_id: "t1" },
      versions: [],
      selectedVersion: null,
      reviewNotes: [],
      guidances: [],
      coreAnchorRevision: null,
      executionAnchorRevision: null,
      cgSupervisorReviews: [],
      crossRoleAssessments: [],
      media: null,
    };
    loadCurrentVersionDataMock.mockResolvedValue(data);

    const result = await Page({ params, searchParams });

    expect(result.type).toBe(CurrentVersionPage);
    expect(result.props.taskId).toBe("t1");
    expect(result.props.data).toBe(data);
  });

  it("passes the ?version= query param and trusted actor headers through to loadCurrentVersionData", async () => {
    loadCurrentVersionDataMock.mockResolvedValue({
      item: { task_id: "t1" },
      versions: [],
      selectedVersion: null,
      reviewNotes: [],
      guidances: [],
      coreAnchorRevision: null,
      executionAnchorRevision: null,
      cgSupervisorReviews: [],
      crossRoleAssessments: [],
      media: null,
    });

    await Page({ params, searchParams: Promise.resolve({ version: "v2" }) });

    expect(loadCurrentVersionDataMock).toHaveBeenCalledWith(
      "t1",
      ACTOR_HEADERS,
      "v2",
    );
  });

  it("passes a null data prop, rather than throwing, when the API call fails", async () => {
    loadCurrentVersionDataMock.mockRejectedValue(new Error("boom"));

    const result = await Page({ params, searchParams });

    expect(result.props.data).toBeNull();
  });
});
