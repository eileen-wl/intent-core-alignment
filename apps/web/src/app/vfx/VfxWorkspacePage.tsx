import type {
  AnchorContextSummaryListRead,
  VfxInboxItemRead,
  VfxInboxRead,
} from "@intent-core/contracts";
import Link from "next/link";

import {
  AppShell,
  Breadcrumbs,
  EmptyState,
  ErrorState,
  Grid,
  PageHeader,
  SectionHeader,
  Stack,
  SummaryCard,
} from "@/design";
import { DEMO_IDENTITY_NAME, ROLE_LABEL } from "@/lib/demoIdentity";
import { ROLE_SIDEBAR_ITEMS } from "@/lib/roleNavigation";
import { InboxRow } from "./InboxRow";

const IMPORTANT_SHOT_COUNT = 3;

/** `/vfx` -- the VFX Workspace Home (Step 7C-1 content-architecture
 * correction). A production-level overview: a small, real production
 * overview, a small number of real Priority actions (work items, not
 * Shots), a compact real Core Anchor state snapshot, and a small,
 * clearly secondary Important-Shots section routing into the full Shots
 * catalogue. Never a second Shots page or a second Review Inbox --
 * Priority actions consumes the same shared `ReviewWorkItem` model
 * Review Inbox does (`features/vfx/review-inbox/workItem.ts`), Important
 * Shots is deliberately capped and Shot-led. `inbox` is `null` only when
 * the real `GET /vfx/inbox` call failed (network/API error), distinct
 * from a real empty portfolio (`items: []`). */
export function VfxWorkspacePage({
  inbox,
  anchorActions,
  onExitRole,
}: {
  inbox: VfxInboxRead | null;
  anchorActions?: AnchorContextSummaryListRead | null;
  onExitRole: () => void | Promise<void>;
}) {
  return (
    <AppShell
      name={DEMO_IDENTITY_NAME.vfx_supervisor}
      role={ROLE_LABEL.vfx_supervisor}
      onExitRole={onExitRole}
      sidebarItems={ROLE_SIDEBAR_ITEMS.vfx_supervisor}
      currentPath="/vfx"
    >
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
        <WorkspaceHomeContent
          items={inbox.items}
          anchorActions={anchorActions}
        />
      )}
    </AppShell>
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

function WorkspaceHomeContent({
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
  const summaries = anchorActions?.items ?? [];
  const itemsById = new Map(items.map((item) => [item.shot_id, item]));
  const actionShots = summaries.flatMap((summary) => {
    const item = itemsById.get(summary.shot_id);
    return item ? [{ item, summary }] : [];
  });
  const actionShotIds = new Set(actionShots.map(({ item }) => item.shot_id));

  // Important Shots: a small, clearly secondary, Shot-led section --
  // never the complete catalogue (that is `/vfx/shots`'s job).
  const importantShots = items
    .filter((item) => !actionShotIds.has(item.shot_id))
    .slice(0, IMPORTANT_SHOT_COUNT);

  return (
    <Stack gap={6}>
      <div role="region" aria-label="Anchor actions">
        <SectionHeader
          title="Anchor actions"
          description="Highest-priority human-controlled Anchor work across your Shots."
          actions={<Link href="/vfx/inbox">Go to Review Inbox →</Link>}
        />
        {actionShots.length === 0 ? (
          <EmptyState title="No immediate Anchor review actions" />
        ) : (
          <div role="list">
            {actionShots.map(({ item, summary }) => (
              <div role="listitem" key={item.shot_id}>
                <InboxRow item={item} anchorContext={summary} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div role="region" aria-label="Anchor health">
        <SectionHeader
          title="Anchor health"
          description="Scope-level authority and attention state across all Shots."
        />
        <Grid minColumnWidth="13rem" gap={4}>
          <SummaryCard label="Confirmed Core Anchors" value={confirmed} />
          <SummaryCard label="Draft / pending review" value={draftPending} />
          <SummaryCard label="No Core Anchor" value={noCoreAnchor} />
          <SummaryCard label="Medium attention" value={mediumAttention} />
          <SummaryCard label="High attention" value={highAttention} />
        </Grid>
      </div>

      <div role="region" aria-label="Important Shots">
        <SectionHeader
          title="Important Shots"
          description="A small preview -- browse the complete catalogue in Shots."
          actions={<Link href="/vfx/shots">View all Shots →</Link>}
        />
        {importantShots.length > 0 && (
          <div role="list">
            {importantShots.map((item) => (
              <div role="listitem" key={item.shot_id}>
                <InboxRow item={item} />
              </div>
            ))}
          </div>
        )}
      </div>
    </Stack>
  );
}
