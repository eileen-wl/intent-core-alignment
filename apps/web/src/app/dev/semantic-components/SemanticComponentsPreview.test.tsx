import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SemanticComponentsPreview } from "./SemanticComponentsPreview";

afterEach(() => {
  cleanup();
});

describe("SemanticComponentsPreview", () => {
  it("renders and is clearly labelled as a Development preview with a fixture warning", () => {
    render(<SemanticComponentsPreview />);
    expect(screen.getByText("Development preview")).toBeVisible();
    expect(
      screen.getByText("Development fixture — not live production data"),
    ).toBeVisible();
  });

  it("demonstrates all six Intent Signal presentation levels", () => {
    render(<SemanticComponentsPreview />);
    expect(screen.getByText(/global indicator/i)).toBeVisible();
    expect(screen.getByText(/signal tray/i)).toBeVisible();
    expect(screen.getByText(/homepage card/i)).toBeVisible();
    expect(screen.getByText(/list-row badge/i)).toBeVisible();
    expect(screen.getByText(/contextual banner/i)).toBeVisible();
    expect(screen.getByText(/detail view/i)).toBeVisible();
  });

  it("provides a local section index covering every major group", () => {
    render(<SemanticComponentsPreview />);
    const nav = screen.getByRole("navigation", {
      name: "Sections on this page",
    });
    expect(nav).toBeVisible();
    expect(screen.getByRole("link", { name: "Intent Signal" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Authority" })).toBeVisible();
    expect(screen.getByRole("link", { name: "ftrack linkage" })).toBeVisible();
  });

  it("demonstrates VFX, CG, and Artist wording for the same Signal fixture", () => {
    render(<SemanticComponentsPreview />);
    expect(screen.getAllByText("VFX Supervisor").length).toBeGreaterThan(0);
    expect(screen.getAllByText("CG Supervisor").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Artist").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Execution clarification required").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Supervisor clarification pending").length,
    ).toBeGreaterThan(0);
  });

  it("demonstrates human-confirmed vs. Agent-advisory semantics", () => {
    render(<SemanticComponentsPreview />);
    expect(screen.getAllByText("Human-confirmed").length).toBeGreaterThan(0);
    expect(screen.getByText("AI interpretation")).toBeVisible();
  });

  it("demonstrates ftrack linked, unlinked, and write-back states", () => {
    render(<SemanticComponentsPreview />);
    expect(screen.getAllByText("Linked to ftrack").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("No linked ftrack entity").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("Write-back pending")).toBeVisible();
    expect(screen.getByText("Write-back failed")).toBeVisible();
  });

  it("demonstrates historical vs. current Intent Signal detail", () => {
    render(<SemanticComponentsPreview />);
    expect(screen.getAllByText("Historical").length).toBeGreaterThan(0);
  });

  it("has exactly one page heading (h1)", () => {
    render(<SemanticComponentsPreview />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
});
