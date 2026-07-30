import type { VfxInboxRead } from "@intent-core/contracts";

import { AppShell, Breadcrumbs, EmptyState, ErrorState, PageHeader } from "@/design";
import { DEMO_IDENTITY_NAME, ROLE_LABEL } from "@/lib/demoIdentity";
import { ROLE_SIDEBAR_ITEMS } from "@/lib/roleNavigation";
import { InboxRow } from "./InboxRow";

/** `/vfx` -- the real Alignment Inbox (Step 7C-1;
 * docs/step-7/16_STEP_7C0D_...md §5). List/table work surface, not a
 * dashboard: page heading, an honest scope line (real row count, never
 * fabricated), then restrained list rows -- no card grid, no summary
 * metric tiles, no notification tray. `inbox` is `null` only when the
 * real `GET /vfx/inbox` call failed (network/API error), distinct from
 * a real empty Inbox (`items: []`), so the two render differently. */
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
      <Breadcrumbs items={[{ label: "Alignment Inbox" }]} />
      <PageHeader
        title="Alignment Inbox"
        description="Where VFX Supervisor attention surfaces across your Shots."
      />

      {inbox === null ? (
        <ErrorState
          title="The Alignment Inbox is unavailable"
          description="The ICAS service could not be reached. Try refreshing the page."
        />
      ) : inbox.items.length === 0 ? (
        <EmptyState title="No Shots currently need your attention" />
      ) : (
        <>
          <p>Showing {inbox.items.length} Shots</p>
          <div role="list">
            {inbox.items.map((item) => (
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
