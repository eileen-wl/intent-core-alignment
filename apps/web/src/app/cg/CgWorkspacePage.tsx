import { AppShell, Breadcrumbs, Panel, PageHeader } from "@/design";
import { DEMO_IDENTITY_NAME, ROLE_LABEL } from "@/lib/demoIdentity";
import { ROLE_SIDEBAR_ITEMS } from "@/lib/roleNavigation";

/** `/cg` -- Execution Inbox homepage shell. Not the final Execution
 * Inbox: workspace structure only, no fake Task, Version, or
 * Execution Anchor data (brief §8). `onExitRole` is injected as a
 * prop so this stays testable without the Next.js server runtime. */
export function CgWorkspacePage({
  onExitRole,
}: {
  onExitRole: () => void | Promise<void>;
}) {
  return (
    <AppShell
      name={DEMO_IDENTITY_NAME.cg_supervisor}
      role={ROLE_LABEL.cg_supervisor}
      onExitRole={onExitRole}
      sidebarItems={ROLE_SIDEBAR_ITEMS.cg_supervisor}
      currentPath="/cg"
    >
      <Breadcrumbs items={[{ label: "Execution Inbox" }]} />
      <PageHeader
        title="Execution Inbox"
        description="Where CG Supervisor attention will surface: Tasks needing an Execution Anchor, new Versions to review, and unresolved dependencies."
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
