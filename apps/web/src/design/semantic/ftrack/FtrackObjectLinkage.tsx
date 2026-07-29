import type { RecordSource } from "@intent-core/contracts";

import { FtrackLinkageBadge } from "./FtrackLinkageBadge";
import styles from "./FtrackObjectLinkage.module.css";

/** Object-level ftrack linkage panel, intended for contextual
 * placement on Project, Shot, Task, Version, and ReviewNote (brief
 * §4). A left accent bar (teal when linked, neutral grey when not)
 * carries the linked/unlinked distinction -- the single most important
 * one for this component -- so it reads before the supporting text.
 * Only `source` is currently persisted per object -- there is no
 * per-object last-synced timestamp or external identifier surfaced by
 * any Read contract yet, so "Sync status unavailable" is always shown
 * honestly rather than a fabricated sync time. See
 * docs/step-7/11_STEP_7B3_...md §8 for what Step 8 would need to add
 * to support more detail here. */
export function FtrackObjectLinkage({
  objectType,
  source,
}: {
  /** e.g. "Shot", "Task", "Version", "ReviewNote", "Project" */
  objectType: string;
  source: RecordSource;
}) {
  const linked = source === "ftrack";
  return (
    <div
      className={linked ? `${styles.linkage} ${styles.linked}` : styles.linkage}
    >
      <FtrackLinkageBadge source={source} />
      <p className={styles.description}>
        {linked
          ? `This ${objectType} originated from ftrack.`
          : `This ${objectType} was created directly in ICAS; no ftrack entity is linked.`}
      </p>
      <p className={styles.unavailable}>Sync status unavailable.</p>
    </div>
  );
}
