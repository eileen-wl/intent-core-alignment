# ICAS Navigation Responsiveness — Persistent Workspace Architecture: Implementation Report

Companion to `ICAS_PERSISTENT_WORKSPACE_ARCHITECTURE_AUDIT.md` (the diagnostic). This document reports what was implemented, not a new diagnostic pass.

**Status at the time of writing: implementation + audit evidence only, pending owner browser/video review.**

**Update (checkpoint):** owner browser/video review has since **accepted** the navigation interaction this report describes. Two follow-up turns after this report also fully superseded the route-loading-skeleton approach documented in §§1, 10, 11, 18 below (`RouteLoadingState`, `TabBodyLoadingState`, and every `loading.tsx` route boundary named here): all of them were deleted outright. The accepted final state keeps the current route's content visible during navigation instead, acknowledged via `PendingLinkContent`/`ContextTabs`' `useLinkStatus()` treatment. The persistent-layout architecture (role layouts, object layouts, `RoleWorkspaceLayout`, `ObjectWorkspaceChrome`, mutation revalidation) described below remains exactly as implemented here. See `git log`/the checkpoint commit for the final accepted state; this report is left otherwise unmodified as the historical record of this turn's work.

## 1. Files added (18)

- `app/_shared/RoleWorkspaceLayout.tsx`, `.test.tsx`
- `app/_shared/ObjectWorkspaceChrome.tsx`, `.test.tsx`
- `app/vfx/layout.tsx`, `app/cg/layout.tsx`, `app/artist/layout.tsx`
- `app/vfx/shots/[shotId]/layout.tsx` + `.test.tsx`, `app/cg/tasks/[taskId]/layout.tsx` + `.test.tsx`, `app/artist/tasks/[taskId]/layout.tsx` + `.test.tsx`
- `app/{vfx,cg,artist}/loading.tsx` + `app/loading.tsx` (root, pre-existing role-entry pattern kept) + their `.test.tsx` files
- `app/vfx/shots/[shotId]/loading.tsx`, `app/cg/tasks/[taskId]/loading.tsx`, `app/artist/tasks/[taskId]/loading.tsx`
- `design/components/TabBodyLoadingState.tsx` + `.module.css`
- `design/components/RouteLoadingState.tsx` + `.module.css` + `.test.tsx` (extracted from a pre-existing inline pattern)

## 2. Files changed

Navigation-architecture scope only: 13 tab-page components, 13 `page.tsx` callers, 9 home/inbox/list pages + their `page.tsx` callers, `RoleSidebar.tsx`, `AppShell.tsx`, `ContextTabs.tsx` + `.module.css`, `design/components/index.ts`, 5 `actions.ts` files, and ~35 corresponding test files.

Files carrying pre-existing, uncommitted Visual Language migration edits (`ArtistWorkspacePage.module.css`, `artistWording.ts`, `RoleEntryButton.*`, `*WorkItemRow.module.css`, `RoleSelectionHome.*`, etc.) were **not touched** this turn, per §18 of the instruction.

## 3. Files deleted (3)

`VfxShotWorkspaceFrame.tsx`, `CgTaskWorkspaceFrame.tsx`, `ArtistTaskWorkspaceFrame.tsx` — superseded by the object layouts.

## 4. Final role-layout hierarchy

```
app/{vfx,cg,artist}/layout.tsx
  -> RoleWorkspaceLayout (Server Component)
       resolveIdentity(), redirect on role mismatch
       renders AppShell (TopBar, RoleSidebar, exit-role)
  -> {children} = Home/Inbox/List page, or the object-layout subtree
```

## 5. Final Shot/Task-layout hierarchy

```
app/{vfx/shots,cg/tasks,artist/tasks}/[id]/layout.tsx
  fetches `item` + `anchorContext` once
  -> ObjectWorkspaceChrome (Client Component)
       Breadcrumbs, role's ContextHeader, AnchorContextLayer, ContextTabs
       pathname-derived active tab / review-variant logic
  -> {children} = tab body only
```

