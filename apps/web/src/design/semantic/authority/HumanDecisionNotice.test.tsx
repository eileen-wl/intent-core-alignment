import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { HumanDecisionNotice } from "./HumanDecisionNotice";

afterEach(() => {
  cleanup();
});

describe("HumanDecisionNotice", () => {
  it("attributes Core Anchor confirmation to Human VFX Supervisor", () => {
    render(
      <HumanDecisionNotice
        objectLabel="Core Anchor revision 3"
        confirmingRole="vfx_supervisor"
        confirmedAt="2026-07-19T12:00:00Z"
      />,
    );
    expect(screen.getByText(/Human VFX Supervisor/)).toBeVisible();
    expect(screen.getByText("Human-confirmed")).toBeVisible();
  });

  it("attributes Execution Anchor confirmation to Human CG Supervisor", () => {
    render(
      <HumanDecisionNotice
        objectLabel="Execution Anchor revision 1"
        confirmingRole="cg_supervisor"
        confirmedAt="2026-07-19T12:00:00Z"
      />,
    );
    expect(screen.getByText(/Human CG Supervisor/)).toBeVisible();
  });

  it("renders rationale when present", () => {
    render(
      <HumanDecisionNotice
        objectLabel="Core Anchor revision 3"
        confirmingRole="vfx_supervisor"
        confirmedAt="2026-07-19T12:00:00Z"
        rationale="Matches the approved intent."
      />,
    );
    expect(screen.getByText("Matches the approved intent.")).toBeVisible();
  });
});
