# Step 9B-3 — Department Execution Overview

**Status:** Implementation and automated validation complete. Owner visual validation pending.
**Branch:** `feat/step9b3-department-execution-overview`
**Starting HEAD:** `a05904c`
**Companion documents:** `docs/step-9/01_STEP_9_PRESENTATION_AND_COMPREHENSION_BASELINE.md` (locked baseline), `docs/step-9/02_STEP_9A_CURRENT_STATE_AND_IMPLEMENTATION_MAP.md` §8 (the feasibility audit this implementation follows almost field-for-field), `docs/step-9/03_STEP_9B1_ROLE_AWARE_WORKING_DIRECTION.md` (the Working Direction pattern this section sits directly below), `docs/step-9/04_STEP_9B2_EVIDENCE_AGENT_HUMAN_LAYERING.md` (the Production Evidence / Agent Interpretation / Human Decision vocabulary this section preserves), `docs/IMPLEMENTATION_STATUS_AND_ROADMAP.md` §L.

---

## 1. Scope and completion status

**Step 9B-3 delivers a read-only Department Execution Overview on the existing VFX Shot Overview page** (`/vfx/shots/:shotId`) — a compact, one-row-per-Task summary of each real Task's Execution Anchor state, latest Version, current focus, open dependencies, alignment concern, and escalation status. It is the one Step 9B package `02_STEP_9A_...md` §8 identified as needing a new backend aggregate (every other Step 9B-1/9B-2 package was pure frontend composition) — that new aggregate is exactly what this step adds, nothing more.

**No new authoritative domain object, migration, Agent workflow, route, sidebar item, or Shot tab was added.** The one new backend surface is a single read-only, VFX-Supervisor-only aggregate endpoint composing already-persisted Task/ExecutionAnchor/ExecutionAnchorRevision/Version/TaskDependency/IntentSignal rows — the same shape and justification `02_STEP_9A_...md` §8 already worked out in detail before this implementation began.

Not started, per this task's explicit scope: Step 9B-4 (media/thumbnail/ftrack context), Step 9C (visual-system unification).

---

## 2. Locked IA and authority boundaries

- **No route added.** The section lives inside the existing `/vfx/shots/:shotId` page — no `/vfx/shots/:shotId/execution` or similar was created.
- **No sidebar item added.** `apps/web/src/lib/roleNavigation.ts`'s VFX entry (`Workspace Home` · `Review Inbox` · `Shots`) is unchanged.
- **No Shot tab added.** `ContextTabs`' five-tab set (Overview · Intent · Versions · Alignment · Activity) is unchanged.
- **No CG Workspace embedding.** Every "View details" link is a real `next/link` to an existing, VFX-permitted route (`/vfx/shots/:shotId/versions`) — never an iframe, never a rendered CG page component, never a direct `/cg/tasks/:taskId` link (which the role-guard middleware would redirect away from anyway).
- **No VFX edit/confirm authority over a CG-owned Execution Anchor.** The new endpoint is read-only end to end: no mutation function was added to `department_execution_overview/service.py`, no Server Action was added for this section, and the frontend section (`DepartmentExecutionOverviewSection`/`TaskExecutionRow`) renders zero buttons and exactly one interactive element per row (`View details →`, a plain navigation link).
- **No role switcher.** The page still renders exactly one role's `AppShell`, unchanged.

---

## 3. Aggregate read model

New Pydantic contract, `packages/contracts/python/src/intent_core_contracts/api/department_execution_overview.py`:

