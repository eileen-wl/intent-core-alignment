import type { DecisionRead } from "@intent-core/contracts";
import { describe, expect, it } from "vitest";

import {
  decisionOutcomeStatement,
  decisionProvenanceItems,
} from "./decisionProvenance";

function decision(overrides: Partial<DecisionRead> = {}): DecisionRead {
  return {
    id: "d1",
    decision_type: "confirm_execution_anchor",
    owning_human_role: "cg_supervisor",
    actor_kind: "human",
    actor_id: "cg-1",
    actor_human_role: "cg_supervisor",
    rationale: "Matches the confirmed Core Anchor exactly.",
    entity_type: "execution_anchor_revision",
    entity_id: "ea-rev1",
    write_back_requested: false,
    supersedes_decision_id: null,
    created_at: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

describe("decisionProvenanceItems", () => {
  it("includes the real actor role as a human-readable label, rationale, and decided-at timestamp -- never the raw role enum", () => {
    const items = decisionProvenanceItems(decision());
    expect(items).toContainEqual({
      label: "Actor role",
      value: "CG Supervisor",
    });
    expect(items.some((item) => item.value === "cg_supervisor")).toBe(false);
    expect(items).toContainEqual({
      label: "Rationale",
      value: "Matches the confirmed Core Anchor exactly.",
    });
    expect(items.some((item) => item.label === "Decided at")).toBe(true);
  });

  it("states honestly when no rationale was recorded, never fabricating one", () => {
    const items = decisionProvenanceItems(decision({ rationale: null }));
    expect(items).toContainEqual({
      label: "Rationale",
      value: "No rationale was provided.",
    });
  });

  it("includes a supersession note only when the Decision actually supersedes one, without rendering a raw id", () => {
    const withoutSupersession = decisionProvenanceItems(decision());
    expect(
      withoutSupersession.some((item) => item.label === "Supersedes"),
    ).toBe(false);

    const withSupersession = decisionProvenanceItems(
      decision({ supersedes_decision_id: "8b4f11eb-uuid-shaped" }),
    );
    const supersedesItem = withSupersession.find(
      (item) => item.label === "Supersedes",
    );
    expect(supersedesItem).toBeDefined();
    expect(supersedesItem?.value).not.toContain("8b4f11eb");
  });
});

describe("decisionOutcomeStatement", () => {
  it("renders a concise confirmed outcome from the real decision_type and revision number", () => {
    expect(decisionOutcomeStatement(decision(), 2)).toBe(
      "Confirmed Execution Anchor revision 2",
    );
  });

  it("renders a concise rejected outcome, where applicable", () => {
    expect(
      decisionOutcomeStatement(
        decision({ decision_type: "reject_execution_anchor" }),
        3,
      ),
    ).toBe("Rejected Execution Anchor revision 3");
  });

  it("renders a Core Anchor outcome for a core_anchor_revision Decision", () => {
    expect(
      decisionOutcomeStatement(
        decision({
          decision_type: "confirm_core_anchor",
          entity_type: "core_anchor_revision",
        }),
        1,
      ),
    ).toBe("Confirmed Core Anchor revision 1");
  });
});
