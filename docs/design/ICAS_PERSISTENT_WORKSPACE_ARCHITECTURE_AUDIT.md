# ICAS Persistent Workspace Architecture Audit

Read-only diagnostic. No code, CSS, or test files were modified while producing this
document. Owner video review confirmed: (1) navigation acknowledgement improved after the
Phase 1 fix; (2) the current full-page loading skeleton is visually unacceptable because the
entire ICAS page disappears and is replaced by rectangular placeholders; (3) the five
contextual tabs inside Shot/Task workspaces still feel slow. This audit determines the
correct persistent-layout architecture before any further fix is implemented.

## 1. Current route/layout tree

```
app/
  layout.tsx                              ← ONLY layout.tsx in the entire app
  loading.tsx                             ← root loading boundary (added in Phase 1)
  vfx/
    loading.tsx                           ← /vfx loading boundary
    page.tsx                              → renders VfxWorkspacePage → AppShell inline
    inbox/page.tsx                        → renders ReviewInboxPage → AppShell inline
    shots/page.tsx                        → renders ShotsListPage → AppShell inline
    shots/[shotId]/
      page.tsx            (Overview)      → ShotOverviewPage → VfxShotWorkspaceFrame → AppShell
      intent/page.tsx                     → IntentWorkspacePage → VfxShotWorkspaceFrame → AppShell
      versions/page.tsx                   → VersionsWorkspacePage → VfxShotWorkspaceFrame → AppShell
      alignment/page.tsx                  → AlignmentWorkspacePage → VfxShotWorkspaceFrame → AppShell
      activity/page.tsx                   → ActivityWorkspacePage → VfxShotWorkspaceFrame → AppShell
  cg/          (identical shape: page.tsx / inbox / tasks / tasks/[taskId]/{overview,execution,version-review,dependencies,activity})
    loading.tsx
  artist/      (identical shape: page.tsx / inbox / tasks / tasks/[taskId]/{overview,current-version,feedback-history})
    loading.tsx
```

**No `layout.tsx` exists below the root.** Every single `page.tsx` — Workspace Home, Inbox,
Shots/Tasks list, and every Shot/Task tab — independently renders `AppShell` itself, either
directly (Home/Inbox/List pages) or through a per-role `WorkspaceFrame` component
(`VfxShotWorkspaceFrame`, `CgTaskWorkspaceFrame`, `ArtistTaskWorkspaceFrame`) that Shot/Task
tab pages call.

Per-level answers:

| Level | `layout.tsx` | `loading.tsx` | Renders AppShell? | Renders sidebar/header? | Renders WorkspaceFrame? | Renders AnchorContextLayer? | Renders ContextTabs? | Recreated on sibling nav? |
|---|---|---|---|---|---|---|---|---|
| ROOT | ✅ (html/body only) | ✅ | no | no | no | no | no | n/a |
| `/vfx`, `/cg`, `/artist` (Home) | ❌ | ✅ | yes, inline in `page.tsx` | yes (inside AppShell) | no | no | no | n/a (single route) |
| `/{role}/inbox`, `/{role}/.../[list]` | ❌ | inherits parent's | yes, inline | yes | no | no | no | n/a |
| `/vfx/shots/[shotId]/**` | ❌ | inherits `/vfx/loading.tsx` | yes, via `VfxShotWorkspaceFrame` | yes | yes | yes | yes | **everything** — AppShell, TopBar, RoleSidebar, Breadcrumbs, AnchorContextLayer, ContextTabs, and the tab body all fully remount |
| `/cg/tasks/[taskId]/**` | ❌ | inherits `/cg/loading.tsx` | yes, via `CgTaskWorkspaceFrame` | yes | yes | yes | yes | same as above |
| `/artist/tasks/[taskId]/**` | ❌ | inherits `/artist/loading.tsx` | yes, via `ArtistTaskWorkspaceFrame` | yes | yes | yes | yes | same as above |

