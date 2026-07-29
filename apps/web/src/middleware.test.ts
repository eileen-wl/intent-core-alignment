import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { DEMO_ROLE_COOKIE } from "@/lib/demoIdentity";
import { middleware } from "./middleware";

function requestFor(pathname: string, cookieRole?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (cookieRole) {
    headers.cookie = `${DEMO_ROLE_COOKIE}=${cookieRole}`;
  }
  return new NextRequest(new URL(pathname, "http://localhost:3000"), {
    headers,
  });
}

describe("middleware (role route protection)", () => {
  it("redirects to /demo when no Demo role is selected", () => {
    const response = middleware(requestFor("/vfx"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/demo");
  });

  it.each([
    ["/vfx", "vfx_supervisor"],
    ["/cg", "cg_supervisor"],
    ["/artist", "artist"],
  ])("lets the %s Demo identity access %s", (path, role) => {
    const response = middleware(requestFor(path, role));
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects a VFX identity away from /cg and /artist to /vfx", () => {
    for (const path of ["/cg", "/artist"]) {
      const response = middleware(requestFor(path, "vfx_supervisor"));
      expect(response.headers.get("location")).toBe(
        "http://localhost:3000/vfx",
      );
    }
  });

  it("redirects a CG identity away from /vfx and /artist to /cg", () => {
    for (const path of ["/vfx", "/artist"]) {
      const response = middleware(requestFor(path, "cg_supervisor"));
      expect(response.headers.get("location")).toBe("http://localhost:3000/cg");
    }
  });

  it("redirects an Artist identity away from /vfx and /cg to /artist", () => {
    for (const path of ["/vfx", "/cg"]) {
      const response = middleware(requestFor(path, "artist"));
      expect(response.headers.get("location")).toBe(
        "http://localhost:3000/artist",
      );
    }
  });

  it("ignores an invalid cookie value the same as no role selected", () => {
    const response = middleware(requestFor("/vfx", "producer"));
    expect(response.headers.get("location")).toBe("http://localhost:3000/demo");
  });

  it("does not intercept non-role-prefixed paths", () => {
    for (const path of ["/demo", "/dev", "/shots", "/"]) {
      const response = middleware(requestFor(path));
      expect(response.headers.get("location")).toBeNull();
    }
  });
});
