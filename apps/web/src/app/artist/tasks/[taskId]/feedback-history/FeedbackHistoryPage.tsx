import Link from "next/link";
import type { ArtistFeedbackEventType } from "@intent-core/contracts";

import {
  AppShell,
  AuthorityLabel,
  type AuthorityLabelVariant,
  Breadcrumbs,
  ContextTabs,
  EmptyState,
  ErrorState,
  type EvidenceLayerKind,
} from "@/design";
import { DEMO_IDENTITY_NAME, ROLE_LABEL } from "@/lib/demoIdentity";
import { feedbackEventLayer } from "@/lib/feedbackEventLayer";
import { humanRoleLabel } from "@/lib/humanRoleLabel";
import { ROLE_SIDEBAR_ITEMS } from "@/lib/roleNavigation";
import type { FeedbackHistoryData } from "@/features/artist/feedback-history/data";
import { TaskContextHeader } from "../TaskContextHeader";
import styles from "./FeedbackHistoryPage.module.css";

/** Step 9B-2: reuses the exact Step 9B-1 `AuthorityLabel` vocabulary --
 * never a second labelling system -- to make each timeline event's
 * Production Evidence / Agent Interpretation / Human Decision layer
 * visible without restructuring the chronological list itself. */
const LAYER_AUTHORITY_VARIANT: Record<
  EvidenceLayerKind,
  AuthorityLabelVariant
> = {
  "production-evidence": "production-fact",
  "agent-interpretation": "ai-interpretation",
  "human-decision": "human-confirmed",
};

const EVENT_TYPE_LABEL: Record<ArtistFeedbackEventType, string> = {
  version_recorded: "Production Version recorded",
  review_note_recorded: "Review Note recorded",
  artist_guidance_generated: "Artist guidance generated",
  cg_supervisor_review_generated: "CG Supervisor review generated",
  cross_role_assessment_involving_task: "Cross-role Assessment generated",
  dependency_recorded: "Dependency recorded",
  dependency_acknowledged: "Dependency acknowledged",
  dependency_resolved: "Dependency resolved",
  escalation_recorded: "Escalation recorded",
  execution_anchor_confirmed: "Execution Anchor confirmed",
  execution_anchor_draft_discarded: "Execution Anchor draft discarded",
};

/** `/artist/tasks/:taskId/feedback-history` (Step 7C-5) -- what
 * feedback this Task has received, why it was given, and what changed
 * after it. Newest-first, mirrors
 * `app/cg/tasks/[taskId]/activity/TaskActivityPage.tsx`'s timeline
 * layout, but this is its own separate Artist-facing capability, not
 * the CG Activity tab reused -- there is deliberately no separate
 * Activity tab in the Artist workspace. Renders `data.history.events`
 * exactly as delivered (already real, newest-first). */
export function FeedbackHistoryPage({
  taskId,
  data,
  unavailable,
  onExitRole,
}: {
  taskId: string;
  data: FeedbackHistoryData | null;
  unavailable: boolean;
  onExitRole: () => void | Promise<void>;
}) {
  return (
    <AppShell
      name={DEMO_IDENTITY_NAME.artist}
      role={ROLE_LABEL.artist}
      onExitRole={onExitRole}
      sidebarItems={ROLE_SIDEBAR_ITEMS.artist}
      currentPath="/artist/tasks"
    >
      {unavailable || data === null ? (
        <>
          <Breadcrumbs
            items={[
              { label: "Tasks", href: "/artist/tasks" },
              { label: "Feedback History" },
            ]}
          />
          <ErrorState
            title={
              unavailable
                ? "This Task is unavailable"
                : "This Task could not be found"
            }
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
              { label: data.item.project_name, href: "/artist/tasks" },
              { label: data.item.shot_name },
              { label: data.item.task_name },
              { label: "Feedback History" },
            ]}
          />
          <TaskContextHeader item={data.item} />
          <ContextTabs
            activeTabId="feedback-history"
            tabs={[
              {
                id: "overview",
                label: "Task Overview",
                href: `/artist/tasks/${taskId}`,
              },
              {
                id: "current-version",
                label: "Current Version",
                href: `/artist/tasks/${taskId}/current-version`,
              },
              {
                id: "feedback-history",
                label: "Feedback History",
                href: `/artist/tasks/${taskId}/feedback-history`,
              },
            ]}
          />

          {data.history.events.length === 0 ? (
            <EmptyState title="No feedback has been recorded for this Task yet." />
          ) : (
            <ol className={styles.timeline} aria-label="Task feedback history">
              {data.history.events.map((event) => (
                <li key={event.id} className={styles.event}>
                  <div className={styles.eventMain}>
                    <span className={styles.eventType}>
                      {EVENT_TYPE_LABEL[event.event_type]}
                    </span>
                    <span className={styles.eventTime}>
                      {new Date(event.occurred_at).toLocaleString()}
                    </span>
                  </div>
                  <AuthorityLabel
                    variant={
                      LAYER_AUTHORITY_VARIANT[
                        feedbackEventLayer(event.event_type)
                      ]
                    }
                  />
                  <p className={styles.eventSummary}>{event.summary}</p>
                  <div className={styles.eventFooter}>
                    {(event.actor_human_role || event.actor_kind) && (
                      <span className={styles.eventActor}>
                        {event.actor_human_role
                          ? humanRoleLabel(event.actor_human_role)
                          : event.actor_kind}
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
