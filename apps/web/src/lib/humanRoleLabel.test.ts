import { describe, expect, it } from "vitest";

import { humanRoleLabel } from "./humanRoleLabel";

describe("humanRoleLabel", () => {
  it("formats every real HumanRole enum value as its human-readable label", () => {
    expect(humanRoleLabel("vfx_supervisor")).toBe("VFX Supervisor");
    expect(humanRoleLabel("cg_supervisor")).toBe("CG Supervisor");
    expect(humanRoleLabel("artist")).toBe("Artist");
  });

  it("normalises a stray mixed-case variant to the same label", () => {
    expect(humanRoleLabel("Vfx_supervisor")).toBe("VFX Supervisor");
    expect(humanRoleLabel("Cg_supervisor")).toBe("CG Supervisor");
  });

  it("falls back to the raw value for an unrecognised role, never fabricating a label", () => {
    expect(humanRoleLabel("some_future_role")).toBe("some_future_role");
  });

  it("returns an honest Unknown for a missing value, never a blank label", () => {
    expect(humanRoleLabel(null)).toBe("Unknown");
    expect(humanRoleLabel(undefined)).toBe("Unknown");
    expect(humanRoleLabel("")).toBe("Unknown");
  });
});
