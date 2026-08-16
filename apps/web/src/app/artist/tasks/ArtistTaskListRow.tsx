import type { ArtistInboxItemRead } from "@intent-core/contracts";
import Link from "next/link";

import {
  PendingLinkContent,
  StatusBadge,
  type StatusBadgeStatus,
} from "@/design";
import {
  executionAnchorStateLabel,
  guidanceStateLabel,
  reviewNoteCountLabel,
  versionDisplayText,
} from "../artistWording";
import styles from "./ArtistTaskListRow.module.css";

/** Guidance state, not Execution Anchor state, leads this personal
 * work catalogue -- Guidance is the fact that most directly tells the
 * Artist whether there is something new to read, which is the axis
 * this catalogue is compared on. Execution Anchor state is real and
 * kept, but demoted to a supporting fact. */
const GUIDANCE_BADGE_STATUS: Record<
  ArtistInboxItemRead["guidance_state"],
  StatusBadgeStatus
> = {
  current: "confirmed",
  outdated: "attention",
  none: "unavailable",
};

/** Mirrors `ShotRow.tsx`'s own `ftrackText` -- plain tertiary text, not
 * a competing colored badge. */
function ftrackText(source: ArtistInboxItemRead["task_source"]): string {
  return source === "ftrack" ? "Linked to ftrack" : "No linked ftrack entity";
}

/** One compact Task unit inside a Shot group of the Personal Work
 * Catalogue (Object Browser / Catalogue Archetype, `ICAS_DESIGN.md`
 * §6.3). Task identity, current Version, and Guidance state lead --
 * Shot/Project identity already lives once at the group heading, so
 * it is never repeated per Task here. A real feedback count is
 * foregrounded, but "no Review Notes recorded" is never rendered (a
 * meaningless neutral value repeated on every row); Department,
 * Execution Anchor state, and ftrack linkage sit as supporting,
 * tertiary facts -- Execution Anchor is deliberately not the leading
 * state here, unlike CG's Execution Browser. There is no
 * Current-focus reason and no Human-action framing -- this is a
 * browse/compare surface, not Review Inbox. Always routes to the
 * Task's own Overview and always reads "Open Task". */
export function ArtistTaskListRow({ item }: { item: ArtistInboxItemRead }) {
  const hasFeedback = item.open_review_note_count > 0;

  return (
    <Link href={`/artist/tasks/${item.task_id}`} className={styles.row}>
      <span className={styles.taskName}>{item.task_name}</span>
      <span className={styles.version}>{versionDisplayText(item)}</span>
      <span className={styles.stateRow}>
        <StatusBadge
          status={GUIDANCE_BADGE_STATUS[item.guidance_state]}
          label={guidanceStateLabel(item.guidance_state)}
        />
        {hasFeedback && (
          <span className={styles.feedback}>
            {reviewNoteCountLabel(item.open_review_note_count)}
          </span>
        )}
      </span>
      <span className={styles.supporting}>
        {item.department ?? "No department recorded"} ·{" "}
        {executionAnchorStateLabel(item.execution_anchor_state)} ·{" "}
        {ftrackText(item.task_source)}
      </span>
      <span className={styles.open} aria-hidden="true">
        Open Task →
      </span>
      <PendingLinkContent label={item.task_name} />
    </Link>
  );
}
