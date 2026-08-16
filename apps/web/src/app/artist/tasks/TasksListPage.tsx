"use client";

import { useMemo, useState } from "react";
import type {
  ArtistInboxItemRead,
  ArtistInboxRead,
} from "@intent-core/contracts";

import { Breadcrumbs, EmptyState, ErrorState, PageHeader } from "@/design";
import { guidanceStateLabel } from "../artistWording";
import { ArtistTaskListRow } from "./ArtistTaskListRow";
import styles from "./TasksListPage.module.css";

const ALL_VALUE = "__all__";
const UNASSIGNED_SHOT_LABEL = "Unassigned Shot";
const GUIDANCE_STATES: ArtistInboxItemRead["guidance_state"][] = [
  "none",
  "outdated",
  "current",
];

type ShotGroup = {
  shotId: string;
  shotName: string;
  projectName: string;
  items: ArtistInboxItemRead[];
};

/** Groups already-filtered Tasks by their real parent Shot (a Task's
 * `shot_id`/`shot_name` are non-nullable per `ArtistInboxItemRead` --
 * every real Task always has a real Shot, so the `UNASSIGNED_SHOT_LABEL`
 * fallback below only guards the impossible-in-practice empty-string
 * case, never invented context). Grouped by the real `shot_id`, not the
 * display name, so two different Shots that happen to share a display
 * name are never merged. Ordered alphabetically by Shot name for
 * predictable, comparison-friendly browsing. */
function groupByShot(items: ArtistInboxItemRead[]): ShotGroup[] {
  const groups = new Map<string, ShotGroup>();
  const order: string[] = [];

  for (const item of items) {
    const key = item.shot_id || UNASSIGNED_SHOT_LABEL;
    const existing = groups.get(key);
    if (existing) {
      existing.items.push(item);
    } else {
      groups.set(key, {
        shotId: key,
        shotName: item.shot_name || UNASSIGNED_SHOT_LABEL,
        projectName: item.project_name,
        items: [item],
      });
      order.push(key);
    }
  }
  order.sort((a, b) => {
    const groupA = groups.get(a);
    const groupB = groups.get(b);
    return (groupA?.shotName ?? "").localeCompare(groupB?.shotName ?? "");
  });

  return order.flatMap((key) => {
    const group = groups.get(key);
    return group ? [group] : [];
  });
}

/** `/artist/tasks` -- Tasks (Object Browser / Catalogue Archetype,
 * `ICAS_DESIGN.md` §6.3). A personal production-object catalogue:
 * recognize, compare, and open assigned Tasks, never a second Review
 * Inbox or a second Workspace Home -- every real Task appears here.
 * Filters describe real Task properties only (Project, department,
 * Guidance state, latest Version presence), client-side, over the
 * already-loaded dataset -- no widened backend scope, no backend
 * pagination. The former "Requiring attention only" filter
 * (`current_focus.actionable`) was removed: it is action-queue logic,
 * not an object-discovery property, and Review Inbox already owns that
 * job -- no evidence in this codebase shows it served an independent
 * browse use here. `inbox` is `null` only when the real
 * `GET /artist/inbox` call failed, distinct from a real empty
 * portfolio. */
export function TasksListPage({ inbox }: { inbox: ArtistInboxRead | null }) {
  return (
    <>
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
    </>
  );
}

function TasksListContent({ items }: { items: ArtistInboxItemRead[] }) {
  const [projectFilter, setProjectFilter] = useState(ALL_VALUE);
  const [departmentFilter, setDepartmentFilter] = useState(ALL_VALUE);
  const [guidanceFilter, setGuidanceFilter] = useState(ALL_VALUE);
  const [versionFilter, setVersionFilter] = useState(ALL_VALUE);

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
    return true;
  });

  const grouped = groupByShot(filtered);

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
      </div>

      <p>
        Showing {filtered.length} of {items.length} Tasks
      </p>

      {filtered.length === 0 ? (
        <EmptyState title="No Tasks match these filters" />
      ) : (
        <div>
          {grouped.map(
            ({ shotId, shotName, projectName, items: shotItems }) => (
              <section
                key={shotId}
                className={styles.shotGroup}
                aria-label={shotName}
              >
                <div className={styles.shotHeading}>
                  <h3 className={styles.shotName}>{shotName}</h3>
                  <span className={styles.shotProject}>{projectName}</span>
                  <span className={styles.shotCount}>
                    {shotItems.length}{" "}
                    {shotItems.length === 1 ? "Task" : "Tasks"}
                  </span>
                </div>
                <div role="list" className={styles.taskList}>
                  {shotItems.map((item) => (
                    <div role="listitem" key={item.task_id}>
                      <ArtistTaskListRow item={item} />
                    </div>
                  ))}
                </div>
              </section>
            ),
          )}
        </div>
      )}
    </div>
  );
}
