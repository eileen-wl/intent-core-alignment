import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { EmptyState } from "./EmptyState";

afterEach(() => {
  cleanup();
});

describe("EmptyState", () => {
  it("renders the title and optional description", () => {
    render(
      <EmptyState
        title="No Shots yet"
        description="Create a Shot to get started."
      />,
    );
    expect(screen.getByText("No Shots yet")).toBeVisible();
    expect(screen.getByText("Create a Shot to get started.")).toBeVisible();
  });

  it("exposes an accessible status role", () => {
    render(<EmptyState title="No Shots yet" />);
    expect(screen.getByRole("status")).toBeVisible();
  });

  it("renders an optional action", () => {
    render(
      <EmptyState
        title="No Shots yet"
        action={<button type="button">Create Shot</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Create Shot" })).toBeVisible();
  });
});
