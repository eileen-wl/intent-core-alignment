import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SourceReference } from "./SourceReference";

afterEach(() => {
  cleanup();
});

describe("SourceReference", () => {
  it("shows the human-readable label before the technical identifier", () => {
    render(
      <SourceReference
        reference={{
          source_type: "core_anchor_revision",
          source_id: "11111111-1111-1111-1111-111111111111",
          label: "Confirmed Core Anchor revision 3",
        }}
      />,
    );
    const label = screen.getByText("Confirmed Core Anchor revision 3");
    const id = screen.getByText("11111111-1111-1111-1111-111111111111");
    expect(label).toBeVisible();
    expect(id).toBeVisible();
    // DOM order: label appears before the technical id.
    expect(
      label.compareDocumentPosition(id) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("shows the humanized source type", () => {
    render(
      <SourceReference
        reference={{
          source_type: "vfx_supervisor_review",
          source_id: "id-1",
          label: "Latest VFX Supervisor review",
        }}
      />,
    );
    expect(screen.getByText("VFX Supervisor review")).toBeVisible();
  });
});
