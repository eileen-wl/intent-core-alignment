import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { WorkingDirectionSection as WorkingDirectionSectionModel } from "@/lib/workingDirection";
import { WorkingDirectionSection } from "./WorkingDirectionSection";

afterEach(() => {
  cleanup();
});

function section(
  overrides: Partial<WorkingDirectionSectionModel> = {},
): WorkingDirectionSectionModel {
  return {
    title: "Current Creative Direction",
    items: [
      {
        id: "creative-objective",
        label: "Current creative objective",
        value: "A restrained dusk confrontation.",
        authority: "human-confirmed",
        sourceType: "core_anchor_revision",
        sourceId: "rev1",
        detail: "Confirmed by VFX Supervisor",
        href: "/vfx/shots/s1/intent",
      },
    ],
    ...overrides,
  };
}

describe("WorkingDirectionSection", () => {
  it("renders nothing when there are no items", () => {
    const { container } = render(
      <WorkingDirectionSection section={section({ items: [] })} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders exactly one concise authority badge, never a duplicated marker/label pair", () => {
    render(<WorkingDirectionSection section={section()} />);
    expect(screen.getByText("Human-confirmed")).toBeVisible();
    expect(screen.queryByText("CONFIRMED")).not.toBeInTheDocument();
  });

  it("renders provenance detail separately from the value text", () => {
    render(<WorkingDirectionSection section={section()} />);
    expect(screen.getByText("A restrained dusk confrontation.")).toBeVisible();
    expect(screen.getByText("Confirmed by VFX Supervisor")).toBeVisible();
  });

  it("renders no authority badge for an item with no backing object", () => {
    render(
      <WorkingDirectionSection
        section={section({
          items: [
            {
              id: "creative-objective",
              label: "Current creative objective",
              value: "No confirmed Core Anchor yet.",
              sourceType: "core_anchor_revision",
            },
          ],
        })}
      />,
    );
    expect(screen.getByText("No confirmed Core Anchor yet.")).toBeVisible();
    expect(screen.queryByText("Human-confirmed")).not.toBeInTheDocument();
  });

  it("renders a separate 'View details' link rather than making the whole value a link", () => {
    render(<WorkingDirectionSection section={section()} />);
    const value = screen.getByText("A restrained dusk confrontation.");
    expect(value.closest("a")).toBeNull();

    const link = screen.getByRole("link", { name: "View details" });
    expect(link).toHaveAttribute("href", "/vfx/shots/s1/intent");
  });

  it("omits the 'View details' link when the item has no href", () => {
    render(
      <WorkingDirectionSection
        section={section({
          items: [
            {
              id: "creative-objective",
              label: "Current creative objective",
              value: "A restrained dusk confrontation.",
              authority: "human-confirmed",
              sourceType: "core_anchor_revision",
            },
          ],
        })}
      />,
    );
    expect(
      screen.queryByRole("link", { name: "View details" }),
    ).not.toBeInTheDocument();
  });
});
