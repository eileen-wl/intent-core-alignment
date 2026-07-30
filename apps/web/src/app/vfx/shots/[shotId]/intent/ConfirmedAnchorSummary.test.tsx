import type { CoreAnchorRevisionRead } from "@intent-core/contracts";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const routerReplaceMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: routerReplaceMock }),
  usePathname: () => "/vfx/shots/s1/intent",
}));

import { ConfirmedAnchorSummary } from "./ConfirmedAnchorSummary";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function revision(overrides: Partial<CoreAnchorRevisionRead> = {}): CoreAnchorRevisionRead {
  return {
    id: "r2",
    core_anchor_id: "a1",
    revision_number: 2,
    status: "confirmed",
    shot_objective: null,
    emotional_tone: null,
    visual_focus: null,
    rhythm_intensity: null,
    character_relationship: null,
    narrative_priority: null,
    core_summary: "A restrained dusk confrontation.",
    created_by_actor_kind: "human",
    created_by_actor_id: "vfx-1",
    created_by_human_role: "vfx_supervisor",
    created_by_agent_type: null,
    created_by_agent_run_id: null,
    context_snapshot_id: null,
    confirmed_by_human_role: "vfx_supervisor",
    confirmed_by_actor_id: "vfx-1",
    confirmed_at: "2026-01-01T00:00:00Z",
    supersedes_revision_id: "r1",
    source_intent_decomposition_id: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    constraints: [],
    variation_zones: [],
    drift_risks: [],
    references: [],
    open_questions: [],
    ...overrides,
  };
}

describe("ConfirmedAnchorSummary", () => {
  it("Normal Confirmed (default): does not render any transient success status", () => {
    render(<ConfirmedAnchorSummary revision={revision()} />);
    expect(screen.getByText("A restrained dusk confrontation.")).toBeVisible();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByText(/was confirmed/)).not.toBeInTheDocument();
  });

  it("Normal Confirmed: justConfirmed=false explicitly also shows no success status", () => {
    render(
      <ConfirmedAnchorSummary
        revision={revision()}
        previousConfirmedRevision={revision({ id: "r1", revision_number: 1 })}
        justConfirmed={false}
      />,
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("Just-confirmed Success: valid justConfirmed renders the transient success status", () => {
    render(
      <ConfirmedAnchorSummary
        revision={revision()}
        previousConfirmedRevision={revision({
          id: "r1",
          revision_number: 1,
          core_summary: "An earlier draft summary.",
          supersedes_revision_id: null,
        })}
        justConfirmed
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Revision 2 was confirmed.");
  });

  it("Just-confirmed Success: shows a real change summary computed from the genuinely superseded revision", () => {
    const previous = revision({
      id: "r1",
      revision_number: 1,
      core_summary: "An earlier draft summary.",
      supersedes_revision_id: null,
    });
    render(
      <ConfirmedAnchorSummary revision={revision()} previousConfirmedRevision={previous} justConfirmed />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Core summary changed");
  });

  it("Just-confirmed Success, first-ever confirmation: reports every populated field as newly established, never fabricated", () => {
    render(
      <ConfirmedAnchorSummary revision={revision()} previousConfirmedRevision={null} justConfirmed />,
    );
    // No previous revision to compare against -- the real
    // computeChangeSummary(null, revision) path, not invented content.
    expect(screen.getByRole("status")).toHaveTextContent("Core summary changed");
  });

  it("consumes the transient signal by stripping the URL after rendering justConfirmed", () => {
    render(
      <ConfirmedAnchorSummary
        revision={revision()}
        previousConfirmedRevision={null}
        justConfirmed
      />,
    );
    expect(routerReplaceMock).toHaveBeenCalledWith("/vfx/shots/s1/intent", { scroll: false });
  });

  it("does not touch the URL when justConfirmed is false", () => {
    render(<ConfirmedAnchorSummary revision={revision()} />);
    expect(routerReplaceMock).not.toHaveBeenCalled();
  });
});
