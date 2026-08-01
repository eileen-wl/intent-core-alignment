import Link from "next/link";

import styles from "./ReturnToShotOverviewLink.module.css";

/** The primary Just-confirmed Success action (Step 7C-3) -- a plain
 * navigation back to the Shot Overview, never an Agent-flavoured action,
 * so it deliberately does not reuse `StartDraftButton`'s violet
 * `--accent-agent` primary styling. Kept beside `StartDraftButton`'s
 * "Create new revision" (its existing default secondary look) so
 * neither action reads as the only or dominant one. */
export function ReturnToShotOverviewLink({ shotId }: { shotId: string }) {
  return (
    <Link href={`/vfx/shots/${shotId}`} className={styles.link}>
      Return to Shot Overview
    </Link>
  );
}
