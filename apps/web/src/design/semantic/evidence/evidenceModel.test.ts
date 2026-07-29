import { describe, expect, it } from "vitest";

import { humanizeSourceType } from "./evidenceModel";

describe("humanizeSourceType", () => {
  it("humanizes every known evidence source type", () => {
    expect(humanizeSourceType("core_anchor_revision")).toBe(
      "Core Anchor revision",
    );
    expect(humanizeSourceType("vfx_supervisor_review")).toBe(
      "VFX Supervisor review",
    );
    expect(humanizeSourceType("review_note")).toBe("Review note");
  });

  it("falls back to a title-cased label for an unlisted source type", () => {
    expect(humanizeSourceType("some_new_type")).toBe("Some New Type");
  });
});
