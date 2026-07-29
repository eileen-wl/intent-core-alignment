import {
  intentSignalLevelWording,
  intentSignalStatusTone,
  type IntentSignalAvailability,
} from "./intentSignalModel";
import styles from "./IntentSignalIndicator.module.css";

/** Level 1 -- global indicator. Presence and attention level only,
 * never a count: there is no aggregation endpoint yet to honestly
 * total signals across Shots, and the persisted signal is not a
 * notification stream, so no unread badge is ever rendered here.
 *
 * Deliberately its own minimal dot-plus-text treatment rather than the
 * `StatusBadge` pill used by `IntentSignalBadge` (level 4) -- a global
 * indicator reads as a quiet state marker in a top bar, not a list-row
 * chip; the two levels should not look identical. */
export function IntentSignalIndicator({
  availability,
}: {
  availability: IntentSignalAvailability;
}) {
  if (availability.status !== "available") {
    return (
      <span className={styles.indicator}>
        <span
          className={`${styles.dot} ${styles.dotNeutral}`}
          aria-hidden="true"
        />
        No current Intent Signal
      </span>
    );
  }

  const { attention_level: level } = availability.signal;
  const tone = intentSignalStatusTone(level);
  return (
    <span className={styles.indicator}>
      <span
        className={`${styles.dot} ${tone === "attention" ? styles.dotAttention : styles.dotNeutral}`}
        aria-hidden="true"
      />
      {intentSignalLevelWording(level)}
    </span>
  );
}
