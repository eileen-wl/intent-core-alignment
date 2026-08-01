import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { IntentSignalBadge } from "./IntentSignalBadge";
import { TEST_SIGNAL_HIGH, TEST_SIGNAL_LOW } from "./intentSignalTestFixtures";

afterEach(() => {
  cleanup();
});

describe("IntentSignalBadge", () => {
  it("renders the generic level wording, not role-specific text", () => {
    render(
      <IntentSignalBadge
        availability={{ status: "available", signal: TEST_SIGNAL_HIGH }}
      />,
    );
    expect(screen.getByText("Human review required")).toBeVisible();
  });

  it("renders low attention distinctly from high attention", () => {
    const { unmount } = render(
      <IntentSignalBadge
        availability={{ status: "available", signal: TEST_SIGNAL_LOW }}
      />,
    );
    expect(screen.getByText("Low attention")).toBeVisible();
    unmount();
  });

  it("renders nothing when no signal is available", () => {
    const { container } = render(
      <IntentSignalBadge availability={{ status: "no-assessment" }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
