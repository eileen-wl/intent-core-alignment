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

vi.mock("../../../../demo/actions", () => ({
  exitRoleView: vi.fn(),
}));

import { CurrentVersionPage } from "./CurrentVersionPage";
import Page from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  cookieStore.get.mockReturnValue({ value: "artist" });
});

const params = Promise.resolve({ taskId: "t1" });
const searchParams = Promise.resolve({});

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
    };
    loadCurrentVersionDataMock.mockResolvedValue(data);

    const result = await Page({ params, searchParams });

    expect(result.type).toBe(CurrentVersionPage);
    expect(result.props.taskId).toBe("t1");
    expect(result.props.data).toBe(data);
    expect(result.props.unavailable).toBe(false);
  });

  it("passes the ?version= query param through to loadCurrentVersionData", async () => {
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
    });

    await Page({ params, searchParams: Promise.resolve({ version: "v2" }) });

    expect(loadCurrentVersionDataMock).toHaveBeenCalledWith("t1", "v2");
  });

  it("marks the page unavailable, rather than throwing, when the API call fails", async () => {
    loadCurrentVersionDataMock.mockRejectedValue(new Error("boom"));

    const result = await Page({ params, searchParams });

    expect(result.props.data).toBeNull();
    expect(result.props.unavailable).toBe(true);
  });
});
