import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AgentAdvisoryNotice } from "./AgentAdvisoryNotice";

afterEach(() => {
  cleanup();
});

describe("AgentAdvisoryNotice", () => {
  it("marks Agent output as advisory only, never automatically applied", () => {
    render(
      <AgentAdvisoryNotice
        agentType="core_agent"
        capability="cross_role_assessment"
        provider="deepseek"
        generatedAt="2026-07-20T10:00:00Z"
      />,
    );
    expect(screen.getByText("AI interpretation")).toBeVisible();
    expect(screen.getByText(/advisory only/i)).toBeVisible();
    expect(screen.getByText(/not automatically applied/i)).toBeVisible();
  });

  it("supports the ai-proposal variant for Re-anchor Proposal contexts", () => {
    render(
      <AgentAdvisoryNotice
        variant="ai-proposal"
        agentType="core_agent"
        capability="cross_role_assessment"
        provider="deepseek"
        generatedAt="2026-07-20T10:00:00Z"
      />,
    );
    expect(screen.getByText("AI proposal")).toBeVisible();
  });

  it("never renders an Apply action", () => {
    render(
      <AgentAdvisoryNotice
        variant="ai-proposal"
        agentType="core_agent"
        capability="cross_role_assessment"
        provider="deepseek"
        generatedAt="2026-07-20T10:00:00Z"
      />,
    );
    expect(
      screen.queryByRole("button", { name: /apply/i }),
    ).not.toBeInTheDocument();
  });
});
