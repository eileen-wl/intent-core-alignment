import type {
  AnchorContextRead,
  ArtistInboxItemRead,
} from "@intent-core/contracts";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TaskOverviewData } from "@/features/artist/task-overview/data";
import { TaskOverviewPage } from "./TaskOverviewPage";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/artist/tasks/t1",
}));

afterEach(() => {
  cleanup();
});

function item(
  overrides: Partial<ArtistInboxItemRead> = {},
): ArtistInboxItemRead {
  return {
    task_id: "t1",
    task_name: "Compositing Review",
    department: "compositing",
    task_source: "manual",
    shot_id: "s1",
    shot_name: "Shot 010",
    project_id: "p1",
    project_name: "D1 Demo Project",
    execution_anchor_state: "confirmed",
    active_execution_anchor_revision_id: "ea1",
    active_execution_anchor_summary:
      "Keep the silhouette readable against the backlight.",
    latest_version_id: null,
    latest_version_name: null,
    latest_version_number: null,
    guidance_state: "none",
    latest_guidance_id: null,
    open_review_note_count: 0,
    open_dependency_count: 0,
    current_focus: {
      focus_type: "guidance_available",
      title: "New Artist guidance is available",
      explanation: "Real guidance has been generated for the latest Version.",
      target_route: "/artist/tasks/t1",
      primary_action_label: "Review guidance",
      actionable: true,
    },
    sort_rank: 0,
    ...overrides,
  };
}

function data(overrides: Partial<TaskOverviewData> = {}): TaskOverviewData {
  return {
    item: item(),
    coreAnchorRevision: null,
    executionAnchorRevision: null,
    latestGuidance: null,
    dependencies: [],
    latestReviewNote: null,
    workingDirection: { title: "Current Working Direction", items: [] },
    ...overrides,
  };
}

function artistAnchorContext(missing = false): AnchorContextRead {
  return {
    role: "artist",
    shot_id: "s1",
    task_id: "t1",
    core_anchor: {
      exists: !missing,
      lifecycle_state: missing ? "missing" : "confirmed",
      confirmed_revision_id: missing ? null : "ca1",
      confirmed_revision_number: missing ? null : 1,
      direction_summary: missing
        ? null
        : "Keep the confrontation restrained and internal.",
      must_preserve: missing ? null : "Keep the response internal.",
      allowed_variation: missing ? null : "Local exposure may vary.",
      confirmed_by_human_role: missing ? null : "vfx_supervisor",
      confirmed_by_actor_id: missing ? null : "vfx-1",
      link_target: "/vfx/shots/s1/intent",
      newer_draft_exists: false,
      pending_human_gate_exists: false,
      draft_revision_number: null,
    },
    execution_anchor: missing
      ? {
          exists: false,
          department: "compositing",
          lifecycle_state: "missing",
          context_state: "missing",
          confirmed_revision_id: null,
          confirmed_revision_number: null,
          direction_summary: null,
          execution_boundary: null,
          allowed_refinement: null,
          based_on_core_anchor_revision_id: null,
          based_on_core_anchor_revision_number: null,
          upstream_relationship_available: false,
          confirmed_by_human_role: null,
          confirmed_by_actor_id: null,
          link_target: "/cg/tasks/t1/execution",
          draft_revision_number: null,
          draft_source: null,
        }
      : {
          exists: true,
          department: "compositing",
          lifecycle_state: "confirmed",
          context_state: "current",
          confirmed_revision_id: "ea1",
          confirmed_revision_number: 2,
          direction_summary:
            "Keep the silhouette readable against the backlight.",
          execution_boundary: "Stay within the approved contrast range.",
          allowed_refinement: "Refine local edges only.",
          based_on_core_anchor_revision_id: "ca1",
          based_on_core_anchor_revision_number: 1,
          upstream_relationship_available: true,
          confirmed_by_human_role: "cg_supervisor",
          confirmed_by_actor_id: "cg-1",
          link_target: "/cg/tasks/t1/execution",
          draft_revision_number: null,
          draft_source: null,
        },
    attention: {
      level: "not_assessed",
      summary: null,
      review_requirement:
        "No current attention result is available for this Task.",
      source_assessment_id: null,
      source_signal_id: null,
      assessed_at: null,
      link_target: null,
    },
    current_version: {
      version_id: "v1",
      name: "v001",
      version_number: 1,
      link_target: "/artist/tasks/t1/current-version",
    },
    guidance_state: "missing",
    open_vfx_escalation: false,
    next_action: missing
      ? {
          title: "Core Anchor confirmation is required",
          why_now: "The VFX Supervisor has not confirmed shared direction.",
          downstream_effect: "CG translation follows VFX confirmation.",
          target_route: null,
          action_label: null,
          executable: false,
        }
      : {
          title: "Artist guidance can be generated for this Task",
          why_now: "Confirmed direction and a Version are available.",
          downstream_effect: "Guidance will remain advisory.",
          target_route: "/artist/tasks/t1",
          action_label: "Generate guidance",
          executable: true,
        },
  };
}