`AppShell`/`TopBar`/`RoleSidebar`/`ContextTabs` are all plain Server-renderable components (no
`"use client"`, no internal fetching, no local state) — they are pure output of whatever props
the page passes them. `AnchorContextLayer` **is** a Client Component (`"use client"`,
`useState`/`useEffect`) that restores its expand/collapse state from `sessionStorage` (keyed
`icas:anchor-context:{role}:{shotId|taskId}` — per-Shot/Task, not per-tab) after mount. Because
there is no layout boundary anywhere in this subtree, Next.js treats every sibling-tab click as
a full segment-tree replacement from `app/vfx/shots/[shotId]/{tabA}/page.tsx` to
`app/vfx/shots/[shotId]/{tabB}/page.tsx` — nothing survives navigation, including
`AnchorContextLayer`, which is why it always shows one frame of `defaultExpanded` before its
`sessionStorage`-restored state applies.

## 2. Why the full-page skeleton flash happens

Root cause: **the `loading.tsx` boundary is exactly as deep as the route segment tree allows,
and the tree has no branch below the role root.** `app/vfx/loading.tsx` is the closest
`loading.tsx` ancestor to *every* route under `/vfx/**` — Workspace Home, Inbox, Shots list,
and all five Shot tabs alike — because nothing narrower exists. When Next.js suspends a
navigating segment, it renders the nearest enclosing `loading.tsx`'s content **in place of
everything that segment tree would have rendered**, including `AppShell` — because `AppShell`
is *inside* the suspended segment (each `page.tsx` renders it), not outside it in a stable
layout. There is structurally no way for the current tree to show "keep the shell, swap the
body" — the shell only exists inside the part that gets replaced.

Mapping to the four flagged transitions:

