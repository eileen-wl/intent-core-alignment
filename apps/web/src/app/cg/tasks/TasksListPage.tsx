"use client";

import { useMemo, useState } from "react";
import type {
  AnchorContextSummaryRead,
  CgInboxItemRead,
  CgInboxRead,
} from "@intent-core/contracts";

import {
  AppShell,
  Breadcrumbs,
  EmptyState,
  ErrorState,
  PageHeader,
} from "@/design";
import { DEMO_IDENTITY_NAME, ROLE_LABEL } from "@/lib/demoIdentity";
import { ROLE_SIDEBAR_ITEMS } from "@/lib/roleNavigation";
import { executionAnchorStateLabel } from "../cgWording";
import { CgTaskListRow } from "./CgTaskListRow";
import styles from "./TasksListPage.module.css";

const ALL_VALUE = "__all__";
const EXECUTION_ANCHOR_STATES: CgInboxItemRead["execution_anchor_state"][] = [
  "none",
  "draft_pending",
  "confirmed",
];

/** `/cg/tasks` -- Tasks (Step 7C-4), mirroring
 * `app/vfx/shots/ShotsListPage.tsx`'s pattern: browsing and opening
 * Tasks, not reviewing action items -- every real Task appears here.
 * Filters operate only on fields the existing `CgInboxItemRead` already
 * returns (Project, Execution Anchor state, Department, attention
 * state), client-side, over the already-loaded dataset -- no widened
 * backend scope, no backend pagination. `inbox` is `null` only when the
 * real `GET /cg/inbox` call failed, distinct from a real empty
 * portfolio. */
export function TasksListPage({
  inbox,
  anchorContexts = {},
  onExitRole,
}: {
  inbox: CgInboxRead | null;
  anchorContexts?: Record<string, AnchorContextSummaryRead | null>;
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
      <Breadcrumbs items={[{ label: "Tasks" }]} />
      <PageHeader title="Tasks" description="Browse and open any Task." />

      {inbox === null ? (
        <ErrorState
          title="Tasks is unavailable"
          description="The ICAS service could not be reached. Try refreshing the page."
        />
      ) : inbox.items.length === 0 ? (
        <EmptyState
          title="No Tasks exist yet"
          description="Tasks will appear here once they exist."
        />
      ) : (
        <TasksListContent items={inbox.items} anchorContexts={anchorContexts} />
      )}
    </AppShell>
  );
}

function TasksListContent({
  items,
  anchorContexts,
}: {
  items: CgInboxItemRead[];
  anchorContexts: Record<string, AnchorContextSummaryRead | null>;
}) {
  const [projectFilter, setProjectFilter] = useState(ALL_VALUE);
  const [stateFilter, setStateFilter] = useState(ALL_VALUE);
  const [departmentFilter, setDepartmentFilter] = useState(ALL_VALUE);
  const [attentionOnly, setAttentionOnly] = useState(false);

  const projects = useMemo(
    () => Array.from(new Set(items.map((item) => item.project_name))).sort(),
    [items],
  );
  const departments = useMemo(
    () =>
      Array.from(
        new Set(
          items
            .map((item) => item.department)
            .filter((d): d is string => Boolean(d)),
        ),
      ).sort(),
    [items],
  );

  const filtered = items.filter((item) => {
    if (projectFilter !== ALL_VALUE && item.project_name !== projectFilter)
      return false;
    if (
      stateFilter !== ALL_VALUE &&
      item.execution_anchor_state !== stateFilter
    )
      return false;
    if (departmentFilter !== ALL_VALUE && item.department !== departmentFilter)
      return false;
    if (attentionOnly && !item.current_focus.actionable) return false;
    return true;
  });

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

        <label className={styles.filterLabel}>
          <input
            type="checkbox"
            checked={attentionOnly}
            onChange={(event) => setAttentionOnly(event.target.checked)}
          />
          Requiring attention only
        </label>
      </div>

      <p>
        Showing {filtered.length} of {items.length} Tasks
      </p>

      {filtered.length === 0 ? (
        <EmptyState title="No Tasks match these filters" />
      ) : (
        <div role="list">
          {filtered.map((item) => (
            <div role="listitem" key={item.task_id}>
              <CgTaskListRow
                item={item}
                anchorContext={anchorContexts[item.task_id]}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
