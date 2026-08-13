import Link from "next/link";
import type {
  DepartmentExecutionOverviewRead,
  DepartmentExecutionTaskRead,
} from "@intent-core/contracts";

import {
  Icon,
  MetadataRow,
  StatusBadge,
  type StatusBadgeStatus,
  stripGeneratorLabel,
} from "@/design";
import {
  executionAnchorStateBadgeStatus,
  executionAnchorStateLabel,
} from "@/lib/departmentExecutionOverview";
import styles from "./DepartmentExecutionStrip.module.css";

const NO_DEPARTMENT_LABEL = "No department recorded";

interface DepartmentGroup {
  department: string | null;
  tasks: DepartmentExecutionTaskRead[];
}

/** Groups the Shot's real Tasks by their own `department` field --
 * never a fixed Animation/Lighting/Compositing assumption. The current
 * Golden Journey seeds exactly one Task per department, but the domain
 * model does not guarantee that (`Task.department` is a free string,
 * matched by `Task.id` -- see `department_execution_overview/service.py`'s
 * own doc comment). A department with more than one Task lists each
 * Task individually rather than inventing a combined state/risk; no
 * aggregation policy exists in the backend to reuse. */
function groupByDepartment(
  tasks: DepartmentExecutionTaskRead[],
): DepartmentGroup[] {
  const byDepartment = new Map<string | null, DepartmentExecutionTaskRead[]>();
  for (const task of tasks) {
    const existing = byDepartment.get(task.department);
    if (existing) {
      existing.push(task);
    } else {
      byDepartment.set(task.department, [task]);
    }
  }
  return Array.from(byDepartment.entries()).map(([department, groupTasks]) => ({
    department,
    tasks: groupTasks,
  }));
}

function versionText(task: DepartmentExecutionTaskRead): string {
  if (!task.latest_version_name) return "No Version recorded yet";
  return task.latest_version_number
    ? `${task.latest_version_name} (v${task.latest_version_number})`
    : task.latest_version_name;
}

const RISK_BADGE_STATUS: Record<
  NonNullable<DepartmentExecutionTaskRead["alignment_concern_attention_level"]>,
  StatusBadgeStatus
> = {
  high: "blocking",
  medium: "attention",
  low: "neutral",
};

const RISK_LABEL: Record<
  NonNullable<DepartmentExecutionTaskRead["alignment_concern_attention_level"]>,
  string
> = {
  high: "High risk",
  medium: "Medium risk",
  low: "Low risk",
};

/** `/vfx/shots/:shotId/alignment` -- Department Execution Strip (brief
 * §5.4): one compact line per real Task, never a large card, never a
 * fabricated Animation/Lighting/Compositing slot. Sourced from the same
 * real, role-gated `DepartmentExecutionOverviewRead` `ShotOverviewPage`
 * already uses -- no new data, no new domain logic. Renders nothing
 * when `overview` is `null` (the role-gated backend call failed),
 * matching `DepartmentExecutionOverviewSection`'s own precedent -- the
 * rest of the Alignment page still renders normally. */
export function DepartmentExecutionStrip({
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
    <section className={styles.strip} aria-label="Department Execution">
      <h2 className={styles.heading}>
        <Icon name="coordination" size="region" />
        Department Execution
      </h2>
      {overview.tasks.length === 0 ? (
        <p className={styles.empty}>No Tasks are recorded for this Shot.</p>
      ) : (
        <ul className={styles.list}>
          {groupByDepartment(overview.tasks).flatMap((group) => {
            const departmentLabel = group.department ?? NO_DEPARTMENT_LABEL;
            return group.tasks.length === 1
              ? [
                  <DepartmentRow
                    key={group.tasks[0].task_id}
                    shotId={shotId}
                    label={departmentLabel}
                    task={group.tasks[0]}
                  />,
                ]
              : group.tasks.map((task) => (
                  <DepartmentRow
                    key={task.task_id}
                    shotId={shotId}
                    label={`${departmentLabel} — ${task.task_name}`}
                    task={task}
                  />
                ));
          })}
        </ul>
      )}
    </section>
  );
}

/** Owner-approved drill-down (VFX Alignment interaction refinement):
 * the compact row stays the default state; a native `<details>`
 * discloses a small amount of already-loaded real context answering
 * "why is this department relevant to the current alignment picture"
 * -- never a second Task detail page, never new data. The interactive
 * Version link lives in the disclosed detail, not inside `<summary>`,
 * so it never nests one interactive control inside another. */
function DepartmentRow({
  shotId,
  label,
  task,
}: {
  shotId: string;
  label: string;
  task: DepartmentExecutionTaskRead;
}) {
  const risk = task.alignment_concern_attention_level;

  return (
    <li>
      <details className={styles.rowDisclosure}>
        <summary className={styles.rowSummary}>
          <span className={styles.rowSummaryContent}>
            <span className={styles.department}>{label}</span>
            <StatusBadge
              status={executionAnchorStateBadgeStatus(
                task.execution_anchor_state,
              )}
              label={executionAnchorStateLabel(
                task.execution_anchor_state,
                task.execution_anchor_revision_number,
              )}
            />
            <span className={styles.version}>{versionText(task)}</span>
            {risk && (
              <StatusBadge
                status={RISK_BADGE_STATUS[risk]}
                label={RISK_LABEL[risk]}
              />
            )}
          </span>
          <span className={styles.rowChevron} aria-hidden="true" />
        </summary>
        <div className={styles.rowDetail}>
          {/* Execution Anchor state and current Version are already
           * clearly visible in the summary row above (the StatusBadge
           * and .version text) -- only Task identity is genuinely new
           * information here, so it's the only metadata repeated. */}
          <MetadataRow items={[{ label: "Task", value: task.task_name }]} />
          {(task.alignment_concern_summary ||
            task.execution_anchor_summary) && (
            <div className={styles.rowDetailGrid}>
              {task.alignment_concern_summary && (
                <div className={styles.rowDetailColumn}>
                  <h4 className={styles.rowDetailColumnTitle}>
                    Alignment concern
                  </h4>
                  <p className={styles.rowConcern}>
                    {stripGeneratorLabel(task.alignment_concern_summary)}
                  </p>
                </div>
              )}
              {task.execution_anchor_summary && (
                <div className={styles.rowDetailColumn}>
                  <h4 className={styles.rowDetailColumnTitle}>
                    Execution context
                  </h4>
                  <p className={styles.rowExecutionSummary}>
                    {stripGeneratorLabel(task.execution_anchor_summary)}
                  </p>
                </div>
              )}
            </div>
          )}
          {task.latest_version_id && (
            <Link
              href={`/vfx/shots/${shotId}/versions`}
              className={styles.rowVersionLink}
            >
              View in Versions →
            </Link>
          )}
        </div>
      </details>
    </li>
  );
}
