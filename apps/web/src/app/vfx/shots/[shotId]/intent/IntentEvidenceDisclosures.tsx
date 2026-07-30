import type { IntentEvidenceData } from "@/features/vfx/intent-workspace/data";
import { EvidenceProvenanceDrawer } from "@/design";
import styles from "./IntentEvidenceDisclosures.module.css";

/** Two separate sibling disclosures, both collapsed by default
 * (docs/step-7/16_STEP_7C0D_...md §7/§13): Evidence/Provenance for the
 * revision currently being reviewed, and Intent Decomposition/Context
 * Reconstruction as advisory *inputs* a future draft could start from
 * -- a different concern from evidence *for* the current comparison,
 * so the two are never merged into one catch-all disclosure and never
 * nested inside each other. Placed last, lowest-priority position on
 * the page. A plain synchronous presentational component -- all
 * fetching already happened in `features/vfx/intent-workspace/data.ts`. */
export function IntentEvidenceDisclosures({ data }: { data: IntentEvidenceData }) {
  const { evidence, run, snapshot, decompositions, reconstructions } = data;

  return (
    <div className={styles.disclosures}>
      <EvidenceProvenanceDrawer evidence={evidence} run={run} snapshot={snapshot} />

      <details className={styles.drawer}>
        <summary className={styles.summary}>
          <span className={styles.summaryLabel}>Intent Decomposition and Context Reconstruction</span>
        </summary>
        <div className={styles.content}>
          <h4 className={styles.sectionTitle}>Intent Decomposition</h4>
          {decompositions.length === 0 ? (
            <p className={styles.empty}>No Intent Decomposition has been generated for this Shot yet.</p>
          ) : (
            <ul className={styles.list}>
              {decompositions.map((decomposition) => (
                <li key={decomposition.id}>{decomposition.core_intent_summary}</li>
              ))}
            </ul>
          )}
          <h4 className={styles.sectionTitle}>Context Reconstruction</h4>
          {reconstructions.length === 0 ? (
            <p className={styles.empty}>
              No Context Reconstruction has been generated for this Shot yet.
            </p>
          ) : (
            <ul className={styles.list}>
              {reconstructions.map((reconstruction) => (
                <li key={reconstruction.id}>
                  {reconstruction.reconstructed_context.context_summary}
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>
    </div>
  );
}
