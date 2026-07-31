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
  SummaryCard,
} from "@/design";
import { DEMO_IDENTITY_NAME, ROLE_LABEL } from "@/lib/demoIdentity";
import { ROLE_SIDEBAR_ITEMS } from "@/lib/roleNavigation";
import { InboxRow } from "./InboxRow";

const MOST_IMPORTANT_SHOT_COUNT = 5;

/** `/vfx` -- the VFX Workspace Home (Step 7C-1 locked IA §7). A bounded
 * first version built only from data `fetchVfxInbox()` already
 * provides: real counts, the same priority ordering Review Inbox uses
 * (`inbox.items` already arrives sorted by `sort_rank`, so the first N
 * items *are* the most important Shots), and clear routes into Review
 * Inbox and Shots. No card grid of fabricated metrics, no "recent
 * Decisions" section (no supported read model exists for one yet),
 * and no connection/priority claim not backed by real, persisted
 * data. `inbox` is `null` only when the real `GET /vfx/inbox` call
 * failed (network/API error), distinct from a real empty portfolio
 * (`items: []`). */
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
        <EmptyState title="No Shots exist yet" description="Shots will appear here once they exist." />
      ) : (
        <WorkspaceHomeContent inbox={inbox} />
      )}
    </AppShell>
  );
}

function countByAttentionLevel(
  items: VfxInboxItemRead[],
  level: VfxInboxItemRead["latest_signal_attention_level"],
): number {
  return items.filter((item) => item.latest_signal_attention_level === level).length;
}

function WorkspaceHomeContent({ inbox }: { inbox: VfxInboxRead }) {
  const totalShots = inbox.items.length;
  const needingAttention = inbox.items.filter((item) => item.current_focus.actionable).length;
  const highAttention = countByAttentionLevel(inbox.items, "high");
  const mediumAttention = countByAttentionLevel(inbox.items, "medium");
  // `inbox.items` already arrives sorted by the backend's real priority
  // ordering (`sort_rank`) -- the same ordering Review Inbox uses -- so
  // the first N items honestly are the most important Shots, not a
  // separately re-derived ranking.
  const mostImportant = inbox.items.slice(0, MOST_IMPORTANT_SHOT_COUNT);

  return (
    <Stack gap={6}>
      <Grid minColumnWidth="13rem" gap={4}>
        <SummaryCard label="Total Shots" value={totalShots} />
        <SummaryCard
          label="Requiring attention"
          value={needingAttention}
          description="Shots with an actionable Current focus"
        />
        <SummaryCard label="Human review required" value={highAttention} />
        <SummaryCard label="Attention needed" value={mediumAttention} />
      </Grid>

      <div>
        <SectionHeader
          title="Most important Shots"
          description="The same priority ordering Review Inbox uses."
          actions={<Link href="/vfx/shots">View all Shots →</Link>}
        />
        <div role="list">
          {mostImportant.map((item) => (
            <div role="listitem" key={item.shot_id}>
              <InboxRow item={item} />
            </div>
          ))}
        </div>
      </div>

      <Row gap={4}>
        <Link href="/vfx/inbox">Go to Review Inbox →</Link>
        <Link href="/vfx/shots">Browse all Shots →</Link>
      </Row>
    </Stack>
  );
}
