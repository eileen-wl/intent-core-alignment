import type {
  AnchorContextSummaryRead,
  ArtistInboxItemRead,
} from "@intent-core/contracts";
import Link from "next/link";

import { AnchorContextSummary, FtrackLinkageBadge } from "@/design";
import { versionDisplayText } from "./artistWording";
import styles from "./ArtistTaskRow.module.css";

/** One Workspace-Home "Important Tasks" row -- leads with the Task's
 * real Current-focus title (an action, not a status), matching
 * `app/cg/CgTaskRow.tsx`. */
export function ArtistTaskRow({
  item,
  anchorContext,
}: {
  item: ArtistInboxItemRead;
  anchorContext?: AnchorContextSummaryRead | null;
}) {
  return (
    <Link
      href={
        anchorContext?.next_action.target_route ??
        `/artist/tasks/${item.task_id}`
      }
      className={styles.row}
    >
      <span className={styles.main}>
        <span className={styles.taskLine}>
          <span className={styles.taskName}>{item.task_name}</span>
          <span className={styles.shotName}>{item.shot_name}</span>
        </span>
        <span className={styles.focusTitle}>
          {anchorContext?.next_action.title ?? item.current_focus.title}
        </span>
        <AnchorContextSummary context={anchorContext} />
        <span className={styles.secondaryLine} aria-label="Production context">
          <span>{item.project_name}</span>
          <span>{versionDisplayText(item)}</span>
          <FtrackLinkageBadge source={item.task_source} />
        </span>
      </span>
      <span className={styles.open} aria-hidden="true">
        {anchorContext?.next_action.action_label ?? "Open Task"} →
      </span>
    </Link>
  );
}
