import Link from "next/link";

import type { CgReviewWorkItem } from "@/features/cg/reviewInbox";
import styles from "./CgTaskWorkItemRow.module.css";

/** One CG Review work-item row -- shared between CG Workspace Home's
 * Priority actions and CG Review Inbox. Locked reading order: category
 * -> required-action title -> explanation -> supporting production
 * context (Task, Shot, Project). Mirrors VFX's `WorkItemRow` layout. */
export function CgTaskWorkItemRow({ item }: { item: CgReviewWorkItem }) {
  return (
    <Link href={item.route} className={styles.row}>
      <span className={styles.main}>
        <span className={styles.category}>{item.category}</span>
        <span className={styles.title}>{item.title}</span>
        <span className={styles.explanation}>{item.explanation}</span>
        <span className={styles.secondaryLine}>
          <span>{item.task.name}</span>
          <span>{item.shot.name}</span>
          <span>{item.project.name}</span>
        </span>
      </span>
      <span className={styles.open} aria-hidden="true">
        Open →
      </span>
    </Link>
  );
}
