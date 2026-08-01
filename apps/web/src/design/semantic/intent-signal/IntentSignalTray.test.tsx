import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { IntentSignalTray } from "./IntentSignalTray";
import { TEST_SIGNAL_HIGH, TEST_SIGNAL_LOW } from "./intentSignalTestFixtures";

afterEach(() => {
  cleanup();
});

describe("IntentSignalTray", () => {
  it("renders each item's context and level", () => {
    render(
      <IntentSignalTray
        items={[
          { id: "1", contextLabel: "Shot 010", signal: TEST_SIGNAL_HIGH },
          { id: "2", contextLabel: "Shot 020", signal: TEST_SIGNAL_LOW },
        ]}
      />,
    );
    expect(screen.getByText("Shot 010")).toBeVisible();
    expect(screen.getByText("Human review required")).toBeVisible();
    expect(screen.getByText("Shot 020")).toBeVisible();
    expect(screen.getByText("Low attention")).toBeVisible();
  });

  it("caps at three items even when more are passed", () => {
    const items = Array.from({ length: 5 }, (_, i) => ({
      id: String(i),
      contextLabel: `Shot ${i}`,
      signal: TEST_SIGNAL_HIGH,
    }));
    render(<IntentSignalTray items={items} />);
    expect(screen.getAllByText(/^Shot \d$/)).toHaveLength(3);
  });

  it("renders an honest empty message when there are no signals", () => {
    render(<IntentSignalTray items={[]} />);
    expect(screen.getByText("No current Intent Signals")).toBeVisible();
  });

  it("labels a historical item explicitly, distinguishing it from the current one", () => {
    render(
      <IntentSignalTray
        items={[
          { id: "1", contextLabel: "Shot 010", signal: TEST_SIGNAL_HIGH },
          {
            id: "2",
            contextLabel: "Shot 020",
            signal: TEST_SIGNAL_LOW,
            historical: true,
          },
        ]}
      />,
    );
    expect(screen.getByText("Historical")).toBeVisible();
    // Only the second item is historical -- the label appears exactly once.
    expect(screen.getAllByText("Historical")).toHaveLength(1);
  });
});
