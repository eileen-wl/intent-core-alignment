import type { ArtistInboxCurrentFocusRead } from "@intent-core/contracts";
import Link from "next/link";

import { Panel, StatusBadge } from "@/design";
import styles from "./TaskCurrentFocusPanel.module.css";

/** Exactly one Current focus (Step 7C-5), mirroring
 * `app/cg/tasks/[taskId]/TaskCurrentFocusPanel.tsx`. The `focus_type ==
 * "none"` state renders no button at all (never a disabled fake
 * action). */
export function TaskCurrentFocusPanel({ focus }: { focus: ArtistInboxCurrentFocusRead }) {
  return (
    <Panel tone="elevated" className={styles.panel}>
      <div className={styles.label}>
        <StatusBadge
          status={focus.focus_type === "guidance_outdated" ? "attention" : "neutral"}
          label="Current focus"
        />
      </div>
      <h2 className={styles.title}>{focus.title}</h2>
      <p className={styles.explanation}>{focus.explanation}</p>
      {focus.actionable && focus.primary_action_label && (
        <div className={styles.actionRow}>
          <Link href={focus.target_route} className={styles.action}>
            {focus.primary_action_label}
          </Link>
        </div>
      )}
    </Panel>
  );
}
