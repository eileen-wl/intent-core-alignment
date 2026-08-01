# ICAS Step 7C-0D — VFX Low-Fidelity Blueprints and Final Implementation Brief

**Status:** Locked (for the decisions this document makes explicit below). Planning and documentation only -- no production UI, routes, components, backend, contracts, migrations, or Agent behaviour are changed by this document.
**Preserves without reopening:** every locked decision in `14_STEP_7C0B_...md` and `15_STEP_7C0C_...md` -- routes, tiering, the Shot Overview model, CrossRoleAssessment/AlignmentAssessment split, identity architecture, Current-focus predicates, mutation contracts, state-transition tables.
**Roadmap position:** completes 7C-0A (task model/IA alternatives) → 7C-0B (locked IA) → 7C-0C (interaction contracts) → **7C-0D (this document: spatial blueprints + final brief)**. Does not begin `7C-1`.
**Corrected by owner review after initial 7C-0D drafting:** the previously-introduced `7C-1A1`-`7C-1A4`/`7C-1A`-`7C-1F` execution roadmap was not part of the approved plan and has been replaced throughout this document. The locked, final implementation route is `7C-1` → `7C-2` → `7C-3` → `7C-4` → `7C-5` → `7D` (§17). Five further corrections were also applied: the Intent comparison responsive rule now uses a container query, not viewport width (§7, §14, §16); the D1 seed's idempotency design now covers every supporting record, not only Project/Shot/Task/Version (§3.4); the `ExternalSource = Literal["ftrack", "demo"]` extension is now owner-approved, not merely recommended (§2.3); legacy AlignmentAssessment is corrected to fully read-only (no Generate/Accept/Reject) anywhere in the new VFX Workspace (§11, and the map in §16); and the unsupported global TopBar Signal indicator is removed from the spatial system (§4.1).

---

## 1. Executive spatial conclusion

Documents 14-15 locked *what* exists and *how it behaves*; this document locks *where it sits on screen* and *the exact files Step 7C-1 through 7C-3 produce*. Three findings shaped the result: **no dialog/modal component exists anywhere in the frontend today** (confirmed by repository-wide search) -- the Confirm/Reject dialog is a genuinely new, small component, not a reuse; **the codebase already has exactly one consistent breakpoint (768px) plus two named-but-unused tokens (`--breakpoint-desktop: 1024px`, `--content-width-comparison: 75rem`)** -- the responsive system below extends this existing convention rather than inventing a new one; and **`ComparisonArea` and `ContextTabs` already exist, tested, unused, and exactly fit** the Intent Workspace comparison and the five-tab Shot navigation, respectively -- large parts of the shell are `REUSE_AS_IS`, not new work.

Two open questions from document 15 are resolved here: the Demo seed identity uses a **compound deterministic key via the existing `ExternalEntityLink` mechanism** (Project/Shot/Task) plus a **stable description-marker prefix** (Version, which has no `ExternalEntityLink` support), never name alone (§2); and the D1 seed's seeded starting state deliberately **excludes** a pending Core Anchor HumanGate, making that the walkthrough's first live, human-driven (not Agent-dependent) action -- locking `alignment_not_followed_by_anchor_action` as the starting Current focus (§3).

---

## 2. Final Demo seed-identity clarification

### 2.1 The problem, precisely

Document 15 §4.3 defaulted to name-based lookup (`Project.name == "D1 Demo Project"`). This task correctly flags the risk: a human manually creating a Project literally named "D1 Demo Project" (plausible -- it is a natural, memorable name) would be silently adopted, mutated, or treated as seed-owned by a future seed run, which is unacceptable (`14_...md`'s own §4.5 "does not overwrite user-created production records" requirement, taken seriously).

### 2.2 Inspected existing fields

- `Project`/`Shot`/`Task`: `id`, `name`, `source` (`RecordSource`, `"manual"|"ftrack"`), `created_at`, `updated_at` -- **no metadata or description column on any of the three**.
- `Version`: same, plus a real `description: Text` column (free text, unbounded).
- `ExternalEntityLink` (`integrations/models.py`): `entity_type: Literal["project","shot","task"]`, `entity_id`, `source: ExternalSource` (currently `Literal["ftrack"]` only), `external_id: str`, `created_at`, `updated_at` -- an existing, purpose-built, already-idempotent (`find_linked_entity_id`) mechanism for "which external system originated this row, and by what stable key." **`Version` is not a supported `entity_type`.**

### 2.3 Locked convention

**Project, Shot, Task:** identified via a real `ExternalEntityLink` row, using the exact same idempotent-lookup pattern already proven for ftrack sync (`find_linked_entity_id`/`record_external_link`), with a **compound deterministic key** as `external_id`:

| Entity | `external_id` |
|---|---|
| Project | `icas-demo:d1` |
| Shot | `icas-demo:d1:shot-010` |
| Task | `icas-demo:d1:shot-010:compositing-review` |

**Approved and locked (owner review after initial 7C-0D drafting; see §6 below for the full semantics):** extend `ExternalSource` from `Literal["ftrack"]` to `Literal["ftrack", "demo"]` in `packages/contracts/python/src/intent_core_contracts/api/integrations.py`. This was originally recorded here as a recommendation requiring its own approval per CLAUDE.md's change-boundary rules -- **the owner has now explicitly approved it, for internal Demo scenario ownership and idempotent resolution only.** It is the one honest existing alternative found -- reusing `source="ftrack"` for a seeded row would misrepresent its provenance (an `ExternalEntityLink` with `source="ftrack"` is read elsewhere in the codebase as "this came from the real ftrack connector," which would be false for seeded data). The change is not expected to require a migration if the underlying database column is a normal string (only the typed contract literal's allowed value set grows by one) -- **Step `7C-1` must still verify the actual schema before changing it**, per §6. Carrying out the change itself remains implementation work inside Step `7C-1`, not something this planning document performs.

**Version:** has no `ExternalEntityLink` support and no metadata column, but does have a real `description: Text` field. Locked convention: prefix the seeded Version's `description` with a stable, parseable marker:

```text
[ICAS Demo — D1] <human-readable description text>
```

The seed locates its own Version by `Version.shot_id == <resolved seeded Shot id> AND Version.description LIKE '[ICAS Demo — D1]%'` -- a compound key (Shot scope + marker), never `Version.name` alone, and never a marker-less Version even if one happens to share a name.

### 2.4 Resolution algorithm (per entity, top-down, idempotent at every level)

```text
resolve_or_create(entity_type, external_id, create_fn):
  link = find ExternalEntityLink(entity_type, source="demo", external_id)
  if link exists:
    row = fetch entity by link.entity_id
    if row is None: raise -- inconsistent-context case, §2.5
    return row
  row = create_fn()             # real service call, real domain row
  record ExternalEntityLink(entity_type, entity_id=row.id, source="demo", external_id)
  return row

seed_d1():
  project = resolve_or_create("project", "icas-demo:d1", create_project)
  shot    = resolve_or_create("shot", "icas-demo:d1:shot-010", create_shot(project))
  task    = resolve_or_create("task", "icas-demo:d1:shot-010:compositing-review", create_task(shot))
  version = find Version(shot_id=shot.id, description LIKE marker%)
            or create_version(shot, description=marker + "...")
  ... continue per §3's lifecycle ordering ...
```

Each level is checked and resolved **independently** -- a Project found via its link does not assume its Shot exists yet; the walk continues top-down regardless of which levels a prior partial run reached.

### 2.5 Duplicate and partial-seed recovery

- **Duplicate (concurrent first-run race):** the `ExternalEntityLink` table's own uniqueness on `(source, external_id)` (an existing constraint per the ftrack-sync pattern, or one Step `7C-1` confirms/adds at the contract level -- not a new migration concept, since `record_external_link` already relies on exactly this shape) makes a losing concurrent insert raise `IntegrityError`; caught, session rolled back, winning row re-fetched -- the same pattern already used by `core_anchor_service.get_or_create_core_anchor`.
- **Partial seed (script crashed mid-chain, e.g. Project+Shot exist, Task does not):** the top-down, per-level resolution in §2.4 completes the missing levels on the next run without re-creating or duplicating the levels that already succeeded -- this is the direct benefit of resolving independently at each level rather than one top-level "does the Project exist" gate.
- **Inconsistent linked context** (an `ExternalEntityLink` row exists but its `entity_id` no longer resolves to a real row -- e.g. manually deleted): **fail loudly**, with a specific diagnostic naming the orphaned link, rather than silently recreating (which risks masking a real bug or producing a second, differently-keyed seed chain) or silently proceeding on broken data. This is a data-integrity anomaly, not a normal "not yet seeded" case, and is treated with the same severity CLAUDE.md gives `InternalConsistencyError`-class problems elsewhere in the codebase -- surfaced to whoever runs the seed, not swallowed.

### 2.6 Approved `ExternalSource "demo"` semantics (owner-locked)

The owner has explicitly approved extending the existing integration-source contract with `ExternalSource = Literal["ftrack", "demo"]`, approved **only** for internal Demo scenario ownership and idempotent resolution -- not as a general-purpose provenance marker. Locked semantics:

- `ExternalEntityLink.source == "demo"` means **ICAS-owned seeded Demo identity** -- a record the seed itself created or resolved, nothing more.
- It must **never** be presented anywhere in the product as a real production integration -- no UI text, badge, or Activity entry may read a `"demo"`-sourced link as if it were `"ftrack"`.
- **Project, Shot, and Task domain `RecordSource` (the separate `source` field already on those tables, `"manual"|"ftrack"`) remain `"manual"` unless genuinely imported from ftrack.** The `"demo"` value belongs only to `ExternalEntityLink.source` -- it is never written to `RecordSource`, and `RecordSource`'s own literal is untouched by this decision (this is the distinction the owner's original "do not change `RecordSource`... unless no honest alternative exists" instruction, from the 7C-0D task, turned on -- the honest alternative found was extending the *other*, purpose-built literal instead).
- `/vfx` always displays the object's real domain source (`manual` or `ftrack`, from `RecordSource`) -- **never** `"demo"` -- so a seeded Shot's source badge reads exactly as a manually-created Shot's would, which is accurate (the Shot itself *was* created the normal way, by the seed calling the normal service functions; only its *identity resolution* used the `"demo"`-sourced link, a fact that stays internal to the seed's own bookkeeping).
- **No migration is expected** if the underlying `ExternalEntityLink.source` database column is a normal string column and only the typed contract `Literal`'s allowed value set changes -- **Step `7C-1` must verify the actual column type/constraints before making the change**, since this document has not re-inspected the live schema DDL to confirm that assumption.
- **No ftrack code path may treat `"demo"` as `"ftrack"`** -- any existing or future code that branches on `ExternalSource` (e.g. sync/reconciliation logic) must treat `"demo"` as its own distinct case, never fall through a catch-all that assumes "anything not manual is ftrack."

This removes the `ExternalSource` extension from this document's unresolved-approval list (§22) -- it is now approved, and remains implementation work inside Step `7C-1`, not a separate stage.

### 2.7 Targeted clarification applied to document 15 (§20 below records the exact edit)

Document 15 §4.3's "locked default (no migration): name-based idempotency" is superseded by §2.3-§2.6 above -- name is no longer the identity key anywhere; it remains only a human-readable display label.

---

## 3. Locked D1 seeded starting state

### 3.1 Stable seeded starting state vs. optional live Agent actions

