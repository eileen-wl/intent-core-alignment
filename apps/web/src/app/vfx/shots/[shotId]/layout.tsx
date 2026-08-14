import { redirect } from "next/navigation";
import type {
  AnchorContextRead,
  VfxInboxItemRead,
} from "@intent-core/contracts";
import type { ReactNode } from "react";

import { Breadcrumbs, ErrorState, type ContextTab } from "@/design";
import { actorHeaders, resolveIdentity } from "@/features/session/identity";
import {
  fetchVfxAnchorContextOrNull,
  fetchVfxInboxItem,
} from "@/features/vfx/api";
import { ObjectWorkspaceChrome } from "../../../_shared/ObjectWorkspaceChrome";
import { ProductionContextHeader } from "../ProductionContextHeader";

function shotTabs(shotId: string): ContextTab[] {
  return [
    { id: "overview", label: "Overview", href: `/vfx/shots/${shotId}` },
    { id: "intent", label: "Intent", href: `/vfx/shots/${shotId}/intent` },
    {
      id: "versions",
      label: "Versions",
      href: `/vfx/shots/${shotId}/versions`,
    },
    {
      id: "alignment",
      label: "Alignment",
      href: `/vfx/shots/${shotId}/alignment`,
    },
    {
      id: "activity",
      label: "Activity",
      href: `/vfx/shots/${shotId}/activity`,
    },
  ];
}

/** Persistent Shot workspace chrome (Navigation Responsiveness Fix,
 * Phase 2) -- owns everything `VfxShotWorkspaceFrame` used to
 * re-render on every tab: the Shot identity fetch, the Anchor Context
 * fetch, Breadcrumbs, `ProductionContextHeader`, `AnchorContextLayer`,
 * and `ContextTabs`. `children` is the tab's own body only. The role
 * gate itself already ran in `app/vfx/layout.tsx`; this repeats the
 * same defensive, unreachable-in-practice check purely so `identity`
 * narrows to non-null for `actorHeaders` (matches the pattern in
 * `app/vfx/page.tsx`). */
export default async function VfxShotLayout({
  params,
  children,
}: {
  params: Promise<{ shotId: string }>;
  children: ReactNode;
}) {
  const { shotId } = await params;
  const identity = await resolveIdentity();
  if (identity?.role !== "vfx_supervisor") {
    redirect("/");
  }

  let item: VfxInboxItemRead | null = null;
  let anchorContext: AnchorContextRead | null = null;
  let unavailable = false;
  try {
    [item, anchorContext] = await Promise.all([
      fetchVfxInboxItem(shotId),
      fetchVfxAnchorContextOrNull(shotId, actorHeaders(identity)),
    ]);
  } catch {
    unavailable = true;
  }

  if (!item) {
    return (
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
    );
  }

  return (
    <ObjectWorkspaceChrome
      anchorContext={anchorContext}
      storageKey={`icas:anchor-context:vfx:${item.shot_id}`}
      tabs={shotTabs(item.shot_id)}
      breadcrumbBase={[
        { label: item.project_name, href: "/vfx/shots" },
        { label: item.shot_name },
      ]}
      contextHeader={<ProductionContextHeader item={item} />}
    >
      {children}
    </ObjectWorkspaceChrome>
  );
}
