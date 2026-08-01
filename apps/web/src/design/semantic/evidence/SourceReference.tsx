import {
  humanizeSourceType,
  type EvidenceReferenceLike,
} from "./evidenceModel";
import styles from "./SourceReference.module.css";

/** One evidence reference. Human-readable label leads on its own line;
 * the source type and technical identifier sit on a secondary line
 * below in a restrained monospace treatment (brief §3: "Prefer
 * human-readable labels first" -- technical IDs stay secondary, not
 * competing for the same visual weight as the label). */
export function SourceReference({
  reference,
}: {
  reference: EvidenceReferenceLike;
}) {
  return (
    <div className={styles.reference}>
      <p className={styles.label}>{reference.label}</p>
      <p className={styles.meta}>
        <span className={styles.type}>
          {humanizeSourceType(reference.source_type)}
        </span>
        <span aria-hidden="true"> · </span>
        <span className={styles.id}>{reference.source_id}</span>
      </p>
    </div>
  );
}
