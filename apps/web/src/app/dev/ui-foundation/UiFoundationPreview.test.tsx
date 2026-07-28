import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { UiFoundationPreview } from "./UiFoundationPreview";

afterEach(() => {
  cleanup();
});

describe("UiFoundationPreview", () => {
  it("is clearly labelled as a Development preview", () => {
    render(<UiFoundationPreview />);
    expect(screen.getByText("Development preview")).toBeVisible();
  });

  it("renders exactly one page heading (h1) and section headings (h2)", () => {
    render(<UiFoundationPreview />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "ICAS UI Foundation" }),
    ).toBeVisible();
    expect(
      screen.getAllByRole("heading", { level: 2 }).length,
    ).toBeGreaterThanOrEqual(10);
  });

  it("demonstrates every required AuthorityLabel variant", () => {
    render(<UiFoundationPreview />);
    const requiredLabels = [
      "Production fact",
      "Human intent",
      "Human-confirmed",
      "AI interpretation",
      "AI proposal",
      "Intent Signal",
      "Human review required",
      "Open question",
      "Historical",
      "Integration-ready",
      "Read-only for your role",
    ];
    for (const label of requiredLabels) {
      // "Historical" and "Integration-ready" are shared vocabulary
      // between AuthorityLabel and the StatusBadge demo below, so more
      // than one match is expected here.
      expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(1);
    }
  });

  it("demonstrates every StatusBadge status", () => {
    render(<UiFoundationPreview />);
    for (const label of [
      "Neutral",
      "Active",
      "Confirmed",
      "Attention",
      "Blocking",
      "Historical",
      "Integration-ready",
      "Unavailable",
    ]) {
      expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(1);
    }
  });

  it("demonstrates EmptyState, ErrorState, and PermissionState", () => {
    render(<UiFoundationPreview />);
    expect(screen.getByText("No Shots yet")).toBeVisible();
    expect(screen.getByRole("alert")).toBeVisible();
    expect(
      screen.getByText("Ask a VFX Supervisor to confirm this Anchor."),
    ).toBeVisible();
  });

  it("demonstrates MetadataRow and LoadingSkeleton with accessible labels", () => {
    render(<UiFoundationPreview />);
    expect(screen.getByText("Provider")).toBeVisible();
    expect(screen.getByText("deepseek")).toBeVisible();
    expect(
      screen.getByRole("status", { name: "Loading Shot summary" }),
    ).toBeVisible();
    expect(
      screen.getByRole("status", { name: "Loading Anchor panel" }),
    ).toBeVisible();
  });

  it("exposes keyboard-focusable example controls", () => {
    render(<UiFoundationPreview />);
    expect(
      screen.getByRole("button", { name: "Primary action" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Text link" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Text input" })).toBeVisible();
  });

  it("renders a single main landmark", () => {
    render(<UiFoundationPreview />);
    expect(screen.getAllByRole("main")).toHaveLength(1);
  });
});
