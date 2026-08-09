"use client";

import { useMemo, useState } from "react";
import type {
  AnchorContextSummaryRead,
  VfxInboxItemRead,
  VfxInboxRead,
} from "@intent-core/contracts";
import Link from "next/link";

import {
  AppShell,
  Breadcrumbs,
  EmptyState,
  ErrorState,
  PageHeader,
} from "@/design";
import { DEMO_IDENTITY_NAME, ROLE_LABEL } from "@/lib/demoIdentity";
import { ROLE_SIDEBAR_ITEMS } from "@/lib/roleNavigation";
import {
  adaptCurrentFocusToWorkItems,
  adaptEscalationWorkItems,
  adaptVersionReviewWorkItems,
  type ReviewWorkItem,
} from "@/features/vfx/review-inbox/workItem";
import { groupByCategory } from "@/lib/workItemGrouping";
import { coreAnchorStateLabel } from "../vfxWording";
import { WorkItemRow } from "../WorkItemRow";
import styles from "./ReviewInboxPage.module.css";

const ALL_VALUE = "__all__";
/** Same fixed enum, same order as `ShotsListPage.tsx`'s
 * `CORE_ANCHOR_STATES` -- every possible state is always offered, not
 * only the ones present in today's Inbox, matching that page's own
 * filter semantics. */
const CORE_ANCHOR_STATES: VfxInboxItemRead["core_anchor_state"][] = [
  "none",
  "draft_pending",
  "confirmed",
];

/** `/vfx/inbox` -- Review Inbox (Step 7C-1 content-architecture
 * correction). Work-item-first: the primary information object is the
 * required work item, not the Shot. Consumes the shared
 * `ReviewWorkItem` collection (`features/vfx/review-inbox/workItem.ts`)
 * -- the same model Workspace Home's Priority actions section uses --
 * rather than rendering raw Shot inbox rows. Today's only real source is
 * every actionable `current_focus`; Step 7C-3 adds further adapters
 * (Version/Review Note, Assessment, Proposal, conflict, escalation,
 * acknowledgement) that concatenate into the same flat collection this
 * page already renders, so this page does not need to change shape when
 * that lands. Never a structural parent of a Shot -- opening an item
 * goes straight to that Shot's own Overview or Intent page, and this
 * page never appears in a Shot's breadcrumb. `inbox` is `null` only when
 * the real `GET /vfx/inbox` call failed, distinct from a real empty
 * Inbox. */
export function ReviewInboxPage({
  inbox,
  anchorContexts = {},
  onExitRole,
}: {
  inbox: VfxInboxRead | null;
  anchorContexts?: Record<string, AnchorContextSummaryRead | null>;
  onExitRole: () => void | Promise<void>;
}) {
  const workItems = inbox
    ? [
        ...adaptCurrentFocusToWorkItems(inbox.items),
        ...adaptVersionReviewWorkItems(inbox.items),
        ...adaptEscalationWorkItems(inbox.items),
      ]
    : null;

  return (
    <AppShell
      name={DEMO_IDENTITY_NAME.vfx_supervisor}
      role={ROLE_LABEL.vfx_supervisor}
      onExitRole={onExitRole}
      sidebarItems={ROLE_SIDEBAR_ITEMS.vfx_supervisor}
      currentPath="/vfx/inbox"
    >
      <Breadcrumbs items={[{ label: "Review Inbox" }]} />
      <PageHeader
        title="Review Inbox"
        description="Work that requires your review, interpretation, confirmation, rejection, acknowledgement, or escalation."
      />

      {inbox === null || workItems === null ? (
        <ErrorState
          title="Review Inbox is unavailable"
          description="The ICAS service could not be reached. Try refreshing the page."
        />
      ) : workItems.length === 0 ? (
        <EmptyState
          title="Review Inbox is clear"
          description="No review or interpretation currently requires your attention."
          action={<Link href="/vfx/shots">Browse Shots →</Link>}
        />
      ) : (
        <ReviewInboxContent
          workItems={workItems}
          anchorContexts={anchorContexts}
        />
      )}
    </AppShell>
  );
}

/** Chunks the flat work-item collection by each item's own honest
 * `category` (never a new classification), and adds a Project filter
 * matching the pattern already established on `ShotsListPage.tsx`.
 * Group order follows each group's highest-priority item, so the
 * overall priority ordering is unchanged -- only same-category items
 * now read together instead of interleaved. */
function ReviewInboxContent({
  workItems,
  anchorContexts,
}: {
  workItems: ReviewWorkItem[];
  anchorContexts: Record<string, AnchorContextSummaryRead | null>;
}) {
  const [projectFilter, setProjectFilter] = useState(ALL_VALUE);
  const [coreAnchorStateFilter, setCoreAnchorStateFilter] = useState(ALL_VALUE);

  const projects = useMemo(
    () =>
      Array.from(
        new Set(
          workItems
            .map((item) => item.project?.name)
            .filter((name): name is string => Boolean(name)),
        ),
      ).sort(),
    [workItems],
  );

  const filtered = useMemo(
    () =>
      workItems.filter((item) => {
        if (projectFilter !== ALL_VALUE && item.project?.name !== projectFilter)
          return false;
        if (
          coreAnchorStateFilter !== ALL_VALUE &&
          item.coreAnchorState !== coreAnchorStateFilter
        )
          return false;
        return true;
      }),
    [workItems, projectFilter, coreAnchorStateFilter],
  );

  const groups = useMemo(() => groupByCategory(filtered), [filtered]);

  return (
    <div>
      <div className={styles.filters}>
        <label className={styles.filterLabel}>
          Project
          <select
            className={styles.filterSelect}
            value={projectFilter}
            onChange={(event) => setProjectFilter(event.target.value)}
          >
            <option value={ALL_VALUE}>All Projects</option>
            {projects.map((project) => (
              <option key={project} value={project}>
                {project}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.filterLabel}>
          Core Anchor state
          <select
            className={styles.filterSelect}
            value={coreAnchorStateFilter}
            onChange={(event) => setCoreAnchorStateFilter(event.target.value)}
          >
            <option value={ALL_VALUE}>All states</option>
            {CORE_ANCHOR_STATES.map((state) => (
              <option key={state} value={state}>
                {coreAnchorStateLabel(state)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p>Showing {filtered.length} items requiring review</p>

      {filtered.length === 0 ? (
        <EmptyState title="No items match this filter" />
      ) : (
        groups.map((group) => (
          <section
            key={group.category || group.items[0].id}
            className={styles.group}
          >
            <h2 className={styles.groupHeading}>
              {group.category} — {group.items.length}{" "}
              {group.items.length === 1 ? "item" : "items"}
            </h2>
            <div role="list">
              {group.items.map((item) => (
                <div role="listitem" key={item.id}>
                  <WorkItemRow
                    item={item}
                    anchorContext={
                      item.shot ? anchorContexts[item.shot.id] : null
                    }
                  />
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
