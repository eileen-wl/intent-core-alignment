import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { IntentSignalBanner } from "./IntentSignalBanner";
import { TEST_SIGNAL_HIGH } from "./intentSignalTestFixtures";

afterEach(() => {
  cleanup();
});

describe("IntentSignalBanner", () => {
  it("maps to CG Supervisor wording and shows the caller-supplied context", () => {
    render(
      <IntentSignalBanner
        availability={{ status: "available", signal: TEST_SIGNAL_HIGH }}
        role="cg_supervisor"
        contextLabel="Shot 010 · Final confrontation"
      />,
    );
    expect(screen.getByText("Execution clarification required")).toBeVisible();
    expect(screen.getByText("Shot 010 · Final confrontation")).toBeVisible();
  });

  it("renders the honest no-assessment banner", () => {
    render(
      <IntentSignalBanner
        availability={{ status: "no-assessment" }}
        role="artist"
      />,
    );
    expect(screen.getByText("No current Intent Signal")).toBeVisible();
  });

  it("renders the honest unavailable banner", () => {
    render(
      <IntentSignalBanner
        availability={{ status: "unavailable" }}
        role="artist"
      />,
    );
    expect(screen.getByText("Intent Signal unavailable")).toBeVisible();
  });
});
