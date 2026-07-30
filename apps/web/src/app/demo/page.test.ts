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

import { DemoEntryPage } from "./DemoEntryPage";
import Page from "./page";

beforeEach(() => {
  vi.clearAllMocks();
});

const emptySearchParams = Promise.resolve({});

describe("/demo page", () => {
  it("renders the Demo entry when no Demo role is selected", async () => {
    cookieStore.get.mockReturnValue(undefined);
    const result = await Page({ searchParams: emptySearchParams });
    expect(redirectSpy).not.toHaveBeenCalled();
    expect(result.type).toBe(DemoEntryPage);
  });

  it("redirects to the active role's homepage instead of re-showing the entry", async () => {
    cookieStore.get.mockReturnValue({ value: "cg_supervisor" });
    await expect(Page({ searchParams: emptySearchParams })).rejects.toThrow();
    expect(redirectSpy).toHaveBeenCalledWith("/cg");
  });

  it("ignores an invalid cookie value and renders the Demo entry", async () => {
    cookieStore.get.mockReturnValue({ value: "producer" });
    const result = await Page({ searchParams: emptySearchParams });
    expect(redirectSpy).not.toHaveBeenCalled();
    expect(result.type).toBe(DemoEntryPage);
  });

  it("passes a guided-entry error notice when the redirect carries ?guidedError", async () => {
    cookieStore.get.mockReturnValue(undefined);
    const result = await Page({
      searchParams: Promise.resolve({ guidedError: "1" }),
    });
    expect(result.props.guidedEntryError).toBe(true);
  });
});
