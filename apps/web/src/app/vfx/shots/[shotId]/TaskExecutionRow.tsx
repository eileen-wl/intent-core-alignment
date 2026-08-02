import Link from "next/link";
import type { DepartmentExecutionTaskRead } from "@intent-core/contracts";

import { AuthorityLabel, StatusBadge } from "@/design";
import {
  cgTaskFocusLabel,
  executionAnchorStateBadgeStatus,
  executionAnchorStateLabel,
  lastUpdatedSourceLabel,
  latestVersionScopeLabel,
} from "@/lib/departmentExecutionOverview";
import styles from "./TaskExecutionRow.module.css";

function latestVersionText(task: DepartmentExecutionTaskRead): string {
  if (!task.latest_version_name) {
    return "No Production Version recorded.";
  }
  const numbered = task.latest_version_number
    ? `${task.latest_version_name} (v${task.latest_version_number})`
    : task.latest_version_name;
  const sourced =
    task.latest_version_source === "ftrack"
      ? `${numbered} · ftrack-synced`
      : numbered;
  const scopeLabel = latestVersionScopeLabel(task.latest_version_scope);
  return scopeLabel ? `${sourced} — ${scopeLabel}` : sourced;
}

function dependencyText(task: DepartmentExecutionTaskRead): string {
  if (task.open_dependency_count === 0) {
    return "No open dependencies.";
  }
  const count = `${task.open_dependency_count} open ${
    task.open_dependency_count === 1 ? "dependency" : "dependencies"
  }`;
  if (!task.top_open_dependency_description) {
    return `${count}.`;
  }
  const severity = task.top_open_dependency_severity
    ? ` (${task.top_open_dependency_severity} severity)`
    : "";
  return `${count} — highest priority: ${task.top_open_dependency_description}${severity}`;
}

/** `/vfx/shots/:shotId` -- one real Task row within the Department
 * Execution Overview (Step 9B-3). Read-only, navigate-only: no CG
 * confirm/reject/generate/resolve control is ever rendered here. The one
 * action's label is honest about its real, Shot-wide destination
 * ("View Shot Versions") -- it links to the existing Shot-wide Versions
 * page (the closest existing permitted VFX context for a Task's own
 * production evidence; no per-Task VFX route exists, and a direct
 * `/cg/tasks/:taskId` link would be blocked by the role guard), never
 * implying a dedicated Task-detail destination. */
export function TaskExecutionRow({
  shotId,
  task,
}: {
  shotId: string;
  task: DepartmentExecutionTaskRead;
}) {
  return (
    <li className={styles.row}>
      <div className={styles.main}>
        <div className={styles.head}>
          <span className={styles.taskName}>{task.task_name}</span>
          {task.department && (
            <span className={styles.department}>{task.department}</span>
          )}
          <StatusBadge
            status={executionAnchorStateBadgeStatus(
              task.execution_anchor_state,
            )}
            label={executionAnchorStateLabel(
              task.execution_anchor_state,
              task.execution_anchor_revision_number,
            )}
          />
        </div>

        <p className={styles.meta}>
          {latestVersionText(task)} · Last updated{" "}
          {new Date(task.last_updated_at).toLocaleDateString()} (
          {lastUpdatedSourceLabel(task.last_updated_source)})
        </p>

        <p className={styles.meta}>
          <StatusBadge
            status={task.current_focus_actionable ? "attention" : "neutral"}
            label={cgTaskFocusLabel(task.current_focus_type)}
          />
        </p>

        <p className={styles.meta}>{dependencyText(task)}</p>

        <p className={styles.meta}>
          {task.alignment_concern_summary ? (
            <>
              <AuthorityLabel variant="ai-interpretation" />{" "}
              {task.alignment_concern_summary}
              {task.alignment_concern_attention_level
                ? ` (${task.alignment_concern_attention_level} attention)`
                : ""}
            </>
          ) : (
            "No current alignment concern recorded."
          )}
        </p>

        <p className={styles.meta}>
          {task.open_escalation ? (
            <>
              <StatusBadge status="blocking" label="Escalated to VFX" />{" "}
              {task.open_escalation_summary}
            </>
          ) : (
            "No open escalation to VFX."
          )}
        </p>
      </div>

      <div className={styles.actions}>
        <Link
          href={`/vfx/shots/${shotId}/versions`}
          className={styles.viewDetails}
        >
          View Shot Versions →
        </Link>
      </div>
    </li>
  );
}
