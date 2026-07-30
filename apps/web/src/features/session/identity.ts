import { cookies } from "next/headers";
import type { HumanRole } from "@intent-core/contracts";

import {
  DEMO_IDENTITY_NAME,
  DEMO_ROLE_COOKIE,
  isDemoRole,
} from "@/lib/demoIdentity";

/** Server-only resolved identity (Step 7C-1;
 * docs/step-7/14_STEP_7C0B_...md §7, docs/step-7/15_STEP_7C0C_...md §12).
 *
 * This is a **Demo session identity adapter**, not Step 8 ftrack
 * authentication and not enterprise authentication -- it resolves the
 * existing `icas_demo_role` httpOnly cookie (already real, already
 * enforced server-side by middleware.ts) into one small, centrally-
 * mapped identity shape. FastAPI trust hardening (verifying the actor
 * headers this identity produces are not spoofable in a real multi-
 * tenant deployment) remains a later concern -- this module only
 * removes the *browser's* ability to choose its own actor.
 *
 * `role` and `displayName` are safe to reach presentation components
 * (already true today via demoIdentity.ts). `actorId` is intentionally
 * never exported to a Client Component -- it is only ever read
 * server-side, at the point a mutation adapter injects the
 * `X-Actor-Id` header on an outgoing FastAPI request (no such adapter
 * is wired to a real mutation in this stage; §7 of the locked plan
 * scopes only the Demo-ensure call and the foundation for 7C-2/7C-3).
 */
export interface ResolvedIdentity {
  role: HumanRole;
  actorId: string;
  displayName: string;
}

/** One centralised mapping from Demo role to a stable seed/session actor
 * id (docs/step-7/14_STEP_7C0B_...md §7.2) -- never scattered across
 * call sites. */
const DEMO_ACTOR_ID: Record<HumanRole, string> = {
  vfx_supervisor: "vfx-1",
  cg_supervisor: "cg-1",
  artist: "artist-1",
};

/** Resolves the current human identity from the server-side Demo
 * session. Server-only: reads `next/headers`' `cookies()`, which
 * throws if imported into a Client Component bundle -- the same
 * boundary enforcement already relied on elsewhere in this codebase
 * (e.g. `app/vfx/page.tsx`). Returns `null` when no valid Demo role is
 * currently selected (mirrors `middleware.ts`'s own `isDemoRole` check)
 * -- callers redirect to `/demo`, they do not fabricate an identity.
 */
export async function resolveIdentity(): Promise<ResolvedIdentity | null> {
  const store = await cookies();
  const role = store.get(DEMO_ROLE_COOKIE)?.value;
  if (!isDemoRole(role)) {
    return null;
  }
  return {
    role,
    actorId: DEMO_ACTOR_ID[role],
    displayName: DEMO_IDENTITY_NAME[role],
  };
}

/** Trusted Actor headers for a server-to-server FastAPI call, derived
 * from a `ResolvedIdentity` -- never from Client Component form state
 * (docs/step-7/14_STEP_7C0B_...md §7.2's locked boundary). The only
 * caller-visible shape; `actorId` itself is not re-exported. */
export function actorHeaders(identity: ResolvedIdentity): Record<string, string> {
  return {
    "X-Actor-Role": identity.role,
    "X-Actor-Id": identity.actorId,
  };
}