```python
DepartmentExecutionAnchorState = Literal[
    "none", "draft", "awaiting_confirmation", "confirmed", "rejected",
]
DepartmentExecutionLastUpdatedSource = Literal[
    "task_created", "execution_anchor_revision", "version",
    "dependency", "escalation", "alignment_assessment",
]

class DepartmentExecutionTaskRead(BaseModel):
    task_id: UUID
    task_name: str
    department: str | None
    task_source: RecordSource

    execution_anchor_state: DepartmentExecutionAnchorState
    execution_anchor_revision_number: int | None
    execution_anchor_summary: str | None

    latest_version_id: UUID | None
    latest_version_name: str | None
    latest_version_number: int | None
    latest_version_source: RecordSource | None

    current_focus_title: str
    current_focus_actionable: bool

    open_dependency_count: int
    top_open_dependency_description: str | None
    top_open_dependency_severity: TaskDependencySeverity | None

    alignment_concern_summary: str | None
    alignment_concern_attention_level: AttentionLevel | None

    open_escalation: bool
    open_escalation_summary: str | None

    last_updated_at: datetime
    last_updated_source: DepartmentExecutionLastUpdatedSource

class DepartmentExecutionOverviewRead(BaseModel):
    shot_id: UUID
    tasks: list[DepartmentExecutionTaskRead]
    generated_at: datetime
```

Every field maps to a real, already-persisted object — none is fabricated, and every enum-valued field is presentation-safe (never a raw UUID; the TypeScript rendering layer maps every enum to human-readable copy, §8). This is the same "one row per real object, several already-real fields projected together" shape as `VfxInboxItemRead`/`CgInboxItemRead` (`02_STEP_9A_...md` §8's own recommendation, followed exactly).

---

## 4. Endpoint and authorization

**`GET /vfx/shots/{shot_id}/department-execution-overview`** — new package `apps/api/src/intent_core_api/department_execution_overview/` (`service.py` + `router.py`, mirroring the `cg_inbox`/`vfx_inbox` package shape), mounted in `main.py` alongside `vfx_inbox_router` (same `/vfx` prefix family).

```python
@router.get("/shots/{shot_id}/department-execution-overview", response_model=DepartmentExecutionOverviewRead)
async def get_department_execution_overview(
    shot_id: uuid.UUID,
    actor: ActorContext = Depends(get_current_actor),
    session: AsyncSession = Depends(get_session),
) -> DepartmentExecutionOverviewRead:
    overview = await service.get_department_execution_overview(session, actor, shot_id)
    if overview is None:
        raise NotFoundError("Shot not found")
    return overview
```

**Authorization is enforced in the service, not the router** (matching `cross_department/service.py`'s existing pattern, and CLAUDE.md's "permissions must be enforced in backend logic, not only in prompts or UI"): `require_human_role(actor, frozenset({"vfx_supervisor"}))` runs *before* the Shot lookup, so a CG Supervisor or Artist actor gets a `403` without ever learning whether the requested Shot exists. This is a deliberate hardening beyond the existing `vfx_inbox`/`cg_inbox` GET routes (which are unauthenticated reads) — the task explicitly required this endpoint to be VFX-Supervisor-gated using the real `ActorContext` mechanism, not left open like its siblings.

**Exact allowed-role policy:**

| Caller | Result |
|---|---|
| `X-Actor-Role: vfx_supervisor` + valid `X-Actor-Id` | `200`, the real aggregate |
| `X-Actor-Role: cg_supervisor` | `403` (`ForbiddenActionError`) |
| `X-Actor-Role: artist` | `403` |
| No `X-Actor-Role`/`X-Actor-Id` header | `401` (`get_current_actor`'s existing header-validation path) |
| `X-Actor-Role: not_a_real_role` | `401` |
| Valid VFX identity, missing Shot | `404` (`NotFoundError`, the same exception class `vfx_inbox/router.py` already uses for a missing Shot) |
| Valid VFX identity, Shot exists, zero Tasks | `200`, `{"tasks": []}` |

No database mutation, no ftrack request, and no new migration are involved anywhere in this call path — confirmed by the endpoint's own read-only test coverage (§11) and by direct inspection: `department_execution_overview/service.py` contains no `session.add`/`session.delete`/`session.commit` call of its own (the module never writes).

---

## 5. Deterministic source-selection rules

### Execution Anchor state

```
no ExecutionAnchor row for the Task              -> "none"
active_revision_id set, that revision confirmed  -> "confirmed"
a pending HumanGate exists for any revision       -> "awaiting_confirmation"
an un-gated draft revision exists (legacy case)   -> "draft"
the latest revision's own status is "rejected"    -> "rejected"
anything else (including a stray superseded-only
  latest revision with no active pointer)          -> "none"
```

This deliberately reuses the exact same query shape `cg_inbox/service.py`'s `_load_task_related_data` already established for Execution Anchor/gate/draft loading (same three intermediate values: `active_revision`, `pending_gate_id`, `draft_revision_without_gate`) — the *state label* is richer here (5 values vs. `CgInboxItemRead.execution_anchor_state`'s 3), because the task explicitly required distinguishing draft/awaiting-confirmation/rejected, which CG's own coarser 3-value state collapses. `confirmed` is only ever set from a revision whose own persisted `status == "confirmed"` (never inferred from `active_revision_id` alone); a superseded revision is never selected as "current" under any branch, since `active_revision_id` always points at the *current* confirmed revision by domain invariant, and superseded revisions never appear as `latest_revision` in ordinary operation (revision numbers only increase, and superseding only happens via confirming a strictly newer revision). Verified by test: confirming a second revision after an already-confirmed first one reports the *new* revision's number, never the old one (`test_superseded_revision_is_never_shown_as_current`).

### Latest Version

Task-scoped first (`Version.task_id == task_id`), falling back to a Shot-level manual Version (`Version.task_id IS NULL`) per the existing Step 8C-6/8C-7 nullable-`task_id` compatibility rule — **never** a Version explicitly linked to a *different* Task. Ordered by `source_created_at ?? created_at` (the same effective-timestamp rule `apps/web/src/lib/effectiveTimestamp.ts` already establishes on the frontend, reimplemented once, backend-side, in `_effective_timestamp`, since no backend equivalent existed and the public `/versions` create endpoint never accepts `task_id`/`source_created_at` for a test to exercise this any other way).

This is a genuinely new, backend-side, per-Task filter — not a reuse of the frontend's `filterVersionsForTask` (that helper's own docstring locks it to CG/Artist pages and explicitly forbids VFX Shot-wide pages from using it). The distinction: `filterVersionsForTask` scopes an entire *page's* Version list to one Task (forbidden for VFX); this aggregate scopes *one row's* "latest Version" field to its own Task, while the VFX Versions page itself remains completely unchanged and Shot-wide.

