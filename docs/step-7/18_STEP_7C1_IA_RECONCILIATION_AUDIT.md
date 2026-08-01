# Step 7C-1 — Information-Architecture Reconciliation Audit (Read-Only)

**Date:** audit conducted against `recovery/step7c2-functional-clean`
**HEAD at audit time:** `ab4cc60` — `feat: complete guided core anchor lifecycle`
**Nature of this document:** a read-only audit. No file was modified, created, deleted, restored, stashed, staged, committed, reset, switched, or pushed during the audit itself. This document is the write-up of that audit's findings, produced afterward at explicit request.

## 1. Repository, branch, HEAD, status

- Path: `D:\25fall everything\26summer\intent-core-alignment-recovery`
- Branch: `recovery/step7c2-functional-clean`
- HEAD: `ab4cc60` — `feat: complete guided core anchor lifecycle` (matches the expected commit)
- `git status --short`: only the five root-level ZIP patch archives remain untracked; no tracked-file changes.
- Stash list (both untouched throughout): `stash@{0}` `wip-intent-visual-before-lifecycle-implementation-2026-07-30`, `stash@{1}` `safety-before-step7c2-ui-recovery-2026-07-30`.

## Locked platform IA (input to this audit)

Two entry paths (Role-selection Home, ftrack Deep Link); no product-facing Demo Entry; Guided/Explore/Start-guided-demonstration/Browse-Alignment-Inbox-as-demo-choice/Future-ftrack-launch-as-disabled-Demo-card all removed from intended IA. Role-selection Home offers VFX Supervisor (fully available) / CG Supervisor / Artist (marked upcoming), with no sidebar, no preselected identity, no Shot nav, no Exit-role-view before entering a workspace. VFX Workspace primary nav: Workspace Home, Review Inbox, Shots (Projects/Integrations/Intent-Signal are *not* primary nav — Intent Signal is embedded contextually). Selected Shot Workspace sits structurally under Shots; Shots stays highlighted when a Shot is open; Review Inbox is never the Shot's structural parent.

## 2. Current route tree

| Route | Component | Notes |
|---|---|---|
| `/` | `app/page.tsx` | Unconditional `redirect("/demo")` — no content of its own. |
| `/demo` | `app/demo/page.tsx` → `DemoEntryPage.tsx` | Redirects to the active role's home if a valid role cookie already exists; otherwise renders the Guided/Explore/Future-ftrack picker. |
| `/vfx` | `app/vfx/page.tsx` → `VfxWorkspacePage.tsx` | Cookie-gated (`DEMO_ROLE_COOKIE === "vfx_supervisor"`); fetches `fetchVfxInbox()`; renders the full "Alignment Inbox" list, unfiltered/unpaginated. |
| `/vfx/shots/[shotId]` | `page.tsx` → `ShotOverviewPage.tsx` | Same cookie gate; fetches `fetchVfxInboxItem(shotId)`. |
| `/vfx/shots/[shotId]/intent` | `page.tsx` → `IntentWorkspacePage.tsx` | Same cookie gate; the completed Step 7C-2 five-state lifecycle page. |
| `/vfx/shots/[shotId]/versions`, `/alignment`, `/activity` | **No route exists** | Only referenced as `ContextTabs`/breadcrumb `href` strings — would 404 if visited. |
| `/cg`, `/artist` | pre-existing minimal role workspaces | Out of scope for this reconciliation; untouched. |

Route guard: `middleware.ts` matches only `["/vfx/:path*", "/cg/:path*", "/artist/:path*"]` — `/`, `/demo`, `/dev` are never intercepted by it; each of those pages does its own cookie check as defense-in-depth.

## 3. Current shell/navigation tree

