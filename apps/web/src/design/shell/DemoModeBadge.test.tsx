import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DemoModeBadge } from "./DemoModeBadge";

afterEach(() => {
  cleanup();
});

describe("DemoModeBadge", () => {
  it("renders the fixed 'Demo mode' label", () => {
    render(<DemoModeBadge />);
    expect(screen.getByText("Demo mode")).toBeVisible();
  });
});
