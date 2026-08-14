"use client";

import { usePathname } from "next/navigation";
import type { AnchorContextRead } from "@intent-core/contracts";
import type { ReactNode } from "react";

import {
  AnchorContextLayer,
  Breadcrumbs,
  ContextTabs,
  type ContextTab,
} from "@/design";

/** Persistent workspace architecture (Navigation Responsiveness Fix,
 * Phase 2): the shared internal primitive behind each thin
 * `app/{vfx/shots,cg/tasks,artist/tasks}/[id]/layout.tsx`. Previously
 * every Shot/Task tab page independently re-rendered the same
 * Breadcrumb/identity-header/`AnchorContextLayer`/`ContextTabs` chrome
 * from scratch (`VfxShotWorkspaceFrame`, `CgTaskWorkspaceFrame`,
 * `ArtistTaskWorkspaceFrame`); a `layout.tsx` now fetches the Shot/Task
 * identity and Anchor Context once and owns this chrome once per
 * object, so it stays mounted across sibling-tab navigation instead of
 * being torn down and rebuilt on each click
 * (`docs/design/ICAS_PERSISTENT_WORKSPACE_ARCHITECTURE_AUDIT.md` §1-2,
 * §6).
 *
 * The active tab is derived from the real pathname (`tabs.find(tab =>
 * tab.href === pathname)`) rather than an `activeTab` prop threaded
 * down from a leaf page -- once this component's parent layout stops
 * remounting on every navigation, a value computed at a page's own
 * render time would go stale the instant the user clicks a sibling tab
 * without this component re-rendering. That same derived tab drives
 * three things that all used to be computed independently per tab
 * page: the trailing Breadcrumb segment, `AnchorContextLayer`'s
 * `defaultExpanded` (true only for the "overview" tab, matching every
 * existing caller's prior per-page value), and -- only when a caller
 * opts in via `reviewVariantTabId` (CG Version Review only) -- the
 * `"review"` Anchor Context variant. `AnchorContextLayer` itself is
 * unchanged: same props, same content contract, same
 * `sessionStorage`-backed remembered expand state -- only who computes
 * `defaultExpanded`/`variant` and how often this component (and so
 * `AnchorContextLayer`) remounts has changed. Because this whole
 * chrome now lives in a persistent layout, it does NOT remount on
 * sibling-tab navigation, so `AnchorContextLayer`'s internal expanded
 * state (seeded once from `defaultExpanded`, thereafter controlled by
 * the user's own toggle / `sessionStorage`) is naturally preserved
 * across tab switches without any extra logic. */
export function ObjectWorkspaceChrome({
  anchorContext,
  storageKey,
  tabs,
  breadcrumbBase,
  contextHeader,
  reviewVariantTabId,
  children,
}: {
  anchorContext: AnchorContextRead | null;
  storageKey: string;
  tabs: ContextTab[];
  breadcrumbBase: { label: string; href?: string }[];
  contextHeader: ReactNode;
  /** CG Version Review only -- the `ContextTab.id` that should render
   * `AnchorContextLayer`'s `"review"` variant. Every other tab, and
   * every other role, omits this and gets the unchanged `"standard"`
   * variant. */
  reviewVariantTabId?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const activeTab = tabs.find((tab) => tab.href === pathname) ?? tabs[0];
  const variant =
    reviewVariantTabId && activeTab.id === reviewVariantTabId
      ? "review"
      : "standard";

  return (
    <>
      <Breadcrumbs items={[...breadcrumbBase, { label: activeTab.label }]} />
      {contextHeader}
      <AnchorContextLayer
        context={anchorContext}
        defaultExpanded={activeTab.id === "overview"}
        storageKey={storageKey}
        variant={variant}
      />
      <ContextTabs tabs={tabs} />
      {children}
    </>
  );
}
