import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DevIndexPage } from "./DevIndexPage";

afterEach(() => {
  cleanup();
});

describe("DevIndexPage", () => {
  it("is clearly labelled as Development mode", () => {
    render(<DevIndexPage />);
    expect(screen.getByText("Development mode")).toBeVisible();
    expect(
      screen.getByRole("heading", { level: 1, name: "Development" }),
    ).toBeVisible();
  });

  it("links to the UI Foundation preview", () => {
    render(<DevIndexPage />);
    expect(
      screen.getByRole("link", { name: "Open UI Foundation preview" }),
    ).toHaveAttribute("href", "/dev/ui-foundation");
  });

  it("links to the Semantic Components preview", () => {
    render(<DevIndexPage />);
    expect(
      screen.getByRole("link", { name: "Open Semantic Components preview" }),
    ).toHaveAttribute("href", "/dev/semantic-components");
  });

  it("links to the legacy Shot smoke test, labelled as an engineering surface", () => {
    render(<DevIndexPage />);
    expect(
      screen.getByText(/engineering \/ manual smoke-test surface/i),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Open legacy Shot smoke test" }),
    ).toHaveAttribute("href", "/shots");
  });
});
