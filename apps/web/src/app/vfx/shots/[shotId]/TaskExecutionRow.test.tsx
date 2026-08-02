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
          latest_version_scope: "task",
        })}
      />,
    );
    expect(screen.getByText(/SH010_v002 \(v2\) · ftrack-synced/)).toBeVisible();
  });

  it("labels a Task-linked Version distinctly from a Shot-level fallback Version", () => {
    const { rerender } = render(
      <TaskExecutionRow
        shotId="s1"
        task={task({
          latest_version_name: "bc0040_comp_v003",
          latest_version_number: 3,
          latest_version_scope: "task",
        })}
      />,
    );
    expect(screen.getByText(/Task-linked Version/)).toBeVisible();
    expect(
      screen.queryByText(/Shot-level Version fallback/),
    ).not.toBeInTheDocument();

    rerender(
      <TaskExecutionRow
        shotId="s1"
        task={task({
          latest_version_name: "D1_STEP3_VFX_REVIEW_001",
          latest_version_number: 1,
          latest_version_scope: "shot_unscoped",
        })}
      />,
    );
    expect(
      screen.getByText(
        /Shot-level Version fallback — not linked to this Task in ICAS/,
      ),
    ).toBeVisible();
    expect(screen.queryByText(/^Task-linked Version$/)).not.toBeInTheDocument();
  });

  it("never renders a raw UUID for the latest Version", () => {
    const versionId = "8a72858d-8d06-47ab-a28d-5ee077f561c8";
    render(
      <TaskExecutionRow
        shotId="s1"
        task={task({
          latest_version_id: versionId,
          latest_version_name: "SH010_v002",
          latest_version_number: 2,
          latest_version_scope: "task",
        })}
      />,
    );
    expect(screen.queryByText(new RegExp(versionId))).not.toBeInTheDocument();
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

  it("labels navigation honestly as the Shot-wide Versions destination, not a Task-specific one", () => {
    render(<TaskExecutionRow shotId="s1" task={task()} />);
    const link = screen.getByRole("link", { name: "View Shot Versions →" });
    expect(link).toHaveAttribute("href", "/vfx/shots/s1/versions");
    expect(screen.queryByText(/^View details/)).not.toBeInTheDocument();
  });

  it("identifies CG task focus as CG-owned context, never an unqualified second-person sentence", () => {
    render(
      <TaskExecutionRow
        shotId="s1"
        task={task({
          current_focus_type: "execution_anchor_gate_pending",
          current_focus_actionable: true,
          current_focus_title:
            "Execution Anchor draft awaiting your confirmation",
        })}
      />,
    );
    expect(screen.getByText(/^CG task focus:/)).toBeVisible();
    expect(screen.queryByText(/your confirmation/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\byour\b/i)).not.toBeInTheDocument();
  });

  it("states no current CG action without implying VFX itself needs no attention", () => {
    render(
      <TaskExecutionRow
        shotId="s1"
        task={task({
          current_focus_type: "none",
          current_focus_actionable: false,
          alignment_concern_summary: "High-attention drift observed in tone.",
          alignment_concern_attention_level: "high",
        })}
      />,
    );
    expect(
      screen.getByText("No current CG action is required for this Task."),
    ).toBeVisible();
    expect(
      screen.getByText(/High-attention drift observed in tone\./),
    ).toBeVisible();
  });

  it("lets a no-CG-action focus coexist with a high advisory concern without contradiction, and never turns it into a formal escalation", () => {
    render(
      <TaskExecutionRow
        shotId="s1"
        task={task({
          current_focus_type: "none",
          current_focus_actionable: false,
          alignment_concern_summary:
            "Restraint may be drifting across departments.",
          alignment_concern_attention_level: "high",
          open_escalation: false,
        })}
      />,
    );
    expect(
      screen.getByText("No current CG action is required for this Task."),
    ).toBeVisible();
    expect(screen.getByText("AI interpretation")).toBeVisible();
    expect(screen.getByText("No open escalation to VFX.")).toBeVisible();
    expect(screen.queryByText("Escalated to VFX")).not.toBeInTheDocument();
  });

  it("shows a formal escalation from persisted escalation data alone, regardless of the advisory concern", () => {
    render(
      <TaskExecutionRow
        shotId="s1"
        task={task({
          alignment_concern_summary: null,
          alignment_concern_attention_level: null,
          open_escalation: true,
          open_escalation_summary:
            "Lighting cannot proceed without a revised Core Anchor.",
        })}
      />,
    );
    expect(screen.getByText("Escalated to VFX")).toBeVisible();
    expect(
      screen.getByText("No current alignment concern recorded."),
    ).toBeVisible();
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
