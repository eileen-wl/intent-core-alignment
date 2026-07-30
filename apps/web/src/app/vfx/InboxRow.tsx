import type { VfxInboxItemRead } from "@intent-core/contracts";
import Link from "next/link";

import { FtrackLinkageBadge } from "@/design";
import styles from "./InboxRow.module.css";
import { signalStateLabel, taskDisplayText, versionDisplayText } from "./vfxWording";

/** One Alignment Inbox row (docs/step-7/16_STEP_7C0D_...md §5). First
 * scan path, in reading order: Shot -> Current focus -> why -> Open.
 * Project, source, and independently-displayed Task/Version stay
 * secondary (smaller, muted text on the row's own second line) --
 * never joined into an implied pairing (docs/step-7/15_STEP_7C0C_...md
 * §3.1). The whole row is the link target. */
export function InboxRow({ item }: { item: VfxInboxItemRead }) {
  return (
    <Link href={`/vfx/shots/${item.shot_id}`} className={styles.row}>
      <span className={styles.main}>
        <span className={styles.shotLine}>
          <span className={styles.shotName}>{item.shot_name}</span>
          <span className={styles.projectName}>{item.project_name}</span>
        </span>
        <span className={styles.focusTitle}>{item.current_focus.title}</span>
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
