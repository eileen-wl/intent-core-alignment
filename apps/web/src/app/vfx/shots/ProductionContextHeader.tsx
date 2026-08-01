import type { VfxInboxItemRead } from "@intent-core/contracts";

import { FtrackLinkageBadge, MetadataRow, StatusBadge } from "@/design";
import { taskDisplayText, versionDisplayText } from "../vfxWording";
import styles from "./ProductionContextHeader.module.css";

const CORE_ANCHOR_STATE_LABEL: Record<
  VfxInboxItemRead["core_anchor_state"],
  string
> = {
  none: "No Core Anchor",
  draft_pending: "Draft pending review",
  confirmed: "Confirmed",
};

/** Compact, reusable production-context header (Step 7C-1;
 * docs/step-7/16_STEP_7C0D_...md §4.2) -- shared across every VFX Shot
 * route (only Overview exists in this stage; Intent/Alignment/Versions/
 * Activity reuse it once built). Fixed, compact height -- never a hero
 * area. Task and Version are always independent facts here
 * (docs/step-7/15_STEP_7C0C_...md §3.1) -- never joined into an implied
 * pair. No raw UUID appears anywhere in this header. */
export function ProductionContextHeader({ item }: { item: VfxInboxItemRead }) {
  return (
    <div className={styles.header}>
      <p className={styles.breadcrumbLine}>
        {item.project_name} › {item.shot_name}
      </p>
      <div className={styles.metaLine}>
        <div className={styles.metaLeft}>
          <MetadataRow
            items={[
              { label: "Task", value: taskDisplayText(item) },
              { label: "Version", value: versionDisplayText(item) },
            ]}
          />
        </div>
        <div className={styles.metaRight}>
          <FtrackLinkageBadge source={item.shot_source} />
          <StatusBadge
            status={
              item.core_anchor_state === "confirmed" ? "confirmed" : "neutral"
            }
            label={CORE_ANCHOR_STATE_LABEL[item.core_anchor_state]}
          />
        </div>
      </div>
    </div>
  );
}