| Transition | Loading boundary that fires |
|---|---|
| A. Role-entry loading (Role-selection Home → `/vfx` etc.) | `app/loading.tsx` (root) — briefly, until the `/vfx`-scoped `app/vfx/loading.tsx` takes over as the more specific match once the router resolves the target segment |
| B. Workspace Home → Inbox (`/vfx` → `/vfx/inbox`) | `app/vfx/loading.tsx` |
| C. Inbox → Shots/Tasks list, or list → a Shot/Task tab | `app/vfx/loading.tsx` (same one — it's the only boundary in the whole subtree) |
| D. Exit role view (workspace → `/`) | `app/loading.tsx` (root) |

Every one of these — including a same-Shot tab-to-tab click — currently routes through the
*same single* per-role `loading.tsx`, which is why a tab switch looks identical to a full
role-level navigation: architecturally, right now, it is one.

### Recommendation (not implemented)

- **`app/loading.tsx`, `app/vfx/loading.tsx`, `app/cg/loading.tsx`, `app/artist/loading.tsx` —
  retain, but redesign scope once persistent layouts exist.** They remain correct and
  necessary for genuine full-shell transitions (role entry, exit role, Workspace Home ↔ Inbox
  ↔ Shots list — routes that have no shared visual identity to preserve). Their content (the
  generic header+text skeleton) is fine for that job; nothing here needs removing.
- **A new, narrower loading boundary belongs at the Shot/Task tab level** (i.e., inside
  whatever segment ends up isolating tab-body content once a persistent layout exists — see §6
  and §9) so a tab switch only ever suspends the body below the tab strip, never the
  shell/header/AnchorContextLayer/tab strip itself. This is "moved deeper," not a new instance
  of the same component.
- Nothing should be removed outright; the current four are correctly scoped for what they *do*
  still need to cover (see §9).

## 3. Five-workspace-tab audit — route-to-request matrix

For every role, every tab's `page.tsx` independently: reads the role cookie, calls
`resolveIdentity()` (cookie-only, not a network call), then runs **two fetch operations in
parallel** — a page-specific `load*WorkspaceData(id, …)` loader, and a direct
`fetch{Role}AnchorContextOrNull(id, headers)` call made right in the page component (not
inside the loader). `WorkspaceFrame`, `AnchorContextLayer`, and `ContextTabs` are recreated on
every single one of these — there is no route where they persist, including switching between
two tabs of the *same* Shot/Task.

**VFX** (`/vfx/shots/[shotId]/**`):

| Tab | Loader | Backend calls inside loader | Anchor Context fetched? | WorkspaceFrame/Tabs recreated? |
|---|---|---|---|---|
| Overview | `loadShotOverviewData` | `fetchVfxInboxItem`, `listCoreAnchorRevisions`, `listVersionsForShot`, `listCrossRoleAssessmentsForShot`, `fetchDepartmentExecutionOverview`, conditionally `listDecisionsForRevision`, `listReviewNotesForVersion` | yes (separate call in `page.tsx`) | yes |
| Intent | `loadIntentWorkspaceData` | `fetchVfxInboxItem`, `listCoreAnchorRevisions`, conditionally `getHumanGateForRevision`, `getAgentRun`, `getContextSnapshot`, `listIntentDecompositionsForShot`, `listContextReconstructionsForShot`, `listDecisionsForRevision`, `listCrossRoleAssessmentsForShot` | yes | yes |
| Versions | `loadVersionsWorkspaceData` | `fetchVfxInboxItem`, `listVersionsForShot`, `listCrossRoleAssessmentsForShot`, `listReviewNotesForVersion` (per version), `listVfxSupervisorReviews` (per version) | yes | yes |
| Alignment | `loadAlignmentWorkspaceData` | `fetchVfxInboxItem`, `listCrossRoleAssessmentsForShot`, `listVersionsForShot`, `listCoreAnchorRevisions`, `fetchDepartmentExecutionOverview`, conditionally `getAgentRun`, `getContextSnapshot` | yes | yes |
| Activity | `loadActivityWorkspaceData` | `fetchVfxInboxItem`, `getShotActivity` | yes | yes |

**CG** (`/cg/tasks/[taskId]/**`): same shape — every loader (`loadTaskOverviewData`,
`loadExecutionWorkspaceData`, `loadVersionReviewWorkspaceData`,
`loadDependenciesWorkspaceData`, `loadTaskActivityWorkspaceData`) opens with
`fetchCgInboxItem(taskId)`, and every `page.tsx` separately calls `fetchCgAnchorContextOrNull`.

**Artist** (`/artist/tasks/[taskId]/**`): same shape, 3 tabs — every loader
(`loadTaskOverviewData`, `loadCurrentVersionData`, `loadFeedbackHistoryData`) opens with
`fetchArtistInboxItem(taskId)`, every `page.tsx` separately calls
`fetchArtistAnchorContextOrNull`.

Requests triggered by one tab transition: **2 shared base fetches (item + anchor context) + N
page-specific fetches** where N ranges from 2 (Activity) to 6+ (Overview/Alignment with their
nested per-version/per-revision calls).

## 4. Duplicated/shared fetch classification

| Request | Classification | Where duplicated |
|---|---|---|
| `fetch{Role}InboxItem(id)` — the Shot/Task's own identity record | **SHARED WORKSPACE DATA** | Called fresh inside *every single tab loader* for all three roles (5×/5×/3× per role) |
| `fetch{Role}AnchorContextOrNull(id, headers)` | **SHARED WORKSPACE DATA** | Called fresh in *every single `page.tsx`*, all three roles — this is the exact same Anchor Context object `AnchorContextLayer` renders identically on every tab |
| VFX: `listCoreAnchorRevisions(shotId)` | Overlaps: page-specific for Intent, but also re-fetched by Overview | Overview + Intent |
| VFX: `listVersionsForShot(shotId)` | Overlaps | Overview + Versions + Alignment |
| VFX: `listCrossRoleAssessmentsForShot(shotId)` | Overlaps | Overview + Intent + Versions + Alignment (4 of 5 tabs) |
| VFX: `fetchDepartmentExecutionOverview(shotId, headers)` | Overlaps | Overview + Alignment |
| Version-scoped: `listReviewNotesForVersion`, `listVfxSupervisorReviews` | **PAGE-SPECIFIC** — genuinely differs by tab's own selection/detail need | Versions (legitimate) |
| `getAgentRun`, `getContextSnapshot`, `listIntentDecompositionsForShot`, `listContextReconstructionsForShot`, `getHumanGateForRevision` | **PAGE-SPECIFIC** | Intent only |
| `getShotActivity` / `getTaskActivity` | **PAGE-SPECIFIC** | Activity only |
| `listDependenciesForTask`, `RecordDependencyForm` data | **PAGE-SPECIFIC** | CG Dependencies only |

Representative transitions traced:

- **VFX Alignment → Activity**: drops `listCrossRoleAssessmentsForShot`/`listVersionsForShot`/
  `listCoreAnchorRevisions`/`fetchDepartmentExecutionOverview`, re-fetches
  `fetchVfxInboxItem` + anchor context (both identical to what Alignment just fetched) purely
  to get `getShotActivity`.
- **VFX Overview → Intent**: both loaders independently fetch `fetchVfxInboxItem` and
  `listCoreAnchorRevisions` — same Shot, same revision list, fetched twice in a row.
- **CG Overview → Execution**, **Execution → Version Review**: same pattern —
  `fetchCgInboxItem` and the anchor context re-fetched on every hop; execution/version-review
  loaders follow the identical `fetchCgInboxItem`-first structure confirmed via source grep.
- **Artist Task Overview → Current Version → Feedback History**: `fetchArtistInboxItem` and
  anchor context re-fetched at each of the 3 hops.

Not optimized in this pass — this is the evidence set for §9's target architecture to act on
later.

## 5. Role-level persistent layout (`/vfx/layout.tsx` etc.) — feasibility

**Technically safe, moderate scope.** `AppShell`/`TopBar`/`RoleSidebar` have zero
role-specific logic baked in beyond the props already passed (`name`, `role`, `sidebarItems`,
`currentPath`, `onExitRole`) — they're identical shells with different data. A `layout.tsx`
per role prefix would:

- Read the role cookie / `resolveIdentity()` once (a layout is itself an async Server
  Component, same capability `page.tsx` has), gate identity exactly as `middleware.ts` + each
  page's defense-in-depth check already do — **no permission logic changes**, it just moves
  from 12+ duplicated call sites to 3 (one per role layout).
- Render `AppShell` once; `children` becomes whatever the leaf page renders below it.
- Preserve `middleware.ts` entirely unchanged — it's the authoritative gate and doesn't care
  where `AppShell` lives.
- Preserve the demo-role-cookie mechanism unchanged — `enterDemoRole`/`exitRoleView` only ever
  set/clear a cookie and `redirect()`; nothing about them assumes a particular component tree.

**Do not default to three near-duplicate `layout.tsx` files** if it can be avoided: since all
three shells are structurally identical (only the role-specific data differs, already resolved
via `resolveIdentity()`), a single **route-group layout** (`app/(role)/layout.tsx` is not
directly expressible over three *different* top-level segments `vfx`/`cg`/`artist` without a
shared parent path — Next.js route groups `(name)` don't change the URL, so `app/vfx`,
`app/cg`, `app/artist` would need to move under one `(workspace)` group folder, e.g.
`app/(workspace)/vfx/...`, for a single `app/(workspace)/layout.tsx` to cover all three).
That's a real, if mechanical, file-tree move (not a rewrite) versus three independent small
layout files. Recommend evaluating at implementation time whether the route-group move is
worth it purely to avoid ~30 lines of duplication three times — three thin layouts, each
delegating to one shared internal component for the actual identity-resolution + `AppShell`
render, gets 90% of the same de-duplication with zero route-tree reshuffling risk. Either is
workable; the route-group version has slightly higher mechanical churn (every existing file
under `vfx/`/`cg`/`artist` moves one directory level), the three-small-layouts version has
near-zero structural churn. **Recommend the three-small-layouts approach** given "no unrelated
changes" is a standing project rule — it doesn't require moving every existing file.

Regression risk: **low**, contingent on removing `AppShell` from Home/Inbox/List `page.tsx`
files (and each tab's `WorkspaceFrame`, see §6) at the same time the layout is added, and
updating the small number of component-level tests (§10) that currently render a page
component in isolation and implicitly get `AppShell` in the output.

## 6. Shot/Task-level persistent layout — feasibility

**Technically appropriate and is where the actual tab-navigation win lives**, but has more
moving parts than §5 because `WorkspaceFrame` currently does double duty: it's both the shell
wrapper *and* the place `item`/`anchorContext` (fetched fresh per-page) get threaded through as
props.

Per role, what `WorkspaceFrame` currently needs and where it would come from at layout level:

| Role | Props `WorkspaceFrame` needs today | Source today | Could move to layout? |
|---|---|---|---|
| VFX | `item` (`VfxInboxItemRead`), `anchorContext`, `activeTab`, `unavailable`, `onExitRole` | `item`/`anchorContext` come from each page's own loader + anchor-context call; `activeTab` is hardcoded per page file | `item` + `anchorContext`: **yes** — fetch once in `app/vfx/shots/[shotId]/layout.tsx`, both are Shot-identity-scoped, not tab-scoped. `activeTab`: **no**, this is inherently a leaf concern — a layout can't know which of its children segment is active without reading the pathname itself (doable via `usePathname()` in a client wrapper, or restructuring `ContextTabs` to self-derive active state — see §7) |
| CG | same shape, `CgInboxItemRead` | same | same |
| Artist | same shape, `ArtistInboxItemRead` | same | same |

Page-specific data that **must** stay in the page (leaf) segment: everything in the
"PAGE-SPECIFIC" column of §4 — `listReviewNotesForVersion`, `getShotActivity`,
`listDependenciesForTask`, evidence/provenance chains for Intent, etc. None of that is safe or
sensible to hoist; it's genuinely different per tab.

Would layout-level fetching reduce repeated requests? **Yes, substantially** —
`fetch{Role}InboxItem` and the Anchor Context fetch each currently fire once per tab (5×/5×/3×
per Shot/Task visit across a session); moving them to the layout means they fire once per
Shot/Task *entry*, then persist for however long the user stays within that Shot/Task's tabs
(React Server Component layouts re-render on navigation but are not literally cached across
requests by default — the real win is structural correctness and eliminating the
*duplicate-in-the-same-request-waterfall* pattern, not an automatic cross-navigation cache; see
caveat below).

**Mutation/revalidation implications**: several tabs contain real mutations
(`GenerateAssessmentButton`, `PublishResolvedVersionButton`, `RecordDependencyForm`,
`ExecutionAnchorEditor`, Core Anchor confirm/reject actions). Today each mutation's Server
Action presumably triggers a `revalidatePath`/`router.refresh()` scoped to that tab's own page,
which re-runs that page's own loader — fine, unaffected. If `item`/`anchorContext` move to the
layout, a mutation that changes the Shot/Task's identity or Anchor state (e.g., confirming a
Core Anchor revision) must revalidate the **layout's** segment too, not just the leaf page, or
the persisted AnchorContextLayer would show stale data after a mutation on a different tab.
This is a real, concrete implementation risk to flag, not a blocker — it just means each
mutation's revalidation scope needs auditing as part of the actual implementation, not assumed.

**sessionStorage/client-state implications**: `AnchorContextLayer`'s expand/collapse state is
already keyed per-Shot/Task (not per-tab) via `sessionStorage`, so making it layout-persistent
*removes* the one-frame flicker described in §1 (defaultExpanded → sessionStorage-corrected)
rather than introducing any new state problem — this is a straightforward improvement, no new
hazard.

**Can `WorkspaceFrame` become a layout-level wrapper without changing product behavior?**
Structurally yes for the shell/header/AnchorContext/tabs portion; the `activeTab`/labeling
logic needs to move into `ContextTabs` itself (deriving active state from the real URL rather
than being told by the caller) or into a small client wrapper — a real code change, not a
copy-paste move, but bounded and mechanical. No visual or product-behavior change is required
by this move itself.

## 7. Tab click feedback — why it doesn't acknowledge, and low-risk options

`ContextTabs` renders each tab as a plain `<Link href={tab.href}>` with
`aria-current`/`data-active` derived from `activeTabId` — a prop passed down from the
server-rendered page, not derived client-side. There is no `onClick`, no pending state, no
client component at all in the current `ContextTabs`. A click is a completely ordinary
Next.js `<Link>` navigation: the browser's own default link behavior plus Next's client-side
router take over, but nothing in this component tree observes or displays the in-flight state
— combined with §2's finding (the nearest `loading.tsx` is role-wide, so the *only* observable
feedback for a tab click today is that same full-page skeleton, which read as "the click did
nothing" until it fires, per the Phase 1 diagnostic).

Available official Next.js 15.5.20 / React 18.3 mechanisms, in order of how surgically they
solve "acknowledge the click, load only the body":

1. **`useLinkStatus()`** (Next.js's built-in hook for exactly this, stable since 14.x, present
   in 15.5) — must be called from a Client Component rendered *inside* a `<Link>` (e.g., a
   small "TabLink" wrapper around each `<Link>`), giving `{ pending: boolean }` scoped to that
   specific link's own navigation. This is the most precise, lowest-risk option: it needs
   `ContextTabs` (or a new thin per-tab child) converted to a Client Component, but touches
   nothing else — no routing change, no data-fetching change.
2. **Segment-level `loading.tsx` once §6's layout split exists** — once tab bodies live in a
   segment distinct from the persistent shell, a `loading.tsx` at that narrower segment gives
   the framework-native "loading only the body below the tab strip" behavior for free, no
   per-tab client code needed. This is the long-term correct answer but depends on §6 landing
   first.
3. **`usePathname()` + local pending flag**, manually comparing the clicked tab's `href`
   against the current pathname to render a transient "active-but-loading" class until the URL
   actually updates — more manual than option 1, no real advantage over it.

No library install needed for any of these — all are built into the installed
Next.js/React versions. **Preferred combination for implementation**: option 1
(`useLinkStatus`) for the immediate "the tab visibly registers the click" feedback
(independent of the layout refactor, could ship first), plus option 2 once §6's persistent
layout exists, so the two fixes compose: instant visual acknowledgment on click, then a
lightweight body-only skeleton instead of the current full-page one.

## 8. Dev-compile vs. real-fetch evidence

Sampled directly from the running `infra-web-1` container's existing log history (no restart,
no rebuild):

