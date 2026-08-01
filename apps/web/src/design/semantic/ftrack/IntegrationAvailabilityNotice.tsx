import type { WritebackRecordRead } from "@intent-core/contracts";

import { StatusBadge } from "../../components/StatusBadge";
import styles from "./IntegrationAvailabilityNotice.module.css";

/** Controlled write-back availability, grounded in `WritebackRecordRead`
 * -- the only entity type it currently supports is
 * `"core_anchor_revision"`, and a record only exists once a Human
 * Decision has actually requested one (`DecisionRead.write_back_requested`).
 * Write-back is secondary to object linkage (`FtrackObjectLinkage`),
 * so this stays compact rather than a full card -- a "not requested"
 * state is the common case and does not deserve the same visual
 * weight as a real failure. No connector-health, credential-presence,
 * or configuration detail is shown here: none of that is exposed by
 * any Read contract yet (see docs/step-7/11_STEP_7B3_...md §8). */
export function IntegrationAvailabilityNotice({
  writeback,
}: {
  writeback: WritebackRecordRead | null;
}) {
  if (!writeback) {
    return (
      <p className={styles.notRequested}>
        <span className={styles.title}>
          Controlled write-back not requested
        </span>
        <span className={styles.detail}>
          {" "}
          — no write-back has been requested for this record yet.
        </span>
      </p>
    );
  }

  if (writeback.status === "failed") {
    return (
      <div className={styles.failed} role="alert">
        <p className={styles.failedTitle}>Write-back failed</p>
        <p className={styles.failedDetail}>
          {writeback.error ?? "No further detail available."}
        </p>
      </div>
    );
  }

  return (
    <StatusBadge
      status={writeback.status === "succeeded" ? "confirmed" : "active"}
      label={
        writeback.status === "succeeded"
          ? "Write-back succeeded"
          : "Write-back pending"
      }
    />
  );
}