### Dependencies

`open_dependency_count` counts `kind IN ("dependency", "conflict")` rows with `status != "resolved"` (matches `cg_inbox`'s own `open_dependency_count` predicate exactly). The single highlighted "top" dependency additionally requires `status == "open"` (excludes "acknowledged", matching `cg_inbox`'s `dependency_needs_attention` input to Current focus) and is chosen deterministically by `(severity_rank, created_at)` — `high` < `medium` < `low` < unset, oldest first within the same severity. A resolved Dependency is never counted or shown as open (verified by test: resolving a Dependency drops `open_dependency_count` to `0` and clears `top_open_dependency_description`).

### Alignment concern

The Task's own latest `IntentSignal` (queried directly by `IntentSignal.task_id`, newest first) — the identical real object VFX Alignment already reads, just Task-scoped instead of Shot-scoped. Always advisory: `alignment_concern_summary`/`alignment_concern_attention_level` are `None` when no Assessment/Signal has ever been generated for the Task, never rendered or worded as "confirmed aligned."

### Current focus

Reused directly: `cg_inbox.current_focus.TaskFocusInputs`/`derive_current_focus` (the exact function CG's own Review Inbox uses) is called with this endpoint's own freshly-loaded `pending_execution_gate_id`/`draft_revision_without_gate_exists`/`dependency_needs_attention`/`version_review_available` inputs — **no second focus-ranking algorithm was written.**

### Escalation

A real, open `TaskDependency(kind="escalation", status="open", escalated_to_role="vfx_supervisor")` for the Task — the same real object/predicate `vfx_inbox/service.py`'s own `open_cg_escalation_*` fields already use (that code's exact query snippet is the template this reuses, scoped per-Task instead of "first across the whole Shot"). **Never** inferred from a high `IntentSignal.attention_level` or a Cross-role Assessment recommendation alone — verified by test (`test_real_escalation_is_reported_and_never_inferred`): before any real escalation Dependency exists, `open_escalation` is `false` even though the Task may separately carry a real, high-attention alignment concern.

