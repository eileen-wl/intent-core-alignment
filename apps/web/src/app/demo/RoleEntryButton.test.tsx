import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({
  enterDemoRole: vi.fn(),
}));

import { enterDemoRole } from "./actions";
import { RoleEntryButton } from "./RoleEntryButton";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("RoleEntryButton", () => {
  it("renders the provided label", () => {
    render(
      <RoleEntryButton role="vfx_supervisor" label="Enter as VFX Supervisor" />,
    );
    expect(
      screen.getByRole("button", { name: "Enter as VFX Supervisor" }),
    ).toBeVisible();
  });

  it("calls the enterDemoRole Server Action with the correct role when activated", async () => {
    render(
      <RoleEntryButton role="cg_supervisor" label="Enter as CG Supervisor" />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Enter as CG Supervisor" }),
    );
    expect(enterDemoRole).toHaveBeenCalledWith("cg_supervisor", null);
  });

  it("calls enterDemoRole for the Artist role too", async () => {
    render(<RoleEntryButton role="artist" label="Enter as Artist" />);
    await userEvent.click(
      screen.getByRole("button", { name: "Enter as Artist" }),
    );
    expect(enterDemoRole).toHaveBeenCalledWith("artist", null);
  });

  it("calls enterDemoRole for the VFX Supervisor role", async () => {
    render(
      <RoleEntryButton role="vfx_supervisor" label="Enter as VFX Supervisor" />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Enter as VFX Supervisor" }),
    );
    expect(enterDemoRole).toHaveBeenCalledWith("vfx_supervisor", null);
  });

  it("forwards a provided returnTo to the Server Action", async () => {
    render(
      <RoleEntryButton
        role="cg_supervisor"
        label="Enter as CG Supervisor"
        returnTo="/cg/tasks/t1/execution"
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Enter as CG Supervisor" }),
    );
    expect(enterDemoRole).toHaveBeenCalledWith(
      "cg_supervisor",
      "/cg/tasks/t1/execution",
    );
  });
});
