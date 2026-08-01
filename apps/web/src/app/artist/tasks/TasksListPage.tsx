"use client";

import { useMemo, useState } from "react";
import type {
  ArtistInboxItemRead,
  ArtistInboxRead,
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
import { guidanceStateLabel } from "../artistWording";
import { ArtistTaskListRow } from "./ArtistTaskListRow";
import styles from "./TasksListPage.module.css";

const ALL_VALUE = "__all__";
const GUIDANCE_STATES: ArtistInboxItemRead["guidance_state"][] = [
  "none",
  "outdated",
  "current",
];

/** `/artist/tasks` -- Tasks (Step 7C-5), mirroring
 * `app/cg/tasks/TasksListPage.tsx`'s pattern: browsing and opening
 * Tasks, not reviewing action items -- every real Task appears here.
 * Filters operate only on fields the existing `ArtistInboxItemRead`
 * already returns (Project, department, attention state, guidance
 * state, latest Version state), client-side, over the already-loaded
 * dataset -- no widened backend scope, no backend pagination. `inbox`
 * is `null` only when the real `GET /artist/inbox` call failed,
 * distinct from a real empty portfolio. */
export function TasksListPage({
  inbox,
  onExitRole,
}: {
  inbox: ArtistInboxRead | null;
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
        <TasksListContent items={inbox.items} />
      )}
    </AppShell>
  );
}

function TasksListContent({ items }: { items: ArtistInboxItemRead[] }) {
  const [projectFilter, setProjectFilter] = useState(ALL_VALUE);
  const [departmentFilter, setDepartmentFilter] = useState(ALL_VALUE);
  const [guidanceFilter, setGuidanceFilter] = useState(ALL_VALUE);
  const [versionFilter, setVersionFilter] = useState(ALL_VALUE);
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
    if (departmentFilter !== ALL_VALUE && item.department !== departmentFilter)
      return false;
    if (guidanceFilter !== ALL_VALUE && item.guidance_state !== guidanceFilter)
      return false;
    if (versionFilter === "has_version" && item.latest_version_id === null)
      return false;
    if (versionFilter === "no_version" && item.latest_version_id !== null)
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
          Guidance state
          <select
            className={styles.filterSelect}
            value={guidanceFilter}
            onChange={(event) => setGuidanceFilter(event.target.value)}
          >
            <option value={ALL_VALUE}>All guidance states</option>
            {GUIDANCE_STATES.map((state) => (
              <option key={state} value={state}>
                {guidanceStateLabel(state)}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.filterLabel}>
          Latest Version
          <select
            className={styles.filterSelect}
            value={versionFilter}
            onChange={(event) => setVersionFilter(event.target.value)}
          >
            <option value={ALL_VALUE}>Any</option>
            <option value="has_version">Has a Version</option>
            <option value="no_version">No Version yet</option>
          </select>
        </label>

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
              <ArtistTaskListRow item={item} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
