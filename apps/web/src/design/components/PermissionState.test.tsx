import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PermissionState } from "./PermissionState";

afterEach(() => {
  cleanup();
});

describe("PermissionState", () => {
  it("defaults to the required 'Read-only for your role' wording", () => {
    render(<PermissionState />);
    expect(screen.getByText("Read-only for your role")).toBeVisible();
  });

  it("accepts a custom title and description", () => {
    render(
      <PermissionState
        title="Supervisor-only Anchor comparison"
        description="Ask a VFX Supervisor to confirm this Anchor."
      />,
    );
    expect(screen.getByText("Supervisor-only Anchor comparison")).toBeVisible();
    expect(
      screen.getByText("Ask a VFX Supervisor to confirm this Anchor."),
    ).toBeVisible();
  });

  it("is not rendered with an alert role -- a permission boundary is not an error", () => {
    render(<PermissionState />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
