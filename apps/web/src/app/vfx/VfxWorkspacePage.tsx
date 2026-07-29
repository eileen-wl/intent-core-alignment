import { AppShell, Breadcrumbs, Panel, PageHeader } from "@/design";
import { DEMO_IDENTITY_NAME, ROLE_LABEL } from "@/lib/demoIdentity";
import { ROLE_SIDEBAR_ITEMS } from "@/lib/roleNavigation";

/** `/vfx` -- Alignment Inbox homepage shell. Not the final Alignment
 * Inbox: workspace structure only, no fake Signal, Shot, or Decision
 * data (brief §8). `onExitRole` is injected as a prop so this stays
 * testable without the Next.js server runtime. */
export function VfxWorkspacePage({
  onExitRole,
}: {
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
        description="Where VFX Supervisor attention will surface: Shots needing review, cross-role tensions, and Re-anchor Proposals awaiting consideration."
      />
      <Panel tone="muted">
        <p>
          Workspace structure established. Production data and role-specific
          cards will be added in the next implementation batches.
        </p>
      </Panel>
    </AppShell>
  );
}
