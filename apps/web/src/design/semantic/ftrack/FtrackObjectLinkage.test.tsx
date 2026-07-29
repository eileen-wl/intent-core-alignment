import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FtrackObjectLinkage } from "./FtrackObjectLinkage";

afterEach(() => {
  cleanup();
});

describe("FtrackObjectLinkage", () => {
  it("renders the linked state and object description", () => {
    render(<FtrackObjectLinkage objectType="Shot" source="ftrack" />);
    expect(screen.getByText("Linked to ftrack")).toBeVisible();
    expect(screen.getByText("This Shot originated from ftrack.")).toBeVisible();
  });

  it("renders the unlinked state honestly", () => {
    render(<FtrackObjectLinkage objectType="Task" source="manual" />);
    expect(screen.getByText("No linked ftrack entity")).toBeVisible();
    expect(
      screen.getByText(
        "This Task was created directly in ICAS; no ftrack entity is linked.",
      ),
    ).toBeVisible();
  });

  it("never fabricates a per-object sync timestamp", () => {
    render(<FtrackObjectLinkage objectType="Version" source="ftrack" />);
    expect(screen.getByText("Sync status unavailable.")).toBeVisible();
  });
});
