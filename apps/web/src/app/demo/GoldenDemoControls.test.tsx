import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { resetMock, completedMock } = vi.hoisted(() => ({
  resetMock: vi.fn(),
  completedMock: vi.fn(),
}));

vi.mock("./actions", () => ({
  resetGoldenJourney: resetMock,
  loadCompletedJourney: completedMock,
}));

import { GoldenDemoControls } from "./GoldenDemoControls";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("GoldenDemoControls", () => {
  it("shows the two protected Golden actions and disables both while pending", async () => {
    let resolveReset: ((value: unknown) => void) | undefined;
    resetMock.mockImplementation(
      () => new Promise((resolve) => (resolveReset = resolve)),
    );
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<GoldenDemoControls />);

    const reset = screen.getByRole("button", { name: "Reset Golden Journey" });
    const completed = screen.getByRole("button", {
      name: "Load Completed Journey",
    });
    await userEvent.click(reset);
    expect(reset).toBeDisabled();
    expect(completed).toBeDisabled();
    expect(
      screen.getByText(
        /Legacy fixtures, live records and ftrack-linked records/,
      ),
    ).toBeVisible();

    resolveReset?.({
      snapshot: "reset",
      shot_id: "golden-shot",
      task_ids: ["a", "b", "c"],
    });
    expect(await screen.findByText(/3 Golden Tasks/)).toBeVisible();
  });
});
