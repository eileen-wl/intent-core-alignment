# Step 9B-1 — Role-Aware Working Direction

**Status:** Implementation and automated validation complete. Owner visual validation pending.
**Correction applied (same branch, same task):** the original pass's `GET /intent/execution-anchor-revisions/{id}/decisions` endpoint had no backend role check, only the frontend route guard. Backend authorization is now explicit — see §8.1.
**Branch:** `feat/step9b1-role-aware-working-direction`
**Companion documents:** `docs/step-9/01_STEP_9_PRESENTATION_AND_COMPREHENSION_BASELINE.md` (locked baseline, unmodified), `docs/step-9/02_STEP_9A_CURRENT_STATE_AND_IMPLEMENTATION_MAP.md` (the audit this implementation follows), `docs/IMPLEMENTATION_STATUS_AND_ROADMAP.md` §L.

---

## 1. Scope and completion verdict

**Step 9B-1 is complete: the VFX Shot Overview, CG Task Overview, and Artist Task Overview pages each gained a compact, derived, read-only Working Direction section**, built entirely from existing persisted objects and one small, additive, read-only backend endpoint (§8). No new authoritative domain object was created. No Agent-generated summary was added — every selector is a deterministic, pure TypeScript function with explicit input/output types and no I/O.

Not started, per this task's explicit scope: Step 9B-2 (Evidence/Agent/Human layering as its own pass), Step 9B-3 (Department Execution Overview), Step 9B-4 (media/thumbnail), Step 9C (visual-system unification). Some Evidence/Agent/Human distinction is a structural side effect of this work (every Working Direction item already carries an authority category), but no dedicated 9B-2 layering pass was performed on the six priority pages that step names.

---

## 2. Locked IA and authority boundaries

No route, sidebar item, tab, or page responsibility was added, removed, or renamed. Confirmed directly in the diff: only existing files were edited (three page components, three page.tsx server components, two feature-loader files, one API client file, one backend router file), plus new files that are all either shared presentation infrastructure or per-role, non-routed selector modules. `git diff --check` and the file list in §14 confirm no `apps/web/src/app/**/page.tsx` route was added, and `apps/web/src/lib/roleNavigation.ts` was not touched.

Authority is preserved exactly as it was:

