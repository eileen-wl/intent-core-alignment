import type { ReactNode } from "react";

import styles from "./ErrorState.module.css";

/** Something failed -- a request error, a failed Agent Run, a blocked
 * action. Uses `role="alert"` so assistive technology announces it
 * without the page needing to move focus. */
export function ErrorState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className={styles.state} role="alert">
      <span className={styles.marker} aria-hidden="true">
        !
      </span>
      <div>
        <p className={styles.title}>{title}</p>
        {description && <p className={styles.description}>{description}</p>}
        {action && <div className={styles.action}>{action}</div>}
      </div>
    </div>
  );
}
