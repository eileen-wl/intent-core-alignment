import Link from "next/link";
import type { AnchorContextSummaryRead } from "@intent-core/contracts";

import { StatusBadge, type StatusBadgeStatus } from "@/design";
import type { ReviewWorkItem } from "@/features/vfx/review-inbox/workItem";
import styles from "./WorkItemRow.module.css";

function taskText(item: ReviewWorkItem): string {
  return item.task?.name ?? "No Task recorded yet";
}

function versionText(item: ReviewWorkItem): string {
  if (!item.version) return "No Version recorded yet";
  return item.version.number
    ? `${item.version.name} (v${item.version.number})`
    : item.version.name;
}

/** Production-context path, normalized to a single order (Project ->
 * Shot -> Task -> Version) with one consistent "·" separator grammar,
 * matching the secondary-line convention already established on CG/VFX
 * (e.g. CG's `.versionMeta`). Missing Project/Shot are simply omitted
 * (never fabricated); Task/Version already carry their own honest
 * "No X recorded yet" fallback text via `taskText`/`versionText`. */
function productionContextPath(item: ReviewWorkItem): string {
  return [
    item.project?.name,
    item.shot?.name,
    taskText(item),
    versionText(item),
  ]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}

/** Core Anchor state stays real, but the label is made explicit about
 * *what* is confirmed/pending -- a bare "Confirmed" badge on a row like
 * "New Production Version awaiting review" reads as if the Version (or
 * the work item) were confirmed. Local to this row only: the shared
 * `coreAnchorStateLabel` (`./vfxWording.ts`) keeps its own shorter
 * wording for the filter dropdown and other consumers (ShotRow,
 * ShotsListPage), which already have an unambiguous "Core Anchor
 * state" column/label context of their own. */
const CORE_ANCHOR_ROW_LABEL: Record<
  NonNullable<ReviewWorkItem["coreAnchorState"]>,
  string
> = {
  confirmed: "Core Anchor confirmed",
  draft_pending: "Core Anchor draft pending",
  none: "No Core Anchor",
};

const CORE_ANCHOR_BADGE_STATUS: Record<
  NonNullable<ReviewWorkItem["coreAnchorState"]>,
  StatusBadgeStatus
> = {
  confirmed: "confirmed",
  draft_pending: "attention",
  none: "unavailable",
};

/** ftrack linkage is tertiary integration metadata, not a status that
 * should compete visually with the work reason or Core Anchor state --
 * plain text (inheriting `.secondaryLine`'s own muted treatment)
 * instead of the shared `FtrackLinkageBadge`/`StatusBadge`, whose
 * "integration-ready" tone uses the same strong cyan "production fact"
 * accent used for real evidence links elsewhere. Same real
 * `source: "manual" | "ftrack"` field, same two real wordings, same
 * linked/unlinked logic -- presentation only. `FtrackLinkageBadge`
 * itself is untouched (still used, unchanged, by every other
 * consumer -- CG Version Review's Version chips among them). */
function ftrackText(
  source: NonNullable<ReviewWorkItem["shot"]>["source"],
): string {
  return source === "ftrack" ? "Linked to ftrack" : "No linked ftrack entity";
}

/** One Review work-item row (Step 7C-1 content-architecture correction;
 * Worklist archetype visual-language pass). Shared between Workspace
 * Home's Priority actions and Review Inbox -- the two pages that render
 * `ReviewWorkItem`s directly, as opposed to `InboxRow`/`ShotRow`'s
 * Shot-led rows. Locked reading order: required-action title ->
 * explanation -> supporting production context (Project, Shot, Task,
 * Version, Core Anchor state, ftrack linkage) -> next action.
 *
 * Visual-language pass: dropped the per-row `AnchorContextSummary`
 * panel (a 5-equal-column bordered box) -- it was never part of this
 * row's own documented reading order above, and it directly
 * contradicts the Worklist archetype's explicit density rules
 * (`docs/design/ICAS_DESIGN.md` §6.1 "avoid five or more equally
 * weighted columns"; `ICAS_VISUAL_LANGUAGE_V1.md` "no nested cards").
 * The same real Anchor Context remains one click away on the item's own
 * target page.
 *
 * Consistency-correction pass: dropped the per-row type icon/category
 * kicker -- Review Inbox always renders these rows grouped by that
 * exact same category (`ReviewInboxContent`'s `groupByCategory`), so
 * the type identity already lives once, at the group heading, and
 * repeating it on every row underneath added no information. The
 * `anchorContext`-derived "next action" label override is now applied
 * only for `current_focus`-sourced items -- `version_review` and
 * `escalation` items already carry their own definitively correct,
 * item-specific `actionLabel`; letting a Shot-level Anchor Context hint
 * (which can point at a *different* real concern on the same Shot)
 * override it produced a real mismatch (e.g. a "New Production Version
 * awaiting review" item showing "Review alignment" while still routing
 * to Versions). */
export function WorkItemRow({
  item,
  anchorContext,
}: {
  item: ReviewWorkItem;
  anchorContext?: AnchorContextSummaryRead | null;
}) {
  const actionLabel =
    (item.sourceType === "current_focus"
      ? anchorContext?.next_action.action_label
      : null) ??
    item.actionLabel ??
    "Review item";

  return (
    <Link href={item.route} className={styles.row}>
      <span className={styles.main}>
        <span className={styles.title}>{item.title}</span>
        <span className={styles.explanation}>{item.explanation}</span>
        <span className={styles.secondaryLine} aria-label="Production context">
          <span>{productionContextPath(item)}</span>
          {item.coreAnchorState && (
            <StatusBadge
              status={CORE_ANCHOR_BADGE_STATUS[item.coreAnchorState]}
              label={CORE_ANCHOR_ROW_LABEL[item.coreAnchorState]}
            />
          )}
          {item.shot && <span>{ftrackText(item.shot.source)}</span>}
        </span>
      </span>
      <span className={styles.open} aria-hidden="true">
        {actionLabel} →
      </span>
    </Link>
  );
}