| Route | First hit (cold compile + fetch) | Warm repeats |
|---|---|---|
| `/vfx/shots/[shotId]/alignment` | 3067ms (module compile: 2.3s for 831 modules) | 394ms, 213ms, 353ms, 1876ms*, 379ms, 246ms, 191ms |
| `/vfx/shots/[shotId]/activity` | 2011ms (compile: 1069ms, 1372 modules) | *(only one sample captured)* |
| `/vfx/shots/[shotId]` (Overview) | 2821ms | *(only one sample captured)* |
| `/cg/tasks/[taskId]/version-review` | 1801ms (first in its cluster) | **overwhelming majority 130–360ms**, occasional 400–540ms, rare outliers (4251ms once, a 500 once, a couple 404s during dev iteration — not representative of steady state) |
| `/cg/tasks/[taskId]/dependencies` | 1713ms / 1348ms | *(limited samples)* |
| `/artist/tasks/[taskId]` | 2883ms | — |
| `/artist/tasks/[taskId]/current-version` | 2281ms | 573ms |

\*occasional warm requests above 1s likely correspond to a fresh dev-server module
invalidation from an edit made elsewhere in the session, not steady-state cost.

**Separation:**

- **DEV COMPILE**: the 1.5–3s+ first-hit numbers, each paired with an explicit
  `✓ Compiled /path in Nms (M modules)` log line immediately before it — this is Next.js
  dev-mode's on-demand route compilation, confirmed distinct from fetch cost because it's
  logged separately.
