# ICAS Step 7B-2 — App Shell and Demo Identity: Implementation Note

**Status:** Implemented on `feat/step7-role-aware-dashboard`, not yet merged
**Batch:** 2 of 8 (per `06_STEP_7_LOCKED_SOURCE_OF_TRUTH.md` §14)
**Scope:** Shared role-aware App Shell + Demo identity flow only -- no
VFX/CG/Artist domain dashboards, no backend change.
**Base commit:** `82c717e` (Step 7B-1, shared design foundation)

## Demo session mechanism

A single cookie, `icas_demo_role` (`apps/web/src/lib/demoIdentity.ts`),
holds the selected role (`"vfx_supervisor" | "cg_supervisor" | "artist"`
-- the existing `HumanRole` contract type, reused rather than
re-declared). It is:

- **session-scoped**: set with no `Expires`/`Max-Age`, so it is cleared
  with the browser session, matching source-of-truth §5.2's "Session
  behaviour";
- **httpOnly**: never readable from client-side JavaScript;
- the only thing stored -- no credentials, no personal data, and it
  never replaces the backend's existing actor-authority enforcement
  (no request in this batch calls the API at all; the role homepages
  are structural placeholders).

Two Next.js Server Actions (`apps/web/src/app/demo/actions.ts`) mutate
it: `enterDemoRole(role)` sets the cookie and redirects to that role's
home; `exitRoleView()` deletes it and redirects to `/demo`. Both are
called as plain function references from Client Component buttons
(`RoleEntryButton`, `ExitRoleControl`) rather than bound to a
`<form action>` -- this repository pins React `18.3.1`, whose
`react-dom` does not support function values on a bare `<form>`'s
`action` prop outside Next's own bundler-integrated Server Actions
runtime, so a direct call keeps the same production behaviour while
remaining renderable and clickable in a plain Vitest + Testing Library
unit test (confirmed empirically: the form-action version warned
`Invalid value for prop action` and threw on simulated submission in
jsdom).

