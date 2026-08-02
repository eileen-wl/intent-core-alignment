import { describe, expect, it } from "vitest";

import { excerptText } from "./workingDirection";

describe("excerptText", () => {
  it("returns short text unchanged", () => {
    expect(excerptText("Tighten the timing.")).toBe("Tighten the timing.");
  });

  it("truncates long text on a word boundary and appends an ellipsis", () => {
    const long =
      "This is a very long piece of review note content that goes on and on well past the concise card length limit and should be excerpted rather than shown in full.";
    const result = excerptText(long, 40);
    expect(result.length).toBeLessThanOrEqual(41);
    expect(result.endsWith("…")).toBe(true);
    expect(result.endsWith(" …")).toBe(false);
    expect(long.startsWith(result.slice(0, -1))).toBe(true);
  });

  it("never fabricates content -- the excerpt is always a literal prefix of the source text", () => {
    const long = "Word ".repeat(100).trim();
    const result = excerptText(long, 50);
    const withoutEllipsis = result.endsWith("…") ? result.slice(0, -1) : result;
    expect(long.startsWith(withoutEllipsis)).toBe(true);
  });
});
