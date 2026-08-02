import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { EvidenceLayerSection } from "./EvidenceLayerSection";

afterEach(() => {
  cleanup();
});

describe("EvidenceLayerSection", () => {
  it("renders the fixed Production Evidence heading and question", () => {
    render(
      <EvidenceLayerSection kind="production-evidence">
        <p>content</p>
      </EvidenceLayerSection>,
    );
    expect(screen.getByText("Production Evidence")).toBeVisible();
    expect(
      screen.getByText("What actually happened or is currently recorded?"),
    ).toBeVisible();
  });

  it("renders the fixed Agent Interpretation heading and question", () => {
    render(
      <EvidenceLayerSection kind="agent-interpretation">
        <p>content</p>
      </EvidenceLayerSection>,
    );
    expect(screen.getByText("Agent Interpretation")).toBeVisible();
    expect(
      screen.getByText("What does the Agent infer from that evidence?"),
    ).toBeVisible();
  });

  it("renders the fixed Human Decision and Provenance heading and question", () => {
    render(
      <EvidenceLayerSection kind="human-decision">
        <p>content</p>
      </EvidenceLayerSection>,
    );
    expect(screen.getByText("Human Decision and Provenance")).toBeVisible();
    expect(
      screen.getByText("What did an authorised person decide, and why?"),
    ).toBeVisible();
  });

  it("marks the layer kind in the DOM, not only by colour", () => {
    render(
      <EvidenceLayerSection kind="human-decision">
        <p>content</p>
      </EvidenceLayerSection>,
    );
    const section = screen
      .getByText("Human Decision and Provenance")
      .closest("[data-evidence-layer]");
    expect(section).toHaveAttribute("data-evidence-layer", "human-decision");
  });

  it("renders children content inside the section", () => {
    render(
      <EvidenceLayerSection kind="production-evidence">
        <p>Real recorded content</p>
      </EvidenceLayerSection>,
    );
    expect(screen.getByText("Real recorded content")).toBeVisible();
  });

  it("merges a caller className onto the section for layout reuse, without dropping the base class", () => {
    render(
      <EvidenceLayerSection kind="production-evidence" className="mainCard">
        <p>content</p>
      </EvidenceLayerSection>,
    );
    const section = screen.getByText("Production Evidence").closest("section");
    expect(section?.className).toContain("mainCard");
  });
});