### Last updated

The maximum of every real, *included* source object's own timestamp for that row — `task.created_at` (always present, the floor), the displayed Execution Anchor revision's `updated_at`, the selected Version's effective timestamp, the highlighted open Dependency's `created_at`, the open escalation's `created_at`, and the latest `IntentSignal`'s `created_at` — never the request time. `last_updated_source` names exactly which one won; ties are broken by a fixed candidate-list order (deterministic, not arbitrary).

---

## 6. Execution Anchor state mapping (frontend copy)

`apps/web/src/lib/departmentExecutionOverview.ts` maps every real `DepartmentExecutionAnchorState` value to honest, human-readable copy — never the raw enum:

| State | Label |
|---|---|
| `none` | "No Execution Anchor yet" |
| `draft` | "Draft awaiting CG completion" |
| `awaiting_confirmation` | "Awaiting CG confirmation" |
| `confirmed` | "Confirmed (Revision N)" -- only this state ever shows a revision number |
| `rejected` | "Rejected" |

Each state also maps to a `StatusBadge` tone (`confirmed` → `confirmed`; `draft`/`awaiting_confirmation` → `attention`; `rejected` → `blocking`; `none` → `neutral`) — reusing the existing, already-shared `StatusBadge` component and its existing tone vocabulary, not a new badge system.

---

## 7. Version, Dependency, Assessment and escalation mapping

Per `TaskExecutionRow.tsx`:

- **Latest Version**: `"{name} (v{number}) · ftrack-synced"` when `latest_version_source === "ftrack"`, plain `"{name} (v{number})"` otherwise, or the honest `"No Production Version recorded."` fallback.
- **Dependencies**: `"{n} open dependency/dependencies — highest priority: {description} ({severity} severity)"`, or `"No open dependencies."`.
- **Alignment concern**: rendered behind the existing `AuthorityLabel variant="ai-interpretation"` badge (the same "AI interpretation" vocabulary Step 9B-2 already established) plus the real summary/attention-level text, or the honest `"No current alignment concern recorded."` fallback — **never** worded as if absence meant confirmed alignment.
- **Escalation**: a `StatusBadge status="blocking"` labelled "Escalated to VFX" plus the real summary when `open_escalation` is `true`, or the honest `"No open escalation to VFX."` fallback.
- **Last updated**: folded into the Version meta line as `"Last updated {date} ({source label})"`, where `source label` is `lastUpdatedSourceLabel(...)`'s human-readable phrase for `last_updated_source` (e.g. "Execution Anchor updated", "Dependency recorded") — never the raw internal discriminator string.

---

## 8. VFX Shot Overview implementation

New components, colocated with the existing Shot Overview page files (matching the existing `CurrentFocusPanel.tsx`/`NextFocusPanel.tsx`/`ProductionContextHeader.tsx` convention):

- **`DepartmentExecutionOverviewSection.tsx`** — the section wrapper. Renders `null` (nothing) when `overview` is `null` (the role-gated call failed for any reason — network, auth, unexpected error), so a transient failure of this one section never breaks the rest of the Shot Overview page. Renders the honest `"No Tasks are recorded for this Shot."` empty state when `overview.tasks` is empty. Otherwise renders one `<ul>` of `TaskExecutionRow`s.
- **`TaskExecutionRow.tsx`** — one `<li>` per real Task: a header line (Task name, department, Execution Anchor state badge), a Version + last-updated meta line, a Current-focus badge line, and three honest meta lines (dependencies, alignment concern, escalation). Exactly one interactive element per row: a `View details →` link.