| | Stable seeded starting state | Optional live Agent actions |
|---|---|---|
| **Contains** | Project, Shot, Task, Version (marked per §2.3), IntentBrief, a **confirmed** Core Anchor revision #1 (reached via the real draft→confirm service calls, seed-actor-authored), a confirmed Execution Anchor revision, one VFXSupervisorReview / CGSupervisorReview / ArtistAgentGuidance, one CrossRoleAssessment (with its required IntentSignal and, if the deterministic generator's evidence-diversity gate is satisfied by the seeded inputs, a ReAnchorProposal), the ContextSnapshot/AgentRun rows the generation pipeline produces along the way | A **new** draft Core Anchor revision + its pending HumanGate (created live, by the presenter, during the walkthrough's Intent step -- §4.3); a **new** CrossRoleAssessment/VFX review/etc. if the presenter chooses to regenerate live with a real provider |
| **Mechanism** | The real service functions (`core_anchor_service.create_draft_revision`/`confirm_revision`, `execution_anchor_service`'s equivalents, `vfx_supervisor_review_service.generate_...`, `cross_role_assessment_service.generate_cross_role_assessment`), invoked by the seed script itself, **running under `MODEL_PROVIDER=deterministic`** (the exact same deterministic-provider mode already used by the entire backend test suite, per `apps/api/tests/conftest.py`) -- real persisted rows through the real pipeline, zero network dependency, fully reproducible on every seed run | The same real service functions, invoked by the presenter's own browser interaction, using whichever provider is configured live (`MODEL_PROVIDER` unset from the deterministic override) |
| **Requires a live model provider?** | **No** -- deterministic provider only, by design | Only for the *optional* regeneration actions; the draft/HumanGate action itself is pure human CRUD and needs no provider at all |
| **On failure** | N/A -- the seed either succeeds (idempotently) or fails loudly (§2.5); there is no partial/degraded "seed" state exposed to a viewer | The previously-successful seeded (or prior live) record remains visible and current -- generation failure never removes it (`04_...md` §2.6, reaffirmed) |
| **Ever described as** | Real persisted data, honestly -- **never** "fake fixture" or "UI mock." It is data created through the same domain model and the same code path as any human-triggered generation, merely invoked once by a script instead of by a click, and pinned to the deterministic provider for reproducibility (the same reason the test suite uses it) | Real, live-generated data, appended, never replacing the seeded fallback |

**No impossible state combination is seeded:** every seeded row is created by calling the real service function with the real prerequisite chain already satisfied at that point in the script (Execution Anchor is only confirmed after Core Anchor is confirmed; role reviews are only generated after both Anchors are confirmed; the Assessment is only generated after all three role outputs exist) -- the seed cannot produce a state the real product logic itself would reject, because it *is* the real product logic, called in the correct order.

### 3.2 Exact lifecycle ordering

```text
T0  Project, Shot, Task, Version, IntentBrief resolved/created (§2.4)
T1  CoreAnchorRevision #1 created as draft
      (core_anchor_service.create_draft_revision, seed actor:
       human_role="vfx_supervisor", actor_id="demo-seed")
T2  CoreAnchorRevision #1 confirmed
      (core_anchor_service.confirm_revision, rationale="Initial seeded
       baseline for the D1 demo scenario") -- real HumanGate + Decision
T3  ExecutionAnchorRevision confirmed for the Task
      (execution_anchor_service equivalents, seed actor:
       human_role="cg_supervisor", actor_id="demo-seed")
T4  VFXSupervisorReview, CGSupervisorReview, ArtistAgentGuidance
      generated for the Task/Version (real generation calls, deterministic
      provider, respective seed actors)
T5  CrossRoleAssessment generated
      (cross_role_assessment_service.generate_cross_role_assessment,
       deterministic provider, vfx_supervisor seed actor) -- persists the
       required IntentSignal and, if the gate is satisfied, a
       ReAnchorProposal
```

No manual timestamp manipulation is needed -- `created_at` ordering is naturally correct because the seed script performs these calls sequentially, in this order, in one run.

**Verification flagged for Step `7C-1`, not decided here:** whether the deterministic generator's fixed output for these specific seeded inputs produces an `attention_level` of `medium`/`high` (needed for §3.3 below) and whether it satisfies `_validate_re_anchor_proposal`'s evidence-diversity gate (producing a Proposal) must be checked against the real deterministic generator once built -- if the default deterministic output doesn't naturally reach `medium`/`high`, the seed's input content (the seeded reviews' text, which the deterministic generator's rules key off) should be adjusted until it does, rather than the derivation logic being special-cased for the Demo.

### 3.3 Locked starting Current focus: `alignment_not_followed_by_anchor_action`

At the end of T5, evaluate `14_...md`/`15_...md`'s six predicates: no pending gate exists (nothing created since T2's confirm resolved cleanly, and no draft #2 exists yet) → 6.1 false. No unsubmitted draft exists → 6.2 false. Latest Assessment (T5) has `medium`/`high` attention and no newer Anchor revision/gate-resolution has occurred since T5 → **6.3 (`alignment_not_followed_by_anchor_action`) true.** This is the locked starting state.

**Why this focus, not a pre-seeded pending gate:** (a) it opens the walkthrough on the Alignment Workspace -- the richest, most demonstrative page (three perspectives, real tension, optional Proposal) -- a stronger opening beat than dropping the viewer directly into a Confirm/Reject decision they didn't see built up to; (b) it keeps the pending-HumanGate capability **live and human-authored** during the walkthrough rather than magically pre-existing, which is a more honest demonstration of the product's actual authority model (a human visibly *creates* the draft that then requires their own confirmation, rather than the demo skipping straight to "click Confirm"); (c) creating that draft requires zero AI provider (pure CRUD), so it is exactly as reliable to demonstrate live as the seeded content is to load -- there is no reliability reason to pre-seed it, only a narrative reason not to.

### 3.4 Complete scenario-level seed idempotency (corrected: covers every supporting record, not only Project/Shot/Task/Version)

§2.3-§2.6 resolved identity for Project, Shot, Task (`ExternalEntityLink`) and Version (description marker). The records created at T1-T5 (§3.2) need their own resolve-or-create rules too, so that **repeated seed execution produces the same baseline scenario, not another baseline history**. One generalizable principle covers all of them, avoiding any further marker fields or contract changes:

> **A record type that is already 1:1 with an identified parent by a real database constraint needs no marker at all** (its existence is already the answer to "has the seed run"). **A record type that is append-only with no active/latest pointer is safely identified as "the earliest row in this parent's scope"** -- because the seed always resolves/creates its parent chain (Project→Shot→Task→Version) *before* any human or live Agent action can possibly target that Shot, the seed's own rows are structurally guaranteed to be the earliest in scope, with no separate marker required.

| Record type | Stable seed-owned lookup rule | Parent/context validation | Reuse condition | Partial-seed recovery | Inconsistency failure | May a later live record become newer? | How the seed distinguishes baseline from live |
|---|---|---|---|---|---|---|---|
| IntentBrief | Earliest IntentBrief for `shot_id == seeded_shot.id` (or, if IntentBrief exposes a free-text input field, the same marker-prefix technique as Version's `description` -- exact field name to confirm at implementation time) | `shot_id` must equal the already-resolved seeded Shot | Found → reuse; none found → create via the real service call | If Shot exists but no IntentBrief yet, create it (independent per-level resolution, §2.4's pattern) | An IntentBrief exists whose `shot_id` doesn't match any resolvable Shot -- structurally impossible given FK enforcement, so this case reduces to the Shot-level inconsistency already handled in §2.5 | Yes -- a human may create additional IntentBriefs live; harmless, since the seed only ever needs *a* brief to proceed, not *the only* brief | Earliest `created_at` for the Shot |
| Baseline Core Anchor + confirmed revision #1 | `CoreAnchor.shot_id` is already unique per Shot (real DB constraint, confirmed in `core_anchor_service.py`) -- at most one `CoreAnchor` row can ever exist for the seeded Shot. Within it, the seed's baseline is **revision #1** (`revision_number == 1`), the first revision any Shot can ever have | `CoreAnchor.shot_id == seeded_shot.id`; revision's `core_anchor_id` matches | `CoreAnchor` exists with a confirmed `revision_number == 1` → reuse (skip T1-T2 entirely); `CoreAnchor` exists but has no confirmed revision yet → resume at whichever of T1/T2 didn't complete; no `CoreAnchor` at all → run T1-T2 in full | Exactly the "resume at whichever step didn't complete" case above -- per-level resolution again, not an all-or-nothing gate | A `CoreAnchor` exists whose `active_revision_id` points to a revision that doesn't belong to it, or similar cross-reference breakage -- this is exactly the class of problem `InternalConsistencyError` already exists for in the real service layer; the seed surfaces the same failure, does not attempt silent repair | **Yes, by design** -- the walkthrough's own live step 8-11 (§18) creates revision #2 and confirms it, deliberately becoming newer than the seeded baseline | Revision #1 is always the seed's; any `revision_number > 1` is, by construction, a later action (live human or, in principle, a future re-seed attempt that must never happen because the seed detects revision #1 already exists and stops) |
| Baseline Core Anchor HumanGate + Decision | 1:1 with revision #1 via `HumanGate.core_anchor_revision_id` (unique column, confirmed in `human_gate_service.py`) and the gate's own `decision_id` | Revision #1 must already be resolved (previous row) | Gate exists for revision #1 → reuse; none → created automatically as part of T2's real `confirm_revision` call (which creates/resolves the gate atomically) | Covered by the Core Anchor row's own partial-recovery above -- these are created in the same transaction as T2 | Same class as above -- surfaced, not silently repaired | No -- this specific gate/Decision pair is permanently tied to revision #1; a later revision gets its *own* new gate/Decision, never a mutation of this one | Tied 1:1 to revision #1, which is itself already distinguished (row above) |
| Baseline Execution Anchor + confirmed revision #1 | Same pattern as Core Anchor, scoped to the seeded Task instead of the Shot (Execution Anchor mirrors Core Anchor's one-per-parent shape and revision-numbering convention) | `ExecutionAnchor`'s task reference `== seeded_task.id` | Same as Core Anchor's row above | Same | Same | Yes -- the CG Supervisor Workspace (`7C-4`, not built here) may add later revisions | Revision #1 is the seed's, by the same reasoning |
| Baseline Execution Anchor HumanGate + Decision, if the real service creates them | Same 1:1-with-revision-#1 pattern as the Core Anchor gate, if `execution_anchor_service` follows the identical `human_gate_service` integration already confirmed for Core Anchor -- **to be verified against the real `execution_anchor_service` code at implementation time**, since this document did not re-inspect it this session | Same | Same | Same | Same | No, for this specific pair | Same |
| Seeded VFXSupervisorReview | No active/latest pointer exists (confirmed, `versions_and_feedback` model docstrings) -- baseline is the **earliest** review for the seeded (Task, Version) pair | Review's Version/Task context matches the seeded pair | Any review already exists for this pair → reuse the earliest as baseline, skip T4's VFX-review call; none → generate it | Independent per-review-type check -- CG review and Artist guidance are resolved separately even if VFX review already exists | A review exists whose Version/Task doesn't resolve to the seeded pair at all -- not reachable through normal FK-respecting creation; treated as the general inconsistency case | Yes -- Step `7C-3`'s "Generate VFX review" action (§11) may add more, shown newest-first alongside the seeded one | Earliest `created_at` for the (Task, Version) pair -- guaranteed earliest because nothing could interact with this pair before the seed created it |
| Seeded CGSupervisorReview | Same pattern as VFX review | Same | Same | Same | Same | Yes, once `7C-4` exists | Same |
| Seeded ArtistAgentGuidance | Same pattern | Same | Same | Same | Same | Yes, once `7C-5` exists | Same |
| Seeded CrossRoleAssessment | No active/latest pointer -- baseline is the **earliest** Assessment for the seeded (Task, Version) pair | Assessment's `task_id`/`version_id` match the seeded pair, and its `core_anchor_revision_id`/`execution_anchor_revision_id` match the seeded baseline revisions (not a later live one -- see below) | An Assessment already exists for this exact pairing against the seeded baseline revisions → reuse, skip T5; none → generate | If T1-T4 partially completed on a prior run, T5 cannot run yet -- the seed's per-level walk simply has not reached T5, not a failure | An Assessment exists referencing a `core_anchor_revision_id` that isn't the seed's baseline revision #1 (e.g. because a live re-anchor already happened) -- this is not an inconsistency, it is the expected post-walkthrough state, and the seed must **not** attempt to create a second "baseline" Assessment in this case; it recognizes the scenario as already past its baseline stage and stops (§3.4's final row expands this) | Yes -- Step `7C-3`'s live "Generate assessment" action, and the walkthrough's own step 8-11, naturally produce newer Assessments | Earliest `created_at` for the pair, exactly as above |
| Required IntentSignal | 1:1 with its owning Assessment (`cross_role_assessment_id` FK) -- never looked up independently | N/A, rides entirely on the Assessment row | Comes free with the Assessment above | Comes free | Comes free | Yes, one per Assessment, however many exist | Tied to whichever Assessment it belongs to |
| Optional but expected D1 ReAnchorProposal | Same -- 1:1 with its owning Assessment, present or absent per `_validate_re_anchor_proposal`'s gate at generation time, never looked up independently | Same | Same | Same | Same | Yes, one per Assessment (or none) | Same |
| Related ContextSnapshot and AgentRun records | Never looked up independently -- always reached via the owning row's `context_snapshot_id`/`agent_run_id` FK (Core Anchor draft, each review, the Assessment) | N/A | Comes free with each owning row above | Comes free | Comes free | Yes, one pair per generation call, however many occur | Tied to whichever owning row created them |
| ReviewNotes needed by the walkthrough | Earliest ReviewNote(s) for the seeded Version (or, if `ReviewNote` exposes a free-text field, the same marker-prefix technique as Version's `description` -- exact field name to confirm at implementation time) | `version_id == seeded_version.id` | Found → reuse; none → create the minimum the walkthrough needs (§18) | Independent per-level check | Structurally unreachable outside the Version-level inconsistency case | Yes -- live review activity may add more | Earliest for the Version, same reasoning as IntentBrief |

**Locked requirements, restated against this table:** repeated seed execution reuses every row above rather than appending a second baseline history (every row's "reuse condition" column is checked before any create call); live user/Agent-generated records are never touched, overwritten, or adopted (the seed only ever *reads* rows outside its own baseline set, never mutates them); the seed never infers ownership from display name alone anywhere in this table (every row uses a structural DB relationship, a real 1:1 constraint, or "earliest in a freshly-created parent's scope" -- never a name match); no impossible relationship is invented (every row is produced by calling the same real service function normal product flows use, in the same dependency order those services already enforce); no row is manually faked when the real service can produce it (confirmed throughout -- every "create" action in this table and in §3.2 is a real service call, not a raw insert); no live network model provider is required for any row in this table (the deterministic provider, §3.1, covers every generation call).

**Tests a first implementation must include** (per the task's explicit list):

1. **Empty database** -- seed run start-to-finish creates the complete baseline scenario exactly once.
2. **Already-complete seed** -- a second run against a database that already has the full baseline is a no-op (no new rows of any type in this table).
3. **Partial seed** -- a database with, e.g., Project/Shot/Task/Version/IntentBrief/confirmed-Core-Anchor already present but nothing from T3 onward: a re-run completes T3-T5 without duplicating T1-T2's rows.
4. **Orphaned/inconsistent seed link** -- an `ExternalEntityLink` (or, for Version, a marker-matching row) that no longer resolves: the seed fails loudly with a specific diagnostic, per §2.5.
5. **Concurrent/repeated invocation** -- two seed runs racing against an empty database: exactly one full baseline scenario results, the loser's redundant inserts are caught and rolled back per the `IntegrityError` pattern (§2.5).
6. **Existing later live records** -- a database where the walkthrough (§18) has already run once live (revision #2 confirmed, etc.): a re-run of the seed still correctly identifies and reuses the *original* baseline rows (revision #1, the earliest reviews/Assessment) without being confused by the newer live rows, and does not attempt to create a redundant second "baseline."
7. **No duplicate baseline Assessment, Signal, Proposal, or Agent output** -- explicitly verified as its own test, since these are the append-only, no-active-pointer types where a naive re-run would be most likely to silently duplicate a "baseline" if the earliest-in-scope reuse rule were implemented incorrectly.

---

## 4. Cross-page spatial system

### 4.1 Application shell

Reuses `AppShell`/`TopBar`/`RoleSidebar` exactly as built (`AppShell.module.css`: `grid-template-columns: 240px 1fr`, stacking to `1fr` at ≤768px).

```text
┌─────────────────────────────────────────────────────────────┐
│ TopBar: product name · role identity (name + role) · Exit     │  56px
│ role view                                                       │
├──────────────┬──────────────────────────────────────────────┤
│ RoleSidebar   │  Content region (breadcrumbs, header, tabs,   │
│ 240px fixed   │  page body) -- padding var(--space-6)         │
│ (VFX items)   │  var(--space-5)                                │
│               │                                                 │
└──────────────┴──────────────────────────────────────────────┘
```

- **Role navigation:** fixed left, 240px, unchanged.
- **Content region:** fills remaining width (`max-width: none` already overridden for the shell, per `AppShell.module.css`).
- **Breadcrumbs:** top of content region, above the page heading (existing `Breadcrumbs` component, unchanged).
- **Role identity:** TopBar, right-aligned area (existing `RoleIdentity`).
- **Exit role view:** TopBar, far right (existing `ExitRoleControl`).
- **No global Signal indicator (corrected by owner review):** the TopBar contains exactly product identity, resolved human role identity, and Exit role view -- nothing else. A global, route-independent Signal indicator was previously sketched here as a future placeholder; it is removed for this first VFX implementation because no route-independent, cross-Shot Signal aggregation exists (`/vfx/signals` remains deferred, `14_...md` §3.2), and showing one would imply a monitoring/notification capability that is not real. Signal appears only where it has truthful object context: Inbox rows (§5), Shot Overview's Current focus/supporting context (§6), and the Alignment Workspace (§9) -- no unread state, no notification tray, and no future placeholder control is added in its place.
- **Narrow-screen behaviour (≤768px, existing token `--breakpoint-tablet`):** sidebar and content region stack vertically (already implemented) -- sidebar becomes a horizontal band above content, not a hamburger drawer (explicit existing decision, `AppShell.tsx`'s own comment: "out of scope for this batch," reaffirmed here as still correct at portfolio scale).

### 4.2 Production-context header

New component (`NEW_COMPONENT_REQUIRED`, §9), reused across all seven VFX routes:

```text
┌─────────────────────────────────────────────────────────────┐
│ D1 Demo Project  ›  Shot 010 — Final confrontation             │  compact,
│ Task: Compositing Review · Version: D1_STEP3_VFX_REVIEW_001    │  2 lines,
│ [manual|ftrack badge]                    Core Anchor: Confirmed│  ~64px
└─────────────────────────────────────────────────────────────┘
```

- Line 1: Project › Shot (the only breadcrumb-like element inside the header itself; the page's own `Breadcrumbs` above it may repeat this more fully -- acceptable redundancy since one is navigational and one is orientational).
- Line 2, left: Task/Version as **two independent metadata items**, per `15_...md` §3.1 -- rendered via the existing `MetadataRow` component (already built, already used on `/demo`), which naturally keeps items as separate labelled entries rather than one joined string.
- Line 2, right: source badge (`FtrackLinkageBadge`, presence-only per `14_...md` §11) + Core Anchor state word.
- **Never a hero area:** fixed compact height (~64px, two text lines + badges), no illustration, no large icon, no background image -- explicitly bounded so it cannot grow into a decorative block.
- **No technical ids** anywhere in this header -- names only.

### 4.3 Contextual tabs

Reuses `ContextTabs` exactly as built (route-backed `<Link>`s, `aria-current="page"` + `data-active`).

```text
Overview   Intent   Versions   Alignment   Activity
```

- **Desktop:** all five labels inline, horizontal, beneath the production-context header, above the page body.
- **Narrow screens (≤768px):** the existing `ContextTabs` component has no built-in overflow handling today (`ADAPT_BEFORE_USE`, §9) -- locked treatment: horizontal scroll within the tab strip (`overflow-x: auto`, no wrapping, no hidden/compact-menu collapse) rather than a dropdown, since five short labels fit acceptably with a scroll affordance at typical tablet widths and a dropdown would hide the very navigation structure that gives the page its context.
- **Active-state treatment (structural):** the existing `data-active` attribute drives a distinct treatment -- underline + weight change, not a filled pill/button (keeps tabs reading as navigation, not as a segmented control, which is reserved for the Alignment perspective switch, §7).
- **Sticky while scrolling:** **locked: not sticky.** The production-context header and tabs scroll away with the page body. Making them sticky was considered and rejected: it would compete with the primary content's own need for vertical space at the comparison-heavy Intent Workspace, and Shot context is already reinforced by the breadcrumb + header, both visible again on any within-Shot navigation (tabs are route changes, so the header/tabs simply re-render at the top of the new page -- no scroll-position memory needed).
- **Retaining Shot context across routes:** purely structural -- every one of the five routes renders the same header (§4.2) and the same tab strip with a different `activeTabId`; navigating between tabs is a normal route transition, not a state-preserving client-side swap (matching `14_...md`'s route-level-Server-Component architecture).

### 4.4 Primary work region

One dominant column per page, width capped per page type (§4.2's header is full content-width; body content uses `--content-width-reading` (45rem) for prose-heavy pages, `--content-width-comparison` (75rem) for the Intent comparison, `--content-width-wide` (90rem) for the Inbox/Versions lists). **Locked avoidances, structurally enforced by using `Stack`/`Section`/`ReadingColumn`/`ComparisonArea` (all real, existing layout primitives) instead of `Grid`/`Card`-per-item:** no full-page card grids (`Grid` is reserved for the `/dev` gallery and `/demo`'s "Explore by role" cards -- not reused in the Workspace); no many-equal bordered panels (one `Panel`/`Card` per page section maximum, not per data item); no nested cards (a `Panel` never contains another `Panel`); no repeated section introductions (`SectionHeader` used once per distinct concern, not once per list row); no simultaneous expansion of all Evidence/history (native `<details>`, closed by default, per `EvidenceProvenanceDrawer`'s existing pattern).

### 4.5 Secondary information patterns (locked, one pattern per purpose -- not interchangeable)

| Pattern | Used for | Not used for |
|---|---|---|
| **Inline disclosure** (native `<details>`, `EvidenceProvenanceDrawer`'s existing shape) | Evidence/Provenance on the page currently being read; Intent Decomposition/Context Reconstruction inspection; legacy AlignmentAssessment compatibility history | Anything requiring focus trapping or a decision (never a substitute for a dialog) |
| **Side drawer** | **Not used.** No existing component, and no page in this Workspace needs a persistent side panel per the locked "no persistent task rail" rule (`14_...md` §3.3) | -- |
| **Modal dialog** | Confirm/Reject Core Anchor only (§8) -- the one genuinely high-authority, irreversible-feeling action in the whole Workspace | Routine navigation, Evidence inspection, Generate actions (these are page-level, not decision-gated) |
| **Separate route** | Version detail (from the Versions collection); Intent/Alignment/Activity from Overview | Anything that is a facet of the *same* decision (e.g. the three role perspectives stay one route, switched via the segmented control, §7 -- not three routes) |
| **Compact status line** | Current focus's one-line explanation; generation running/failed states; the text-evidence-only notice | Full Assessment/Anchor content (too much for a status line) |
| **Subdued historical list** | Activity; collapsed Assessment/revision history groups | The single latest/current result of anything (never subdued) |

---

## 5. `/vfx` Alignment Inbox spatial blueprint

### Desktop (≥1024px)

```text
┌───────────────────────────────────────────────────────────────┐ content
│ Alignment Inbox                                                  │ width:
│ Where VFX Supervisor attention surfaces across your Shots.       │ wide
├───────────────────────────────────────────────────────────────┤ (90rem)
│ Showing 3 Shots                                                  │
├───────────────────────────────────────────────────────────────┤
│ Shot 010 — Final confrontation          D1 Demo Project           │
│   Core Anchor draft awaiting your confirmation                    │
│   Human review required · Compositing Review · v3        [Open →] │
├───────────────────────────────────────────────────────────────┤
│ Shot 022 — ...                          D1 Demo Project           │
│   Cross-role assessment may need your interpretation              │
│   Attention needed · Lighting Pass · v1                  [Open →] │
├───────────────────────────────────────────────────────────────┤
│ Shot 031 — ...                          D1 Demo Project           │
│   Nothing requires your attention right now                       │
│   No signal · Compositing Review · v2                    [Open →] │
└───────────────────────────────────────────────────────────────┘
```

- **Page heading:** `PageHeader` (existing), title + one-sentence description.
- **Scope explanation:** the "Showing N Shots" line -- real count, never omitted, never a fake number.
- **Row container:** a plain `<ul>` of row `<li>`s (list separators, per `--border-subtle` bottom rule, not `Card`-per-row) -- `07_...md`'s existing precedent, applied here for the first time in the real Workspace.
- **Row column priorities (left → right, in reading order, not literal columns):** Shot name (largest, primary) → Current-focus title (second line, bold-ish but not competing with Shot name) → Signal/authority state word + Task/Version (third line, small, muted, Task/Version rendered as `·`-separated independent facts per `15_...md` §3.1, never a joined label) → `Open` (right-aligned, single action per row).
- **Row hover/focus (structural only):** the whole row is the link target (matches `07_...md`'s `ShotCard`/`TaskCard` precedent of a card-as-link, adapted to a list row); focus-visible outline uses `--focus-ring`.
- **Empty state:** `EmptyState` (existing component) -- "No Shots currently need your attention," no forced action.
- **API failure:** `ErrorState` (existing component) -- retry action, no partial fake row.
- **Many-row scroll:** the row list scrolls within the normal page flow (no fixed-height inner scroll container) -- at portfolio scale (single/low-digit Shot counts) this never becomes a real concern; no pagination introduced (`14_...md`/`15_...md` both explicit: not required at this scale).
- **No summary metrics, no card grid, no notification tray:** confirmed absent from this blueprint -- no counts-by-category, no colored tile grid, no bell icon.

**First scan path (locked, matches the task's explicit requirement):** Shot name → Current-focus title → why (the Signal/state word) → Open. Project name, Task, Version, and source badge are deliberately smaller/secondary text on the row's third line, never competing with the first two.

### Narrow width (≤768px)

```text
┌──────────────────────────────┐
│ Alignment Inbox                 │
│ ...description...               │
├──────────────────────────────┤
│ Showing 3 Shots                  │
├──────────────────────────────┤
│ Shot 010 — Final confrontation   │
│ Core Anchor draft awaiting your  │
│ confirmation                     │
│ Human review required            │
│ D1 Demo Project                  │
│ [Open →]                         │
├──────────────────────────────┤
│ ...                              │
```

Each row's fields stack vertically in the same priority order (Shot → focus title → Signal state → Project/Task/Version, each its own line) rather than being dropped -- `Open` becomes a full-width tappable row-end control rather than a small right-aligned link, for a larger touch target.

---

## 6. `/vfx/shots/:shotId` Shot Overview spatial blueprint

### Desktop

```text
┌───────────────────────────────────────────────────────────────┐
│ [Production-context header, §4.2]                                │ 64px
├───────────────────────────────────────────────────────────────┤
│ [Contextual tabs, §4.3 -- "Overview" active]                     │ 40px
├───────────────────────────────────────────────────────────────┤ content
│ ┌───────────────────────────────────────────────────────────┐ │ width:
│ │ CURRENT FOCUS                                                │ │ reading
│ │ Cross-role assessment may need your interpretation           │ │ (45rem)
│ │ No newer Core Anchor action has followed this assessment.    │ │
│ │ Concerns: Shot 010 — Final confrontation                      │ │
│ │                                    [Review alignment →]       │ │
│ └───────────────────────────────────────────────────────────┘ │
│                                                                     │
│ Next in this Shot                                                  │
│  · Draft Core Anchor available from decomposition — Intent →       │
│                                                                     │
│ ─────────────────────────────────────────────────────────────── │
│ Confirmed Core Anchor: "A restrained dusk confrontation..."        │
│ Latest Version: D1_STEP3_VFX_REVIEW_001 (v3)                       │
│ Latest assessment: Human review required                            │
└───────────────────────────────────────────────────────────────┘
```

- **Order (locked, matches `14_...md`/`15_...md` exactly):** header → tabs → Current focus → Next-in-this-Shot (0-2) → supporting context.
- **Current focus spatial treatment:** a single `Panel` (existing component) with a left accent bar (the existing Step 7B-3 "shared left accent bar grammar," reused here rather than a full-bleed colored background) -- **dominant via typographic weight and being first, not via size or decoration.** Locked internal layout: focus-type label (small, uppercase-but-not-dominant per §16's "no all-caps as dominant language" rule -- rendered as a small `StatusBadge`-style chip, not a full-width banner) → title (the page's largest non-heading text) → one-sentence explanation → affected object (Shot name, already in the header, so this line is omitted when it would be pure repetition -- only shown if the focus concerns something more specific than the whole Shot, e.g. a specific revision) → one primary action button, bottom-right of the panel.
- **Next-in-this-Shot:** a plain `<ul>`, no panel/border of its own, smaller type than Current focus, each item a single line (`· <issue> — <destination link>`) -- deliberately list-like, never card-like, so it cannot visually compete with Current focus.
- **Supporting context:** three short lines below a `Divider` (existing component), each a label + one-line value -- explicitly not the full Core Anchor fields, not the three role perspectives (per `14_...md` §11's disclosure matrix) -- and the Signal line here is the **same** Signal already summarized in Current focus's explanation when Current focus is Signal-driven (types 3/4), so supporting context in that case shows the *Core Anchor* and *Version* lines only, omitting a second Signal mention entirely -- this is the concrete mechanism preventing the "same Signal shown twice" rule violation.

**All six Current-focus type layouts (same panel shape, different content):**

| Type | Panel content |
|---|---|
| 6.1 `core_anchor_gate_pending` | "Core Anchor draft awaiting your confirmation" / "A proposed revision to the shared creative intent is ready for your review." / `[Review and confirm →]` |
| 6.2 `core_anchor_draft_needs_review` | "Core Anchor draft in progress" / "A draft revision exists but has not yet been submitted for confirmation." / `[Review draft →]` |
| 6.3 `alignment_not_followed_by_anchor_action` | "Cross-role assessment may need your interpretation" / "No newer Core Anchor action has followed this assessment." / `[Review alignment →]` |
| 6.4 `re_anchor_proposal_present` | "Re-anchor proposal available for consideration" / "The latest assessment includes an advisory suggestion for the Core Anchor." / `[Review proposal →]` |
| 6.5 `assessment_generation_available` | "A new cross-role assessment can be generated" / "All prerequisites are met for this Shot's current Task and Version." / `[Generate assessment →]` |
| 6.6 `none` | "Nothing requires your attention on this Shot right now" / (generic or missing-prerequisite sentence, `15_...md` §6.5's note) / **no button rendered** -- the panel's bottom-right region is simply empty, not a disabled/greyed button (a disabled button implies an action exists but is blocked; here no action is being offered at all) |

### Narrow width

Same vertical order; Current focus panel's action button becomes full-width (below the text, not inline-right); supporting-context's three lines stack with slightly more spacing; Next-in-this-Shot unchanged (already a narrow-friendly list).

---

## 7. `/vfx/shots/:shotId/intent` Intent Workspace blueprint

**Locked comparison layout: side-by-side two-column, adapted from the existing `ComparisonArea` component**, not a field-by-field table and not a hybrid. Reasoning: side-by-side full-height columns give each side room for long creative-intent text and multi-item semantic-collection lists without truncation, which a table-per-field would force into cramped cells; a hybrid (table for scalars, columns for collections) was considered and rejected for introducing two comparison idioms on one page. A hybrid table/columns approach was rejected for the same reason `ComparisonArea` alone is preferred over it -- one comparison idiom, not two.

**Corrected responsive rule (owner review after 7C-0D): the two-column collapse must be driven by the comparison *container's* usable width, not the viewport.** The AppShell's 240px fixed sidebar (§4.1) means the comparison container's actual usable width is meaningfully narrower than the viewport at every breakpoint -- on a standard laptop (e.g. a 1366px-wide screen), the container is only ~1366-240-2×padding ≈ 1050px wide even though the *viewport* is comfortably above `ComparisonArea`'s existing 768px viewport-width collapse threshold, so a naive viewport-width collapse would keep two columns rendering long creative-intent paragraphs and multi-item lists cramped into roughly 500px each -- exactly the over-density problem this whole planning effort exists to prevent. **Locked fix:** the collapse condition uses a CSS container query on the Intent Workspace's comparison container (not `ComparisonArea`'s existing viewport `@media` rule), with a recommended structural threshold of **approximately 62-68rem of usable comparison-container width** -- the exact value to be verified visually during implementation, since container-query thresholds are inherently a "does this actually look right" judgment, not a value this planning document can finalize without seeing real content in a real browser. Below that container width, the layout stacks in this exact order: (1) Current confirmed Anchor, (2) Proposed draft, (3) Change summary, (4) rationale and actions. **`ComparisonArea` is therefore `ADAPT_BEFORE_USE`, not `REUSE_AS_IS`, for this specific page** (§16) -- it needs a container-query-driven collapse (or an equivalent content-aware mechanism) in place of its current viewport-`@media` collapse before it correctly serves the Intent Workspace; its existing viewport-based behaviour may remain perfectly adequate for any other, less content-dense use of the same component elsewhere.

### Desktop — draft pending confirmation (the richest state)

```text
┌───────────────────────────────────────────────────────────────┐
│ [header §4.2] [tabs §4.3 -- "Intent" active]                      │
├───────────────────────────────────────────────────────────────┤
│ Core Anchor confirmation is owned by the VFX Supervisor.          │ compact
│ [HumanDecisionNotice, inline, not a full banner]                  │ authority
├───────────────────────────────────────────────────────────────┤ line
│ ┌─────────────────────────┬─────────────────────────────────┐ │
│ │ CURRENT CONFIRMED          │ PROPOSED DRAFT                    │ │ content
│ │ core_summary...             │ core_summary (editable)...        │ │ width:
│ │ constraints (3)             │ constraints (4, edited)            │ │ comparison
│ │ variation_zones (2)         │ variation_zones (2)                │ │ (75rem)
│ │ drift_risks (1)             │ drift_risks (2)                    │ │
│ │ open_questions (0)          │ open_questions (1, new)            │ │
│ └─────────────────────────┴─────────────────────────────────┘ │
│ Change summary: 1 constraint added, 1 drift risk added,            │
│ 1 open question added                                              │
├───────────────────────────────────────────────────────────────┤
│ Rationale                                                           │
│ [textarea]                                                          │
│                                          [Reject]      [Confirm]     │
├───────────────────────────────────────────────────────────────┤
│ ▸ Evidence and provenance (3 sources)                               │
│ ▸ Intent Decomposition and Context Reconstruction                   │
└───────────────────────────────────────────────────────────────┘
```

- **Compact authority context:** one line, always present while a draft/gate exists, above the comparison -- not a colored banner, plain text with the existing `HumanDecisionNotice`/`AuthorityBoundary` component's inline variant.
- **Current confirmed / proposed draft:** the two `ComparisonArea` columns; draft column is editable in place (form controls replace static text) when the viewer is on this page as the owning VFX Supervisor.
- **Visible differences:** the "Change summary" line beneath the columns -- a real, computed diff of counts/changed fields (not a full text diff), giving orientation without duplicating the columns' own content.
- **Editing mode:** the draft column's fields become inputs; no separate "edit mode" page state is needed since the draft column is always editable when a draft exists and the viewer has authority (§12's `PermissionState` covers the non-owning-role case instead).
- **Rationale field:** plain `<textarea>`, always visible once a draft/gate exists (not hidden until Confirm is clicked) -- so the human can compose their reasoning while still looking at the comparison, not in a rushed dialog-only moment.
- **Reject and Confirm hierarchy:** Confirm is the primary button (solid, `--accent-agent`-family is wrong here since this is human authority, not Agent -- uses a neutral-authority solid style, `--authority-neutral-*` tokens); Reject is a secondary/outline button, same row, Confirm on the right (the stronger, "forward" position) -- both clearly distinct without either being colored red/amber (per §15's explicit "not the entire page red or amber" rule; Reject uses the neutral outline style, not `--state-error`, since rejecting a draft is a normal, non-punitive authority action, not an error).
- **Explicit confirmation dialog:** triggered by clicking either button -- see §8.
- **Success outcome:** the comparison area collapses to a single "current confirmed" display (the draft column disappears, since there is no longer a draft); a brief inline confirmation notice (actor + timestamp) replaces the rationale/button row.
- **Evidence/Provenance access:** one `EvidenceProvenanceDrawer` instance, below the action row, closed by default.
- **Intent Decomposition and Context Reconstruction access:** a **second**, separate `<details>` disclosure, explicitly not inside the Evidence drawer (different concern: these are the Agent-originated *inputs* to a possible draft, not evidence *for* the current comparison) -- placed last, lowest-priority position on the page, closed by default. This is the exact "drawer/disclosure placement" the task asks to be explicit about: two disclosures, not one merged catch-all, ordered Evidence-then-Decomposition/Reconstruction because Evidence is more directly relevant to the decision at hand.
- **Path to Activity:** a plain text link near the bottom of the page ("View full revision history in Activity"), not a repeated history list on this page itself (history lives on Activity per `14_...md` §11).

### Desktop — confirmed Anchor only, no draft

Same header/tabs/authority-line; the comparison area is replaced by a single, full-width `SummaryCard` (existing component) showing the confirmed Anchor's full content, with a `[Create new revision]` button beneath it (leading to §15's "start a new revision" choice of manual vs. from-decomposition). Evidence/Decomposition disclosures remain, unchanged in position.

### Draft-validation error

Inline, next to the specific invalid field within the draft column (per `04_...md` §4's Failure rule) -- e.g. a red-bordered input with a one-line message beneath it, using `--state-error` only on that field, never the whole page or the whole column.

### Pending HumanGate / resolved HumanGate / historical-rejected draft

Pending: exactly the "draft pending confirmation" blueprint above. Resolved (just-confirmed): the "success outcome" state above. Historical/rejected: not shown inline on this page at all -- available only via the Activity link, rendered there with the existing `AuthorityLabel variant="historical"` treatment (per `14_...md` §11, historical Core Anchor revisions are `SECONDARY_ROUTE`).

### Narrow width (and any comparison-container width below the locked ~62-68rem threshold, whichever triggers first)

The container-query-driven single-column collapse (above) stacks "Current confirmed" above "Proposed draft" (in that order -- current-state-first orientation before the change); Change summary, Rationale, and the Reject/Confirm row remain full-width beneath; buttons stack full-width (Confirm above Reject, matching the "stronger action higher" convention already used elsewhere for narrow layouts). This is the same visual outcome as a viewport-width collapse would have produced, reached by a more reliable trigger -- content authors and reviewers should expect the collapse on a narrow phone-like viewport *and* on a standard laptop viewport with the sidebar present, not only below 768px of raw viewport width.

---

## 8. Confirm/Reject dialog blueprint (spatial detail for §15's rules)

```text
┌─────────────────────────────────────────┐
│ Confirm this Core Anchor revision?          │  dialog title
├─────────────────────────────────────────┤
│ You are confirming revision #2 as the        │  decision
│ shared creative intent for Shot 010.          │  summary
│                                                │
│ Rationale: "Aligned the timing constraint     │  (echoes the
│  after reviewing the cross-role assessment."  │  rationale
│                                                │  entered on
│                                                │  the page)
├─────────────────────────────────────────┤
│                        [Cancel]  [Confirm]    │
└─────────────────────────────────────────┘
```

`NEW_COMPONENT_REQUIRED` -- no dialog/modal primitive exists anywhere in the repository today (confirmed by search). Built as a small, focused `ConfirmationDialog` component (native `<dialog>` element, per current HTML/accessibility best practice, rather than a hand-rolled div-with-backdrop -- gets focus trapping and Escape-to-close natively).

- **Title:** names the exact action and object ("Confirm this Core Anchor revision?" / "Reject this Core Anchor revision?").
- **Decision summary:** one or two sentences naming the Shot and revision number.
- **Rationale visibility:** the already-entered rationale text is echoed read-only inside the dialog -- the human sees exactly what they wrote, one more time, before committing (not a second entry field).
- **Primary/secondary button order:** Cancel (left, secondary/outline) / Confirm-or-Reject (right, primary/solid) -- matches the page-level Reject/Confirm ordering convention (§7).
- **Keyboard focus:** on open, focus moves to the dialog's primary button... **except** for Reject, where focus moves to Cancel instead (a small, deliberate asymmetry: Reject is the less-common, slightly more consequential-feeling path relative to a routine Confirm, so it should not be the "just press Enter" default -- this is a UX judgment call, not derived from any doc 14/15 rule, flagged here as a first-time design decision).
- **Escape/Cancel behaviour:** Escape and Cancel both close the dialog with no mutation, returning focus to the page's own Confirm/Reject button that opened it.
- **Pending state:** while the Server Action is in flight, both dialog buttons disable and the primary button's label changes to a present-participle state ("Confirming…"/"Rejecting…") -- native `<dialog>` stays open and un-closeable (no Escape) during this window, preventing an accidental double-submit via close-then-reopen.
- **Double-submit prevention:** covered by the above (button disable + dialog non-closeable while pending) -- no separate debounce needed.
- **Success focus return:** on success, the dialog closes and focus moves to the page's own primary heading (§7's "success outcome" region), so a screen-reader user immediately hears the new confirmed state, not a stale button.

**Generation confirmation (Assessment/VFX review) -- explicitly NOT dialog-gated:** per `15_...md` §14's table, Generate actions have no confirmation dialog (they are advisory-output creation, not a HumanGate) -- this is a deliberate exclusion, not an oversight, keeping the dialog pattern reserved for genuinely high-authority actions only, matching §15's own instruction ("generation confirmation only where genuinely needed" -- resolved here as: nowhere, for this batch's scope).

**Stale/conflict response:** not a dialog at all -- an inline message replacing the dialog's content momentarily before it closes (per `15_...md` §12's error-shape, `kind: "conflict"`), e.g. the dialog's body text swaps to "This was already confirmed or rejected elsewhere," Confirm/Reject buttons replaced by a single `[Reload]` action.

**Permission-denied response:** not reachable via normal navigation (route-level lock + hidden controls per `14_...md`/`15_...md`); if somehow reached, rendered as `PermissionState` inline on the page, never as a dialog (a dialog implies an action was attempted and needs a decision; a permission boundary is a read-only fact, better shown inline per the existing component's own design intent).

---

## 9. `/vfx/shots/:shotId/alignment` Alignment Workspace blueprint

**Locked interaction order (unchanged from `15_...md` §9):** Signal conclusion → top tension → Assessment summary → one perspective at a time → Re-anchor Proposal → Evidence → Open Intent Workspace.

### Desktop — latest successful Assessment

```text
┌───────────────────────────────────────────────────────────────┐
│ [header §4.2] [tabs §4.3 -- "Alignment" active]                   │
├───────────────────────────────────────────────────────────────┤
│ Human review required                                               │ 1. Signal
│ Camera timing and compositing contrast have begun to drift...       │
├───────────────────────────────────────────────────────────────┤
│ Top tension: VFX and CG readings diverge on contrast intensity.     │ 2. tension
├───────────────────────────────────────────────────────────────┤
│ Assessment summary: 2 agreements, 1 tension, 1 local-optimum risk    │ 3. summary
├───────────────────────────────────────────────────────────────┤
│ ( VFX Supervisor ) ( CG Supervisor ) ( Artist )     ← segmented        │ 4.
│ ┌───────────────────────────────────────────────────────────┐ │    perspective
│ │ Current position: "..."                                       │ │    (one shown)
│ │ Protected intent: "..."                                       │ │
│ │ Main concerns: "..."                                          │ │
│ │ ▸ Evidence (2 sources)                                        │ │
│ └───────────────────────────────────────────────────────────┘ │
├───────────────────────────────────────────────────────────────┤
│ Re-anchor Proposal                                                   │ 5.
│ "Contrast boundaries may need to be widened..."                     │
│ ▸ Proposed fields (2)   ▸ Adoption risks (1)                         │
├───────────────────────────────────────────────────────────────┤
│ ▸ Evidence and provenance (full assessment, 5 sources)               │ 6.
├───────────────────────────────────────────────────────────────┤
│                                            [Open Intent Workspace →]  │ 7.
├───────────────────────────────────────────────────────────────┤
│ ▸ Previous assessments (2)                                           │ history
└───────────────────────────────────────────────────────────────┘
```

Content width: `--content-width-comparison` (75rem) -- wide enough for perspective text to breathe without becoming the full 90rem list-width (this page reads more like a document than a table).

**Segmented VFX/CG/Artist control, spatial detail:** three `StatusBadge`-sized buttons in one row, styled as a **segmented group** (shared container, no gaps between segments, active segment filled with `--authority-neutral-surface`, inactive segments plain text) -- deliberately **not** styled like `ContextTabs` (no underline, no route change, no `Link`) so it reads as "one Assessment, three facets," not "three pages." Clicking a segment swaps only the perspective panel directly beneath it (client-side state within the Client island, no route change, no server round-trip -- the three perspectives are already all present in the already-fetched `CrossRoleAssessmentRead`).

- **Active perspective content placement:** directly beneath the segmented control, inside one `Panel`.
- **Long perspective text:** the panel has no fixed height and no internal scroll -- it grows with content and the page scrolls normally (avoids a scroll-within-scroll problem).
- **Perspective evidence:** its own small `EvidenceProvenanceDrawer` instance nested inside the active perspective's panel (per-perspective evidence, distinct from the full-assessment Evidence drawer at step 6) -- **nested disclosure limit: exactly one level** (a `<details>` inside a `Panel`, never a `<details>` inside another `<details>`).
- **Re-anchor Proposal stays advisory:** rendered with the existing `AgentAdvisoryNotice`/`AuthorityBoundary` styling (violet Agent-accent, not neutral-authority) and **no button of any kind inside its own section** -- the only action anywhere near it is step 7's `Open Intent Workspace`, positioned *after* Evidence, visually separated from the Proposal's own content by the Evidence disclosure between them, so it reads as "the page's one action," not "the Proposal's own button."
- **Historical Assessments:** one `<details>` at the very bottom, "Previous assessments (N)" -- each, when expanded, shows a compact summary (not the full segmented-perspective UI) with its own "View full" secondary expansion if needed -- kept intentionally lighter than the current Assessment's full treatment.

### No Assessment / prerequisites missing / Task–Version selector

```text
┌───────────────────────────────────────────────────────────────┐
│ [header] [tabs]                                                    │
├───────────────────────────────────────────────────────────────┤
│ No current Intent Signal                                            │
│ A successful Cross-role Assessment is required.                     │
├───────────────────────────────────────────────────────────────┤
│ Prerequisites                                                       │
│  ✓ Confirmed Core Anchor                                             │
│  ✗ Confirmed Execution Anchor for a Task — owned by CG Supervisor     │
│  — VFX / CG / Artist outputs for a Task and Version                  │
├───────────────────────────────────────────────────────────────┤
│ [only rendered once all ✓]                                          │
│ Choose the Task and Version this assessment will evaluate            │
│ Task:    [ select ▾ ]                                                │
│ Version: [ select ▾ ]                                                │
│                                      [Generate assessment] (disabled  │
│                                       until both chosen)              │
└───────────────────────────────────────────────────────────────┘
```

- **Prerequisite checklist:** a plain checklist (✓/✗/— for not-yet-checked), each unmet item naming its owning role (`15_...md` §6.5's honest missing-prerequisite content) -- replaces the generation panel entirely; no selector or Generate button rendered until every item is ✓.
- **Task–Version selector, appearing only once prerequisites are met and no pairing is yet established:** two plain `<select>` elements (not a custom combobox -- no existing combobox component, and native selects are sufficient at the real, small scale of Tasks/Versions per Shot), both defaulting to a blank/placeholder option (never pre-selected, per `15_...md` §3.2/§3.3's explicit no-index-zero rule), Generate disabled until both have a real selection.
- **How existing Assessment context prevents confusion with the current persisted pairing:** once an Assessment exists, this entire selector block is replaced by a single-line, non-editable display -- "Evaluating: Compositing Review · v3" -- styled as plain text, not as a form, so it cannot be mistaken for an editable selector; a **new** selector only reappears if the presenter explicitly starts a *new* generation (a "Generate a new assessment" secondary action beneath the current Assessment, which re-opens the two-select form for that specific new call).

### Generation pending / failure with previous Assessment retained

Pending: the Task/Version identity line (or the just-submitted selector's chosen values, now locked/non-editable) stays visible with a running-state row beneath it (existing `LoadingSkeleton`-family treatment, text-based "Generating assessment…" not a full-page skeleton). Failure: the **previous** successful Assessment's full blueprint (the "latest successful Assessment" layout above) renders exactly as before, with one additional compact failure row inserted directly above it -- "The most recent generation attempt failed. [Details ▾]" -- never replacing or dimming the still-current Assessment.

### Historical Assessment selected (expanded from the collapsed list)

Renders inline, directly beneath the "Previous assessments" disclosure's summary line (not a navigation to a new page, not a modal) -- same internal structure as the current Assessment's full blueprint but wrapped in a `historical` `AuthorityLabel` treatment (muted border, "Historical" tag) so it cannot be confused with the current one even though its internal layout is identical.

**No Apply. No Accept/Reject for CrossRoleAssessment.** Confirmed absent from every state above.

### Narrow width

Segmented control's three labels shrink to fit or wrap to two lines if needed (still one row of three buttons, not stacked vertically -- stacking would make it look like three stacked options rather than one 3-way toggle); everything else in this page's blueprint is already single-column by design (no `ComparisonArea` used here), so narrow-width mostly reduces to normal text reflow plus the segmented-control accommodation.

---

## 10. `/vfx/shots/:shotId/versions` Version collection blueprint

Compact list (not a table with visible gridlines -- a list with aligned columns via CSS grid, avoiding a literal `<table>`'s heavier visual weight):

```text
┌───────────────────────────────────────────────────────────────┐
│ Versions — Shot 010                                                 │ wide
├───────────────────────────────────────────────────────────────┤ (90rem)
│ D1_STEP3_VFX_REVIEW_001   v3   manual   "Contrast note..."  [Open →]│
│ D1_STEP2_VFX_REVIEW_001   v2   manual   —                   [Open →]│
│ D1_STEP1_VFX_REVIEW_001   v1   manual   —                   [Open →]│
└───────────────────────────────────────────────────────────────┘
```

- **Fields, left to right:** Version name (primary) → number → source badge → latest ReviewNote excerpt (truncated to one line, `—` when none, never invented) → Open.
- **Date:** **not included** -- `created_at` exists but was judged not to add real orientation value beyond the already-visible version-number ordering at this scale; omitted rather than added "because it's available" (the task's own "only if supported and useful" qualifier resolved as: supported, not judged useful enough here).
- **Empty state:** `EmptyState` -- "No Versions recorded yet for this Shot."
- **Many-Version behaviour:** same as the Inbox (§5) -- normal page scroll, no pagination at portfolio scale.
- **Narrow-width stacking:** each row's fields stack (name, then number+source on one line, then ReviewNote excerpt, then a full-width Open) -- same pattern as the Inbox's narrow rows (§5).
- **No media thumbnails** (no real media data exists anywhere in the domain model -- confirmed, not merely assumed). **No invented review status** (no persisted field for it, confirmed in `13_...md`/`14_...md`).

---

## 11. `/vfx/shots/:shotId/versions/:versionId` Version Workspace blueprint

### Desktop

```text
┌───────────────────────────────────────────────────────────────┐
│ [header §4.2 -- Version identity replaces Task/Version line with   │
│  full Version name/number] [tabs -- "Versions" active]              │
├───────────────────────────────────────────────────────────────┤ content
│ D1_STEP3_VFX_REVIEW_001 (v3)                                        │ width:
│ "Compositing pass reviewing camera timing and contrast."            │ reading
├───────────────────────────────────────────────────────────────┤ (45rem)
│ Review Notes (2)                                                     │ 2.
│  · "..." — <author/source>                                           │
├───────────────────────────────────────────────────────────────┤
│ Confirmed Core Anchor: "A restrained dusk confrontation..."          │ 3.
├───────────────────────────────────────────────────────────────┤
│ VFX Supervisor Agent review                          [Generate]       │ 4.
│ "Based on Version description and ReviewNote text — no media was     │
│  inspected."                                                          │
│ [latest review content...]                                            │
├───────────────────────────────────────────────────────────────┤
│ ▸ Previous reviews (1)                                                │ 5.
├───────────────────────────────────────────────────────────────┤
│ ▸ Evidence and provenance                                             │ 6.
├───────────────────────────────────────────────────────────────┤
│ ▸ Legacy alignment-assessment history (compatibility)                 │ 7.
└───────────────────────────────────────────────────────────────┘
```

- **Generate VFX review placement:** inline with the section 4 heading, right-aligned button -- not a separate generation panel page, matching `04_...md` §6's "generation and result remain on the same page" rule.
- **Text-evidence-only notice:** a fixed, always-visible line directly beneath the section heading (not inside a disclosure -- it is a permanent limitation statement, not supplementary detail) -- stays visible whether a review exists yet or not.
- **Previous successful reviews after failure:** section 4 always shows the latest *successful* review's content; a failure renders as a compact row directly above the section 4 heading (same pattern as Alignment's failure treatment, §9), never replacing section 4's content.
- **Generation failure without taking over the page:** confirmed by the above -- the failure notice is one line, the rest of the page (Version context, ReviewNotes, Anchor summary, prior reviews) is entirely unaffected.
- **Legacy section visually secondary:** collapsed `<details>` (section 7), placed **last**, using the muted/historical token family (`--state-historical-*`) for its summary text -- deliberately the visually quietest element on the page.
- **Legacy AlignmentAssessment is read-only here, with no mutation surface of any kind (corrected by owner review after 7C-0D):** section 7, when expanded, shows only the historic result and historic Decision records (envelope content, alignment state, confirming actor/timestamp) -- **no Generate control, no Accept control, no Reject control appears anywhere in this section, or anywhere else in the new VFX Workspace.** Mutating a legacy AlignmentAssessment remains possible only in the legacy `/shots` engineering workflow, unaffected by this document. No Artist Agent action surface exists on this page either (confirmed absent, unchanged).

### Narrow width

Single column already (no `ComparisonArea` on this page) -- normal reflow; the Generate button in section 4 moves below its heading text rather than staying inline-right, to avoid crowding at narrow widths.

---

## 12. `/vfx/shots/:shotId/activity` Activity blueprint

### Desktop

```text
┌───────────────────────────────────────────────────────────────┐
│ [header] [tabs -- "Activity" active]                               │
├───────────────────────────────────────────────────────────────┤ reading
│ Today                                                                │ (45rem)
│  ● Human-confirmed  Core Anchor revision #2 confirmed                │
│    by Maya Chen · 2:14pm                              [View →]       │
│  ● AI interpretation  Cross-role assessment generated                │
│    Human review required · 1:58pm                     [View →]       │
│                                                                        │
│ Yesterday                                                             │
│  ● Human intent  Core Anchor revision #1 confirmed                   │
│    by Maya Chen · 4:02pm                               [View →]       │
│  ● Production fact  Version D1_STEP3_VFX_REVIEW_001 recorded          │
│    3:40pm                                                              │
└───────────────────────────────────────────────────────────────┘
```

- **Grouping:** by calendar date (Today/Yesterday/explicit date), not by workflow phase -- chosen because Activity's own purpose (`06_...md` §12.1) is "what happened, in what order," which is a time question, not a phase question; phase is already the *tabs'* job (Intent vs. Alignment vs. Versions).
- **Entry anatomy:** authority/source label (small colored dot + word, per `06_...md` §10's required label set) → event title (plain sentence, human-readable, not a raw `decision_type` enum string) → concise result (actor/timestamp, or Signal level for an Assessment) → optional `[View →]` link when the event has a real destination route (a Decision links to Intent; an Assessment links to Alignment; a bare production fact like "Version recorded" may have no further destination and omits the link).
- **Optional disclosure:** none inline on this page -- Activity is intentionally a summary list; "View" navigates to the owning route rather than expanding in place, keeping Activity itself lightweight even as history accumulates.
- **Partial-data failure:** one small inline notice inserted at the point in the chronological list where a source failed to load (e.g. "Some Decision history could not be loaded" as its own list-like row, styled with `ErrorState`'s compact/inline variant, not a full-page error) -- the rest of the list renders normally around it.
- **Historical density management:** at portfolio scale, no additional collapsing is introduced beyond date-grouping; if a future scale problem emerges, that is out of this document's scope (no pagination built now, per the task's explicit instruction).
- **No unread status, no chat-feed styling, no enterprise activity-centre patterns:** confirmed -- no avatars-in-bubbles, no "mark as read," no filter/search bar, no infinite-scroll loading spinner pattern.

**Which events link back where:** Core Anchor revision/Decision events → Intent Workspace; CrossRoleAssessment/Signal events → Alignment Workspace; Version/ReviewNote/legacy-AlignmentAssessment events → the specific Version Workspace.

### Narrow width

Same date-grouped list, full width; `[View →]` remains inline (short label, fits at any width tested).

---

## 13. Evidence, Provenance, and technical-detail placement

**Locked: inline disclosure (native `<details>`), not a right-side drawer and not a separate route.** A right-side drawer was evaluated and rejected: it requires a new overlay/portal component (none exists) and a mobile-collapse behaviour decision that an inline disclosure sidesteps entirely by already being part of normal document flow at every width. A separate route was rejected: Evidence is explicitly meant to be read "without losing the current page context" (this section's own header), and a route change is the one navigation pattern guaranteed to do exactly that.

- **Evidence used to understand the current decision:** opens in place, page does not scroll or navigate -- confirmed by the `<details>` mechanism itself (§4.5, §9's per-perspective nesting).
- **Historical records:** Activity or the collapsed history disclosures already specified per page (§7, §9, §11) -- never inside the Evidence drawer itself (kept as two distinct disclosure concerns, per §7's explicit two-disclosure rule).
- **Technical provenance** (AgentRun, ContextSnapshot id, source ids, timestamps): the second half of `EvidenceProvenanceDrawer`'s existing content (`ProvenanceMetadata`, already built) -- rendered below the human-readable Evidence list within the same disclosure, smaller type, monospace for ids (`SourceReference`'s existing label-first/id-second convention, reused).
- **Drawer width:** n/a -- not a drawer; the disclosure's content simply occupies the full width of its containing column (comparison-width on Intent, reading-width elsewhere).
- **Mobile behaviour:** identical to desktop -- `<details>` needs no special narrow-width handling at all, which is a real, concrete advantage of this choice over a drawer (one less responsive case to design).
- **Closing and focus-return:** native `<details>` toggle -- clicking `<summary>` again collapses it; focus remains on the `<summary>` element throughout (native behaviour, no custom focus management needed).
- **Nested disclosure limit:** exactly one level (§9) -- a `<details>` never contains another `<details>`; where two genuinely distinct disclosures are needed on one page (Intent Workspace's Evidence vs. Decomposition/Reconstruction, §7), they are two sibling disclosures, not nested.
- **Drawer URL:** n/a -- open/closed state is never reflected in the URL (matches "not a separate route," and avoids the deep-linking complexity a drawer-with-URL-state would add for no real benefit at this scale).
- **Partial fetch failure:** if the Evidence/Provenance data itself fails to load when the disclosure is opened, the disclosure's content area shows a one-line `ErrorState`-style message in place of the evidence list -- the `<summary>` row itself (and thus the count shown before opening) still renders from whatever data did load.

**The `ContextSnapshot` payload itself is never shown** -- confirmed absent from every blueprint in this document, matching `14_...md` §11's `NOT_SHOWN` classification.

---

## 14. Responsive behaviour

Three structural widths, extending the existing token system (`--breakpoint-tablet: 768px`, `--breakpoint-desktop: 1024px`) with one new named width for the widest tier:

| Tier | Width | Existing/new token |
|---|---|---|
| **Wide desktop** | ≥1280px | new: `--breakpoint-wide: 1280px` (recommended addition, not implemented here -- a CSS-only token addition, not a contract/schema change) |
| **Standard laptop** | 1024-1279px | existing `--breakpoint-desktop: 1024px` marks its lower bound |
| **Narrow/tablet** | ≤768px | existing `--breakpoint-tablet: 768px` |

(The 769-1023px band behaves identically to "standard laptop" -- no fourth tier introduced; mobile-phone-specific optimisation is explicitly not a requirement per the task, and no blueprint above breaks below 768px, only reflows.)

| Route | Column collapse | Header wrap | Tab overflow | Comparison | Drawer | List/table | Dialog width | Sticky changes | Moves behind disclosure |
|---|---|---|---|---|---|---|---|---|---|
| `/vfx` | n/a (already single-column list) | n/a | n/a (no tabs) | n/a | n/a | rows stack fields vertically (§5) | n/a | n/a | nothing new |
| Shot Overview | n/a (already single-column) | header's two lines may wrap to three at ≤768px if Task+Version+badges don't fit one line | tab strip scrolls horizontally (§4.3) | n/a | n/a | n/a | n/a | n/a | nothing new |
| Intent Workspace | **container-query-driven** 2-col→1-col at ~62-68rem of comparison-container width, not viewport width (§7, corrected) | same as above | same as above | collapses per above, independent of the "wide desktop/standard laptop/narrow" viewport tiers above -- may collapse on a standard-laptop viewport if the sidebar leaves insufficient container width | n/a | n/a | dialog width caps at `min(90vw, 32rem)` at any tier | n/a | Decomposition/Reconstruction disclosure unaffected (already collapsed by default at every width) |
| Alignment Workspace | n/a (single column throughout) | same as above | same as above | n/a (no `ComparisonArea` used here) | n/a | n/a | n/a | n/a | segmented control's labels shrink/wrap within their row (§9) |
| Versions collection | n/a | same as above | same as above | n/a | n/a | rows stack (§10) | n/a | n/a | nothing new |
| Version Workspace | n/a | same as above | same as above | n/a | n/a | n/a | n/a | n/a | Generate button drops below its heading (§11) |
| Activity | n/a | same as above | same as above | n/a | n/a | date-grouped list already narrow-friendly | n/a | n/a | nothing new |

**No essential action is ever hidden behind a responsive collapse** -- every collapse above is a *layout* change (stacking, wrapping, scrolling) not a *content* removal; the one exception, "moves behind disclosure," only ever applies to content that was *already* collapsed-by-default at every width (Decomposition/Reconstruction), never to a Tier-1 primary or secondary action.

---

## 15. Visual hierarchy rules (structural, not final decoration)

- **Page heading vs. section heading vs. body:** page heading (`PageHeader`'s existing title size, `--font-size-2xl`) → section heading (`SectionHeader`'s existing size, `--font-size-lg`) → body (`--font-size-md`/`--font-size-sm`) -- a strict three-step scale, reusing existing components' existing sizes rather than introducing a fourth.
- **Maximum simultaneously strong headings:** **two** -- the page heading (in the header/breadcrumb region) and, at most, one section heading visible in the current viewport at a time (e.g. "Current focus" is *not* rendered as a `SectionHeader` at all -- it uses body-weight-plus-color emphasis instead, specifically so it does not compete with the page's one real section heading below it, keeping the "two strong headings" rule honest rather than nominal).
- **One primary action per state:** confirmed throughout §5-§12 -- every blueprint has exactly one solid/primary-styled button visible at a time (Confirm *or* Generate *or* Open, never two solid buttons in the same view; Reject/Cancel are always the secondary/outline style).
- **Restrained status colour:** amber (`--state-attention`) reserved for `medium`/`high` Signal wording only; red (`--state-error`) reserved for genuine failures (API/generation errors), never for Reject; green (`--state-success`) never used anywhere in this Workspace (per `06_...md` §12, reserved for confirmed *technical* success, and this Workspace has no such concept to display -- human confirmation uses the neutral-authority palette, not green).
- **Typography-first hierarchy:** confirmed by the above -- weight/size/color-restraint carries hierarchy; borders are secondary (next point).
- **Limited border use:** one border weight (`--border-subtle`) for list separators and disclosure summaries; `--border-strong` reserved for the one accent-bar treatment on Current focus and the segmented-control container -- never used for routine panel outlines (panels use background-color contrast against `--surface-page`, not borders, to separate from the page).
- **Whitespace between workflow stages:** `--space-6`/`--space-7` between major page sections (e.g. between Current focus and Next-in-this-Shot; between the comparison and the rationale/button row) -- larger than the `--space-4`/`--space-5` used within one section, so vertical rhythm itself signals "new stage" without a heading or a divider line being required everywhere.
- **List separators, not card containers, for collections:** confirmed throughout (§5 Inbox, §10 Versions, §12 Activity) -- none of the three collection pages uses `Card`.
- **No large empty decorative areas:** confirmed -- every blueprint's regions are content-driven height, no fixed-height hero/illustration blocks anywhere.
- **No dense component-gallery presentation:** confirmed -- `/dev/semantic-components`'s side-by-side "every variant at once" layout is explicitly not reused anywhere in this Workspace (§16).
- **No repeated amber state blocks:** confirmed by §4.2's rule that supporting context never repeats a Signal already shown in Current focus, and by amber's restriction to Signal-level wording only (not used decoratively elsewhere).
- **No pale-card-on-pale-card nesting:** confirmed by §4.4's "a Panel never contains another Panel" rule.
- **No all-caps metadata as the dominant language:** confirmed -- the one small-caps-style element (the focus-type label chip, §6) is deliberately the *smallest* text on its panel, not the dominant line.
- **Metadata smaller but still readable:** `--font-size-sm` (0.875rem) floor for all metadata text -- never `--font-size-xs` (0.75rem) used for anything a user must read to understand page state (reserved for genuinely secondary labels like a disclosure's item count).
- **Human conclusion before technical source information:** confirmed structurally throughout -- every Evidence/Provenance disclosure places the human-readable Evidence list before the technical Provenance metadata (§13), and every Current-focus/Signal presentation states its conclusion sentence before any object id.

---

## 16. Component reuse and adaptation map

| Component | Classification | Note |
|---|---|---|
| `AppShell` | `REUSE_AS_IS` | §4.1 |
| `RoleSidebar` | `REUSE_AS_IS` | already role-aware |
| `RoleIdentity` | `REUSE_AS_IS` | already built |
| `Breadcrumbs` | `REUSE_AS_IS` | already built, unused in real pages until now |
| `ContextTabs` | `REUSE_AS_IS` | exact fit for §4.3, currently unused |
| `PageHeader` | `REUSE_AS_IS` | |
| `Panel` | `REUSE_AS_IS` | used for Current focus, Assessment perspective panel |
| `ComparisonArea` | `ADAPT_BEFORE_USE` | needs a container-query-driven collapse for the Intent Workspace's long creative-intent content, replacing its current viewport-`@media` collapse (§7, corrected) -- not `REUSE_AS_IS` for this page |
| `MetadataRow` | `REUSE_AS_IS` | production-context header's Task/Version line, §4.2 |
| `SummaryCard` | `REUSE_AS_IS` | confirmed-Anchor-only state, §7 |
| `Divider` | `REUSE_AS_IS` | supporting-context separator, §6 |
| `StatusBadge` | `REUSE_WITH_NEW_COMPOSITION` | reused for the segmented perspective control's individual segments (§9) -- a new composition (three in a row, shared container), not a new component |
| `AuthorityLabel` | `REUSE_AS_IS` | `historical` variant, §7/§9 |
| `IntentSignalIndicator` | `DEV_ONLY` / deferred | designed for a global TopBar indicator, which this document now explicitly excludes from the first VFX implementation (§4.1, corrected -- no route-independent, cross-Shot Signal aggregation exists; `/vfx/signals` remains deferred); not used in the TopBar; revisit only if a global indicator is scoped in a future stage |
| `IntentSignalBanner` | `ADAPT_BEFORE_USE` | closest fit for the Alignment Workspace's step-1 Signal conclusion, but was designed as a full banner -- needs a more compact composition to sit as the *first* of seven stacked sections rather than a page-topping banner |
| `IntentSignalCard` | `DO_NOT_USE_IN_FINAL_WORKSPACE` | naming-collision risk already flagged (`13_...md` §16.2) with `ShotAnchorPage.tsx`'s own local component of the same name -- rename before any reuse; until then, do not import into the new Workspace |
| `IntentSignalDetail` | `REUSE_WITH_NEW_COMPOSITION` | fits the Alignment Workspace's fuller Signal detail, composed alongside the tension/summary sections rather than standalone |
| `AuthorityBoundary` | `REUSE_AS_IS` | Intent Workspace's compact authority line, §7 |
| `HumanDecisionNotice` | `REUSE_AS_IS` | same |
| `AgentAdvisoryNotice` | `REUSE_AS_IS` | Re-anchor Proposal's advisory framing, §9 |
| `EvidenceProvenanceDrawer` | `REUSE_AS_IS` | §13, exact fit -- code name retained as-is (this documentation-only correction renames no production component); its final presentation is truthfully an inline `<details>` disclosure, not a side drawer (§13) -- the component's existing name predates this spatial system and should not be read as implying drawer/overlay UI |
| `SourceReference` | `REUSE_AS_IS` | inside the drawer |
| `AgentRunReference` | `REUSE_AS_IS` | inside the drawer |
| `FtrackLinkageBadge` | `REUSE_AS_IS` | header's source badge, §4.2 |
| `LoadingSkeleton` | `REUSE_WITH_NEW_COMPOSITION` | per-region use (not full-page) throughout |
| `ErrorState` | `REUSE_AS_IS` | Inbox/Activity failure states |
| `EmptyState` | `REUSE_AS_IS` | Inbox/Versions empty states |
| `PermissionState` | `REUSE_AS_IS` | §8's permission-denied case |
| `Grid` | `DO_NOT_USE_IN_FINAL_WORKSPACE` | reserved for `/demo`'s role cards and `/dev` galleries -- no page in this Workspace uses a card grid (§4.4) |
| `Card` | `DO_NOT_USE_IN_FINAL_WORKSPACE` | same reasoning -- collections use list separators, not cards (§16 visual rules) |
| Confirm/Reject `ConfirmationDialog` | `NEW_COMPONENT_REQUIRED` | §8 -- no dialog/modal exists anywhere in the repository today |
| Production-context header | `NEW_COMPONENT_REQUIRED` | §4.2 -- composes `MetadataRow`/`FtrackLinkageBadge` but the compact two-line strip itself is new |
| Current-focus panel | `NEW_COMPONENT_REQUIRED` | §6 -- composes `Panel`/`StatusBadge` but the focus-type→content mapping is new, VFX-specific logic |
| Segmented perspective control | `NEW_COMPONENT_REQUIRED` | §9 -- composes `StatusBadge`-style segments but the segmented-group container/interaction is new |
| Task–Version selector | `NEW_COMPONENT_REQUIRED` | §9 -- plain selects, but the paired-validation/locked-after-choice behaviour is new |
| Legacy AlignmentAssessment controls (Generate/Accept/Reject, from the legacy `/shots` engineering workflow) | `DO_NOT_USE_IN_FINAL_WORKSPACE` | corrected per owner review -- these mutation controls must never appear anywhere under `/vfx` (§11); only their **read-only result/Decision presentation** is reused, via existing historical/disclosure primitives (`AuthorityLabel variant="historical"`, the collapsed `<details>` pattern) -- never the controls themselves |

**`/dev/semantic-components` compositions that must never be copied:** the gallery's own "all six Intent Signal levels side by side," "all four ftrack states side by side," and "all Evidence/Provenance variants stacked for comparison" layouts (`SemanticComponentsPreview.tsx`) are explicitly a component-inventory presentation, not a page design -- none of these simultaneous-everything compositions appears anywhere in §5-§12's blueprints, and Step `7C-1` through `7C-3` must not lift a gallery section wholesale into a real route.

---

## 17. Final implementation architecture (corrected: locked `7C-1`-`7C-3` route, not a six-batch sequence)

**Corrected by owner review after initial 7C-0D drafting:** the previously-introduced `7C-1A1`-`7C-1A4`/`7C-1B`-`7C-1F` sequence was not part of the approved plan. The locked, final implementation route for the VFX Workspace is **three stages -- `7C-1`, `7C-2`, `7C-3` -- each one implementation stage with one owner acceptance gate.** Internal work areas are listed in dependency order within each stage below; they are internal work, not separate numbered batches, sub-batches, commits, or roadmap stages, and must not be presented as such.

### `7C-1` — VFX foundations, Alignment Inbox, and Shot Overview

Internal work, in dependency order (files marked `(new)` do not exist yet; unmarked files are existing and preserved/extended):

1. **VFX Inbox read contracts** -- `packages/contracts/python/src/intent_core_contracts/api/vfx_inbox.py` (new): `VfxInboxRead`, `VfxInboxItemRead`, `VfxInboxCurrentFocusRead` (`14_...md` §6.2).
2. **`GET /vfx/inbox` read-model service and router** -- `apps/api/src/intent_core_api/vfx_inbox/` (new: `router.py`, `service.py`); registration in `main.py` (existing, one new router include). Reads `intent/`, `versions_and_feedback/`, `production_context/` -- no changes to those modules.
3. **Python Current-focus derivation and tests** -- the six-focus-type precedence logic (`14_...md`/`15_...md` §6), Task/Version resolution-rule tests (`14_...md` §6.4), and the shared fixture-scenario table (`15_...md` §6.8, resolving that document's risk #4) created here as the one file both the Python and TypeScript derivations test against.
4. **Complete idempotent D1 Demo seed and resolver** -- a seed entry point (module name confirmed at build time), implementing §2 and §3.4's full record-by-record idempotency design (Project/Shot/Task/Version/IntentBrief/baseline Core Anchor+revision+HumanGate+Decision/baseline Execution Anchor+revision(+HumanGate+Decision, verified)/seeded VFX+CG+Artist outputs/seeded CrossRoleAssessment+Signal+Proposal/ContextSnapshot+AgentRun/ReviewNotes), plus the owner-approved `ExternalSource = Literal["ftrack", "demo"]` contract change (§2.6, §6 -- schema verified before changing, per that section). Includes the seven tests named in §3.4's closing list.
5. **Server-side resolved identity and trusted Actor-header adapter** -- `apps/web/src/features/session/identity.ts`, `demoScenario.ts`, `actorAdapter.ts` (new, per `14_...md` §7/§12.1), reading from (not modifying) `apps/web/src/lib/demoIdentity.ts`/`app/demo/actions.ts`/`middleware.ts`.
6. **Frontend server-only clients and VFX view models** -- data-loader functions for `GET /vfx/inbox` and the granular Shot/Anchor/Assessment endpoints (new, `features/vfx/*/data.ts`-style); extends `apps/web/src/lib/api.ts` additively with any missing thin wrappers (`13_...md` §2).
7. **TypeScript Current-focus derivation parity tests** -- `apps/web/src/lib/currentFocus.ts` (new), tested against the *same* fixture-scenario table created in step 3.
8. **`/vfx` Alignment Inbox** -- `apps/web/src/app/vfx/page.tsx` (replaces the current placeholder `VfxWorkspacePage.tsx`), `features/vfx/inbox/` (new), per §5's blueprint.
9. **`/vfx/shots/:shotId` Shot Overview** -- `apps/web/src/app/vfx/shots/[shotId]/page.tsx` (new), `features/vfx/shot-overview/` (new) including the new Current-focus panel and production-context header components (§16), per §6's blueprint.
10. **Guided `/demo` deep-link to the real D1 Shot** -- `app/demo/actions.ts` extended (additive, not a rewrite) to call step 4/5's resolver, per `15_...md` §7.1/§8.3.

**Tests:** component tests for the Inbox blueprint (empty/single/multi-row) and Shot Overview across all 6 focus types, plus every test named in steps 3 and 4 above.
**Browser acceptance:** §19's `/vfx` and Shot Overview checklists.
**Stage accepted only when the real Inbox, real Shot Overview, identity flow, and stable Demo entry work together in the browser** -- i.e. `/demo` → guided entry → resolved real Shot → Shot Overview with a real Current focus, and standalone `/vfx` → real (or honestly empty) Inbox → Shot Overview, both observable end-to-end.
**Non-goals:** Intent/Alignment/Versions/Activity tab destinations may still placeholder until `7C-2`/`7C-3` land.

### `7C-2` — VFX Intent Workspace

- **Files:** `apps/web/src/app/vfx/shots/[shotId]/intent/page.tsx` (new), `features/vfx/intent-workspace/` (new) including the new `ConfirmationDialog` component (§8 -- likely placed in `design/components/` as a generic, reusable primitive, not VFX-specific) and the container-query-adapted `ComparisonArea` usage (§7, corrected).
- **Scope:** confirmed-vs-proposed Core Anchor comparison; draft editing; HumanGate; Confirm and Reject; server-resolved authority; explicit confirmation dialog; Evidence and advisory-input (Decomposition/Reconstruction) disclosures on demand; Activity linkage (a plain link, since Activity itself is `7C-3` scope).
- **Tests:** §7/§8 blueprint states, Confirm/Reject success/conflict/permission tests per `15_...md` §16.
- **Browser acceptance:** §19's Intent checklist -- full browser acceptance of the human-authority flow.
- **Non-goals:** no Execution Anchor management (never in VFX scope, owned by the future `7C-4`).

### `7C-3` — VFX Alignment, Versions, Activity, and VFX close-out

- **Files:** `apps/web/src/app/vfx/shots/[shotId]/alignment/page.tsx`, `.../versions/page.tsx`, `.../versions/[versionId]/page.tsx`, `.../activity/page.tsx` (all new), `features/vfx/alignment-workspace/`, `features/vfx/version-workspace/`, `features/vfx/activity/` (all new) -- including the segmented-perspective control and Task-Version selector (§16).
- **Scope:** CrossRoleAssessment, Intent Signal, tensions, segmented VFX/CG/Artist perspectives, Re-anchor Proposal, Evidence and Assessment history (§9); Versions collection and Version Workspace, ReviewNotes, VFX Supervisor Agent review, legacy AlignmentAssessment **read-only** compatibility history (§10-§11, corrected); Activity (§12); partial/error/empty states across all Tier-1 pages (`14_...md` §14); accessibility (dialog focus order, segmented-control keyboard operation); VFX visual and interaction consistency; full D1 VFX walkthrough (§19) and browser acceptance performed live, both seeded-only and with optional live regeneration.
- **Tests:** §9-§12 blueprint states including the selector's zero/one/multi-Task-Version cases, compatibility-disclosure-collapsed-by-default and read-only-verified tests, full `14_...md` §14 state-model coverage per Tier-1 page.
- **Browser acceptance:** §19's Alignment/Versions/Version/Activity checklists plus the full D1 storyboard (§18).
- **Non-goals:** no `Apply` action, ever; no Artist Agent surface; no legacy AlignmentAssessment mutation of any kind; no CG or Artist implementation.

### Later stages -- named only, not designed here

- **`7C-4` — CG Supervisor Workspace.** One later stage. Not designed or implemented in this correction task.
- **`7C-5` — Artist Workspace.** One later stage. Not designed or implemented in this correction task.
- **`7D` — Cross-role finalisation.** Connects VFX, CG, and Artist into the guided cross-role Demo; final visual and interaction consistency; final browser acceptance. Not redesigned in this correction task.

No stage above is split, merged, renamed, expanded, or added to relative to the locked route in this section's own heading.

---

## 18. D1 storyboard

Each step: route, visible region, attention target, user action, persisted object, transition type, what stays hidden, what a tutor/employer should understand.

| # | Route | Visible region | Attention target | User action | Persisted object | Transition | Stays hidden | Understanding |
|---|---|---|---|---|---|---|---|---|
| 1 | `/demo` | Primary CTA | "Start guided demonstration" | Click | none yet | full navigation (new page) | technical seed mechanics | This is a guided tour of one real scenario, not a marketing page |
| 2 | `/vfx/shots/:shotId` | Header + Current focus panel | Focus title: "Cross-role assessment may need your interpretation" (§3.3) | Read | (seeded, §3) real Shot/Anchor/Assessment | full navigation from step 1's redirect | Next-in-this-Shot (0-2, likely empty here), supporting context | The system already did real synthesis work and is pointing at exactly one thing to look at |
| 3 | (same) | Current focus panel | the primary action button | Click "Review alignment →" | none | route change | -- | The one recommended next step is one click away, not buried |
| 4 | `/vfx/shots/:shotId/alignment` | Signal + tension (steps 1-2 of §9) | the Signal sentence and top tension | Read | seeded `IntentSignalRead`, `CrossRoleAssessmentRead` | full navigation | full perspective/Proposal/Evidence content (below, not yet scrolled to) | The Signal is a *conclusion*, derived from real recorded disagreement, not a generic alert |
| 5 | (same) | segmented control | clicking CG, then Artist | Click, click | none (read-only) | local (no route change) | the other two perspectives' content, one at a time | Each role's own recorded position is a first-class, inspectable fact, not folded into one summary |
| 6 | (same) | Re-anchor Proposal section | the Proposal's reasoning | Read (and optionally expand `Proposed fields`) | seeded `ReAnchorProposalRead` | local disclosure toggle | -- | Even a strong AI suggestion stays advisory -- there is no button to accept it here |
| 7 | (same) | bottom action | "Open Intent Workspace →" | Click | none | route change | -- | Acting on the insight requires deliberately moving into the authority workspace -- it doesn't happen automatically |
| 8 | `/vfx/shots/:shotId/intent` | comparison area | current confirmed vs. a newly-created draft | Create + edit draft (real form interaction) | **new, live** `CoreAnchorRevisionRead(status=draft)` + `HumanGateRead(status=pending)` | local (same page, form state) | historical revisions (linked, not shown) | The human is now the one authoring the change, informed by what they just read |
| 9 | (same) | Confirm dialog (§8) | the echoed rationale | Click Confirm inside the dialog | pending → about to become `DecisionRead` | modal, focus-trapped | -- | The system pauses for one explicit, unambiguous human commitment before anything becomes authoritative |
| 10 | (same) | success outcome | the new confirmed state | (automatic, post-mutation) | `DecisionRead(confirm_core_anchor)`, revision confirmed | local (region re-render, no navigation) | previous confirmed revision (now historical, linked) | The decision is now real, timestamped, and attributed -- and the interface says so plainly |
| 11 | `/vfx/shots/:shotId` | Current focus panel | the re-derived focus (now type 6.5 or 6.6, since a newer Anchor action follows the seeded Assessment) | Click "Overview" tab | none (read) | route change | -- | The system's own "what needs attention" understanding updated itself from the decision just made -- no one had to manually clear anything |
| 12 | `/vfx/shots/:shotId/activity` | chronological list | both Core Anchor revisions, both Decisions, the Assessment, the Signal | Read | (composed, not new) | route change | nothing -- Activity is explicitly the full-disclosure page | The complete, ordered, honestly-labelled history of exactly what happened is one click away at any time |

**Uses only the locked stable seeded records (§3) through step 7; step 8 onward is live** (the draft/HumanGate/Decision creation), exactly matching `15_...md` §15's walkthrough intent, now spatially and sequentially precise.

---

## 19. Low-fidelity browser acceptance checklist

For every Tier-1 page:

### `/vfx`

- **First thing visible:** page heading + scope line.
- **Primary action:** none page-level (each row's own `Open`).
- **Max simultaneous strong regions:** 1 (the row list itself; no competing panel).
- **Collapsed by default:** nothing (a list is not a disclosure).
- **Forbidden patterns:** card grid, summary metric tiles, notification tray/bell.
- **Narrow-width check:** rows stack fields vertically, `Open` remains reachable.
- **Keyboard check:** each row is a single focusable link; Tab order matches visual top-to-bottom order.
- **Loading/empty/error check:** `LoadingSkeleton` per row region while fetching; `EmptyState` at zero rows; `ErrorState` with retry on fetch failure.

### Shot Overview

- **First thing visible:** production-context header.
- **Primary action:** Current focus's one button (or none, for type `none`).
- **Max simultaneous strong regions:** 2 (header counts as orientation, not "strong"; Current focus is the one strong region; Next-in-this-Shot is deliberately subordinate, not counted as a second strong region).
- **Collapsed by default:** n/a (no disclosures on this page).
- **Forbidden patterns:** card grid for Next-in-this-Shot, a second Signal mention duplicating Current focus.
- **Narrow-width check:** Current focus button becomes full-width; supporting context stacks.
- **Keyboard check:** tab order is header (skippable) → tabs → Current focus button → Next-in-this-Shot links → supporting context (no interactive elements there).
- **Loading/empty/error check:** region-scoped skeletons; `none` focus type is the honest "empty" case for this page (not a separate `EmptyState`); `ErrorState` on fetch failure.

### Intent Workspace

- **First thing visible:** compact authority line, then the comparison.
- **Primary action:** Confirm (Reject secondary, same row).
- **Max simultaneous strong regions:** 2 (the comparison columns count as one region together, not two).
- **Collapsed by default:** Evidence, Decomposition/Reconstruction (both disclosures).
- **Forbidden patterns:** decomposition/reconstruction output above the comparison, a red/amber full-page treatment for Reject.
- **Narrow-width check:** comparison stacks current-then-proposed; buttons stack Confirm-above-Reject.
- **Keyboard check:** dialog traps focus; Escape cancels; success returns focus to the page heading.
- **Loading/empty/error check:** confirmed-only state when no draft; inline field-level validation errors; conflict state replaces dialog content, not a silent failure.

### Alignment Workspace

- **First thing visible:** Signal conclusion.
- **Primary action:** Generate (when available) or Open Intent Workspace (when an Assessment already exists) -- never both framed as equally primary at once.
- **Max simultaneous strong regions:** 2 (Signal+tension count together as the "why," the active perspective panel is the other).
- **Collapsed by default:** Evidence, previous Assessments, per-perspective evidence.
- **Forbidden patterns:** all three perspectives shown at once, an Apply button anywhere, index-zero Task/Version pre-selection.
- **Narrow-width check:** segmented control's three labels remain one row.
- **Keyboard check:** segmented control operable via arrow keys or Tab+Enter between segments (implementation detail for the building batch to confirm against whichever pattern -- either is acceptable, but *some* keyboard path must exist).
- **Loading/empty/error check:** prerequisite checklist when unmet; failure notice above the still-visible previous Assessment; selector validation errors.

### Versions collection

- **First thing visible:** page heading + row list.
- **Primary action:** none page-level (`Open` per row).
- **Max simultaneous strong regions:** 1.
- **Collapsed by default:** n/a.
- **Forbidden patterns:** thumbnails, invented review-status badges.
- **Narrow-width check:** rows stack.
- **Keyboard check:** row links in visual order.
- **Loading/empty/error check:** `EmptyState`/`ErrorState` as elsewhere.

### Version Workspace

- **First thing visible:** Version identity + description.
- **Primary action:** Generate VFX review (when appropriate) -- otherwise no forced primary action.
- **Max simultaneous strong regions:** 2 (ReviewNotes+Anchor summary count as orientation, VFX review section is the one strong region).
- **Collapsed by default:** Evidence, legacy AlignmentAssessment history, prior reviews beyond the latest.
- **Forbidden patterns:** legacy Accept/Reject styled as primary, an Artist-guidance action control.
- **Narrow-width check:** Generate button drops below its heading.
- **Keyboard check:** normal top-to-bottom tab order, disclosures keyboard-toggleable (native `<details>` already is).
- **Loading/empty/error check:** failure notice above unaffected prior content; text-evidence-only notice always present regardless of state.

### Activity

- **First thing visible:** date-grouped list.
- **Primary action:** none (inspection only).
- **Max simultaneous strong regions:** 1 (the list itself).
- **Collapsed by default:** n/a (no disclosures needed at this scale).
- **Forbidden patterns:** unread dots, chat bubbles, filter/search chrome.
- **Narrow-width check:** list remains readable, `[View →]` stays inline.
- **Keyboard check:** `[View →]` links in visual order.
- **Loading/empty/error check:** per-source partial-failure row inline; full-page `EmptyState` only if truly nothing has ever happened on the Shot.

**These criteria are written so the owner can reject a technically-correct page on hierarchy/density grounds alone** -- e.g. "three strong regions visible at once" or "a card grid used for the Inbox" are both concrete, checkable rejections independent of whether the underlying data/mutations work correctly.

---

## 20. Targeted clarifications applied to documents 14 and 15

**Document 15** (`15_STEP_7C0C_...md`): §4.3's "locked default (no migration): name-based idempotency" is superseded -- see §2.6 above for the exact pointer added in place. No other part of document 15 is reopened.

**Document 14** (`14_STEP_7C0B_...md`): a pointer added to its header noting this document (16) supplies the spatial blueprints and final implementation brief its own §12/§15 sketched only architecturally; no locked decision in document 14 is altered.

Both edits are applied as headers/pointers plus one targeted paragraph each -- neither document is rewritten.

---

## 21. Explicit non-goals

- No production UI, components, routes, backend code, API contracts, migrations, or Agent behaviour changed by this document.
- No pixel-perfect visual styling, colour, iconography, illustration, shadow, or animation decisions -- structural/spatial only.
- No Step `7C-1` (or any later stage) implementation started.
- No reopening of any locked IA or interaction decision from documents 03-06, 10, 13-15.
- No CG or Artist workspace blueprints (VFX-only, per the entire 7C series' scope).
- No mobile-phone-specific optimisation beyond "does not break" (explicit, per the task).

---

## 22. Remaining implementation risks

1. **Resolved by owner review, no longer a risk:** the `ExternalSource` Literal extension (§2.3, §2.6, §6) is now explicitly approved -- Step `7C-1` still needs to verify the actual schema before making the change (§2.6), but the approval itself is no longer open.
2. **The deterministic generator's actual output for the seeded D1 inputs (§3.2) is unverified** -- whether it naturally produces `medium`/`high` attention and a Re-anchor Proposal must be checked once the generator exists in this exact configuration; the seed's input content may need tuning.
3. **A new `--breakpoint-wide: 1280px` token (§14) is recommended but not added** -- a small, low-risk CSS-only addition, deferred to whichever stage first needs it.
4. **The shared Python/TypeScript fixture-scenario table (§17, step 3 of `7C-1`'s internal work) has a concrete home now but its exact file format (JSON vs. markdown table) is still an implementation-time choice**, not decided here.
5. **The segmented perspective control's exact keyboard interaction pattern (§19) is named but not fully specified** -- arrow-key vs. Tab-based operation is left to Step `7C-3`.
6. **The Intent Workspace comparison-container collapse threshold (§7, corrected) is a recommended ~62-68rem, explicitly flagged as needing visual verification during implementation** -- not a risk in the sense of being undecided, but a value this planning document cannot finalize without a real browser and real content.
7. **No component for a right-side drawer or a generic combobox was designed**, since none was needed for this scope -- if a future stage (`7C-4`/`7C-5`, or a later VFX addition) needs either, neither exists yet and both would be new work at that time.

---

## 23. Exact readiness criteria for beginning `7C-1`

**Corrected by owner review after initial 7C-0D drafting.** Step `7C-1` may begin only when:

1. The corrected 7C-0A-0D documents (13, 14, 15, and this document, 16) are committed.
2. The final implementation route is recorded as `7C-1` through `7C-5`, then `7D` (§17, this document, and `14_...md` §15) -- not the retired `7C-1A`-`7C-1F` sequence.
3. The `ExternalSource "demo"` change is approved -- **it now is** (§2.6, §6).
4. Complete scenario-level seed idempotency (§3.4, covering every supporting record, not only Project/Shot/Task/Version) is part of `7C-1`'s own scope.
5. No unresolved planning contradiction remains between documents 14, 15, and this document (16) -- verified by this correction task's own review.

No other precondition is imposed, and no further planning stage is added beyond this one. The owner has reviewed and accepted this document's spatial blueprints (§5-§13) and the final implementation brief (§17); the implementing engineer(s) should read documents 14, 15, and this document (16) in that order -- no prior Step 7C document needs to be re-litigated; this document is the last planning step before code.

---

## Validation

- `git diff --check`: run, see final report.
- No frontend or backend tests run -- no production code changed by this task.
