import type { VfxInboxItemRead, VfxInboxRead } from "@intent-core/contracts";
import Link from "next/link";

import {
  AppShell,
  Breadcrumbs,
  EmptyState,
  ErrorState,
  Grid,
  PageHeader,
  Row,
  SectionHeader,
  Stack,
  StatusBadge,
  SummaryCard,
} from "@/design";
import { DEMO_IDENTITY_NAME, ROLE_LABEL } from "@/lib/demoIdentity";
import { ROLE_SIDEBAR_ITEMS } from "@/lib/roleNavigation";
import { adaptCurrentFocusToWorkItems } from "@/features/vfx/review-inbox/workItem";
import { InboxRow } from "./InboxRow";
import { WorkItemRow } from "./WorkItemRow";

const PRIORITY_ACTION_COUNT = 3;
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
  onExitRole,
}: {
  inbox: VfxInboxRead | null;
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
        <WorkspaceHomeContent items={inbox.items} />
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

function WorkspaceHomeContent({ items }: { items: VfxInboxItemRead[] }) {
  const totalShots = items.length;
  const requiringAttention = items.filter(
    (item) => item.current_focus.actionable,
  ).length;
  const humanReviewRequired = countByAttentionLevel(items, "high");
  const noCoreAnchor = countByCoreAnchorState(items, "none");
  const confirmed = countByCoreAnchorState(items, "confirmed");
  const draftPending = countByCoreAnchorState(items, "draft_pending");

  // Priority actions: the shared Review work-item model, not a
  // Shot-led list -- `items` already arrives sorted by the backend's
  // real priority ordering (`sort_rank`), and the adapter preserves
  // that order, so the first N *are* the highest-priority work.
  const priorityActions = adaptCurrentFocusToWorkItems(items).slice(
    0,
    PRIORITY_ACTION_COUNT,
  );

  // Important Shots: a small, clearly secondary, Shot-led section --
  // never the complete catalogue (that is `/vfx/shots`'s job).
  const importantShots = items.slice(0, IMPORTANT_SHOT_COUNT);

  return (
    <Stack gap={6}>
      <Grid
        minColumnWidth="13rem"
        gap={4}
        role="region"
        aria-label="Production overview"
      >
        <SummaryCard label="Total Shots" value={totalShots} />
        <SummaryCard
          label="Requiring attention"
          value={requiringAttention}
          description="Shots with an actionable Current focus"
        />
        <SummaryCard
          label="Human review required"
          value={humanReviewRequired}
        />
        <SummaryCard label="No Core Anchor" value={noCoreAnchor} />
      </Grid>

      <div role="region" aria-label="Priority actions">
        <SectionHeader
          title="Priority actions"
          description="The work that most needs your review, interpretation, or confirmation."
          actions={<Link href="/vfx/inbox">Go to Review Inbox →</Link>}
        />
        {priorityActions.length === 0 ? (
          <EmptyState title="No priority actions require your attention" />
        ) : (
          <div role="list">
            {priorityActions.map((item) => (
              <div role="listitem" key={item.id}>
                <WorkItemRow item={item} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div role="region" aria-label="Production snapshot">
        <SectionHeader
          title="Production snapshot"
          description="Core Anchor state across every Shot."
        />
        <Row gap={3}>
          <StatusBadge status="confirmed" label={`Confirmed: ${confirmed}`} />
          <StatusBadge
            status="attention"
            label={`Draft pending review: ${draftPending}`}
          />
          <StatusBadge
            status="neutral"
            label={`No Core Anchor: ${noCoreAnchor}`}
          />
        </Row>
      </div>

      <div role="region" aria-label="Important Shots">
        <SectionHeader
          title="Important Shots"
          description="A small preview -- browse the complete catalogue in Shots."
          actions={<Link href="/vfx/shots">View all Shots →</Link>}
        />
        <div role="list">
          {importantShots.map((item) => (
            <div role="listitem" key={item.shot_id}>
              <InboxRow item={item} />
            </div>
          ))}
        </div>
      </div>
    </Stack>
  );
}