**Placement** (`ShotOverviewPage.tsx`): inserted between the existing `WorkingDirectionSection` (Current Creative Direction, Step 9B-1) and the existing `Divider`/`DetailedContext` block — the locked page order is now production-context header → contextual tabs → Current focus → Next-in-this-Shot → Current Creative Direction → **Department Execution Overview** → detailed lower context. This is the placement `02_STEP_9A_...md` §2.4/§8 itself recommended, and the one non-disruptive slot: it sits after the two existing "what does VFX need to know/do right now" panels and before the already-collapsed `DetailedContext` disclosure, never interrupting either.

Both `workingDirection` and `departmentExecutionOverview` remain optional props on `ShotOverviewPage`, defaulting to rendering nothing extra — every pre-existing caller/test that only ever supplied `item` keeps compiling and rendering unchanged (confirmed: zero existing `ShotOverviewPage.test.tsx` assertions needed to change).

---

## 9. Navigation behaviour

**VFX may, from this module:** inspect every real field on every row; navigate via the one `View details →` link per row.

**VFX may not, from this module:** edit or confirm/reject an Execution Anchor; generate or regenerate CG Agent output; add a CG ReviewNote; resolve a CG Dependency; impersonate CG or Artist. None of these controls exist anywhere in `DepartmentExecutionOverviewSection.tsx`/`TaskExecutionRow.tsx` — confirmed by test (`TaskExecutionRow.test.tsx`'s "never renders a CG confirm/reject/generate/resolve control" case: zero `<button>` elements, zero occurrences of "Confirm"/"Reject"/"Resolve"/"Generate" as whole words, and exactly one `<a>` per row).

**Chosen safe navigation destination:** every row's `View details →` link goes to `` /vfx/shots/{shotId}/versions `` — the existing, VFX-permitted, Shot-wide Versions page. No per-Task VFX route exists anywhere in the locked route map (`02_STEP_9A_...md` §4), so a per-Task destination is structurally impossible without adding a new route (explicitly out of this task's scope: "Do not add ... a new Shot tab"). A direct `/cg/tasks/{taskId}` link was considered and rejected: `middleware.ts`'s role guard would redirect a VFX session away from any `/cg/*` path before the page ever rendered, producing a broken/confusing link, exactly the failure mode the task explicitly named and forbade. Versions was chosen over Alignment because it is the more directly Task-relevant existing content (each Task's own recorded Production Version and Review Notes), while Alignment remains reachable from the page's own existing "Latest assessment" link when a real Cross-role Assessment exists.

---

## 10. Empty and partial-data states

All twelve states the task named are covered, verified either by an automated test or by a live check against real persisted data (§13):

| State | Covered by |
|---|---|
| Shot with no Tasks | `test_valid_shot_with_no_tasks_returns_empty_list` (backend) + `DepartmentExecutionOverviewSection.test.tsx`'s empty-state test |
| Task with no Execution Anchor | `test_no_execution_anchor_state` (backend); live: real "Tracking" Task, `bc0040` Shot |
| Draft-only Execution Anchor | `test_legacy_draft_without_gate_reports_draft_state` (backend, the one state not reachable via the live API since every real draft opens a HumanGate atomically) |
| Confirmed Anchor with missing optional fields | Existing `ExecutionAnchorRevisionRead` nullable content fields are read and rendered through unchanged (no new required-field assumption was added) |
| No Version | `test_no_execution_anchor_state`'s Task also has no Version; `TaskExecutionRow.test.tsx`'s "no Production Version recorded" test |
| Only nullable-`task_id` legacy/manual Version | `test_nullable_task_id_version_is_shared_across_tasks` (backend); live: the D1 Shot's two Tasks both share one manual Version |
| No Dependency | `TaskExecutionRow.test.tsx`'s "no open dependencies" test |
| No Assessment | `test_alignment_concern_absent_by_default_never_implies_confirmed_alignment` (backend) + frontend equivalent |
| Assessment present but no escalation | `test_real_escalation_is_reported_and_never_inferred` (backend) — a real high-attention alignment concern with `open_escalation: false` |
| Open escalation with no Version | Not separately isolated as its own test (an escalation and a Version are independent fields, never coupled in the derivation) — the live D1 "Lighting Pass" Task shows an open Dependency (not escalation) alongside a real shared Version, confirming independence |
| ftrack-linked Task with no ICAS Anchor | Live: real "Tracking"/"Animation"/"Rendering" Tasks (`source="ftrack"`) across the `bc00xx`/`S10xx` Shots, each `execution_anchor_state: "none"` |
| Manually created Task with no ftrack link | Live: the D1 Shot's own two Tasks (`source="manual"`) |

