import type { ReactNode } from "react";

import styles from "./EmptyState.module.css";

/** Nothing-to-show state -- e.g. "No Shots yet". Distinct from
 * `ErrorState` (something went wrong) and `PermissionState` (you
 * can't see this), so a page can tell the three apart at a glance. */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className={styles.state} role="status">
      <span className={styles.marker} aria-hidden="true" />
      <p className={styles.title}>{title}</p>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
