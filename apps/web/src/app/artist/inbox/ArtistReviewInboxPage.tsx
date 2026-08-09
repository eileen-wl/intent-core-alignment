"use client";

import { useMemo, useState } from "react";
import type {
  AnchorContextSummaryRead,
  ArtistInboxRead,
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
  adaptArtistCurrentFocusToWorkItems,
  type ArtistReviewWorkItem,
} from "@/features/artist/reviewInbox";
import { groupByCategory } from "@/lib/workItemGrouping";
import { ArtistTaskWorkItemRow } from "../ArtistTaskWorkItemRow";
import styles from "./ArtistReviewInboxPage.module.css";

const ALL_VALUE = "__all__";

/** `/artist/inbox` -- Artist Review Inbox (Step 7C-5), mirroring
 * `app/cg/inbox/CgReviewInboxPage.tsx`'s work-item-first architecture:
 * the primary information object is the required work item, not the
 * Task. Today's only real source is every actionable `current_focus`
 * (`features/artist/reviewInbox.ts`). Never a structural parent of a
 * Task -- opening an item goes straight to the real destination tab
 * (Task Overview / Current Version), and this page never appears in a
 * Task's breadcrumb. */
export function ArtistReviewInboxPage({
  inbox,
  anchorContexts = {},
  onExitRole,
}: {
  inbox: ArtistInboxRead | null;
  anchorContexts?: Record<string, AnchorContextSummaryRead | null>;
  onExitRole: () => void | Promise<void>;
}) {
  const workItems = inbox
    ? adaptArtistCurrentFocusToWorkItems(inbox.items)
    : null;

  return (
    <AppShell
      name={DEMO_IDENTITY_NAME.artist}
      role={ROLE_LABEL.artist}
      onExitRole={onExitRole}
      sidebarItems={ROLE_SIDEBAR_ITEMS.artist}
      currentPath="/artist/inbox"
    >
      <Breadcrumbs items={[{ label: "Review Inbox" }]} />
      <PageHeader
        title="Review Inbox"
        description="Work that requires your review, response, or acknowledgement."
      />

      {inbox === null || workItems === null ? (
        <ErrorState
          title="Review Inbox is unavailable"
          description="The ICAS service could not be reached. Try refreshing the page."
        />
      ) : workItems.length === 0 ? (
        <EmptyState
          title="Review Inbox is clear"
          description="Nothing currently requires your response."
          action={<Link href="/artist/tasks">Browse Tasks →</Link>}
        />
      ) : (
        <ArtistReviewInboxContent
          workItems={workItems}
          anchorContexts={anchorContexts}
        />
      )}
    </AppShell>
  );
}

/** Chunks the flat work-item collection by each item's own honest
 * `category` (never a new classification), and adds a Project filter
 * matching the pattern already established on `TasksListPage.tsx`.
 * Group order follows each group's highest-priority item, so the
 * overall priority ordering is unchanged -- only same-category items
 * now read together instead of interleaved. */
function ArtistReviewInboxContent({
  workItems,
  anchorContexts,
}: {
  workItems: ArtistReviewWorkItem[];
  anchorContexts: Record<string, AnchorContextSummaryRead | null>;
}) {
  const [projectFilter, setProjectFilter] = useState(ALL_VALUE);

  const projects = useMemo(
    () =>
      Array.from(new Set(workItems.map((item) => item.project.name))).sort(),
    [workItems],
  );

  const filtered = useMemo(
    () =>
      projectFilter === ALL_VALUE
        ? workItems
        : workItems.filter((item) => item.project.name === projectFilter),
    [workItems, projectFilter],
  );

  const groups = useMemo(() => groupByCategory(filtered), [filtered]);

  return (
    <div>
      {projects.length > 1 && (
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
        </div>
      )}

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
                  <ArtistTaskWorkItemRow
                    item={item}
                    anchorContext={anchorContexts[item.task.id]}
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
