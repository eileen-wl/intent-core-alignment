import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FtrackSyncSummary } from "./FtrackSyncSummary";

afterEach(() => {
  cleanup();
});

describe("FtrackSyncSummary", () => {
  it("renders the reconciliation cursor when available", () => {
    render(
      <FtrackSyncSummary
        cursor={{
          key: "ftrack_shot_reconciliation",
          last_synced_at: "2026-07-21T06:00:00Z",
          updated_at: "2026-07-21T06:00:05Z",
        }}
      />,
    );
    expect(screen.getByText("ftrack_shot_reconciliation")).toBeVisible();
    expect(screen.getByText("2026-07-21T06:00:00Z")).toBeVisible();
  });

  it("renders an honest not-yet-run state instead of a fabricated timestamp", () => {
    render(<FtrackSyncSummary cursor={null} />);
    expect(screen.getByText("No reconciliation has run yet.")).toBeVisible();
  });
});