- **REPEATED SHARED DATA FETCH** (item + anchor context, both re-fetched every tab hop per
  §4): not separately measurable from these logs alone (Next.js logs total request duration,
  not per-fetch breakdown), but architecturally this is the "always at least 2 backend round
  trips regardless of tab" tax described in §3/§4.
- **PAGE-SPECIFIC FETCH**: the remainder of each request's warm duration once compile is
  excluded — CG Version Review's tight 130–360ms warm clustering is consistent with the
  previously-confirmed ~0.3–0.5s (or better) real backend floor; VFX Alignment's warm
  200–400ms range is similar. Nothing in this log evidence suggests the warm floor is
  materially different from what the Phase 1 diagnostic already established — this session's
  logs corroborate rather than revise that number.

## 9. Recommended target architecture

**A. Role-level navigation** (Role-selection Home ↔ `/vfx`, `/cg`, `/artist`, and Exit role
view): stays exactly as it is today — a full shell mount is correct here, since there is no
shared visual identity between "no role selected" and "inside a role workspace." `app/loading.tsx`
continues to own this transition.

**B. Shot/Task tab navigation**: introduce `app/vfx/shots/[shotId]/layout.tsx`,
`app/cg/tasks/[taskId]/layout.tsx`, `app/artist/tasks/[taskId]/layout.tsx` (paired with the
three role-level layouts from §5, or the route-group alternative). The layout fetches `item` +
`anchorContext` once and renders `AppShell` + `Breadcrumbs` +
`TaskContextHeader`/`ProductionContextHeader` + `AnchorContextLayer` + `ContextTabs` —
everything currently inside `WorkspaceFrame` except the tab body. `children` becomes just the
tab's own content. This is the only thing that makes tabs persistent: role-level layout alone
(§5) does not touch this, since the remount problem is really at the Shot/Task level, not the
role level.

