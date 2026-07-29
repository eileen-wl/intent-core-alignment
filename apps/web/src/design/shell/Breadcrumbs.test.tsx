import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Breadcrumbs } from "./Breadcrumbs";

afterEach(() => {
  cleanup();
});

describe("Breadcrumbs", () => {
  it("renders a single current-location crumb without a link", () => {
    render(<Breadcrumbs items={[{ label: "Alignment Inbox" }]} />);
    const current = screen.getByText("Alignment Inbox");
    expect(current).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders earlier segments as links and the last as current", () => {
    render(
      <Breadcrumbs
        items={[
          { label: "Projects", href: "/vfx/projects" },
          { label: "D1 Demo Project", href: "/vfx/projects/d1" },
          { label: "Shot 010" },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute(
      "href",
      "/vfx/projects",
    );
    expect(screen.getByRole("link", { name: "D1 Demo Project" })).toBeVisible();
    const current = screen.getByText("Shot 010");
    expect(current).toHaveAttribute("aria-current", "page");
  });

  it("exposes an accessible breadcrumb landmark", () => {
    render(<Breadcrumbs items={[{ label: "My Tasks" }]} />);
    expect(
      screen.getByRole("navigation", { name: "Breadcrumb" }),
    ).toBeVisible();
  });
});