- **`AppShell`** (`design/shell/AppShell.tsx`): props `name, role, onExitRole, sidebarItems, currentPath, navigationMode? ("workspace"|"demo-entry", default "workspace")`. Renders `TopBar` + `RoleSidebar` + `<main>`.
- **`RoleSidebar`**: active-item logic is `item.href === currentPath` (`RoleSidebar.tsx:77`) — **strict equality, no URL-prefix matching**. Every VFX page (`/vfx`, `/vfx/shots/[id]`, `/vfx/shots/[id]/intent`) hardcodes the literal `currentPath="/vfx"`, so "Alignment Inbox" is always shown as the active item, including on deep Shot subpages — not because of real Shot-aware highlighting, just because it's the only implemented sidebar item today. `mode="demo-entry"` (only ever passed by `DemoEntryPage.tsx`) makes the current item render as a non-clickable "preview" span instead of a link.
- **`ROLE_SIDEBAR_ITEMS.vfx_supervisor`** (`lib/roleNavigation.ts`): exactly 4 entries — `alignment-inbox` ("Alignment Inbox", `/vfx`, implemented), `projects` ("Projects", `/vfx/projects`, not implemented), `intent-signals` ("Intent Signals", `/vfx/signals`, not implemented), `integrations` ("Integrations", `/vfx/integrations`, not implemented). **No "Workspace Home", "Review Inbox", or "Shots" entry exists anywhere today.**
- **`Breadcrumbs`**: on both `ShotOverviewPage.tsx` and `IntentWorkspacePage.tsx`, the first crumb is `{ label: "Alignment Inbox", href: "/vfx" }` — i.e. the Shot's breadcrumb parent is the Inbox concept, not Project/Shots.
- **`ContextTabs`** (Shot secondary nav): already exactly Overview/Intent/Versions/Alignment/Activity, matching the locked IA's tab set — only the last three lack real routes (see §2).
- **`DemoModeBadge`**: renders the static text "Demo mode" unconditionally in `TopBar`, on every `AppShell`-wrapped page, including the real `/vfx` workspace (not just `/demo`).
- **Role/session mechanism**: `DEMO_ROLE_COOKIE` (`lib/demoIdentity.ts`) + `features/session/identity.ts`'s `resolveIdentity()`/`actorHeaders()`. Mechanically generic (cookie → role → actor headers), but named/documented throughout as "Demo" infrastructure.

## 4. Contradiction table — current implementation vs. locked IA

| Locked IA requirement | Current implementation | Contradiction |
|---|---|---|
| Two entry paths (Role-selection Home, ftrack Deep Link); no product-facing Demo Entry | `/` redirects to `/demo`; `/demo` is a Guided/Explore picker | Direct contradiction — the only entry path today *is* the thing being removed |
| Remove Guided D1 walkthrough / Explore manually / Start guided demonstration / Browse Alignment Inbox as demo choice / Future ftrack launch disabled card | All five exist verbatim in `DemoEntryPage.tsx` | Direct contradiction |
| Role-selection Home must not show a role-specific sidebar / preselected identity / Shot nav / Exit role view | `DemoEntryPage.tsx` wraps in full `AppShell` (sidebar + `RoleIdentity` "Maya Chen"/"VFX Supervisor" + `ExitRoleControl`), just in a `navigationMode="demo-entry"` variant | Direct contradiction — today's entry screen is a *variant of the workspace shell*, not a shell-less picker |
| VFX primary nav = Workspace Home, Review Inbox, Shots | `ROLE_SIDEBAR_ITEMS.vfx_supervisor` = Alignment Inbox (implemented) + Projects/Intent Signals/Integrations (unimplemented placeholders) | None of the three locked nav items exist; "Integrations" is present as a placeholder nav item when locked IA says it belongs in a later settings area, not daily nav |
| Intent Signal embedded contextually, not standalone nav | `intent-signals` is a standalone (if unimplemented) sidebar entry | Contradiction in intended placement, though currently inert (`implemented: false`) |
| Shots stays highlighted when a Shot is open | `RoleSidebar`'s strict-equality match + every Shot page hardcoding `currentPath="/vfx"` means "Alignment Inbox" is highlighted instead | Contradiction — no page ever highlights anything Shots-related, because no such nav item exists yet |
| Review Inbox is never the structural parent of the Shot; breadcrumbs must not use it as parent | Both `ShotOverviewPage.tsx` and `IntentWorkspacePage.tsx` breadcrumb from `{label: "Alignment Inbox", href: "/vfx"}` | Direct contradiction |
| Breadcrumbs use Project / Shot / current page | Current chain is Alignment-Inbox / Project / Shot(/ page) — an extra leading crumb | Contradiction — needs the leading crumb dropped |
| No separate Guided/Explore journey | Two backend-seeded Shot identities (rich confirmed vs. guided empty) exist specifically to serve two different journeys | Direct contradiction |
| Normal product must still reach Initial Empty/First Draft without Guided mode | Today the *only* way to reach Initial Empty is via the Guided-only, Inbox-excluded Shot | Contradiction requiring a replacement mechanism (see §6) |

