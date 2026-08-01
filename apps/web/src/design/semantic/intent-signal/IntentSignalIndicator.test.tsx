import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { IntentSignalIndicator } from "./IntentSignalIndicator";
import { TEST_SIGNAL_HIGH } from "./intentSignalTestFixtures";

afterEach(() => {
  cleanup();
});

describe("IntentSignalIndicator", () => {
  it("shows the attention level when a signal is available", () => {
    render(
      <IntentSignalIndicator
        availability={{ status: "available", signal: TEST_SIGNAL_HIGH }}
      />,
    );
    expect(screen.getByText("Human review required")).toBeVisible();
  });

  it("never renders a numeric count", () => {
    render(
      <IntentSignalIndicator
        availability={{ status: "available", signal: TEST_SIGNAL_HIGH }}
      />,
    );
    expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument();
  });

  it("shows an honest empty state when no signal is available", () => {
    render(
      <IntentSignalIndicator availability={{ status: "no-assessment" }} />,
    );
    expect(screen.getByText("No current Intent Signal")).toBeVisible();
  });
});
