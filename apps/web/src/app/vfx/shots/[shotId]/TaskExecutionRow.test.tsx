import type { DepartmentExecutionTaskRead } from "@intent-core/contracts";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TaskExecutionRow } from "./TaskExecutionRow";

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
    current_focus_title: "Nothing requires CG attention right now",
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

describe("TaskExecutionRow", () => {
  it("shows the Task name and department", () => {
    render(<TaskExecutionRow shotId="s1" task={task()} />);
    expect(screen.getByText("Compositing Review")).toBeVisible();
    expect(screen.getByText("comp")).toBeVisible();
  });

  it("shows an honest 'no Execution Anchor yet' state, never a raw enum", () => {
    render(
      <TaskExecutionRow
        shotId="s1"
        task={task({ execution_anchor_state: "none" })}
      />,
    );
    expect(screen.getByText("No Execution Anchor yet")).toBeVisible();
    expect(screen.queryByText(/^none$/)).not.toBeInTheDocument();
  });

  it("distinguishes a confirmed Execution Anchor, with its real revision number, from a draft", () => {
    render(
      <TaskExecutionRow
        shotId="s1"
        task={task({
          execution_anchor_state: "confirmed",
          execution_anchor_revision_number: 2,
        })}
      />,
    );
    expect(screen.getByText("Confirmed (Revision 2)")).toBeVisible();
  });

  it("shows an honest 'no Production Version recorded' state when none exists", () => {
    render(<TaskExecutionRow shotId="s1" task={task()} />);
    expect(screen.getByText(/No Production Version recorded\./)).toBeVisible();
  });

  it("shows the latest Version's name and number, and an ftrack-synced marker when relevant", () => {
    render(
      <TaskExecutionRow
        shotId="s1"
        task={task({
          latest_version_name: "SH010_v002",
          latest_version_number: 2,
          latest_version_source: "ftrack",
        })}
      />,
    );
    expect(screen.getByText(/SH010_v002 \(v2\) · ftrack-synced/)).toBeVisible();
  });

  it("shows an honest 'no open dependencies' state, and real open dependency content otherwise", () => {
    const { rerender } = render(<TaskExecutionRow shotId="s1" task={task()} />);
    expect(screen.getByText("No open dependencies.")).toBeVisible();

    rerender(
      <TaskExecutionRow
        shotId="s1"
        task={task({
          open_dependency_count: 1,
          top_open_dependency_description: "Waiting on Layout to lock camera.",
          top_open_dependency_severity: "high",
        })}
      />,
    );
    expect(
      screen.getByText(
        /1 open dependency — highest priority: Waiting on Layout to lock camera\. \(high severity\)/,
      ),
    ).toBeVisible();
  });

  it("marks a real alignment concern as advisory (AI interpretation), never a confirmed fact", () => {
    render(
      <TaskExecutionRow
        shotId="s1"
        task={task({
          alignment_concern_summary: "Restraint reads clearly across roles.",
          alignment_concern_attention_level: "medium",
        })}
      />,
    );
    expect(screen.getByText("AI interpretation")).toBeVisible();
    expect(
      screen.getByText(/Restraint reads clearly across roles\./),
    ).toBeVisible();
  });

  it("shows an honest 'no current alignment concern recorded' state, never implying confirmed alignment", () => {
    render(<TaskExecutionRow shotId="s1" task={task()} />);
    expect(
      screen.getByText("No current alignment concern recorded."),
    ).toBeVisible();
  });

  it("shows an honest 'no open escalation' state, and a real escalation distinctly otherwise", () => {
    const { rerender } = render(<TaskExecutionRow shotId="s1" task={task()} />);
    expect(screen.getByText("No open escalation to VFX.")).toBeVisible();

    rerender(
      <TaskExecutionRow
        shotId="s1"
        task={task({
          open_escalation: true,
          open_escalation_summary:
            "Lighting cannot proceed without a revised Core Anchor.",
        })}
      />,
    );
    expect(screen.getByText("Escalated to VFX")).toBeVisible();
    expect(
      screen.getByText(
        "Lighting cannot proceed without a revised Core Anchor.",
      ),
    ).toBeVisible();
  });

  it("links View details to the existing, permitted VFX Versions route -- never a /cg/... route", () => {
    render(<TaskExecutionRow shotId="s1" task={task()} />);
    const link = screen.getByRole("link", { name: "View details →" });
    expect(link).toHaveAttribute("href", "/vfx/shots/s1/versions");
  });

  it("never renders a CG confirm/reject/generate/resolve control", () => {
    render(
      <TaskExecutionRow
        shotId="s1"
        task={task({
          execution_anchor_state: "awaiting_confirmation",
          open_dependency_count: 1,
          top_open_dependency_description: "Waiting on Layout.",
          open_escalation: true,
          open_escalation_summary: "Escalated.",
        })}
      />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(/\bConfirm\b/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\bReject\b/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\bResolve\b/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\bGenerate\b/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});
