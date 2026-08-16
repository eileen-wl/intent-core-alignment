import type {
  AnchorContextSummaryListRead,
  AnchorContextSummaryRead,
  VfxInboxItemRead,
  VfxInboxRead,
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
import styles from "./VfxWorkspacePage.module.css";

const SECONDARY_FOCUS_COUNT = 2;

const CORE_ANCHOR_BADGE_STATUS: Record<
  VfxInboxItemRead["core_anchor_state"],
  StatusBadgeStatus
> = {
  confirmed: "confirmed",
  draft_pending: "attention",
  none: "unavailable",
};

/** Home-local badge wording, deliberately distinct from
 * `vfxWording.ts`'s shared `coreAnchorStateLabel` (used elsewhere for a
 * standalone Core Anchor state column that already has its own
 * unambiguous context). Sitting directly beside a Shot's focus reason,
 * a bare "Confirmed" badge could read as describing the whole focus
 * item rather than specifically the Core Anchor -- mirrors the same
 * disambiguation `WorkItemRow`'s `CORE_ANCHOR_ROW_LABEL` already
 * applies on Review Inbox rows for the identical reason. */
const CORE_ANCHOR_FOCUS_BADGE_LABEL: Record<
  VfxInboxItemRead["core_anchor_state"],
  string
> = {
  confirmed: "Core Anchor confirmed",
  draft_pending: "Core Anchor draft pending",
  none: "No Core Anchor",
};

/** Short, state-only phrasing for the Secondary signal line -- keyed by
 * the Shot's own `current_focus.focus_type` (the real reason it made
 * the priority list), not `next_action.title`/`action_label`, which is
 * written as an imperative instruction ("Review Core Anchor revision")
 * appropriate for a Human action link, not a compact status signal. */
const FOCUS_TYPE_SIGNAL_LABEL: Partial<
  Record<VfxInboxItemRead["current_focus"]["focus_type"], string>
> = {
  core_anchor_gate_pending: "Core Anchor draft pending",
  core_anchor_draft_needs_review: "Core Anchor draft in progress",
  alignment_not_followed_by_anchor_action: "Assessment needs interpretation",
  re_anchor_proposal_present: "Re-anchor proposal available",
  assessment_generation_available: "New assessment available",
};

/** `current_focus.focus_type` is `"none"` for many Shots that still
 * have a real, honest reason to be in the priority list (e.g. no
 * Core Anchor exists yet) -- falls back to the Shot's own real Core
 * Anchor state rather than claiming a false "No open signal", and
 * only falls back to genuinely neutral wording when nothing more
 * specific is known (a confirmed Core Anchor with no active focus
 * type -- the priority list itself is the only real signal left). */
function secondarySignalLabel(item: VfxInboxItemRead): string {
  const focusLabel = FOCUS_TYPE_SIGNAL_LABEL[item.current_focus.focus_type];
  if (focusLabel) return focusLabel;
  if (item.core_anchor_state === "none") return "Core Anchor missing";
  if (item.core_anchor_state === "draft_pending")
    return "Core Anchor draft pending";
  return "Other creative focus";
}

/** `/vfx` -- the VFX Workspace Home (Workspace / Orientation Archetype,
 * `ICAS_DESIGN.md` §6.2; content model per
 * `ICAS_WORKSPACE_HOME_RESPONSIBILITY_AUDIT.md` §7/§15). Answers "is
 * creative direction broadly stable, and where does it need me first" --
 * never a second Review Inbox or a second Shots catalogue. Content
 * ceiling: exactly one Primary Focus Shot, up to two lighter Secondary
 * attention Shots, everything else expressed as an aggregate count or a
 * route. Priority ordering reuses the same real, backend-priority-
 * ordered `anchorActions` feed the previous "Anchor actions" section
 * already consumed -- no new ranking logic, no new data source.
 * `inbox` is `null` only when the real `GET /vfx/inbox` call failed
 * (network/API error), distinct from a real empty portfolio
 * (`items: []`). */
export function VfxWorkspacePage({
  inbox,
  anchorActions,
}: {
  inbox: VfxInboxRead | null;
  anchorActions?: AnchorContextSummaryListRead | null;
}) {
  return (
    <>
      <Breadcrumbs items={[{ label: "Workspace Home" }]} />
      <PageHeader
        title="Workspace Home"
        description={`${ROLE_LABEL.vfx_supervisor} · your production overview and priorities.`}
      />

      {inbox === null ? (
        <ErrorState
          title="Workspace Home is unavailable"
          description="The ICAS service could not be reached. Try refreshing the page."
        />
      ) : inbox.items.length === 0 ? (
        <EmptyState
          title="No Shots exist yet"
          description="Shots will appear here once they exist."
        />
      ) : (
        <VfxHomeContent items={inbox.items} anchorActions={anchorActions} />
      )}
    </>
  );
}

function countByAttentionLevel(
  items: VfxInboxItemRead[],
  level: VfxInboxItemRead["latest_signal_attention_level"],
): number {
  return items.filter((item) => item.latest_signal_attention_level === level)
    .length;
}

function countByCoreAnchorState(
  items: VfxInboxItemRead[],
  state: VfxInboxItemRead["core_anchor_state"],
): number {
  return items.filter((item) => item.core_anchor_state === state).length;
}

/** Creative-direction coverage, the headline fact for VFX's health
 * overview -- how much of the current scope already has a confirmed
 * Core Anchor, not just a bare "N need attention" count. */
function directionCoverageHeadline(
  confirmed: number,
  draftPending: number,
  noCoreAnchor: number,
  total: number,
): string {
  if (confirmed === total) {
    return `All ${total} Shot${total === 1 ? "" : "s"} have confirmed creative direction.`;
  }
  const gaps: string[] = [];
  if (draftPending > 0) {
    gaps.push(`${draftPending} draft`);
  }
  if (noCoreAnchor > 0) {
    gaps.push(
      `${noCoreAnchor} ${noCoreAnchor === 1 ? "does" : "do"} not yet have a Core Anchor`,
    );
  }
  return `${confirmed} of ${total} Shots have confirmed creative direction (${gaps.join(", ")}).`;
}

/** Signal-attention distribution, the supporting fact -- a genuinely
 * different axis from the coverage headline above (Intent Signal
 * attention, not Core Anchor lifecycle state). */
function attentionDistributionLine(medium: number, high: number): string {
  if (medium + high === 0) {
    return "No Shots currently show elevated creative attention.";
  }
  const parts: string[] = [];
  if (high > 0) {
    parts.push(`${high} at high attention`);
  }
  if (medium > 0) {
    parts.push(`${medium} at medium attention`);
  }
  return `${parts.join(", ")}.`;
}

function VfxHomeContent({
  items,
  anchorActions,
}: {
  items: VfxInboxItemRead[];
  anchorActions?: AnchorContextSummaryListRead | null;
}) {
  const noCoreAnchor = countByCoreAnchorState(items, "none");
  const confirmed = countByCoreAnchorState(items, "confirmed");
  const draftPending = countByCoreAnchorState(items, "draft_pending");
  const mediumAttention = countByAttentionLevel(items, "medium");
  const highAttention = countByAttentionLevel(items, "high");

  // Reuses the same real, backend-priority-ordered `anchorActions` feed
  // the prior "Anchor actions" section already consumed (already
  // limited/ordered server-side) -- Primary Focus is simply its first
  // entry, Secondary attention its next two. No new ranking logic.
  const itemsById = new Map(items.map((item) => [item.shot_id, item]));
  const priorityShots = (anchorActions?.items ?? []).flatMap((summary) => {
    const item = itemsById.get(summary.shot_id);
    return item ? [{ item, summary }] : [];
  });
  const primary = priorityShots[0];
  const secondary = priorityShots.slice(1, 1 + SECONDARY_FOCUS_COUNT);

  return (
    <Stack gap={6}>
      <div role="region" aria-label="Creative direction health">
        <p className={styles.healthHeadline}>
          {directionCoverageHeadline(
            confirmed,
            draftPending,
            noCoreAnchor,
            items.length,
          )}
        </p>
        <p className={styles.healthDetail}>
          {attentionDistributionLine(mediumAttention, highAttention)}
        </p>
      </div>

      <div role="region" aria-label="Primary focus">
        <SectionHeader
          title="Primary focus"
          description="The Shot most in need of your creative review right now."
        />
        {primary ? (
          <PrimaryFocus item={primary.item} summary={primary.summary} />
        ) : (
          <EmptyState title="Nothing needs your creative attention right now" />
        )}
      </div>

      {secondary.length > 0 && (
        <div role="region" aria-label="Also worth a look">
          <SectionHeader
            title="Also worth a look"
            description="A small number of other Shots also in your current priority queue."
          />
          <div role="list" className={styles.secondaryList}>
            {secondary.map(({ item, summary }) => (
              <div role="listitem" key={item.shot_id}>
                <SecondaryFocus item={item} summary={summary} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div role="region" aria-label="Scope overview">
        <SectionHeader
          title="Scope overview"
          description="Core Anchor and attention state across all Shots in your scope."
          actions={
            <span className={styles.scopeRoutes}>
              <Link href="/vfx/inbox">Go to Review Inbox →</Link>
              <Link href="/vfx/shots">View all Shots →</Link>
            </span>
          }
        />
        <Grid minColumnWidth="13rem" gap={4}>
          <SummaryCard label="Confirmed Core Anchors" value={confirmed} />
          <SummaryCard
            label="Shots needing attention"
            value={mediumAttention + highAttention}
          />
        </Grid>
        <SupportingMetrics
          items={[
            { label: "Draft / pending review", value: draftPending },
            { label: "No Core Anchor", value: noCoreAnchor },
            { label: "Medium attention", value: mediumAttention },
            { label: "High attention", value: highAttention },
          ]}
        />
      </div>
    </Stack>
  );
}

function focusRoute(item: VfxInboxItemRead, summary: AnchorContextSummaryRead) {
  return summary.next_action.target_route ?? `/vfx/shots/${item.shot_id}`;
}

function PrimaryFocus({
  item,
  summary,
}: {
  item: VfxInboxItemRead;
  summary: AnchorContextSummaryRead;
}) {
  return (
    <Link href={focusRoute(item, summary)} className={styles.primaryFocus}>
      <span className={styles.primaryFocusIdentity}>
        {item.shot_name} · {item.project_name}
      </span>
      <span className={styles.primaryFocusReason}>
        {summary.next_action.title}
      </span>
      <span className={styles.primaryFocusMeta}>
        <StatusBadge
          status={CORE_ANCHOR_BADGE_STATUS[item.core_anchor_state]}
          label={CORE_ANCHOR_FOCUS_BADGE_LABEL[item.core_anchor_state]}
        />
        <span className={styles.primaryFocusAction} aria-hidden="true">
          {summary.next_action.action_label ?? "Open Shot"} →
        </span>
      </span>
    </Link>
  );
}

function SecondaryFocus({
  item,
  summary,
}: {
  item: VfxInboxItemRead;
  summary: AnchorContextSummaryRead;
}) {
  return (
    <Link href={focusRoute(item, summary)} className={styles.secondaryFocus}>
      <span className={styles.secondaryFocusIdentity}>{item.shot_name}</span>
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
