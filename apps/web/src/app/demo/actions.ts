"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { HumanRole } from "@intent-core/contracts";

import {
  DEMO_ROLE_COOKIE,
  ROLE_HOME_PATH,
  isDemoRole,
} from "@/lib/demoIdentity";
import { resolveD1DemoShotId } from "@/features/session/demoScenario";

/** Server Action called directly from the Role-selection Home's VFX
 * Supervisor card (a Client Component) -- Step 7C-1's only role-entry
 * path; there is no more separate Guided/Explore split. Sets the
 * session-scoped role cookie (no Expires/Max-Age) and redirects to that
 * role's fixed workspace home. Never stores anything beyond the role
 * literal -- no credentials, no personal data.
 *
 * For `vfx_supervisor` and `cg_supervisor` (Step 7C-4), this also
 * best-effort ensures the real, persisted generic development seed data
 * exists (the rich confirmed Shot, its CG demo Task/dependency, and the
 * normal uninitialized Shot, all folded into the same seed process)
 * before landing on that role's Workspace -- on a clean database,
 * nothing else guarantees that baseline is seeded before `/vfx` or `/cg`
 * is ever reached. A failure here never blocks entry to the workspace
 * itself; every page already renders an honest state from whatever
 * Shots/Tasks do exist. */
export async function enterDemoRole(role: HumanRole): Promise<void> {
  if (!isDemoRole(role)) {
    redirect("/");
  }

  const store = await cookies();
  store.set(DEMO_ROLE_COOKIE, role, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  if (role === "vfx_supervisor" || role === "cg_supervisor") {
    try {
      await resolveD1DemoShotId();
    } catch {
      // Best-effort only -- see doc comment above.
    }
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
