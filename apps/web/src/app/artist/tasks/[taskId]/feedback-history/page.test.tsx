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

const { loadFeedbackHistoryDataMock } = vi.hoisted(() => ({
  loadFeedbackHistoryDataMock: vi.fn(),
}));
vi.mock("@/features/artist/feedback-history/data", () => ({
  loadFeedbackHistoryData: loadFeedbackHistoryDataMock,
}));

import { FeedbackHistoryPage } from "./FeedbackHistoryPage";
import Page from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  cookieStore.get.mockReturnValue({ value: "artist" });
});

const params = Promise.resolve({ taskId: "t1" });

/** The role gate itself now runs in `app/artist/layout.tsx`; this
 * defensive, unreachable-in-practice check exists purely as a
 * fallback. Its redirect target stays `/demo` (a permanent,
 * deterministic redirect to `/`), matching the pre-refactor behavior of
 * this leaf-page check exactly. */
describe("/artist/tasks/:taskId/feedback-history page", () => {
  it("redirects to /demo when the demo role cookie is not artist", async () => {
    cookieStore.get.mockReturnValue(undefined);
    await expect(Page({ params })).rejects.toThrow("NEXT_REDIRECT:/demo");
    expect(redirectSpy).toHaveBeenCalledWith("/demo");
  });

  it("passes the real loaded data through to FeedbackHistoryPage", async () => {
    const data = {
      item: { task_id: "t1" },
      history: { task_id: "t1", events: [] },
    };
    loadFeedbackHistoryDataMock.mockResolvedValue(data);

    const result = await Page({ params });

    expect(result.type).toBe(FeedbackHistoryPage);
    expect(result.props.data).toBe(data);
  });

  it("passes a null data prop, rather than throwing, when the API call fails", async () => {
    loadFeedbackHistoryDataMock.mockRejectedValue(new Error("boom"));

    const result = await Page({ params });

    expect(result.props.data).toBeNull();
  });
});
