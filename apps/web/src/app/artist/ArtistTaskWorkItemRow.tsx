import type { ReactNode } from "react";
import Link from "next/link";
import type { AnchorContextSummaryRead } from "@intent-core/contracts";

import {
  PendingLinkContent,
  StatusBadge,
  type StatusBadgeStatus,
} from "@/design";
import type { ArtistReviewWorkItem } from "@/features/artist/reviewInbox";
import { dependencyCountLabel, reviewNoteCountLabel } from "./artistWording";
import styles from "./ArtistTaskWorkItemRow.module.css";

/** Production-context path, matching the locked VFX `WorkItemRow`'s own
 * `productionContextPath` grammar (Project -> Shot -> Task, one
 * consistent "·" separator) rather than three unseparated spans.
 * Project/Shot/Task are all real, required fields on
 * `ArtistReviewWorkItem` (unlike VFX's optional equivalents), so no
 * fallback text is needed; Department, when real, qualifies the Task
 * name in parentheses rather than becoming its own rail segment. */
function productionContextPath(item: ArtistReviewWorkItem): string {
  const taskText = item.task.department
    ? `${item.task.name} (${item.task.department})`
    : item.task.name;
  return [item.project.name, item.shot.name, taskText].join(" · ");
}

/** Object-specific wording, matching the locked VFX row's own
 * `CORE_ANCHOR_ROW_LABEL` reasoning: a bare "Current" badge reads as
 * ambiguous about which real object it describes. Local to this row
 * only -- the shared `guidanceStateLabel` (`../artistWording.ts`) keeps
 * its own shorter wording for the filter dropdown, which already has
 * an unambiguous column/label context of its own. Guidance state is
 * used here (not Execution Anchor state, which this item type also
 * carries) because three of the four real Artist work-item categories
 * ("Guidance update", "Feedback", "Guidance available") are centered on
 * whether Guidance itself is still current -- the same role Core
 * Anchor state plays for most VFX categories. */
const GUIDANCE_ROW_LABEL: Record<
  ArtistReviewWorkItem["guidanceState"],
  string
> = {
  current: "Guidance current",
  outdated: "Guidance outdated",
  none: "No guidance yet",
};

const GUIDANCE_BADGE_STATUS: Record<
  ArtistReviewWorkItem["guidanceState"],
  StatusBadgeStatus
> = {
  current: "confirmed",
  outdated: "attention",
  none: "unavailable",
};

/** Semantic-status correction: status is work-item-specific, not a
 * fixed per-role choice (`ICAS_INBOX_SEMANTICS_AND_NAVIGATION_
 * DIAGNOSTIC.md` §1). "Guidance update"/"Guidance available" are
 * directly about Guidance -- keep the real, object-specific badge.
 * "Feedback" is about a real recorded Review Note, not Guidance --
 * showing "No guidance yet" there was confirmed misleading (a Task can
 * have unread feedback and no guidance at the same time, two unrelated
 * facts), so this shows the real Review Note fact instead. "Dependency
 * review" is about a real open `TaskDependency`, not Guidance -- same
 * correction, using the real dependency count. Neither replacement is
 * a colored badge: no invented severity, no acknowledgement state. */
function stateElement(item: ArtistReviewWorkItem): ReactNode {
  switch (item.category) {
    case "Feedback":
      return <span>{reviewNoteCountLabel(item.openReviewNoteCount)}</span>;
    case "Dependency review":
      return <span>{dependencyCountLabel(item.openDependencyCount)}</span>;
    case "Guidance update":
    case "Guidance available":
      return (
        <StatusBadge
          status={GUIDANCE_BADGE_STATUS[item.guidanceState]}
          label={GUIDANCE_ROW_LABEL[item.guidanceState]}
        />
      );
    default:
      return null;
  }
}

/** One Artist Review work-item row -- shared between Artist Workspace
 * Home's Priority actions and Artist Review Inbox. Locked reading
 * order: required-action title -> explanation -> supporting production
 * context (Project, Shot, Task/Department) -> the real state that is
 * actually relevant to *this* work item's category (see `stateElement`
 * -- never a fixed per-role choice) -> Human action. Mirrors
 * `app/cg/CgTaskWorkItemRow.tsx` and the locked VFX
 * `WorkItemRow` (Worklist archetype,
 * `docs/design/ICAS_VISUAL_LANGUAGE_V1.md` §24.1): no per-row category
 * kicker (both this row's own inbox and Workspace Home already group
 * these rows by that exact category, at the group heading -- repeating
 * it per row added no information and used the stale
 * `--accent-agent-text` token for a non-Human, non-selection label); no
 * per-row `AnchorContextSummary` panel (a bordered multi-column box
 * that never belonged to this row's own reading order and directly
 * contradicts the Worklist archetype's density rules -- the same real
 * Anchor Context stays one click away on the item's own target page).
 *
 * Action-label audit: previously used only `anchorContext`'s hint,
 * falling back straight to the generic "Review item" whenever no
 * Anchor Context summary existed for that Task -- silently ignoring
 * this item's own real `actionLabel` (e.g. "Read feedback", "Open
 * Task"). Now prefers the Anchor Context hint when present (it can
 * reflect a more current real next action), then this item's own
 * `actionLabel`, and only then the generic fallback -- the same
 * three-tier precedence the locked VFX row already established. */
export function ArtistTaskWorkItemRow({
  item,
  anchorContext,
}: {
  item: ArtistReviewWorkItem;
  anchorContext?: AnchorContextSummaryRead | null;
}) {
  const actionLabel =
    anchorContext?.next_action.action_label ??
    item.actionLabel ??
    "Review item";

  return (
    <Link href={item.route} className={styles.row}>
      <span className={styles.main}>
        <span className={styles.title}>{item.title}</span>
        <span className={styles.explanation}>{item.explanation}</span>
        <span className={styles.secondaryLine} aria-label="Production context">
          <span>{productionContextPath(item)}</span>
          {stateElement(item)}
        </span>
      </span>
      <span className={styles.open} aria-hidden="true">
        {actionLabel} →
      </span>
      <PendingLinkContent label={item.title} />
    </Link>
  );
}
