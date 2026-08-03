import Link from "next/link";
import type { AnchorContextSummaryRead } from "@intent-core/contracts";

import { AnchorContextSummary } from "@/design";
import type { CgReviewWorkItem } from "@/features/cg/reviewInbox";
import styles from "./CgTaskWorkItemRow.module.css";

/** One CG Review work-item row -- shared between CG Workspace Home's
 * Priority actions and CG Review Inbox. Locked reading order: category
 * -> required-action title -> explanation -> supporting production
 * context (Task, Shot, Project). Mirrors VFX's `WorkItemRow` layout. */
export function CgTaskWorkItemRow({
  item,
  anchorContext,
}: {
  item: CgReviewWorkItem;
  anchorContext?: AnchorContextSummaryRead | null;
}) {
  return (
    <Link href={item.route} className={styles.row}>
      <span className={styles.main}>
        <span className={styles.category}>{item.category}</span>
        <span className={styles.title}>{item.title}</span>
        <span className={styles.explanation}>{item.explanation}</span>
        <AnchorContextSummary context={anchorContext} />
        <span className={styles.secondaryLine} aria-label="Production context">
          <span>{item.task.name}</span>
          <span>{item.shot.name}</span>
          <span>{item.project.name}</span>
        </span>
      </span>
      <span className={styles.open} aria-hidden="true">
        {anchorContext?.next_action.action_label ?? "Review item"} →
      </span>
    </Link>
  );
}
