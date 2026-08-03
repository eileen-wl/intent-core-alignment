import type {
  AnchorContextRead,
  CgInboxItemRead,
} from "@intent-core/contracts";
import Link from "next/link";

import { AnchorContextSummary, FtrackLinkageBadge } from "@/design";
import { executionAnchorStateLabel, versionDisplayText } from "../cgWording";
import styles from "../CgTaskRow.module.css";

/** One Tasks-list row (Step 7C-4) -- unlike a Review Inbox row, this
 * leads with the Task's own Execution Anchor state (a status marker)
 * rather than a Current-focus action title, since this page's purpose
 * is browsing and opening Tasks, not reviewing action items. Mirrors
 * VFX's `ShotRow`. */
export function CgTaskListRow({
  item,
  anchorContext,
}: {
  item: CgInboxItemRead;
  anchorContext?: AnchorContextRead | null;
}) {
  return (
    <Link href={`/cg/tasks/${item.task_id}`} className={styles.row}>
      <span className={styles.main}>
        <span className={styles.taskLine}>
          <span className={styles.taskName}>{item.task_name}</span>
          <span className={styles.shotName}>{item.shot_name}</span>
        </span>
        <span className={styles.focusTitle}>
          {executionAnchorStateLabel(item.execution_anchor_state)}
        </span>
        <span className={styles.secondaryLine}>
          <span>{item.project_name}</span>
          <span>{item.department ?? "No department recorded"}</span>
          <span>{versionDisplayText(item)}</span>
          <FtrackLinkageBadge source={item.task_source} />
          <AnchorContextSummary context={anchorContext} />
        </span>
      </span>
      <span className={styles.open} aria-hidden="true">
        Open →
      </span>
    </Link>
  );
}
