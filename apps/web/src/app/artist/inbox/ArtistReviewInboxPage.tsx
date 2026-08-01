import type { ArtistInboxRead } from "@intent-core/contracts";
import Link from "next/link";

import { AppShell, Breadcrumbs, EmptyState, ErrorState, PageHeader } from "@/design";
import { DEMO_IDENTITY_NAME, ROLE_LABEL } from "@/lib/demoIdentity";
import { ROLE_SIDEBAR_ITEMS } from "@/lib/roleNavigation";
import { adaptArtistCurrentFocusToWorkItems } from "@/features/artist/reviewInbox";
import { ArtistTaskWorkItemRow } from "../ArtistTaskWorkItemRow";

/** `/artist/inbox` -- Artist Review Inbox (Step 7C-5), mirroring
 * `app/cg/inbox/CgReviewInboxPage.tsx`'s work-item-first architecture:
 * the primary information object is the required work item, not the
 * Task. Today's only real source is every actionable `current_focus`
 * (`features/artist/reviewInbox.ts`). Never a structural parent of a
 * Task -- opening an item goes straight to the real destination tab
 * (Task Overview / Current Version), and this page never appears in a
 * Task's breadcrumb. */
export function ArtistReviewInboxPage({
  inbox,
  onExitRole,
}: {
  inbox: ArtistInboxRead | null;
  onExitRole: () => void | Promise<void>;
}) {
  const workItems = inbox ? adaptArtistCurrentFocusToWorkItems(inbox.items) : null;

  return (
    <AppShell
      name={DEMO_IDENTITY_NAME.artist}
      role={ROLE_LABEL.artist}
      onExitRole={onExitRole}
      sidebarItems={ROLE_SIDEBAR_ITEMS.artist}
      currentPath="/artist/inbox"
    >
      <Breadcrumbs items={[{ label: "Review Inbox" }]} />
      <PageHeader
        title="Review Inbox"
        description="Work that requires your review, response, or acknowledgement."
      />

      {inbox === null || workItems === null ? (
        <ErrorState
          title="Review Inbox is unavailable"
          description="The ICAS service could not be reached. Try refreshing the page."
        />
      ) : workItems.length === 0 ? (
        <EmptyState
          title="Review Inbox is clear"
          description="Nothing currently requires your response."
          action={<Link href="/artist/tasks">Browse Tasks →</Link>}
        />
      ) : (
        <>
          <p>Showing {workItems.length} items requiring review</p>
          <div role="list">
            {workItems.map((item) => (
              <div role="listitem" key={item.id}>
                <ArtistTaskWorkItemRow item={item} />
              </div>
            ))}
          </div>
        </>
      )}
    </AppShell>
  );
}
