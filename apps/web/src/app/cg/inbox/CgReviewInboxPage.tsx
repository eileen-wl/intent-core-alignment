"use client";

import { useMemo, useState } from "react";
import type {
  AnchorContextSummaryRead,
  CgInboxItemRead,
  CgInboxRead,
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
  adaptCgCurrentFocusToWorkItems,
  type CgReviewWorkItem,
} from "@/features/cg/reviewInbox";
import { groupByCategory } from "@/lib/workItemGrouping";
import { executionAnchorStateLabel } from "../cgWording";
import { CgTaskWorkItemRow } from "../CgTaskWorkItemRow";
import styles from "./CgReviewInboxPage.module.css";

const ALL_VALUE = "__all__";
/** Same fixed enum, same order as `TasksListPage.tsx`'s
 * `EXECUTION_ANCHOR_STATES` -- every possible state is always offered,
 * matching that page's own filter semantics. */
const EXECUTION_ANCHOR_STATES: CgInboxItemRead["execution_anchor_state"][] = [
  "none",
  "draft_pending",
  "confirmed",
];

/** `/cg/inbox` -- CG Review Inbox (Step 7C-4), mirroring
 * `app/vfx/inbox/ReviewInboxPage.tsx`'s work-item-first architecture:
 * the primary information object is the required work item, not the
 * Task. Today's only real source is every actionable `current_focus`
 * (`features/cg/reviewInbox.ts`). Never a structural parent of a Task
 * -- opening an item goes straight to the real destination tab
 * (Execution / Version Review / Dependencies), and this page never
 * appears in a Task's breadcrumb. */
export function CgReviewInboxPage({
  inbox,
  anchorContexts = {},
  onExitRole,
}: {
  inbox: CgInboxRead | null;
  anchorContexts?: Record<string, AnchorContextSummaryRead | null>;
  onExitRole: () => void | Promise<void>;
}) {
  const workItems = inbox ? adaptCgCurrentFocusToWorkItems(inbox.items) : null;

  return (
    <AppShell
      name={DEMO_IDENTITY_NAME.cg_supervisor}
      role={ROLE_LABEL.cg_supervisor}
      onExitRole={onExitRole}
      sidebarItems={ROLE_SIDEBAR_ITEMS.cg_supervisor}
      currentPath="/cg/inbox"
    >
      <Breadcrumbs items={[{ label: "Review Inbox" }]} />
      <PageHeader
        title="Review Inbox"
        description="Work that requires your review, confirmation, or interpretation."
      />

      {inbox === null || workItems === null ? (
        <ErrorState
          title="Review Inbox is unavailable"
          description="The ICAS service could not be reached. Try refreshing the page."
        />
      ) : workItems.length === 0 ? (
        <EmptyState
          title="Review Inbox is clear"
          description="No review or confirmation currently requires your attention."
          action={<Link href="/cg/tasks">Browse Tasks →</Link>}
        />
      ) : (
        <CgReviewInboxContent
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
function CgReviewInboxContent({
  workItems,
  anchorContexts,
}: {
  workItems: CgReviewWorkItem[];
  anchorContexts: Record<string, AnchorContextSummaryRead | null>;
}) {
  const [projectFilter, setProjectFilter] = useState(ALL_VALUE);
  const [stateFilter, setStateFilter] = useState(ALL_VALUE);
  const [departmentFilter, setDepartmentFilter] = useState(ALL_VALUE);

  const projects = useMemo(
    () =>
      Array.from(new Set(workItems.map((item) => item.project.name))).sort(),
    [workItems],
  );
  const departments = useMemo(
    () =>
      Array.from(
        new Set(
          workItems
            .map((item) => item.task.department)
            .filter((d): d is string => Boolean(d)),
        ),
      ).sort(),
    [workItems],
  );

  const filtered = useMemo(
    () =>
      workItems.filter((item) => {
        if (projectFilter !== ALL_VALUE && item.project.name !== projectFilter)
          return false;
        if (
          stateFilter !== ALL_VALUE &&
          item.executionAnchorState !== stateFilter
        )
          return false;
        if (
          departmentFilter !== ALL_VALUE &&
          item.task.department !== departmentFilter
        )
          return false;
        return true;
      }),
    [workItems, projectFilter, stateFilter, departmentFilter],
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
          Execution Anchor state
          <select
            className={styles.filterSelect}
            value={stateFilter}
            onChange={(event) => setStateFilter(event.target.value)}
          >
            <option value={ALL_VALUE}>All states</option>
            {EXECUTION_ANCHOR_STATES.map((state) => (
              <option key={state} value={state}>
                {executionAnchorStateLabel(state)}
              </option>
            ))}
          </select>
        </label>

        {departments.length > 0 && (
          <label className={styles.filterLabel}>
            Department
            <select
              className={styles.filterSelect}
              value={departmentFilter}
              onChange={(event) => setDepartmentFilter(event.target.value)}
            >
              <option value={ALL_VALUE}>All Departments</option>
              {departments.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
          </label>
        )}
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
                  <CgTaskWorkItemRow
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
