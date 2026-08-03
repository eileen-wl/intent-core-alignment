import type {
  AnchorContextRead,
  VfxInboxItemRead,
} from "@intent-core/contracts";
import type { ReactNode } from "react";

import {
  AnchorContextLayer,
  AppShell,
  Breadcrumbs,
  ContextTabs,
  ErrorState,
} from "@/design";
import { DEMO_IDENTITY_NAME, ROLE_LABEL } from "@/lib/demoIdentity";
import { ROLE_SIDEBAR_ITEMS } from "@/lib/roleNavigation";
import { ProductionContextHeader } from "../ProductionContextHeader";

export type VfxShotTab =
  "overview" | "intent" | "versions" | "alignment" | "activity";

export function VfxShotWorkspaceFrame({
  item,
  anchorContext,
  activeTab,
  unavailable = false,
  onExitRole,
  children,
}: {
  item: VfxInboxItemRead | null;
  anchorContext?: AnchorContextRead | null;
  activeTab: VfxShotTab;
  unavailable?: boolean;
  onExitRole: () => void | Promise<void>;
  children: ReactNode;
}) {
  const label =
    activeTab === "overview"
      ? "Overview"
      : activeTab[0].toUpperCase() + activeTab.slice(1);
  return (
    <AppShell
      name={DEMO_IDENTITY_NAME.vfx_supervisor}
      role={ROLE_LABEL.vfx_supervisor}
      onExitRole={onExitRole}
      sidebarItems={ROLE_SIDEBAR_ITEMS.vfx_supervisor}
      currentPath="/vfx/shots"
    >
      {!item ? (
        <>
          <Breadcrumbs
            items={[{ label: "Shots", href: "/vfx/shots" }, { label: "Shot" }]}
          />
          <ErrorState
            title={
              unavailable
                ? "This Shot is unavailable"
                : "This Shot could not be found"
            }
            description={
              unavailable
                ? "The ICAS service could not be reached. Try refreshing the page."
                : "This Shot does not exist, or its identifier is invalid."
            }
          />
        </>
      ) : (
        <>
          <Breadcrumbs
            items={[
              { label: item.project_name, href: "/vfx/shots" },
              { label: item.shot_name },
              { label },
            ]}
          />
          <ProductionContextHeader item={item} />
          <AnchorContextLayer context={anchorContext ?? null} />
          <ContextTabs
            activeTabId={activeTab}
            tabs={[
              {
                id: "overview",
                label: "Overview",
                href: `/vfx/shots/${item.shot_id}`,
              },
              {
                id: "intent",
                label: "Intent",
                href: `/vfx/shots/${item.shot_id}/intent`,
              },
              {
                id: "versions",
                label: "Versions",
                href: `/vfx/shots/${item.shot_id}/versions`,
              },
              {
                id: "alignment",
                label: "Alignment",
                href: `/vfx/shots/${item.shot_id}/alignment`,
              },
              {
                id: "activity",
                label: "Activity",
                href: `/vfx/shots/${item.shot_id}/activity`,
              },
            ]}
          />
          {children}
        </>
      )}
    </AppShell>
  );
}
