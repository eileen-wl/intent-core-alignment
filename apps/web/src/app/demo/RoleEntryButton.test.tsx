import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({
  enterDemoRole: vi.fn(),
}));

import { enterDemoRole } from "./actions";
import { RoleEntryButton } from "./RoleEntryButton";

beforeEach(() => {
  // `enterDemoRole` is a Server Action and always returns `Promise<void>`
  // in real usage -- matching that contract here (rather than `vi.fn()`'s
  // bare `undefined` default) is what lets `RoleEntryButton`'s `.finally()`
  // chain run safely. Tests exercising the pending window override this
  // with a controlled, not-yet-resolved promise.
  vi.mocked(enterDemoRole).mockResolvedValue(undefined);
});

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

  it("shows immediate pending feedback after a click, keeping the accepted role identity visible, and prevents a repeat invocation while pending (navigation-responsiveness fix)", async () => {
    let resolveAction!: () => void;
    vi.mocked(enterDemoRole).mockReturnValue(
      new Promise<void>((resolve) => {
        resolveAction = resolve;
      }),
    );

    render(
      <RoleEntryButton
        role="artist"
        label="Enter as Artist"
        pendingLabel="Entering as Artist…"
      />,
    );

    const button = screen.getByRole("button", { name: "Enter as Artist" });
    await userEvent.click(button);

    const pendingButton = screen.getByRole("button", {
      name: "Entering as Artist…",
    });
    expect(pendingButton).toBeDisabled();
    expect(pendingButton).toHaveAttribute("aria-busy", "true");
    expect(enterDemoRole).toHaveBeenCalledTimes(1);

    // Disabled means a real click event cannot reach the handler --
    // this asserts the same real invocation count is preserved, not a
    // second one, confirming no repeat call happened while pending.
    await userEvent.click(pendingButton);
    expect(enterDemoRole).toHaveBeenCalledTimes(1);

    resolveAction();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Enter as Artist" }),
      ).not.toBeDisabled(),
    );
  });

  it("falls back to a generic pending label when the caller does not provide one", async () => {
    let resolveAction!: () => void;
    vi.mocked(enterDemoRole).mockReturnValue(
      new Promise<void>((resolve) => {
        resolveAction = resolve;
      }),
    );

    render(
      <RoleEntryButton role="cg_supervisor" label="Enter as CG Supervisor" />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Enter as CG Supervisor" }),
    );

    expect(screen.getByRole("button", { name: "Entering…" })).toBeDisabled();
    resolveAction();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Enter as CG Supervisor" }),
      ).not.toBeDisabled(),
    );
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
