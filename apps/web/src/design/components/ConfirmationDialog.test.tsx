import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConfirmationDialog } from "./ConfirmationDialog";

afterEach(() => {
  cleanup();
});

function baseProps(
  overrides: Partial<Parameters<typeof ConfirmationDialog>[0]> = {},
) {
  return {
    open: true,
    title: "Confirm this Core Anchor revision?",
    description:
      "You are confirming revision #2 as the shared creative intent for Shot 010.",
    rationale:
      "Aligned the timing constraint after reviewing the cross-role assessment.",
    confirmLabel: "Confirm",
    pendingLabel: "Confirming…",
    pending: false,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
}

describe("ConfirmationDialog", () => {
  it("shows the title, description, and echoed rationale read-only", () => {
    render(<ConfirmationDialog {...baseProps()} />);
    expect(
      screen.getByText("Confirm this Core Anchor revision?"),
    ).toBeVisible();
    expect(
      screen.getByText(
        "You are confirming revision #2 as the shared creative intent for Shot 010.",
      ),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Aligned the timing constraint after reviewing the cross-role assessment.",
      ),
    ).toBeVisible();
  });

  it("focuses the primary Confirm button by default", () => {
    render(<ConfirmationDialog {...baseProps()} />);
    expect(screen.getByRole("button", { name: "Confirm" })).toHaveFocus();
  });

  it("focuses Cancel first when focusCancelFirst is set (Reject asymmetry)", () => {
    render(
      <ConfirmationDialog
        {...baseProps({ confirmLabel: "Reject", pendingLabel: "Rejecting…" })}
        focusCancelFirst
      />,
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("calls onCancel when Cancel is clicked", () => {
    const onCancel = vi.fn();
    render(<ConfirmationDialog {...baseProps({ onCancel })} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onConfirm when the primary action is clicked", () => {
    const onConfirm = vi.fn();
    render(<ConfirmationDialog {...baseProps({ onConfirm })} />);
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("disables both buttons and shows the pending label while pending", () => {
    render(<ConfirmationDialog {...baseProps({ pending: true })} />);
    expect(screen.getByRole("button", { name: "Confirming…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });

  it("does not close on Escape while pending (no double-submit escape hatch)", () => {
    const onCancel = vi.fn();
    const { container } = render(
      <ConfirmationDialog {...baseProps({ pending: true, onCancel })} />,
    );
    const dialog = container.querySelector("dialog") as HTMLDialogElement;
    const cancelEvent = new Event("cancel", { cancelable: true });
    dialog.dispatchEvent(cancelEvent);
    expect(onCancel).not.toHaveBeenCalled();
    expect(cancelEvent.defaultPrevented).toBe(true);
  });

  it("closes on Escape (cancel event) when not pending", () => {
    const onCancel = vi.fn();
    const { container } = render(
      <ConfirmationDialog {...baseProps({ onCancel })} />,
    );
    const dialog = container.querySelector("dialog") as HTMLDialogElement;
    dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("replaces the action row with a single Reload action on conflict", () => {
    const onReload = vi.fn();
    render(
      <ConfirmationDialog
        {...baseProps({
          conflictMessage:
            "This was already confirmed or rejected elsewhere -- reload to see the current state.",
          onReload,
        })}
      />,
    );
    expect(
      screen.getByText(
        "This was already confirmed or rejected elsewhere -- reload to see the current state.",
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Confirm" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Cancel" }),
    ).not.toBeInTheDocument();
    const reloadButton = screen.getByRole("button", { name: "Reload" });
    fireEvent.click(reloadButton);
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it("renders nothing visible via the native dialog when open is false", () => {
    const { container } = render(
      <ConfirmationDialog {...baseProps({ open: false })} />,
    );
    const dialog = container.querySelector("dialog") as HTMLDialogElement;
    expect(dialog.open).toBe(false);
  });
});
