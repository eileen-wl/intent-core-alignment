import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SignalStrip } from "./SignalStrip";

afterEach(() => {
  cleanup();
});

describe("SignalStrip", () => {
  it("renders each item's real label and count, including zero counts (never hidden)", () => {
    render(
      <SignalStrip
        items={[
          { icon: "technical", label: "Technical", count: 0 },
          { icon: "coordination", label: "Coordination", count: 1 },
          { icon: "requirements", label: "Requirements", count: 3 },
          { icon: "question", label: "Questions", count: 1 },
          { icon: "evidence-gap", label: "Evidence gaps", count: 2 },
        ]}
      />,
    );

    for (const [label, count] of [
      ["Technical", "0"],
      ["Coordination", "1"],
      ["Requirements", "3"],
      ["Questions", "1"],
      ["Evidence gaps", "2"],
    ]) {
      const item = screen.getByText(label).closest("li")!;
      expect(within(item).getByText(count)).toBeVisible();
    }
  });

  it("never fabricates a count -- renders exactly the items passed in, in order", () => {
    render(
      <SignalStrip
        items={[
          { icon: "technical", label: "Technical", count: 5 },
          { icon: "question", label: "Questions", count: 2 },
        ]}
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText("Technical")).toBeVisible();
    expect(within(items[1]).getByText("Questions")).toBeVisible();
  });
});
