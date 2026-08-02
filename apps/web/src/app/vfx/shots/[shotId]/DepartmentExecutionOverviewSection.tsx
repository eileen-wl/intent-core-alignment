import type { DepartmentExecutionOverviewRead } from "@intent-core/contracts";

import { SectionHeader } from "@/design";
import { TaskExecutionRow } from "./TaskExecutionRow";
import styles from "./DepartmentExecutionOverviewSection.module.css";

/** `/vfx/shots/:shotId` -- Department Execution Overview (Step 9B-3;
 * docs/step-9/05_STEP_9B3_DEPARTMENT_EXECUTION_OVERVIEW.md). A compact,
 * read-only, navigate-only summary of the Shot's real Tasks' execution
 * state -- never a second dashboard of tiny cards, never an embedded CG
 * Workspace, never a VFX edit/confirm control over a CG-owned Execution
 * Anchor. Renders nothing when `overview` is `null` (the role-gated
 * backend call failed) rather than a broken or misleading section --
 * every other part of the Shot Overview page still renders normally. */
export function DepartmentExecutionOverviewSection({
  shotId,
  overview,
}: {
  shotId: string;
  overview: DepartmentExecutionOverviewRead | null;
}) {
  if (overview === null) {
    return null;
  }

  return (
    <section className={styles.section}>
      <SectionHeader
        title="Department Execution Overview"
        description="Real execution state for this Shot's Tasks, read-only -- inspect and navigate, never confirm or edit a CG-owned Execution Anchor from here."
      />
      {overview.tasks.length === 0 ? (
        <p className={styles.empty}>No Tasks are recorded for this Shot.</p>
      ) : (
        <ul className={styles.list}>
          {overview.tasks.map((task) => (
            <TaskExecutionRow key={task.task_id} shotId={shotId} task={task} />
          ))}
        </ul>
      )}
    </section>
  );
}
