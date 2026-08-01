import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectSpy = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (destination: string) => {
    redirectSpy(destination);
    throw new Error(`NEXT_REDIRECT:${destination}`);
  },
}));

import Page from "./page";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("/demo page (Step 7C-1: retired, redirects to the Role-selection Home)", () => {
  it("always redirects to /, regardless of any existing role session", () => {
    expect(() => Page()).toThrow();
    expect(redirectSpy).toHaveBeenCalledWith("/");
  });

  it("renders no product UI of its own", () => {
    let threw = false;
    try {
      Page();
    } catch {
      threw = true;
    }
    // The only observable effect is the redirect -- there is no
    // fallback render path that could show Demo Entry content.
    expect(threw).toBe(true);
    expect(redirectSpy).toHaveBeenCalledTimes(1);
  });
});
