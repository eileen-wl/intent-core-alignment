"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { HumanRole } from "@intent-core/contracts";

import {
  DEMO_ROLE_COOKIE,
  ROLE_HOME_PATH,
  isDemoRole,
} from "@/lib/demoIdentity";

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

/** Explicit Demo role exit (brief §1/§9): clears the Demo role and
 * returns to `/demo`. This is the only way to change role once one has
 * been selected -- there is no in-workspace role dropdown. */
export async function exitRoleView(): Promise<void> {
  const store = await cookies();
  store.delete(DEMO_ROLE_COOKIE);
  redirect("/demo");
}
