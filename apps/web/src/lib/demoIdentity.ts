import type { HumanRole } from "@intent-core/contracts";

/** Session-scoped Demo identity cookie (no Expires/Max-Age, so it is
 * cleared with the browser session). This is a portfolio-prototype
 * mechanism per docs/step-7/02_STEP_7A1_...md §5.2/§14 -- it never
 * replaces backend actor-authority enforcement, and it stores nothing
 * beyond a single role literal (no credentials, no personal data). */
export const DEMO_ROLE_COOKIE = "icas_demo_role";

export const DEMO_ROLES: readonly HumanRole[] = [
  "vfx_supervisor",
  "cg_supervisor",
  "artist",
];

export function isDemoRole(
  value: string | undefined | null,
): value is HumanRole {
  return value != null && (DEMO_ROLES as readonly string[]).includes(value);
}

/** Each role's fixed workspace home, per the locked route table in
 * docs/step-7/06_STEP_7_LOCKED_SOURCE_OF_TRUTH.md §5. */
export const ROLE_HOME_PATH: Record<HumanRole, string> = {
  vfx_supervisor: "/vfx",
  cg_supervisor: "/cg",
  artist: "/artist",
};

export const ROLE_LABEL: Record<HumanRole, string> = {
  vfx_supervisor: "VFX Supervisor",
  cg_supervisor: "CG Supervisor",
  artist: "Artist",
};

/** Clearly fictional seeded identities for presentation only (brief
 * §2) -- these are display names, not credentials, and do not replace
 * the backend's existing actor-authority enforcement. */
export const DEMO_IDENTITY_NAME: Record<HumanRole, string> = {
  vfx_supervisor: "Maya Chen",
  cg_supervisor: "Daniel Ross",
  artist: "Lena Park",
};

/** Which role's workspace a given pathname belongs to, or `null` if
 * the path is not role-prefixed. Used by both the route-protection
 * middleware and tests -- kept framework-agnostic (no Next.js
 * imports) so it works identically on the Edge middleware runtime. */
export function roleForPathname(pathname: string): HumanRole | null {
  if (pathname === "/vfx" || pathname.startsWith("/vfx/"))
    return "vfx_supervisor";
  if (pathname === "/cg" || pathname.startsWith("/cg/")) return "cg_supervisor";
  if (pathname === "/artist" || pathname.startsWith("/artist/"))
    return "artist";
  return null;
}