## 6. AppShell ownership, before → after

**Before:** instantiated independently in 9 home/inbox/list pages + 3 `*WorkspaceFrame` components (12 call sites, re-rendered on every navigation within a role).

**After:** 1 call site per role (`RoleWorkspaceLayout`), persists across all same-role navigation.

## 7. WorkspaceFrame ownership, before → after

**Before:** 3 monolithic frame components (AppShell + object chrome + Anchor Context + tabs + page body, all re-rendered per tab click).

**After:** deleted; responsibilities split between the persistent object `layout.tsx` (identity/Anchor fetch + chrome) and `ObjectWorkspaceChrome` (presentation), with tab bodies as isolated `{children}`.

## 8. RoleSidebar active-state solution

Added `"use client"` + `usePathname()` internally; dropped the `currentPath` prop entirely. No visual change.

## 9. ContextTabs active/pending solution

`usePathname()`-derived `isActive` (was prop-derived). New `TabPendingIndicator` child component uses `useLinkStatus()` and renders a subtle neutral (`--text-muted`, not purple) underline/opacity treatment with `aria-busy`, guarded by `prefers-reduced-motion`. No spinners, no migration to `router.push`, no third-party progress library.

## 10. Role-level loading behavior

`app/{vfx,cg,artist}/loading.tsx` now renders only inside the persistent role layout's child region (verified: `RoleWorkspaceLayout` owns `AppShell`, `loading.tsx` sits below it in the tree) — no duplicate shell inside the loading state.

## 11. Object-level body-loading behavior

`app/{vfx/shots,cg/tasks,artist/tasks}/[id]/loading.tsx` renders `TabBodyLoadingState` (smaller than the full-page `RouteLoadingState`, no header block) — replaces only the tab body; breadcrumb/header/Anchor Context/tabs are owned by the layout above and are unaffected by a leaf's `loading.tsx`.

## 12. Shared item/Anchor fetch call sites, before → after

**Before:** duplicated in every leaf `page.tsx`/`*WorkspaceFrame` (13+ call sites).

**After:** owned once per object type in the 3 layout files. Verified by `git grep` that **zero** leaf `page.tsx` files call `fetch{Role}InboxItem`.

Four tab bodies retain their own `fetch{Role}AnchorContextOrNull` call because their own render logic depends on it directly — Next.js has no layout→page data-passing mechanism. This is an intentional, documented exception, not a miss:

- `vfx/shots/[shotId]/page.tsx`
- `cg/tasks/[taskId]/execution/page.tsx`
- `cg/tasks/[taskId]/page.tsx`
- `artist/tasks/[taskId]/page.tsx`

## 13. CG review-variant preservation

`ObjectWorkspaceChrome` accepts `reviewVariantTabId="version-review"`; variant is computed from the pathname-derived active tab, so only `/cg/tasks/{id}/version-review` gets `variant="review"` — all other CG tabs get the standard variant. Covered by a dedicated layout test asserting the review-only "Show full context →" collapsed-state text appears solely on that route.

## 14. Artist Anchor initial/remembered-state preservation

`AnchorContextLayer` now mounts once per Task (inside the persistent layout) instead of once per tab, so its `sessionStorage`-backed expand state (`icas:anchor-context:{role}:{id}`) naturally persists across sibling-tab navigation — this is a byproduct of the architecture, not new code. Initial default-expanded/collapsed per entry route is computed from the active tab in `ObjectWorkspaceChrome`.

## 15. Artist `?version=` preservation

Left entirely as a leaf-page concern in `CurrentVersionPage.tsx`/its `page.tsx`; not hoisted into `app/artist/tasks/[taskId]/layout.tsx`. Existing tests for direct URL entry, version switching, and tab-away/back still pass unchanged.

## 16. Mutation/revalidation audit table

