# Step 9B-1 — Role-Aware Working Direction

**Status:** **Step 9B-1 complete — role-aware Working Direction implemented, automatically validated and owner visually validated.** See §17 for the recorded owner-validation evidence and §§15-16 for the two correction rounds that preceded it.
**Correction applied (same branch, same task):** the original pass's `GET /intent/execution-anchor-revisions/{id}/decisions` endpoint had no backend role check, only the frontend route guard. Backend authorization is now explicit — see §8.1.
**Owner-validation correction applied (same branch, same task):** the first owner visual validation attempt failed for four reasons (an unavailable primary CG page, misleading fallback authority, an unreadable shared authority strip, and excessive duplication with pre-existing detailed content). All four are corrected — see §15.
**Second owner-validation correction applied (same branch, same task):** the second owner visual validation attempt confirmed the §15 fixes but found one remaining semantic defect — a confirmed parent Execution Anchor's empty optional child field (production-ready criteria / allowed refinements) rendered the parent-level "no confirmed Anchor" fallback with an inherited Human-confirmed badge. Corrected — see §16.
**Owner visual validation passed (same branch, same task):** the third owner visual validation attempt, performed after both correction rounds above, passed across all four targets (complete-data VFX/CG/Artist and the real ftrack partial-data state). Recorded in full in §17.
**Branch:** `feat/step9b1-role-aware-working-direction`
**Companion documents:** `docs/step-9/01_STEP_9_PRESENTATION_AND_COMPREHENSION_BASELINE.md` (locked baseline, unmodified), `docs/step-9/02_STEP_9A_CURRENT_STATE_AND_IMPLEMENTATION_MAP.md` (the audit this implementation follows), `docs/IMPLEMENTATION_STATUS_AND_ROADMAP.md` §L.

---

## 1. Scope and completion verdict

**Step 9B-1 complete — role-aware Working Direction implemented, automatically validated and owner visually validated.** The VFX Shot Overview, CG Task Overview, and Artist Task Overview pages each gained a compact, derived, read-only Working Direction section, built entirely from existing persisted objects and one small, additive, read-only backend endpoint (§8). No new authoritative domain object was created. No Agent-generated summary was added — every selector is a deterministic, pure TypeScript function with explicit input/output types and no I/O. Owner visual validation passed after two correction rounds (§§15-16); the full evidence is recorded in §17.

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

**New focused test files (all passing, counts as of the §16 owner-validation correction):**

- `apps/web/src/features/vfx/shot-overview/selectCurrentCreativeDirection.test.ts` (14 tests — +1 this correction)
- `apps/web/src/features/vfx/shot-overview/data.test.ts` (6 tests)
- `apps/web/src/features/cg/task-overview/selectCurrentExecutionDirection.test.ts` (16 tests — +3 this correction)
- `apps/web/src/features/artist/task-overview/selectCurrentWorkingDirection.test.ts` (15 tests — +4 this correction)
- `apps/web/src/lib/workingDirection.test.ts` (3 tests)
- `apps/web/src/design/components/WorkingDirectionSection.test.tsx` (6 tests)
- `apps/web/src/design/components/AuthorityLabel.test.tsx` (15 tests)
- `apps/api/tests/test_execution_anchor_decisions_list.py` (13 tests — unchanged, no backend source touched this correction)

Plus rendering-level tests updated/added in the three existing page-component test files (VFX 23, CG 10, Artist 16, all passing) to cover the §15 corrections: the "View details" link pattern, the collapsed-by-default Detailed context disclosure, and the absence of a Human-confirmed badge on fallback content.

Coverage against the task's required list: confirmed-over-draft Anchor selection (VFX/CG/Artist); draft-only honest pending state; Agent interpretation never categorised as Human Decision (Intent Signal, Artist Guidance); Version/ReviewNote categorised as production evidence; VFX Shot-wide vs. CG/Artist Task-scoped Version context; Artist guidance remains advisory; role-appropriate navigation destinations (every `href` asserted to start with the current role's own route prefix); missing-data fallbacks; no raw id in any visible summary value (dedicated test per selector, using a deliberately UUID-shaped fixture id). Backend: correct scoped records, unrelated-revision exclusion, human role/actor provenance retention, superseded-revision history retention, empty-result validity, no mutation side effect, **plus this correction's authorization matrix**: allowed CG Supervisor request succeeds; allowed VFX Supervisor request succeeds (with the `docs/ROLE_PERMISSIONS.md` §2 evidence documented in the test itself); Artist request rejected (403); missing role header rejected (401); invalid (non-`HumanRole`) role header rejected (401); a valid role with a missing actor id rejected (401); a rejected request creates no row, leaks no Decision content in its response body, and does not affect what an authorised request subsequently sees.

