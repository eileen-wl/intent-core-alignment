import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AgentAdvisoryNotice } from "./AgentAdvisoryNotice";
import { HumanDecisionNotice } from "./HumanDecisionNotice";

afterEach(() => {
  cleanup();
});

describe("Human-confirmed vs. Agent-advisory distinction", () => {
  it("renders visibly different authority labels for confirmed vs. advisory content", () => {
    render(
      <>
        <HumanDecisionNotice
          objectLabel="Core Anchor revision 3"
          confirmingRole="vfx_supervisor"
          confirmedAt="2026-07-19T12:00:00Z"
        />
        <AgentAdvisoryNotice
          agentType="core_agent"
          capability="cross_role_assessment"
          provider="deepseek"
          generatedAt="2026-07-20T10:00:00Z"
        />
      </>,
    );

    expect(screen.getByText("Human-confirmed")).toBeVisible();
    expect(screen.getByText("AI interpretation")).toBeVisible();
    // Never the same label text for the two authority kinds.
    expect(screen.queryByText("Human-confirmed")).not.toBe(
      screen.queryByText("AI interpretation"),
    );
  });

  it("never implies automatic Agent authority anywhere in either notice", () => {
    render(
      <>
        <HumanDecisionNotice
          objectLabel="Core Anchor revision 3"
          confirmingRole="vfx_supervisor"
          confirmedAt="2026-07-19T12:00:00Z"
        />
        <AgentAdvisoryNotice
          agentType="core_agent"
          capability="cross_role_assessment"
          provider="deepseek"
          generatedAt="2026-07-20T10:00:00Z"
        />
      </>,
    );

    expect(screen.queryByText(/agent confirmed/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/automatically confirmed/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
