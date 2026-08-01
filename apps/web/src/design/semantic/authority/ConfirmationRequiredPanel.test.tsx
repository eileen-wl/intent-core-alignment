import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ConfirmationRequiredPanel } from "./ConfirmationRequiredPanel";

afterEach(() => {
  cleanup();
});

describe("ConfirmationRequiredPanel", () => {
  it("names the required human role", () => {
    render(
      <ConfirmationRequiredPanel
        gateType="core_anchor_confirmation"
        requiredRole="vfx_supervisor"
        openedAt="2026-07-21T08:00:00Z"
      />,
    );
    expect(screen.getByText(/Human VFX Supervisor/)).toBeVisible();
  });

  it("never renders a Confirm, Reject, or Apply control", () => {
    render(
      <ConfirmationRequiredPanel
        gateType="execution_anchor_confirmation"
        requiredRole="cg_supervisor"
        openedAt="2026-07-21T08:00:00Z"
      />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
