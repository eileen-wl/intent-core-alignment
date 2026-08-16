import { Icon, type IconName } from "./Icon";
import styles from "./SignalStrip.module.css";

export interface SignalStripItem {
  icon: IconName;
  label: string;
  count: number;
}

/** ICAS Visual Language v1 §8: replaces a prose count line ("Technical
 * concerns: 0 · Coordination concerns: 1 · ...") with a compact
 * production signal row, not five KPI cards. Owner correction: an
 * inline `[icon] label count` row read as one text sentence -- each
 * item now stacks a small icon+label identity line over its count, so
 * the count (larger, bolder, its own line) is unmistakably the
 * strongest element instead of just another word in a sentence. Every
 * item uses the same neutral/cool-grey treatment (§8.3: this
 * component has no per-metric severity data to justify amber/red, so
 * it never invents one); zero counts stay present but visually quiet
 * rather than hidden. Spreads across the full available width at
 * desktop size and wraps gracefully at narrower widths (§8.2, §17). */
export function SignalStrip({ items }: { items: SignalStripItem[] }) {
  return (
    <ul className={styles.strip}>
      {items.map((item) => (
        <li key={item.label} className={styles.item}>
          <span className={styles.itemHead}>
            <Icon name={item.icon} size="micro" />
            <span className={styles.label}>{item.label}</span>
          </span>
          <span className={item.count === 0 ? styles.countZero : styles.count}>
            {item.count}
          </span>
        </li>
      ))}
    </ul>
  );
}