**C. Loading feedback**: the existing four role-level `loading.tsx` files keep their current
job (role entry, exit, Home ↔ Inbox ↔ List transitions — routes with no persistent shell to
preserve). A new, narrower `loading.tsx` sits inside each Shot/Task segment, below the new
layout, so it only ever replaces the tab body — shell, header, AnchorContext, and tab strip all
stay mounted and visible while it shows.

**D. What happens to the current full-screen skeletons**: unchanged in scope for role-level
transitions (B above still correctly full-screen there); **effectively retired for tab-to-tab
navigation**, since that traffic now hits the new narrower boundary instead.

**E. Tab click/pending feedback**: `useLinkStatus()` inside a small Client Component wrapper
around each `ContextTabs` link (§7, option 1), giving instant visual acknowledgment independent
of and prior to the narrower loading boundary taking over.

**F. Shared fetching eliminated**: `fetch{Role}InboxItem`/`fetch{Role}AnchorContextOrNull` move
from "once per tab, every tab" to "once per layout render" — collapsing 5 (VFX/CG) or 3
(Artist) duplicate item-fetches and 5/3 duplicate anchor-context fetches per Shot/Task visit
down to one each at the point of entry. The additional VFX-specific overlaps in §4
(`listCoreAnchorRevisions` Overview+Intent, `listVersionsForShot` Overview+Versions+Alignment,
`listCrossRoleAssessmentsForShot` across 4 of 5 tabs, `fetchDepartmentExecutionOverview`
Overview+Alignment) are **not** proposed for elimination here — they're deeper page-specific
loader overlaps that would need their own dedicated pass (possibly a shared per-Shot/Task cache
or a differently-shaped loader), separate from the persistent-layout structural fix. Flagging
this explicitly rather than folding it into this recommendation, since the instruction was to
identify, not yet optimize, and this second layer is a materially different, smaller-value
change than the layout restructure.

