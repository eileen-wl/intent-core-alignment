import type { VfxInboxItemRead } from "@intent-core/contracts";
import Link from "next/link";

import { FtrackLinkageBadge } from "@/design";
import {
  coreAnchorStateLabel,
  signalStateLabel,
  taskDisplayText,
  versionDisplayText,
} from "../vfxWording";
import styles from "../InboxRow.module.css";

/** One Shots-list row (Step 7C-1 locked IA §9). Unlike a Review Inbox
 * row, this leads with the Shot's own Core Anchor state (a status/risk
 * marker) rather than a Current-focus action title -- this page's
 * purpose is browsing and opening Shots, not reviewing action items.
 * Reuses `InboxRow`'s row layout/CSS (same visual language, no
 * duplicated stylesheet) and the same shared wording helpers so the
 * two surfaces never describe the same Shot differently. */
export function ShotRow({ item }: { item: VfxInboxItemRead }) {
  return (
    <Link href={`/vfx/shots/${item.shot_id}`} className={styles.row}>
      <span className={styles.main}>
        <span className={styles.shotLine}>
          <span className={styles.shotName}>{item.shot_name}</span>
          <span className={styles.projectName}>{item.project_name}</span>
        </span>
        <span className={styles.focusTitle}>
          {coreAnchorStateLabel(item.core_anchor_state)}
        </span>
        <span className={styles.secondaryLine}>
          <span>{signalStateLabel(item.latest_signal_attention_level)}</span>
          <span>{taskDisplayText(item)}</span>
          <span>{versionDisplayText(item)}</span>
          <FtrackLinkageBadge source={item.shot_source} />
        </span>
      </span>
      <span className={styles.open} aria-hidden="true">
        Open →
      </span>
    </Link>
  );
}
