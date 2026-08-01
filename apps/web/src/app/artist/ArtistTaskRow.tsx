import type { ArtistInboxItemRead } from "@intent-core/contracts";
import Link from "next/link";

import { FtrackLinkageBadge } from "@/design";
import { versionDisplayText } from "./artistWording";
import styles from "./ArtistTaskRow.module.css";

/** One Workspace-Home "Important Tasks" row -- leads with the Task's
 * real Current-focus title (an action, not a status), matching
 * `app/cg/CgTaskRow.tsx`. */
export function ArtistTaskRow({ item }: { item: ArtistInboxItemRead }) {
  return (
    <Link href={`/artist/tasks/${item.task_id}`} className={styles.row}>
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
        </span>
      </span>
      <span className={styles.open} aria-hidden="true">
        Open →
      </span>
    </Link>
  );
}