## 10. Implementation scope estimate + regression risk

**New files:**

- 3 role-level `layout.tsx` (`vfx`, `cg`, `artist`) — or 1 shared `(workspace)/layout.tsx` if
  the route-group path is chosen (see §5 tradeoff)
- 3 Shot/Task-level `layout.tsx` (`vfx/shots/[shotId]`, `cg/tasks/[taskId]`,
  `artist/tasks/[taskId]`)
- 3 narrower `loading.tsx`, one per Shot/Task layout segment
- 1 small Client Component wrapper for `useLinkStatus()`-based tab pending state

**Files likely to change:**

- `VfxShotWorkspaceFrame.tsx`, `CgTaskWorkspaceFrame.tsx`, `ArtistTaskWorkspaceFrame.tsx` —
  lose their `AppShell`/shell-rendering responsibility, become (or get replaced by) the new
  layouts; `activeTab` handling moves into `ContextTabs` or the pending-state wrapper
- `ContextTabs.tsx` — gains active-tab self-derivation and/or the `useLinkStatus` wrapper
- Every Shot/Task tab `page.tsx` (13 files: 5 VFX + 5 CG + 3 Artist) — drops the now-layout-owned
  `item`/`anchorContext` fetch, keeps only its page-specific loader call, and its component
  signature loses `item`/`anchorContext`/`unavailable`/`onExitRole` props that the layout now
  owns
