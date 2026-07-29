import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({
  enterDemoRole: vi.fn(),
}));

import { enterDemoRole } from "./actions";
import { DemoEntryPage } from "./DemoEntryPage";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("DemoEntryPage", () => {
  it("shows the ICAS product name and a concise explanation", () => {
    render(<DemoEntryPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "ICAS" }),
    ).toBeVisible();
    expect(screen.getByText(/shared creative intent connected/i)).toBeVisible();
  });

  it("shows the shared scenario summary with the approved identifiers", () => {
    render(<DemoEntryPage />);
    expect(
      screen.getByText("D1 Demo Project · Shot 010 — Final confrontation"),
    ).toBeVisible();
    expect(screen.getByText("Compositing Review")).toBeVisible();
    expect(screen.getByText("D1_STEP3_VFX_REVIEW_001")).toBeVisible();
  });

  it("renders all three role-entry cards with responsibility and question", () => {
    render(<DemoEntryPage />);

    expect(
      screen.getByRole("heading", { name: "VFX Supervisor" }),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Protects the shared creative intent across departments.",
      ),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Where does cross-role interpretation require human coordination?",
      ),
    ).toBeVisible();

    expect(
      screen.getByRole("heading", { name: "CG Supervisor" }),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Turns confirmed intent into department execution boundaries.",
      ),
    ).toBeVisible();

    expect(screen.getByRole("heading", { name: "Artist" })).toBeVisible();
    expect(
      screen.getByText(
        "Works from practical guidance and confirmed variation boundaries.",
      ),
    ).toBeVisible();
  });

  it("enters the VFX Supervisor role when its card is activated", async () => {
    render(<DemoEntryPage />);
    await userEvent.click(
      screen.getByRole("button", { name: "Enter as VFX Supervisor" }),
    );
    expect(enterDemoRole).toHaveBeenCalledWith("vfx_supervisor");
  });

  it("enters the CG Supervisor role when its card is activated", async () => {
    render(<DemoEntryPage />);
    await userEvent.click(
      screen.getByRole("button", { name: "Enter as CG Supervisor" }),
    );
    expect(enterDemoRole).toHaveBeenCalledWith("cg_supervisor");
  });

  it("enters the Artist role when its card is activated", async () => {
    render(<DemoEntryPage />);
    await userEvent.click(
      screen.getByRole("button", { name: "Enter as Artist" }),
    );
    expect(enterDemoRole).toHaveBeenCalledWith("artist");
  });

  it("does not display technical IDs or a permission matrix", () => {
    render(<DemoEntryPage />);
    expect(
      screen.queryByText(/[0-9a-f]{8}-[0-9a-f]{4}-/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/permission matrix/i)).not.toBeInTheDocument();
  });
});
