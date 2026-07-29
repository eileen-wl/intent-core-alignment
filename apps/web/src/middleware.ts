import { NextResponse, type NextRequest } from "next/server";

import {
  DEMO_ROLE_COOKIE,
  ROLE_HOME_PATH,
  isDemoRole,
  roleForPathname,
} from "@/lib/demoIdentity";

/** Server-side Demo role-locking for the role-prefixed workspaces
 * (brief §9). This is the authoritative check -- role rendering inside
 * each page is a defense-in-depth double check, not the primary gate. */
export function middleware(request: NextRequest) {
  const requestedRole = roleForPathname(request.nextUrl.pathname);
  if (!requestedRole) {
    return NextResponse.next();
  }

  const cookieRole = request.cookies.get(DEMO_ROLE_COOKIE)?.value;
  if (!isDemoRole(cookieRole)) {
    return NextResponse.redirect(new URL("/demo", request.url));
  }
  if (cookieRole !== requestedRole) {
    return NextResponse.redirect(
      new URL(ROLE_HOME_PATH[cookieRole], request.url),
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/vfx/:path*", "/cg/:path*", "/artist/:path*"],
};
