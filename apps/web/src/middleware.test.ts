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
  it("redirects to / with returnTo preserved when no role is selected", () => {
    const response = middleware(requestFor("/vfx"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/?returnTo=%2Fvfx",
    );
  });

  it.each([
    ["/vfx", "vfx_supervisor"],
    ["/cg", "cg_supervisor"],
    ["/artist", "artist"],
  ])("lets the %s Demo identity access %s", (path, role) => {
    const response = middleware(requestFor(path, role));
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects a VFX identity requesting /cg or /artist to / with that route preserved as returnTo, not to /vfx", () => {
    for (const path of ["/cg", "/artist"]) {
      const response = middleware(requestFor(path, "vfx_supervisor"));
      const location = new URL(response.headers.get("location") ?? "");
      expect(location.pathname).toBe("/");
      expect(location.searchParams.get("returnTo")).toBe(path);
    }
  });

  it("redirects a CG identity requesting /vfx or /artist to / with that route preserved as returnTo, not to /cg", () => {
    for (const path of ["/vfx", "/artist"]) {
      const response = middleware(requestFor(path, "cg_supervisor"));
      const location = new URL(response.headers.get("location") ?? "");
      expect(location.pathname).toBe("/");
      expect(location.searchParams.get("returnTo")).toBe(path);
    }
  });

  it("redirects an Artist identity requesting /vfx or /cg to / with that route preserved as returnTo, not to /artist", () => {
    for (const path of ["/vfx", "/cg"]) {
      const response = middleware(requestFor(path, "artist"));
      const location = new URL(response.headers.get("location") ?? "");
      expect(location.pathname).toBe("/");
      expect(location.searchParams.get("returnTo")).toBe(path);
    }
  });

  it("preserves a deep sub-route (not just the workspace root) as returnTo", () => {
    const response = middleware(requestFor("/cg/tasks/t1/execution", "vfx_supervisor"));
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/");
    expect(location.searchParams.get("returnTo")).toBe("/cg/tasks/t1/execution");
  });

  it("preserves the query string of the intended route in returnTo", () => {
    const response = middleware(requestFor("/vfx/shots/s1/intent?justConfirmed=r1"));
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.searchParams.get("returnTo")).toBe(
      "/vfx/shots/s1/intent?justConfirmed=r1",
    );
  });

  it("ignores an invalid cookie value the same as no role selected", () => {
    const response = middleware(requestFor("/vfx", "producer"));
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/");
    expect(location.searchParams.get("returnTo")).toBe("/vfx");
  });

  it("does not intercept non-role-prefixed paths", () => {
    for (const path of ["/demo", "/dev", "/shots", "/"]) {
      const response = middleware(requestFor(path));
      expect(response.headers.get("location")).toBeNull();
    }
  });
});
