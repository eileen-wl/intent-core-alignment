import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FtrackLinkageBadge } from "./FtrackLinkageBadge";

afterEach(() => {
  cleanup();
});

describe("FtrackLinkageBadge", () => {
  it("renders the linked state from a real ftrack source value", () => {
    render(<FtrackLinkageBadge source="ftrack" />);
    expect(screen.getByText("Linked to ftrack")).toBeVisible();
  });

  it("renders the unlinked state honestly for a manual source value", () => {
    render(<FtrackLinkageBadge source="manual" />);
    expect(screen.getByText("No linked ftrack entity")).toBeVisible();
  });
});
