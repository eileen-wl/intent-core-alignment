"use client";

import { useMemo, useState } from "react";
import type {
  AnchorContextSummaryRead,
  VfxInboxItemRead,
  VfxInboxRead,
} from "@intent-core/contracts";

import { Breadcrumbs, EmptyState, ErrorState, PageHeader } from "@/design";
import { coreAnchorStateLabel } from "../vfxWording";
import { ShotRow } from "./ShotRow";
import styles from "./ShotsListPage.module.css";

const ALL_VALUE = "__all__";
const CORE_ANCHOR_STATES: VfxInboxItemRead["core_anchor_state"][] = [
  "none",
  "draft_pending",
  "confirmed",
];

/** `/vfx/shots` -- Shots (Step 7C-1 locked IA §9). Browsing and opening
 * Shots, not reviewing action items -- every normally-seeded Shot
 * appears here, including the generic development seed's uninitialized
 * Shot (never hidden). Filters operate only on fields the existing
 * `VfxInboxItemRead` already returns (Project, Core Anchor state,
 * Task), client-side, over the already-loaded dataset -- no widened
 * backend scope, no backend pagination. `inbox` is `null` only when the
 * real `GET /vfx/inbox` call failed, distinct from a real empty
 * portfolio. */
export function ShotsListPage({
  inbox,
  anchorContexts = {},
}: {
  inbox: VfxInboxRead | null;
  anchorContexts?: Record<string, AnchorContextSummaryRead | null>;
}) {
  return (
    <>
      <Breadcrumbs items={[{ label: "Shots" }]} />
      <PageHeader title="Shots" description="Browse and open any Shot." />

      {inbox === null ? (
        <ErrorState
          title="Shots is unavailable"
          description="The ICAS service could not be reached. Try refreshing the page."
        />
      ) : inbox.items.length === 0 ? (
        <EmptyState
          title="No Shots exist yet"
          description="Shots will appear here once they exist."
        />
      ) : (
        <ShotsListContent items={inbox.items} anchorContexts={anchorContexts} />
      )}
    </>
  );
}

function ShotsListContent({
  items,
  anchorContexts,
}: {
  items: VfxInboxItemRead[];
  anchorContexts: Record<string, AnchorContextSummaryRead | null>;
}) {
  const [projectFilter, setProjectFilter] = useState(ALL_VALUE);
  const [stateFilter, setStateFilter] = useState(ALL_VALUE);
  const [taskFilter, setTaskFilter] = useState(ALL_VALUE);

  const projects = useMemo(
    () => Array.from(new Set(items.map((item) => item.project_name))).sort(),
    [items],
  );
  const tasks = useMemo(
    () =>
      Array.from(
        new Set(
          items
            .map((item) => item.relevant_task_name)
            .filter((name): name is string => Boolean(name)),
        ),
      ).sort(),
    [items],
  );

  const filtered = items.filter((item) => {
    if (projectFilter !== ALL_VALUE && item.project_name !== projectFilter)
      return false;
    if (stateFilter !== ALL_VALUE && item.core_anchor_state !== stateFilter)
      return false;
    if (taskFilter !== ALL_VALUE && item.relevant_task_name !== taskFilter)
      return false;
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
          Core Anchor state
          <select
            className={styles.filterSelect}
            value={stateFilter}
            onChange={(event) => setStateFilter(event.target.value)}
          >
            <option value={ALL_VALUE}>All states</option>
            {CORE_ANCHOR_STATES.map((state) => (
              <option key={state} value={state}>
                {coreAnchorStateLabel(state)}
              </option>
            ))}
          </select>
        </label>

        {tasks.length > 0 && (
          <label className={styles.filterLabel}>
            Task
            <select
              className={styles.filterSelect}
              value={taskFilter}
              onChange={(event) => setTaskFilter(event.target.value)}
            >
              <option value={ALL_VALUE}>All Tasks</option>
              {tasks.map((task) => (
                <option key={task} value={task}>
                  {task}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <p>
        Showing {filtered.length} of {items.length} Shots
      </p>

      {filtered.length === 0 ? (
        <EmptyState title="No Shots match these filters" />
      ) : (
        <div role="list">
          {filtered.map((item) => (
            <div role="listitem" key={item.shot_id}>
              <ShotRow
                item={item}
                anchorContext={anchorContexts[item.shot_id]}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
