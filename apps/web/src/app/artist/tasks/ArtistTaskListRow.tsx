import type { ArtistInboxItemRead } from "@intent-core/contracts";
import Link from "next/link";

import { FtrackLinkageBadge } from "@/design";
import { executionAnchorStateLabel, guidanceStateLabel, versionDisplayText } from "../artistWording";
import styles from "../ArtistTaskRow.module.css";

/** One Tasks-list row (Step 7C-5): Task/Shot identity, the Task's real
 * Current focus, Execution Anchor and Artist guidance status, Project/
 * department/latest Version context, and ftrack linkage -- every field
 * the Tasks catalogue is required to show. Mirrors
 * `app/cg/tasks/CgTaskListRow.tsx`'s row shape. */
export function ArtistTaskListRow({ item }: { item: ArtistInboxItemRead }) {
  return (
    <Link href={`/artist/tasks/${item.task_id}`} className={styles.row}>
      <span className={styles.main}>
        <span className={styles.taskLine}>
          <span className={styles.taskName}>{item.task_name}</span>
          <span className={styles.shotName}>{item.shot_name}</span>
        </span>
        <span className={styles.focusTitle}>{item.current_focus.title}</span>
        <span className={styles.secondaryLine}>
          <span>{executionAnchorStateLabel(item.execution_anchor_state)}</span>
          <span>{guidanceStateLabel(item.guidance_state)}</span>
          <span>{item.project_name}</span>
          <span>{item.department ?? "No department recorded"}</span>
          <span>{versionDisplayText(item)}</span>
          <FtrackLinkageBadge source={item.task_source} />
        </span>
      </span>
      <span className={styles.open} aria-hidden="true">
        Open →
      </span>
    </Link>
  );
}