- No Anchor confirm/reject/edit control was added anywhere in Working Direction — every Anchor-derived item is display-only, sourced from an already-fetched, already-confirmed (never draft) revision.
- No `HumanGate` or `Decision` creation path was added. The one new backend capability (§8) is a **read**, mirroring the existing Core Anchor Decision-listing endpoint exactly.
- VFX can navigate into CG-owned context (e.g. a Task's Execution page) via existing routes only, and cannot edit an Execution Anchor from the VFX Shot Overview — no such control exists in the new code.
- Artist's Working Direction exposes no VFX/CG authority control — Anchors remain read-only references, matching the pre-existing Task Overview page's own boundary.

---

## 3. Shared derived presentation model

New, role-agnostic types and a single render component, reused by all three roles:

- **`apps/web/src/lib/workingDirection.ts`** — `WorkingDirectionItem` (`id`, `label`, `value`, `authority`, `sourceType`, `sourceId?`, `timestamp?`, `detail?`, `href?`) and `WorkingDirectionSection` (`title`, `items[]`). `sourceId` exists for traceability/tests only and is never rendered.
- **`WorkingDirectionAuthority`** — `Extract<AuthorityLabelVariant, "human-confirmed" | "production-fact" | "ai-interpretation" | "human-review-required">`, reusing the *existing* `AuthorityLabel` component's vocabulary (`docs/step-7/06_STEP_7_LOCKED_SOURCE_OF_TRUTH.md` §10) exactly — no new label text, no new persisted domain state implied.
- **`apps/web/src/design/components/WorkingDirectionSection.tsx`** (+ `.module.css`) — the one shared render: a `SectionHeader` plus a `Grid` of `Panel`s, each showing `label`, `value` (optionally linked), and an `AuthorityLabel`. Renders `null` when `items` is empty — never an empty heading. Registered in the `@/design` barrel export.

Three per-role **pure selector** modules (no fetch, no LLM call, explicit input/output types, independently unit-testable):

- `apps/web/src/features/vfx/shot-overview/selectCurrentCreativeDirection.ts`
- `apps/web/src/features/cg/task-overview/selectCurrentExecutionDirection.ts`
- `apps/web/src/features/artist/task-overview/selectCurrentWorkingDirection.ts`

Each selector declares its own local input interface (not a reference to its loader's return type), so it has no import-time dependency on any data-fetching code and can be tested with a hand-built fixture object alone.

---

## 4. VFX Current Creative Direction

New loader `apps/web/src/features/vfx/shot-overview/data.ts::loadShotOverviewData` — the Shot Overview route (`page.tsx`) now calls this instead of `fetchVfxInboxItem` directly, fetching (all via already-existing `features/vfx/api.ts` functions, **zero new VFX backend calls**): the confirmed Core Anchor revision (never a draft), its confirm Decision's rationale, the Shot-wide newest Version and its newest Review Note, and the current (newest) Cross-role Assessment.

Seven items, exactly matching the task's required list:

| Item | Source | Authority |
|---|---|---|
| Current creative objective | confirmed `CoreAnchorRevisionRead.core_summary` | `human-confirmed` |
| What must remain unchanged | confirmed revision's `constraints[]` | `human-confirmed` |
| What may vary | confirmed revision's `variation_zones[]` | `human-confirmed` |
| Current alignment / drift risk | `VfxInboxItemRead.latest_signal_*` (Intent Signal) | `ai-interpretation` |
| Latest meaningful production feedback | newest Review Note on the Shot's newest Version | `production-fact` |
| What needs your decision next | `current_focus` (existing derivation, never re-derived here) | `human-review-required` when actionable, else `production-fact` |
| When CG/Artist issues need VFX intervention | `open_cg_escalation_*` (an existing `TaskDependency`) | `production-fact` |

VFX stays Shot-wide — the selector has no `task_id` concept at all, consistent with Step 8's locked VFX behaviour.

---

## 5. CG Current Execution Direction

Extended loader `apps/web/src/features/cg/task-overview/data.ts::loadTaskOverviewData` — now also fetches the confirmed Execution Anchor revision (full object, not just the pre-existing flat summary string), its confirm/reject Decision(s) (§8), and the newest Review Note on the Task's latest (already Task-scoped) Version.

Seven items:

| Item | Source | Authority |
|---|---|---|
| What this Task must achieve | confirmed `ExecutionAnchorRevisionRead.technical_boundaries` | `human-confirmed` |
| Relevant confirmed Core Anchor context | pre-existing `coreAnchorSummary` | `human-confirmed` |
| Production-ready criteria | confirmed revision's `production_ready_criteria` | `human-confirmed` |
| Current dependencies | open `TaskDependencyRead[]` | `production-fact` |
| Latest Version and feedback | `item.latest_version_*` + newest Review Note | `production-fact` |
| What needs your action next | `current_focus` | `human-review-required` / `production-fact` |
| When to escalate to VFX | open `TaskDependency(kind="escalation")` | `production-fact` |

The confirmed Execution Anchor is never presented if only a draft exists — the loader's `find((r) => r.status === "confirmed")` guarantees this structurally, and a missing confirm Decision/rationale renders the honest `"Confirmed by CG Supervisor"` detail with no rationale clause, never a fabricated one.

---

## 6. Artist Current Working Direction

Extended loader `apps/web/src/features/artist/task-overview/data.ts::loadTaskOverviewData` — now also fetches the newest Review Note on the Task's latest (already Task-scoped) Version; the confirmed Core/Execution Anchor revisions and latest Artist Guidance were already fetched by the pre-existing page.

Nine items (eight required by the task, plus a distinct Artist Agent guidance line — see §11 for why):

| Item | Source | Authority |
|---|---|---|
| What you are being asked to do | confirmed `ExecutionAnchorRevisionRead.technical_boundaries` (read-only reference) | `human-confirmed` |
| Why this matters | confirmed `CoreAnchorRevisionRead.core_summary` (read-only reference) | `human-confirmed` |
| What must remain unchanged | confirmed Core Anchor's `constraints[]` | `human-confirmed` |
| What you may explore | confirmed Execution Anchor's `allowed_refinements` | `human-confirmed` |
| Latest feedback | newest Review Note | `production-fact` |
| Current Production Version | `item.latest_version_*` | `production-fact` |
| Artist Agent guidance | `ArtistAgentGuidanceRead.guidance_output.executive_summary` | `ai-interpretation` |
| What to do next | `current_focus` | `human-review-required` / `production-fact` |
| When to ask CG for clarification | open `TaskDependencyRead[]` (read-only trigger; Artist creates no escalation) | `production-fact` |

`allowed_refinements` (a flat string on `ExecutionAnchorRevisionRead`) is used for "what you may explore" — **not** `CoreAnchorRevisionRead.variation_zones`, correcting a real naming ambiguity in `01_...md`'s own phrasing (flagged in the Step 9A audit, §6) between two structurally different objects.

---

## 7. Exact source/provenance mapping

Every item across all three roles carries `sourceType` (and `sourceId` where a single backing row exists) for traceability, and a human-readable `detail` string for visible provenance (e.g. `"Confirmed by VFX Supervisor -- <rationale>"`, `"From v004 (v4)"`, `"Derived current focus"`, `"Artist Agent guidance"`). No item is labelled `human-confirmed` merely because an object exists — only a revision with `status === "confirmed"` ever receives that label; a draft-only Anchor always falls through to the honest `"No confirmed ... yet."` fallback, still under `human-confirmed` styling (since the *category* is correct — this line's authority is inherently about confirmed human direction, its *content* is the absence state) but with no fabricated content.

No raw UUID is rendered in any `value` or `detail` string — verified directly by a dedicated test per selector (§10).

---

## 8. Backend read addition

**One new endpoint:** `GET /intent/execution-anchor-revisions/{revision_id}/decisions`, in `apps/api/src/intent_core_api/intent/router.py`, immediately after the existing `get_execution_anchor_revision_human_gate`.

It is the Execution Anchor analogue of the already-existing `GET /intent/core-anchor-revisions/{revision_id}/decisions` and calls the exact same, unmodified, generic service function: `decision_service.list_decisions_for_entity(session, "execution_anchor_revision", revision_id)`. No new service logic, no migration (the query is a plain `SELECT ... WHERE entity_type = ... AND entity_id = ... ORDER BY created_at`, already existing), no new contract type (`DecisionRead` is reused unchanged).

Frontend surface: `apps/web/src/features/cg/api.ts::listExecutionAnchorRevisionDecisions` — the only role module that exposes this function; VFX's and Artist's `api.ts` modules do not import it, so it is reachable only from CG's own feature code.

### 8.1 Authorization correction (this pass)

**The endpoint is now explicitly role-gated at the backend**, not left to rely on the frontend role guard alone. This corrects the original Step 9B-1 pass, which left the endpoint unguarded like the Core Anchor decisions endpoint it mirrors — a real gap, since this read path is CG-owned decision provenance, not a general-purpose listing.

**Mechanism, reusing existing primitives only — no second authorization system:**

- `actor: ActorContext = Depends(get_current_actor)` added as a router parameter — the exact same dependency every mutation endpoint in this codebase already uses (`apps/api/src/intent_core_api/workflow/actors.py`). It parses `X-Actor-Role`/`X-Actor-Id`, raising `HTTPException(401, ...)` when the role header is missing or is not one of the three real `HumanRole` values, or when the actor id is missing.
- `require_human_role(actor, _EXECUTION_ANCHOR_DECISION_READERS)` — the exact same guard function every mutation's role check already calls, raising `ForbiddenActionError` (mapped to HTTP 403) when the actor's role is not in the allowed set.

**Exact allowed-role policy:** `_EXECUTION_ANCHOR_DECISION_READERS: frozenset[HumanRole] = frozenset({"cg_supervisor", "vfx_supervisor"})`.

**Evidence for this exact set**, from `docs/ROLE_PERMISSIONS.md` §2's table:

| Role | "Read Secondary Execution Anchor" | Included? |
|---|---|---|
| CG Supervisor | `Yes` (unconditional) | **Yes** — the required reader; the existing CG Task Overview's Current Execution Direction summary depends on it |
| VFX Supervisor | `Yes` (unconditional) | **Yes** — reading this Decision is reading part of the Execution Anchor's own real confirmation provenance, which VFX already has an unconditional documented right to read. No VFX call site was added in this pass (`features/vfx/api.ts` still does not expose this function) — the endpoint is authorized for VFX now so a future VFX-side caller does not need a second backend change, but nothing in the frontend calls it as VFX today |
| Artist | `Yes, when relevant` (conditional) | **No** — evaluating "when relevant" would require Task-relevance scoping this narrow correction does not add; granting Artist an unconditional role would be broader access than the locked policy describes, and this task's own instruction is explicit that Artist must not gain unrestricted CG decision access |

Frontend/backend consistency: `apps/web/src/app/cg/tasks/[taskId]/page.tsx` now resolves the real session identity (`resolveIdentity()`) and forwards the trusted `X-Actor-Role`/`X-Actor-Id` headers (`actorHeaders()`) through `loadTaskOverviewData` → `listExecutionAnchorRevisionDecisions` — the same trusted, server-resolved header pattern every existing mutation call already uses; never a client-supplied value, so there is no actor-spoofing surface distinct from what already exists everywhere else in this codebase.

**Explicitly out of this correction's scope, named not fixed:** the Core Anchor decisions endpoint (`GET /intent/core-anchor-revisions/{revision_id}/decisions`) it mirrors remains unguarded — this is a pre-existing, already-named characteristic of a different endpoint, and broadening this fix to cover it would be exactly the "broad API-wide authorization refactor" this correction's own instructions rule out.

The OpenAPI export and generated TypeScript contracts (`packages/contracts/ts/src/generated/api.ts`) were regenerated twice this session — once for the new endpoint's existence (prior pass), once more for its new header parameters (this correction). Both diffs are clean and additive-only.

---

## 9. Fallback and partial-data behaviour

Every selector was written and tested against the exact absence states the task named:

- No confirmed Core Anchor → `"No confirmed Core Anchor yet."` (VFX/CG/Artist, wherever a Core Anchor line exists).
- No confirmed Execution Anchor → `"No confirmed Execution Anchor yet."` (CG/Artist).
- No current Assessment / Intent Signal → the pre-existing exact copy, reused: `"No current Intent Signal. A successful Cross-role Assessment is required."`.
- No latest Version → the Version-dependent lines fall back to `"No new feedback."` / `"No production Version linked yet."`.
- No Review Note on the latest Version → `"No new feedback."`.
- No Decision rationale on a confirmed revision → the `detail` omits the rationale clause rather than inventing one.
- No Dependencies → `"No open dependencies for this Task."` / `"No open dependency currently requires CG clarification."`.
- No Artist guidance → `"No Artist guidance has been generated yet."`.
- No pending action (`current_focus.actionable === false`) → `"Nothing requires your attention ... right now."`, deliberately recategorised from `human-review-required` to `production-fact` for this one state (§11) so the visible authority badge never contradicts the visible value.

None of these fallbacks are generic motivational copy — each names the specific missing object. An absence of Agent risk is never described as human-confirmed alignment: the "current risk" line's authority is always `ai-interpretation`, whether or not a signal exists.

---

## 10. Tests and validation

**New focused test files (all passing):**

- `apps/web/src/features/vfx/shot-overview/selectCurrentCreativeDirection.test.ts` (10 tests)
- `apps/web/src/features/vfx/shot-overview/data.test.ts` (6 tests)
- `apps/web/src/features/cg/task-overview/selectCurrentExecutionDirection.test.ts` (11 tests)
- `apps/web/src/features/artist/task-overview/selectCurrentWorkingDirection.test.ts` (10 tests)
- `apps/api/tests/test_execution_anchor_decisions_list.py` (13 tests — 6 from the original pass, 7 new authorization tests added this correction)

Plus new rendering-level tests added to the three existing page-component test files (7 new tests total), and every pre-existing test in those three files (VFX 20, CG 7, Artist 13) left unmodified and still passing.

Coverage against the task's required list: confirmed-over-draft Anchor selection (VFX/CG/Artist); draft-only honest pending state; Agent interpretation never categorised as Human Decision (Intent Signal, Artist Guidance); Version/ReviewNote categorised as production evidence; VFX Shot-wide vs. CG/Artist Task-scoped Version context; Artist guidance remains advisory; role-appropriate navigation destinations (every `href` asserted to start with the current role's own route prefix); missing-data fallbacks; no raw id in any visible summary value (dedicated test per selector, using a deliberately UUID-shaped fixture id). Backend: correct scoped records, unrelated-revision exclusion, human role/actor provenance retention, superseded-revision history retention, empty-result validity, no mutation side effect, **plus this correction's authorization matrix**: allowed CG Supervisor request succeeds; allowed VFX Supervisor request succeeds (with the `docs/ROLE_PERMISSIONS.md` §2 evidence documented in the test itself); Artist request rejected (403); missing role header rejected (401); invalid (non-`HumanRole`) role header rejected (401); a valid role with a missing actor id rejected (401); a rejected request creates no row, leaks no Decision content in its response body, and does not affect what an authorised request subsequently sees.

**Full regression, all green:**

- Frontend: Vitest 888/888 (115 files, unchanged from the original pass — this correction touched no frontend test assertions, only added trusted-header plumbing), ESLint (0 errors, 1 pre-existing/unrelated warning), `tsc --noEmit` (apps/web and contracts package, both clean), Prettier (clean, repo-root), production `next build` (18 routes, succeeded).
- Backend: `pytest apps/api` 904/904 (897 after the original pass + 7 new authorization tests), `mypy` across all four exact CI scopes (clean, 130 files), `ruff check` (clean), `ruff format --check` (clean, 232 files), `uv lock --check` (no drift).
- Contracts: OpenAPI export + TypeScript regeneration (run again this correction, for the endpoint's new header parameters) produced a clean, additive-only diff; both the contracts package and `apps/web` typecheck cleanly against it.

---

## 11. Known limitations

- **Artist Agent guidance is its own line, not folded into "what to do next"** — a deliberate choice (§6) so it can carry its own `ai-interpretation` label distinct from the `current_focus`-derived pending-action line, matching the task's explicit "must be labelled accordingly" rule more precisely than merging the two would have.
- **The pre-existing VFX Shot Overview `<dl>` "supporting context" block was left unchanged**, even though it now overlaps partially with the new Current Creative Direction section (both show a Core Anchor summary and latest Version, from slightly different source calls). Removing or consolidating it was avoided specifically to not touch or risk any of the 15+ pre-existing `ShotOverviewPage.test.tsx` assertions this task must not weaken. Consolidation is deferred to Step 9C (visual-unification), named here so it is not mistaken for an oversight.
- **The Execution Anchor Decision-listing endpoint is now role-gated (§8.1: CG Supervisor + VFX Supervisor); the Core Anchor decisions endpoint it mirrors remains unguarded**, unchanged and out of this correction's scope — a real, named asymmetry between the two now-similar endpoints, not an oversight. Retrofitting the Core Anchor endpoint the same way is a separate, future decision.
- **`joinOrFallback` for Constraints/Variation Zones renders a semicolon-joined string**, not a bulleted list — a deliberately minimal presentation choice for this step; Step 9C may revisit the visual treatment without needing to touch the selector's data shape.

---

## 12. Owner visual-validation targets

Local services: `apps/api` on `http://localhost:8000`, `apps/web` (dev) on `http://localhost:3000`, entry via `http://localhost:3000/demo`. The owner has not yet performed this validation; it is not claimed as complete.

**Real-data check performed before choosing these targets (read-only, no data changed):** none of the 9 real ftrack-synced Shots/Tasks from Step 8C-8 have a confirmed Core or Execution Anchor yet (ftrack sync and ICAS Anchor confirmation are separate, independent actions — syncing a Version never confirms an Anchor). Pointing the owner at one of those would show mostly honest-empty `human-confirmed` fallback lines rather than "sufficient confirmed/current data" as required. The D1 demo/manual Shot below is the one real dataset in this database with a confirmed Core Anchor **and** a confirmed Execution Anchor **and** a real Version/Review Note/Artist guidance, so it is used instead; a ftrack-synced Task remains a valid secondary check specifically for the honest-fallback states (§9).

| Role page | Exact URL | Expected Working Direction content |
|---|---|---|
| VFX Shot Overview | `http://localhost:3000/vfx/shots/8a72858d-8d06-47ab-a28d-5ee077f561c8` ("Shot 010 — Final confrontation") | A "Current Creative Direction" section beneath Current Focus, showing 7 compact items with visible authority badges (e.g. "Human-confirmed", "AI interpretation"), a real confirmed creative objective and Constraints, no raw ids, links to Intent/Versions/Alignment |
| CG Task Overview | `http://localhost:3000/cg/tasks/4cd95082-df46-4d67-92bb-a217cf0e8684` ("Compositing Review") | A "Current Execution Direction" section beneath Current Focus, showing the Task's real confirmed Execution Anchor content, dependency count, latest Version/feedback, links to Execution/Version Review/Dependencies |
| Artist Task Overview | `http://localhost:3000/artist/tasks/4cd95082-df46-4d67-92bb-a217cf0e8684` | A "Current Working Direction" section beneath Current Focus, showing both confirmed Anchors as read-only, Artist guidance clearly marked "AI interpretation", latest Version/feedback, links to Current Version/Feedback History |

**Secondary check (honest-fallback states, real ftrack data):** `http://localhost:3000/cg/tasks/f1451fda-80be-4820-8d9f-172d71df668f` ("Animation" Task under real ftrack Shot `S1020`, from the Step 8C-8 acceptance run) — expected to show `"No confirmed Execution Anchor yet."` and similar honest fallbacks throughout, alongside its real synced Version/Review Note content, proving the section degrades honestly rather than fabricating confirmed-sounding content for real production data that simply hasn't been through Anchor confirmation yet.

**The owner must confirm:** the section is understandable at a glance; production facts, Agent interpretation, and Human-confirmed direction are visually distinguishable; no line reads as unsupported or misleading; every link lands on the correct existing page; the role guard (redirect-with-`returnTo`) still works; the section does not overwhelm the Overview page next to the pre-existing content.

---

## 13. Explicit non-goals

- Step 9B-2 (a dedicated Evidence/Agent/Human layering pass on the six named priority pages), Step 9B-3 (Department Execution Overview), Step 9B-4 (media/thumbnail), and Step 9C (visual-system unification) were not started.
- No `WorkingDirection` table, migration, or other new authoritative persistence was added — confirmed in §14.
- No Agent/LLM call of any kind was added for this summary — every selector is deterministic TypeScript.
- No Anchor, HumanGate, or Decision authority was changed — the one new endpoint is a read, mirroring an existing one exactly.
- No ftrack entity or local acceptance data row was modified — no ftrack call was made in this task at all.
- No new route, sidebar item, tab, global role switcher, cross-role editing control, or Review Inbox replacement was added.

---

## 14. Readiness for Step 9B-2

**Ready**, pending owner visual validation (§12) of this step. Step 9B-2's own scope (Production Evidence / Agent Interpretation / Human Decision layering on VFX Intent, VFX Alignment, CG Execution, CG Version Review, Artist Current Version, Artist Feedback History) is materially de-risked by this step: the `AuthorityLabel`-based vocabulary, the `WorkingDirectionItem` authority categorisation pattern, and the CG Execution Anchor Decision-listing endpoint are all now real, tested, and reusable rather than needing to be designed from scratch.

Files changed, original pass (exhaustive): `apps/api/src/intent_core_api/intent/router.py`; `apps/api/tests/test_execution_anchor_decisions_list.py` (new); `apps/api/openapi.json` (regenerated, gitignored, not committed); `packages/contracts/ts/src/generated/api.ts` (regenerated); `apps/web/src/lib/workingDirection.ts` (new); `apps/web/src/design/components/WorkingDirectionSection.tsx` + `.module.css` (new); `apps/web/src/design/components/index.ts`; `apps/web/src/features/vfx/shot-overview/{data,selectCurrentCreativeDirection}.ts` (+ `.test.ts` for both, new); `apps/web/src/features/cg/api.ts`; `apps/web/src/features/cg/task-overview/{data,selectCurrentExecutionDirection}.ts` (+ `.test.ts` for the selector, new); `apps/web/src/features/artist/task-overview/{data,selectCurrentWorkingDirection}.ts` (+ `.test.ts` for the selector, new); `apps/web/src/app/vfx/shots/[shotId]/{page,ShotOverviewPage,ShotOverviewPage.test}.tsx`; `apps/web/src/app/cg/tasks/[taskId]/{TaskOverviewPage,TaskOverviewPage.test}.tsx`; `apps/web/src/app/artist/tasks/[taskId]/{TaskOverviewPage,TaskOverviewPage.test}.tsx`.

**Files changed, this authorization correction (additional, on top of the above):** `apps/api/src/intent_core_api/intent/router.py` (added `actor`/`require_human_role`, `_EXECUTION_ANCHOR_DECISION_READERS`); `apps/api/tests/test_execution_anchor_decisions_list.py` (existing calls given `headers=CG`; 7 new authorization tests); `apps/api/openapi.json` (regenerated again, gitignored); `packages/contracts/ts/src/generated/api.ts` (regenerated again, additive header-parameter metadata only); `apps/web/src/features/cg/api.ts` (`listExecutionAnchorRevisionDecisions` now requires `actorHeaders`); `apps/web/src/features/cg/task-overview/data.ts` (`loadTaskOverviewData` now requires `actorHeaders`); `apps/web/src/app/cg/tasks/[taskId]/page.tsx` (resolves the real session identity and forwards trusted headers). No frontend test file needed a content change — the existing CG `page.test.tsx` mock already exercises `next/headers`' `cookies()` the same way `resolveIdentity()` now also reads it.
