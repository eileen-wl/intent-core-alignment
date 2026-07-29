import { SourceReference } from "./SourceReference";
import type { EvidenceReferenceLike } from "./evidenceModel";
import styles from "./EvidenceSourceList.module.css";

/** A list of evidence references, or an honest empty state -- evidence
 * gaps are never replaced with optimistic placeholder content. Uses a
 * compact inline message rather than the full `EmptyState` card: this
 * list is already nested inside `EvidenceProvenanceDrawer`'s own
 * bordered disclosure, and a dashed empty-state box inside that border
 * would be a card inside a card for what is a single line of text. */
export function EvidenceSourceList({
  evidence,
}: {
  evidence: EvidenceReferenceLike[];
}) {
  if (evidence.length === 0) {
    return <p className={styles.empty}>No evidence recorded</p>;
  }

  return (
    <ul className={styles.list}>
      {evidence.map((reference, index) => (
        <li key={`${reference.source_type}-${reference.source_id}-${index}`}>
          <SourceReference reference={reference} />
        </li>
      ))}
    </ul>
  );
}