- Each tab's `*Page.tsx` component (e.g. `AlignmentWorkspacePage.tsx`, `VersionReviewPage.tsx`,
  `CurrentVersionPage.tsx`) — currently receives and forwards `item`/`anchorContext`/
  `unavailable`/`onExitRole` to `WorkspaceFrame`; these props and the forwarding logic go away,
  page components render only their own body content
- Workspace Home / Inbox / Shots-Tasks-list `page.tsx` files (9 files: 3 roles × {home, inbox,
  list}) — drop their own inline `AppShell` render if absorbed into the role-level layout

**Tests affected:**

- Every `*Page.test.tsx` for the 13 tab pages currently renders the page component standalone
  and gets `AppShell`/`Breadcrumbs`/`ContextTabs` "for free" in the output — these tests will
  need their setup changed (either wrap the rendered component in a test harness that supplies
  the layout, or move shell-related assertions out) once the shell moves to a layout the unit
  test doesn't naturally exercise. This is real, non-trivial test-suite churn, not a one-line
  fix — 13+ test files at minimum, likely more once Home/Inbox/List page tests are included.
- `AppShell.test.tsx`, `RoleSidebar.test.tsx`, `RoleSelectionHome.test.tsx` — the only 3 files
  currently asserting `AppShell`/"Role navigation" directly; low risk, these test the shell
  component itself, largely unaffected by where it's mounted.
- Any test currently rendering a `WorkspaceFrame` component directly needs updating to match
  its new (layout or shell-only) shape.

**Locked-page regression risk:**

| Locked page | Risk | Why |
|---|---|---|
| **VFX Alignment** | Medium | `AlignmentWorkspacePage.tsx` loses direct control of `item`/`anchorContext`/`onExitRole` plumbing; its *rendered content* (the actual locked visual/IA) does not change, but its component signature and test harness do. `DepartmentExecutionStrip`/`GenerateAssessmentButton`/`HumanAttentionAction` are unaffected internally. |
| **CG Version Review** | Medium | Same shape of risk as VFX Alignment; additionally `AnchorContextLayer`'s `variant="review"` prop (currently threaded through `CgTaskWorkspaceFrame`) needs to keep flowing correctly once that logic moves into a layout — a real detail to get right, not just relocate. |
| **Artist Current Version** | Medium | Same shape; also has a `searchParams`-driven `?version=` selection currently read in `page.tsx` — needs to keep working as a leaf-page concern, not accidentally hoisted to the layout (a layout doesn't receive the same `searchParams` the way a page does in all Next.js versions — this needs explicit verification during implementation, flagged here as a real risk, not assumed safe). |
| **VFX Review Inbox** | Low | This page has no `WorkspaceFrame`/tab concept at all — only affected if role-level layout (§5) also absorbs `AppShell` from Inbox pages, which is a smaller, more mechanical change than the Shot/Task-level one. |

Per the standing instruction, in every case the **rendered product content/layout of these
four pages does not change** — only the route-wrapper architecture around them does. The risk
is entirely in "did the refactor correctly preserve identical props/behavior through a
different plumbing path," which is a real, testable risk, not a redesign risk.

## 11. Stop condition

Read-only diagnostic complete. No code, CSS, or tests were changed. Stopping here for owner
review before any implementation.
