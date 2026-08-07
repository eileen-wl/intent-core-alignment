"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { HumanRole } from "@intent-core/contracts";

import {
  DEMO_ROLE_COOKIE,
  ROLE_HOME_PATH,
  isDemoRole,
  isSafeReturnToPath,
  roleForPathname,
} from "@/lib/demoIdentity";

/** Server Action called directly from the Role-selection Home's VFX
 * Supervisor card (a Client Component) -- Step 7C-1's only role-entry
 * path; there is no more separate Guided/Explore split. Sets the
 * session-scoped role cookie (no Expires/Max-Age) and redirects to that
 * role's fixed workspace home. Never stores anything beyond the role
 * literal -- no credentials, no personal data.
 *
 * Package C journey rebase: role entry is a pure read/redirect. It must
 * never ensure, seed, or otherwise mutate any D1 Journey or demo-fixture
 * data -- see `ICAS_PACKAGE_C_JOURNEY_REBASE_CLAUDE_HANDOFF.md` §6/§7.
 * If a required Demo fixture is missing, each Workspace page renders an
 * honest state from whatever Shots/Tasks actually exist; establishing
 * that baseline is exclusively the job of the explicit developer Reset/
 * Load-Completed D1 Journey actions, never role entry.
 *
 * `returnTo` (Step 7C-4 completion): the deep-link route `middleware.ts`
 * redirected away from before a role session existed for it. Re-validated
 * here from scratch -- `isSafeReturnToPath` (rejects absolute/protocol-
 * relative URLs and anything outside a known role prefix) *and* actually
 * belonging to the role just entered -- since this Server Action is a
 * real network endpoint a caller could invoke directly with any value,
 * not just through `RoleEntryButton`'s own (already-gated) prop. Falls
 * back to the role's fixed workspace home exactly as before whenever
 * `returnTo` is absent or fails either check. */
export async function enterDemoRole(
  role: HumanRole,
  returnTo?: string | null,
): Promise<void> {
  if (!isDemoRole(role)) {
    redirect("/");
  }

  const store = await cookies();
  store.set(DEMO_ROLE_COOKIE, role, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  if (isSafeReturnToPath(returnTo) && roleForPathname(returnTo) === role) {
    redirect(returnTo);
  }

  redirect(ROLE_HOME_PATH[role]);
}

/** Explicit role-workspace exit: clears the role session and returns to
 * the Role-selection Home at `/`. This is the only way to change role
 * once one has been selected -- there is no in-workspace role
 * dropdown. */
export async function exitRoleView(): Promise<void> {
  const store = await cookies();
  store.delete(DEMO_ROLE_COOKIE);
  redirect("/");
}
