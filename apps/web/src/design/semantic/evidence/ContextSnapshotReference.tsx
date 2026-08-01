import type { ContextSnapshotRead } from "@intent-core/contracts";

import { MetadataRow } from "../../components/MetadataRow";
import styles from "./ContextSnapshotReference.module.css";

/** A `ContextSnapshotRead` reference. Deliberately never renders
 * `snapshot.payload` -- raw ContextSnapshot JSON stays out of the
 * primary interface per docs/step-7/03_STEP_7A2_...md §3.5; only the
 * identifier and capture time are shown. */
export function ContextSnapshotReference({
  snapshot,
}: {
  snapshot: ContextSnapshotRead | null;
}) {
  if (!snapshot) {
    return <p className={styles.unavailable}>Context snapshot unavailable.</p>;
  }

  return (
    <MetadataRow
      items={[
        { label: "Context snapshot", value: snapshot.id },
        { label: "Captured", value: snapshot.created_at },
      ]}
    />
  );
}
