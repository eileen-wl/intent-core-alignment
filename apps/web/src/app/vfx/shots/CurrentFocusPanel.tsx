import type { VfxInboxCurrentFocusRead } from "@intent-core/contracts";
import Link from "next/link";

import { Panel, PendingLinkContent, StatusBadge } from "@/design";
import styles from "./CurrentFocusPanel.module.css";

/** Exactly one Current focus (Step 7C-1; docs/step-7/16_STEP_7C0D_...md
 * §6) -- dominant through typography and position (first on the page),
 * not a large decorative hero. The `focus_type == "none"` state renders
 * no button at all (never a disabled fake action) -- see
 * docs/step-7/15_STEP_7C0C_...md §6.6. The primary action links to the
 * real, locked target route; that route may not be implemented yet in
 * this stage (Intent/Alignment are 7C-2/7C-3 scope) -- an honest link
 * to the correct destination, not a fabricated "coming soon" control. */
export function CurrentFocusPanel({
  focus,
}: {
  focus: VfxInboxCurrentFocusRead;
}) {
  return (
    <Panel tone="elevated" className={styles.panel}>
      <div className={styles.label}>
        <StatusBadge
          status={
            focus.focus_type === "core_anchor_gate_pending"
              ? "attention"
              : "neutral"
          }
          label="Current focus"
        />
      </div>
      <h2 className={styles.title}>{focus.title}</h2>
      <p className={styles.explanation}>{focus.explanation}</p>
      {focus.actionable && focus.primary_action_label && (
        <div className={styles.actionRow}>
          <Link href={focus.target_route} className={styles.action}>
            {focus.primary_action_label}
            <PendingLinkContent label={focus.primary_action_label} />
          </Link>
        </div>
      )}
    </Panel>
  );
}
