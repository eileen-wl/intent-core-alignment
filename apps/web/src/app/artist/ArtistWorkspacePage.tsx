import type {
  AnchorContextSummaryListRead,
  AnchorContextSummaryRead,
  ArtistInboxItemRead,
  ArtistInboxRead,
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
  SummaryCard,
} from "@/design";
import { conciseDirection } from "@/design/semantic/anchor-context/presentation";
import { ROLE_LABEL } from "@/lib/demoIdentity";
import styles from "./ArtistWorkspacePage.module.css";

/** Reduces a real Core/Execution Anchor direction string to the
 * shortest faithful Home-level summary: `conciseDirection` first
 * strips any verified generator/source label (e.g. "[CG Agent
 * execution anchor draft -- deterministic placeholder, review
 * required]") the same way `AnchorContextLayer` already does
 * everywhere else this field is shown, then this keeps only the
 * direction's own first complete clause -- both `core_direction` and
 * `execution_direction` are written as one direction sentence
 * optionally followed by a longer supporting explanation (e.g.
 * "Preserve the combined-intensity ceiling. Stronger bloom, brighter
 * particles... locally defensible refinements..."), and that longer
 * explanation is exactly the Task Workspace's own job (Anchor Context
 * panel, Task Overview), not Home's. Stripping a label that sat
 * directly before the direction's own trailing period can otherwise
 * leave an orphaned `" ."` behind (`.replace` below removes any
 * leftover whitespace immediately before a punctuation mark). */
function homeDirectionSummary(value: string | null | undefined): string | null {
  const direction = conciseDirection(value);
  if (!direction) return null;
  const [firstClause] = direction.match(/[^.!?]+[.!?]*/g) ?? [direction];
  return (firstClause ?? direction).replace(/\s+([.!?,;:])/g, "$1").trim();
}

const SECONDARY_FOCUS_COUNT = 2;

/** Short, state-only phrasing for the Up Next signal line -- keyed by
 * the Task's own `current_focus.focus_type` (the real reason it's
 * ready), not `next_action.title`/`action_label`, which is written as
 * an imperative instruction ("Continue within current Guidance")
 * appropriate for a Human action link, not a compact status signal. */
const FOCUS_TYPE_SIGNAL_LABEL: Partial<
  Record<ArtistInboxItemRead["current_focus"]["focus_type"], string>
> = {
  guidance_outdated: "Guidance outdated",
  review_note_needs_response: "Feedback awaiting response",
  dependency_needs_attention: "Open dependency",
  guidance_available: "Guidance available",
};

/** `current_focus.focus_type` is `"none"` for many ready Tasks that
 * still have a real, honest reason to be in Up Next -- they're part
 * of the same real, backend-priority-ordered ready-Task queue Current
 * Work's own primary Task comes from, so that readiness is the real
 * signal, not a false "No open signal". */
function secondarySignalLabel(item: ArtistInboxItemRead): string {
  const focusLabel = FOCUS_TYPE_SIGNAL_LABEL[item.current_focus.focus_type];
  if (focusLabel) return focusLabel;
  return "Ready to work";
}

/** `/artist` -- the Artist Workspace Home (Workspace / Orientation
 * Archetype, `ICAS_DESIGN.md` §6.2; content model per
 * `ICAS_WORKSPACE_HOME_RESPONSIBILITY_AUDIT.md` §9/§15). Answers "what
 * should I work on now" -- never a second Review Inbox or a second
 * Tasks catalogue, and deliberately not a copy of the VFX/CG
 * supervisor dashboard shape. Content ceiling: exactly one Current
 * Work Task, up to two lighter Up Next Tasks, everything else
 * expressed as an aggregate count or a route. Ready-Task priority
 * ordering reuses the same real, backend-priority-ordered `readyTasks`
 * feed the previous "Ready to work" section already consumed (single-
 * Task and multi-Task cases now share this one presentation, not two
 * unrelated layouts); Waiting Tasks are never individually enumerated,
 * only counted. `inbox` is `null` only when the real `GET
 * /artist/inbox` call failed, distinct from a real empty portfolio. */
export function ArtistWorkspacePage({
  inbox,
  readyTasks,
  waitingTasks,
}: {
  inbox: ArtistInboxRead | null;
  readyTasks?: AnchorContextSummaryListRead | null;
  waitingTasks?: AnchorContextSummaryListRead | null;
}) {
  return (
    <>
      <Breadcrumbs items={[{ label: "Workspace Home" }]} />
      <PageHeader
        title="Workspace Home"
        description={`${ROLE_LABEL.artist} · what is assigned to you and what to work on next.`}
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
        <ArtistHomeContent
          items={inbox.items}
          readyTasks={readyTasks}
          waitingTasks={waitingTasks}
        />
      )}
    </>
  );
}

