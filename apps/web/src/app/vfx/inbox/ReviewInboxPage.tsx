import type {
  AnchorContextSummaryRead,
  VfxInboxRead,
} from "@intent-core/contracts";
import Link from "next/link";

import {
  AppShell,
  Breadcrumbs,
  EmptyState,
  ErrorState,
  PageHeader,
} from "@/design";
import { DEMO_IDENTITY_NAME, ROLE_LABEL } from "@/lib/demoIdentity";
import { ROLE_SIDEBAR_ITEMS } from "@/lib/roleNavigation";
import {
  adaptCurrentFocusToWorkItems,
  adaptEscalationWorkItems,
  adaptVersionReviewWorkItems,
} from "@/features/vfx/review-inbox/workItem";
import { WorkItemRow } from "../WorkItemRow";

/** `/vfx/inbox` -- Review Inbox (Step 7C-1 content-architecture
 * correction). Work-item-first: the primary information object is the
 * required work item, not the Shot. Consumes the shared
 * `ReviewWorkItem` collection (`features/vfx/review-inbox/workItem.ts`)
 * -- the same model Workspace Home's Priority actions section uses --
 * rather than rendering raw Shot inbox rows. Today's only real source is
 * every actionable `current_focus`; Step 7C-3 adds further adapters
 * (Version/Review Note, Assessment, Proposal, conflict, escalation,
 * acknowledgement) that concatenate into the same flat collection this
 * page already renders, so this page does not need to change shape when
 * that lands. Never a structural parent of a Shot -- opening an item
 * goes straight to that Shot's own Overview or Intent page, and this
 * page never appears in a Shot's breadcrumb. `inbox` is `null` only when
 * the real `GET /vfx/inbox` call failed, distinct from a real empty
 * Inbox. */
export function ReviewInboxPage({
  inbox,
  anchorContexts = {},
  onExitRole,
}: {
  inbox: VfxInboxRead | null;
  anchorContexts?: Record<string, AnchorContextSummaryRead | null>;
  onExitRole: () => void | Promise<void>;
}) {
  const workItems = inbox
    ? [
        ...adaptCurrentFocusToWorkItems(inbox.items),
        ...adaptVersionReviewWorkItems(inbox.items),
        ...adaptEscalationWorkItems(inbox.items),
      ]
    : null;

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
        description="Work that requires your review, interpretation, confirmation, rejection, acknowledgement, or escalation."
      />

      {inbox === null || workItems === null ? (
        <ErrorState
          title="Review Inbox is unavailable"
          description="The ICAS service could not be reached. Try refreshing the page."
        />
      ) : workItems.length === 0 ? (
        <EmptyState
          title="Review Inbox is clear"
          description="No review or interpretation currently requires your attention."
          action={<Link href="/vfx/shots">Browse Shots →</Link>}
        />
      ) : (
        <>
          <p>Showing {workItems.length} items requiring review</p>
          <div role="list">
            {workItems.map((item) => (
              <div role="listitem" key={item.id}>
                <WorkItemRow
                  item={item}
                  anchorContext={
                    item.shot ? anchorContexts[item.shot.id] : null
                  }
                />
              </div>
            ))}
          </div>
        </>
      )}
    </AppShell>
  );
}
