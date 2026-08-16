import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AuthorityLabel, type AuthorityLabelVariant } from "./AuthorityLabel";

afterEach(() => {
  cleanup();
});

const EXPECTED_TEXT: Record<AuthorityLabelVariant, string> = {
  "production-fact": "Production fact",
  "human-intent": "Human intent",
  "human-authority": "Human authority",
  "human-confirmed": "Human-confirmed",
  "ai-interpretation": "AI interpretation",
  "ai-proposal": "AI proposal",
  "intent-signal": "Intent Signal",
  "human-review-required": "Human review required",
  "open-question": "Open question",
  historical: "Historical",
  "integration-ready": "Integration-ready",
  "read-only": "Read-only for your role",
};

describe("AuthorityLabel", () => {
  for (const [variant, text] of Object.entries(EXPECTED_TEXT) as [
    AuthorityLabelVariant,
    string,
  ][]) {
    it(`renders the required label text for "${variant}"`, () => {
      render(<AuthorityLabel variant={variant} />);
      expect(screen.getByText(text)).toBeVisible();
    });
  }

  it("renders optional detail text alongside the fixed label", () => {
    render(
      <AuthorityLabel
        variant="human-confirmed"
        detail="Confirmed by VFX Supervisor"
      />,
    );
    expect(screen.getByText("Human-confirmed")).toBeVisible();
    expect(screen.getByText("Confirmed by VFX Supervisor")).toBeVisible();
  });

  it("distinguishes AI interpretation and AI proposal by their label text", () => {
    const { container: interpretation } = render(
      <AuthorityLabel variant="ai-interpretation" />,
    );
    const { container: proposal } = render(
      <AuthorityLabel variant="ai-proposal" />,
    );

    expect(interpretation.textContent).not.toEqual(proposal.textContent);
  });

  it("renders exactly one concise badge, never a duplicated abbreviation alongside the full label", () => {
    render(<AuthorityLabel variant="human-confirmed" />);
    // Owner-validation correction: the old layout rendered an
    // abbreviated marker ("CONFIRMED") next to the full label
    // ("Human-confirmed"), reading as duplicated wording.
    expect(screen.queryByText("CONFIRMED")).not.toBeInTheDocument();
    expect(screen.getByText("Human-confirmed")).toBeVisible();
  });

  it("never renders creative-scoring, pass/fail, or Agent-authority wording", () => {
    render(
      <>
        {(Object.keys(EXPECTED_TEXT) as AuthorityLabelVariant[]).map(
          (variant) => (
            <AuthorityLabel key={variant} variant={variant} />
          ),
        )}
      </>,
    );
    const bannedPhrases = ["pass", "fail", "score", "approved", "rejected"];
    const text = document.body.textContent?.toLowerCase() ?? "";
    for (const phrase of bannedPhrases) {
      expect(text).not.toContain(phrase);
    }
  });
});