function ArtistHomeContent({
  items,
  readyTasks,
  waitingTasks,
}: {
  items: ArtistInboxItemRead[];
  readyTasks?: AnchorContextSummaryListRead | null;
  waitingTasks?: AnchorContextSummaryListRead | null;
}) {
  const newOrUpdatedGuidance = items.filter((item) =>
    ["guidance_outdated", "guidance_available"].includes(
      item.current_focus.focus_type,
    ),
  ).length;
  const feedbackRequiringResponse = items.filter(
    (item) => item.current_focus.focus_type === "review_note_needs_response",
  ).length;
  const blockedTasks = items.filter(
    (item) => item.open_dependency_count > 0,
  ).length;
  const readyCount = readyTasks?.total_count ?? 0;
  const waitingCount = waitingTasks?.total_count ?? 0;

  // Reuses the same real, backend-priority-ordered `readyTasks` feed
  // the prior "Ready to work" section already consumed -- Current Work
  // is simply its first entry, Up Next its next two. The single-ready
  // and multi-ready cases now share this one presentation.
  const itemsById = new Map(items.map((item) => [item.task_id, item]));
  const readyEntries = (readyTasks?.items ?? []).flatMap((summary) => {
    const item = summary.task_id ? itemsById.get(summary.task_id) : undefined;
    return item ? [{ item, summary }] : [];
  });
  const primary = readyEntries[0];
  const secondary = readyEntries.slice(1, 1 + SECONDARY_FOCUS_COUNT);

  return (
    <Stack gap={6}>
      <p className={styles.pulse}>
        {readyCount === 0
          ? "Nothing is ready for you to work on right now."
          : `${readyCount} Task${readyCount === 1 ? " is" : "s are"} ready for you to work on.`}
      </p>

      <div role="region" aria-label="Current work">
        <SectionHeader
          title="Current work"
          description="The Task to work on right now, and why."
        />
        {primary ? (
          <CurrentWork item={primary.item} summary={primary.summary} />
        ) : (
          <EmptyState title="Nothing is ready to work on right now" />
        )}
      </div>

      {secondary.length > 0 && (
        <div role="region" aria-label="Up next">
          <SectionHeader
            title="Up next"
            description="A small number of other Tasks that are also ready."
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

      <div role="region" aria-label="Work state">
        <SectionHeader
          title="Work state"
          description="Readiness and guidance state across your Tasks."
          actions={
            <span className={styles.scopeRoutes}>
              <Link href="/artist/inbox">Go to Review Inbox →</Link>
              <Link href="/artist/tasks">View all Tasks →</Link>
            </span>
          }
        />
        <Grid minColumnWidth="13rem" gap={4}>
          <SummaryCard label="Ready to work" value={readyCount} />
          <SummaryCard label="Waiting upstream" value={waitingCount} />
        </Grid>
        <SupportingMetrics
          items={[
            { label: "New or updated guidance", value: newOrUpdatedGuidance },
            {
              label: "Feedback requiring response",
              value: feedbackRequiringResponse,
            },
            { label: "Blocked Tasks", value: blockedTasks },
          ]}
        />
      </div>
    </Stack>
  );
}

function focusRoute(
  item: ArtistInboxItemRead,
  summary: AnchorContextSummaryRead,
) {
  return summary.next_action.target_route ?? `/artist/tasks/${item.task_id}`;
}

function CurrentWork({
  item,
  summary,
}: {
  item: ArtistInboxItemRead;
  summary: AnchorContextSummaryRead;
}) {
  return (
    <Link href={focusRoute(item, summary)} className={styles.currentWork}>
      <span className={styles.currentWorkIdentity}>
        {item.task_name} · {item.shot_name}
      </span>
      <span className={styles.currentWorkClause}>
        <span className={styles.currentWorkLabel}>Why —</span>{" "}
        {homeDirectionSummary(summary.core_direction) ??
          "Confirmed Core direction is unavailable."}
      </span>
      <span className={styles.currentWorkClause}>
        <span className={styles.currentWorkLabel}>How —</span>{" "}
        {homeDirectionSummary(summary.execution_direction) ??
          "Confirmed execution direction is unavailable."}
      </span>
      <span className={styles.currentWorkNextAction}>
        <span className={styles.currentWorkLabel}>What to do now —</span>{" "}
        {summary.next_action.title}
      </span>
      <span className={styles.currentWorkAction} aria-hidden="true">
        {summary.next_action.action_label ?? "Open Task"} →
      </span>
    </Link>
  );
}

function SecondaryFocus({
  item,
  summary,
}: {
  item: ArtistInboxItemRead;
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
