import { describe, expect, it } from "vitest";

import {
  executionAnchorStateBadgeStatus,
  executionAnchorStateLabel,
  lastUpdatedSourceLabel,
} from "./departmentExecutionOverview";

describe("executionAnchorStateLabel", () => {
  it("renders an honest 'no Execution Anchor yet' state, never a raw enum", () => {
    expect(executionAnchorStateLabel("none", null)).toBe(
      "No Execution Anchor yet",
    );
  });

  it("distinguishes draft from awaiting confirmation, never conflating them", () => {
    expect(executionAnchorStateLabel("draft", 1)).toBe(
      "Draft awaiting CG completion",
    );
    expect(executionAnchorStateLabel("awaiting_confirmation", 1)).toBe(
      "Awaiting CG confirmation",
    );
  });

  it("includes the real revision number only for a confirmed state", () => {
    expect(executionAnchorStateLabel("confirmed", 2)).toBe(
      "Confirmed (Revision 2)",
    );
  });

  it("reports a rejected revision honestly, distinct from draft or none", () => {
    expect(executionAnchorStateLabel("rejected", 1)).toBe("Rejected");
  });
});

describe("executionAnchorStateBadgeStatus", () => {
  it("maps confirmed to a distinct visual tone from draft/awaiting/rejected", () => {
    expect(executionAnchorStateBadgeStatus("confirmed")).toBe("confirmed");
    expect(executionAnchorStateBadgeStatus("draft")).not.toBe("confirmed");
    expect(executionAnchorStateBadgeStatus("awaiting_confirmation")).not.toBe(
      "confirmed",
    );
    expect(executionAnchorStateBadgeStatus("rejected")).not.toBe("confirmed");
  });
});

describe("lastUpdatedSourceLabel", () => {
  it("renders a human-readable phrase for every real source, never the raw discriminator", () => {
    expect(lastUpdatedSourceLabel("task_created")).toBe("Task created");
    expect(lastUpdatedSourceLabel("execution_anchor_revision")).toBe(
      "Execution Anchor updated",
    );
    expect(lastUpdatedSourceLabel("version")).toBe(
      "Production Version recorded",
    );
    expect(lastUpdatedSourceLabel("dependency")).toBe("Dependency recorded");
    expect(lastUpdatedSourceLabel("escalation")).toBe("Escalation recorded");
    expect(lastUpdatedSourceLabel("alignment_assessment")).toBe(
      "Alignment Assessment generated",
    );
  });
});
