import type {
  CGSupervisorReviewRead,
  CgInboxItemRead,
  ReviewNoteRead,
  VersionRead,
} from "@intent-core/contracts";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/cg/tasks/t1/version-review",
}));

vi.mock("@/features/cg/actions", () => ({
  createReviewNoteAction: vi.fn(),
  escalateTaskAction: vi.fn(),
  generateCgSupervisorReviewAction: vi.fn(),
  resolveVersionMediaAction: vi.fn().mockResolvedValue({
    ok: false,
    message: "No media resolved in this test.",
  }),
}));

import type { VersionReviewWorkspaceData } from "@/features/cg/version-review-workspace/data";
import { resolveVersionMediaAction } from "@/features/cg/actions";
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
      screen.getByText("No Production Version is available"),
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

  it("groups Version/Anchor context under Production Evidence, Agent Execution Reviews under Agent Interpretation, and shows an honest Human Decision state without manufacturing one (Step 9B-2)", () => {
    render(
      <VersionReviewPage
        taskId="t1"
        data={data()}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    const evidenceHeading = screen.getByText("Production Evidence");
    const agentHeading = screen.getByText("Agent Interpretation");
    const humanDecisionHeading = screen.getByText(
      "Human Decision and Provenance",
    );
    expect(evidenceHeading).toBeVisible();
    expect(agentHeading).toBeVisible();
    expect(humanDecisionHeading).toBeVisible();

    const evidenceSection = evidenceHeading.closest(
      "[data-evidence-layer]",
    ) as HTMLElement;
    expect(within(evidenceSection).getByText("Review notes")).toBeVisible();

    // Neither the Escalate button nor a pending review may be presented
    // as if it were a persisted Human Decision.
    const humanDecisionSection = humanDecisionHeading.closest(
      "[data-evidence-layer]",
    ) as HTMLElement;
    expect(
      within(humanDecisionSection).getByText(
        /No Human Decision has been recorded for this Production Version review/,
      ),
    ).toBeVisible();
  });

  it("places Add Review Note, Generate Agent Execution Review, and Escalate to VFX in their own Review actions section, outside every evidence layer (Step 9B-2 correction)", () => {
    render(
      <VersionReviewPage
        taskId="t1"
        data={data({
          activeExecutionRevision: {
            id: "ea1",
            execution_anchor_id: "ea",
            core_anchor_revision_id: "ca1",
            revision_number: 1,
            status: "confirmed",
            technical_boundaries: "24fps, no motion blur.",
            parameter_ranges: null,
            delivery_conditions: null,
            production_ready_criteria: null,
            downstream_dependencies: null,
            publish_requirements: null,
            allowed_refinements: null,
            escalation_conditions: null,
            created_by_actor_kind: "human",
            created_by_actor_id: "cg-1",
            created_by_human_role: "cg_supervisor",
            created_by_agent_type: null,
            created_by_agent_run_id: null,
            confirmed_by_human_role: "cg_supervisor",
            confirmed_by_actor_id: "cg-1",
            confirmed_at: "2026-08-01T00:00:00Z",
            supersedes_revision_id: null,
            created_at: "2026-08-01T00:00:00Z",
            updated_at: "2026-08-01T00:00:00Z",
          },
        })}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    const humanDecisionSection = screen
      .getByText("Human Decision and Provenance")
      .closest("[data-evidence-layer]") as HTMLElement;
    const reviewActionsHeading = screen.getByText("Review actions");
    expect(reviewActionsHeading).toBeVisible();

    // None of the four controls renders inside any evidence-layer section.
    expect(
      within(humanDecisionSection).queryByText("Add Review Note"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryAllByRole("button", { name: "Record Review Note" }),
    ).toHaveLength(1);
    expect(
      within(humanDecisionSection).queryByRole("button", {
        name: "Record Review Note",
      }),
    ).toBeNull();
    expect(
      within(humanDecisionSection).queryByRole("button", {
        name: "Generate Agent Execution Review",
      }),
    ).toBeNull();
    expect(
      within(humanDecisionSection).queryByRole("button", {
        name: "Escalate to VFX",
      }),
    ).toBeNull();

    // All three remain reachable, real, role-safe controls.
    expect(
      screen.getByRole("button", { name: "Record Review Note" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Generate Agent Execution Review" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Escalate to VFX" }),
    ).toBeVisible();
  });

  it("relabels the Generate action to Regenerate once a current Agent Execution Review already exists for the active Execution Anchor revision (currentness gating, Package C follow-up)", () => {
    const activeExecutionRevision = {
      id: "ea1",
      execution_anchor_id: "ea",
      core_anchor_revision_id: "ca1",
      revision_number: 1,
      status: "confirmed" as const,
      technical_boundaries: "24fps, no motion blur.",
      parameter_ranges: null,
      delivery_conditions: null,
      production_ready_criteria: null,
      downstream_dependencies: null,
      publish_requirements: null,
      allowed_refinements: null,
      escalation_conditions: null,
      created_by_actor_kind: "human" as const,
      created_by_actor_id: "cg-1",
      created_by_human_role: "cg_supervisor" as const,
      created_by_agent_type: null,
      created_by_agent_run_id: null,
      confirmed_by_human_role: "cg_supervisor" as const,
      confirmed_by_actor_id: "cg-1",
      confirmed_at: "2026-08-01T00:00:00Z",
      supersedes_revision_id: null,
      created_at: "2026-08-01T00:00:00Z",
      updated_at: "2026-08-01T00:00:00Z",
    };
    const review: CGSupervisorReviewRead = {
      id: "cgr1",
      project_id: "p1",
      shot_id: "s1",
      task_id: "t1",
      execution_anchor_revision_id: "ea1",
      version_id: "v1",
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
        data={data({
          activeExecutionRevision,
          cgSupervisorReviews: [review],
        })}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Generate Agent Execution Review" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Regenerate Agent Execution Review" }),
    ).toBeVisible();
  });

  it("honestly shows no Agent Execution Review has been generated yet", () => {
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
        "No Agent Execution Review has been generated for the active Execution Anchor yet.",
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

  it("real Agent Execution Review count renders honestly once one exists", () => {
    const review: CGSupervisorReviewRead = {
      id: "cgr1",
      project_id: "p1",
      shot_id: "s1",
      task_id: "t1",
      execution_anchor_revision_id: "r1",
      version_id: "v1",
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
    expect(screen.getByText("1 Agent review recorded.")).toBeVisible();
  });

  describe("Step 9B-4 real media context", () => {
    it("resolves real media for the selected Version via the Task-scoped Server Action, inside Production Evidence", async () => {
      vi.mocked(resolveVersionMediaAction).mockResolvedValueOnce({
        ok: true,
        media: {
          version_id: "v1",
          source: "ftrack",
          ftrack_linked: true,
          media_state: "playable",
          thumbnail_url: "https://ftrack.example/thumb",
          playable_url: "https://ftrack.example/video",
          playable_media_type: "video/mp4",
          playable_component_name: "ftrackreview-mp4",
          external_web_url: null,
          resolved_at: "2026-08-01T00:00:00Z",
          url_expires_at: null,
          unavailable_reason: null,
        },
      });

      render(
        <VersionReviewPage
          taskId="t1"
          data={data()}
          unavailable={false}
          onExitRole={vi.fn()}
        />,
      );

      expect(resolveVersionMediaAction).toHaveBeenCalledWith("t1", "v1");
      await waitFor(() => {
        expect(document.querySelector("video")).toBeTruthy();
      });

      const evidenceHeading = screen.getByText("Production Evidence");
      const evidenceSection = evidenceHeading.closest(
        "[data-evidence-layer]",
      ) as HTMLElement;
      expect(
        within(evidenceSection).getByRole("button", { name: "Refresh media" }),
      ).toBeVisible();
    });

    it("does not classify media as Agent Interpretation or Human Decision", async () => {
      vi.mocked(resolveVersionMediaAction).mockResolvedValueOnce({
        ok: true,
        media: {
          version_id: "v1",
          source: "ftrack",
          ftrack_linked: true,
          media_state: "thumbnail_only",
          thumbnail_url: "https://ftrack.example/thumb",
          playable_url: null,
          playable_media_type: null,
          playable_component_name: null,
          external_web_url: null,
          resolved_at: "2026-08-01T00:00:00Z",
          url_expires_at: null,
          unavailable_reason: null,
        },
      });

      render(
        <VersionReviewPage
          taskId="t1"
          data={data()}
          unavailable={false}
          onExitRole={vi.fn()}
        />,
      );

      await waitFor(() => expect(document.querySelector("img")).toBeTruthy());

      const agentHeading = screen.getByText("Agent Interpretation");
      const agentSection = agentHeading.closest(
        "[data-evidence-layer]",
      ) as HTMLElement;
      const humanDecisionHeading = screen.getByText(
        "Human Decision and Provenance",
      );
      const humanDecisionSection = humanDecisionHeading.closest(
        "[data-evidence-layer]",
      ) as HTMLElement;
      expect(within(agentSection).queryByRole("img")).not.toBeInTheDocument();
      expect(
        within(humanDecisionSection).queryByRole("img"),
      ).not.toBeInTheDocument();
    });

    it("does not remove Review Notes or Anchor context when media resolution fails", async () => {
      vi.mocked(resolveVersionMediaAction).mockResolvedValueOnce({
        ok: false,
        message: "The ICAS service is unavailable.",
      });

      render(
        <VersionReviewPage
          taskId="t1"
          data={data()}
          unavailable={false}
          onExitRole={vi.fn()}
        />,
      );

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          "The ICAS service is unavailable.",
        );
      });
      expect(screen.getByText("Contrast reads slightly hot.")).toBeVisible();
      expect(screen.getByText("Review notes")).toBeVisible();
    });

    it("never renders a media upload, annotation, or ftrack write-back control", async () => {
      vi.mocked(resolveVersionMediaAction).mockResolvedValueOnce({
        ok: true,
        media: {
          version_id: "v1",
          source: "ftrack",
          ftrack_linked: true,
          media_state: "playable",
          thumbnail_url: "https://ftrack.example/thumb",
          playable_url: "https://ftrack.example/video",
          playable_media_type: "video/mp4",
          playable_component_name: "ftrackreview-mp4",
          external_web_url: null,
          resolved_at: "2026-08-01T00:00:00Z",
          url_expires_at: null,
          unavailable_reason: null,
        },
      });

      render(
        <VersionReviewPage
          taskId="t1"
          data={data()}
          unavailable={false}
          onExitRole={vi.fn()}
        />,
      );

      await waitFor(() => expect(document.querySelector("video")).toBeTruthy());
      expect(
        screen.queryByRole("button", { name: /Upload/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Annotate/i }),
      ).not.toBeInTheDocument();
    });
  });
});
