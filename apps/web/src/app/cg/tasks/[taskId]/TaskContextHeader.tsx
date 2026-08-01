import type { CgInboxItemRead } from "@intent-core/contracts";

import { FtrackLinkageBadge, MetadataRow, StatusBadge } from "@/design";
import { executionAnchorStateLabel, versionDisplayText } from "../../cgWording";
import styles from "./TaskContextHeader.module.css";

/** Compact, reusable production-context header (Step 7C-4) -- shared
 * across every CG Task route, mirroring
 * `app/vfx/shots/ProductionContextHeader.tsx`. Fixed, compact height --
 * never a hero area. No raw UUID appears anywhere in this header. */
export function TaskContextHeader({ item }: { item: CgInboxItemRead }) {
  return (
    <div className={styles.header}>
      <p className={styles.breadcrumbLine}>
        {item.project_name} › {item.shot_name} › {item.task_name}
      </p>
      <div className={styles.metaLine}>
        <div className={styles.metaLeft}>
          <MetadataRow
            items={[
              { label: "Department", value: item.department ?? "Not recorded" },
              { label: "Version", value: versionDisplayText(item) },
            ]}
          />
        </div>
        <div className={styles.metaRight}>
          <FtrackLinkageBadge source={item.task_source} />
          <StatusBadge
            status={item.execution_anchor_state === "confirmed" ? "confirmed" : "neutral"}
            label={executionAnchorStateLabel(item.execution_anchor_state)}
          />
        </div>
      </div>
    </div>
  );
}
