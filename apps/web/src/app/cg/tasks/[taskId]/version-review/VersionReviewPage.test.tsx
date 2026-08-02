import type {
  CGSupervisorReviewRead,
  CgInboxItemRead,
  ReviewNoteRead,
  VersionRead,
} from "@intent-core/contracts";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/cg/tasks/t1/version-review",
}));

vi.mock("@/features/cg/actions", () => ({
  createReviewNoteAction: vi.fn(),
  escalateTaskAction: vi.fn(),
  generateCgSupervisorReviewAction: vi.fn(),
}));

import type { VersionReviewWorkspaceData } from "@/features/cg/version-review-workspace/data";
import { VersionReviewPage } from "./VersionReviewPage";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function item(overrides: Partial<CgInboxItemRead> = {}): CgInboxItemRead {
  return {
    task_id: "t1",
    task_name: "Lighting Pass",
    department: "lighting",
    task_source: "manual",
    shot_id: "s1",
    shot_name: "Shot 010",
    project_id: "p1",
    project_name: "D1 Demo Project",
    execution_anchor_state: "confirmed",
    active_execution_anchor_revision_id: "r1",
    active_execution_anchor_summary: "24fps, no motion blur.",
    pending_human_gate_id: null,
    latest_version_id: "v1",
    latest_version_name: "SH010_v001",
    latest_version_number: 1,
    open_dependency_count: 0,
    current_focus: {
      focus_type: "version_review_available",
      title: "A Production Version is ready for CG review",
      explanation: "No CG Supervisor review has been recorded yet.",
      target_route: "/cg/tasks/t1/version-review",
      primary_action_label: "Review version",
      actionable: true,
    },
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
    content: "Contrast reads slightly hot.",
    source: "manual",
    created_by_actor_kind: "human",
    created_by_actor_id: "vfx-1",
    created_by_human_role: "vfx_supervisor",
    created_at: "2026-01-02T00:00:00Z",
    ...overrides,
  };
}

function data(
  overrides: Partial<VersionReviewWorkspaceData> = {},
): VersionReviewWorkspaceData {
  return {
    item: item(),
    versions: [{ version: version(), reviewNotes: [note()] }],
    coreAnchorSummary: "A restrained dusk confrontation.",
    activeExecutionRevision: null,
    cgSupervisorReviews: [],
    ...overrides,
  };
}

describe("VersionReviewPage", () => {
  it("renders Project > Shot > Task > Version Review breadcrumbs, tab active", () => {
    render(
      <VersionReviewPage
        taskId="t1"
        data={data()}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("link", { name: "Version Review" }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("shows an honest unavailable state when the API could not be reached", () => {
    render(
      <VersionReviewPage
        taskId="t1"
        data={null}
        unavailable
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText("This Task is unavailable")).toBeVisible();
  });

  it("shows the honest empty state when no Production Version exists for this Task's Shot", () => {
    render(
      <VersionReviewPage
        taskId="t1"
        data={data({ versions: [] })}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByText(
        "No Production Versions have been recorded for this Task yet.",
      ),
    ).toBeVisible();
  });

  it("renders real Production Versions, never confusing them with a Core/Execution Anchor Revision", () => {
    render(
      <VersionReviewPage
        taskId="t1"
        data={data()}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /SH010_v001 \(v1\)/ }),
    ).toBeVisible();
    expect(screen.queryByText(/Core Anchor Revision/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Execution Anchor Revision/),
    ).not.toBeInTheDocument();
  });

  it("shows the selected Version's real Review Notes", () => {
    render(
      <VersionReviewPage
        taskId="t1"
        data={data()}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText("Contrast reads slightly hot.")).toBeVisible();
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
      <VersionReviewPage
        taskId="t1"
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

  it("shows Core Anchor and Execution Anchor context as read-only", () => {
    render(
      <VersionReviewPage
        taskId="t1"
        data={data()}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText("Active Core Anchor (read-only)")).toBeVisible();
    expect(
      screen.getByText("Active Execution Anchor (read-only)"),
    ).toBeVisible();
    expect(screen.getByText("A restrained dusk confrontation.")).toBeVisible();
  });

  it("honestly shows no CG Supervisor review has been generated yet", () => {
    render(
      <VersionReviewPage
        taskId="t1"
        data={data()}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByText(
        "No CG Supervisor review has been generated for the active Execution Anchor yet.",
      ),
    ).toBeVisible();
  });

  it("shows the ftrack external author as source provenance on Review Notes, not an ICAS Human role (Step 8C-6/8C-7)", () => {
    render(
      <VersionReviewPage
        taskId="t1"
        data={data({
          versions: [
            {
              version: version(),
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
    expect(screen.getByText(/Source author: Jamie Lin/)).toBeVisible();
    expect(screen.queryByText(/vfx_supervisor/)).not.toBeInTheDocument();
  });

  it("falls back to the actor kind, never a fabricated name, when an ftrack Review Note has no external_author_name", () => {
    render(
      <VersionReviewPage
        taskId="t1"
        data={data({
          versions: [
            {
              version: version(),
              reviewNotes: [
                note({
                  source: "ftrack",
                  created_by_actor_kind: "system",
                  created_by_human_role: null,
                  external_author_id: "ext-42",
                  external_author_name: null,
                }),
              ],
            },
          ],
        })}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText(/^system ·/)).toBeVisible();
    expect(screen.queryByText(/Source author:/)).not.toBeInTheDocument();
  });

  it("real CG Supervisor review count renders honestly once one exists", () => {
    const review: CGSupervisorReviewRead = {
      id: "cgr1",
      project_id: "p1",
      shot_id: "s1",
      task_id: "t1",
      execution_anchor_revision_id: "r1",
      context_snapshot_id: "cs1",
      agent_run_id: "run1",
      review_output: {
        executive_summary: "x",
        execution_direction_read: {
          summary: "Reads within the confirmed range.",
          rationale: "Matches the confirmed Execution Anchor.",
          priority: "low",
          evidence: [],
        },
        actionable_requirements: [],
        technical_concerns: [],
        coordination_concerns: [],
        implementation_priorities: [],
        proposed_execution_guidance: [],
        questions_for_human_cg_supervisor: [],
        evidence_gaps: [],
      },
      created_at: "2026-01-01T00:00:00Z",
    };
    render(
      <VersionReviewPage
        taskId="t1"
        data={data({ cgSupervisorReviews: [review] })}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText("1 CG Supervisor review recorded.")).toBeVisible();
  });
});
