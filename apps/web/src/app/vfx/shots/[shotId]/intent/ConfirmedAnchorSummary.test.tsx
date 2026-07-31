import type { CoreAnchorRevisionRead } from "@intent-core/contracts";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/vfx/shots/s1/intent",
}));

import { ConfirmedAnchorSummary } from "./ConfirmedAnchorSummary";

let replaceStateSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  replaceStateSpy = vi.spyOn(window.history, "replaceState").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  replaceStateSpy.mockRestore();
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

  it("Normal Confirmed: shows Decision recorded and a compact next-step statement, never a separate Shared intent is active card or What changed", () => {
    render(
      <ConfirmedAnchorSummary
        revision={revision({
          confirmed_by_human_role: "vfx_supervisor",
          confirmed_at: "2026-01-01T00:00:00Z",
        })}
      />,
    );
    expect(screen.getByText("Decision recorded")).toBeVisible();
    expect(screen.getByText("Downstream work should align to this revision.")).toBeVisible();
    expect(screen.queryByText("Shared intent is active")).not.toBeInTheDocument();
    expect(screen.queryByText(/What changed/)).not.toBeInTheDocument();
    expect(screen.queryByText(/What was established/)).not.toBeInTheDocument();
  });

  it("Normal Confirmed: shows the honest No rationale fallback when the Decision carries none", () => {
    render(
      <ConfirmedAnchorSummary
        revision={revision({
          confirmed_by_human_role: "vfx_supervisor",
          confirmed_at: "2026-01-01T00:00:00Z",
        })}
        decisionRationale={null}
      />,
    );
    expect(screen.getByText("No rationale was provided.")).toBeVisible();
  });

  it("Normal Confirmed: shows the real recorded rationale when one was provided", () => {
    render(
      <ConfirmedAnchorSummary
        revision={revision({
          confirmed_by_human_role: "vfx_supervisor",
          confirmed_at: "2026-01-01T00:00:00Z",
        })}
        decisionRationale="Matches the director's note on restraint."
      />,
    );
    expect(screen.getByText("Matches the director's note on restraint.")).toBeVisible();
    expect(screen.queryByText("No rationale was provided.")).not.toBeInTheDocument();
  });

  it("Normal Confirmed: shows Supersedes Revision N-1 only when the confirmed revision genuinely supersedes one", () => {
    const { rerender } = render(
      <ConfirmedAnchorSummary
        revision={revision({
          revision_number: 2,
          supersedes_revision_id: "r1",
          confirmed_by_human_role: "vfx_supervisor",
          confirmed_at: "2026-01-01T00:00:00Z",
        })}
        previousConfirmedRevision={revision({ id: "r1", revision_number: 1, supersedes_revision_id: null })}
      />,
    );
    expect(screen.getByText("Supersedes Revision 1")).toBeVisible();

    rerender(
      <ConfirmedAnchorSummary
        revision={revision({
          revision_number: 1,
          supersedes_revision_id: null,
          confirmed_by_human_role: "vfx_supervisor",
          confirmed_at: "2026-01-01T00:00:00Z",
        })}
        previousConfirmedRevision={null}
      />,
    );
    expect(screen.queryByText(/Supersedes Revision/)).not.toBeInTheDocument();
  });

  it("Normal Confirmed: shows real available evidence/source information", () => {
    render(
      <ConfirmedAnchorSummary
        revision={revision({
          confirmed_by_human_role: "vfx_supervisor",
          confirmed_at: "2026-01-01T00:00:00Z",
        })}
        evidenceData={{
          evidence: [{ source_type: "core_anchor_revision", source_id: "r1", label: "Previous confirmed revision" }],
          run: null,
          snapshot: null,
          decompositions: [],
          reconstructions: [],
        }}
      />,
    );
    expect(screen.getByText(/1 evidence source/)).toBeVisible();
  });

  it("shows Revision N · Active identity badges on the main card", () => {
    render(<ConfirmedAnchorSummary revision={revision({ revision_number: 3 })} />);
    expect(screen.getByText("Revision 3")).toBeVisible();
    expect(screen.getByText("Active")).toBeVisible();
  });

  it("Just-confirmed Success: shows Decision recorded, never a separate Shared intent is active card", () => {
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

  it("Just-confirmed Success: the compact next-step statement names the newly active revision", () => {
    render(
      <ConfirmedAnchorSummary
        revision={revision({ revision_number: 2 })}
        previousConfirmedRevision={revision({ id: "r1", revision_number: 1, supersedes_revision_id: null })}
        justConfirmed
      />,
    );
    expect(
      screen.getByText(
        "Revision 2 is now the active Core Anchor. Downstream work should align to this revision.",
      ),
    ).toBeVisible();
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

  it("Just-confirmed Success, later revision: shows a real change summary, computed from the genuinely superseded revision, in a What changed from Revision N-1 card", () => {
    const previous = revision({
      id: "r1",
      revision_number: 1,
      core_summary: "An earlier draft summary.",
      supersedes_revision_id: null,
    });
    render(
      <ConfirmedAnchorSummary revision={revision()} previousConfirmedRevision={previous} justConfirmed />,
    );
    expect(screen.getByText("What changed from Revision 1")).toBeVisible();
    expect(screen.getByText("Core summary changed")).toBeVisible();
    expect(screen.queryByText(/What was established/)).not.toBeInTheDocument();
    // The transient banner itself no longer embeds the change summary
    // text -- the two are now visually and semantically separate cards.
    expect(screen.getByRole("status")).toHaveTextContent("Revision 2 confirmed successfully");
  });

  it("Just-confirmed Success, first-ever confirmation: shows What was established (real content), never What changed in Revision 1", () => {
    render(
      <ConfirmedAnchorSummary
        revision={revision({
          revision_number: 1,
          core_summary: "A restrained dusk confrontation.",
          constraints: [
            { id: "c1", order_index: 0, content: "No character dialogue", created_at: "2026-01-01T00:00:00Z" },
          ],
        })}
        previousConfirmedRevision={null}
        justConfirmed
      />,
    );
    // No previous revision to compare against -- the real
    // summarizeEstablishedContent(revision) path, never a fabricated
    // "changed" claim about a Revision 1 that had nothing to change from.
    expect(screen.getByText("What was established")).toBeVisible();
    expect(screen.getByText("Shared creative direction established")).toBeVisible();
    expect(screen.getByText("1 confirmed constraint")).toBeVisible();
    expect(screen.queryByText(/What changed/)).not.toBeInTheDocument();
  });

  it("cleans the URL via the browser History API, never a Next.js router navigation", () => {
    render(
      <ConfirmedAnchorSummary
        revision={revision()}
        previousConfirmedRevision={null}
        justConfirmed
      />,
    );
    expect(replaceStateSpy).toHaveBeenCalledWith(null, "", "/vfx/shots/s1/intent");
  });

  it("does not touch the URL when justConfirmed is false", () => {
    render(<ConfirmedAnchorSummary revision={revision()} />);
    expect(replaceStateSpy).not.toHaveBeenCalled();
  });

  it("keeps rendering Just-confirmed Success on this render after the URL cleanup runs -- history.replaceState never triggers a Next.js navigation, data refetch, or re-render", () => {
    render(
      <ConfirmedAnchorSummary
        revision={revision()}
        previousConfirmedRevision={null}
        justConfirmed
      />,
    );
    // The cleanup effect has already run (render/useEffect are flushed
    // synchronously by Testing Library) -- the success view must still
    // be exactly as visible as it was before the URL was cleaned.
    expect(replaceStateSpy).toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Revision 2 confirmed successfully");
    expect(screen.getByText("What was established")).toBeVisible();
  });
});
