import type {
  CrossRoleAssessmentRead,
  ReviewNoteRead,
  VersionRead,
  VfxInboxItemRead,
} from "@intent-core/contracts";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { VersionsWorkspaceData } from "@/features/vfx/versions-workspace/data";
import { VersionsWorkspacePage } from "./VersionsWorkspacePage";

afterEach(() => {
  cleanup();
});

function item(overrides: Partial<VfxInboxItemRead> = {}): VfxInboxItemRead {
  return {
    project_id: "p1",
    project_name: "D1 Demo Project",
    shot_id: "s1",
    shot_name: "Shot 010 — Final confrontation",
    shot_source: "manual",
    core_anchor_state: "confirmed",
    active_core_anchor_revision_id: "r1",
    active_core_anchor_summary: "A restrained dusk confrontation.",
    pending_human_gate_id: null,
    relevant_task_id: "t1",
    relevant_task_name: "Compositing Review",
    relevant_version_id: "v1",
    relevant_version_name: "SH010_v001",
    relevant_version_number: 1,
    pairing_established: true,
    latest_assessment_id: null,
    latest_assessment_created_at: null,
    latest_signal_id: null,
    latest_signal_attention_level: null,
    latest_signal_summary: null,
    re_anchor_proposal_present: false,
    current_focus: {
      focus_type: "none",
      title: "Nothing requires your attention on this Shot right now",
      explanation: "",
      target_route: "/vfx/shots/s1",
      primary_action_label: null,
      actionable: false,
    },
    next_candidates: [],
    sort_rank: 0,
    ...overrides,
  };
}

