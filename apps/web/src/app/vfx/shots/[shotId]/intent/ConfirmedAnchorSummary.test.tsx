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

  it("Normal Confirmed: shows Decision recorded and Shared intent is active, never What changed", () => {
    render(
      <ConfirmedAnchorSummary
        revision={revision({
          confirmed_by_human_role: "vfx_supervisor",
          confirmed_at: "2026-01-01T00:00:00Z",
        })}
      />,
    );
    expect(screen.getByText("Decision recorded")).toBeVisible();
    expect(screen.getByText("Shared intent is active")).toBeVisible();
    expect(screen.queryByText(/What changed/)).not.toBeInTheDocument();
  });

  it("Just-confirmed Success: shows Decision recorded but never Shared intent is active (that is Normal Confirmed's card)", () => {
    render(
      <ConfirmedAnchorSummary
        revision={revision({
          confirmed_by_human_role: "vfx_supervisor",
          confirmed_at: "2026-01-01T00:00:00Z",
        })}
        previousConfirmedRevision={null}
        justConfirmed
      />,
    );
    expect(screen.getByText("Decision recorded")).toBeVisible();
    expect(screen.queryByText("Shared intent is active")).not.toBeInTheDocument();
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
    expect(screen.getByRole("status")).toHaveTextContent("Revision 2 confirmed successfully");
  });

  it("Just-confirmed Success: shows a real change summary, computed from the genuinely superseded revision, in a What changed card", () => {
    const previous = revision({
      id: "r1",
      revision_number: 1,
      core_summary: "An earlier draft summary.",
      supersedes_revision_id: null,
    });
    render(
      <ConfirmedAnchorSummary revision={revision()} previousConfirmedRevision={previous} justConfirmed />,
    );
    expect(screen.getByText("What changed in Revision 2")).toBeVisible();
    expect(screen.getByText("Core summary changed")).toBeVisible();
    // The transient banner itself no longer embeds the change summary
    // text -- the two are now visually and semantically separate cards.
    expect(screen.getByRole("status")).toHaveTextContent("Revision 2 confirmed successfully");
  });

  it("Just-confirmed Success, first-ever confirmation: reports every populated field as newly established, never fabricated", () => {
    render(
      <ConfirmedAnchorSummary revision={revision()} previousConfirmedRevision={null} justConfirmed />,
    );
    // No previous revision to compare against -- the real
    // computeChangeSummary(null, revision) path, not invented content.
    expect(screen.getByText("What changed in Revision 2")).toBeVisible();
    expect(screen.getByText("Core summary changed")).toBeVisible();
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
