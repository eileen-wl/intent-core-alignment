import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TopBar } from "./TopBar";

afterEach(() => {
  cleanup();
});

describe("TopBar", () => {
  it("shows the product name, current identity, role, and Demo mode badge", () => {
    render(
      <TopBar name="Maya Chen" role="VFX Supervisor" onExitRole={vi.fn()} />,
    );
    expect(screen.getByText("ICAS")).toBeVisible();
    expect(screen.getByText("Maya Chen")).toBeVisible();
    expect(screen.getByText("VFX Supervisor")).toBeVisible();
    expect(screen.getByText("Demo mode")).toBeVisible();
  });

  it("provides the Exit role view control and wires it to onExitRole", async () => {
    const onExitRole = vi.fn();
    render(
      <TopBar name="Maya Chen" role="VFX Supervisor" onExitRole={onExitRole} />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Exit role view" }),
    );
    expect(onExitRole).toHaveBeenCalled();
  });

  it("never shows a role dropdown, Actor ID field, or fabricated Signal count", () => {
    render(
      <TopBar name="Maya Chen" role="VFX Supervisor" onExitRole={vi.fn()} />,
    );
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/actor/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^\d+ signals?$/i)).not.toBeInTheDocument();
  });
});