**Full regression, all green (as of the §16 owner-validation correction):**

- Frontend: Vitest 914/914 (117 files), ESLint (0 errors, 1 pre-existing/unrelated warning), `tsc --noEmit` (apps/web and contracts package, both clean), Prettier (clean, repo-root), production `next build` (30 routes, succeeded).
- Backend: unchanged from the prior corrections — no backend source was touched in either the §15 or §16 pass. `pytest apps/api` 904/904, `mypy` across all four exact CI scopes (clean, 130 files), `ruff check` (clean), `ruff format --check` (clean, 232 files), `uv lock --check` (no drift).
- Contracts: unchanged from the prior corrections — no schema or endpoint change in the §15 or §16 pass.

---

## 11. Known limitations

- **Artist Agent guidance is its own line, not folded into "what to do next"** — a deliberate choice (§6) so it can carry its own `ai-interpretation` label distinct from the `current_focus`-derived pending-action line, matching the task's explicit "must be labelled accordingly" rule more precisely than merging the two would have.
- ~~The pre-existing VFX Shot Overview `<dl>` "supporting context" block was left unchanged...~~ **Superseded by §15.4** — the owner-validation correction wrapped this block (and its CG/Artist equivalents) in a collapsed-by-default "Detailed context" disclosure rather than leaving the duplication unaddressed.
- **The Execution Anchor Decision-listing endpoint is now role-gated (§8.1: CG Supervisor + VFX Supervisor); the Core Anchor decisions endpoint it mirrors remains unguarded**, unchanged and out of this correction's scope — a real, named asymmetry between the two now-similar endpoints, not an oversight. Retrofitting the Core Anchor endpoint the same way is a separate, future decision.
- **`joinOrFallback` for Constraints/Variation Zones renders a semicolon-joined string**, not a bulleted list — a deliberately minimal presentation choice for this step; Step 9C may revisit the visual treatment without needing to touch the selector's data shape.

---

## 12. Owner visual-validation targets

Local services: `apps/api` on `http://localhost:8000`, `apps/web` (dev) on `http://localhost:3000`, entry via `http://localhost:3000/demo`. **Owner visual validation against these targets has now passed — see §17 for the recorded results.** Two attempts preceded the pass: a first attempt failed for four reasons corrected in §15, and a second attempt found one further defect corrected in §16. The table below describes the intended content that the passed §17 validation confirmed.

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

**Ready. Owner visual validation is now complete (§17)** — Step 9B-1 itself is done, not merely de-risked. Step 9B-2's own scope (Production Evidence / Agent Interpretation / Human Decision layering on VFX Intent, VFX Alignment, CG Execution, CG Version Review, Artist Current Version, Artist Feedback History) is materially de-risked by this step: the `AuthorityLabel`-based vocabulary, the `WorkingDirectionItem` authority categorisation pattern, and the CG Execution Anchor Decision-listing endpoint are all now real, tested, owner-validated, and reusable rather than needing to be designed from scratch. Step 9B-2 itself has not been started.

