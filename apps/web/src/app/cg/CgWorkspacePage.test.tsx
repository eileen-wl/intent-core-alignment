import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CgWorkspacePage } from "./CgWorkspacePage";

afterEach(() => {
  cleanup();
});

describe("CgWorkspacePage", () => {
  it("renders the correct App Shell with fixed CG Supervisor identity", () => {
    render(<CgWorkspacePage onExitRole={vi.fn()} />);
    expect(screen.getByText("Daniel Ross")).toBeVisible();
    expect(screen.getByText("CG Supervisor")).toBeVisible();
  });

  it("renders the CG role sidebar with Execution Inbox current", () => {
    render(<CgWorkspacePage onExitRole={vi.fn()} />);
    expect(
      screen.getByRole("link", { name: "Execution Inbox" }),
    ).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Tasks")).toHaveAttribute("aria-disabled", "true");
  });

  it("shows the Execution Inbox title and an honest implementation-stage placeholder", () => {
    render(<CgWorkspacePage onExitRole={vi.fn()} />);
    expect(
      screen.getByRole("heading", { name: "Execution Inbox" }),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Workspace structure established. Production data and role-specific cards will be added in the next implementation batches.",
      ),
    ).toBeVisible();
  });

  it("does not show fake Task, Version, or Execution Anchor state", () => {
    render(<CgWorkspacePage onExitRole={vi.fn()} />);
    expect(
      screen.queryByText(/execution clarification required/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/compositing review/i)).not.toBeInTheDocument();
  });

  it("wires Exit role view to the provided callback", async () => {
    const onExitRole = vi.fn();
    render(<CgWorkspacePage onExitRole={onExitRole} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Exit role view" }),
    );
    expect(onExitRole).toHaveBeenCalled();
  });
});
