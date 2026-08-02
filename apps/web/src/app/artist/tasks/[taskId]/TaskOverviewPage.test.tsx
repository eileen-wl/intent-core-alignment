import type { ArtistInboxItemRead } from "@intent-core/contracts";
import { cleanup, render, screen } from "@testing-library/react";
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

describe("TaskOverviewPage", () => {
  it("renders Project > Shot > Task > Task Overview breadcrumbs and all three real Context Tabs, Task Overview active", () => {
    render(
      <TaskOverviewPage
        taskId="t1"
        data={data()}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("link", { name: "D1 Demo Project" }),
    ).toHaveAttribute("href", "/artist/tasks");
    for (const [label, href] of [
      ["Current Version", "/artist/tasks/t1/current-version"],
      ["Feedback History", "/artist/tasks/t1/feedback-history"],
    ] as const) {
      expect(screen.getByRole("link", { name: label })).toHaveAttribute(
        "href",
        href,
      );
    }
    expect(screen.getByRole("link", { name: "Task Overview" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("does not render Intent, Execution, Dependencies, or Activity tabs", () => {
    render(
      <TaskOverviewPage
        taskId="t1"
        data={data()}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("link", { name: "Intent" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Execution" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Dependencies" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Activity" }),
    ).not.toBeInTheDocument();
  });

  it("Tasks stays the active sidebar item, never Review Inbox", () => {
    render(
      <TaskOverviewPage
        taskId="t1"
        data={data()}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByRole("link", { name: "Tasks" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("shows an honest unavailable state when the API could not be reached", () => {
    render(
      <TaskOverviewPage
        taskId="t1"
        data={null}
        unavailable
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText("This Task is unavailable")).toBeVisible();
  });

  it("renders exactly one Current focus with its real primary action", () => {
    render(
      <TaskOverviewPage
        taskId="t1"
        data={data()}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText("New Artist guidance is available")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Review guidance" }),
    ).toHaveAttribute("href", "/artist/tasks/t1");
  });

  it("shows Core Anchor context as honestly read-only, never an edit or confirm control", () => {
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
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText("Why: Creative Intent")).toBeVisible();
    expect(screen.getByText("A restrained dusk confrontation.")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /confirm/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByText("Read-only for your role").length,
    ).toBeGreaterThan(0);
  });

  it("honestly states no Core Anchor when none is confirmed", () => {
    render(
      <TaskOverviewPage
        taskId="t1"
        data={data()}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByText("No Core Anchor is confirmed for this Shot yet."),
    ).toBeVisible();
  });

  it("honestly states no Execution Anchor when none is confirmed", () => {
    render(
      <TaskOverviewPage
        taskId="t1"
        data={data({ item: item({ execution_anchor_state: "none" }) })}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByText("No Execution Anchor is confirmed for this Task yet."),
    ).toBeVisible();
  });

  it("honestly states no Artist guidance has been generated yet, with no fabricated content", () => {
    render(
      <TaskOverviewPage
        taskId="t1"
        data={data()}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByText(
        "No Artist guidance has been generated for this Task yet.",
      ),
    ).toBeVisible();
  });

  it("does not offer a Generate guidance action when there is no latest Version", () => {
    render(
      <TaskOverviewPage
        taskId="t1"
        data={data()}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /generate guidance/i }),
    ).not.toBeInTheDocument();
  });

  it("offers a Generate guidance action when a latest Version exists and no guidance yet", () => {
    render(
      <TaskOverviewPage
        taskId="t1"
        data={data({
          item: item({ latest_version_id: "v1", latest_version_name: "v001" }),
        })}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Generate guidance" }),
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
        unavailable={false}
        onExitRole={vi.fn()}
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
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText("Current Working Direction")).toBeVisible();
    expect(screen.getByText("AI interpretation")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Push the rim light slightly warmer." }),
    ).toHaveAttribute("href", "/artist/tasks/t1/current-version");
  });

  it("renders nothing extra when workingDirection has no items (honest empty state)", () => {
    render(
      <TaskOverviewPage
        taskId="t1"
        data={data()}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.queryByText("Current Working Direction"),
    ).not.toBeInTheDocument();
  });

  it("honestly states no dependencies have been recorded for a genuinely bare Task", () => {
    render(
      <TaskOverviewPage
        taskId="t1"
        data={data()}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByText("No dependencies have been recorded for this Task yet."),
    ).toBeVisible();
  });
});
