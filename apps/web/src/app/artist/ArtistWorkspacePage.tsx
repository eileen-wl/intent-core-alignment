import { AppShell, Breadcrumbs, Panel, PageHeader } from "@/design";
import { DEMO_IDENTITY_NAME, ROLE_LABEL } from "@/lib/demoIdentity";
import { ROLE_SIDEBAR_ITEMS } from "@/lib/roleNavigation";

/** `/artist` -- My Tasks homepage shell. Not the final My Tasks page:
 * workspace structure only, no fake Task, Version, or feedback data
 * (brief §8). `onExitRole` is injected as a prop so this stays
 * testable without the Next.js server runtime. */
export function ArtistWorkspacePage({
  onExitRole,
}: {
  onExitRole: () => void | Promise<void>;
}) {
  return (
    <AppShell
      name={DEMO_IDENTITY_NAME.artist}
      role={ROLE_LABEL.artist}
      onExitRole={onExitRole}
      sidebarItems={ROLE_SIDEBAR_ITEMS.artist}
      currentPath="/artist"
    >
      <Breadcrumbs items={[{ label: "My Tasks" }]} />
      <PageHeader
        title="My Tasks"
        description="Where Artist attention will surface: what to work on now, practical guidance, non-negotiables, and allowed variations."
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
