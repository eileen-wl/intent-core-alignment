import type { VfxInboxNextFocusRead } from "@intent-core/contracts";
import Link from "next/link";

import { Panel } from "@/design";
import styles from "./NextFocusPanel.module.css";

/** Zero-to-two subordinate "Next in this Shot" candidates (Step 7C-1
 * targeted correction §7-§8): real, still-eligible focus-type
 * candidates ranked below the Current focus by the same locked
 * precedence, supplied by the Shot-specific read model. Renders
 * nothing at all when the list is empty -- "zero to two" is a locked,
 * honest outcome, never padded with a fabricated item or an empty
 * heading. Deliberately not the same component as `CurrentFocusPanel`:
 * these are not rendered under a "Current focus" badge, so a reader
 * never mistakes a subordinate item for the active focus. */
export function NextFocusPanel({ items }: { items: VfxInboxNextFocusRead[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <Panel tone="panel" className={styles.panel}>
      <h2 className={styles.heading}>Next in this Shot</h2>
      <ul className={styles.list} aria-label="Next in this Shot">
        {items.map((item) => (
          <li key={item.focus_type} className={styles.item}>
            <div className={styles.itemBody}>
              <p className={styles.itemTitle}>{item.title}</p>
              <p className={styles.itemExplanation}>{item.explanation}</p>
            </div>
            {item.actionable && item.primary_action_label && (
              <Link href={item.target_route} className={styles.itemAction}>
                {item.primary_action_label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
