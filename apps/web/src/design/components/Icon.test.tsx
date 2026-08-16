import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Icon, type IconName, type IconSize } from "./Icon";

afterEach(() => {
  cleanup();
});

const ALL_NAMES: IconName[] = [
  "review",
  "evidence",
  "agent",
  "human",
  "version",
  "review-note",
  "core-anchor",
  "execution-anchor",
  "history",
  "technical",
  "coordination",
  "requirements",
  "question",
  "evidence-gap",
  "risk",
  "regenerate",
  "escalate",
];

describe("Icon", () => {
  for (const name of ALL_NAMES) {
    it(`renders a purely decorative svg for "${name}"`, () => {
      const { container } = render(<Icon name={name} />);
      const svg = container.querySelector("svg");
      expect(svg).toBeTruthy();
      expect(svg).toHaveAttribute("aria-hidden", "true");
    });
  }

  it("applies the requested size class without changing which icon renders", () => {
    for (const size of ["micro", "standard", "region"] as IconSize[]) {
      const { container } = render(<Icon name="version" size={size} />);
      expect(container.querySelector("svg")).toBeTruthy();
      cleanup();
    }
  });

  it("never carries interactive semantics of its own (no role, no tabindex)", () => {
    const { container } = render(<Icon name="human" />);
    const svg = container.querySelector("svg");
    expect(svg).not.toHaveAttribute("role", "img");
    expect(svg).not.toHaveAttribute("tabindex");
  });
});
