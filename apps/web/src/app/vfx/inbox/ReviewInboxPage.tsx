import type { VfxInboxRead } from "@intent-core/contracts";

import { AppShell, Breadcrumbs, EmptyState, ErrorState, PageHeader } from "@/design";
import { DEMO_IDENTITY_NAME, ROLE_LABEL } from "@/lib/demoIdentity";
import { ROLE_SIDEBAR_ITEMS } from "@/lib/roleNavigation";
import { InboxRow } from "../InboxRow";

/** `/vfx/inbox` -- Review Inbox (Step 7C-1 locked IA §8). Actionable
 * work only: Core Anchor confirmation, HumanGate, Versions/Review Notes
 * needing review, Assessment interpretation, Proposal, escalation, and
 * acknowledgement/Decision work -- every item here has a real,
 * persisted `current_focus.actionable === true`. Reuses the same
 * focus-first `InboxRow` the former single Alignment Inbox page used;
 * the difference is the filter, not a renamed page keeping the old
 * hierarchy. Never the structural parent of a Shot -- opening an item
 * goes straight to that Shot's own Overview, and this page never
 * appears in a Shot's breadcrumb. `inbox` is `null` only when the real
 * `GET /vfx/inbox` call failed, distinct from a real empty Inbox. */
export function ReviewInboxPage({
  inbox,
  onExitRole,
}: {
  inbox: VfxInboxRead | null;
  onExitRole: () => void | Promise<void>;
}) {
  const actionableItems = inbox?.items.filter((item) => item.current_focus.actionable) ?? null;

  return (
    <AppShell
      name={DEMO_IDENTITY_NAME.vfx_supervisor}
      role={ROLE_LABEL.vfx_supervisor}
      onExitRole={onExitRole}
      sidebarItems={ROLE_SIDEBAR_ITEMS.vfx_supervisor}
      currentPath="/vfx/inbox"
    >
      <Breadcrumbs items={[{ label: "Review Inbox" }]} />
      <PageHeader
        title="Review Inbox"
        description="Actionable work that requires your review, interpretation, confirmation, rejection, acknowledgement, or escalation."
      />

      {inbox === null || actionableItems === null ? (
        <ErrorState
          title="Review Inbox is unavailable"
          description="The ICAS service could not be reached. Try refreshing the page."
        />
      ) : actionableItems.length === 0 ? (
        <EmptyState title="Nothing needs your review right now" />
      ) : (
        <>
          <p>Showing {actionableItems.length} items requiring review</p>
          <div role="list">
            {actionableItems.map((item) => (
              <div role="listitem" key={item.shot_id}>
                <InboxRow item={item} />
              </div>
            ))}
          </div>
        </>
      )}
    </AppShell>
  );
}
