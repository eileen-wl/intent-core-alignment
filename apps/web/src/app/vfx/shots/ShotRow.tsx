import type { VfxInboxItemRead } from "@intent-core/contracts";
import Link from "next/link";

import {
  PendingLinkContent,
  StatusBadge,
  type StatusBadgeStatus,
} from "@/design";
import {
  coreAnchorStateLabel,
  signalStateLabel,
  taskDisplayText,
  versionDisplayText,
} from "../vfxWording";
import styles from "./ShotRow.module.css";

const CORE_ANCHOR_BADGE_STATUS: Record<
  VfxInboxItemRead["core_anchor_state"],
  StatusBadgeStatus
> = {
  confirmed: "confirmed",
  draft_pending: "attention",
  none: "unavailable",
};

/** Same real `source: "manual" | "ftrack"` field, same two real
 * wordings `WorkItemRow.tsx`'s `ftrackText` already established --
 * plain tertiary text, not a competing colored badge, since linkage is
 * supporting integration metadata here, not a status. */
function ftrackText(source: VfxInboxItemRead["shot_source"]): string {
  return source === "ftrack" ? "Linked to ftrack" : "No linked ftrack entity";
}

/** One Shot Board tile (Object Browser / Catalogue Archetype,
 * `ICAS_DESIGN.md` §6.3). Object-first, Shot-identity-led: a Shot's
 * own real textual identity (name + current Version) fills a distinct
 * plate region -- never a fake frame, but shaped and proportioned so a
 * future real ftrack thumbnail can drop into that exact region without
 * redesigning the catalogue. Supporting facts (Project, Task, Core
 * Anchor state, attention) sit beside it; a null attention level is
 * never rendered as a hollow "No signal" line. Always routes to the
 * Shot's own Overview and always reads "Open Shot". */
export function ShotRow({ item }: { item: VfxInboxItemRead }) {
  const hasAttention = item.latest_signal_attention_level !== null;

  return (
    <Link href={`/vfx/shots/${item.shot_id}`} className={styles.tile}>
      <span className={styles.slate}>
        <span className={styles.slateShotName}>{item.shot_name}</span>
        <span className={styles.slateVersion}>{versionDisplayText(item)}</span>
      </span>
      <span className={styles.details}>
        <span className={styles.projectName}>{item.project_name}</span>
        <span className={styles.stateRow}>
          <StatusBadge
            status={CORE_ANCHOR_BADGE_STATUS[item.core_anchor_state]}
            label={coreAnchorStateLabel(item.core_anchor_state)}
          />
          {hasAttention && (
            <span className={styles.attention}>
              {signalStateLabel(item.latest_signal_attention_level)}
            </span>
          )}
        </span>
        <span className={styles.taskName}>{taskDisplayText(item)}</span>
        <span className={styles.tertiary}>{ftrackText(item.shot_source)}</span>
        <span className={styles.open} aria-hidden="true">
          Open Shot →
        </span>
      </span>
      <PendingLinkContent label={item.shot_name} />
    </Link>
  );
}
