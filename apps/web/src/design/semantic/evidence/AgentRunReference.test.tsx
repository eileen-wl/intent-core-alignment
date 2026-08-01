import { cleanup, render, screen } from "@testing-library/react";
import type { AgentRunRead } from "@intent-core/contracts";
import { afterEach, describe, expect, it } from "vitest";

import { AgentRunReference } from "./AgentRunReference";

afterEach(() => {
  cleanup();
});

const SUCCEEDED_RUN: AgentRunRead = {
  id: "run-1",
  shot_id: "shot-1",
  context_snapshot_id: "snapshot-1",
  agent_type: "core_agent",
  capability: "cross_role_assessment",
  provider: "deepseek",
  model_name: "deepseek-chat",
  prompt_version: "core_cross_role_assessment.v1",
  status: "succeeded",
  result_revision_id: null,
  error: null,
  started_at: "2026-07-20T09:58:00Z",
  completed_at: "2026-07-20T10:00:00Z",
};

describe("AgentRunReference", () => {
  it("renders provider and capability when the run succeeded", () => {
    render(<AgentRunReference run={SUCCEEDED_RUN} />);
    expect(screen.getByText("deepseek")).toBeVisible();
    expect(screen.getByText("cross_role_assessment")).toBeVisible();
  });

  it("renders an honest failure state for a failed run using the sanitised error", () => {
    render(
      <AgentRunReference
        run={{
          ...SUCCEEDED_RUN,
          status: "failed",
          error: "Structured output failed schema validation.",
        }}
      />,
    );
    expect(screen.getByRole("alert")).toBeVisible();
    expect(
      screen.getByText("Structured output failed schema validation."),
    ).toBeVisible();
  });

  it("renders an honest unavailable state when no run is provided", () => {
    render(<AgentRunReference run={null} />);
    expect(screen.getByText("Agent Run unavailable.")).toBeVisible();
  });

  it("never renders a raw stack trace or secret-shaped value", () => {
    render(<AgentRunReference run={SUCCEEDED_RUN} />);
    expect(screen.queryByText(/api[_-]?key/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sk-/i)).not.toBeInTheDocument();
  });
});
