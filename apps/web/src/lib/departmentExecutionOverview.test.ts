import { describe, expect, it } from "vitest";

import {
  cgTaskFocusLabel,
  executionAnchorStateBadgeStatus,
  executionAnchorStateLabel,
  lastUpdatedSourceLabel,
  latestVersionScopeLabel,
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

describe("cgTaskFocusLabel", () => {
  it("identifies every actionable focus as CG-owned, role-explicit context", () => {
    expect(cgTaskFocusLabel("execution_anchor_gate_pending")).toMatch(
      /^CG task focus:/,
    );
    expect(cgTaskFocusLabel("execution_anchor_draft_needs_review")).toMatch(
      /^CG task focus:/,
    );
    expect(cgTaskFocusLabel("dependency_needs_attention")).toMatch(
      /^CG task focus:/,
    );
    expect(cgTaskFocusLabel("version_review_available")).toMatch(
      /^CG task focus:/,
    );
  });

  it("never renders an unqualified second-person 'your' sentence for any real focus type", () => {
    const focusTypes = [
      "execution_anchor_gate_pending",
      "execution_anchor_draft_needs_review",
      "dependency_needs_attention",
      "version_review_available",
      "none",
    ] as const;
    for (const focusType of focusTypes) {
      expect(cgTaskFocusLabel(focusType)).not.toMatch(/\byour\b/i);
    }
  });

  it("states no current CG action without implying VFX needs no attention", () => {
    expect(cgTaskFocusLabel("none")).toBe(
      "No current CG action is required for this Task.",
    );
  });
});

describe("latestVersionScopeLabel", () => {
  it("returns null when there is no latest Version", () => {
    expect(latestVersionScopeLabel(null)).toBeNull();
  });

  it("labels a Task-linked Version distinctly from the Shot-level fallback", () => {
    expect(latestVersionScopeLabel("task")).toBe("Task-linked Version");
    expect(latestVersionScopeLabel("shot_unscoped")).toBe(
      "Shot-level Version fallback — not linked to this Task in ICAS",
    );
  });
});