| Mutation (file) | Affects layout-owned Anchor Context? | Existing revalidation (before) | Change made |
|---|---|---|---|
| Core Anchor draft create/save/generate, confirm, reject (`vfx/intent-workspace/actions.ts`) | Yes | `revalidatePath('/vfx/shots/{id}/intent')` + `'/vfx/shots/{id}'` (page-type only) | Added `revalidatePath('/vfx/shots/{id}', 'layout')` to the shared `revalidateIntentAndOverview` helper |
| `saveCoreAnchorDraftAction` (in-progress draft edit only) | Unlikely (pre-confirm draft content, not summary state) | Narrower single page-type call, unchanged by original author | Left as-is — preserves the original author's own broad-vs-narrow scoping judgment |
| Cross-role Assessment generation (`vfx/alignment-workspace/actions.ts`) | Yes (attention_level / next_action) | Page-type calls to `/alignment`, `/{id}`, `/vfx` | Added `revalidatePath('/vfx/shots/{id}', 'layout')` |
| Execution Anchor draft create/generate/save, confirm, reject; CG Supervisor review; dependency actions; escalate (`cg/actions.ts`, shared `revalidateTaskRoutes`) | Yes | Page-type calls only | Added `revalidatePath('/cg/tasks/{id}', 'layout')` to the shared helper |
| Guidance generation, Publish Resolved Version (`artist/actions.ts`, shared `revalidateTaskRoutes`) | Yes | Page-type calls only | Added `revalidatePath('/artist/tasks/{id}', 'layout')` to the shared helper |
| Creative Review generation (`vfx/versions-workspace/actions.ts`) | No (Version-scoped, not Anchor-scoped) | Page-type call to `/versions` only | Left as-is |
| `resolveVersionMediaAction` (`vfx/versions-workspace/actions.ts`) | No | Explicitly no revalidation (documented in code) | Left as-is |

**Root cause**, confirmed by reading `CoreAnchorRevisionEditor.tsx`: after confirming a Core Anchor revision, the client does `router.push('/vfx/shots/{id}/intent?justConfirmed=...')` — same route, no `router.refresh()`. Since none of the pre-existing `revalidatePath` calls used the `'layout'` type, the shared object layout's own cached Anchor Context fetch would have kept serving pre-confirmation data after this exact user action — the highest-visibility mutation in the app.

The fix is one additional `revalidatePath(path, "layout")` call per existing shared helper, added only where the codebase's own prior narrow/broad scoping already indicated "this mutation matters beyond its own page." No broadened scope, no domain-behavior change, no new mutation logic.

## 17. Locked-page wrapper changes / body-CSS confirmation

VFX Alignment, CG Version Review, Artist Current Version, VFX Review Inbox — body markup, content, and `.module.css` are byte-for-byte unchanged. Only removed: prop plumbing (`unavailable`, `onExitRole`, duplicated `anchorContext` forwarding where not needed) and the enclosing `WorkspaceFrame`/`AppShell` JSX. No body visual component required a change; nothing hit the STOP condition in §17.

## 18. Tests updated

- 3 new layout-primitive test files (12 tests)
- 3 new object-layout test files (14 tests)
- `RoleSidebar` / `AppShell` / `ContextTabs` tests updated for new prop signatures
- `RouteLoadingState` / `TabBodyLoadingState` tests (new)
- 4 role `loading.test.tsx` (new)
- 22 leaf-page/component test files updated (prop removal + 3 semantic rewrites where tests asserted on `AnchorContextLayer` output no longer co-rendered in isolation: CG `TaskOverviewPage.test.tsx` ×2, Artist `TaskOverviewPage.test.tsx` ×1, VFX `ShotOverviewPage.test.tsx` ×1)
- 11 `page.test.tsx` route-level tests updated for the 13 leaf pages' `resolveIdentity()`-based auth-check consolidation (see "Redirect-scope reconciliation" below) — the tests originally landed asserting a `/demo` → `/` redirect-target change; that destination change was reverted (redirect target restored to `/demo`, its pre-refactor value) after a follow-up scope audit, so these 11 tests were touched twice: once for the consolidation, once to restore the original `/demo` assertion

