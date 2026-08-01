import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  DEMO_ROLE_COOKIE,
  ROLE_HOME_PATH,
  isDemoRole,
  isSafeReturnToPath,
  roleForPathname,
} from "@/lib/demoIdentity";
import { RoleSelectionHome } from "./RoleSelectionHome";

/** `/` -- the real Role-selection Home (Step 7C-1's locked IA §1):
 * ICAS's entry path, before every role workspace. Revisiting a *plain*
 * `/` (no `returnTo`) with a role already selected redirects straight
 * back to that role's workspace rather than allowing a second,
 * un-audited role pick -- this is the one shortcut this page still
 * takes silently.
 *
 * `?returnTo=` (Step 7C-4 completion): set by `middleware.ts` when a
 * role-prefixed deep link was requested without a session matching that
 * route's role. Two different cases land here with a `returnTo`:
 *
 * - No active role session at all -- handled below by rendering
 *   `RoleSelectionHome` with `returnTo` forwarded.
 * - An active session for a *different* role than `returnTo` belongs to
 *   (e.g. a VFX Supervisor session hitting a `/cg/...` deep link). This
 *   must NOT silently bounce back to the active role's own home --
 *   requirement C explicitly calls that out as the bug this fixes: the
 *   user needs to see the Role-selection Home and explicitly choose,
 *   exactly as if no session existed, so picking the route's actual
 *   role (via `RoleSelectionHome`'s own returnTo-forwarding) lands them
 *   on the originally requested route. Only a `returnTo` that already
 *   matches the active session's own role is honored immediately,
 *   without showing this page at all -- a harmless shortcut for a
 *   same-role bookmark/manual visit, never a route outside that role.
 *
 * `returnTo` is validated fresh here regardless of how it arrived
 * (`isSafeReturnToPath` rejects absolute/protocol-relative URLs and
 * anything outside a known role prefix) -- never trusted as-is. The
 * former "Engineering skeleton" landing content lives at `/dev`. */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const store = await cookies();
  const existingRole = store.get(DEMO_ROLE_COOKIE)?.value;
  const { returnTo } = await searchParams;
  const safeReturnTo = isSafeReturnToPath(returnTo) ? returnTo : null;

  if (isDemoRole(existingRole)) {
    if (safeReturnTo === null) {
      redirect(ROLE_HOME_PATH[existingRole]);
    }
    if (roleForPathname(safeReturnTo) === existingRole) {
      redirect(safeReturnTo);
    }
    // A returnTo for a different role than the active session: fall
    // through to the same Role-selection Home rendered below, rather
    // than redirecting to the active role's own home.
  }

  return <RoleSelectionHome returnTo={safeReturnTo} />;
}
