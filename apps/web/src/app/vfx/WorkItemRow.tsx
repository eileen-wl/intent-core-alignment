import Link from "next/link";
import type { AnchorContextRead } from "@intent-core/contracts";

import { AnchorContextSummary, FtrackLinkageBadge } from "@/design";
import type { ReviewWorkItem } from "@/features/vfx/review-inbox/workItem";
import { coreAnchorStateLabel } from "./vfxWording";
import styles from "./WorkItemRow.module.css";

function taskText(item: ReviewWorkItem): string {
  return item.task?.name ?? "No Task recorded yet";
}

function versionText(item: ReviewWorkItem): string {
  if (!item.version) return "No Version recorded yet";
  return item.version.number
    ? `${item.version.name} (v${item.version.number})`
    : item.version.name;
}

/** One Review work-item row (Step 7C-1 content-architecture correction).
 * Shared between Workspace Home's Priority actions and Review Inbox --
 * the two pages that render `ReviewWorkItem`s directly, as opposed to
 * `InboxRow`/`ShotRow`'s Shot-led rows. Locked reading order: category
 * -> required-action title -> explanation -> supporting production
 * context (Shot, Project, Task, Version, Core Anchor state, ftrack
 * linkage). The Shot name is deliberately part of the secondary line,
 * never the row's primary heading. */
export function WorkItemRow({
  item,
  anchorContext,
}: {
  item: ReviewWorkItem;
  anchorContext?: AnchorContextRead | null;
}) {
  return (
    <Link href={item.route} className={styles.row}>
      <span className={styles.main}>
        <span className={styles.category}>{item.category}</span>
        <span className={styles.title}>{item.title}</span>
        <span className={styles.explanation}>{item.explanation}</span>
        <span className={styles.secondaryLine}>
          {item.shot && <span>{item.shot.name}</span>}
          {item.project && <span>{item.project.name}</span>}
          <span>{taskText(item)}</span>
          <span>{versionText(item)}</span>
          {item.coreAnchorState && (
            <span>{coreAnchorStateLabel(item.coreAnchorState)}</span>
          )}
          {item.shot && <FtrackLinkageBadge source={item.shot.source} />}
          <AnchorContextSummary context={anchorContext} />
        </span>
      </span>
      <span className={styles.open} aria-hidden="true">
        Open →
      </span>
    </Link>
  );
}
