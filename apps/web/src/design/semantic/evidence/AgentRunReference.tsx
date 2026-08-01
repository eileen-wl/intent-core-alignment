import type { AgentRunRead } from "@intent-core/contracts";

import { MetadataRow } from "../../components/MetadataRow";
import styles from "./AgentRunReference.module.css";

/** An `AgentRunRead` reference. A failed run stays visible without
 * turning the surrounding Evidence/Provenance area red -- a compact
 * inline failure row (not the full-page `ErrorState` card) carries its
 * already-sanitised `error` field (never a raw stack trace or prompt --
 * `model_gateway.py`'s `StructuredOutputValidationDiagnostics` is
 * responsible for that sanitisation before this ever reaches the
 * frontend), announced via `role="alert"` on just that row. */
export function AgentRunReference({ run }: { run: AgentRunRead | null }) {
  if (!run) {
    return <p className={styles.unavailable}>Agent Run unavailable.</p>;
  }

  if (run.status === "failed") {
    return (
      <div className={styles.failed} role="alert">
        <p className={styles.failedTitle}>Agent Run failed</p>
        <p className={styles.failedDetail}>
          {run.error ?? "No further detail available."}
        </p>
      </div>
    );
  }

  return (
    <MetadataRow
      items={[
        { label: "Agent", value: run.agent_type },
        { label: "Capability", value: run.capability },
        { label: "Provider", value: run.provider },
        ...(run.model_name ? [{ label: "Model", value: run.model_name }] : []),
        { label: "Status", value: run.status },
        { label: "Started", value: run.started_at },
      ]}
    />
  );
}
