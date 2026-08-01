import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./demo/actions", () => ({
  enterDemoRole: vi.fn(),
}));

import { enterDemoRole } from "./demo/actions";
import { RoleSelectionHome } from "./RoleSelectionHome";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("RoleSelectionHome", () => {
  it("renders no AppShell, sidebar, or Exit role view -- this is the pre-role-session entry surface", () => {
    render(<RoleSelectionHome />);
    expect(
      screen.queryByRole("navigation", { name: "Role navigation" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Exit role view" }),
    ).not.toBeInTheDocument();
  });

  it("offers exactly VFX Supervisor, CG Supervisor, and Artist -- no Guided or Explore card", () => {
    render(<RoleSelectionHome />);
    expect(screen.getByRole("heading", { name: "VFX Supervisor" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "CG Supervisor" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Artist" })).toBeVisible();
    expect(screen.queryByText(/guided/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/explore/i)).not.toBeInTheDocument();
  });

  it("VFX Supervisor and CG Supervisor are real, clickable entry actions; Artist remains Upcoming", () => {
    render(<RoleSelectionHome />);
    expect(
      screen.getByRole("button", { name: "Enter as VFX Supervisor" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Enter as CG Supervisor" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /Enter as Artist/ }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText("Upcoming")).toHaveLength(1);
  });

  it("selecting VFX Supervisor establishes the role session via the Server Action", async () => {
    render(<RoleSelectionHome />);
    await userEvent.click(
      screen.getByRole("button", { name: "Enter as VFX Supervisor" }),
    );
    expect(enterDemoRole).toHaveBeenCalledWith("vfx_supervisor");
  });

  it("selecting CG Supervisor establishes the role session via the Server Action", async () => {
    render(<RoleSelectionHome />);
    await userEvent.click(
      screen.getByRole("button", { name: "Enter as CG Supervisor" }),
    );
    expect(enterDemoRole).toHaveBeenCalledWith("cg_supervisor");
  });
});
