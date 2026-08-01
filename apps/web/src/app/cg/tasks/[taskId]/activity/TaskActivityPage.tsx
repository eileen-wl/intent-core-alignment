import Link from "next/link";
import type { TaskActivityEventType } from "@intent-core/contracts";

import { AppShell, Breadcrumbs, ContextTabs, EmptyState, ErrorState } from "@/design";
import { DEMO_IDENTITY_NAME, ROLE_LABEL } from "@/lib/demoIdentity";
import { ROLE_SIDEBAR_ITEMS } from "@/lib/roleNavigation";
import type { TaskActivityWorkspaceData } from "@/features/cg/activity-workspace/data";
import { TaskContextHeader } from "../TaskContextHeader";
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
  taskId,
  data,
  unavailable,
  onExitRole,
}: {
  taskId: string;
  data: TaskActivityWorkspaceData | null;
  unavailable: boolean;
  onExitRole: () => void | Promise<void>;
}) {
  return (
    <AppShell
      name={DEMO_IDENTITY_NAME.cg_supervisor}
      role={ROLE_LABEL.cg_supervisor}
      onExitRole={onExitRole}
      sidebarItems={ROLE_SIDEBAR_ITEMS.cg_supervisor}
      currentPath="/cg/tasks"
    >
      {unavailable || data === null ? (
        <>
          <Breadcrumbs items={[{ label: "Tasks", href: "/cg/tasks" }, { label: "Activity" }]} />
          <ErrorState
            title={unavailable ? "This Task is unavailable" : "This Task could not be found"}
            description={
              unavailable
                ? "The ICAS service could not be reached. Try refreshing the page."
                : "This Task does not exist, or its identifier is invalid."
            }
          />
        </>
      ) : (
        <>
          <Breadcrumbs
            items={[
              { label: data.item.project_name, href: "/cg/tasks" },
              { label: data.item.shot_name },
              { label: data.item.task_name },
              { label: "Activity" },
            ]}
          />
          <TaskContextHeader item={data.item} />
          <ContextTabs
            activeTabId="activity"
            tabs={[
              { id: "overview", label: "Overview", href: `/cg/tasks/${taskId}` },
              { id: "execution", label: "Execution", href: `/cg/tasks/${taskId}/execution` },
              {
                id: "version-review",
                label: "Version Review",
                href: `/cg/tasks/${taskId}/version-review`,
              },
              {
                id: "dependencies",
                label: "Dependencies",
                href: `/cg/tasks/${taskId}/dependencies`,
              },
              { id: "activity", label: "Activity", href: `/cg/tasks/${taskId}/activity` },
            ]}
          />

          {data.activity.events.length === 0 ? (
            <EmptyState title="No recorded activity exists for this Task yet." />
          ) : (
            <ol className={styles.timeline} aria-label="Task activity timeline">
              {data.activity.events.map((event) => (
                <li key={event.id} className={styles.event}>
                  <div className={styles.eventMain}>
                    <span className={styles.eventType}>{EVENT_TYPE_LABEL[event.event_type]}</span>
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
    </AppShell>
  );
}
