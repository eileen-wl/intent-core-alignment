import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({
  enterDemoRole: vi.fn(),
  startGuidedDemonstration: vi.fn(),
  exitRoleView: vi.fn(),
}));

import {
  enterDemoRole,
  exitRoleView,
  startGuidedDemonstration,
} from "./actions";
import { DemoEntryPage } from "./DemoEntryPage";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("DemoEntryPage", () => {
  it("renders the reference entry hierarchy inside the role-aware shell", () => {
    render(<DemoEntryPage />);

    expect(screen.getByText("ICAS")).toBeVisible();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Choose how you want to enter ICAS",
      }),
    ).toBeVisible();
    expect(screen.getByText("Maya Chen")).toBeVisible();
    expect(screen.getByText("VFX Supervisor")).toBeVisible();
    expect(screen.getByText("Demo mode")).toBeVisible();
  });

  it("shows the featured D1 Shot and approved version identifier", () => {
    render(<DemoEntryPage />);
    expect(
      screen.getByRole("heading", {
        name: "Shot 010 — Final confrontation",
      }),
    ).toBeVisible();
    expect(screen.getByText("D1 Demo Project")).toBeVisible();
    expect(screen.getByText("No linked ftrack entity")).toBeVisible();
    expect(screen.getByText("D1_STEP3_VFX_REVIEW_001 (v1)")).toBeVisible();
  });

  it("starts the guided demonstration through the existing guided Server Action", async () => {
    render(<DemoEntryPage />);
    await userEvent.click(
      screen.getByRole("button", { name: "Start guided demonstration" }),
    );

    expect(startGuidedDemonstration).toHaveBeenCalledTimes(1);
    expect(enterDemoRole).not.toHaveBeenCalled();
  });

  it("enters the VFX Alignment Inbox through the existing role Server Action", async () => {
    render(<DemoEntryPage />);
    await userEvent.click(
      screen.getByRole("button", { name: "Browse Alignment Inbox" }),
    );

    expect(enterDemoRole).toHaveBeenCalledWith("vfx_supervisor");
    expect(startGuidedDemonstration).not.toHaveBeenCalled();
  });

  it("keeps Exit role view connected to the existing exit Server Action", async () => {
    render(<DemoEntryPage />);
    await userEvent.click(
      screen.getByRole("button", { name: "Exit role view" }),
    );
    expect(exitRoleView).toHaveBeenCalledTimes(1);
  });

  it("presents future ftrack launch honestly without an active launch control", () => {
    render(<DemoEntryPage />);
    expect(screen.getByText("Future ftrack launch")).toBeVisible();
    expect(screen.getByText("Not available in demo")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /launch from ftrack/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /launch from ftrack/i }),
    ).not.toBeInTheDocument();
  });

  it("does not show a guided-entry failure notice by default", () => {
    render(<DemoEntryPage />);
    expect(
      screen.queryByText(/guided demonstration couldn't start/i),
    ).not.toBeInTheDocument();
  });

  it("shows an honest inline error when guided entry failed", () => {
    render(<DemoEntryPage guidedEntryError />);
    expect(
      screen.getByText("The guided demonstration couldn't start"),
    ).toBeVisible();
    expect(screen.getByText(/ICAS service is unavailable/i)).toBeVisible();
  });

  it("does not expose UUIDs, permission matrices, or actor identifiers", () => {
    render(<DemoEntryPage />);
    expect(
      screen.queryByText(/[0-9a-f]{8}-[0-9a-f]{4}-/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/permission matrix/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/actor id/i)).not.toBeInTheDocument();
  });
});
