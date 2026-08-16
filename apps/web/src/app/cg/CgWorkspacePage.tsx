import type {
  AnchorContextSummaryListRead,
  AnchorContextSummaryRead,
  CgInboxItemRead,
  CgInboxRead,
} from "@intent-core/contracts";
import Link from "next/link";

import {
  Breadcrumbs,
  EmptyState,
  ErrorState,
  Grid,
  PageHeader,
  SectionHeader,
  Stack,
  StatusBadge,
  type StatusBadgeStatus,
  SummaryCard,
} from "@/design";
import { ROLE_LABEL } from "@/lib/demoIdentity";
import styles from "./CgWorkspacePage.module.css";

const SECONDARY_FOCUS_COUNT = 2;

const EXECUTION_ANCHOR_BADGE_STATUS: Record<
  CgInboxItemRead["execution_anchor_state"],
  StatusBadgeStatus
> = {
  confirmed: "confirmed",
  draft_pending: "attention",
  none: "unavailable",
};

/** Home-local badge wording, deliberately distinct from
 * `cgWording.ts`'s shared `executionAnchorStateLabel` (used elsewhere
 * for a standalone Execution Anchor state column that already has its
 * own unambiguous context). Sitting directly beside a Task's focus
 * reason, a bare "Confirmed" badge could read as describing the whole
 * focus item rather than specifically the Execution Anchor -- mirrors
 * the same disambiguation `CgTaskWorkItemRow`'s
 * `EXECUTION_ANCHOR_ROW_LABEL` already applies on Review Inbox rows
 * for the identical reason. */
const EXECUTION_ANCHOR_FOCUS_BADGE_LABEL: Record<
  CgInboxItemRead["execution_anchor_state"],
  string
> = {
  confirmed: "Execution Anchor confirmed",
  draft_pending: "Execution Anchor draft pending",
  none: "No Execution Anchor",
};

/** Short, state-only phrasing for the Secondary signal line -- keyed by
 * the Task's own `current_focus.focus_type` (the real reason it made
 * the priority list), not `next_action.title`/`action_label`, which is
 * written as an imperative instruction ("Review dependencies")
 * appropriate for a Human action link, not a compact status signal. */
const FOCUS_TYPE_SIGNAL_LABEL: Partial<
  Record<CgInboxItemRead["current_focus"]["focus_type"], string>
> = {
  execution_anchor_gate_pending: "Execution Anchor draft pending",
  execution_anchor_draft_needs_review: "Execution Anchor draft in progress",
  dependency_needs_attention: "Open dependency",
  version_review_available: "Version ready for review",
};

/** `current_focus.focus_type` is `"none"` for many Tasks that still
 * have a real, honest reason to be in the priority list (e.g. no
 * Execution Anchor exists yet) -- falls back to the Task's own real
 * Execution Anchor state rather than claiming a false "No open
 * signal", and only falls back to genuinely neutral wording when
 * nothing more specific is known (a confirmed Execution Anchor with
 * no active focus type -- the priority list itself is the only real
 * signal left). */
function secondarySignalLabel(item: CgInboxItemRead): string {
  const focusLabel = FOCUS_TYPE_SIGNAL_LABEL[item.current_focus.focus_type];
  if (focusLabel) return focusLabel;
  if (item.execution_anchor_state === "none") return "Execution Anchor missing";
  if (item.execution_anchor_state === "draft_pending")
    return "Execution Anchor draft pending";
  return "Other execution focus";
}

/** `/cg` -- the CG Workspace Home (Workspace / Orientation Archetype,
 * `ICAS_DESIGN.md` §6.2; content model per
 * `ICAS_WORKSPACE_HOME_RESPONSIBILITY_AUDIT.md` §8/§15). Answers "is
 * execution broadly ready, and what's most blocked or risky right
 * now" -- never a second Review Inbox or a second Tasks catalogue.
 * Content ceiling: exactly one Primary Technical Focus Task, up to two
 * lighter secondary risk/blocker Tasks, everything else expressed as
 * an aggregate count or a route. Priority ordering reuses the same
 * real, backend-priority-ordered `anchorActions` feed the previous
 * "Execution Anchor actions" section already consumed -- no new
 * ranking logic, no new data source. `inbox` is `null` only when the
 * real `GET /cg/inbox` call failed, distinct from a real empty
 * portfolio. */
