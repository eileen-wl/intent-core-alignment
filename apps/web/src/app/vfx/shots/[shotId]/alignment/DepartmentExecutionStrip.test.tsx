import type {
  DepartmentExecutionOverviewRead,
  DepartmentExecutionTaskRead,
} from "@intent-core/contracts";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { DepartmentExecutionStrip } from "./DepartmentExecutionStrip";

afterEach(() => {
  cleanup();
});

function task(
  overrides: Partial<DepartmentExecutionTaskRead> = {},
): DepartmentExecutionTaskRead {
  return {
    task_id: "t1",
    task_name: "Animation Pass",
    department: "animation",
    task_source: "manual",
    execution_anchor_state: "confirmed",
    execution_anchor_revision_number: 2,
    execution_anchor_summary: null,
    latest_version_id: "v1",
    latest_version_name: "Anim R2",
    latest_version_number: 2,
    latest_version_source: "manual",
    latest_version_scope: "task",
    current_focus_type: "none",
    current_focus_title: "Nothing requires attention",
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
  tasks: DepartmentExecutionTaskRead[],
): DepartmentExecutionOverviewRead {
  return { shot_id: "s1", tasks, generated_at: "2026-08-01T00:00:00Z" };
}

describe("DepartmentExecutionStrip", () => {
  it("renders nothing when the role-gated overview call failed", () => {
    const { container } = render(
      <DepartmentExecutionStrip shotId="s1" overview={null} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows an honest empty state when the Shot has no Tasks", () => {
    render(<DepartmentExecutionStrip shotId="s1" overview={overview([])} />);
    expect(
      screen.getByText("No Tasks are recorded for this Shot."),
    ).toBeVisible();
  });

  it("renders one compact row per department for the current Golden Journey's one-Task-per-department data", () => {
    render(
      <DepartmentExecutionStrip
        shotId="s1"
        overview={overview([
          task({ task_id: "t1", department: "animation" }),
          task({ task_id: "t2", department: "lighting" }),
          task({ task_id: "t3", department: "comp" }),
        ])}
      />,
    );
    expect(screen.getByText("animation")).toBeVisible();
    expect(screen.getByText("lighting")).toBeVisible();
    expect(screen.getByText("comp")).toBeVisible();
  });

  it("shows each Task individually, never a fabricated combined state, when a department has multiple Tasks", () => {
    render(
      <DepartmentExecutionStrip
        shotId="s1"
        overview={overview([
          task({
            task_id: "t1",
            department: "lighting",
            task_name: "Lighting Pass A",
          }),
          task({
            task_id: "t2",
            department: "lighting",
            task_name: "Lighting Pass B",
            execution_anchor_state: "draft",
          }),
        ])}
      />,
    );
    expect(screen.getByText("lighting — Lighting Pass A")).toBeVisible();
    expect(screen.getByText("lighting — Lighting Pass B")).toBeVisible();
  });

  it("preserves a Task honestly under a 'No department recorded' label rather than fabricating one", () => {
    render(
      <DepartmentExecutionStrip
        shotId="s1"
        overview={overview([task({ task_id: "t1", department: null })])}
      />,
    );
    expect(screen.getByText("No department recorded")).toBeVisible();
  });

  it("shows the real execution state, current Version, and alignment risk for a row", () => {
    render(
      <DepartmentExecutionStrip
        shotId="s1"
        overview={overview([
          task({
            execution_anchor_state: "confirmed",
            execution_anchor_revision_number: 2,
            latest_version_name: "Anim R2",
            latest_version_number: 2,
            alignment_concern_attention_level: "medium",
          }),
        ])}
      />,
    );
    const summary = screen
      .getByText("animation")
      .closest("summary") as HTMLElement;
    expect(within(summary).getByText("Confirmed (Revision 2)")).toBeVisible();
    expect(within(summary).getByText("Anim R2 (v2)")).toBeVisible();
    expect(within(summary).getByText("Medium risk")).toBeVisible();
  });

  it("does not show a risk badge when no alignment concern is recorded", () => {
    render(
      <DepartmentExecutionStrip
        shotId="s1"
        overview={overview([task({ alignment_concern_attention_level: null })])}
      />,
    );
    expect(screen.queryByText(/risk/)).not.toBeInTheDocument();
  });

  it("shows an explicit disclosure chevron on every row, not just the native <details> marker", () => {
    const { container } = render(
      <DepartmentExecutionStrip
        shotId="s1"
        overview={overview([
          task({ task_id: "t1", department: "animation" }),
          task({ task_id: "t2", department: "lighting" }),
        ])}
      />,
    );
    expect(
      container.querySelectorAll('summary > span[aria-hidden="true"]'),
    ).toHaveLength(2);
  });

  it("reflects the expanded state on the underlying <details> element so the chevron indicator can key off it", async () => {
    const user = userEvent.setup();
    render(
      <DepartmentExecutionStrip
        shotId="s1"
        overview={overview([task({ task_id: "t1" })])}
      />,
    );
    const details = screen
      .getByText("animation")
      .closest("details") as HTMLDetailsElement;
    expect(details.open).toBe(false);

    await user.click(screen.getByText("animation"));

    expect(details.open).toBe(true);
  });

  it("keeps the row compact by default, with drill-down detail collapsed", () => {
    render(
      <DepartmentExecutionStrip
        shotId="s1"
        overview={overview([
          task({
            alignment_concern_summary: "Animation pushes toward heroic energy.",
          }),
        ])}
      />,
    );
    expect(
      screen.getByText("Animation pushes toward heroic energy."),
    ).not.toBeVisible();
  });

  it("reveals Task identity and the real alignment concern summary once expanded", async () => {
    const user = userEvent.setup();
    render(
      <DepartmentExecutionStrip
        shotId="s1"
        overview={overview([
          task({
            task_name: "Animation Pass",
            alignment_concern_summary: "Animation pushes toward heroic energy.",
            alignment_concern_attention_level: "medium",
          }),
        ])}
      />,
    );

    await user.click(screen.getByText("animation"));

    expect(
      screen.getByText("Animation pushes toward heroic energy."),
    ).toBeVisible();
    expect(screen.getByText("Task")).toBeVisible();
    expect(screen.getAllByText("Animation Pass").length).toBeGreaterThan(0);
  });

  it("shows the real Execution Anchor summary text when present", async () => {
    const user = userEvent.setup();
    render(
      <DepartmentExecutionStrip
        shotId="s1"
        overview={overview([
          task({
            execution_anchor_summary: "Blocking honors the confirmed beat.",
          }),
        ])}
      />,
    );

    await user.click(screen.getByText("animation"));

    expect(
      screen.getByText("Blocking honors the confirmed beat."),
    ).toBeVisible();
  });

  it("links to the real Shot-wide Versions page when a Version is recorded -- never a fabricated per-Version route", async () => {
    const user = userEvent.setup();
    render(
      <DepartmentExecutionStrip
        shotId="s1"
        overview={overview([task({ latest_version_id: "v1" })])}
      />,
    );

    await user.click(screen.getByText("animation"));

    const link = screen.getByRole("link", { name: "View in Versions →" });
    expect(link).toHaveAttribute("href", "/vfx/shots/s1/versions");
  });

  it("does not show a Version link when no Version is recorded for the Task", async () => {
    const user = userEvent.setup();
    render(
      <DepartmentExecutionStrip
        shotId="s1"
        overview={overview([
          task({
            latest_version_id: null,
            latest_version_name: null,
            latest_version_number: null,
          }),
        ])}
      />,
    );

    await user.click(screen.getByText("animation"));

    expect(
      screen.queryByRole("link", { name: "View in Versions →" }),
    ).not.toBeInTheDocument();
  });

  it("strips a verified CG generator label from the Alignment concern and Execution context text (shared @/design stripGeneratorLabel, confirmed leaking implementation-only text)", async () => {
    const user = userEvent.setup();
    render(
      <DepartmentExecutionStrip
        shotId="s1"
        overview={overview([
          task({
            alignment_concern_summary: "[CG deterministic] Reads hot.",
            execution_anchor_summary:
              "Boundary reads tight [CG Agent execution anchor draft - D1 combined-intensity ceiling translation] near the ceiling.",
          }),
        ])}
      />,
    );

    await user.click(screen.getByText("animation"));

    expect(screen.getByText("Reads hot.")).toBeVisible();
    expect(
      screen.getByText("Boundary reads tight near the ceiling."),
    ).toBeVisible();
    expect(screen.queryByText(/CG deterministic/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/CG Agent execution anchor draft/),
    ).not.toBeInTheDocument();
  });
});
