import type { CgInboxItemRead } from "@intent-core/contracts";
import Link from "next/link";

import {
  PendingLinkContent,
  StatusBadge,
  type StatusBadgeStatus,
} from "@/design";
import {
  dependencyCountLabel,
  executionAnchorStateLabel,
  versionDisplayText,
} from "../cgWording";
import styles from "./CgTaskListRow.module.css";

const EXECUTION_ANCHOR_BADGE_STATUS: Record<
  CgInboxItemRead["execution_anchor_state"],
  StatusBadgeStatus
> = {
  confirmed: "confirmed",
  draft_pending: "attention",
  none: "unavailable",
};

/** Mirrors `ShotRow.tsx`'s own `ftrackText` -- plain tertiary text, not
 * a competing colored badge. */
function ftrackText(source: CgInboxItemRead["task_source"]): string {
  return source === "ftrack" ? "Linked to ftrack" : "No linked ftrack entity";
}

/** One row inside a department section of the Execution Browser
 * (Object Browser / Catalogue Archetype, `ICAS_DESIGN.md` §6.3).
 * Object-first: Task identity, parent Shot, Execution Anchor state,
 * and dependency presence -- a real open-dependency count is
 * foregrounded, but "no open dependencies" is never rendered (a
 * meaningless neutral value repeated on every row). Project and
 * ftrack linkage stay tertiary; there is no Current-focus reason and
 * no Human-action framing here -- this is a browse/compare surface,
 * not Review Inbox. Always routes to the Task's own Overview and
 * always reads "Open Task". */
export function CgTaskListRow({ item }: { item: CgInboxItemRead }) {
  const hasDependency = item.open_dependency_count > 0;

  return (
    <Link href={`/cg/tasks/${item.task_id}`} className={styles.row}>
      <span className={styles.identity}>
        <span className={styles.taskName}>{item.task_name}</span>
        <span className={styles.shotName}>{item.shot_name}</span>
      </span>
      <span className={styles.stateRow}>
        <StatusBadge
          status={EXECUTION_ANCHOR_BADGE_STATUS[item.execution_anchor_state]}
          label={executionAnchorStateLabel(item.execution_anchor_state)}
        />
        {hasDependency && (
          <span className={styles.dependency}>
            {dependencyCountLabel(item.open_dependency_count)}
          </span>
        )}
      </span>
      <span className={styles.version}>{versionDisplayText(item)}</span>
      <span className={styles.tertiary}>
        {item.project_name} · {ftrackText(item.task_source)}
      </span>
      <span className={styles.open} aria-hidden="true">
        Open Task →
      </span>
      <PendingLinkContent label={item.task_name} />
    </Link>
  );
}
