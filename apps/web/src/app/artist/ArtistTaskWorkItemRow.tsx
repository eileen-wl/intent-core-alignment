import Link from "next/link";

import type { ArtistReviewWorkItem } from "@/features/artist/reviewInbox";
import styles from "./ArtistTaskWorkItemRow.module.css";

/** One Artist Review work-item row -- shared between Artist Workspace
 * Home's Priority actions and Artist Review Inbox. Locked reading order:
 * category -> required-action title -> explanation -> supporting
 * production context (Task, Shot, Project). Mirrors
 * `app/cg/CgTaskWorkItemRow.tsx`. */
export function ArtistTaskWorkItemRow({
  item,
}: {
  item: ArtistReviewWorkItem;
}) {
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
