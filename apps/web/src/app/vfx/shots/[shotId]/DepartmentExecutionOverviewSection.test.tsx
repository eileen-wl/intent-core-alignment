import type {
  DepartmentExecutionOverviewRead,
  DepartmentExecutionTaskRead,
} from "@intent-core/contracts";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DepartmentExecutionOverviewSection } from "./DepartmentExecutionOverviewSection";

afterEach(() => {
  cleanup();
});

function task(
  overrides: Partial<DepartmentExecutionTaskRead> = {},
): DepartmentExecutionTaskRead {
  return {
    task_id: "t1",
    task_name: "Compositing Review",
    department: "comp",
    task_source: "manual",
    execution_anchor_state: "none",
    execution_anchor_revision_number: null,
    execution_anchor_summary: null,
    latest_version_id: null,
    latest_version_name: null,
    latest_version_number: null,
    latest_version_source: null,
    latest_version_scope: null,
    current_focus_type: "none",
    current_focus_title:
      "Nothing requires your attention on this Task right now",
    current_focus_actionable: false,
    open_dependency_count: 0,
    top_open_dependency_description: null,
    top_open_dependency_severity: null,
    alignment_concern_summary: null,
    alignment_concern_attention_level: null,
    open_escalation: false,
    open_escalation_summary: null,
    last_updated_at: "2026-08-01T00:00:00Z",
    last_updated_source: "task_created",
    ...overrides,
  };
}

function overview(
  overrides: Partial<DepartmentExecutionOverviewRead> = {},
): DepartmentExecutionOverviewRead {
  return {
    shot_id: "s1",
    tasks: [task()],
    generated_at: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

describe("DepartmentExecutionOverviewSection", () => {
  it("renders nothing when overview is null (the role-gated backend call failed)", () => {
    const { container } = render(
      <DepartmentExecutionOverviewSection shotId="s1" overview={null} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows an honest 'No Tasks are recorded for this Shot' empty state", () => {
    render(
      <DepartmentExecutionOverviewSection
        shotId="s1"
        overview={overview({ tasks: [] })}
      />,
    );
    expect(
      screen.getByText("No Tasks are recorded for this Shot."),
    ).toBeVisible();
  });

  it("renders exactly one row per real Task", () => {
    render(
      <DepartmentExecutionOverviewSection
        shotId="s1"
        overview={overview({
          tasks: [
            task({ task_id: "t1", task_name: "Compositing Review" }),
            task({ task_id: "t2", task_name: "Lighting Pass" }),
          ],
        })}
      />,
    );
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Compositing Review")).toBeVisible();
    expect(screen.getByText("Lighting Pass")).toBeVisible();
  });

  it("renders the section heading", () => {
    render(
      <DepartmentExecutionOverviewSection shotId="s1" overview={overview()} />,
    );
    expect(
      screen.getByRole("heading", { name: "Department Execution Overview" }),
    ).toBeVisible();
  });
});
