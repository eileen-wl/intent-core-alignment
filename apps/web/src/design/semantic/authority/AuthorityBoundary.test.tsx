import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AuthorityBoundary } from "./AuthorityBoundary";

afterEach(() => {
  cleanup();
});

describe("AuthorityBoundary", () => {
  it("renders the authority-type label, owner, and statement as visible text", () => {
    render(
      <AuthorityBoundary
        tone="human"
        label={<span>Human-confirmed</span>}
        ownerLabel="Human VFX Supervisor"
        statement="controls the Core Anchor."
      >
        <p>Extra detail</p>
      </AuthorityBoundary>,
    );
    expect(screen.getByText("Human-confirmed")).toBeVisible();
    expect(screen.getByText("Human VFX Supervisor")).toBeVisible();
    expect(screen.getByText(/controls the Core Anchor\./)).toBeVisible();
    expect(screen.getByText("Extra detail")).toBeVisible();
  });

  it("renders without a supporting-detail body when no children are given", () => {
    render(
      <AuthorityBoundary
        tone="agent"
        label={<span>AI interpretation</span>}
        ownerLabel="Core Agent"
        statement="produced this interpretation."
      />,
    );
    expect(screen.getByText("AI interpretation")).toBeVisible();
    expect(screen.getByText("Core Agent")).toBeVisible();
  });
});