## 19. Validation results

- `tsc --noEmit` — 0 errors
- `vitest run` — **145 files / 1200 tests passing**
- ESLint — 0 errors (1 pre-existing unrelated warning in `CoreAnchorRevisionEditor.tsx`, not touched this turn)
- Prettier — clean on all edited files
- `git diff --check` — clean, no whitespace errors
- No commit, no push made

## 20. Runtime/log evidence

`infra-web-1` (up 35h, not restarted) hot-reloaded cleanly through every edit in this turn, last compile at 20:39 with 0 errors. No browser-driven navigation traffic exists in the logs since the refactor landed — the only post-refactor requests are two smoke-check `curl` GETs issued to `/vfx/shots/{id}` and `/vfx/shots/{id}/alignment`, both `200`, confirming server-side rendering succeeds for both the object overview and a locked sibling tab.

**This is not evidence of client-side layout persistence** — `curl` makes a fresh request each time and has no Router Cache; per §22 it was not used to claim that behavior. Actual tab-to-tab persistence, pending-tab feedback, and the elimination of the full-page skeleton flash can only be confirmed by owner browser/video review.

## Remaining known latency this refactor deliberately does not address

- The four intentional per-page `fetchXAnchorContextOrNull` duplicates (see item 12)
- The deeper VFX cross-page data overlaps flagged out-of-scope in §6 of the instruction (Versions shared between Overview/Versions/Alignment, cross-role assessments, Core revisions, Department Execution)
- No route-group (`(workspace)`) restructure was performed — thin per-route `layout.tsx` files delegating to shared primitives, as directed

## Addendum: redirect-scope reconciliation

A follow-up audit flagged that item 18 originally read "...updated for the `/demo` → `/` redirect change" — the architecture turn was not authorized to change redirect destinations except where mechanically unavoidable and behavior-equivalent.

**Findings:** all 13 leaf tab `page.tsx` files (5 VFX, 5 CG, 3 Artist) had their defensive, unreachable-in-practice role-mismatch check consolidated from a raw `cookies()` + `DEMO_ROLE_COOKIE` read (plus a second, redundant `resolveIdentity()` call inside the data-fetch `try` block) into a single `resolveIdentity()` call — a genuine, positive correctness cleanup, since the old code's outer gate compared a raw cookie string while the new code checks `identity.role` directly from one resolved identity. Incidentally, the redirect destination on that check was also changed from `redirect("/demo")` to `redirect("/")`.

`app/demo/page.tsx` is a pre-existing (Step 7C-1), unrelated-to-this-turn permanent redirect: `redirect("/")` unconditionally. So the destination change was **behavior-equivalent** for any user who could actually reach it — but the check itself is unreachable in practice, since `app/{vfx,cg,artist}/layout.tsx` (added this turn) already gates the whole route tree before any leaf page runs, so both the check and its destination are dead code in normal operation.

**Classification: B — behavior-equivalent mechanical change**, not required by the persistent-layout architecture (the layout's own gate makes this leaf-page check redundant regardless of which literal string it redirects to).

**Decision:** reverted. The destination change was discretionary, not "mechanically unavoidable" as the change-boundary required, so scope preservation won out over the (real but immaterial, since the code path never fires) tidiness of standardizing on `/`. All 13 production files' redirect target were restored to `redirect("/demo")`; the `resolveIdentity()` consolidation itself was kept (it is a genuine correctness improvement, independent of the destination question). The 11 corresponding `page.test.tsx` files were updated to re-assert `/demo`. Focused regression (12 files / 38 tests) and the full suite (145 files / 1200 tests) pass; `tsc --noEmit` is clean.

---

**At the time of writing, this report did not declare the interaction fixed** — it was implementation and audit evidence pending owner browser/video review. That review has since accepted the interaction (see the Update note at the top of this document for what changed in the interim).
