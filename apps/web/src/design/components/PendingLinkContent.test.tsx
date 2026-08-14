import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

let mockPending = false;
vi.mock("next/link", () => ({
  useLinkStatus: () => ({ pending: mockPending }),
}));

import { PendingLinkContent } from "./PendingLinkContent";

afterEach(() => {
  cleanup();
});

describe("PendingLinkContent", () => {
  it("renders nothing while its enclosing Link is not pending", () => {
    mockPending = false;
    const { container } = render(<PendingLinkContent label="Open Shot" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a restrained pending indicator and accessible status once its enclosing Link is pending", () => {
    mockPending = true;
    render(<PendingLinkContent label="Open Shot" />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading Open Shot…");
  });
});
