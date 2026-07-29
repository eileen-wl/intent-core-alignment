import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ContextSnapshotReference } from "./ContextSnapshotReference";

afterEach(() => {
  cleanup();
});

describe("ContextSnapshotReference", () => {
  it("renders the snapshot id and capture time", () => {
    render(
      <ContextSnapshotReference
        snapshot={{
          id: "snapshot-1",
          shot_id: "shot-1",
          payload: {},
          created_at: "2026-07-20T09:57:00Z",
        }}
      />,
    );
    expect(screen.getByText("snapshot-1")).toBeVisible();
    expect(screen.getByText("2026-07-20T09:57:00Z")).toBeVisible();
  });

  it("renders an honest unavailable state when no snapshot is provided", () => {
    render(<ContextSnapshotReference snapshot={null} />);
    expect(screen.getByText("Context snapshot unavailable.")).toBeVisible();
  });

  it("never renders the raw payload", () => {
    render(
      <ContextSnapshotReference
        snapshot={{
          id: "snapshot-1",
          shot_id: "shot-1",
          payload: { secret: "should-not-render" },
          created_at: "2026-07-20T09:57:00Z",
        }}
      />,
    );
    expect(screen.queryByText(/should-not-render/)).not.toBeInTheDocument();
  });
});
