import type {
  AnchorContextSummaryRead,
  ArtistInboxItemRead,
} from "@intent-core/contracts";
import Link from "next/link";

import {
  AnchorContextSummary,
  FtrackLinkageBadge,
  PendingLinkContent,
} from "@/design";
import {
  executionAnchorStateLabel,
  guidanceStateLabel,
  versionDisplayText,
} from "../artistWording";
import styles from "../ArtistTaskRow.module.css";

/** One Tasks-list row (Step 7C-5): Task/Shot identity, the Task's real
 * Current focus, Execution Anchor and Artist guidance status, Project/
 * department/latest Version context, and ftrack linkage -- every field
 * the Tasks catalogue is required to show. Mirrors
 * `app/cg/tasks/CgTaskListRow.tsx`'s row shape. */
export function ArtistTaskListRow({
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
          <span>{executionAnchorStateLabel(item.execution_anchor_state)}</span>
          <span>{guidanceStateLabel(item.guidance_state)}</span>
          <span>{item.project_name}</span>
          <span>{item.department ?? "No department recorded"}</span>
          <span>{versionDisplayText(item)}</span>
          <FtrackLinkageBadge source={item.task_source} />
        </span>
      </span>
      <span className={styles.open} aria-hidden="true">
        {anchorContext?.next_action.action_label ?? "Open Task"} →
      </span>
      <PendingLinkContent label={item.task_name} />
    </Link>
  );
}
