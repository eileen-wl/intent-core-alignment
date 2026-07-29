import type { AgentRunRead, ContextSnapshotRead } from "@intent-core/contracts";

import { EvidenceSourceList } from "./EvidenceSourceList";
import { ProvenanceMetadata } from "./ProvenanceMetadata";
import type { EvidenceReferenceLike } from "./evidenceModel";
import styles from "./EvidenceProvenanceDrawer.module.css";

/** Accessible disclosure for Evidence and Provenance -- a native
 * `<details>`/`<summary>` rather than a modal framework, matching the
 * disclosure pattern already used for Cross-role Assessment history
 * and the Demo entry's "Explore by role" section. Expanded/collapsed
 * state is exposed both natively (the `open` attribute) and visually
 * (an explicit chevron indicator, since some platforms render the
 * default `<summary>` marker too subtly to read as an open/closed
 * cue). The evidence count in the summary lets a reader judge whether
 * expanding is worthwhile before they open it. */
export function EvidenceProvenanceDrawer({
  evidence,
  run,
  snapshot,
  label = "Evidence and provenance",
}: {
  evidence: EvidenceReferenceLike[];
  run: AgentRunRead | null;
  snapshot: ContextSnapshotRead | null;
  label?: string;
}) {
  return (
    <details className={styles.drawer}>
      <summary className={styles.summary}>
        <span className={styles.chevron} aria-hidden="true" />
        <span className={styles.summaryLabel}>{label}</span>
        <span className={styles.count}>
          {evidence.length} {evidence.length === 1 ? "source" : "sources"}
        </span>
      </summary>
      <div className={styles.content}>
        <h4 className={styles.sectionTitle}>Evidence</h4>
        <EvidenceSourceList evidence={evidence} />
        <h4 className={styles.sectionTitle}>Provenance</h4>
        <ProvenanceMetadata run={run} snapshot={snapshot} />
      </div>
    </details>
  );
}
