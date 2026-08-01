import { describe, expect, it } from "vitest";

import {
  intentSignalDriverCodeLabel,
  intentSignalLevelWording,
  intentSignalRoleWording,
  intentSignalStatusTone,
} from "./intentSignalModel";

describe("intentSignalLevelWording", () => {
  it("maps each attention level to honest, role-agnostic text", () => {
    expect(intentSignalLevelWording("low")).toBe("Low attention");
    expect(intentSignalLevelWording("medium")).toBe("Attention needed");
    expect(intentSignalLevelWording("high")).toBe("Human review required");
  });
});

describe("intentSignalRoleWording", () => {
  it("maps the same high-attention signal to each role's approved wording", () => {
    expect(intentSignalRoleWording("vfx_supervisor", "high")).toBe(
      "Human review required",
    );
    expect(intentSignalRoleWording("cg_supervisor", "high")).toBe(
      "Execution clarification required",
    );
    expect(intentSignalRoleWording("artist", "high")).toBe(
      "Supervisor clarification pending",
    );
  });

  it("maps the same medium-attention signal to each role's approved wording", () => {
    expect(intentSignalRoleWording("vfx_supervisor", "medium")).toBe(
      "Human review required",
    );
    expect(intentSignalRoleWording("cg_supervisor", "medium")).toBe(
      "Execution clarification required",
    );
    expect(intentSignalRoleWording("artist", "medium")).toBe(
      "Supervisor clarification pending",
    );
  });

  it("falls back to the neutral level wording at low attention for every role -- nothing to act on", () => {
    expect(intentSignalRoleWording("vfx_supervisor", "low")).toBe(
      "Low attention",
    );
    expect(intentSignalRoleWording("cg_supervisor", "low")).toBe(
      "Low attention",
    );
    expect(intentSignalRoleWording("artist", "low")).toBe("Low attention");
  });
});

describe("intentSignalStatusTone", () => {
  it("never marks low attention as an attention-needing tone", () => {
    expect(intentSignalStatusTone("low")).toBe("neutral");
  });

  it("marks medium and high as attention", () => {
    expect(intentSignalStatusTone("medium")).toBe("attention");
    expect(intentSignalStatusTone("high")).toBe("attention");
  });
});

describe("intentSignalDriverCodeLabel", () => {
  it("labels every driver code", () => {
    expect(intentSignalDriverCodeLabel("cross_role_tension")).toBe(
      "Cross-role tension",
    );
    expect(intentSignalDriverCodeLabel("local_optimum_risk")).toBe(
      "Local-optimum risk",
    );
    expect(intentSignalDriverCodeLabel("unresolved_dependency")).toBe(
      "Unresolved dependency",
    );
    expect(intentSignalDriverCodeLabel("anchor_clarity_gap")).toBe(
      "Anchor clarity gap",
    );
    expect(intentSignalDriverCodeLabel("missing_evidence")).toBe(
      "Missing evidence",
    );
  });
});
