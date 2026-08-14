import Link from "next/link";
import type { ShotActivityEventType } from "@intent-core/contracts";

import { EmptyState, ErrorState } from "@/design";
import type { ActivityWorkspaceData } from "@/features/vfx/activity-workspace/data";
import styles from "./ActivityWorkspacePage.module.css";

const EVENT_TYPE_LABEL: Record<ShotActivityEventType, string> = {
  core_anchor_draft_created: "Core Anchor draft created",
  core_anchor_draft_updated: "Core Anchor draft updated",
  core_anchor_confirmed: "Core Anchor confirmed",
  core_anchor_draft_discarded: "Core Anchor draft discarded",
  human_decision_recorded: "Decision recorded",
  production_version_recorded: "Production Version recorded",
  review_note_recorded: "Review Note recorded",
  alignment_assessment_created: "Alignment Assessment generated",
  re_anchor_proposal_generated: "Re-anchor Proposal generated",
  external_link_recorded: "Linked to external source",
};

/** `/vfx/shots/:shotId/activity` (Step 7C-3) -- what has happened to
 * this Shot's intent, review, and alignment over time. Renders
 * `data.activity.events` exactly as delivered (already real,
 * chronologically ordered) -- this page never re-sorts, re-labels
 * beyond the fixed vocabulary above, or invents an entry. */
export function ActivityWorkspacePage({
  data,
}: {
  data: ActivityWorkspaceData | null;
}) {
  if (!data) {
    return (
      <ErrorState
        title="This page is unavailable"
        description="The ICAS service could not be reached. Try refreshing the page."
      />
    );
  }

  return data.activity.events.length === 0 ? (
    <EmptyState title="No recorded activity exists for this Shot yet." />
  ) : (
    <ol className={styles.timeline} aria-label="Shot activity timeline">
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
  );
}
