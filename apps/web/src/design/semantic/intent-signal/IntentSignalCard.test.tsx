import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { IntentSignalCard } from "./IntentSignalCard";
import { TEST_SIGNAL_HIGH } from "./intentSignalTestFixtures";

afterEach(() => {
  cleanup();
});

describe("IntentSignalCard", () => {
  it("maps the same Signal to the VFX Supervisor's wording", () => {
    render(
      <IntentSignalCard
        availability={{ status: "available", signal: TEST_SIGNAL_HIGH }}
        role="vfx_supervisor"
      />,
    );
    expect(screen.getByText("Human review required")).toBeVisible();
  });

  it("maps the same Signal to the CG Supervisor's wording", () => {
    render(
      <IntentSignalCard
        availability={{ status: "available", signal: TEST_SIGNAL_HIGH }}
        role="cg_supervisor"
      />,
    );
    expect(screen.getByText("Execution clarification required")).toBeVisible();
  });

  it("maps the same Signal to the Artist's wording", () => {
    render(
      <IntentSignalCard
        availability={{ status: "available", signal: TEST_SIGNAL_HIGH }}
        role="artist"
      />,
    );
    expect(screen.getByText("Supervisor clarification pending")).toBeVisible();
  });

  it("renders an honest no-assessment state", () => {
    render(
      <IntentSignalCard
        availability={{ status: "no-assessment" }}
        role="vfx_supervisor"
      />,
    );
    expect(screen.getByText("No current Intent Signal")).toBeVisible();
    expect(
      screen.getByText("A successful Cross-role Assessment is required."),
    ).toBeVisible();
  });

  it("renders an honest generation-failed state distinct from no-assessment", () => {
    render(
      <IntentSignalCard
        availability={{ status: "generation-failed" }}
        role="vfx_supervisor"
      />,
    );
    expect(screen.getByText("Intent Signal unavailable")).toBeVisible();
    expect(
      screen.getByText(/latest cross-role assessment attempt failed/i),
    ).toBeVisible();
  });

  it("shows the caller-supplied object/context", () => {
    render(
      <IntentSignalCard
        availability={{ status: "available", signal: TEST_SIGNAL_HIGH }}
        role="vfx_supervisor"
        contextLabel="Shot 010 · Final confrontation"
      />,
    );
    expect(screen.getByText("Shot 010 · Final confrontation")).toBeVisible();
  });

  it("leads with the conclusion before the supporting authority marker", () => {
    render(
      <IntentSignalCard
        availability={{ status: "available", signal: TEST_SIGNAL_HIGH }}
        role="vfx_supervisor"
      />,
    );
    const conclusion = screen.getByText("Human review required");
    const marker = screen.getByText("Intent Signal");
    // DOM order: the conclusion appears before the supporting
    // "Intent Signal" authority marker, not after or competing with it.
    expect(
      conclusion.compareDocumentPosition(marker) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("does not fabricate a live-monitoring or notification wording", () => {
    render(
      <IntentSignalCard
        availability={{ status: "available", signal: TEST_SIGNAL_HIGH }}
        role="vfx_supervisor"
      />,
    );
    expect(screen.queryByText(/unread/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/live/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/monitoring/i)).not.toBeInTheDocument();
  });
});
