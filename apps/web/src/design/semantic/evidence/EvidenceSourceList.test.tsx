import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { EvidenceSourceList } from "./EvidenceSourceList";

afterEach(() => {
  cleanup();
});

describe("EvidenceSourceList", () => {
  it("renders every evidence reference", () => {
    render(
      <EvidenceSourceList
        evidence={[
          {
            source_type: "core_anchor_revision",
            source_id: "id-1",
            label: "Core Anchor",
          },
          {
            source_type: "task",
            source_id: "id-2",
            label: "Compositing Review",
          },
        ]}
      />,
    );
    expect(screen.getByText("Core Anchor")).toBeVisible();
    expect(screen.getByText("Compositing Review")).toBeVisible();
  });

  it("renders an honest empty state rather than nothing when evidence is missing", () => {
    render(<EvidenceSourceList evidence={[]} />);
    expect(screen.getByText("No evidence recorded")).toBeVisible();
  });
});
