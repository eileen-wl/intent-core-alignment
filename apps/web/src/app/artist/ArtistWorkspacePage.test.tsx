import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ArtistWorkspacePage } from "./ArtistWorkspacePage";

afterEach(() => {
  cleanup();
});

describe("ArtistWorkspacePage", () => {
  it("renders the correct App Shell with fixed Artist identity", () => {
    render(<ArtistWorkspacePage onExitRole={vi.fn()} />);
    expect(screen.getByText("Lena Park")).toBeVisible();
    expect(screen.getByText("Artist")).toBeVisible();
  });

  it("renders the Artist role sidebar with My Tasks current", () => {
    render(<ArtistWorkspacePage onExitRole={vi.fn()} />);
    expect(screen.getByRole("link", { name: "My Tasks" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByText("Intent Signals")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("shows the My Tasks title and an honest implementation-stage placeholder", () => {
    render(<ArtistWorkspacePage onExitRole={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "My Tasks" })).toBeVisible();
    expect(
      screen.getByText(
        "Workspace structure established. Production data and role-specific cards will be added in the next implementation batches.",
      ),
    ).toBeVisible();
  });

  it("does not show fake Task, Version, or feedback data", () => {
    render(<ArtistWorkspacePage onExitRole={vi.fn()} />);
    expect(
      screen.queryByText(/supervisor clarification pending/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/d1_step3_vfx_review_001/i),
    ).not.toBeInTheDocument();
  });

  it("wires Exit role view to the provided callback", async () => {
    const onExitRole = vi.fn();
    render(<ArtistWorkspacePage onExitRole={onExitRole} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Exit role view" }),
    );
    expect(onExitRole).toHaveBeenCalled();
  });
});
