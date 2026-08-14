import type { ReactNode } from "react";
import Link from "next/link";
import type { AnchorContextSummaryRead } from "@intent-core/contracts";

import {
  PendingLinkContent,
  StatusBadge,
  type StatusBadgeStatus,
} from "@/design";
import type { CgReviewWorkItem } from "@/features/cg/reviewInbox";
import { dependencyCountLabel } from "./cgWording";
import styles from "./CgTaskWorkItemRow.module.css";

/** Production-context path, matching the locked VFX `WorkItemRow`'s own
 * `productionContextPath` grammar (Project -> Shot -> Task, one
 * consistent "·" separator) rather than three unseparated spans.
 * Project/Shot/Task are all real, required fields on `CgReviewWorkItem`
 * (unlike VFX's optional equivalents), so no fallback text is needed;
 * Department, when real, qualifies the Task name in parentheses rather
 * than becoming its own rail segment. */
function productionContextPath(item: CgReviewWorkItem): string {
  const taskText = item.task.department
    ? `${item.task.name} (${item.task.department})`
    : item.task.name;
  return [item.project.name, item.shot.name, taskText].join(" · ");
}

/** Object-specific wording, matching the locked VFX row's own
 * `CORE_ANCHOR_ROW_LABEL` reasoning: a bare "Confirmed" badge on a row
 * like "New Production Version awaiting review" reads as if the
 * Version were confirmed. Local to this row only -- the shared
 * `executionAnchorStateLabel` (`../cgWording.ts`) keeps its own shorter
 * wording for the filter dropdown, which already has an unambiguous
 * column/label context of its own. */
const EXECUTION_ANCHOR_ROW_LABEL: Record<
  CgReviewWorkItem["executionAnchorState"],
  string
> = {
  confirmed: "Execution Anchor confirmed",
  draft_pending: "Execution Anchor draft pending",
  none: "No Execution Anchor",
};

const EXECUTION_ANCHOR_BADGE_STATUS: Record<
  CgReviewWorkItem["executionAnchorState"],
  StatusBadgeStatus
> = {
  confirmed: "confirmed",
  draft_pending: "attention",
  none: "unavailable",
};

/** Semantic-status correction: status is work-item-specific, not a
 * fixed per-role choice (`ICAS_INBOX_SEMANTICS_AND_NAVIGATION_
 * DIAGNOSTIC.md` §1). "Execution Anchor confirmation"/"Draft review"
 * are directly about the Execution Anchor -- keep the real,
 * object-specific badge. "Dependency review" is about a real open
 * `TaskDependency`, not the Execution Anchor -- show the real
 * dependency count as a neutral fact instead (no invented severity, no
 * colored badge). "Version review" only ever appears once the
 * Execution Anchor is already confirmed (its own backend precondition
 * -- `cg_inbox/current_focus.py`), so an Execution Anchor badge there
 * would read "confirmed" on every single row: zero differentiating
 * information, so no status element renders for it at all. */
function stateElement(item: CgReviewWorkItem): ReactNode {
  if (item.category === "Dependency review") {
    return <span>{dependencyCountLabel(item.openDependencyCount)}</span>;
  }
  if (item.category === "Version review") {
    return null;
  }
  return (
    <StatusBadge
      status={EXECUTION_ANCHOR_BADGE_STATUS[item.executionAnchorState]}
      label={EXECUTION_ANCHOR_ROW_LABEL[item.executionAnchorState]}
    />
  );
}

/** One CG Review work-item row -- shared between CG Workspace Home's
 * Priority actions and CG Review Inbox. Locked reading order:
 * required-action title -> explanation -> supporting production
 * context (Project, Shot, Task/Department) -> the real state that is
 * actually relevant to *this* work item's category (see `stateElement`
 * -- never a fixed per-role choice) -> Human action. Mirrors the
 * locked VFX `WorkItemRow` (Worklist
 * archetype, `docs/design/ICAS_VISUAL_LANGUAGE_V1.md` §24.1): no
 * per-row category kicker (both this row's own inbox and Workspace Home
 * already group these rows by that exact category, at the group heading
 * -- repeating it per row added no information and used the stale
 * `--accent-agent-text` token for a non-Human, non-selection label); no
 * per-row `AnchorContextSummary` panel (a bordered multi-column box
 * that never belonged to this row's own reading order and directly
 * contradicts the Worklist archetype's density rules -- the same real
 * Anchor Context stays one click away on the item's own target page).
 *
 * Action-label audit: previously used only `anchorContext`'s hint,
 * falling back straight to the generic "Review item" whenever no
 * Anchor Context summary existed for that Task -- silently ignoring
 * this item's own real `actionLabel` (e.g. "Review dependencies",
 * "Open Execution"). Now prefers the Anchor Context hint when present
 * (it can reflect a more current real next action), then this item's
 * own `actionLabel`, and only then the generic fallback -- the same
 * three-tier precedence the locked VFX row already established. */
export function CgTaskWorkItemRow({
  item,
  anchorContext,
}: {
  item: CgReviewWorkItem;
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
