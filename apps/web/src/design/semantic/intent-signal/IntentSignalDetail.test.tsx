import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { IntentSignalDetail } from "./IntentSignalDetail";
import { TEST_SIGNAL_HIGH } from "./intentSignalTestFixtures";

afterEach(() => {
  cleanup();
});

describe("IntentSignalDetail", () => {
  it("renders the summary, attention level, and re-anchor proposal flag", () => {
    render(
      <IntentSignalDetail signal={TEST_SIGNAL_HIGH} role="vfx_supervisor" />,
    );
    expect(
      screen.getByText("A high-priority cross-role tension was identified."),
    ).toBeVisible();
    // "high" appears both as the attention-level fact and as a driver's
    // priority tag -- both are expected here.
    expect(screen.getAllByText("high").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Present")).toBeVisible();
  });

  it("renders drivers with their priority and source", () => {
    render(<IntentSignalDetail signal={TEST_SIGNAL_HIGH} />);
    expect(screen.getByText("Cross-role tension")).toBeVisible();
    expect(
      screen.getByText(
        "Camera timing is interpreted differently across roles.",
      ),
    ).toBeVisible();
  });

  it("renders role coverage as readable text, not colour-only icons", () => {
    render(<IntentSignalDetail signal={TEST_SIGNAL_HIGH} />);
    expect(
      screen.getByText(/covered: vfx_supervisor, cg_supervisor/i),
    ).toBeVisible();
    expect(screen.getByText(/not covered: artist/i)).toBeVisible();
  });

  it("marks the latest result as latest without a historical label", () => {
    render(<IntentSignalDetail signal={TEST_SIGNAL_HIGH} variant="latest" />);
    expect(screen.queryByText("Historical")).not.toBeInTheDocument();
  });

  it("marks a historical result distinctly from the current one", () => {
    render(
      <IntentSignalDetail signal={TEST_SIGNAL_HIGH} variant="historical" />,
    );
    expect(screen.getByText("Historical")).toBeVisible();
  });

  it("renders the primary conclusion before the attention-level facts", () => {
    render(
      <IntentSignalDetail signal={TEST_SIGNAL_HIGH} role="vfx_supervisor" />,
    );
    const conclusion = screen.getByText("Human review required");
    const facts = screen.getByText("Attention level");
    expect(
      conclusion.compareDocumentPosition(facts) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("renders an optional provenance section only when supplied", () => {
    const { rerender } = render(
      <IntentSignalDetail signal={TEST_SIGNAL_HIGH} />,
    );
    expect(screen.queryByText("Provenance")).not.toBeInTheDocument();

    rerender(
      <IntentSignalDetail
        signal={TEST_SIGNAL_HIGH}
        provenance={<p>Supporting assessment reference</p>}
      />,
    );
    expect(screen.getByText("Provenance")).toBeVisible();
    expect(screen.getByText("Supporting assessment reference")).toBeVisible();
  });
});