function version(overrides: Partial<VersionRead> = {}): VersionRead {
  return {
    id: "v1",
    shot_id: "s1",
    name: "SH010_v001",
    version_number: 1,
    description: "First pass.",
    source: "manual",
    created_by_actor_kind: "human",
    created_by_actor_id: "vfx-1",
    created_by_human_role: "vfx_supervisor",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function note(overrides: Partial<ReviewNoteRead> = {}): ReviewNoteRead {
  return {
    id: "n1",
    version_id: "v1",
    content: "Tighten the timing on the push-in.",
    source: "manual",
    created_by_actor_kind: "human",
    created_by_actor_id: "vfx-1",
    created_by_human_role: "vfx_supervisor",
    created_at: "2026-01-02T00:00:00Z",
    ...overrides,
  };
}

function data(
  overrides: Partial<VersionsWorkspaceData> = {},
): VersionsWorkspaceData {
  return {
    item: item(),
    versions: [{ version: version(), reviewNotes: [note()] }],
    assessmentsByVersionId: new Map(),
    ...overrides,
  };
}

describe("VersionsWorkspacePage", () => {
  it("renders Project > Shot > Versions breadcrumbs and all five real Context Tabs, Versions active", () => {
    render(
      <VersionsWorkspacePage
        shotId="s1"
        data={data()}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("link", { name: "D1 Demo Project" }),
    ).toHaveAttribute("href", "/vfx/shots");
    expect(screen.getByText("Shot 010 — Final confrontation")).toBeVisible();
    for (const [label, href] of [
      ["Overview", "/vfx/shots/s1"],
      ["Intent", "/vfx/shots/s1/intent"],
      ["Alignment", "/vfx/shots/s1/alignment"],
      ["Activity", "/vfx/shots/s1/activity"],
    ] as const) {
      expect(screen.getByRole("link", { name: label })).toHaveAttribute(
        "href",
        href,
      );
    }
    expect(screen.getByRole("link", { name: "Versions" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("shows an honest unavailable state when the API could not be reached", () => {
    render(
      <VersionsWorkspacePage
        shotId="s1"
        data={null}
        unavailable
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText("This Shot is unavailable")).toBeVisible();
  });

  it("labels the list and detail area explicitly as Production Versions", () => {
    render(
      <VersionsWorkspacePage
        shotId="s1"
        data={data()}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Production Versions" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Production Version details" }),
    ).toBeVisible();
    expect(screen.queryByText(/Core Anchor Revisions/)).not.toBeInTheDocument();
  });

  it("renders real Production Versions, newest first, never Core Anchor Revision wording", () => {
    render(
      <VersionsWorkspacePage
        shotId="s1"
        data={data()}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /SH010_v001 \(v1\)/ }),
    ).toBeVisible();
    expect(screen.queryByText(/Core Anchor Revision/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Revision \d/)).not.toBeInTheDocument();
  });

  it("shows the selected Version's real Review Notes with author and timestamp", () => {
    render(
      <VersionsWorkspacePage
        shotId="s1"
        data={data()}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByText("Tighten the timing on the push-in."),
    ).toBeVisible();
    expect(screen.getAllByText(/VFX Supervisor/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/vfx_supervisor/)).not.toBeInTheDocument();
  });

  it("shows an honest empty state for a Version with no Review Notes", () => {
    render(
      <VersionsWorkspacePage
        shotId="s1"
        data={data({ versions: [{ version: version(), reviewNotes: [] }] })}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByText(
        "No Review Notes have been recorded for this Production Version yet.",
      ),
    ).toBeVisible();
  });

  it("shows the honest empty state when the Shot has no Production Versions at all", () => {
    render(
      <VersionsWorkspacePage
        shotId="s1"
        data={data({ versions: [] })}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByText(
        "No Production Versions have been recorded for this Shot yet.",
      ),
    ).toBeVisible();
  });

  it("switches the selected-version detail when a different Version row is clicked", () => {
    const versionA = version({
      id: "v1",
      name: "SH010_v001",
      version_number: 1,
    });
    const versionB = version({
      id: "v2",
      name: "SH010_v002",
      version_number: 2,
    });
    render(
      <VersionsWorkspacePage
        shotId="s1"
        data={data({
          versions: [
            { version: versionB, reviewNotes: [] },
            {
              version: versionA,
              reviewNotes: [note({ id: "nA", content: "Note on v1 only" })],
            },
          ],
        })}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.queryByText("Note on v1 only")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /SH010_v001 \(v1\)/ }));
    expect(screen.getByText("Note on v1 only")).toBeVisible();
  });

  it("links to Alignment only when a real Cross-role Assessment exists for the selected Version", () => {
    const assessment = {
      id: "a1",
      version_id: "v1",
    } as CrossRoleAssessmentRead;
    render(
      <VersionsWorkspacePage
        shotId="s1"
        data={data({ assessmentsByVersionId: new Map([["v1", [assessment]]]) })}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("link", { name: "Review in Alignment →" }),
    ).toHaveAttribute("href", "/vfx/shots/s1/alignment");
  });

  it("shows the ftrack external author as source provenance, not an ICAS Human role (Step 8C-6/8C-7)", () => {
    render(
      <VersionsWorkspacePage
        shotId="s1"
        data={data({
          versions: [
            {
              version: version({
                source: "ftrack",
                created_by_actor_kind: "system",
                created_by_human_role: null,
                external_author_id: "ext-42",
                external_author_name: "Jamie Lin",
              }),
              reviewNotes: [
                note({
                  source: "ftrack",
                  created_by_actor_kind: "system",
                  created_by_human_role: null,
                  external_author_id: "ext-42",
                  external_author_name: "Jamie Lin",
                }),
              ],
            },
          ],
        })}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getAllByText(/Source author: Jamie Lin/).length).toBe(2);
    expect(screen.queryByText("vfx_supervisor")).not.toBeInTheDocument();
    expect(screen.queryByText(/cg_supervisor/)).not.toBeInTheDocument();
  });

  it("falls back to the actor kind, never a fabricated name, when an ftrack row has no external_author_name", () => {
    render(
      <VersionsWorkspacePage
        shotId="s1"
        data={data({
          versions: [
            {
              version: version({
                source: "ftrack",
                created_by_actor_kind: "system",
                created_by_human_role: null,
                external_author_id: "ext-42",
                external_author_name: null,
              }),
              reviewNotes: [],
            },
          ],
        })}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText("system")).toBeVisible();
    expect(screen.queryByText(/Source author:/)).not.toBeInTheDocument();
    expect(screen.queryByText("ext-42")).not.toBeInTheDocument();
  });

  it("shows the manual Human-role author as a human-readable label when no ftrack provenance exists (Step 9B-2 correction)", () => {
    render(
      <VersionsWorkspacePage
        shotId="s1"
        data={data()}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getAllByText(/VFX Supervisor/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/vfx_supervisor/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Source author:/)).not.toBeInTheDocument();
  });

  it("honestly states no Alignment Assessment exists yet, and does not link, when none does", () => {
    render(
      <VersionsWorkspacePage
        shotId="s1"
        data={data()}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByText(
        "No Alignment Assessment has been generated for this Production Version yet.",
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole("link", { name: "Review in Alignment →" }),
    ).not.toBeInTheDocument();
  });
});
