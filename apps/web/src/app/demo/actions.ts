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
import { resolveD1DemoShotId } from "@/features/session/demoScenario";

/** Server Action called directly from the Role-selection Home's VFX
 * Supervisor card (a Client Component) -- Step 7C-1's only role-entry
 * path; there is no more separate Guided/Explore split. Sets the
 * session-scoped role cookie (no Expires/Max-Age) and redirects to that
 * role's fixed workspace home. Never stores anything beyond the role
 * literal -- no credentials, no personal data.
 *
 * For `vfx_supervisor`, `cg_supervisor`, and `artist` (Step 7C-4/7C-5),
 * this also best-effort ensures the real, persisted generic development
 * seed data exists (the rich confirmed Shot, its CG demo Task/dependency,
 * and the normal uninitialized Shot, all folded into the same seed
 * process) before landing on that role's Workspace -- on a clean
 * database, nothing else guarantees that baseline is seeded before
 * `/vfx`, `/cg`, or `/artist` is ever reached. A failure here never
 * blocks entry to the workspace itself; every page already renders an
 * honest state from whatever Shots/Tasks do exist.
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

  if (
    role === "vfx_supervisor" ||
    role === "cg_supervisor" ||
    role === "artist"
  ) {
    try {
      await resolveD1DemoShotId();
    } catch {
      // Best-effort only -- see doc comment above.
    }
  }

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