**Route protection** (brief §9) is enforced server-side first:
`apps/web/src/middleware.ts` matches `/vfx/:path*`, `/cg/:path*`,
`/artist/:path*`, reads the cookie, and redirects to `/demo` (no role)
or to the cookie's own role home (mismatched role) before the page
renders at all. Each role's `page.tsx` repeats a lightweight defense-in-
depth check (same cookie read, redirect if it doesn't match) -- the
middleware is the authoritative gate; the page check guards against a
future middleware config change, not the primary mechanism.

`/demo` itself redirects straight to the existing role's home if the
cookie is already set, so the only way back to the role-entry cards is
`Exit role view` -- visiting `/demo` directly cannot be used to bypass
the lock and silently pick a different role mid-session.

## App Shell components

All under `apps/web/src/design/shell/`, built on the Step 7B-1 tokens
and layout primitives (no new dependency):

- **`AppShell`** -- composes `TopBar` + `RoleSidebar` + a `<main>`
  content region; overrides the legacy global `main { max-width }` rule
  the same way the 7B-1 UI Foundation preview does, since the shell's
  main region fills the width next to the sidebar. Desktop: fixed
  240px left sidebar via CSS Grid. Tablet/narrow (`max-width: 768px`):
  single column, sidebar stacked above content -- no hamburger menu,
  per brief §5.
- **`TopBar`** -- ICAS product name, `RoleIdentity`, `DemoModeBadge`,
  `ExitRoleControl`. No role dropdown, no Actor ID field, no
  environment/provider details, no Signal count -- an Intent Signal
  indicator is explicitly Step 7B-3 scope, and this batch does not
  reserve a placeholder DOM element for it (nothing to point to yet).
- **`RoleSidebar`** -- renders `SidebarNavItem[]` (from the new
  `apps/web/src/lib/roleNavigation.ts` config); implemented items are
  real `next/link`s with `aria-current="page"` on the current one;
  unimplemented items render as a disabled `<span aria-disabled="true">`
  next to a `StatusBadge status="unavailable" label="Upcoming"` --
  never a link, so they can never 404 or imply working functionality.
- **`RoleIdentity`** -- name + fixed role, grouped under one
  `role="group"` accessible name (`"Maya Chen, VFX Supervisor"`).
- **`DemoModeBadge`** -- reuses the 7B-1 `StatusBadge` (`status="neutral"`)
  rather than a second badge treatment.
- **`ExitRoleControl`** -- the only role-switching control; a Client
  Component button (see mechanism note above).
- **`Breadcrumbs`** -- reusable `{label, href?}[]`; last item is always
  current and never a link. Used minimally in this batch: one crumb
  per role homepage (its own title), per brief §11.
- **`ContextTabs`** -- reusable route-backed tab navigation (built and
  unit-tested); **not wired into any page in this batch**, since no
  Shot/Task/Version context exists yet to tab between.

## Routes added

| Route | Purpose |
|---|---|
| `/` | Redirects to `/demo` (no normal-product sign-in yet) |
| `/demo` | Demo entry: product explanation, shared scenario, three role-entry cards |
| `/vfx` | VFX Supervisor homepage shell (Alignment Inbox) |
| `/cg` | CG Supervisor homepage shell (Execution Inbox) |
| `/artist` | Artist homepage shell (My Tasks) |
| `/dev` | Development mode index: links to `/dev/ui-foundation` and legacy `/shots` |

`/demo`'s scenario summary uses the approved D1 restrained-confrontation
identifiers verbatim (`D1 Demo Project`, `Shot 010 — Final
confrontation`, `Compositing Review`, `D1_STEP3_VFX_REVIEW_001`) and the
exact role responsibility/question copy from the brief. No technical
IDs, permission matrices, or raw production records appear on the page.

Each role homepage shows the exact suggested honest placeholder
language: *"Workspace structure established. Production data and
role-specific cards will be added in the next implementation batches."*
No fake Signal, Task, Shot, Version, or Integration state anywhere.

## Route-protection behaviour (verified by `src/middleware.test.ts`)

- No Demo role cookie -> `/vfx`, `/cg`, `/artist` all redirect to `/demo`.
- `vfx_supervisor` identity -> `/vfx` allowed; `/cg` and `/artist`
  redirect to `/vfx`.
- `cg_supervisor` identity -> `/cg` allowed; `/vfx` and `/artist`
  redirect to `/cg`.
- `artist` identity -> `/artist` allowed; `/vfx` and `/cg` redirect to
  `/artist`.
- An invalid/unrecognised cookie value is treated identically to no
  role selected.
- Non-role-prefixed paths (`/demo`, `/dev`, `/shots`, `/`) are never
  intercepted by the middleware.

## Development-mode behaviour

`/dev` is a new index page linking to `/dev/ui-foundation` and to the
legacy `/shots` smoke test (explicitly labelled "Engineering / manual
smoke-test surface"). It is not linked from `/demo`, `/vfx`, `/cg`,
`/artist`, or any App Shell navigation -- reachable only by direct URL,
same convention as `/dev/ui-foundation` in Step 7B-1. The existing
`/shots`, `/shots/:shotId`, `/shots/:shotId/versions/:versionId` routes,
the Role selector, and the Actor ID control are all unchanged; the full
pre-existing test suite for them (152 tests) still passes unmodified.

## What remains intentionally placeholder-only

- `RoleSidebar` items beyond each role's homepage (`Projects`,
  `Intent Signals`, `Integrations`, `Tasks`) render as disabled
  "Upcoming" placeholders -- no destination pages exist yet.
- `ContextTabs` is built and tested but not used on any page.
- No Intent Signal indicator, tray, or count anywhere (Step 7B-3).
- No ftrack linkage components (Step 7B-3+).
- No Project, Shot, Task, or Version data of any kind.

## Explicit Step 7B-3 deferrals

Per `05_STEP_7A4_...md` §15 backlog: shared Signal, ftrack, authority-
in-context, history/evidence/provenance components that depend on real
data. This batch built only the shell and identity layer they will sit
inside.

## Automated validation

- Focused Step 7B-2 tests: 75/75 passed (17 new test files: shell
  components, `demoIdentity`/`roleNavigation` logic, `middleware`,
  `/demo`, `/vfx`, `/cg`, `/artist`, `/dev`).
- Full frontend test suite: 259/259 passed (184 pre-existing + 75 new).
- TypeScript (`tsc --noEmit`): clean.
- ESLint: clean.
- Prettier (`--check`): clean.
- `git diff --check`: clean.
- Next.js production build: blocked by the same environmental conflict
  recorded in `07_STEP_7B1_...md` -- a dev server already running on
  port 3000 holds a lock on `.next/trace`, producing `EPERM` on
  `next build`. All other checks above passed; the dev server was left
  untouched.
