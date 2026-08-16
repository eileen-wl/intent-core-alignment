"use client";

import { useMemo, useState } from "react";
import type { CgInboxItemRead, CgInboxRead } from "@intent-core/contracts";

import { Breadcrumbs, EmptyState, ErrorState, PageHeader } from "@/design";
import { executionAnchorStateLabel } from "../cgWording";
import { CgTaskListRow } from "./CgTaskListRow";
import styles from "./TasksListPage.module.css";

const ALL_VALUE = "__all__";
const NO_DEPARTMENT_LABEL = "No department recorded";
const EXECUTION_ANCHOR_STATES: CgInboxItemRead["execution_anchor_state"][] = [
  "none",
  "draft_pending",
  "confirmed",
];

/** Groups already-filtered Tasks into department sections (the real
 * execution-domain axis this catalogue is organized around). Grouped
 * by a trim+lowercase key so the same department typed with different
 * casing or stray whitespace (e.g. "Animation" / "animation ") never
 * produces two sections for one real department -- `department` is
 * documented free text (`production_context/models.py`), not an enum,
 * so this is real-world data hygiene, not an assumption. Distinct
 * words are never merged without evidence: the seeded department
 * vocabulary uses "comp", not "compositing" (`demo_seed/d1_journey.py`),
 * so a genuinely different word still gets its own section. Each
 * section's displayed label is the first real, unedited department
 * string seen for that key -- never re-cased or invented. Tasks with
 * no recorded department form one honest trailing group. */
function groupByDepartment(
  items: CgInboxItemRead[],
): { department: string; items: CgInboxItemRead[] }[] {
  const groups = new Map<string, { label: string; items: CgInboxItemRead[] }>();
  const order: string[] = [];
  const noDepartment: CgInboxItemRead[] = [];

  for (const item of items) {
    if (!item.department) {
      noDepartment.push(item);
      continue;
    }
    const key = item.department.trim().toLowerCase();
    const existing = groups.get(key);
    if (existing) {
      existing.items.push(item);
    } else {
      groups.set(key, { label: item.department, items: [item] });
      order.push(key);
    }
  }
  order.sort();

  const sections = order.map((key) => {
    const group = groups.get(key);
    if (!group)
      throw new Error(`Unreachable: missing department group for ${key}`);
    return { department: group.label, items: group.items };
  });
  if (noDepartment.length > 0) {
    sections.push({ department: NO_DEPARTMENT_LABEL, items: noDepartment });
  }
  return sections;
}

/** `/cg/tasks` -- Tasks (Object Browser / Catalogue Archetype,
 * `ICAS_DESIGN.md` §6.3). A production-object catalogue: recognize,
 * compare, and open Tasks, never a second Review Inbox or a second
 * Workspace Home -- every real Task appears here. Filters describe
 * real Task properties only (Project, Execution Anchor state,
 * Department), client-side, over the already-loaded dataset -- no
 * widened backend scope, no backend pagination. The former
 * "Requiring attention only" filter (`current_focus.actionable`) was
 * removed: it is action-queue logic, not an object-discovery property,
 * and Review Inbox already owns that job -- no evidence in this
 * codebase shows it served an independent browse use here. `inbox` is
 * `null` only when the real `GET /cg/inbox` call failed, distinct from
 * a real empty portfolio. */
export function TasksListPage({ inbox }: { inbox: CgInboxRead | null }) {
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

function TasksListContent({ items }: { items: CgInboxItemRead[] }) {
  const [projectFilter, setProjectFilter] = useState(ALL_VALUE);
  const [stateFilter, setStateFilter] = useState(ALL_VALUE);
  const [departmentFilter, setDepartmentFilter] = useState(ALL_VALUE);

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
    return true;
  });

  const grouped = groupByDepartment(filtered);

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

      <p>
        Showing {filtered.length} of {items.length} Tasks
      </p>

      {filtered.length === 0 ? (
        <EmptyState title="No Tasks match these filters" />
      ) : (
        <div>
          {grouped.map(({ department, items: departmentItems }) => (
            <section
              key={department}
              className={styles.departmentGroup}
              aria-label={department}
            >
              <div className={styles.departmentHeader}>
                <h3 className={styles.departmentName}>{department}</h3>
                <span className={styles.departmentCount}>
                  {departmentItems.length}{" "}
                  {departmentItems.length === 1 ? "Task" : "Tasks"}
                </span>
              </div>
              <div role="list" className={styles.taskList}>
                {departmentItems.map((item) => (
                  <div role="listitem" key={item.task_id}>
                    <CgTaskListRow item={item} />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
