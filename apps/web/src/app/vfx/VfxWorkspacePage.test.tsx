import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { VfxWorkspacePage } from "./VfxWorkspacePage";

afterEach(() => {
  cleanup();
});

describe("VfxWorkspacePage", () => {
  it("renders the correct App Shell with fixed VFX Supervisor identity", () => {
    render(<VfxWorkspacePage onExitRole={vi.fn()} />);
    expect(screen.getByText("Maya Chen")).toBeVisible();
    expect(screen.getByText("VFX Supervisor")).toBeVisible();
    expect(screen.getByText("Demo mode")).toBeVisible();
  });

  it("renders the VFX role sidebar with Alignment Inbox current", () => {
    render(<VfxWorkspacePage onExitRole={vi.fn()} />);
    expect(
      screen.getByRole("link", { name: "Alignment Inbox" }),
    ).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Projects")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("shows the Alignment Inbox title and an honest implementation-stage placeholder", () => {
    render(<VfxWorkspacePage onExitRole={vi.fn()} />);
    expect(
      screen.getByRole("heading", { name: "Alignment Inbox" }),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Workspace structure established. Production data and role-specific cards will be added in the next implementation batches.",
      ),
    ).toBeVisible();
  });

  it("does not show fake production metrics, Signal, Task, Shot, or Integration state", () => {
    render(<VfxWorkspacePage onExitRole={vi.fn()} />);
    expect(
      screen.queryByText(/human review required/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/shot 010/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/linked to ftrack/i)).not.toBeInTheDocument();
  });

  it("wires Exit role view to the provided callback", async () => {
    const onExitRole = vi.fn();
    render(<VfxWorkspacePage onExitRole={onExitRole} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Exit role view" }),
    );
    expect(onExitRole).toHaveBeenCalled();
  });
});
