import { cleanup, render, screen } from "@testing-library/react";
import type { WritebackRecordRead } from "@intent-core/contracts";
import { afterEach, describe, expect, it } from "vitest";

import { IntegrationAvailabilityNotice } from "./IntegrationAvailabilityNotice";

afterEach(() => {
  cleanup();
});

const PENDING: WritebackRecordRead = {
  id: "wb-1",
  entity_type: "core_anchor_revision",
  entity_id: "revision-1",
  source: "ftrack",
  target_external_id: "external-1",
  content: "Core Anchor revision 3 confirmed.",
  status: "pending",
  external_note_id: null,
  error: null,
  created_at: "2026-07-21T09:00:00Z",
  completed_at: null,
};

describe("IntegrationAvailabilityNotice", () => {
  it("renders an honest not-requested state when no write-back exists", () => {
    render(<IntegrationAvailabilityNotice writeback={null} />);
    expect(
      screen.getByText("Controlled write-back not requested"),
    ).toBeVisible();
  });

  it("renders the pending state", () => {
    render(<IntegrationAvailabilityNotice writeback={PENDING} />);
    expect(screen.getByText("Write-back pending")).toBeVisible();
  });

  it("renders the succeeded state", () => {
    render(
      <IntegrationAvailabilityNotice
        writeback={{
          ...PENDING,
          status: "succeeded",
          completed_at: "2026-07-21T09:05:00Z",
        }}
      />,
    );
    expect(screen.getByText("Write-back succeeded")).toBeVisible();
  });

  it("renders the failed state honestly with its sanitised error", () => {
    render(
      <IntegrationAvailabilityNotice
        writeback={{
          ...PENDING,
          status: "failed",
          error: "ftrack API returned a permission error.",
        }}
      />,
    );
    expect(screen.getByRole("alert")).toBeVisible();
    expect(
      screen.getByText("ftrack API returned a permission error."),
    ).toBeVisible();
  });

  it("never renders a retry, launch, sync, or write-back execution control", () => {
    render(<IntegrationAvailabilityNotice writeback={PENDING} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("never exposes credentials in its rendered output", () => {
    render(<IntegrationAvailabilityNotice writeback={PENDING} />);
    expect(screen.queryByText(/api[_-]?key/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/token/i)).not.toBeInTheDocument();
  });
});