Files changed, original pass (exhaustive): `apps/api/src/intent_core_api/intent/router.py`; `apps/api/tests/test_execution_anchor_decisions_list.py` (new); `apps/api/openapi.json` (regenerated, gitignored, not committed); `packages/contracts/ts/src/generated/api.ts` (regenerated); `apps/web/src/lib/workingDirection.ts` (new); `apps/web/src/design/components/WorkingDirectionSection.tsx` + `.module.css` (new); `apps/web/src/design/components/index.ts`; `apps/web/src/features/vfx/shot-overview/{data,selectCurrentCreativeDirection}.ts` (+ `.test.ts` for both, new); `apps/web/src/features/cg/api.ts`; `apps/web/src/features/cg/task-overview/{data,selectCurrentExecutionDirection}.ts` (+ `.test.ts` for the selector, new); `apps/web/src/features/artist/task-overview/{data,selectCurrentWorkingDirection}.ts` (+ `.test.ts` for the selector, new); `apps/web/src/app/vfx/shots/[shotId]/{page,ShotOverviewPage,ShotOverviewPage.test}.tsx`; `apps/web/src/app/cg/tasks/[taskId]/{TaskOverviewPage,TaskOverviewPage.test}.tsx`; `apps/web/src/app/artist/tasks/[taskId]/{TaskOverviewPage,TaskOverviewPage.test}.tsx`.

**Files changed, this authorization correction (additional, on top of the above):** `apps/api/src/intent_core_api/intent/router.py` (added `actor`/`require_human_role`, `_EXECUTION_ANCHOR_DECISION_READERS`); `apps/api/tests/test_execution_anchor_decisions_list.py` (existing calls given `headers=CG`; 7 new authorization tests); `apps/api/openapi.json` (regenerated again, gitignored); `packages/contracts/ts/src/generated/api.ts` (regenerated again, additive header-parameter metadata only); `apps/web/src/features/cg/api.ts` (`listExecutionAnchorRevisionDecisions` now requires `actorHeaders`); `apps/web/src/features/cg/task-overview/data.ts` (`loadTaskOverviewData` now requires `actorHeaders`); `apps/web/src/app/cg/tasks/[taskId]/page.tsx` (resolves the real session identity and forwards trusted headers). No frontend test file needed a content change — the existing CG `page.test.tsx` mock already exercises `next/headers`' `cookies()` the same way `resolveIdentity()` now also reads it.

---

## 15. Owner-validation correction (second pass)

**The first owner visual validation attempt failed.** This section records why, and the correction applied. Owner visual validation itself is **not** re-claimed as complete by this correction — it remains pending, and Step 9B-1 must not be marked owner-validated in `docs/IMPLEMENTATION_STATUS_AND_ROADMAP.md` until the owner actually re-checks the four targets in §12.

### 15.1 (a) Primary CG target page was unavailable

**Symptom:** `http://localhost:3000/cg/tasks/4cd95082-df46-4d67-92bb-a217cf0e8684` (the Task with a confirmed Execution Anchor) showed "This Task is unavailable. The ICAS service could not be reached." A real ftrack Task with no confirmed Execution Anchor (`.../cg/tasks/f1451fda-80be-4820-8d9f-172d71df668f`) opened correctly.