## 5. Complete Guided/Explore dependency inventory

**Frontend (12 files under `apps/web/src/app/demo/` + 6 more elsewhere):**
`DemoEntryPage.tsx/.module.css/.test.tsx`, `RoleEntryButton.tsx/.test.tsx`, `page.tsx/.test.ts`, `actions.ts/.test.ts` (`enterDemoRole`, `startGuidedDemonstration`, `exitRoleView`), `roleCards.ts/.test.ts` (currently **dead code** — defined, never imported anywhere), `features/session/demoScenario.ts/.test.ts` (`resolveD1DemoShotId` rich / `resolveD1GuidedDemoShotId` guided), `features/session/identity.ts/.test.ts` (generic, Demo-named), `lib/demoIdentity.ts/.test.ts` (generic, Demo-named), `design/shell/AppShell.tsx`+`RoleSidebar.tsx`'s `navigationMode`/`mode: "demo-entry"` branch, `design/shell/DemoModeBadge.tsx/.test.tsx` (unrelated to Guided specifically — generic "Demo mode" chrome), `middleware.ts/.test.ts` (redirect target `/demo` only).

**Backend:** `demo_seed/d1_scenario.py` (`ensure_d1_scenario`/rich constants + `ensure_d1_guided_scenario`/`D1_GUIDED_SHOT_EXTERNAL_ID`/guided constants), `demo_seed/router.py` (both `/ensure-d1-scenario` and `/ensure-d1-guided-scenario` endpoints), `vfx_inbox/service.py`'s guided-exclusion filter (`list_inbox_items`, ~7 lines + import), `apps/api/tests/test_demo_seed_d1_scenario.py` (20 tests, rich-only), `apps/api/tests/test_demo_seed_d1_guided_scenario.py` (8 tests, **entirely** guided-only), `apps/api/tests/test_external_source_demo.py` (unrelated — generic `ExternalSource="demo"` contract test, predates and is independent of Guided/Explore, only coincidentally reuses D1 fixture text).

No Guided-related code exists outside these ~24 files (confirmed by exhaustive repo-wide grep on "guided"/`D1_GUIDED`/`resolveD1GuidedDemoShotId`/`ensure-d1-guided-scenario`/`ensure_d1_guided_scenario`).

## 6. Safe removal / reuse classification

