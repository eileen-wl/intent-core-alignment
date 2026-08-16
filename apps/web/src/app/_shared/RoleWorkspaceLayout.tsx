import { redirect } from "next/navigation";
import type { HumanRole } from "@intent-core/contracts";
import type { ReactNode } from "react";

import { AppShell } from "@/design";
import { resolveIdentity } from "@/features/session/identity";
import { DEMO_IDENTITY_NAME, ROLE_LABEL } from "@/lib/demoIdentity";
import { ROLE_SIDEBAR_ITEMS } from "@/lib/roleNavigation";
import { exitRoleView } from "../demo/actions";

/** Persistent workspace architecture (Navigation Responsiveness Fix,
 * Phase 2): the shared internal primitive behind each thin
 * `app/{vfx,cg,artist}/layout.tsx`. Previously every leaf page under a
 * role -- Workspace Home, Review Inbox, the Shots/Tasks list, and every
 * Shot/Task tab -- independently re-checked the role cookie and
 * re-rendered `AppShell` from scratch; a `layout.tsx` now owns both
 * once per role, so `AppShell` (and the TopBar/RoleSidebar it composes)
 * stays mounted across every same-role navigation instead of being
 * torn down and rebuilt on each click (the confirmed cause of the
 * full-page skeleton flash during ordinary in-role navigation --
 * `docs/design/ICAS_PERSISTENT_WORKSPACE_ARCHITECTURE_AUDIT.md` §1-2).
 *
 * `middleware.ts` remains the authoritative route guard; this is the
 * same defense-in-depth double check every leaf page already performed
 * -- consolidated to one place per role rather than duplicated in
 * 12+ files. Redirects straight to `/` (the real Role-selection Home)
 * rather than `/demo` (a few call sites previously redirected there);
 * `/demo` is itself only a permanent redirect to `/`, so this removes
 * a redundant hop without changing the destination. */
export async function RoleWorkspaceLayout({
  role,
  children,
}: {
  role: HumanRole;
  children: ReactNode;
}) {
  const identity = await resolveIdentity();
  if (identity?.role !== role) {
    redirect("/");
  }

  return (
    <AppShell
      name={DEMO_IDENTITY_NAME[role]}
      role={ROLE_LABEL[role]}
      onExitRole={exitRoleView}
      sidebarItems={ROLE_SIDEBAR_ITEMS[role]}
    >
      {children}
    </AppShell>
  );
}
