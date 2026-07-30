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

/** Server Action called directly from each role-entry card's button
 * (a Client Component). Sets the session-scoped Demo role cookie (no
 * Expires/Max-Age) and redirects to that role's fixed workspace home.
 * Never stores anything beyond the role literal -- no credentials, no
 * personal data. */
export async function enterDemoRole(role: HumanRole): Promise<void> {
  if (!isDemoRole(role)) {
    redirect("/demo");
  }

  const store = await cookies();
  store.set(DEMO_ROLE_COOKIE, role, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  redirect(ROLE_HOME_PATH[role]);
}

/** The dominant "Start guided demonstration" action (Step 7C-1;
 * docs/step-7/15_STEP_7C0C_...md §7.1, docs/step-7/16_STEP_7C0D_...md
 * §8.3) -- establishes the same VFX Supervisor Demo identity as
 * `enterDemoRole("vfx_supervisor")`, then additionally ensures/resolves
 * the real, persisted D1 scenario server-side and redirects straight to
 * its Shot Overview. Unlike `enterDemoRole`, this does **not** stop at
 * the Alignment Inbox -- the guided path's whole point is one specific,
 * pre-known Shot. Standalone `/vfx` entry (the three direct role-entry
 * cards, and any later manual navigation) is unaffected and still calls
 * `enterDemoRole`.
 *
 * On failure (API/database unavailable), redirects back to `/demo`
 * with an inline, honest error rather than redirecting into a broken
 * Shot page -- the locked failure behaviour. */
export async function startGuidedDemonstration(): Promise<void> {
  const store = await cookies();
  store.set(DEMO_ROLE_COOKIE, "vfx_supervisor", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  let shotId: string;
  try {
    shotId = await resolveD1DemoShotId();
  } catch {
    redirect("/demo?guidedError=1");
  }
  redirect(`/vfx/shots/${shotId}`);
}

/** Explicit Demo role exit (brief §1/§9): clears the Demo role and
 * returns to `/demo`. This is the only way to change role once one has
 * been selected -- there is no in-workspace role dropdown. */
export async function exitRoleView(): Promise<void> {
  const store = await cookies();
  store.delete(DEMO_ROLE_COOKIE);
  redirect("/demo");
}
