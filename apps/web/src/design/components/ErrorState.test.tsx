import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ErrorState } from "./ErrorState";

afterEach(() => {
  cleanup();
});

describe("ErrorState", () => {
  it("renders the title and optional description", () => {
    render(
      <ErrorState
        title="Agent Run failed"
        description="The provider returned an invalid response."
      />,
    );
    expect(screen.getByText("Agent Run failed")).toBeVisible();
    expect(
      screen.getByText("The provider returned an invalid response."),
    ).toBeVisible();
  });

  it("exposes an accessible alert role so assistive technology announces it", () => {
    render(<ErrorState title="Agent Run failed" />);
    expect(screen.getByRole("alert")).toBeVisible();
  });

  it("renders an optional retry action", () => {
    render(
      <ErrorState
        title="Agent Run failed"
        action={<button type="button">Retry</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
  });
});
