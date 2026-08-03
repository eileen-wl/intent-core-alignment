import type {
  AnchorContextRead,
  CgInboxItemRead,
} from "@intent-core/contracts";
import Link from "next/link";

import { AnchorContextSummary, FtrackLinkageBadge } from "@/design";
import { versionDisplayText } from "./cgWording";
import styles from "./CgTaskRow.module.css";

/** One Workspace-Home "Important Tasks" row -- leads with the Task's
 * real Current-focus title (an action, not a status), matching VFX's
 * `InboxRow`. */
export function CgTaskRow({
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
        <span className={styles.focusTitle}>{item.current_focus.title}</span>
        <span className={styles.secondaryLine}>
          <span>{item.project_name}</span>
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
