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
    expect(screen.getByText("Guided portfolio demonstration")).toBeVisible();
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

  describe("primary guided-demo entry", () => {
    it("renders one dominant 'Start guided demonstration' action", () => {
      render(<DemoEntryPage />);
      expect(
        screen.getByRole("button", { name: "Start guided demonstration" }),
      ).toBeVisible();
    });

    it("enters as VFX Supervisor when activated", async () => {
      render(<DemoEntryPage />);
      await userEvent.click(
        screen.getByRole("button", { name: "Start guided demonstration" }),
      );
      expect(enterDemoRole).toHaveBeenCalledWith("vfx_supervisor");
    });

    it("explains that the guided path will move through CG and Artist perspectives later", () => {
      render(<DemoEntryPage />);
      expect(
        screen.getByText(/move through CG Supervisor and Artist perspectives/i),
      ).toBeVisible();
    });
  });

  describe("ftrack production-entry explanation", () => {
    it("explains the future ftrack launch without an active or fake control", () => {
      render(<DemoEntryPage />);
      expect(
        screen.getByText(
          /production users will ultimately launch icas directly from ftrack/i,
        ),
      ).toBeVisible();
      expect(
        screen.queryByRole("button", { name: /launch from ftrack/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: /launch from ftrack/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("secondary 'Explore by role' entry", () => {
    it("is present and visually secondary to the guided-demo action", async () => {
      render(<DemoEntryPage />);
      const disclosure = screen.getByText("Explore by role");
      expect(disclosure).toBeVisible();
      // Collapsed by default -- a quieter, progressive-disclosure entry.
      expect(disclosure.closest("details")).not.toHaveAttribute("open");
    });

    it("renders all three role-entry cards once expanded", async () => {
      render(<DemoEntryPage />);
      await userEvent.click(screen.getByText("Explore by role"));

      expect(
        screen.getByRole("heading", { name: "VFX Supervisor" }),
      ).toBeVisible();
      expect(
        screen.getByText(
          "Protects the shared creative intent across departments.",
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

    it("enters the VFX Supervisor role when its direct card is activated", async () => {
      render(<DemoEntryPage />);
      await userEvent.click(screen.getByText("Explore by role"));
      await userEvent.click(
        screen.getByRole("button", { name: "Enter as VFX Supervisor" }),
      );
      expect(enterDemoRole).toHaveBeenCalledWith("vfx_supervisor");
    });

    it("enters the CG Supervisor role when its direct card is activated", async () => {
      render(<DemoEntryPage />);
      await userEvent.click(screen.getByText("Explore by role"));
      await userEvent.click(
        screen.getByRole("button", { name: "Enter as CG Supervisor" }),
      );
      expect(enterDemoRole).toHaveBeenCalledWith("cg_supervisor");
    });

    it("enters the Artist role when its direct card is activated", async () => {
      render(<DemoEntryPage />);
      await userEvent.click(screen.getByText("Explore by role"));
      await userEvent.click(
        screen.getByRole("button", { name: "Enter as Artist" }),
      );
      expect(enterDemoRole).toHaveBeenCalledWith("artist");
    });

    it("keeps the disclosure summary keyboard accessible", () => {
      render(<DemoEntryPage />);
      const summary = screen.getByText("Explore by role");
      expect(summary.tagName.toLowerCase()).toBe("summary");
    });
  });

  it("uses the same role literal for the guided CTA and the direct VFX entry", async () => {
    render(<DemoEntryPage />);
    await userEvent.click(
      screen.getByRole("button", { name: "Start guided demonstration" }),
    );
    await userEvent.click(screen.getByText("Explore by role"));
    await userEvent.click(
      screen.getByRole("button", { name: "Enter as VFX Supervisor" }),
    );

    expect(enterDemoRole).toHaveBeenNthCalledWith(1, "vfx_supervisor");
    expect(enterDemoRole).toHaveBeenNthCalledWith(2, "vfx_supervisor");
  });

  it("does not display technical IDs, permission matrices, or raw session values", () => {
    render(<DemoEntryPage />);
    expect(
      screen.queryByText(/[0-9a-f]{8}-[0-9a-f]{4}-/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/permission matrix/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/actor id/i)).not.toBeInTheDocument();
  });
});