export function CgWorkspacePage({
  inbox,
  anchorActions,
}: {
  inbox: CgInboxRead | null;
  anchorActions?: AnchorContextSummaryListRead | null;
}) {
  return (
    <>
      <Breadcrumbs items={[{ label: "Workspace Home" }]} />
      <PageHeader
        title="Workspace Home"
        description={`${ROLE_LABEL.cg_supervisor} · your production overview and priorities.`}
      />

      {inbox === null ? (
        <ErrorState
          title="Workspace Home is unavailable"
          description="The ICAS service could not be reached. Try refreshing the page."
        />
      ) : inbox.items.length === 0 ? (
        <EmptyState
          title="No Tasks exist yet"
          description="Tasks will appear here once they exist."
        />
      ) : (
        <CgHomeContent items={inbox.items} anchorActions={anchorActions} />
      )}
    </>
  );
}

/** Execution-direction coverage, the headline fact for CG's readiness
 * overview -- how much of the current scope already has a confirmed
 * Execution Anchor, not just a bare "N need attention" count. */
function executionCoverageHeadline(
  confirmed: number,
  awaiting: number,
  missing: number,
  total: number,
): string {
  if (confirmed === total) {
    return `All ${total} Task${total === 1 ? "" : "s"} have confirmed execution direction.`;
  }
  const gaps: string[] = [];
  if (awaiting > 0) {
    gaps.push(`${awaiting} awaiting confirmation`);
  }
  if (missing > 0) {
    gaps.push(`${missing} missing execution direction`);
  }
  return `${confirmed} of ${total} Tasks have confirmed execution direction (${gaps.join(", ")}).`;
}

/** Dependency-driven production pressure, the supporting fact -- a
 * genuinely different axis from the coverage headline above (open
 * TaskDependency records, not Execution Anchor lifecycle state). */
function dependencyPressureLine(tasksWithDependencies: number): string {
  if (tasksWithDependencies === 0) {
    return "No Tasks are currently blocked by open dependencies.";
  }
  return `${tasksWithDependencies} Task${tasksWithDependencies === 1 ? " is" : "s are"} blocked by open dependencies.`;
}

