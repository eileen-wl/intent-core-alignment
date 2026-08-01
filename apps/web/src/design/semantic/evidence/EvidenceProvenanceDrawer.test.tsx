import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AgentRunRead } from "@intent-core/contracts";
import { afterEach, describe, expect, it } from "vitest";

import { EvidenceProvenanceDrawer } from "./EvidenceProvenanceDrawer";

afterEach(() => {
  cleanup();
});

const RUN: AgentRunRead = {
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

describe("EvidenceProvenanceDrawer", () => {
  it("renders a collapsed disclosure by default", () => {
    render(
      <EvidenceProvenanceDrawer
        evidence={[
          {
            source_type: "task",
            source_id: "id-1",
            label: "Compositing Review",
          },
        ]}
        run={RUN}
        snapshot={null}
      />,
    );
    const summary = screen.getByText("Evidence and provenance");
    expect(summary.closest("details")).not.toHaveAttribute("open");
  });

  it("is keyboard accessible: the disclosure is a native, focusable summary", () => {
    // Native <details>/<summary> is keyboard-operable (Enter/Space) by
    // the HTML spec as a browser guarantee -- jsdom does not replicate
    // that key-activation behaviour, so this asserts the accessible
    // building block (a focusable, semantically correct summary
    // element) rather than simulating a key press jsdom can't honour.
    render(
      <EvidenceProvenanceDrawer
        evidence={[
          {
            source_type: "task",
            source_id: "id-1",
            label: "Compositing Review",
          },
        ]}
        run={RUN}
        snapshot={null}
      />,
    );
    const summary = screen
      .getByText("Evidence and provenance")
      .closest("summary");
    expect(summary).not.toBeNull();
    expect(summary?.tagName.toLowerCase()).toBe("summary");
    summary?.focus();
    expect(document.activeElement).toBe(summary);
  });

  it("shows evidence and provenance once expanded", async () => {
    render(
      <EvidenceProvenanceDrawer
        evidence={[
          {
            source_type: "task",
            source_id: "id-1",
            label: "Compositing Review",
          },
        ]}
        run={RUN}
        snapshot={null}
      />,
    );
    await userEvent.click(screen.getByText("Evidence and provenance"));
    expect(screen.getByText("Compositing Review")).toBeVisible();
    expect(screen.getByText("deepseek")).toBeVisible();
  });
});
