# ICAS Inbox Role-Semantics Audit + Navigation Responsiveness Diagnosis

> **Status:** Read-only diagnostic. No application source, CSS, tests, or docs were modified to produce this document — see §4 for git confirmation. Recommendations below are proposals only; none have been implemented.
> **Parent authority:** `docs/design/ICAS_DESIGN.md`, `docs/design/ICAS_VISUAL_LANGUAGE_V1.md`, `docs/design/ICAS_FULL_PRODUCT_MIGRATION_MAP.md`
> **Purpose:** Answer two separate open questions before continuing implementation — (A) whether the Worklist-family Inbox pages should surface different role-specific states per work-item type within their now-shared row grammar, and (B) whether the user-observed navigation unresponsiveness across the app is a dev-environment artifact, a real application-logic issue, or both.
> **Scope note:** Part A does not reopen the Worklist-family visual structure (already converged to the locked VFX Review Inbox grammar). Part B does not implement any fix.

---

# 1. Inbox semantic audit

## Inbox semantics matrix

| Role | Work-item type (focus_type) | Current badge | Available real state fields on the _work item_ | Most relevant state | Recommendation | Reason |
| --- | --- | --- | --- | --- | --- | --- |
| VFX | `core_anchor_gate_pending` | Core Anchor confirmed/draft/none | `coreAnchorState` | Core Anchor state | _(locked, not audited for change)_ | Reference only |
| VFX | `core_anchor_draft_needs_review` | Core Anchor state | `coreAnchorState` | Core Anchor state | _(locked)_ | — |
| VFX | `alignment_not_followed_by_anchor_action` / `assessment_generation_available` | Core Anchor state | `coreAnchorState` | Core Anchor state (indirectly relevant — gates whether anchor action is expected) | _(locked)_ | Noted for context only: by this point in the precedence chain, Core Anchor is almost always "confirmed," so the badge carries less differentiating information for this specific category than for the first two — not a recommendation to change the locked page, just a parallel observation that motivated re-checking CG/Artist |
| VFX | `version_review` / `version_review_available` | Core Anchor state | `coreAnchorState` | Core Anchor state (real precondition — version review is blocked without it) | _(locked)_ | — |
| VFX | `escalation` (CG→VFX) | Core Anchor state | `coreAnchorState` | Core Anchor state | _(locked)_ | — |
| CG | `execution_anchor_gate_pending` ("Execution Anchor confirmation") | Execution Anchor confirmed/draft/none | `executionAnchorState` | Execution Anchor state — **directly the subject** | **KEEP CURRENT BADGE** | The work item literally is "confirm this Execution Anchor draft" |
| CG | `execution_anchor_draft_needs_review` ("Draft review") | Execution Anchor state | `executionAnchorState` | Execution Anchor state — directly the subject | **KEEP CURRENT BADGE** | Same object, draft-lifecycle variant |
| CG | `dependency_needs_attention` ("Dependency review") | Execution Anchor state (e.g. "confirmed") | `executionAnchorState` only — **`open_dependency_count` exists on `CgInboxItemRead` but is NOT currently threaded onto `CgReviewWorkItem`** | Dependency count, not Execution Anchor state | **USE DIFFERENT EXISTING STATE** (`open_dependency_count`, once exposed on the work-item model) — until that plumbing exists, **NO BADGE** is more honest than the current one | The work item's real trigger is an open `TaskDependency`, unrelated to whether the Execution Anchor happens to be confirmed. `executionAnchorState` **can** vary across dependency items (it isn't gated on any particular Execution Anchor state in the backend precedence), so it isn't meaningless — but it isn't the thing the item is _about_, and showing it risks reading as "this row is about anchor state" |
| CG | `version_review_available` ("Version review") | Execution Anchor state | `executionAnchorState` — per its own backend doc comment, "only meaningful (and only ever True) once a confirmed Execution Anchor revision exists" | None more relevant is available on the work item today | **NO BADGE**, or keep as low-emphasis context | Because `version_review_available` is only ever true when the Execution Anchor is already confirmed, this badge will **always** read "Execution Anchor confirmed" for every row of this category — zero differentiating information, the exact "available on every item" trap the Status Relevance Rule warns against |
| Artist | `guidance_outdated` ("Guidance update") | Guidance current/outdated/none | `guidanceState`, `executionAnchorState` | Guidance state — directly the subject | **KEEP CURRENT BADGE** | The item is literally "your guidance is stale" |
| Artist | `review_note_needs_response` ("Feedback") | Guidance state (frequently "No guidance yet" per the reported screenshots) | `guidanceState`, `executionAnchorState` only — **`open_review_note_count`/`has_review_notes` exists on `ArtistInboxItemRead` but is NOT threaded onto `ArtistReviewWorkItem`** | Review-note count, not Guidance state | **USE DIFFERENT EXISTING STATE** (`open_review_note_count`, once exposed) — until then, **NO BADGE** | Confirmed misleading exactly as suspected: a Task can have unread feedback _and_ no guidance yet at the same time — these are unrelated facts. Showing "No guidance yet" on a Feedback item makes the row look like a guidance problem when the real subject is unread feedback |
| Artist | `dependency_needs_attention` ("Dependency review") | Guidance state | `guidanceState`, `executionAnchorState` only — **`open_dependency_count` exists on `ArtistInboxItemRead` but is NOT threaded onto `ArtistReviewWorkItem`** | Dependency count, not Guidance state | **USE DIFFERENT EXISTING STATE** (`open_dependency_count`, once exposed) — until then, **NO BADGE** | Same reasoning as CG's Dependency review — Guidance state is unrelated to an open dependency |
| Artist | `guidance_available` ("Guidance available") | Guidance state | `guidanceState` | Guidance state — directly the subject | **KEEP CURRENT BADGE** | The item is "guidance can now be generated" — Guidance state is exactly the relevant fact |