| Item | Classification | Notes |
|---|---|---|
| `DemoEntryPage.tsx/.module.css/.test.tsx` | **1. Delete completely** | Replaced by new Role-selection Home component |
| `RoleEntryButton.tsx/.test.tsx` | **2. Replace with normal role-entry behaviour** | Keep the "button calls a role-entry Server Action" shape; drop the `guided` prop/branch |
| `demo/page.tsx/.test.ts` | **2. Replace** | Logic moves to `app/page.tsx`; old file becomes a redirect shim or is removed |
| `actions.ts` — `enterDemoRole` | **2. Replace/reuse** | Exactly the "normal role-entry" behaviour the new Home needs; keep (rename optional) |
| `actions.ts` — `startGuidedDemonstration` | **1. Delete completely** | No replacement needed — see Initial-Empty reachability plan below |
| `actions.ts` — `exitRoleView` | **2. Replace** | Function stays; redirect target changes from `/demo` to `/` |
| `roleCards.ts/.test.ts` | **3. Reuse for [Role-selection] Home** | Currently dead code, but its 3-role data shape is exactly what the new Home's role cards need — adopt rather than re-invent |
| `demoScenario.ts` — `resolveD1DemoShotId` (rich) | **5. Retain as generic dev seed infrastructure** | Rename recommended, not required |
| `demoScenario.ts` — `resolveD1GuidedDemoShotId` (guided) | **1. Delete completely** | |
| `features/session/identity.ts`, `lib/demoIdentity.ts` | **5. Retain as generic session infrastructure** | Mechanically generic; "Demo" naming/doc-comments are cosmetic debt, not functional coupling |
| `AppShell`/`RoleSidebar`'s `navigationMode`/`mode: "demo-entry"` | **1. Delete completely** | The new Home won't use `AppShell`/`RoleSidebar` at all (locked IA: no sidebar) — this special-case mode becomes entirely dead |
| `DemoModeBadge.tsx/.test.tsx` | **6. Unrelated, preserve unchanged** | Not part of the Guided/Explore split; a separate naming decision, out of this cleanup's scope |
| `middleware.ts/.test.ts` | **2. Replace** (redirect target only) | `roleForPathname`/cookie-role logic stays; `/demo` literal → `/`; the 4 role-boundary tests are **6. unrelated, unchanged** |
| Backend `ensure_d1_scenario` (rich) | **5. Retain as generic dev seed infrastructure** | Content isn't "Explore"-branded — only the frontend button label was; keep as-is, reachable through normal Shots |
| Backend `ensure_d1_guided_scenario` (guided) + `D1_GUIDED_SHOT_EXTERNAL_ID` | **1. Delete completely**, functionally **replaced (2)** | See below — folded into a plain uninitialized-Shot seed step |
| `vfx_inbox/service.py` guided-exclusion filter | **1. Delete completely** | No Shot needs hiding once there's no Guided/Explore split — every seeded Shot should appear normally |
| `test_demo_seed_d1_guided_scenario.py` (8 tests) | **1. Delete completely**, concept **replaced (2)** | Coverage for "a Shot with zero Core Anchor rows is reachable" should be re-established under the new plain-seed mechanism, not preserved verbatim |
| `test_demo_seed_d1_scenario.py` (20 tests) | **5./6. Retain**, minor wording only | Rich-scenario + generic idempotent-seed tests; only doc-comment "Explore" references need rewording |
| `test_external_source_demo.py` | **6. Unrelated, preserve unchanged** | |

**Guided empty Shot → replaced by a normal uninitialized Shot seed.** Per the locked constraint that Initial Empty/First Draft must remain reachable without Guided mode: the smallest safe path is to fold a second, plain (non-"guided"-branded) unconfirmed Shot into the *same* generic dev-seed step that already creates the rich confirmed Shot — no special external identity, no Inbox exclusion, no dedicated route/action. It simply appears in Review Inbox/Shots like any other Shot, because it *is* just another Shot that happens to have no Core Anchor yet — exactly the same shape a real ftrack-synced Shot would have before anyone drafts a Core Anchor for it.

**Rich D1 scenario → remains generic development seed data**, reachable through normal Shots, no rename of its backend identity/content required (only the frontend "Explore" *label* was the branding issue, not the seed data itself).

## 7. Recommended final route map

| Purpose | Route | Rationale |
|---|---|---|
| Role-selection Home | `/` | Semantically correct (root = entry point); `/` already exists as a trivial 8-line file, smallest possible migration |
| Old `/demo` URL | permanent redirect → `/` | Preserves any bookmarked links; no dangling "Demo" route |
| VFX Workspace Home | `/vfx` | Already the role's `ROLE_HOME_PATH`; content changes from "Alignment Inbox" to genuine Workspace Home summary |
| Review Inbox | `/vfx/inbox` | Reuses the "inbox" terminology already established throughout the codebase (`fetchVfxInbox`, `/vfx/inbox` API route) rather than inventing a new term |
| Shots (list) | `/vfx/shots` | New index route sitting naturally above the existing `/vfx/shots/[shotId]` dynamic route |
| Selected Shot Workspace | `/vfx/shots/[shotId]` (unchanged) | Already correct structurally |

Compared alternatives (Audit D):
- **Reuse `/demo` temporarily**: rejected — the URL itself still carries obsolete "Demo" terminology even with new content, forcing a second migration later; strictly more total risk than migrating once now.
- **New route + redirect old ones**: rejected — adds a permanent extra route and redirect shim for no benefit over reusing `/`, which already exists and is currently trivial (pure redirect, zero real content to preserve).

