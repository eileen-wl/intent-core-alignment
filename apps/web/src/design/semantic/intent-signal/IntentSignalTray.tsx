import type { IntentSignalRead } from "@intent-core/contracts";

import {
  intentSignalLevelWording,
  intentSignalStatusTone,
} from "./intentSignalModel";
import styles from "./IntentSignalTray.module.css";

export interface IntentSignalTrayItem {
  id: string;
  /** Human-readable context, e.g. "Shot 010 · Final confrontation" --
   * caller-supplied, never hardcoded here. */
  contextLabel: string;
  signal: IntentSignalRead;
  /** Caller-determined: is this the Shot's current signal, or a
   * superseded one being shown for continuity? Purely presentational --
   * does not change the underlying signal data. */
  historical?: boolean;
}

/** Level 2 -- compact tray of relevant signals. Unlike the other five
 * levels this component's unit is a list, not one signal's
 * availability: a tray only ever lists signals that already exist, so
 * there is no "unavailable" state to represent for the tray itself --
 * an empty tray renders the honest empty message instead. Always caps
 * at 3 items (docs/step-7/05_STEP_7A4_...md §7 -- "up to three
 * relevant signals"), never more, regardless of how many are passed.
 * Historical entries are visually de-emphasised (muted dot, "Historical"
 * marker, secondary text) so a quick scan separates current attention
 * from superseded context without needing another colour. */
export function IntentSignalTray({
  items,
  emptyMessage = "No current Intent Signals",
}: {
  items: IntentSignalTrayItem[];
  emptyMessage?: string;
}) {
  const visible = items.slice(0, 3);

  if (visible.length === 0) {
    return <p className={styles.empty}>{emptyMessage}</p>;
  }

  return (
    <ul className={styles.list}>
      {visible.map((item) => {
        const tone = item.historical
          ? "historical"
          : intentSignalStatusTone(item.signal.attention_level);
        return (
          <li
            key={item.id}
            className={
              item.historical
                ? `${styles.item} ${styles.itemHistorical}`
                : styles.item
            }
          >
            <span
              className={`${styles.dot} ${styles[`dot-${tone}`]}`}
              aria-hidden="true"
            />
            <span className={styles.body}>
              <span className={styles.context}>{item.contextLabel}</span>
              <span className={styles.level}>
                {item.historical && (
                  <span className={styles.historicalTag}>Historical</span>
                )}
                {intentSignalLevelWording(item.signal.attention_level)}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