**Important scope boundary confirmed:** per-dependency `kind`/`severity`/`status` data _does_ exist in the domain (visible on the dedicated `/cg/tasks/[taskId]/dependencies` page's `DependencyRow`), but that granularity lives at the **individual-dependency** level, not the **Task-level Inbox aggregate**. At the Inbox's own row granularity (one row per Task with an actionable focus), the only real available fact is the aggregate `open_dependency_count`/`open_review_note_count`. Recommending per-dependency kind/severity on the Inbox row would require restructuring the Inbox's own object granularity — out of scope for a badge correction.

## CG-specific findings

- Confirmation/Draft review: badge is correct and directly relevant.
- Dependency review: badge shows a state unrelated to the work item's real subject; the genuinely relevant fact (`open_dependency_count`) exists on `CgInboxItemRead` but was never carried onto `CgReviewWorkItem`.
- Version review: badge is _technically_ accurate but structurally uninformative — it's mathematically guaranteed to always read "confirmed" for this category, so it conveys nothing row-to-row.

## Artist-specific findings

- Guidance update / Guidance available: badge is correct and directly relevant.
- Feedback: confirmed misleading, matching the reported "many show 'No guidance yet'" symptom exactly — Guidance state has no real relationship to whether feedback is waiting for a response.
- Dependency review: same category of mismatch as CG's.

## Action-label audit

Checked every real `primary_action_label` in `cg_inbox/current_focus.py` and `artist_inbox/current_focus.py` against the frontend's rendering:

- CG: "Review and confirm", "Review draft", "Review dependencies", "Review version" — all specific, all match their real destination route. No generic collapse found.
- Artist: "Review and regenerate", "**Read feedback**", "Review Task Overview", "Generate guidance" — all specific and route-accurate.
- One accuracy note (not a defect, a fixture-fidelity gap): a previous turn's test fixtures for the "Feedback" work item used `"Review feedback"` as the label text; the real backend value is `"Read feedback"`. This does **not** affect production behavior — the row already renders whatever `item.actionLabel` really is — it only means the test fixture's wording doesn't match the real backend copy. Worth a fixture correction in a future implementation pass, not a code bug.
- No case found where multiple distinct focus types collapse onto the same generic label — every category has its own real, specific label already.

## Recommended badge/action corrections, if implemented later

1. Thread `open_dependency_count` onto `CgReviewWorkItem`/`ArtistReviewWorkItem` and `open_review_note_count` onto `ArtistReviewWorkItem` (small, additive adapter changes).
2. Show a dependency-count fact (not necessarily a `StatusBadge` — a plain compact metadata fact may fit better, matching the existing `dependencyCountLabel` helper already in `cgWording.ts`) on CG/Artist "Dependency review" rows, and a review-note-count fact on Artist "Feedback" rows, in place of the current Execution Anchor/Guidance badge.
3. Reconsider whether CG's "Version review" category needs a badge at all, given it can never show anything but "confirmed."

**Not implemented — recommendation only.**

---

# 2. Navigation diagnosis

## Navigation architecture traced

- **Role selection (`/`)**: `RoleEntryButton` (Client Component) → `onClick={() => void enterDemoRole(role, returnTo)}` → a Next.js **Server Action** (`"use server"`) that sets an httpOnly cookie and calls `redirect()`. No API/backend call in the action itself, but invoking a Server Action is a full client→server network round trip, and it provides **zero pending/disabled feedback** on the button while that round trip and the subsequent redirect are in flight.
- **Sidebar (`RoleSidebar`)**, **Context tabs (`ContextTabs`)**, **Inbox/list rows (`InboxRow`, `WorkItemRow`, `CgTaskRow`, `ArtistTaskRow`, etc.)**: all plain Next.js `<Link href=...>`. No `useRouter().push`, no click handler, no pending state.
- **Mutation buttons** (Generate/Confirm/Publish — `GenerateArtistGuidanceButton`, `ExecutionAnchorEditor`, `VersionReviewActions`, etc.): correctly use `useTransition`/`isPending` + `disabled` + label-swap feedback, then `router.refresh()` or `router.push()`. This pattern is well-implemented but only covers **mutations**, not plain navigation.
- **Middleware** (`src/middleware.ts`): runs on every `/vfx/**`, `/cg/**`, `/artist/**` request; a synchronous cookie-only check (no I/O) — fast in principle, confirmed by timing (30–45ms for redirect cases).
- **`resolveIdentity()`**: a pure cookie read, no network/DB call — ruled out as a delay source.
- **No `loading.tsx` file exists anywhere in the app router.** Next.js's built-in App Router route-transition loading UI is entirely unused.

## Confirmed findings

- **CONFIRMED (direct log evidence):** Next.js dev-mode on-demand route compilation is real and currently active. Docker log excerpt from this session's own safe timing test:

  ```
  ○ Compiling /vfx ...
  ✓ Compiled /vfx in 504-916ms (753-819 modules)
  GET /vfx 200 in 1040-1531ms   (first hit)
  GET /vfx 200 in 366-422ms     (repeat hit)
  ```

  The same pattern repeats for `/`, `/cg`, `/cg/inbox`, `/artist`, `/artist/inbox`, `/vfx/inbox` — every one shows a `Compiling ... / Compiled ...` line immediately preceding its slowest `GET`. The root role-selection page (`/`) itself took **6.3 seconds** to compile once (811 modules) — meaning a user's very first click, before they've done anything else, can coincide with the single slowest compile in the app.
- **CONFIRMED:** zero visual pending/loading feedback exists on any plain navigation control (sidebar, tabs, rows, role-entry buttons) — only mutation buttons have it.
- **CONFIRMED:** `next dev` runs without `--turbo` (default Webpack dev compiler, package.json `"dev": "next dev"`) — slower cold-compiles than Turbopack would produce.
- **LIKELY:** repeated recompilation of the _same_ route across a session (seen in the logs: `/cg` compiled twice, with a different module count the second time — 818 → 753 modules) is consistent with Next.js dev's Fast Refresh invalidating and recompiling a route after its source files change — directly explained by this session's own repeated edits to the CG/Artist Inbox files during the recent migration work. This means some of what the user is experiencing right now is very plausibly self-inflicted by the active development session, not a permanent characteristic of the app.
- **LIKELY:** Next.js dev's default page-buffer eviction (`onDemandEntries`, unconfigured → framework defaults apply) can drop a previously-compiled route from memory after a period of inactivity or after enough _other_ routes are visited, causing a route the user visited minutes ago to recompile again on a later revisit — consistent with "sometimes" rather than "always" slow, and with delays recurring even for routes visited before. Not directly observed in this session's short log window, but architecturally expected given no override is configured.
- **NOT SUPPORTED (investigated, no evidence found):** a deliberate `await`-before-`router.push` pattern gating plain navigation. No such code exists for `<Link>`-based navigation. The only navigation with real pre-navigation async work is the Server Action–based role entry and the mutation-then-refresh buttons, both of which are intentional and small (cookie write, or a real mutation the user explicitly triggered).
- **NOT SUPPORTED:** pointer-event-blocking overlays. No `pointer-events: none` overlay pattern found in shell CSS.

## Timing evidence

| Route | First | Repeat | Compile evidence | Notes |
| --- | --- | --- | --- | --- |
| `/` (role selection) | 0.20s (curl, already-warm at test time) | 0.13s | Log shows a separate `Compiling / ... Compiled / in 6.3s (811 modules)` event elsewhere in the session | The 6.3s compile is the single largest cost observed in the whole log window |
| `/vfx` | 1.57s | 0.40s (then 0.47s on a 3rd hit) | `Compiling /vfx ... Compiled /vfx in 504–916ms` | ~1.1–1.2s attributable to compilation; the ~0.4s "warm" floor is real backend data-fetch time (`Promise.all` of 2 API calls) |
| `/cg` | 0.80s | 0.34s | `Compiling /cg ... Compiled /cg in 1347–1402ms` (compiled twice in the log — module count changed, consistent with a source-edit-triggered recompile) | |
| `/artist` | 0.49s | 0.46s | Compile event present in log but not directly bracketing this specific curl pair (route was likely already warm from earlier activity) | Smaller first/repeat delta here — consistent with "sometimes" |
| `/cg/inbox` | 0.33s | 0.33s | `Compiling /cg/inbox ... Compiled /cg/inbox in 976ms` (seen earlier in log, likely already warm by the time of this measurement) | |
| `/artist/inbox` | 0.38s | 0.30s | `Compiling /artist/inbox ... Compiled /artist/inbox in 959ms` | |

_(HTTP timing alone doesn't prove browser click-to-paint latency — it's supporting evidence, combined with the direct `Compiling`/`Compiled` log lines, which are the actual proof of on-demand compilation.)_

## Dev-vs-real-app assessment

**MIXED**, with dev compilation as the dominant, directly confirmed factor for first-navigation delays, and a real (but secondary) application-logic contributor:

- Dev compilation (E) is directly proven by log evidence and explains the multi-second first-hit delays.
- The "warm" floor (~0.3–0.5s per navigation) is real backend data-fetching (D) — a `Promise.all` of 1–2 real HTTP calls from the Next.js server container to the FastAPI container to Postgres, on every navigation, with no caching. This is architecturally reasonable for a demo app but is a real, non-dev-only cost that would persist in production too (just without the compile overhead on top).
- The Server Action–based role-entry flow (B) adds one extra network round trip before the target route's own render/compile/fetch even begins, and provides zero feedback during any of it.
- Missing loading feedback (item 7) doesn't cause the delay itself but is why even the "warm" 0.3–0.5s costs can _feel_ like an unresponsive click, and why the 1–2s+ cold-compile hits can feel like the click "did nothing."

**What would be required to fully separate dev-only cost from real-app cost:** run the same routes against a production build (`next build && next start`) instead of `next dev`, which eliminates on-demand compilation entirely and would isolate the pure data-fetching (D) cost. This was **not** done in this turn — it would require building a new image/process, which was explicitly out of scope (`Do NOT rebuild images`, `Do NOT restart Docker`). Stated here only as the additional test that would be needed, not performed.

## Missing feedback assessment

Confirmed missing everywhere except mutation buttons: no `loading.tsx`, no `useLinkStatus`, no pending/disabled/spinner state on `RoleEntryButton`, `RoleSidebar` links, `ContextTabs`, or any Inbox/list row. A 1–2 second real route load with zero feedback is consistent with the user's exact description ("one click appears to do nothing," "multiple clicks seem necessary").

## Root-cause assessment

| Cause | Classification |
| --- | --- |
| A. Click/event handling | NOT SUPPORTED — no broken handlers, no event-propagation issues, no blocking overlays found |
| B. Role/session logic before navigation | LIKELY (minor) — the Server Action round trip for role entry adds one real network hop with zero feedback before the target route even starts loading; the logic itself (cookie write) is fast |
| C. Router/navigation implementation | NOT SUPPORTED — plain `<Link>` used correctly throughout; no anti-pattern found |
| D. Frontend/server data fetching | LIKELY — real, uncached `Promise.all` backend calls on every navigation account for the ~0.3–0.5s "warm" floor observed |
| E. Next.js dev / cold-route compilation | **CONFIRMED** — direct `Compiling .../Compiled ...` log evidence correlating exactly with the slowest observed requests, including a 6.3s compile of `/` itself |
| F. Docker/dev environment | LIKELY (contributing, not primary) — `next dev` without `--turbo`, container-to-container HTTP for every fetch, and an existing `WATCHPACK_POLLING` env var already present in `docker-compose.yml` (evidence the environment has known file-watching/dev-loop friction from before this diagnostic) |
| G. Missing loading feedback | **CONFIRMED** — no `loading.tsx`, no pending UI anywhere in plain navigation, confirmed by exhaustive grep |

## Recommended next action (not implemented)

**Smallest next test:** run one production build/start cycle (`next build` then `next start`, outside the currently-running dev container so nothing active is disturbed) and repeat the exact same timing measurements against it. That isolates whether the ~0.3–0.5s "warm" floor (data fetching) is the real steady-state cost once dev compilation is removed, which is the one piece this diagnostic could not measure without rebuilding.

**Smallest next fix candidate (also not implemented):** add root-level and per-role `loading.tsx` files — this requires no architecture change and would directly address the "feels unresponsive" symptom regardless of which root cause dominates, since it makes the existing (already-necessary) wait visible instead of silent.

---

# 3. Recommended next implementation (not implemented)

**A. Inbox semantic correction** — thread `open_dependency_count` (CG, Artist) and `open_review_note_count` (Artist) onto their respective `ReviewWorkItem` adapter shapes, then replace the Execution-Anchor/Guidance badge with the count-based fact on "Dependency review" (both roles) and "Feedback" (Artist) rows; reconsider whether CG's "Version review" row needs a badge at all.

**B. Navigation responsiveness fix/test** — (1) run a production build/start timing comparison to isolate dev-compile cost from real data-fetch cost; (2) add `loading.tsx` boundaries (root + per-role) as a low-risk, high-value fix for perceived responsiveness regardless of what B's test finds.

Neither was implemented.

---

# 4. Git confirmation

`git status --porcelain` and `git diff --stat` were run before and after this diagnostic's investigation and show **no changes**: the working tree is identical to its state at the start — the same modified files and untracked files from the prior (already-reported) Inbox Family migration turn, nothing added or altered. No source, CSS, test, or doc file was edited. No commit or push was made. All commands run were read-only (`Read`, `Grep`, `Bash` limited to `find`/`grep`/`cat`/`curl`/`docker ps`/`docker logs`).
