import { describe, expect, it } from "vitest";

import {
  DEMO_IDENTITY_NAME,
  DEMO_ROLE_COOKIE,
  DEMO_ROLES,
  ROLE_HOME_PATH,
  ROLE_LABEL,
  isDemoRole,
  isSafeReturnToPath,
  roleForPathname,
} from "./demoIdentity";

describe("demoIdentity", () => {
  it("uses a session-scoped cookie name", () => {
    expect(DEMO_ROLE_COOKIE).toBe("icas_demo_role");
  });

  it("recognises exactly the three formal Demo roles", () => {
    expect(DEMO_ROLES).toEqual(["vfx_supervisor", "cg_supervisor", "artist"]);
  });

  it.each(DEMO_ROLES)("treats %s as a valid Demo role", (role) => {
    expect(isDemoRole(role)).toBe(true);
  });

  it("rejects unknown, undefined, and null role values", () => {
    expect(isDemoRole("producer")).toBe(false);
    expect(isDemoRole(undefined)).toBe(false);
    expect(isDemoRole(null)).toBe(false);
    expect(isDemoRole("")).toBe(false);
  });

  it("maps every role to its locked workspace home", () => {
    expect(ROLE_HOME_PATH).toEqual({
      vfx_supervisor: "/vfx",
      cg_supervisor: "/cg",
      artist: "/artist",
    });
  });

  it("uses clearly fictional seeded identities, not raw actor IDs", () => {
    for (const name of Object.values(DEMO_IDENTITY_NAME)) {
      expect(name).not.toMatch(/^(vfx|cg|artist)-\d+$/);
    }
    expect(DEMO_IDENTITY_NAME.vfx_supervisor).toBe("Maya Chen");
    expect(DEMO_IDENTITY_NAME.cg_supervisor).toBe("Daniel Ross");
    expect(DEMO_IDENTITY_NAME.artist).toBe("Lena Park");
  });

  it("labels each role for display", () => {
    expect(ROLE_LABEL.vfx_supervisor).toBe("VFX Supervisor");
    expect(ROLE_LABEL.cg_supervisor).toBe("CG Supervisor");
    expect(ROLE_LABEL.artist).toBe("Artist");
  });

  describe("roleForPathname", () => {
    it("resolves each role-prefixed path to its role", () => {
      expect(roleForPathname("/vfx")).toBe("vfx_supervisor");
      expect(roleForPathname("/vfx/shots/abc")).toBe("vfx_supervisor");
      expect(roleForPathname("/cg")).toBe("cg_supervisor");
      expect(roleForPathname("/cg/tasks/abc")).toBe("cg_supervisor");
      expect(roleForPathname("/artist")).toBe("artist");
      expect(roleForPathname("/artist/tasks/abc")).toBe("artist");
    });

    it("returns null for non-role-prefixed paths", () => {
      expect(roleForPathname("/demo")).toBeNull();
      expect(roleForPathname("/dev")).toBeNull();
      expect(roleForPathname("/shots")).toBeNull();
      expect(roleForPathname("/")).toBeNull();
    });

    it("does not treat a similarly-named path as role-prefixed", () => {
      expect(roleForPathname("/vfxsomething")).toBeNull();
      expect(roleForPathname("/artistical")).toBeNull();
    });
  });

  describe("isSafeReturnToPath", () => {
    it("accepts a plain role-prefixed path", () => {
      expect(isSafeReturnToPath("/cg")).toBe(true);
      expect(isSafeReturnToPath("/cg/tasks/t1/execution")).toBe(true);
      expect(isSafeReturnToPath("/vfx/shots/s1/intent")).toBe(true);
      expect(isSafeReturnToPath("/artist")).toBe(true);
    });

    it("accepts a role-prefixed path with a query string", () => {
      expect(isSafeReturnToPath("/vfx/shots/s1/intent?justConfirmed=r1")).toBe(
        true,
      );
    });

    it("rejects null, undefined, and empty values", () => {
      expect(isSafeReturnToPath(null)).toBe(false);
      expect(isSafeReturnToPath(undefined)).toBe(false);
      expect(isSafeReturnToPath("")).toBe(false);
    });

    it("rejects absolute URLs (open-redirect guard)", () => {
      expect(isSafeReturnToPath("https://evil.example/cg")).toBe(false);
      expect(isSafeReturnToPath("http://evil.example/cg")).toBe(false);
    });

    it("rejects protocol-relative URLs (open-redirect guard)", () => {
      expect(isSafeReturnToPath("//evil.example/cg")).toBe(false);
    });

    it("rejects paths containing a backslash", () => {
      expect(isSafeReturnToPath("/cg\\@evil.example")).toBe(false);
    });

    it("rejects a path outside any known role prefix", () => {
      expect(isSafeReturnToPath("/shots")).toBe(false);
      expect(isSafeReturnToPath("/dev")).toBe(false);
      expect(isSafeReturnToPath("/")).toBe(false);
    });

    it("rejects a path that merely starts with a role name as a substring", () => {
      expect(isSafeReturnToPath("/cgsomething")).toBe(false);
      expect(isSafeReturnToPath("/vfx@evil.example")).toBe(false);
    });

    it("rejects a relative path with no leading slash", () => {
      expect(isSafeReturnToPath("cg/tasks/t1")).toBe(false);
    });
  });
});
