import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ExitRoleControl } from "./ExitRoleControl";

afterEach(() => {
  cleanup();
});

describe("ExitRoleControl", () => {
  it("renders a clearly labelled 'Exit role view' control", () => {
    render(<ExitRoleControl onExit={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: "Exit role view" }),
    ).toBeVisible();
  });

  it("invokes the provided callback when activated", async () => {
    const onExit = vi.fn();
    render(<ExitRoleControl onExit={onExit} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Exit role view" }),
    );
    expect(onExit).toHaveBeenCalled();
  });
});