function CgHomeContent({
  items,
  anchorActions,
}: {
  items: CgInboxItemRead[];
  anchorActions?: AnchorContextSummaryListRead | null;
}) {
  const confirmedExecutionAnchors = items.filter(
    (item) => item.execution_anchor_state === "confirmed",
  ).length;
  const executionAwaitingAction = items.filter(
    (item) => item.execution_anchor_state === "draft_pending",
  ).length;
  const missingExecutionAnchors = items.filter(
    (item) => item.execution_anchor_state === "none",
  ).length;
  const versionReviewsRequiringAction = items.filter(
    (item) => item.current_focus.focus_type === "version_review_available",
  ).length;
  const tasksWithDependencies = items.filter(
    (item) => item.open_dependency_count > 0,
  ).length;

  // Reuses the same real, backend-priority-ordered `anchorActions` feed
  // the prior "Execution Anchor actions" section already consumed --
  // Primary Technical Focus is simply its first entry, secondary
  // risk/blocker signals its next two. No new ranking logic.
  const itemsById = new Map(items.map((item) => [item.task_id, item]));
  const priorityTasks = (anchorActions?.items ?? []).flatMap((summary) => {
    const item = summary.task_id ? itemsById.get(summary.task_id) : undefined;
    return item ? [{ item, summary }] : [];
  });
  const primary = priorityTasks[0];
  const secondary = priorityTasks.slice(1, 1 + SECONDARY_FOCUS_COUNT);

  return (
    <Stack gap={6}>
      <div role="region" aria-label="Execution readiness">
        <p className={styles.healthHeadline}>
          {executionCoverageHeadline(
            confirmedExecutionAnchors,
            executionAwaitingAction,
            missingExecutionAnchors,
            items.length,
          )}
        </p>
        <p className={styles.healthDetail}>
          {dependencyPressureLine(tasksWithDependencies)}
        </p>
      </div>

      <div role="region" aria-label="Primary technical focus">
        <SectionHeader
          title="Primary technical focus"
          description="The Task most in need of a technical decision right now."
        />
        {primary ? (
          <PrimaryFocus item={primary.item} summary={primary.summary} />
        ) : (
          <EmptyState title="Nothing needs a technical decision right now" />
        )}
      </div>

      {secondary.length > 0 && (
        <div role="region" aria-label="Also at risk">
          <SectionHeader
            title="Also at risk"
            description="A small number of other Tasks also in your current priority queue."
          />
          <div role="list" className={styles.secondaryList}>
            {secondary.map(({ item, summary }) => (
              <div role="listitem" key={item.task_id}>
                <SecondaryFocus item={item} summary={summary} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div role="region" aria-label="Scope overview">
        <SectionHeader
          title="Scope overview"
          description="Execution Anchor and dependency state across all Tasks in your scope."
          actions={
            <span className={styles.scopeRoutes}>
              <Link href="/cg/inbox">Go to Review Inbox →</Link>
              <Link href="/cg/tasks">View all Tasks →</Link>
            </span>
          }
        />
        <Grid minColumnWidth="13rem" gap={4}>
          <SummaryCard
            label="Confirmed Execution Anchors"
            value={confirmedExecutionAnchors}
          />
          <SummaryCard
            label="Missing Execution Anchors"
            value={missingExecutionAnchors}
          />
          <SummaryCard
            label="Tasks with open Dependencies"
            value={tasksWithDependencies}
          />
        </Grid>
        <SupportingMetrics
          items={[
            { label: "Awaiting Anchor action", value: executionAwaitingAction },
            {
              label: "Ready for Version review",
              value: versionReviewsRequiringAction,
            },
          ]}
        />
      </div>
    </Stack>
  );
}

function focusRoute(item: CgInboxItemRead, summary: AnchorContextSummaryRead) {
  return summary.next_action.target_route ?? `/cg/tasks/${item.task_id}`;
}

function PrimaryFocus({
  item,
  summary,
}: {
  item: CgInboxItemRead;
  summary: AnchorContextSummaryRead;
}) {
  return (
    <Link href={focusRoute(item, summary)} className={styles.primaryFocus}>
      <span className={styles.primaryFocusIdentity}>
        {item.task_name} · {item.shot_name}
      </span>
      <span className={styles.primaryFocusReason}>
        {summary.next_action.title}
      </span>
      <span className={styles.primaryFocusMeta}>
        <StatusBadge
          status={EXECUTION_ANCHOR_BADGE_STATUS[item.execution_anchor_state]}
          label={
            EXECUTION_ANCHOR_FOCUS_BADGE_LABEL[item.execution_anchor_state]
          }
        />
        <span className={styles.primaryFocusAction} aria-hidden="true">
          {summary.next_action.action_label ?? "Open Task"} →
        </span>
      </span>
    </Link>
  );
}

function SecondaryFocus({
  item,
  summary,
}: {
  item: CgInboxItemRead;
  summary: AnchorContextSummaryRead;
}) {
  return (
    <Link href={focusRoute(item, summary)} className={styles.secondaryFocus}>
      <span className={styles.secondaryFocusIdentity}>{item.task_name}</span>
      <span className={styles.secondaryFocusSignal}>
        {secondarySignalLabel(item)}
      </span>
    </Link>
  );
}

function SupportingMetrics({
  items,
}: {
  items: { label: string; value: number }[];
}) {
  return (
    <div className={styles.supportingMetrics}>
      {items.map(({ label, value }) => (
        <span key={label} className={styles.supportingMetric}>
          <span className={styles.supportingMetricValue}>{value}</span> {label}
        </span>
      ))}
    </div>
  );
}
