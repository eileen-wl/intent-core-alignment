import Link from "next/link";
import type { ShotActivityEventType } from "@intent-core/contracts";

import { AppShell, Breadcrumbs, ContextTabs, EmptyState, ErrorState } from "@/design";
import { DEMO_IDENTITY_NAME, ROLE_LABEL } from "@/lib/demoIdentity";
import { ROLE_SIDEBAR_ITEMS } from "@/lib/roleNavigation";
import type { ActivityWorkspaceData } from "@/features/vfx/activity-workspace/data";
import { ProductionContextHeader } from "../../ProductionContextHeader";
import styles from "./ActivityWorkspacePage.module.css";

const EVENT_TYPE_LABEL: Record<ShotActivityEventType, string> = {
  core_anchor_draft_created: "Core Anchor draft created",
  core_anchor_draft_updated: "Core Anchor draft updated",
  core_anchor_confirmed: "Core Anchor confirmed",
  core_anchor_draft_discarded: "Core Anchor draft discarded",
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
  shotId,
  data,
  unavailable,
  onExitRole,
}: {
  shotId: string;
  data: ActivityWorkspaceData | null;
  unavailable: boolean;
  onExitRole: () => void | Promise<void>;
}) {
  return (
    <AppShell
      name={DEMO_IDENTITY_NAME.vfx_supervisor}
      role={ROLE_LABEL.vfx_supervisor}
      onExitRole={onExitRole}
      sidebarItems={ROLE_SIDEBAR_ITEMS.vfx_supervisor}
      currentPath="/vfx/shots"
    >
      {unavailable || data === null ? (
        <>
          <Breadcrumbs items={[{ label: "Shots", href: "/vfx/shots" }, { label: "Activity" }]} />
          <ErrorState
            title={unavailable ? "This Shot is unavailable" : "This Shot could not be found"}
            description={
              unavailable
                ? "The ICAS service could not be reached. Try refreshing the page."
                : "This Shot does not exist, or its identifier is invalid."
            }
          />
        </>
      ) : (
        <>
          <Breadcrumbs
            items={[
              { label: data.item.project_name, href: "/vfx/shots" },
              { label: data.item.shot_name },
              { label: "Activity" },
            ]}
          />
          <ProductionContextHeader item={data.item} />
          <ContextTabs
            activeTabId="activity"
            tabs={[
              { id: "overview", label: "Overview", href: `/vfx/shots/${shotId}` },
              { id: "intent", label: "Intent", href: `/vfx/shots/${shotId}/intent` },
              { id: "versions", label: "Versions", href: `/vfx/shots/${shotId}/versions` },
              { id: "alignment", label: "Alignment", href: `/vfx/shots/${shotId}/alignment` },
              { id: "activity", label: "Activity", href: `/vfx/shots/${shotId}/activity` },
            ]}
          />

          {data.activity.events.length === 0 ? (
            <EmptyState title="No recorded activity exists for this Shot yet." />
          ) : (
            <ol className={styles.timeline} aria-label="Shot activity timeline">
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
