import { NextResponse, type NextRequest } from "next/server";

import { DEMO_ROLE_COOKIE, roleForPathname } from "@/lib/demoIdentity";

/** Server-side role-locking for the role-prefixed workspaces. This is
 * the authoritative check -- role rendering inside each page is a
 * defense-in-depth double check, not the primary gate.
 *
 * Deterministic role-aware deep-link behaviour (Step 7C-4 completion):
 * a request for a role-prefixed route is let through only when the
 * active role session cookie already matches that route's role
 * (`roleForPathname`) exactly. Every other case -- no role session at
 * all, or a *different* role's active session (e.g. a VFX Supervisor
 * session requesting a `/cg/...` route) -- redirects to the
 * Role-selection Home at `/` with the originally requested route
 * preserved as `?returnTo=`, so selecting the matching role lands the
 * user back on the exact route they asked for (see `page.tsx` and
 * `demo/actions.ts#enterDemoRole`) instead of silently landing on
 * whatever role's home the stale/mismatched session happens to have. */
export function middleware(request: NextRequest) {
  const requestedRole = roleForPathname(request.nextUrl.pathname);
  if (!requestedRole) {
    return NextResponse.next();
  }

  const cookieRole = request.cookies.get(DEMO_ROLE_COOKIE)?.value;
  if (cookieRole === requestedRole) {
    return NextResponse.next();
  }

  const roleSelectionUrl = new URL("/", request.url);
  roleSelectionUrl.searchParams.set(
    "returnTo",
    request.nextUrl.pathname + request.nextUrl.search,
  );
  return NextResponse.redirect(roleSelectionUrl);
}

export const config = {
  matcher: ["/vfx/:path*", "/cg/:path*", "/artist/:path*"],
};