**Diagnosis (not assumed — reproduced and confirmed):** the long-running local `apps/api` process had been started via `uv run uvicorn ... ` **without** `--reload` before `GET /intent/execution-anchor-revisions/{revision_id}/decisions` (§8) existed in its route table, and was never restarted across the subsequent authorization-correction pass (which only ran through `pytest`'s own isolated test client, never the long-running dev process). `listExecutionAnchorRevisionDecisions` uses the non-null-tolerant `cgFetch`, so the stale process's genuine 404 became an uncaught `CgApiError`, propagating to `page.tsx`'s outer `try/catch` and producing `unavailable: true`. Confirmed by: killing the stale `node`/`python` processes on ports 3000/8000, starting both fresh, and directly curl-testing the decisions endpoint (401 with no headers, 200 with real data given `X-Actor-Role: cg_supervisor`), then loading all four §12/§15.5 URLs successfully against the fresh processes.

**Correction:** none — per this task's own instruction, no source change was made for a stale-process cause. The cause and successful fresh-process verification are recorded here.

### 15.2 (b) Fallback authority semantics were misleading

**Symptom:** absence states ("No confirmed Core Anchor yet.", "No confirmed Execution Anchor yet.") rendered with a "Human-confirmed" badge — an absent confirmed object is a current production/system state, never confirmed human direction.

**Correction:** `WorkingDirectionItem.authority` (`apps/web/src/lib/workingDirection.ts`) changed from required to optional. All three selectors now set `authority` to `"human-confirmed"` / `"ai-interpretation"` conditionally on the real backing object actually existing (a confirmed revision, a real Core Anchor summary, real Artist guidance), and to `undefined` otherwise — never omitting or fabricating the category, only omitting the badge when there is nothing confirmed to badge. `WorkingDirectionSection.tsx` renders `<AuthorityLabel>` only when `item.authority` is set. §11's earlier note (an absence state stays "under `human-confirmed` styling") is superseded by this correction and no longer accurate — an absence state now never carries any authority badge.

### 15.3 (c) Shared authority strip was visually broken

**Symptom:** category text was duplicated ("CONFIRMED Human-confirmed", "AI AI interpretation"); provenance overlapped other text; a fixed-height narrow strip clipped longer source details.

**Correction, in the shared `apps/web/src/design/components/AuthorityLabel.tsx` (+ `.module.css`)** — the component used by all eleven authority variants across the app, not only Working Direction:

- Removed the abbreviated `MARKER_TEXT` span entirely (it duplicated `LABEL_TEXT`'s wording, e.g. "CONFIRMED" beside "Human-confirmed"). Exactly one concise badge now renders per item.
- `detail` (provenance) now renders in a separate block beneath the badge (a `flex-column` wrapper), not packed into the same row — it wraps naturally (`overflow-wrap: break-word`) and is never clipped by a fixed height (`line-height: 1` was removed from the badge).

`WorkingDirectionSection.tsx` additionally: widened `Grid`'s `minColumnWidth` from `14rem` to `26rem` and capped the grid's own `max-width` at the existing `--content-width-comparison` (`75rem`) token, so normal desktop workspace width shows at most two columns (one below that); added `align-items: start` so cards grow to their natural height instead of stretching to match their row's tallest sibling; replaced the whole-paragraph-as-link pattern with plain `value` text plus a separate, concise "View details" link when `item.href` exists.

### 15.4 (d) Working Direction summary duplicated pre-existing detailed content

**Correction, smallest safe presentation approach, nothing deleted:**

- New shared `apps/web/src/design/components/DetailedContext.tsx` (+ `.module.css`) — a native `<details>`/`<summary>` disclosure, collapsed by default, labelled "Detailed context". Follows the same native-disclosure pattern already established by `EvidenceProvenanceDrawer.tsx`.
- **VFX Shot Overview:** the pre-existing `<dl>` (Confirmed Core Anchor / Latest Version / Latest assessment / Activity) is now wrapped in one `DetailedContext`.
- **CG Task Overview:** the pre-existing `<dl>` (Confirmed Core Anchor / Execution Anchor / Latest Production Version / Dependencies / Activity) is now wrapped in one `DetailedContext`.
- **Artist Task Overview:** the "Why: Creative Intent" and "How: Execution Approach" sections (both read-only Anchor detail, directly duplicating Working Direction's `why-it-matters`/`must-remain-unchanged`/`what-to-do`/`may-explore` items) are wrapped in one `DetailedContext`; the final `<dl>` (Latest Production Version / Latest feedback / Blockers) is wrapped in a second `DetailedContext`. The "What to do now: Artist Guidance" section — including the `GenerateArtistGuidanceButton` action and its detail Panel (non-negotiables, allowed variations, iteration priorities, risks — content not shown anywhere in Working Direction) — is deliberately **not** collapsed: it is the page's one genuinely non-duplicated critical action and stays visible per this task's own instruction.
- Long free-text source content is now excerpted rather than shown in full: a new deterministic, non-LLM `excerptText()` helper (`apps/web/src/lib/workingDirection.ts`) truncates on a word boundary and appends "…", applied to every ReviewNote-content item (VFX/CG/Artist "latest feedback") and to VFX's Intent Signal summary in "current alignment / drift risk". The excerpt is always a literal prefix of the real source text (asserted directly in tests) and the item's existing `href` still links to the full source page — nothing is hidden, only shortened for the card.

### 15.5 Fresh-process re-verification

All four owner-validation URLs reloaded successfully against freshly restarted `apps/api`/`apps/web` processes after this correction:

- VFX: `http://localhost:3000/vfx/shots/8a72858d-8d06-47ab-a28d-5ee077f561c8` — 200.
- CG (confirmed Execution Anchor): `http://localhost:3000/cg/tasks/4cd95082-df46-4d67-92bb-a217cf0e8684` — 200, "Current Execution Direction" present, no "This Task is unavailable".
- Artist: `http://localhost:3000/artist/tasks/4cd95082-df46-4d67-92bb-a217cf0e8684` — 200.
- CG (real ftrack fallback, no confirmed Execution Anchor): `http://localhost:3000/cg/tasks/f1451fda-80be-4820-8d9f-172d71df668f` — 200; every "No confirmed ... yet." line carries no authority badge (confirmed directly in the rendered HTML — zero "Human-confirmed" occurrences on this page).

Confirmed absent on all four pages: the old duplicated-marker pattern ("CONFIRMED" beside "Human-confirmed").

**This does not constitute owner visual validation.** The owner must still perform the checklist in §12.

---

## 16. Owner-validation correction (third pass) — confirmed parent vs. missing child field

**The second owner visual validation attempt confirmed §15's layout, runtime, and general fallback corrections**, but found one further, narrower semantic defect on the same primary CG/Artist validation Task (`4cd95082-df46-4d67-92bb-a217cf0e8684`), which has a **real confirmed Execution Anchor**.

### 16.1 Root cause

Two selector items read a specific optional field on the confirmed `ExecutionAnchorRevisionRead` object and, when that one field was `null`, fell back to the same parent-level "no confirmed Anchor" copy and kept the parent's `human-confirmed` authority and `"Confirmed by ..."` provenance — even though the Execution Anchor itself is genuinely confirmed and other fields on it (`technical_boundaries`) render correctly:

- **CG `production-ready-criteria`** (`apps/web/src/features/cg/task-overview/selectCurrentExecutionDirection.ts`): `value: revision?.production_ready_criteria ?? "No confirmed Execution Anchor yet."` — a confirmed revision with `production_ready_criteria: null` produced the parent-missing fallback text, `authority: "human-confirmed"`, and `detail: "Confirmed by CG Supervisor"`.
- **Artist `may-explore`** (`apps/web/src/features/artist/task-overview/selectCurrentWorkingDirection.ts`): same pattern on `executionAnchor?.allowed_refinements`.

The same shape of bug existed for two further optional child fields not yet reported as visibly wrong on the validation Task, but sharing the identical selector pattern: VFX's `must-remain-unchanged`/`may-vary` (`CoreAnchorRevisionRead.constraints`/`variation_zones`) and Artist's `must-remain-unchanged` (`coreAnchor.constraints`) already used a field-specific fallback *string* (`joinOrFallback`) but still unconditionally inherited the parent's `authority`/`detail` whenever any confirmed revision existed, regardless of whether the specific list was empty.

### 16.2 Corrected field-specific fallbacks

| Selector item | Field | Corrected field-empty text (parent confirmed, field empty) | Parent-missing text (unchanged) |
|---|---|---|---|
| CG `production-ready-criteria` | `production_ready_criteria` | "No production-ready criteria have been recorded in the confirmed Execution Anchor." | "No confirmed Execution Anchor yet." |
| Artist `may-explore` | `allowed_refinements` | "No allowed refinements have been recorded in the confirmed Execution Anchor." | "No confirmed Execution Anchor yet." |
| VFX `must-remain-unchanged` | `constraints[]` | "No Constraints recorded on the confirmed Core Anchor." (pre-existing wording, unchanged) | "No confirmed Core Anchor yet." |
| VFX `may-vary` | `variation_zones[]` | "No Variation Zones recorded on the confirmed Core Anchor." (pre-existing wording, unchanged) | "No confirmed Core Anchor yet." |
| Artist `must-remain-unchanged` | `coreAnchor.constraints[]` | "No Constraints recorded on the confirmed Core Anchor." (pre-existing wording, unchanged) | "No confirmed Core Anchor yet." |

Only the two CG/Artist Execution Anchor items needed new field-specific copy — the three Constraints/Variation-Zones items already had correct field-specific value text (via the pre-existing `joinOrFallback` helper) and needed only the authority/provenance correction below.

### 16.3 Authority and provenance inheritance correction

For all five items above, `authority` and `detail` are now derived from **whether the specific optional field itself has content**, not from whether the parent revision exists:

```ts
const hasProductionReadyCriteria = !!revision?.production_ready_criteria;
// ...
authority: hasProductionReadyCriteria ? "human-confirmed" : undefined,
detail: hasProductionReadyCriteria ? "Confirmed by CG Supervisor" : undefined,
```

(and equivalently for `allowed_refinements`, and for `constraints.length > 0` / `variation_zones.length > 0`). A missing optional child field on a confirmed parent now renders with **no authority badge and no confirmation provenance** — never a fabricated "Confirmed by ..." for content that was never recorded. `sourceId` and `href` are left pointing at the parent revision/route regardless, since the "View details" destination (the real Execution/Intent editor) is still useful and correct even when this one field is empty. No new persisted authority category was introduced — this is purely a selector-level derivation change, reusing the existing `WorkingDirectionAuthority` vocabulary exactly as before. The parent Anchor's *other*, actually-populated fields (`task-goal`/`what-to-do`, `creative-objective`/`why-it-matters`) are unaffected and continue to show `human-confirmed` correctly, confirmed directly by tests (§16.4) and by the real-data re-check (§16.5).

### 16.4 Tests

New focused tests added to all three selector test files, covering exactly the required cases: a populated field retains `human-confirmed` authority and provenance; a confirmed parent with the specific field empty renders the field-specific fallback text (never the parent-missing text) with no authority and no detail, while the same section's other, populated item stays `human-confirmed`; no confirmed parent at all still renders the parent-level fallback; a draft-only Execution Anchor is never treated as confirmed. 8 new tests total (1 VFX, 3 CG, 4 Artist) — see §10 for updated per-file counts.

### 16.5 Fresh-process re-verification

`apps/api`/`apps/web` restarted fresh (no backend change to verify — Task 1 of this pass confirmed no backend source was touched). Both affected pages reloaded successfully and re-checked directly against the rendered HTML:

- CG: `http://localhost:3000/cg/tasks/4cd95082-df46-4d67-92bb-a217cf0e8684` — "Production-ready criteria" now shows "No production-ready criteria have been recorded in the confirmed Execution Anchor." with no authority badge and no "Confirmed by ..." detail; "What this Task must achieve" (the same confirmed revision's `technical_boundaries`) still shows its real content with `Human-confirmed`.
- Artist: `http://localhost:3000/artist/tasks/4cd95082-df46-4d67-92bb-a217cf0e8684` — "What you may explore" now shows "No allowed refinements have been recorded in the confirmed Execution Anchor." with no authority badge; "What you are being asked to do" still shows `Human-confirmed`.
- Neither page contains the string "No confirmed Execution Anchor yet." anywhere (confirmed by direct grep on the rendered HTML) — the parent-missing fallback no longer appears on a Task that genuinely has a confirmed Execution Anchor.

**This does not constitute owner visual validation.** The owner must still re-check the CG and Artist targets in §12.

**Files changed, this correction (additional, on top of §15):** `apps/web/src/features/cg/task-overview/selectCurrentExecutionDirection.ts` (+ `.test.ts`); `apps/web/src/features/artist/task-overview/selectCurrentWorkingDirection.ts` (+ `.test.ts`); `apps/web/src/features/vfx/shot-overview/selectCurrentCreativeDirection.ts` (+ `.test.ts`). No other file changed — no backend, route, sidebar, tab, migration, or persistence file was touched.

---

## 17. Owner visual validation — passed

**Final verdict: Step 9B-1 complete — role-aware Working Direction implemented, automatically validated and owner visually validated.**

This is a documentation-only closeout of an owner-performed visual check against the same four targets named in §12, after both correction rounds in §§15-16. No application source, test, contract, generated file, route, style, database row, or ftrack entity was changed to produce this record.

### 17.1 Correction history (accurate summary)

1. **First validation — failed.** Four causes, all corrected in §15:
   - a stale local `apps/api` runtime process pre-dated the new CG Execution Anchor Decision endpoint's route registration, producing "This Task is unavailable" on the primary CG target (no source defect — a fresh process resolved it);
   - fallback authority semantics were misleading (an absent confirmed object rendered with a "Human-confirmed" badge);
   - the shared authority/provenance layout was unreadable (duplicated marker text, overlapping provenance, a fixed-height clipped strip);
   - the new Working Direction summary excessively duplicated pre-existing detailed Overview content.
2. **Second validation — found one remaining defect.** Corrected in §16: a confirmed parent Execution/Core Anchor's empty *optional child field* (production-ready criteria, allowed refinements) incorrectly inherited the parent's Human-confirmed authority and confirmation provenance instead of using an honest field-specific fallback with no authority badge.
3. **Third validation — passed**, across all four targets, recorded below.

### 17.2 VFX — Current Creative Direction

`http://localhost:3000/vfx/shots/8a72858d-8d06-47ab-a28d-5ee077f561c8`

- Compact two-column layout was readable.
- `Human-confirmed`, `Production fact`, `AI interpretation`, and `Human review required` were visibly distinguishable from one another.
- Provenance (e.g. "Confirmed by VFX Supervisor") did not overlap the badge or the value text.
- Long Review Note and Assessment content was shortened deterministically (excerpted, not summarised by an LLM), with the full source still reachable.
- Full source context remained reachable through the separate "View details" link on each item.
- The duplicated lower content (Confirmed Core Anchor / Latest Version / Latest assessment / Activity) was collapsed under "Detailed context", collapsed by default.

### 17.3 CG — Current Execution Direction

`http://localhost:3000/cg/tasks/4cd95082-df46-4d67-92bb-a217cf0e8684`

- The page loaded successfully after restarting the stale local API process (§15.1) — confirming that cause, not a source defect.
- Confirmed Execution Anchor content ("What this Task must achieve", from `technical_boundaries`) remained labelled `Human-confirmed`.
- Confirmed Core Anchor context retained its own, correct VFX provenance ("Confirmed by VFX Supervisor"), never CG's.
- Missing production-ready criteria used the field-specific fallback ("No production-ready criteria have been recorded in the confirmed Execution Anchor.") rather than the parent-missing fallback.
- That missing field carried no authority badge and no fabricated "Confirmed by CG Supervisor" provenance (§16).
- Version, feedback, dependency, and escalation information remained readable and correctly categorised as `Production fact`.

### 17.4 Artist — Current Working Direction

`http://localhost:3000/artist/tasks/4cd95082-df46-4d67-92bb-a217cf0e8684`

- Confirmed working instructions ("What you are being asked to do") and Core Anchor Constraints ("What must remain unchanged") retained correct `Human-confirmed` provenance where actually populated.
- Missing allowed refinements ("What you may explore") used the field-specific fallback ("No allowed refinements have been recorded in the confirmed Execution Anchor.") rather than the parent-missing fallback.
- That missing field carried no authority badge and no fabricated "Confirmed by CG Supervisor" provenance (§16).
- Production Version and feedback remained labelled `Production fact`.
- Artist Guidance remained explicitly labelled `AI interpretation` — advisory, never presented as a Human Decision.
- No Anchor-authority or cross-role editing control was exposed anywhere on the page (both Anchors remain read-only references, matching §2's locked authority boundary).

### 17.5 Real ftrack partial-data state

`http://localhost:3000/cg/tasks/f1451fda-80be-4820-8d9f-172d71df668f`

- No confirmed Core or Execution Anchor content was fabricated for this genuinely unconfirmed real ftrack Task.
- The missing parent objects were not labelled `Human-confirmed` — every "No confirmed ... yet." line carried no authority badge.
- Real, ftrack-synced Version and feedback information remained visible and correctly categorised as `Production fact`.
- Absence of a recorded Intent Signal / drift risk was not represented as confirmed alignment — the "current risk" line stays honestly absent, never defaulting to an implied "aligned" state.

### 17.6 Next approved activity

Step 9B-1 is complete. The next approved activity is **Step 9B-2** (Production Evidence / Agent Interpretation / Human Decision layering on VFX Intent, VFX Alignment, CG Execution, CG Version Review, Artist Current Version, Artist Feedback History). **Step 9B-2 has not been started by this task** — this task is documentation closeout only. Step 9B-3, Step 9B-4, and Step 9C remain not started, as do Step 9D through Step 9F.
