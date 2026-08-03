import Link from "next/link";
import type {
  AnchorContextRead,
  TaskActivityEventType,
} from "@intent-core/contracts";

import { EmptyState } from "@/design";
import type { TaskActivityWorkspaceData } from "@/features/cg/activity-workspace/data";
import { CgTaskWorkspaceFrame } from "../CgTaskWorkspaceFrame";
import styles from "./TaskActivityPage.module.css";

const EVENT_TYPE_LABEL: Record<TaskActivityEventType, string> = {
  execution_anchor_draft_created: "Execution Anchor draft created",
  execution_anchor_draft_updated: "Execution Anchor draft updated",
  execution_anchor_confirmed: "Execution Anchor confirmed",
  execution_anchor_draft_discarded: "Execution Anchor draft discarded",
  human_decision_recorded: "Decision recorded",
  cg_supervisor_review_generated: "CG Supervisor review generated",
  dependency_recorded: "Dependency recorded",
  dependency_acknowledged: "Dependency acknowledged",
  dependency_resolved: "Dependency resolved",
  escalation_recorded: "Escalation recorded",
  cross_role_assessment_involving_task: "Cross-role Assessment generated",
};

/** `/cg/tasks/:taskId/activity` (Step 7C-4) -- what has happened to
 * this Task's execution, versions, reviews, and dependencies over time.
 * Renders `data.activity.events` exactly as delivered (already real,
 * newest-first) -- mirrors `app/vfx/shots/[shotId]/activity/ActivityWorkspacePage.tsx`'s
 * layout, including the right-aligned "Open ->" action on every row. */
export function TaskActivityPage({
  data,
  anchorContext,
  unavailable,
  onExitRole,
}: {
  taskId: string;
  data: TaskActivityWorkspaceData | null;
  anchorContext?: AnchorContextRead | null;
  unavailable: boolean;
  onExitRole: () => void | Promise<void>;
}) {
  return (
    <CgTaskWorkspaceFrame
      item={data?.item ?? null}
      anchorContext={anchorContext}
      activeTab="activity"
      unavailable={unavailable}
      onExitRole={onExitRole}
    >
      {data && (
        <>
          {data.activity.events.length === 0 ? (
            <EmptyState title="No recorded activity exists for this Task yet." />
          ) : (
            <ol className={styles.timeline} aria-label="Task activity timeline">
              {data.activity.events.map((event) => (
                <li key={event.id} className={styles.event}>
                  <div className={styles.eventMain}>
                    <span className={styles.eventType}>
                      {EVENT_TYPE_LABEL[event.event_type]}
                    </span>
                    <span className={styles.eventTime}>
                      {new Date(event.occurred_at).toLocaleString()}
                    </span>
                  </div>
                  <p className={styles.eventSummary}>{event.summary}</p>
                  <div className={styles.eventFooter}>
                    {(event.actor_human_role || event.actor_kind) && (
                      <span className={styles.eventActor}>
                        {event.actor_human_role ?? event.actor_kind}
                      </span>
                    )}
                    <Link href={event.route} className={styles.eventLink}>
                      Open →
                    </Link>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </CgTaskWorkspaceFrame>
  );
}
