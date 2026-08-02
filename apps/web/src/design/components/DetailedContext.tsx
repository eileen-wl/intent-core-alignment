import type { ReactNode } from "react";

import styles from "./DetailedContext.module.css";

/** Step 9B-1 owner-validation correction: a collapsed-by-default
 * disclosure for pre-existing detailed page content that would
 * otherwise directly duplicate a role's new Working Direction summary.
 * Native `<details>`/`<summary>` -- keyboard-operable and accessible by
 * the HTML spec, matching the existing `EvidenceProvenanceDrawer`
 * disclosure pattern. Wrapped content is never deleted, only visually
 * collapsed until a reader opens it. */
export function DetailedContext({ children }: { children: ReactNode }) {
  return (
    <details className={styles.details}>
      <summary className={styles.summary}>Detailed context</summary>
      <div className={styles.content}>{children}</div>
    </details>
  );
}
