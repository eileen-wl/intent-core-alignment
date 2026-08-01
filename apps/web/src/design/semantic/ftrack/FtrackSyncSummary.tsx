import type { SyncCursorRead } from "@intent-core/contracts";

import { MetadataRow } from "../../components/MetadataRow";
import styles from "./FtrackSyncSummary.module.css";

/** System-level reconciliation summary for the secondary Integrations
 * page -- not object-level linkage. Grounded in `SyncCursorRead`
 * (`key`, `last_synced_at`); when no cursor is available this renders
 * an honest "not yet run" state rather than a fabricated timestamp. */
export function FtrackSyncSummary({
  cursor,
}: {
  cursor: SyncCursorRead | null;
}) {
  if (!cursor) {
    return <p className={styles.unavailable}>No reconciliation has run yet.</p>;
  }

  return (
    <MetadataRow
      items={[
        { label: "Reconciliation", value: cursor.key },
        { label: "Last synced", value: cursor.last_synced_at },
      ]}
    />
  );
}