Honest copy used throughout (§6/§7): "No Execution Anchor yet", "Draft awaiting CG completion", "Awaiting CG confirmation", "No Production Version recorded.", "No open dependencies.", "No current alignment concern recorded.", "No open escalation to VFX." — none of these is ever shown for a state that is not genuinely true; absence of an Assessment is never described as confirmed alignment.

---

## 11. Tests and automated validation

**New backend test file:** `apps/api/tests/test_department_execution_overview.py` (22 tests) — covers: VFX Supervisor read access; CG Supervisor/Artist/missing-identity/invalid-role rejection; Shot-scoping (only the requested Shot's Tasks are returned); missing-Shot `404`; empty-Shot `200`; read-only/no-mutation (identical results across two reads, Task count unchanged); every Execution Anchor state (`none`/`awaiting_confirmation`/`confirmed`/`rejected`/the legacy `draft` case) including the superseded-revision-never-shown-as-current case; open-vs-resolved Dependency handling; real-escalation-vs-Agent-recommendation distinction; the honest absent-alignment-concern default; no-raw-UUID-in-text-fields; `source_created_at` ordering; a Version linked to a different Task excluded; the nullable-`task_id` compatibility rule.

**New/updated frontend test files:**

- `apps/web/src/lib/departmentExecutionOverview.test.ts` (6 tests) — every state/source label, badge-tone distinctness.
- `apps/web/src/app/vfx/shots/[shotId]/TaskExecutionRow.test.tsx` (11 tests) — every field's real-content and honest-fallback rendering, the ftrack-synced marker, the safe navigation link, and the "no CG control anywhere" assertion.
- `apps/web/src/app/vfx/shots/[shotId]/DepartmentExecutionOverviewSection.test.tsx` (4 tests) — null-overview renders nothing, empty-Tasks honest state, one row per real Task, section heading.
- `apps/web/src/app/vfx/shots/[shotId]/ShotOverviewPage.test.tsx` (+3 tests) — no section when the prop is omitted/`null` (pre-existing callers unaffected); the section renders after Current Creative Direction; Step 9B-1's own Working Direction tests are otherwise byte-for-byte unchanged.
- `apps/web/src/features/vfx/shot-overview/data.test.ts` (+2 tests, existing 6 tests updated for the loader's new second parameter and additional parallel fetch) — a successful Department Execution Overview attaches correctly; a failed one (`403`) does not fail the whole Shot Overview load.

**Full regression, all green:**

- Backend: `pytest` 926/926 (including the 22 new tests), `mypy src` clean (88 source files), `ruff check .` clean, `ruff format --check .` clean (173 files), `uv lock --check` clean (no lockfile drift).
- Contracts (Python): `ruff check`/`format --check`/`mypy` all clean on the new contract file.
- Contracts (TS): regenerated via `export_openapi` → `openapi-typescript`, `tsc --noEmit` clean; `packages/contracts/ts/src/generated/api.ts` diff is a pure 128-line addition (the new schemas/route only) — no other endpoint's generated type changed.
- Frontend: Vitest 990/990 (126 files), `tsc --noEmit` clean, ESLint clean (0 errors, 1 pre-existing/unrelated warning in `CoreAnchorRevisionEditor.tsx`), Prettier clean, production `next build` succeeded (30 routes; `/vfx/shots/[shotId]` grew from 4.76 kB to 4.95 kB, the only route-size change).
- No existing test was weakened, skipped, or deleted to make this pass.

---

## 12. Known limitations

- **`draft` (an un-gated draft revision) is not reachable through the live product today.** Every real draft-creation call path opens a `HumanGate` in the same transaction (`execution_anchor_service.create_draft_revision`), so this state only occurs for a historical revision that predates the HumanGate migration — a real, already-documented legacy-compatibility case (`intent.models.HumanGate`'s own module docstring), exercised in this step's tests at the model layer directly, not via the live API.
- **The "View details" destination is the same Versions page for every row**, regardless of what specifically needs attention on that Task (a dependency vs. an escalation vs. simply wanting to see the Version). This is a deliberate, honest consequence of no per-Task VFX route existing — adding one is out of this step's scope (§9). A future step could add a Task-scoped anchor/query-parameter on the Versions page if this is judged worth doing.
- **No `AgentRun`/model/prompt provenance drill-down** is added for the alignment-concern line — it shows the real summary/attention-level text only, consistent with `04_STEP_9B2_...md` §14's same limitation on the other five priority pages (a deliberate scope boundary, not an oversight).
- **No live example of a genuinely zero-Task Shot exists in the current persisted demo/seed data** — every real Shot sampled from the running dev database has at least one real Task. The empty-list state is nonetheless fully covered by an automated backend test (`test_valid_shot_with_no_tasks_returns_empty_list`) and the frontend's own honest-empty-state test — not silently unverified, and no fake Shot was created to force a live example.

---

## 13. Owner visual-validation targets

Local services: `apps/api` on `http://localhost:8000`, `apps/web` (dev) on `http://localhost:3000`, entry via `http://localhost:3000/demo`. **The owner has not yet performed this validation; it is not claimed as complete.**

**Primary URL** (real, persisted D1 demo data — two real Tasks in varied states):

`http://localhost:3000/vfx/shots/8a72858d-8d06-47ab-a28d-5ee077f561c8`

Expected: a "Department Execution Overview" section appears after "Current Creative Direction" and before the detailed-context divider, with exactly two rows:

- **Compositing Review** (department "comp") — "Confirmed (Revision 2)"; latest Version "D1_STEP3_VFX_REVIEW_001 (v1)"; "No open dependencies."; a real alignment concern under an "AI interpretation" badge ("...human review is warranted."); "No open escalation to VFX."
- **Lighting Pass** (department "lighting") — "Awaiting CG confirmation"; the same shared Version (a manual, `task_id`-null Version, correctly appearing on both rows); "1 open dependency — highest priority: ...contrast grade being locked... (medium severity)"; "No current alignment concern recorded."; "No open escalation to VFX."

**Partial-data URL** (real, ftrack-linked Shot with a Task that has no ICAS Execution Anchor at all):

`http://localhost:3000/vfx/shots/d79f904f-89ce-429f-8e82-eea9f5bca638`

Expected: one row, "Tracking" (department "Tracking", `task_source` ftrack) — "No Execution Anchor yet"; a real ftrack-synced Version ("bc0040_comp_v003 (v3) · ftrack-synced"); "No open dependencies."; "No current alignment concern recorded."; "No open escalation to VFX."

**The owner must verify:**

- all Tasks for the Shot are represented (both URLs: the exact Task count matches `GET /shots/{shot_id}/tasks`);
- Task/Department names are understandable, plain text, never a raw id;
- Execution Anchor states are accurate (compare against each Task's real state via `/cg/tasks/{taskId}/execution` in a separate CG session if desired);
- latest Versions are Task-correct (the shared manual Version legitimately appears on both D1 rows; no Version from a different Shot or a different, unrelated Task ever appears);
- missing data is honest (every empty state reads as a plain, non-alarming sentence, never a blank space or a fabricated default);
- Agent concern is visibly advisory (the "AI interpretation" badge, not a checkmark or "confirmed" wording);
- open escalation is not confused with Agent recommendation (neither URL above currently has a real escalation — this specifically means confirming the section never implies one from the high-attention alignment concern on "Compositing Review");
- VFX has no CG edit/confirmation controls anywhere in this section (no buttons, only the one "View details →" link per row);
- navigation goes to existing permitted pages (clicking "View details →" lands on the real Versions page for that Shot, never a broken or role-blocked link);
- the section improves cross-department understanding (a VFX Supervisor can tell, without leaving this page, that Lighting Pass needs CG confirmation and is blocked on Compositing's contrast grade);
- the Overview remains readable and not overloaded (two rows fit comfortably; each row is a handful of short lines, not a dense grid).

**This document does not perform or claim owner visual validation.**

---

## 14. Explicit non-goals

- Step 9B-4 (media/thumbnail/ftrack context) and Step 9C (visual-system unification) were not started.
- No new authoritative domain object, table, or migration was added.
- No new Agent workflow, prompt, or runtime behaviour was added or changed.
- No ftrack entity or local Step 8 acceptance data row was read differently, modified, or seeded — every URL in §13 uses already-persisted data from a prior task's seed/sync run.
- No new route, sidebar item, Shot tab, or role permission was added or broadened (the one new authorization check *narrows* access relative to the sibling `vfx_inbox`/`cg_inbox` GET routes, it does not widen anything).
- No CG Workspace was embedded; no department-name-string Task matching was used anywhere (every join is by real `Task.id`).
- No VFX edit or confirmation authority over a CG-owned Execution Anchor was introduced.
- No dense dashboard of tiny cards, no second four-column Working Direction grid, no Step 9C visual redesign.

---

## 15. Readiness for Step 9B-4

**Ready**, pending owner visual validation of this step (§13). Step 9B-4's own scope (media/thumbnail/ftrack context on VFX Versions and/or Shot Overview and/or Artist Current Version, per `02_STEP_9A_...md` §9's own recommendation) is unaffected by and independent of this step's work — it needs its own new, small, read-only, per-request ftrack-resolving endpoint (explicitly out of this step's boundary) and does not depend on `DepartmentExecutionOverviewSection`/`TaskExecutionRow`, though a future pass could choose to surface a thumbnail on each Task row's Latest Version line if Step 9B-4 is scoped to include it.

**Files changed, this step (exhaustive):**

Backend: `packages/contracts/python/src/intent_core_contracts/api/department_execution_overview.py` (new); `apps/api/src/intent_core_api/department_execution_overview/__init__.py` (new); `apps/api/src/intent_core_api/department_execution_overview/service.py` (new); `apps/api/src/intent_core_api/department_execution_overview/router.py` (new); `apps/api/src/intent_core_api/main.py` (+1 import, +1 `include_router`); `apps/api/tests/test_department_execution_overview.py` (new).

Contracts (generated/hand-maintained): `apps/api/openapi.json` (regenerated, gitignored); `packages/contracts/ts/src/generated/api.ts` (regenerated); `packages/contracts/ts/src/index.ts` (+4 exported type aliases).

Frontend: `apps/web/src/features/vfx/api.ts` (+`fetchDepartmentExecutionOverview`); `apps/web/src/features/vfx/shot-overview/data.ts` (+`departmentExecutionOverview` field, `loadShotOverviewData` gains an `actorHeaders` parameter); `apps/web/src/features/vfx/shot-overview/data.test.ts` (updated + 2 new tests); `apps/web/src/features/vfx/shot-overview/selectCurrentCreativeDirection.test.ts` (fixture updated for the new required field); `apps/web/src/app/vfx/shots/[shotId]/page.tsx` (resolves identity, forwards actor headers, passes the new prop); `apps/web/src/app/vfx/shots/[shotId]/ShotOverviewPage.tsx` (+prop, +section, locked-order comment updated); `apps/web/src/app/vfx/shots/[shotId]/ShotOverviewPage.test.tsx` (+3 tests); `apps/web/src/app/vfx/shots/[shotId]/DepartmentExecutionOverviewSection.tsx` (new) + `.module.css` (new) + `.test.tsx` (new); `apps/web/src/app/vfx/shots/[shotId]/TaskExecutionRow.tsx` (new) + `.module.css` (new) + `.test.tsx` (new); `apps/web/src/lib/departmentExecutionOverview.ts` (new) + `.test.ts` (new).

No route, sidebar, tab, migration, Agent, ftrack, or Step 8 acceptance file was touched.
