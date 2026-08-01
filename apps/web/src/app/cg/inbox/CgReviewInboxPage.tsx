import type { CgInboxRead } from "@intent-core/contracts";
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
import { adaptCgCurrentFocusToWorkItems } from "@/features/cg/reviewInbox";
import { CgTaskWorkItemRow } from "../CgTaskWorkItemRow";

/** `/cg/inbox` -- CG Review Inbox (Step 7C-4), mirroring
 * `app/vfx/inbox/ReviewInboxPage.tsx`'s work-item-first architecture:
 * the primary information object is the required work item, not the
 * Task. Today's only real source is every actionable `current_focus`
 * (`features/cg/reviewInbox.ts`). Never a structural parent of a Task
 * -- opening an item goes straight to the real destination tab
 * (Execution / Version Review / Dependencies), and this page never
 * appears in a Task's breadcrumb. */
export function CgReviewInboxPage({
  inbox,
  onExitRole,
}: {
  inbox: CgInboxRead | null;
  onExitRole: () => void | Promise<void>;
}) {
  const workItems = inbox ? adaptCgCurrentFocusToWorkItems(inbox.items) : null;

  return (
    <AppShell
      name={DEMO_IDENTITY_NAME.cg_supervisor}
      role={ROLE_LABEL.cg_supervisor}
      onExitRole={onExitRole}
      sidebarItems={ROLE_SIDEBAR_ITEMS.cg_supervisor}
      currentPath="/cg/inbox"
    >
      <Breadcrumbs items={[{ label: "Review Inbox" }]} />
      <PageHeader
        title="Review Inbox"
        description="Work that requires your review, confirmation, or interpretation."
      />

      {inbox === null || workItems === null ? (
        <ErrorState
          title="Review Inbox is unavailable"
          description="The ICAS service could not be reached. Try refreshing the page."
        />
      ) : workItems.length === 0 ? (
        <EmptyState
          title="Review Inbox is clear"
          description="No review or confirmation currently requires your attention."
          action={<Link href="/cg/tasks">Browse Tasks →</Link>}
        />
      ) : (
        <>
          <p>Showing {workItems.length} items requiring review</p>
          <div role="list">
            {workItems.map((item) => (
              <div role="listitem" key={item.id}>
                <CgTaskWorkItemRow item={item} />
              </div>
            ))}
          </div>
        </>
      )}
    </AppShell>
  );
}