**Role-selection Home migration specifics:**
- Entry route: `/` (new component, e.g. `apps/web/src/app/RoleSelectionHome.tsx`, sibling to `page.tsx`, mirroring today's `demo/DemoEntryPage.tsx` next to `demo/page.tsx` pattern).
- Behaviour of old `/demo`: permanent redirect to `/`.
- Exit role workspace returns to: `/` (retarget `exitRoleView`'s redirect from `/demo`).
- Role cookie/session: keep `DEMO_ROLE_COOKIE`/`isDemoRole`/`ROLE_HOME_PATH` mechanism as-is functionally (it's generic); cosmetic rename optional (`ROLE_SESSION_COOKIE`, `lib/roleSession.ts`).
- If a valid role cookie already exists on visiting `/`, preserve today's tested behavior: skip the picker and redirect straight to that role's workspace home (continuity with `demo/page.test.ts`'s existing "redirects to the active role's homepage instead of re-showing the entry" test).
- CG/Artist unavailable roles: render as disabled cards reusing the exact same `disabledItem`/"Upcoming" visual pattern already established in `RoleSidebar.tsx` for unimplemented nav items (visual consistency, no new pattern invented) — no click action, no route.

## 8. Role-selection Home migration

Covered in full within §7 above (entry route, behaviour of old URL, exit target, session establishment, CG/Artist presentation).

## 9. Workspace Home / Review Inbox / Shots component reuse map

| Destination | Reuse from current code | Genuinely new work |
|---|---|---|
| **Workspace Home** | `fetchVfxInbox()` as the raw aggregation source; `FtrackSyncSummary` component (**already built**, in `design/semantic/ftrack/`, currently unused anywhere in `apps/web/src/app/vfx/`) for the connection summary | Pending-counts aggregation (by `current_focus.focus_type` across all items — no such aggregation exists anywhere today); "important Shots" (top-N by existing `sort_rank`, which is already a priority ordering — cheap to reuse); "recent Decisions" (no Decision-listing concept/endpoint exists at all — new backend work, likely 7C-3-adjacent); a small new API call for `SyncCursorRead` to feed `FtrackSyncSummary` (not currently exported by `features/vfx/api.ts`) |
| **Review Inbox** | Nearly the entirety of current `/vfx`: `VfxWorkspacePage.tsx`'s row-list mechanism, `InboxRow.tsx` (its focus-first lead content is already Review-Inbox-shaped), `fetchVfxInbox()`/`fetchVfxInboxItem()`, all Core-Anchor mutation functions in `features/vfx/api.ts` for inline actions, `current_focus.py`'s per-Shot derivation (already the exact "actionable work" concept) | A filter down to actionable-only items (`current_focus.focus_type !== "none"`) — **client-side filtering of the existing unfiltered list is sufficient for 7C-1**, no backend change required |
| **Shots** | Same underlying `fetchVfxInbox()` data; `InboxRow.tsx`'s identity fields (Shot/Project name, ftrack badge, Task/Version display) minus the focus-driven lead — likely a new leaner row variant/component | Project filter, status filter, Task/department filter, pagination — **entirely absent today at all three layers** (no UI control, no `api.ts` param, no backend `WHERE`/`LIMIT` clause); genuinely new work, appropriately scoped as new-but-bounded 7C-1 work, with an unfiltered/unpaginated v1 as an acceptable smallest-safe starting point |

Note: `VfxWorkspacePage.test.tsx`'s "does not show a card grid, fake metrics, or a notification tray" test is a *negative* architectural constraint specific to the old single-page-Inbox design; it will need rethinking (not a straight carry-over) once Workspace Home legitimately becomes a summary/dashboard-style page.

## 10. Shot Workspace migration plan

Minimum coherent changes:

1. **Active-nav highlighting**: update `RoleSidebar.tsx`'s `isCurrent` check from strict equality to `item.href === currentPath || currentPath.startsWith(item.href + "/")`, and have `ShotOverviewPage.tsx`/`IntentWorkspacePage.tsx` pass `currentPath="/vfx/shots"` (the new Shots nav item's href) instead of the current `"/vfx"`. Since these are Server Components, this stays a hardcoded-but-correct literal per page, not a live `usePathname()` call.
2. **Breadcrumbs**: drop the leading `{label: "Alignment Inbox", href: "/vfx"}` crumb entirely from both `ShotOverviewPage.tsx` and `IntentWorkspacePage.tsx`; replace with the locked "Project / Shot / current page" shape (e.g. `{label: project_name}, {label: shot_name}, {label: "Intent"}` — no workspace-section crumb at all).
3. **Shot secondary navigation** (`ContextTabs`): no change needed — the tab set (Overview/Intent/Versions/Alignment/Activity) already matches the locked IA exactly; the three unrouted tabs remain intentionally out of scope (7C-3).
4. **Shot Context Header** (`ProductionContextHeader.tsx`): no change needed — already a pure, correctly-shared presentational component.
5. **Completed Intent lifecycle**: `IntentWorkspacePage.tsx`'s data-fetching, five-state selection, `justConfirmed` handling, and every file under `features/vfx/intent-workspace/` remain **completely untouched** — only the shallow shell-prop values (`currentPath`, `sidebarItems`, `Breadcrumbs` array) at the top of `IntentWorkspacePage.tsx`'s JSX change, not any logic.

## 11. Exact files expected to change

**New:** `app/RoleSelectionHome.tsx` (or similar), `app/vfx/inbox/page.tsx` (+ `ReviewInboxPage.tsx`), `app/vfx/shots/page.tsx` (+ `ShotsListPage.tsx`), a leaner Shot-row component for Shots.

**Modified:** `app/page.tsx`, `app/demo/page.tsx` (→ redirect shim or removed), `app/vfx/page.tsx` (+ `VfxWorkspacePage.tsx` → Workspace Home content), `app/vfx/shots/[shotId]/ShotOverviewPage.tsx`, `app/vfx/shots/[shotId]/intent/IntentWorkspacePage.tsx` (shell-prop lines only), `lib/roleNavigation.ts` (`ROLE_SIDEBAR_ITEMS.vfx_supervisor`), `lib/demoIdentity.ts` (optional rename), `design/shell/RoleSidebar.tsx` (active-match logic), `design/shell/AppShell.tsx` (remove `navigationMode`), `middleware.ts` (redirect target), `app/demo/actions.ts` (trim to `enterDemoRole`/`exitRoleView`, retarget), `features/session/demoScenario.ts` (drop guided resolver), `apps/api/.../demo_seed/d1_scenario.py` (drop guided scenario, fold in plain-unconfirmed-shot seed), `apps/api/.../demo_seed/router.py` (drop guided endpoint), `apps/api/.../vfx_inbox/service.py` (drop exclusion filter).

**Deleted:** `app/demo/DemoEntryPage.tsx/.module.css`, `app/demo/RoleEntryButton.*` (or heavily rewritten in place), `startGuidedDemonstration` and `resolveD1GuidedDemoShotId`, `ensure_d1_guided_scenario`/`D1_GUIDED_SHOT_EXTERNAL_ID`, the `/internal/demo/ensure-d1-guided-scenario` endpoint.

## 12. Exact tests expected to change

**Deleted:** `DemoEntryPage.test.tsx`'s guided/explore-specific cases, `test_demo_seed_d1_guided_scenario.py` (all 8 tests).

**Rewritten:** `app/demo/page.test.ts`/`actions.test.ts` (guided cases removed, redirect targets updated), `middleware.test.ts` (3 tests referencing `/demo` as literal target), `demoScenario.test.ts` (guided `describe` block removed), `VfxWorkspacePage.test.tsx` (split across new Workspace-Home/Review-Inbox/Shots test files per the classification in §9's source agent report — sidebar-current and "no card grid" tests specifically need rethinking), `RoleEntryButton.test.tsx` (drop `guided` prop tests).

**New test coverage needed:** Role-selection Home rendering (no sidebar/identity/Shot-nav/exit-control), Workspace Home summary content, Review Inbox filtering, Shots list + filters/pagination, Shots active-nav highlighting on Shot subpages, breadcrumb shape (Project/Shot/page, no Inbox parent), and — replacing the deleted guided-scenario coverage — a test proving a plain seeded Shot with zero Core Anchor rows is reachable and renders Initial Empty/First Draft through the normal product path.

**Unchanged:** `test_demo_seed_d1_scenario.py` (rich scenario, minor wording only), `test_external_source_demo.py`, all five completed Intent-lifecycle test files (`IntentWorkspacePage.test.tsx`, `CoreAnchorRevisionEditor.test.tsx`, `ConfirmedAnchorSummary.test.tsx`, `data.test.ts`, `intent-workspace/actions.test.ts`), middleware's 4 role-boundary tests.

## 13. Ordered implementation sequence

**Within 7C-1** (dependency order):
1. Role-selection Home (`/` content + `/demo` → `/` redirect) + generic session-infra renames (same files, do together).
2. VFX shell nav-item list update (`ROLE_SIDEBAR_ITEMS.vfx_supervisor` → Workspace Home/Review Inbox/Shots) + `RoleSidebar` active-match prefix fix.
3. VFX Workspace Home page (new route, v1 content from existing `fetchVfxInbox` data + `FtrackSyncSummary`).
4. Review Inbox page (client-side-filtered version of current Alignment Inbox content, moved to `/vfx/inbox`).
5. Shots list page (new `/vfx/shots` index; unfiltered/unpaginated v1 acceptable as smallest-safe start; filters as fast-follow still within 7C-1).
6. Shot Workspace outer-hierarchy fixes (breadcrumbs, `currentPath` values).
7. Remove Guided/Explore surface entirely — **last**, once steps 3-6 independently prove Shots/Review Inbox can reach a plain unconfirmed Shot, so Initial-Empty/First-Draft reachability is never lost mid-migration.

**Within 7C-2:** no functional changes — only the shell-prop lines in `IntentWorkspacePage.tsx` from step 6 above; final Intent visual polish explicitly deferred until the new Shell is stable.

**7C-3/7C-4/7C-5:** unchanged scope, not started.

## 14. Risks and preservation safeguards

- **Highest risk**: removing Guided before Shots/Review Inbox can independently surface a plain unconfirmed Shot would silently make Initial Empty/First Draft unreachable — mitigated by sequencing (step 7 last) and by folding the plain-unconfirmed-shot seed into the always-retained rich-seed step *before* deleting the guided path.
- **Second risk**: `RoleSidebar`'s active-match change (`startsWith`) is a shared component touched by every role — must verify CG/Artist sidebars (which also use `RoleSidebar`) aren't affected by the boundary logic (`+ "/"` guard prevents `/vfx` from wrongly prefix-matching `/vfxsomething`).
- **Safeguard**: the completed Step 7C-2 lifecycle (`IntentWorkspacePage.tsx` and everything under `features/vfx/intent-workspace/`) is touched only at the shell-prop level in this plan — zero changes to data fetching, `justConfirmed`, change-summary computation, or any action/validation code.
- **Safeguard**: `request_write_back: false`, HumanGate/Decision persistence, server-resolved actor identity, and conflict handling live entirely outside every file this plan touches.

## 15. Schema-migration conclusion

**None required.** This entire reconciliation is frontend routing/shell/navigation plus a backend seed-function reshuffle (folding a second unconfirmed Shot into existing seed infrastructure) and removal of one filter clause in `vfx_inbox/service.py`. No new column, table, or constraint is implicated anywhere in this audit.

## 16. `git status --short`

```
?? icas-demo-alignment-correction-v4.zip
?? icas-demo-measured-correction-v3.zip
?? icas-demo-reference-code-patch.zip
?? icas-demo-visual-refinement-v2.zip
?? icas-intent-workspace-visual-patch-v1.zip
```
(identical to the pre-audit snapshot — no tracked file changed.)

## 17. Confirmation

This audit was entirely read-only. No file was modified, created (outside this report, written afterward at explicit request), deleted, restored, stashed, staged, committed, reset, switched, or pushed. HEAD remains `ab4cc60`; both stashes are untouched; the completed Step 7C-2 Core Anchor lifecycle implementation was not altered.

## Audit methodology note

Three parallel read-only research agents were used to gather facts (frontend shell/routes/Shot navigation; Demo/role-entry implementation and test inventory; VFX page content classification against the backend read model), all operating directly on the real repository with no worktree isolation (unnecessary for a read-only task, and avoids the worktree-mismatch issue observed in an earlier audit this session). Findings were cross-referential and consistent across agents; no contradictions requiring re-verification were found.
