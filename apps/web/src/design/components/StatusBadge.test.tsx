import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { StatusBadge, type StatusBadgeStatus } from "./StatusBadge";

afterEach(() => {
  cleanup();
});

const STATUSES: StatusBadgeStatus[] = [
  "neutral",
  "active",
  "confirmed",
  "attention",
  "blocking",
  "historical",
  "integration-ready",
  "unavailable",
];

describe("StatusBadge", () => {
  for (const status of STATUSES) {
    it(`renders the caller-supplied label for status "${status}"`, () => {
      render(<StatusBadge status={status} label={`Label for ${status}`} />);
      expect(screen.getByText(`Label for ${status}`)).toBeVisible();
    });
  }

  it("does not hardcode a production-specific label", () => {
    render(<StatusBadge status="attention" label="Custom caller wording" />);
    expect(screen.getByText("Custom caller wording")).toBeVisible();
    expect(screen.queryByText("Attention")).not.toBeInTheDocument();
  });
});