describe("TaskOverviewPage", () => {
  it("shows an honest unavailable state when the page-specific data failed to load", () => {
    render(<TaskOverviewPage taskId="t1" data={null} anchorContext={null} />);
    expect(screen.getByText("This page is unavailable")).toBeVisible();
  });

  it("renders exactly one Current focus with its real primary action", () => {
    render(<TaskOverviewPage taskId="t1" data={data()} />);
    expect(screen.getByText("New Artist guidance is available")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Review guidance" }),
    ).toHaveAttribute("href", "/artist/tasks/t1");
  });

  it("does not duplicate the complete WHY briefing below Anchor Context", () => {
    render(
      <TaskOverviewPage
        taskId="t1"
        data={data({
          coreAnchorRevision: {
            id: "ca1",
            core_anchor_id: "ca-parent",
            revision_number: 1,
            status: "confirmed",
            shot_objective: "A restrained dusk confrontation.",
            emotional_tone: null,
            visual_focus: null,
            rhythm_intensity: null,
            character_relationship: null,
            narrative_priority: null,
            core_summary:
              "The final confrontation should feel restrained, not spectacular.",
            created_by_actor_kind: "human",
            created_by_actor_id: "vfx-1",
            created_by_human_role: "vfx_supervisor",
            created_by_agent_type: null,
            created_by_agent_run_id: null,
            context_snapshot_id: null,
            confirmed_by_human_role: "vfx_supervisor",
            confirmed_by_actor_id: "vfx-1",
            confirmed_at: "2026-07-01T00:00:00Z",
            supersedes_revision_id: null,
            source_intent_decomposition_id: null,
            created_at: "2026-07-01T00:00:00Z",
            updated_at: "2026-07-01T00:00:00Z",
            constraints: [],
            variation_zones: [],
            drift_risks: [],
            references: [],
            open_questions: [],
          },
        })}
      />,
    );
    expect(screen.queryByText("Why: Creative Intent")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /confirm/i }),
    ).not.toBeInTheDocument();
  });

  it("does not add a second missing Core Anchor summary (the persistent Task layout's AnchorContextLayer owns the honest-unavailable state)", () => {
    render(<TaskOverviewPage taskId="t1" data={data()} />);
    expect(
      screen.queryByText("No Core Anchor is confirmed for this Shot yet."),
    ).not.toBeInTheDocument();
  });

  it("does not add a second missing Execution Anchor summary", () => {
    render(
      <TaskOverviewPage
        taskId="t1"
        data={data({ item: item({ execution_anchor_state: "none" }) })}
      />,
    );
    expect(
      screen.queryByText("No Execution Anchor is confirmed for this Task yet."),
    ).not.toBeInTheDocument();
  });

  it("honestly states no Artist guidance has been generated yet, with no fabricated content", () => {
    render(<TaskOverviewPage taskId="t1" data={data()} />);
    expect(
      screen.getByText(
        "No Artist guidance has been generated for this Task yet.",
      ),
    ).toBeVisible();
  });

  it("shows a disabled Guidance state when there is no latest Version", () => {
    render(<TaskOverviewPage taskId="t1" data={data()} />);
    expect(
      screen.getByRole("button", { name: /generate guidance/i }),
    ).toBeDisabled();
    expect(screen.getByText("A Production Version is required.")).toBeVisible();
  });

  it("offers a Generate guidance action when a latest Version exists and no guidance yet", () => {
    render(
      <TaskOverviewPage
        taskId="t1"
        data={data({
          item: item({ latest_version_id: "v1", latest_version_name: "v001" }),
        })}
        anchorContext={artistAnchorContext()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Generate guidance" }),
    ).toBeEnabled();
  });

  it("disables Guidance generation and names the owning roles when Anchors are missing", () => {
    render(
      <TaskOverviewPage
        taskId="t1"
        data={data({
          item: item({
            latest_version_id: "v1",
            latest_version_name: "v001",
            execution_anchor_state: "none",
          }),
        })}
        anchorContext={artistAnchorContext(true)}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Generate guidance" }),
    ).toBeDisabled();
    expect(
      screen.getByText(
        "The VFX Supervisor must confirm the Core Anchor first.",
      ),
    ).toBeVisible();
    expect(
      screen.getByText("The CG Supervisor must confirm the Execution Anchor."),
    ).toBeVisible();
  });

  it("offers a Regenerate guidance action and an outdated notice when guidance is outdated", () => {
    render(
      <TaskOverviewPage
        taskId="t1"
        data={data({
          item: item({
            latest_version_id: "v1",
            latest_version_name: "v001",
            guidance_state: "outdated",
          }),
          latestGuidance: {
            id: "g1",
            project_id: "p1",
            shot_id: "s1",
            task_id: "t1",
            version_id: "v1",
            execution_anchor_revision_id: "ea-old",
            context_snapshot_id: "cs1",
            agent_run_id: "run1",
            guidance_output: {
              executive_summary: "Push the rim light slightly warmer.",
              creative_intent_read: {
                summary: "s",
                why_it_matters: "w",
                priority: "medium",
                evidence: [
                  { source_type: "shot", source_id: "s1", label: "Shot" },
                ],
              },
              task_goal: {
                summary: "s",
                why_it_matters: "w",
                priority: "medium",
                evidence: [
                  { source_type: "task", source_id: "t1", label: "Task" },
                ],
              },
              current_iteration_read: {
                summary: "s",
                why_it_matters: "w",
                priority: "medium",
                evidence: [
                  { source_type: "version", source_id: "v1", label: "Version" },
                ],
              },
              non_negotiables: [],
              allowed_variations: [],
              feedback_translations: [],
              iteration_priorities: [],
              cross_department_dependencies: [],
              questions_for_human_supervisor: [],
              evidence_gaps: [],
            },
            created_at: "2026-07-01T00:00:00Z",
          },
        })}
        anchorContext={artistAnchorContext()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Regenerate guidance" }),
    ).toBeVisible();
    expect(
      screen.getByText(
        /This guidance references an earlier confirmed Execution Anchor revision/,
      ),
    ).toBeVisible();
    expect(
      screen.getByText("Push the rim light slightly warmer."),
    ).toBeVisible();
  });

  it("renders the Current Working Direction section with the Artist guidance line labelled as Agent interpretation", () => {
    render(
      <TaskOverviewPage
        taskId="t1"
        data={data({
          workingDirection: {
            title: "Current Working Direction",
            items: [
              {
                id: "artist-guidance",
                label: "Artist Agent guidance",
                value: "Push the rim light slightly warmer.",
                authority: "ai-interpretation",
                sourceType: "artist_agent_guidance",
                detail: "Artist Agent guidance",
                href: "/artist/tasks/t1/current-version",
              },
            ],
          },
        })}
      />,
    );
    expect(screen.getByText("Current Working Direction")).toBeVisible();
    expect(screen.getByText("AI interpretation")).toBeVisible();
    expect(
      screen.getByText("Push the rim light slightly warmer."),
    ).toBeVisible();
    expect(
      screen.getByText("Push the rim light slightly warmer.").closest("a"),
    ).toBeNull();
    expect(screen.getByRole("link", { name: "View details" })).toHaveAttribute(
      "href",
      "/artist/tasks/t1/current-version",
    );
  });

  it("renders nothing extra when workingDirection has no items (honest empty state)", () => {
    render(<TaskOverviewPage taskId="t1" data={data()} />);
    expect(
      screen.queryByText("Current Working Direction"),
    ).not.toBeInTheDocument();
  });

  it("honestly states no dependencies have been recorded for a genuinely bare Task", async () => {
    render(<TaskOverviewPage taskId="t1" data={data()} />);
    expect(
      screen.getByText("No dependencies have been recorded for this Task yet."),
    ).toBeInTheDocument();
    await userEvent.click(screen.getAllByText("Detailed context")[0]);
    expect(
      screen.getByText("No dependencies have been recorded for this Task yet."),
    ).toBeVisible();
  });

  it("keeps the Generate/Regenerate guidance action visible outside any collapsed Detailed context", () => {
    render(
      <TaskOverviewPage
        taskId="t1"
        data={data({
          item: item({ latest_version_id: "v1", latest_version_name: "v001" }),
        })}
        anchorContext={artistAnchorContext()}
      />,
    );
    // Step 9B-1 owner-validation correction: the Guidance action is a
    // genuinely non-duplicated critical action and must stay visible,
    // never collapsed inside a Detailed context disclosure.
    expect(
      screen.getByRole("button", { name: "Generate guidance" }),
    ).toBeVisible();
  });
});
