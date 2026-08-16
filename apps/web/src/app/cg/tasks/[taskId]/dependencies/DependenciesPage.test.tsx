import type {
  CgInboxItemRead,
  TaskDependencyRead,
} from "@intent-core/contracts";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/cg/tasks/t1/dependencies",
}));

vi.mock("@/features/cg/actions", () => ({
  acknowledgeDependencyAction: vi.fn(),
  createDependencyAction: vi.fn(),
  resolveDependencyAction: vi.fn(),
}));

import type { DependenciesWorkspaceData } from "@/features/cg/dependencies-workspace/data";
import { DependenciesPage } from "./DependenciesPage";

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
    active_execution_anchor_summary: null,
    pending_human_gate_id: null,
    latest_version_id: null,
    latest_version_name: null,
    latest_version_number: null,
    open_dependency_count: 1,
    current_focus: {
      focus_type: "dependency_needs_attention",
      title: "An unresolved dependency needs your interpretation",
      explanation:
        "A real recorded dependency or cross-role conflict is still open.",
      target_route: "/cg/tasks/t1/dependencies",
      primary_action_label: "Review dependencies",
      actionable: true,
    },
    sort_rank: 0,
    ...overrides,
  };
}

function dependency(
  overrides: Partial<TaskDependencyRead> = {},
): TaskDependencyRead {
  return {
    id: "d1",
    project_id: "p1",
    shot_id: "s1",
    task_id: "t1",
    related_version_id: null,
    kind: "dependency",
    status: "open",
    description: "Blocked on comp grade.",
    severity: "medium",
    escalated_to_role: null,
    created_by_actor_kind: "human",
    created_by_actor_id: "cg-1",
    created_by_human_role: "cg_supervisor",
    created_at: "2026-01-01T00:00:00Z",
    resolved_by_actor_id: null,
    resolved_by_human_role: null,
    resolved_at: null,
    related_cross_role_assessment_id: null,
    ...overrides,
  };
}

function data(
  overrides: Partial<DependenciesWorkspaceData> = {},
): DependenciesWorkspaceData {
  return {
    item: item(),
    dependencies: [dependency()],
    ...overrides,
  };
}

describe("DependenciesPage", () => {
  it("shows an honest unavailable state when the page-specific data failed to load", () => {
    render(<DependenciesPage taskId="t1" data={null} />);
    expect(screen.getByText("This page is unavailable")).toBeVisible();
  });

  it("shows the honest empty state when no dependency has been recorded", () => {
    render(<DependenciesPage taskId="t1" data={data({ dependencies: [] })} />);
    expect(
      screen.getByText(
        "No unresolved dependencies have been recorded for this Task.",
      ),
    ).toBeVisible();
  });

  it("renders a real open dependency under Open dependencies", () => {
    render(<DependenciesPage taskId="t1" data={data()} />);
    expect(screen.getByText("Blocked on comp grade.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Acknowledge" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Resolve" })).toBeVisible();
  });

  it("renders a real conflict under Cross-role conflicts, separate from dependencies", () => {
    render(
      <DependenciesPage
        taskId="t1"
        data={data({
          dependencies: [
            dependency({
              id: "c1",
              kind: "conflict",
              description: "Cross-role clash.",
            }),
          ],
        })}
      />,
    );
    expect(screen.getByText("Cross-role clash.")).toBeVisible();
  });

  it("renders a resolved dependency under Resolved / history", () => {
    render(
      <DependenciesPage
        taskId="t1"
        data={data({
          dependencies: [
            dependency({
              id: "d1",
              status: "resolved",
              resolved_by_human_role: "cg_supervisor",
              resolved_at: "2026-01-03T00:00:00Z",
            }),
          ],
        })}
      />,
    );
    expect(screen.getByText("resolved")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Resolve" }),
    ).not.toBeInTheDocument();
  });

  it("provides the real Record dependency form", () => {
    render(<DependenciesPage taskId="t1" data={data()} />);
    expect(screen.getByRole("button", { name: "Record" })).toBeVisible();
  });
});
