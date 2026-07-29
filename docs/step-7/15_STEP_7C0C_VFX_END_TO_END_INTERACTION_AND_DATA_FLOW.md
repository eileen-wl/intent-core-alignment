# ICAS Step 7C-0C — VFX End-to-End Interaction Contracts, State Transitions, and Real Data Flow Mapping

**Status:** Locked (for the contracts this document makes explicit below). Planning and interaction-contract task only -- no production UI, routes, backend, contracts, migrations, or Agent behaviour are changed by this document.
**Preserves without reopening:** the locked route family, Tier 1/supporting classification, Inbox → Shot Overview → dedicated workspaces, the one-Current-focus/at-most-two-Next-in-this-Shot model, CrossRoleAssessment as the formal Alignment mechanism, legacy AlignmentAssessment as compatibility history, server-resolved identity, Evidence-on-demand, ftrack-as-secondary, and the no-card-grid/no-notification/no-enterprise-queue rules -- all from `14_STEP_7C0B_...md`.
**Clarified by `16_STEP_7C0D_VFX_LOW_FIDELITY_BLUEPRINTS_AND_FINAL_IMPLEMENTATION_BRIEF.md`:** §4.3's "locked default (no migration): name-based idempotency" is superseded -- see the note at that exact location below, and document 16 §2-§3.4 for the complete scenario-level (not just Project/Shot/Task/Version) seed-idempotency design. Document 16 also supplies the spatial blueprints and the final implementation brief this document's contracts feed into. **Corrected by owner review after 7C-0D:** every reference to the retired `7C-1A`-`7C-1F` batch sequence (§15's closing line, §17's risk #2) now targets the locked `7C-1` through `7C-3` VFX route instead, and §11's legacy AlignmentAssessment treatment is corrected to fully read-only (no Generate/Accept/Reject exposure) in the new Workspace. §18's "Handoff to Step 7C-0D" section itself is historical and unchanged -- it correctly describes the already-completed planning handoff from this document to document 16. No other part of this document is reopened.
**Depends on:** `04_STEP_7A3_CORE_WORKFLOWS_INTERACTIONS.md`, `06_STEP_7_LOCKED_SOURCE_OF_TRUTH.md`, `10_FTRACK_ENTRY_AND_IA_AMENDMENT.md`, `13_STEP_7C0A_...md`, `14_STEP_7C0B_...md`

---

## 1. Executive interaction conclusion

Document 14 locked *what* the VFX Workspace is (routes, tiering, Shot Overview model, AlignmentAssessment decision, Inbox specification, identity architecture, Demo resolver direction). This document locks *how it behaves*, precisely enough to build from: every predicate a "Current focus" state can depend on, every mutation's exact request/response/refresh contract, every route's context-validation rule, and a resolved decision on the one open question document 14 left open (the Demo data mechanism). Nothing here reopens document 14's structural decisions; this document specifies the runtime behaviour inside that already-locked structure.

Three findings drove the most consequential decisions below:

1. **No domain object anywhere records "addressed," "unresolved," "handled," or "acknowledged."** Document 14's Current-focus wording risked implying such a status exists. §2 replaces it with an honestly-named derived condition, and a corresponding clarification is applied to document 14 in-place.
2. **`CoreAnchorRevision.status != "draft"` is the actual, code-enforced conflict condition** for both Confirm and Reject (`core_anchor_service.py:461-462,621-622`) -- this fixes the exact wording of every stale/conflict state in §13 and §14 below to match what the backend really returns (`ConflictError` → 409), not a guessed generic message.
3. **The Demo data mechanism is now resolved**, not left open: an idempotent server-side seed, following the repository's own existing idempotent-upsert pattern (`production_context/router.py`'s `find_linked_entity_id`/external-id upsert), not a request-time name-lookup. §4 specifies it exactly.

---

## 2. Truthfulness corrections (non-persisted "addressed" semantics)

### 2.1 The rule

The repository has **no persisted** Assessment-handled state, Proposal-acknowledged state, Signal-read/unread state, or coordination-completed state. Confirmed by inspection: `CrossRoleAssessment`, `IntentSignal`, and `ReAnchorProposal` (`versions_and_feedback/models.py`, `packages/contracts/python/.../cross_role_assessment.py`) are immutable, append-only rows with no status/state column of any kind -- only `created_at`. There is no `handled_at`, `acknowledged_at`, `read_at`, or `resolved` field anywhere on any of the three.

**Therefore:** the Workspace must never describe an Assessment, Signal, or Re-anchor Proposal as *unresolved*, *unread*, *unhandled*, *awaiting acknowledgement*, *dismissed*, or *completed* -- none of those words name a real field, and using them implies a workflow-status system that does not exist (exactly the notification-lifecycle pattern `06_...md` §15 and `10_...md` §9 already forbid).

### 2.2 The honest derived condition

Current-focus derivation (§7 below, replacing document 14 §4.2's wording) may use one real, checkable, **objective** condition instead:

> **No newer Core Anchor revision or HumanGate action has followed the latest CrossRoleAssessment.**

This is derivable purely from timestamps already on real rows (`CrossRoleAssessmentRead.created_at` vs. the Shot's `CoreAnchorRevisionRead.created_at`/any `HumanGateRead.resolved_at` created after it) -- it asserts nothing about human intent, attention, or workflow state; it only states a timestamp-ordering fact.

**Locked name and wording:**

- **Predicate name:** `alignment_not_followed_by_anchor_action`
- **User-facing wording:** "No newer Core Anchor action has followed this assessment."

This condition is **never** presented as a persisted workflow status (no badge reading "Unresolved," no icon implying a tracked state) -- it is presented exactly as what it is: a timestamp comparison, phrased as a fact about ordering, not a claim about whether a human has "handled" anything.

### 2.3 Document 14 wording correction (applied in place, §21 below)

Document 14 §4.2 focus type 3 was worded "a Cross-role Assessment exists whose Intent Signal has not yet led to a Core Anchor action." This is corrected in document 14 itself to use the exact predicate name and wording from §2.2 above -- **the precedence order itself is unchanged** (still rank 3 of 6), only the wording is corrected to avoid implying a persisted "unresolved" flag.

---

## 3. Task–Version selection contract

Grounded in the confirmed schema fact: `Version.shot_id` exists; **`Version.task_id` does not exist anywhere in the schema** (`versions_and_feedback/models.py`), and `Task.shot_id` is the only Task-side FK (`production_context/models.py`). There is no join table and no other mechanism connecting a specific Task to a specific Version. `CrossRoleAssessmentGenerateRequest` confirms the real generation contract: `POST /versions/{version_id}/cross-role-assessments/generate` with body `{task_id: UUID}` -- the pairing is asserted per-call, by the caller, never stored as a general relationship.

### 3.1 Display rule (locked)

When no existing `CrossRoleAssessmentRead` establishes a pairing for the Shot:

- the latest Task and latest Version (by `created_at`, descending) **may** be displayed as separate facts;
- they must **never** be visually joined as an established pair (no shared card, no "Task · Version" combined label, no implied line connecting them);
- labels make the independence explicit, e.g. two separate metadata rows: `Latest Task: Compositing Review` / `Latest Version: D1_STEP3_VFX_REVIEW_001` -- never `Compositing Review — D1_STEP3_VFX_REVIEW_001` styled as one object.

This applies everywhere Task/Version identity is shown without an Assessment backing the pairing: Shot Overview header (`14_...md` §4.1), Inbox rows (`14_...md` §6.2).

### 3.2 Cross-role Assessment generation rule (locked)

**When an existing Assessment exists** for the Shot: its persisted `task_id` and `version_id` (both real columns on `CrossRoleAssessmentRead`) define the current explicit pairing -- shown as an established pair, since it now has real evidence behind it (the Assessment row itself).

**When no existing Assessment defines a pairing**, generation requires an explicit human choice:

1. The Human VFX Supervisor must explicitly choose one Task and one Version before generation -- **no automatic `first`/`latest`/index-zero pairing is permitted** for this specific mutation (contrast with §3.1's display-only "latest" convention, which is explicitly *not* reused here).
2. The UI states plainly that this pairing is being selected *for this Assessment* -- e.g. "Choose the Task and Version this assessment will evaluate," not phrased as if it were a lasting association.
3. Both selected objects must belong to the current Shot (`Task.shot_id == shot.id`, `Version.shot_id == shot.id`).
4. **The server-side mutation adapter (§13) validates both objects against the Shot before forwarding the generation request** -- an independent check in the Server Action/route handler, not trusted from client state, even though the backend's own `generate_cross_role_assessment` service also enforces its own prerequisite chain (confirmed Anchors, latest reviews) independently.
5. The selection is **not persisted** as a general Task-Version relationship anywhere -- no new table, no new FK, matching the task's explicit instruction not to introduce a migration for this.
6. **The generated `CrossRoleAssessmentRead` itself becomes the persisted evidence of the selected pairing** -- from that point forward, §3.1's "no existing Assessment" branch no longer applies for this Shot (until a *different* pairing is chosen for a future Assessment, which is equally valid and equally not a contradiction -- Assessments are independent, immutable rows, not a single evolving "the" pairing).

### 3.3 Selector specification

| Element | Behaviour |
|---|---|
| **Entry point** | A `Choose Task and Version` control shown only when Alignment Workspace's generation prerequisites are otherwise checkable but no Assessment yet defines a pairing (i.e., replaces a bare "Generate" button in that specific case). |
| **Default state** | Both selectors unselected -- **not** pre-filled with "latest," per §3.2 rule 1. Generate is disabled until both are chosen. |
| **Validation errors** | Client-side: "Choose a Task" / "Choose a Version" if Generate is attempted with either empty (defensive; the button is disabled, so this is a belt-and-suspenders message, not the primary guard). Server-side (§13's adapter): 409/422-equivalent structured error if either id does not belong to the Shot -- surfaced as "That Task/Version is not part of this Shot," never a generic failure. |
| **Zero-Task state** | "This Shot has no Tasks recorded yet" -- Generate remains unavailable; this is a missing-prerequisite state (§7), not a selector bug. |
| **Zero-Version state** | "This Shot has no Versions recorded yet" -- same treatment. |
| **One-Task/one-Version streamlined state** | Both selectors show their single option pre-highlighted (not silently auto-submitted) -- the human still confirms by proceeding to Generate; this avoids a second silent "index-zero" pathway for the common Demo-scale case while keeping the interaction fast. |
| **Multiple-Task/multiple-Version state** | Two plain selects (or an equivalent restrained control) listing all real Tasks/Versions for the Shot by name, most-recent first -- no search/filter chrome needed at portfolio scale. |
| **Visible during generation** | The chosen Task/Version identity remains visible and locked (non-editable) once generation starts, alongside the running-state indicator (`04_...md` §3.4's generation panel pattern) -- the human sees exactly what was submitted. |
| **Refresh after success** | The new `CrossRoleAssessmentRead` becomes "latest" in the Alignment Workspace; the selector is replaced by the now-established pairing display (§3.2 rule 6); Shot Overview's Current focus re-derives (§7). |

---

## 4. Demo seed/resolver decision (resolves document 14's open question)

### 4.1 Locked mechanism

**An idempotent server-side seed/bootstrap for the D1 Demo scenario**, not a request-time name-lookup. This creates real persisted `Project`, `Shot`, `Task`, `Version`, and the supporting Intent/Anchor/Assessment/Signal/Proposal chain the approved D1 walkthrough (§16) requires -- through the **same domain tables and the same service functions** normal product flows use (`core_anchor_service.create_draft_revision`/`confirm_revision`, `cross_role_assessment_service.generate_cross_role_assessment`, etc.), never a parallel mock model.

### 4.2 Why idempotent-seed over request-time resolver

Document 14 §8.2 left two alternatives open. Repository inspection resolves this: the codebase already has exactly one established idempotent-creation pattern -- `production_context/router.py`'s idempotent-by-external-id Shot/Task creation (`find_linked_entity_id`/`record_external_link`), used for ftrack sync. A seed script that follows this same shape (upsert-by-stable-key, safe to re-run) is smaller, more consistent with existing conventions, and strictly more robust than a request-time resolver: a resolver would have to run its own lookup-or-create logic on every guided-demo entry anyway (since the data must exist *somehow*), which is just a seed invoked lazily and repeatedly instead of once, deliberately, and observably.

### 4.3 Stable key convention

A single well-known Demo key, e.g. `demo_key = "d1_demo_project"` on the `Project` row -- **not a new database column** (no migration, per the task's explicit constraint). Because `Project.name` is already a plain, human-set string with no uniqueness constraint enforced today, the seed instead reuses the existing idempotent-external-id pattern structurally: it records its own seed identity via the same `ExternalEntityLink` mechanism already used for ftrack, but with `source` extended conceptually to a `"demo"` provenance marker at the seed-script level (implementation detail for the building batch to confirm against `ExternalSource`'s current `Literal["ftrack"]` -- if extending that literal is judged out of scope for a no-migration constraint, the fallback is a seed-owned lookup-by-exact-name convention: `Project.name == "D1 Demo Project"`, `Shot.name == "Shot 010 — Final confrontation"` under that Project, etc., which requires no schema change at all and is the recommended default given the explicit no-migration instruction).

**Superseded by `16_STEP_7C0D_...md` §2:** name-based idempotency (querying for a `Project` named exactly `"D1 Demo Project"`) was identified as unsafe -- a manually-created production Project happening to share that name would be silently adopted. Document 16 §2.3 locks the actual convention instead: a compound deterministic key via the existing `ExternalEntityLink` mechanism for Project/Shot/Task (using one small, explicit `ExternalSource` literal addition, `"demo"` -- now owner-approved, §2.6/§6 of document 16), and a stable description-marker prefix for Version (which has no `ExternalEntityLink` support). Read `16_...md` §2-§3.4 for the full resolution algorithm, duplicate/partial-seed recovery, inconsistent-context handling, and the complete scenario-level idempotency design covering every supporting record -- this section's original name-based approach is not used.

### 4.4 One server-side Demo scenario resolver

```text
apps/web/src/lib/session/demoScenario.ts (proposed, not created)
resolveD1DemoShotId(): Promise<string>  -- server-only, per 14_...md §8.2
```

Calls a single new backend seed-or-resolve entry point (naming to confirm at build time -- e.g. `POST /internal/demo/seed-d1` mirroring the existing `POST /internal/reconcile-ftrack-shots`/`ping` pattern in `ops/router.py`, or a plain idempotent `GET`/`POST` under a new `demo` module) that performs §4.3's find-or-create and returns the resolved Shot id. Exactly one call site on the frontend; **no raw mutable UUID is duplicated across Client Components** -- the resolver's return value is consumed only by the server-side redirect target (§8.1), never passed as a prop.

### 4.5 Safe repeatability (locked requirements)

- **Reuses existing records when the stable key already exists** -- re-running the seed against a database that already has "D1 Demo Project" is a no-op at the Project/Shot/Task/Version level (found, not recreated).
- **Does not create duplicates** -- enforced by the name-based find-before-create check in §4.3, run inside one transaction per entity to avoid a race duplicating rows under concurrent first-run requests (mirroring the existing `IntegrityError`-catch-and-refetch pattern already used by `core_anchor_service.get_or_create_core_anchor`).
- **Does not overwrite user-created production records** -- the seed only ever creates rows named exactly with the D1 literals; it never mutates a differently-named Project/Shot, and never re-writes an already-existing D1 row's content once created (idempotent means "ensure it exists," not "reset it to a canonical state" -- a human who has since confirmed a real Core Anchor on the seeded Shot keeps that confirmation).
- **Explicit about seeded vs. Agent-superseding records:** the seed creates the *starting* state only -- an unconfirmed Intent Brief/Decomposition/draft Core Anchor sufficient to reach the D1 walkthrough's first real decision point (§16). It does **not** pre-create a confirmed Core Anchor, a CrossRoleAssessment, or an IntentSignal -- those are produced live during the walkthrough (§16 marks exactly which steps are seeded vs. live-generated).

### 4.6 Locked guided-entry flow

```text
/demo
→ "Start guided demonstration"
→ enterDemoRole("vfx_supervisor")          [existing Server Action, sets session cookie]
→ resolveD1DemoShotId()                     [new, §4.4 -- seeds if absent, resolves if present]
→ redirect to /vfx/shots/:shotId
```

### 4.7 Failure behaviour

If the API or database is unavailable during `resolveD1DemoShotId()`: the Server Action does not redirect at all -- it returns to `/demo` with an inline, honest failure message ("The guided demonstration couldn't start -- the ICAS service is unavailable. Try again in a moment.") rather than redirecting into a broken `/vfx/shots/:shotId` with no data. This reuses the same `ErrorState`/`describeError()` failure-message convention already used elsewhere (`13_...md` §13), applied at the point of the Server Action rather than client-side, since the failure happens server-side before any redirect occurs.

---

## 5. Route-context contracts

| Route | Required params | Server-side validation | Breadcrumb context | Contextual-tab links | Task/Version status | Version-not-in-Shot | Task-not-in-Shot | Object exists, no authority | Not-found/redirect |
|---|---|---|---|---|---|---|---|---|---|
| `/vfx` | none | resolved identity only (§13) | `Alignment Inbox` | n/a (entry page) | n/a | n/a | n/a | n/a (Inbox itself has no per-object authority check) | n/a |
| `/vfx/shots/:shotId` | `shotId` | `Shot` exists (404 if not); no role check beyond route-level VFX lock (middleware) | `Alignment Inbox / {Project} / {Shot}` | Overview / Intent / Versions / Alignment / Activity (all sub-routes of this `shotId`) | Independently displayed per §3.1 (no Assessment) or as the established pairing (Assessment exists, §3.2) | n/a (no Version param here) | n/a | n/a (Overview is read-only for all VFX) | 404 page (`NotFoundError` → `ErrorState`/`EmptyState`-family, not a generic 404) if `shotId` doesn't resolve |
| `/vfx/shots/:shotId/intent` | `shotId` | `Shot` exists; Core Anchor for the Shot may be absent (valid "no confirmed Anchor yet" state, not an error) | `.../ {Shot} / Intent` | same 5 tabs, `Intent` active | n/a (Core Anchor is Shot-scoped, no Task/Version) | n/a | n/a | Confirm/Reject controls hidden behind `require_can_confirm_or_reject` server-side (§13); page still renders read-only for a non-VFX identity reaching it directly (shouldn't occur given route-level lock, but defence-in-depth) | 404 if `shotId` doesn't resolve |
| `/vfx/shots/:shotId/alignment` | `shotId` | `Shot` exists; Task/Version selection validated per §3.2 rule 4 only at generation time, not at page load | `.../ {Shot} / Alignment` | same 5 tabs, `Alignment` active | Selector (§3.3) if no Assessment yet; established pairing display if one exists | n/a at page load (validated at generation, §3.2) | n/a at page load | Generate control hidden for non-VFX (route-level lock covers this in practice) | 404 if `shotId` doesn't resolve |
| `/vfx/shots/:shotId/versions` | `shotId` | `Shot` exists | `.../ {Shot} / Versions` | same 5 tabs, `Versions` active | Lists all Versions for the Shot (no Task filter -- none is possible, §3) | n/a (collection page) | n/a | n/a (read-only list) | 404 if `shotId` doesn't resolve |
| `/vfx/shots/:shotId/versions/:versionId` | `shotId`, `versionId` | `Shot` exists; `Version` exists **and** `Version.shot_id == shotId` | `.../ {Shot} / Versions / {Version name}` | same 5 tabs, `Versions` active (detail is a child of the collection, not its own tab) | Version is explicit from the URL; Task is not resolvable from a Version at all (§3) -- the page shows Version identity only, no inferred Task | **If `Version.shot_id != shotId`: treated as not-found for this route** -- redirect to `/vfx/shots/:shotId/versions` with an inline notice ("That Version does not belong to this Shot"), never silently rendered under the wrong Shot's breadcrumb | n/a (no Task param on this route) | VFX review generation hidden/disabled for non-VFX | 404-equivalent (redirect to Versions collection) if `versionId` doesn't exist at all |
| `/vfx/shots/:shotId/activity` | `shotId` | `Shot` exists | `.../ {Shot} / Activity` | same 5 tabs, `Activity` active | n/a (composed list, §12) | n/a | n/a | n/a (read-only) | 404 if `shotId` doesn't resolve |

**Locked, cross-cutting rules:**

- **No trusted identity or ftrack credentials ever appear in a query parameter** -- identity is resolved server-side from the session (§13); no route above accepts an `actorId`/`role` query param at all.
- **A Task or Version selection used only for an unsubmitted Alignment-generation form is client state** (the selector in §3.3, before `Generate` is pressed) -- this is explicitly allowed as ordinary UI state, not a persistence concern.
- **Once generation succeeds, the resulting persisted `CrossRoleAssessmentRead` is the source of truth** for the pairing (§3.2 rule 6) -- the client-side selector state is discarded/superseded at that point, never reconciled against it.
- **Which route remains visible after each mutation:** see §14 (per-mutation table) -- as a general rule, every mutation in this document keeps the user on the route they started from; no mutation in the VFX Workspace navigates away automatically (matching `04_...md` §20's existing "stay and show outcome" pattern, reaffirmed here for the new routes).

---

## 6. Current-focus derivation contract

Six focus types, precedence unchanged from `14_...md` §4.2 (corrected wording only, per §2.3 above). For each: required loaded objects, exact predicate, exclusions, title/explanation/target route/action label, actionable-vs-navigational, and the state that replaces it after the relevant mutation.

### 6.1 `core_anchor_gate_pending`

- **Requires:** `CoreAnchor` for the Shot, its `active_revision_id`'s sibling draft (if any), the `HumanGateRead` for that draft.
- **Predicate:** `∃ HumanGateRead where gate_type == "core_anchor_confirmation" and shot_id == shot.id and status == "pending"`.
- **Excludes:** none (highest precedence -- always wins if true).
- **Title:** "Core Anchor draft awaiting your confirmation."
- **Explanation:** "A proposed revision to the shared creative intent is ready for your review."
- **Target route:** `/vfx/shots/:shotId/intent`.
- **Primary action label:** "Review and confirm."
- **Actionable.**
- **Replaced by, after Confirm or Reject:** re-derive from scratch -- typically falls to type 3, 5, or 6 depending on whether an Assessment already exists and its timestamp relative to the just-confirmed/rejected revision.

### 6.2 `core_anchor_draft_needs_review`

- **Requires:** `CoreAnchor` for the Shot; a `CoreAnchorRevisionRead` with `status == "draft"`.
- **Predicate:** `∃ CoreAnchorRevisionRead where core_anchor_id == anchor.id and status == "draft"` **and NOT** 6.1's predicate (i.e. the draft exists but, per the legacy-compatibility path in `human_gate_service.get_or_create_pending_gate_for_resolution`, has no gate yet -- a real, if narrow, real state given the documented legacy-draft-with-no-gate case).
- **Excludes:** 6.1.
- **Title:** "Core Anchor draft in progress."
- **Explanation:** "A draft revision exists but has not yet been submitted for confirmation."
- **Target route:** `/vfx/shots/:shotId/intent`.
- **Primary action label:** "Review draft."
- **Actionable** (leads to a page where submission/editing is possible).
- **Replaced by:** once the draft is submitted and a gate is created, becomes 6.1.

### 6.3 `alignment_not_followed_by_anchor_action` (see §2.2 for the naming rule)

- **Requires:** latest `CrossRoleAssessmentRead` for the Shot (via its Task/Version pairing, §3.2), its nested `IntentSignalRead`.
- **Predicate:** `latest_assessment exists and latest_assessment.intent_signal.attention_level in {"medium", "high"}` **and** `NOT EXISTS (CoreAnchorRevisionRead where core_anchor_id == anchor.id and created_at > latest_assessment.created_at)` **and** `NOT EXISTS (HumanGateRead where shot_id == shot.id and resolved_at > latest_assessment.created_at)`.
- **Excludes:** 6.1, 6.2.
- **Title:** "Cross-role assessment may need your interpretation."
- **Explanation:** exactly the §2.2 wording -- "No newer Core Anchor action has followed this assessment."
- **Target route:** `/vfx/shots/:shotId/alignment`.
- **Primary action label:** "Review alignment."
- **Actionable** (navigational to a page with further real content, not itself a mutation).
- **Replaced by:** as soon as a new Core Anchor revision or HumanGate resolution occurs after `latest_assessment.created_at`, the predicate becomes false and focus re-derives (typically to 6.5 or 6.6, since the Assessment that drove 6.3 is now "answered" by timestamp ordering).

### 6.4 `re_anchor_proposal_present`

- **Requires:** same `latest_assessment` as 6.3, its nested `re_anchor_proposal` (nullable).
- **Predicate:** `latest_assessment.re_anchor_proposal is not None` **and** `latest_assessment.intent_signal.attention_level == "low"` **and** the same not-followed-by-anchor-action condition as 6.3. (When attention is medium/high, 6.3 already covers the same Assessment at higher precedence -- 6.4 exists specifically for the narrower case a Proposal exists but the Signal itself reads `low`, so 6.3 would not otherwise fire.)
- **Excludes:** 6.1, 6.2, 6.3.
- **Title:** "Re-anchor proposal available for consideration."
- **Explanation:** "The latest assessment includes an advisory suggestion for the Core Anchor."
- **Target route:** `/vfx/shots/:shotId/alignment`.
- **Primary action label:** "Review proposal."
- **Actionable** (navigational).
- **Replaced by:** same trigger as 6.3 (a newer Anchor action).

### 6.5 `assessment_generation_available`

- **Requires:** confirmed `CoreAnchorRevisionRead` for the Shot; for the Task selected per §3 (or, if none yet chosen, this focus type is available only if *at least one* valid Task+Version combination exists that would satisfy the check below -- see the "partially met" rule immediately after this table); confirmed `ExecutionAnchorRevisionRead` for that Task; latest `VFXSupervisorReviewRead`, `CGSupervisorReviewRead`, `ArtistAgentGuidanceRead` for that Version/Task.
- **Predicate:** `core_anchor.active_revision.status == "confirmed"` **and** `∃ (task, version) pair belonging to this Shot such that` `execution_anchor(task).active_revision.status == "confirmed"` **and** `latest VFX review, CG review, and Artist guidance all exist for that (task, version)` **and** `NOT (6.1 OR 6.2 OR 6.3 OR 6.4)`.
- **Excludes:** 6.1-6.4.
- **Title:** "A new cross-role assessment can be generated."
- **Explanation:** "All prerequisites are met for this Shot's current Task and Version."
- **Target route:** `/vfx/shots/:shotId/alignment`.
- **Primary action label:** "Generate assessment."
- **Actionable** (leads to the real generation action, via the selector if the pairing isn't yet established per §3.3).
- **Replaced by:** once generation succeeds, re-derives to 6.3 or 6.6 depending on the new Assessment's Signal level.

**Partial-prerequisite handling (explicit, per the task's instruction not to treat partial readiness as availability):** if some but not all of the predicate's conjuncts hold (e.g. confirmed Core Anchor exists, but no Task has a confirmed Execution Anchor yet), focus type 6.5 does **not** fire. Instead, Current focus falls through to **6.6 with an honest missing-prerequisite explanation substituted for the generic "nothing pending" text** -- e.g. "Assessment generation requires a confirmed Execution Anchor, which does not exist yet for this Shot's Tasks. This is owned by the CG Supervisor." This is not a seventh focus type; it is 6.6's explanation field carrying real, specific content instead of the generic fallback, decided by which conjunct of 6.5's predicate is the one currently false (checked in the fixed order: confirmed Core Anchor → confirmed Execution Anchor for at least one Task → all three role outputs present for at least one Task/Version pair).

### 6.6 `none`

- **Requires:** the negative of every predicate above.
- **Predicate:** `NOT (6.1 OR 6.2 OR 6.3 OR 6.4 OR 6.5)`.
- **Excludes:** all above.
- **Title:** "Nothing requires your attention on this Shot right now."
- **Explanation:** either the generic sentence above, or the substituted missing-prerequisite sentence per 6.5's note.
- **Target route:** none (no primary action button rendered at all).
- **Primary action label:** n/a.
- **Navigational only in the sense that the page still offers its normal tab navigation** -- there is no primary CTA.
- **Replaced by:** any of 6.1-6.5 becoming true on next load/refresh.

### 6.7 Timestamp, ordering, and tie-breaking rules (locked)

- **"Latest"** always means `ORDER BY created_at DESC LIMIT 1` on the relevant table, using the database-recorded `created_at` (never a client-computed "most recently viewed" or similar) -- this applies to latest CrossRoleAssessment, latest Task, latest Version, latest role-output rows alike.
- **Tie-breaking:** if two rows share an identical `created_at` (possible under low-precision clocks or synthetic timestamps such as seeded rows created in the same seed-script transaction), the tiebreaker is the row's own primary-key UUID compared lexicographically -- an arbitrary but **deterministic** rule (the same two rows always resolve the same way), which is what matters; it is never surfaced to the user as meaningful ordering.
- **"Newer than" comparisons** (§6.3/§6.4's not-followed-by-anchor-action condition) use strict `>`, not `>=` -- a revision/gate-resolution created in the exact same instant as the Assessment (only plausible for seeded fixture data) is not considered "newer."

### 6.8 Cross-implementation testing rule (Python Inbox derivation vs. TypeScript Shot Overview derivation)

Per `14_...md` §6.5/§12, the backend's `GET /vfx/inbox` current-focus derivation (Python) and the Shot Overview's client-side derivation (TypeScript) are two independent implementations of this exact document's §6.1-6.6 predicates -- not a shared runtime. **Locked testing requirement:** both implementations are tested against the **same table of named fixture scenarios** (one row per focus type, plus the partial-prerequisite case and at least one tie-breaking case), maintained conceptually as one shared scenario table (a markdown or JSON fixture description referenced by both test suites, even though the actual test code is necessarily separate per language) -- so a future change to one predicate is a change to one documented scenario table that both suites must be updated against, not two independently-drifting implementations.

---

## 7. Entry flows

### 7.1 Guided Demo entry

```text
User clicks "Start guided demonstration" on /demo
  → enterDemoRole("vfx_supervisor")        [existing Server Action]
    → sets icas_demo_role httpOnly cookie
  → resolveD1DemoShotId()                  [new, §4.4]
    → calls backend seed-or-resolve endpoint
    → [seed-in-progress state, only on a true first run: the Server
       Action awaits the backend's synchronous seed-or-find response --
       no separate polling loop is needed since the seed is a single
       bounded transaction chain, not a long-running job; the browser
       shows the platform's normal navigation-pending indicator during
       this await, not a custom "seeding..." UI]
    → returns the resolved Shot id, or throws on API/DB failure
  → on success: redirect(`/vfx/shots/${shotId}`)
  → on failure: redirect(`/demo`) with an inline error banner (§4.7)
```

- **Identity creation:** the cookie-set step is unconditional and always succeeds locally (no network call) -- it precedes scenario resolution, so a subsequent resolution failure still leaves the user correctly identified as the VFX Supervisor role if they retry.
- **Browser refresh** on `/vfx/shots/:shotId` after arrival: ordinary route-context validation (§5) applies -- the Shot id is now a normal URL parameter, resolved the same way as any direct navigation; no re-seed occurs on refresh.
- **Exit role view:** clears the cookie and returns to `/demo` (existing `exitRoleView` Server Action, unchanged) -- the seeded D1 data itself is untouched (it is real persisted production data now, not session state).
- **Re-entry:** clicking "Start guided demonstration" again re-runs the same flow; §4.5's idempotency guarantees the second run resolves the same Shot without re-seeding its content.

### 7.2 Standalone VFX entry

```text
User navigates to /vfx (no guided-demo cookie flow involved)
  → middleware confirms icas_demo_role == "vfx_supervisor" [existing]
  → server-side fetch: GET /vfx/inbox                       [14_...md §6]
  → render Inbox rows sorted per 14_...md §6.3
```

- **Empty Inbox:** zero rows -- honest empty state (`14_...md` §14's "Empty" row): "No Shots currently need your attention," no forced action.
- **Multiple rows:** rendered in the locked sort order (pending-gate Shots first, then medium/high-Signal-not-followed Shots, then reviewable-Proposal Shots, then generation-available Shots, then no-action Shots) -- ties within a bucket broken by most-recent-relevant-timestamp descending (§6.7).
- **Row sorting is a pure function of §6's predicates evaluated per-Shot** -- no separate sorting logic; the Inbox's bucket order *is* §6's focus-type precedence applied across many Shots instead of one.
- **Opening Current focus:** clicking a row's `Open` (or, on the Shot Overview itself, the Current-focus primary action) navigates to that focus type's target route (§6's per-type table) -- a plain link, not a mutation.
- **Back-navigation preserving context:** using the browser back button from a Tier-1 workspace route back to `/vfx` returns to a freshly-fetched Inbox (not a cached stale one) -- Next.js's default navigation behaviour already satisfies this since the Inbox's server-side fetch re-runs on navigation; no special back-button handling is introduced. From a Tier-1 workspace route back to the Shot Overview, the breadcrumb (§5's `.../ {Shot} / {Tab}` pattern) provides an explicit, understandable path back regardless of whether the browser back button or the breadcrumb link is used.

### 7.3 Future ftrack entry (Step 8, planning only)

Not implemented. Deep-link outcomes to record now, for later:

| ftrack context | Target ICAS destination |
|---|---|
| Project | `/vfx/projects/:projectId` (once built, currently deferred per `14_...md` §3.2) |
| Shot | `/vfx/shots/:shotId` (Shot Overview) |
| Task | `/vfx/shots/:shotId` (Shot Overview) -- no dedicated VFX Task page exists; the Overview is the closest object-scoped landing |
| Version | `/vfx/shots/:shotId/versions/:versionId` |
| ReviewNote | `/vfx/shots/:shotId/versions/:versionId` (ReviewNotes have no dedicated page; they render inline on the Version Workspace) |
| Pending Core Anchor HumanGate | `/vfx/shots/:shotId/intent` (lands directly on the pending decision) |
| CrossRoleAssessment | `/vfx/shots/:shotId/alignment` |

**All ftrack identity/session validation, launch-context parsing, and the actual redirect mechanism are Step 8 scope** (`10_...md` §2-3) -- this table records only the target-route mapping once that context exists; it implements nothing.

---

## 8. Intent workflow (end-to-end)

### 8.1 Existing confirmed Anchor, no draft

- **Orientation:** confirmed Core Anchor summary shown per `14_...md` §4.4/§9.3's wireframe -- `core_summary` plus full semantic collections on this page (unlike the Overview's one-line summary).
- **Optional inspection of decomposition/reconstruction:** available via the `ON_DEMAND` disclosure (`14_...md` §11), listing `IntentDecompositionRead`/`ContextReconstructionRead` rows if any exist -- purely informational, no action implied.
- **Starting a new revision:** a `Create new revision` action, offering exactly two starting points if an `IntentDecompositionRead` exists: **(a)** `create_core_anchor_draft_from_decomposition` (Agent-originated starting content, human-triggered) or **(b)** manual drafting via `create_draft_revision` with blank/human-authored fields. If no decomposition exists, only (b) is offered. Both are real, already-wired backend calls (§13 for the mutation-adapter wrapping).
- **Resulting persisted records:** a new `CoreAnchorRevisionRead` (`status="draft"`) and, per `create_pending_gate`, a new `HumanGateRead` (`status="pending"`) created in the same transaction as the first draft-creation call for that revision.

### 8.2 Draft exists

- **Comparison:** confirmed revision (if any) alongside the draft, per `14_...md` §9.3's two-column layout.
- **Editing:** `update_core_anchor_revision` (PATCH), semantic-collection add/edit/remove/reorder -- guarded server-side by `require_can_update_draft` (VFX Supervisor only).
- **Validation:** blank-field rejection (already enforced by the existing contract's field validators, e.g. `_require_non_blank`-style checks mirrored across the Core Anchor's own semantic-field contracts) -- surfaced inline, next to the affected field, per `04_...md` §4's failure rule.
- **Save:** each edit is its own PATCH call (or a debounced batch, an implementation detail for the building batch) -- the draft remains `status="draft"` throughout; no gate action occurs from editing alone.
- **Evidence inspection:** `source_intent_decomposition_id` (if Agent-originated) surfaced via the `ON_DEMAND` Evidence/Provenance disclosure.
- **Authority messaging:** an inline `AuthorityBoundary`/`HumanDecisionNotice`-style statement ("Core Anchor confirmation is owned by the VFX Supervisor") present on this page at all times a draft/gate exists, not only at the final confirm step -- reaffirms `04_...md` §2.1's reading-vs-acting distinction throughout, not just at the last click.

### 8.3 Confirm

```text
Client interaction island: rationale text input + "Confirm" button
  → opens the small explicit final confirmation dialog (04_...md §23.B,
    14_...md §9.3) showing the same comparison one more time, plus the
    entered rationale, plus an explicit "Confirm" button inside the dialog
  → user confirms inside the dialog
  → Server Action: confirmCoreAnchorRevision(revisionId, rationale)
    → resolve server-side identity (§13) -- must be vfx_supervisor
    → verify required role server-side (defence-in-depth; the backend
      also enforces require_can_confirm_or_reject)
    → validate revisionId belongs to the current route's shotId (§5, §13)
    → POST /core-anchor-revisions/{revisionId}/confirm
      { rationale, request_write_back: false }   -- see note below
    → on 200: persisted HumanGateRead.status="confirmed",
      DecisionRead(decision_type="confirm_core_anchor") created,
      revision becomes the Shot's active revision, previous revision
      becomes historical (status changes to "superseded" or equivalent
      per the existing lifecycle -- see §14's transition table)
    → sanitise any error (§13)
    → revalidate: Intent Workspace's comparison region, Shot Overview's
      Current-focus region (scoped revalidation, not the whole app)
    → return structured result to the Client island
  → dialog closes only after the Server Action resolves successfully
  → page state after success: comparison collapses to the new confirmed-
    state display; the rejected/superseded revision moves to history
  → Overview Current-focus change: re-derives per §6 (typically to 6.3,
    6.5, or 6.6)
  → Activity availability: a new Core Anchor revision entry and a new
    Decision entry become visible on Activity (§9) on next load
  → error/conflict handling: if the backend returns 409 ("Revision is
    not in draft status" -- §14's exact wording), the dialog shows
    "This draft was already confirmed or rejected elsewhere -- reload to
    see the current state" and does not silently retry or resubmit
```

**`request_write_back` is explicitly **not** set to `true` by this flow** -- per `14_...md` §2.6/§17, the real backend capability exists but stays out of the first VFX flow until real ftrack Shot linkage exists; the Confirm mutation contract always sends `request_write_back: false` (or omits it, since it defaults to `False` server-side) until that precondition is met in a later batch.

### 8.4 Reject

Equivalent complete flow to §8.3, calling `reject_core_anchor_revision` instead:

- Same rationale-entry + explicit confirmation-dialog pattern.
- Server Action: `rejectCoreAnchorRevision(revisionId, rationale)`, same identity/role/route validation.
- `POST /core-anchor-revisions/{revisionId}/reject` -- persisted `HumanGateRead.status="rejected"`, `DecisionRead(decision_type="reject_core_anchor")` created, revision's own `status` becomes `"rejected"` (confirmed at `core_anchor_service.py:636`) -- **the previously-confirmed revision, if any, remains the Shot's active revision** (rejection does not change what is currently confirmed -- only confirmation does).
- **Post-rejection state:** the rejected draft moves to history (visually as a rejected, not merely superseded, historical entry -- distinguishable in the Activity/history disclosure); Intent Workspace returns to its "no draft" state (§8.1) unless another draft independently exists; Current focus re-derives per §6 (a rejected draft does not create a new pending gate -- 6.1 stops applying for this revision).
- No write-back is ever requested on rejection (there is nothing to write back).

---

## 9. Alignment workflow (end-to-end)

```text
Entry from Overview (Current focus type 6.3/6.4/6.5, or direct tab click)
  → Alignment Workspace loads

No-Assessment state:
  → prerequisite checklist shown (confirmed Core Anchor? confirmed
    Execution Anchor for at least one Task? latest VFX/CG/Artist
    outputs present for at least one Task+Version?)
  → if any prerequisite is missing: honest missing-prerequisite message
    per §6.5's note -- no Generate control rendered as primary
  → if all prerequisites are met but no pairing is established: the
    Task/Version selector (§3.3) replaces a bare Generate button
  → if all prerequisites are met and exactly one Task/Version
    combination exists: the streamlined one-option selector state (§3.3)

Generate action:
  → Client island: "Generate assessment" (after a valid Task+Version
    selection, per §3.2/§3.3)
  → Server Action: generateCrossRoleAssessment(shotId, versionId, taskId)
    → resolve identity (§13), require vfx_supervisor
    → validate versionId and taskId both belong to shotId (§3.2 rule 4,
      §13)
    → POST /versions/{versionId}/cross-role-assessments/generate
      { task_id: taskId }
  → pending state: the chosen Task/Version identity stays visible and
    locked (§3.3); a running-state indicator per 04_...md §3.4

Successful persistence:
  → new CrossRoleAssessmentRead (with nested required IntentSignalRead,
    optional ReAnchorProposalRead) becomes "latest"
  → revalidate: Alignment Workspace's assessment region, Shot Overview's
    Current-focus and supporting-context regions

Failed generation:
  → AgentGenerationError (502) or a missing-prerequisite ConflictError
    (409, if a prerequisite that passed the client's own check somehow
    fails server-side -- e.g. a race where a review was superseded
    between page load and submission)
  → the previous successful Assessment, if any, remains fully visible
    and marked current -- generation failure never clears or replaces
    it (04_...md §2.6/§10's Failure rule, reaffirmed)
  → compact failure row per 14_...md §13/§14's honest state model

Latest versus historical Assessment:
  → latest: full detail (executive summary, tension summary, segmented
    perspective switch, Proposal, Evidence) expanded by default
  → historical: collapsed `CrossRoleAssessmentHistory`-style group,
    each entry expandable to its own full immutable content, never
    merged with or presented as the latest

Intent Signal placement: step 1 of the locked interaction order
  (14_...md §9.4) -- role-worded conclusion + summary, sourced from
  latest_assessment.intent_signal

Tension summary: step 2 -- top 1-2 CrossRoleFinding items from
  cross_role_tensions/local_optimum_risks, not the full list

Segmented VFX/CG/Artist perspective inspection: step 4, the locked
  segmented-switch pattern (14_...md §9.4) -- one RolePerspectiveRead
  visible at a time

Re-anchor Proposal inspection: step 5, when
  latest_assessment.re_anchor_proposal is not None -- full
  ReAnchorProposalOutput content (reason, preserved elements, proposed
  fields, adoption risks, questions), read-only

Evidence disclosure: step 6, ON_DEMAND per 14_...md §11

"Open Intent Workspace": step 7 -- a plain navigation link to
  /vfx/shots/:shotId/intent, carrying no query-parameter state (per
  §5's rule against putting anything sensitive in query params; this
  link needs none, since Intent Workspace re-derives its own state from
  the Shot id already in its own route)

No Apply: confirmed absent, not introduced by this document

No Accept/Reject for CrossRoleAssessment: confirmed -- CrossRoleAssessment
  has no such action anywhere in the domain model (unlike legacy
  AlignmentAssessment, §11); this document does not add one

How a later Core Anchor action changes Current focus without rewriting
  the immutable Assessment: exactly §6.3/§6.4's predicate -- a new
  CoreAnchorRevisionRead or resolved HumanGateRead with a later
  timestamp makes the "not followed by anchor action" condition false,
  so Current focus stops selecting 6.3/6.4 for that Assessment. The
  CrossRoleAssessmentRead row itself is never touched, edited, or
  flagged -- only the *derived, recomputed-on-each-load* Current-focus
  read changes. This is the concrete mechanism proving §2's
  truthfulness rule: no persisted field on the Assessment changes at
  all; only a downstream, honestly-named derived computation does.
```

---

## 10. Version workflow (end-to-end)

```text
Entry: from the Versions collection (/vfx/shots/:shotId/versions) list
  row's "Open", or a future ftrack Version deep-link (§7.3, Step 8)

Version-to-Shot validation: per §5's route-context contract --
  Version.shot_id must equal the route's shotId, else redirect to the
  Versions collection with an inline notice

Version context: production facts (name, number, description, source)
  shown per 14_...md §9.6's wireframe

ReviewNotes: listed via the existing listReviewNotesForVersion call,
  unchanged from the legacy page's data source

VFX Supervisor Agent review generation:
  → Client island: "Generate VFX review"
  → Server Action: generateVfxSupervisorReview(versionId)
    → resolve identity (§13), require vfx_supervisor
    → validate versionId belongs to the route's shotId
    → POST (exact path per intent/router.py's vfx-supervisor-reviews
      generate endpoint, confirmed to exist and take an explicit
      Shot/Task/Version context per 04_...md §6's prerequisites)
  → pending state: running-state indicator, duplicate-Generate disabled
    while running (04_...md §19's Loading rule)
  → on success: new VFXSupervisorReviewRead persisted, shown newest-first
    alongside prior reviews (no active/latest pointer exists on this
    table -- confirmed by its model docstring -- so all reviews remain
    visible, ordered by created_at)
  → on failure: prior successful reviews remain visible and current;
    compact failure row, sanitised error

Text-evidence-only notice: a fixed, always-present statement on this
  card -- "Based on Version description and ReviewNote text -- no media
  was inspected" -- reflecting the real, permanent limitation documented
  in vfx_supervisor_review_service.py's own module docstring (this
  repository performs no image/video/frame/media analysis at all, not
  a temporary gap)

Pending and failure states: as above

Previous successful reviews remaining visible: confirmed -- no
  active/latest pointer means every VFXSupervisorReviewRead ever
  generated for this Version stays queryable and is shown, most recent
  first, none hidden

Evidence/Provenance: ON_DEMAND disclosure per 14_...md §11, sourced from
  each review's own context_snapshot_id/agent_run_id

Legacy AlignmentAssessment compatibility disclosure: collapsed by
  default, per 14_...md §5.2/§9.6 -- **corrected by owner review after
  7C-0D: read-only historic result and historic Decision records only.
  No Generate control, no Accept control, no Reject control is exposed
  anywhere in the new VFX Workspace** -- visually secondary (muted
  tone). Mutation (generate/accept/reject) remains available only in
  the legacy `/shots` engineering workflow, unchanged.

No legacy Accept/Reject in the new Workspace: confirmed -- not merely
  "not primary," genuinely absent; if shown at all inside the collapsed
  disclosure, it is display-only

No Artist Agent action surface in the VFX Workspace: confirmed absent,
  per 14_...md §9.6/§11 (ArtistAgentGuidance is NOT_SHOWN here)
```

---

## 11. Activity composition flow

The repository has no single Shot-wide activity endpoint (confirmed, `13_...md` §3.13). Activity is composed server-side from several already-scoped, already-real queries:

| Source | Query used | Scope |
|---|---|---|
| Core Anchor revisions | `listCoreAnchorRevisions(shotId)` | Shot-wide (Core Anchor is Shot-scoped) |
| Revision-scoped Decisions | `listDecisionsForRevision(revisionId)`, called once per revision returned above | Per-revision, aggregated client/server-side into one chronological list |
| HumanGate outcomes | derived from each revision's `getHumanGateForRevision` where present | Per-revision |
| CrossRoleAssessments | `listCrossRoleAssessmentsForVersionAndTask(versionId, taskId)`, called once per distinct (Task, Version) pair that has ever appeared in a generated Assessment for this Shot -- **not** every Task×Version combination (which would be a fabricated cross-product with no real backing) | Per-established-pairing (§3.2) |
| Intent Signals | nested inside each CrossRoleAssessment above (`assessment.intent_signal`) -- no separate fetch | Same scope as above |
| Relevant Version review history | `listReviewNotesForVersion`/VFX review list, scoped to Versions that belong to this Shot (`Version.shot_id == shotId`, a real, direct filter unlike the Task/Version ambiguity elsewhere) | Shot-wide via the real FK |
| Legacy AlignmentAssessment compatibility decisions | `listAlignmentAssessmentDecisions`, scoped per-Version, for Versions belonging to this Shot | Shot-wide via the real Version FK |

**Server-side loading strategy:** one server-side data-loader function per Activity page load, issuing the above queries in parallel where independent (Core Anchor revisions and Version-scoped review history do not depend on each other), sequentially where one query's result set determines the next (revision list → per-revision Decision/gate lookups; Assessment pairing discovery → per-pairing Signal). This is a real, if moderately many-request, composition -- acceptable at portfolio scale, and consistent with `03_...md` §16.1's own acknowledgement that "existing APIs may require many requests to compose Inbox pages," applied here to Activity instead.

**Chronological sorting:** all composed items merged into one list, sorted by each item's own real timestamp (`created_at` for immutable rows, `resolved_at` for HumanGate outcomes) descending.

**Duplicate prevention:** each source object type is fetched exactly once per Shot-scoped composition pass; Intent Signals are never independently fetched (they ride along with their owning Assessment), preventing the same Signal from appearing as two separate Activity rows.

**Authority/source labels:** every composed row carries one of the required labels from `06_...md` §10 (`Human intent` / `Human-confirmed` / `AI interpretation` / `AI proposal` / `Production fact`), assigned deterministically by source object type (a Decision is always `Human-confirmed`; a CrossRoleAssessment is always `AI interpretation`; a Version/ReviewNote is always `Production fact`).

**Partial-data failures:** if one source query fails (e.g. the Decision lookup for one particular revision times out), the rest of the composed list still renders -- the failed source contributes a single compact inline notice ("Some Decision history could not be loaded") rather than failing the whole Activity page, matching `04_...md` §19's Loading/partial-data principle.

**Pagination:** not required at portfolio scale (explicit, per the task) -- the composed list is expected to stay small (single Shot, few revisions/Assessments) and is rendered in full.

**What is omitted:** anything with no honest link to the Shot -- e.g. Activity for a *different* Shot's Task, or a CrossRoleAssessment generated against a Task/Version pairing that has since been reassigned in a *later* Assessment (still shown, since it remains real historical evidence for this Shot, just visually marked historical) is not omitted; only genuinely cross-Shot data is excluded. **No global enterprise event stream is introduced** -- this remains a Shot-scoped composition, never a system-wide feed.

---

## 12. Server-side identity mutation contracts

Expanding `14_...md` §7 into the exact per-mutation contract:

```text
Client interaction island (e.g. the Confirm dialog's submit handler)
  → Server Action (preferred default, see rule below) or same-origin
    Route Handler
    → resolve server-side identity from the icas_demo_role cookie
      (ResolvedIdentity: { role, actorId, displayName })
    → verify required role for this specific mutation (e.g.
      "vfx_supervisor" for Confirm/Reject/Generate-assessment/
      Generate-VFX-review) -- a hard check even though FastAPI enforces
      it again; failing here avoids a wasted round-trip and produces a
      same-shaped error as a real 403
    → validate route object context: the mutation's target id(s)
      (revisionId, versionId, taskId) belong to the route's shotId,
      per §5's per-route table
    → call FastAPI with trusted Actor headers:
        X-Actor-Role: <resolved role>
        X-Actor-Id: <resolved actorId>
      -- never values read from the Client's request body/props
    → sanitise error: map FastAPI's 401/403/404/409/502 (api.ts's
      existing describeError() convention) to a structured result,
      stripping any internal detail beyond the safe, already-designed
      user-facing message
    → revalidate the minimum route/data region (Next.js
      revalidatePath/router.refresh() scoped to the current route
      segment -- confirmed via repository search that no
      revalidatePath usage exists yet anywhere in apps/web, so this is
      new, consistent usage introduced once, at the mutation-adapter
      layer, not per-feature)
  → return a structured result { ok: true, data } | { ok: false,
    error: { kind, message } } to the Client island
```

**Safe input from the Client:** target object ids already visible in the current route/page state (`revisionId`, `versionId`, `taskId`, `assessmentId`), user-entered text (`rationale`), and the §3.3 selector's chosen Task/Version ids. **Data the Client must never supply:** `actorId`, `role`/`human_role`, or any header value -- these come exclusively from the server-side identity resolver, never from a form field, hidden input, or client-side variable, closing the exact gap the legacy `ActorSelector` left open.

**Actor id staying server-side:** confirmed unchanged from `14_...md` §7.4 -- `actorId` is injected into the outgoing FastAPI request header inside the Server Action/route handler; it is never serialized into any prop, form field, or client-visible response payload.

**FastAPI actor headers:** exactly `X-Actor-Role`/`X-Actor-Id`, matching `get_current_actor`'s real, confirmed header-dependency shape (`workflow/actors.py`) -- no new backend authentication mechanism is introduced or required.

**Route-object validation:** performed twice, deliberately -- once in the Server Action/route handler (§3.2 rule 4, this section), and again by the backend service itself (e.g. `confirm_revision`'s own `NotFoundError`/`ConflictError` checks) -- the frontend check is a UX improvement (faster, more specific error) and a defence-in-depth measure, never a substitute for the backend's own enforcement (matching CLAUDE.md's "Permissions must be enforced in backend logic, not only in prompts or UI").

**CSRF/same-origin assumptions:** Next.js Server Actions carry their own built-in same-origin/CSRF protection (a signed action reference the framework validates automatically) -- this is the specific reason Server Actions are the **recommended default** below rather than a hand-rolled route handler, which would require manually reimplementing an equivalent same-origin check.

**Error result shape:** `{ ok: false, error: { kind: "forbidden" | "not_found" | "conflict" | "agent_generation_failed" | "network" | "validation", message: string } }` -- `kind` drives which `ErrorState`/`ConflictError`-specific UI treatment renders (§14), `message` is always the already-sanitised, user-safe string.

**Stale/conflict handling:** a `409` from the backend (e.g. `core_anchor_service`'s "Revision is not in draft status") maps to `kind: "conflict"`, rendered as an explicit "this was already acted on elsewhere -- reload to see the current state" message (§8.3), never retried automatically.

**Loading and double-submit prevention:** the Client island disables its submit control for the duration of the Server Action's promise (standard `useFormStatus`/`isPending`-equivalent pattern) -- this alone prevents double-submission without any additional debounce logic, since a Server Action call is a single awaited request.

**Scoped `revalidatePath` behaviour:** each mutation's Server Action calls `revalidatePath` (or the Route Handler equivalent, `router.refresh()` triggered client-side after a successful fetch) targeting only the specific route segment(s) whose data changed -- e.g. Confirm revalidates `/vfx/shots/[shotId]/intent` and `/vfx/shots/[shotId]` (Overview's Current focus), never the whole `/vfx` subtree.

**Preservation of the legacy direct-browser actor path under `/shots`:** unchanged and untouched -- `/shots`/`/dev` continue to call `api.ts`'s existing functions directly from Client Components with the legacy `ActorSelector`'s client-chosen headers; the new server-side adapter is additive, used only by the new `/vfx` feature modules.

### 12.1 Server Action vs. Route Handler -- the smallest consistent rule

**Recommendation: Server Actions for every mutation in this document.** All eleven mutation categories (Confirm, Reject, Generate assessment, Generate VFX review, Generate decomposition, Create draft from decomposition, Update draft, Generate context reconstruction, plus the Demo scenario resolver's seed call) are simple, form-like, single-object mutations triggered from within a React component tree already rendering the relevant Client island -- exactly the case Server Actions are designed for, and the case that gets same-origin protection "for free" (§12 above). A Route Handler would only be justified for a mutation that must be reachable from a non-form context (e.g. a webhook, or a fetch from outside the React tree) -- **no mutation in this document's scope is that kind of call**, so the rule is simply: **Server Actions, uniformly, for this batch of work.** (This does not preclude a future, different category of interaction -- e.g. a real ftrack webhook receiver in Step 8 -- from being a Route Handler; it is simply out of scope for anything specified here.)

---

## 13. State-transition tables

### 13.1 Core Anchor revision lifecycle

| Starting state | User action | Server operation | Persisted result | Next UI state | Failure result | Retained historical data |
|---|---|---|---|---|---|---|
| No revision exists | Create draft (manual or from decomposition) | `create_draft_revision` / `create_core_anchor_draft_from_decomposition` | new `CoreAnchorRevisionRead(status="draft")` + `HumanGateRead(status="pending")` | §6.1 (gate pending) | `ForbiddenActionError`→403 if not VFX | n/a (nothing existed before) |
| `draft` | Edit fields | `update_draft_revision` | same row, fields updated, `status` unchanged | remains `draft` | validation error, inline | n/a (same row) |
| `draft`, gate `pending` | Confirm | `confirm_revision` | `status="confirmed"`; becomes `active_revision`; **previous confirmed revision's status changes** (superseded, per the CAS mechanism in `core_anchor_lock.compare_and_swap_active_revision`) | §6.3/6.5/6.6 (re-derived) | `ConflictError`→409 "Revision is not in draft status" if already resolved elsewhere; `ForbiddenActionError`→403 if not VFX | previous confirmed revision, now historical/superseded |
| `draft`, gate `pending` | Reject | `reject_revision` | `status="rejected"` | Intent Workspace returns to no-draft state (unless another draft exists) | same 409/403 as Confirm | rejected revision itself, marked historical |

### 13.2 HumanGate lifecycle

| Starting state | User action | Server operation | Persisted result | Next UI state | Failure result | Retained historical data |
|---|---|---|---|---|---|---|
| No gate exists for a draft | (implicit, on draft creation) | `create_pending_gate` | `HumanGateRead(status="pending")` | §6.1 | n/a (not a user-facing failure point) | n/a |
| `pending` | Confirm | `resolve_gate(status="confirmed", ...)` | `status="confirmed"`, `resolved_at`/`resolved_by_*`/`decision_id` set | gate shown as resolved on the (now historical) revision | `InternalConsistencyError` (never user-facing) if already resolved -- defensive only, since the revision-status check upstream already prevents this from a normal user path | the gate row itself, permanently, linked to its Decision |
| `pending` | Reject | `resolve_gate(status="rejected", ...)` | `status="rejected"`, same fields set | gate shown as resolved on the rejected revision | same as above | same as above |

### 13.3 CrossRoleAssessment generation lifecycle

| Starting state | User action | Server operation | Persisted result | Next UI state | Failure result | Retained historical data |
|---|---|---|---|---|---|---|
| Prerequisites unmet | (none available) | n/a | n/a | §6.5's missing-prerequisite explanation under §6.6 | n/a | n/a |
| Prerequisites met, no pairing established | Choose Task+Version, Generate | `generate_cross_role_assessment` | new `CrossRoleAssessmentRead` + required `IntentSignalRead` + optional `ReAnchorProposalRead` + `AgentRun`/`ContextSnapshot` | §6.3/6.4/6.5/6.6 (re-derived from the new Assessment) | `AgentGenerationError`→502; `ConflictError`→409 if a prerequisite (e.g. a review) changed between page load and submission | previous Assessment(s), collapsed, unaffected |
| Prerequisites met, pairing already established (an Assessment exists) | Generate (re-run against the same or a newly chosen pairing) | same | same, a new immutable row -- never an update to the prior one | same re-derivation | same failure modes | all prior Assessments remain, chronologically |

### 13.4 Intent Signal derivation / current-history relationship

| Starting state | Trigger | Server operation | Persisted result | Next UI state | Failure result | Retained historical data |
|---|---|---|---|---|---|---|
| Latest successful Assessment exists | (automatic, inside `generate_cross_role_assessment`) | deterministic derivation, not a separate Agent run | new `IntentSignalRead`, nested under the Assessment, `cross_role_assessment_id` FK | Alignment step 1 shows this Signal as current | Signal creation cannot fail independently of the Assessment's own generation (they persist atomically, per the service's docstring: "creating a ContextSnapshot/AgentRun/CrossRoleAssessment row and, atomically alongside it, ... a required IntentSignal row") | prior Signals remain nested under their own prior Assessments, visible via history |
| No Assessment ever generated | (page load) | n/a | n/a | "No current Intent Signal. A successful Cross-role Assessment is required." (`04_...md` §11) | n/a | n/a |

### 13.5 Re-anchor Proposal relationship

| Starting state | Trigger | Server operation | Persisted result | Next UI state | Failure result | Retained historical data |
|---|---|---|---|---|---|---|
| Assessment generation in progress | (automatic, conditional) | `_validate_re_anchor_proposal`'s bounded evidence-diversity gate decides whether the model-produced `ReAnchorProposalOutput` is persisted at all | either a new `ReAnchorProposalRead` (gate satisfied) or `re_anchor_proposal: null` on the Assessment (gate not satisfied) -- **never a partial/invalid Proposal persisted** | §6.4 becomes reachable only if a Proposal was in fact persisted | n/a (this is an internal generation-time decision, not a separate user-facing failure) | prior Proposals (each nested under their own prior Assessment) remain, immutable |

### 13.6 VFX Supervisor Agent review generation

| Starting state | User action | Server operation | Persisted result | Next UI state | Failure result | Retained historical data |
|---|---|---|---|---|---|---|
| Any (no active/latest pointer concept) | Generate VFX review | VFX Supervisor Agent `creative_review` capability, via `agents.runtime.execute_agent` | new `VFXSupervisorReviewRead`, immutable | new review shown newest-first alongside all prior ones | `AgentGenerationError`→502; prior successful review(s) remain fully visible and current | every prior review, permanently (no supersession concept on this table) |

### 13.7 Demo identity/session lifecycle

| Starting state | User action | Server operation | Persisted result | Next UI state | Failure result | Retained historical data |
|---|---|---|---|---|---|---|
| No `icas_demo_role` cookie | Click a role-entry action on `/demo` | `enterDemoRole(role)` Server Action | `icas_demo_role` httpOnly cookie set (session-scoped, no Expires/Max-Age) -- **not a persisted database row**, session state only | redirected to that role's home (or, for the guided-demo path, further to the resolved Shot, §7.1) | n/a (cookie-set cannot fail short of a browser/runtime error) | n/a -- no history exists for identity itself |
| Cookie set | `Exit role view` | `exitRoleView` Server Action | cookie deleted | `/demo` | n/a | n/a |
| Cookie set, role-prefixed route requested for a *different* role | (middleware intercepts) | `middleware.ts`'s existing redirect-to-`ROLE_HOME_PATH[cookieRole]` logic, unchanged | no change | redirected to the cookie's own role home | n/a | n/a |

### 13.8 Demo scenario resolution lifecycle

| Starting state | Trigger | Server operation | Persisted result | Next UI state | Failure result | Retained historical data |
|---|---|---|---|---|---|---|
| "D1 Demo Project" does not exist in the database | Guided-demo entry (first ever run against this database) | seed-or-resolve endpoint (§4.4): find-by-name fails, so create the full Project→Shot→Task→Version→IntentBrief chain (real persisted rows, real service calls) | new, real `Project`/`Shot`/`Task`/`Version`/`IntentBrief` rows, name-tagged per §4.3 | redirect to `/vfx/shots/:shotId` for the newly-created Shot | database/API unavailable → §4.7's inline failure on `/demo`, no redirect | the created rows persist permanently -- a second run finds them (next row) |
| "D1 Demo Project" already exists | Guided-demo entry (any subsequent run) | seed-or-resolve endpoint: find-by-name succeeds, no writes | no change | redirect to `/vfx/shots/:shotId` for the existing Shot | same failure mode as above, on the read itself | unchanged, reused |

---

## 14. Scoped refresh and navigation outcomes

Per-mutation summary (each row expands a case already detailed above; this table is the compact cross-reference the task explicitly asks for):

| Mutation | Route before | Route changes? | Invalidated regions | Untouched regions | Dialog closes? | Focus returns to | Success feedback | Next step |
|---|---|---|---|---|---|---|---|---|
| Confirm Core Anchor | Intent Workspace | No | Intent comparison region; Overview Current-focus region | Alignment, Versions, Activity (until their own next load) | Yes, only after success | the page's primary heading (so a screen reader announces the new state) | inline confirmed-state banner, actor + timestamp | user reads the new confirmed state, may navigate onward via tabs |
| Reject Core Anchor | Intent Workspace | No | same as Confirm | same | Yes, only after success | same | inline rejected-state notice | draft is gone; user may start a new draft |
| Update Core Anchor draft | Intent Workspace | No | the edited field(s)/section only | the rest of the comparison | n/a (no dialog for a plain field edit) | the edited field, unchanged focus | inline "saved" micro-feedback (e.g. a brief field-level indicator, not a page-level toast) | continue editing or proceed to Confirm/Reject |
| Generate CrossRoleAssessment | Alignment Workspace | No | Alignment's assessment region; Overview Current-focus/supporting-context region | Intent, Versions, Activity | n/a (no confirmation dialog for a Generate action -- it is advisory-output creation, not a HumanGate) | the new Assessment's summary heading | the new Assessment renders expanded, prior collapses | user reviews perspectives, may open Intent Workspace |
| Generate VFX Supervisor review | Version Workspace | No | the review list region only | ReviewNotes, legacy AlignmentAssessment disclosure | n/a | the new review card | new review appears newest-first | user reads it; no forced next step |
| Guided Demo entry (seed/resolve) | `/demo` | **Yes** (the one deliberate exception -- entry flow, not an in-page mutation) | n/a (fresh navigation) | n/a | n/a | n/a (new page) | none needed (arrival on Shot Overview is itself the feedback) | orientation begins (§7.1) |

**Avoided, explicitly, in every row above:** a global page reload (none of the mutations trigger one); replacing the whole page with a loading state (only the specific region shows a loading/pending treatment); automatically navigating away before the user can read the outcome (every mutation stays on its route, per `04_...md` §20's existing table, reaffirmed); optimistic UI for HumanGate confirmation (the Confirm/Reject dialog's UI reflects only the *actual* returned result -- the comparison view is not pre-collapsed to the "confirmed" state until the Server Action resolves successfully).

---

## 15. D1 VFX interaction walkthrough

Grounded in §4's seeded objects, the locked IA (`14_...md`), and this document's exact contracts. **[SEEDED]** marks a starting record created by §4's idempotent seed. **[LIVE]** marks a step performed live, through a real mutation, during the walkthrough itself. **[FALLBACK]** marks where a stable, previously-real seeded record substitutes for live generation if a provider is unavailable -- always through the same domain model/API, per `10_...md` §9.

1. **Guided entry [LIVE mechanism, SEEDED data]** -- Maya Chen clicks "Start guided demonstration." `enterDemoRole` sets the session cookie; `resolveD1DemoShotId()` finds (or, on a true first run, creates) the D1 Demo Project/Shot/Task/Version/IntentBrief chain (§4.5 -- seeded content stops at an unconfirmed starting point, not a finished scenario). Redirect to `/vfx/shots/:shotId`.
2. **Shot orientation [SEEDED]** -- Shot Overview loads: production context header shows Project/Shot/Task/Version/source/Core Anchor state (`none`, since the seed does not pre-confirm one, §4.5).
3. **Current focus [derived, SEEDED inputs]** -- with no confirmed Anchor and no draft yet, §6's predicates evaluate to `none` initially, with the missing-prerequisite explanation naming that a Core Anchor draft has not been started. (If the seed instead includes a pre-created draft to shorten the demo -- an implementation choice for the building batch, not decided here -- focus would instead show 6.2.)
4. **Starting the Core Anchor [LIVE]** -- Maya opens Intent Workspace, creates a draft (manually or from an IntentBrief-derived decomposition, §8.1), edits the semantic fields to reflect the D1 scenario's restrained-confrontation intent, and submits -- a real `HumanGateRead(status="pending")` is created. Current focus becomes 6.1.
5. **Confirming the Core Anchor [LIVE]** -- Maya reviews the comparison, enters a rationale, confirms through the explicit dialog (§8.3). A real `DecisionRead` and confirmed `CoreAnchorRevisionRead` persist.
6. **Alignment inspection [SEEDED, resolved by `16_...md` §3]** -- Maya opens Alignment Workspace and finds a real, already-generated Cross-role Assessment (with a confirmed Execution Anchor and role-review chain also seeded). This was originally an open tension in this document (a from-scratch walkthrough cannot reach Alignment without those prerequisites) -- it is now resolved: the D1 seed runs the real generation service calls under the existing deterministic provider (the same mode the backend test suite already uses) to produce this content honestly, and the Demo's starting Current focus is locked to `alignment_not_followed_by_anchor_action` so the walkthrough opens here rather than at a pending gate. See `16_...md` §3 for the exact lifecycle ordering and reasoning.
7. **Role-perspective comparison [LIVE or FALLBACK]** -- once an Assessment exists (generated live if prerequisites are real, or present via the fallback seed), Maya switches between VFX/CG/Artist perspectives via the segmented control (§9).
8. **Re-anchor Proposal [LIVE or FALLBACK]** -- if the Assessment's evidence-diversity gate produced one, Maya reviews it (§9) -- read-only, no Apply.
9. **Open Intent Workspace [LIVE]** -- a plain navigation click from Alignment back to Intent (§9's step 7).
10. **Draft comparison/edit [LIVE]** -- Maya starts a *new* draft revision reflecting what she learned from the Assessment (§8.1/§8.2) -- this is a second, independent revision, not a mutation of the first.
11. **Explicit HumanGate confirmation [LIVE]** -- Maya confirms the new revision (§8.3) -- the prior confirmed revision becomes historical.
12. **Updated Overview [derived]** -- Shot Overview's Current focus re-derives (§6.3/§6.4's predicate is now false for the earlier Assessment, since a newer Anchor action followed it); the confirmed-Anchor supporting context updates to the new revision's summary.
13. **Activity history [composed, §11]** -- Maya opens Activity and sees both Core Anchor revisions (the first and the replacement), both Decisions, the Assessment, and its Signal, chronologically ordered with correct authority labels.

**No fake UI-only state appears anywhere in this walkthrough** -- every numbered step above either performs a real mutation against the real backend or reads a real persisted (seeded or live-generated) row; step 6 is the one place a stable fallback is explicitly named and justified rather than silently assumed.

**Not implemented by this document** -- this is a specification for Step `7C-1` onward to build against, per §18.

---

## 16. Browser acceptance scenarios (for future implementation)

Each scenario states expected **visible behaviour**, not implementation detail.

1. **Demo seed absent on first entry:** clicking "Start guided demonstration" against a fresh database takes slightly longer (real row creation) but still lands on a fully-rendered Shot Overview -- no visible "seeding" UI, no error, no partial page.
2. **Demo seed already present:** clicking "Start guided demonstration" a second time (same or a different browser session) lands on the *same* Shot Overview, showing whatever state a prior run left it in (e.g. already-confirmed Core Anchor if a previous walkthrough confirmed one) -- never a reset, never a duplicate Shot.
3. **Demo API unavailable:** clicking "Start guided demonstration" while the backend is down returns to `/demo` with a visible, specific error banner -- never a blank page, a stuck spinner, or a redirect into a broken Shot page.
4. **Empty VFX Inbox:** `/vfx` with zero real Shots shows "No Shots currently need your attention," no fabricated row, no forced action button.
5. **Multiple Inbox items sorted by focus precedence:** a Shot with a pending HumanGate appears above a Shot with only a `low`-attention Signal, regardless of either Shot's name or creation order.
6. **Pending HumanGate flow:** opening a Shot with a pending gate shows the comparison and Confirm/Reject immediately visible on Intent Workspace, with the Overview's Current focus already naming it before the user even opens Intent.
7. **Draft edit validation:** attempting to save a blank required field shows an inline error next to that field; the draft is not lost, and no network request appears to have silently failed.
8. **Confirm success:** after confirming, the dialog closes, the page shows the new confirmed state with actor and timestamp, and navigating to Shot Overview shows an updated (or now-empty) Current focus.
9. **Reject success:** after rejecting, the dialog closes, the page shows a rejected-state notice, and the draft no longer appears as an active draft anywhere.
10. **Stale/conflict response:** if two browser tabs both have the same pending gate open and one tab confirms first, the second tab's Confirm attempt shows "This was already confirmed or rejected elsewhere -- reload to see the current state," never a silent failure or a duplicate Decision.
11. **No Assessment prerequisites:** Alignment Workspace with a missing confirmed Execution Anchor shows the specific missing-prerequisite sentence naming that requirement and its owning role, not a generic "cannot generate."
12. **Explicit Task–Version selection:** with prerequisites met but no established pairing, Alignment Workspace shows two selectors, both empty by default, Generate disabled until both are chosen.
13. **Successful Assessment generation:** after generation, Alignment Workspace shows the new Assessment expanded, the Task/Version pairing now displayed as an established pair (no longer two independent facts), and any prior Assessment collapsed into history.
14. **Agent generation failure with previous Assessment retained:** if generation fails, the page still shows the previous successful Assessment exactly as before, plus a compact, separate failure notice -- the user never sees a blank or broken Alignment page.
15. **Re-anchor Proposal with no Apply control:** wherever a Proposal is shown, visually inspecting the page finds no button, link, or control labelled "Apply" anywhere -- only "Open Intent Workspace."
16. **Version review generation:** clicking "Generate VFX review" shows a running indicator, then a new review card appears above any prior ones, each showing the text-evidence-only notice.
17. **Legacy AlignmentAssessment collapsed:** on Version Workspace, the legacy compatibility section is collapsed by default; expanding it shows historic results and Decisions only -- never a Generate, Accept, or Reject control of any kind, styled as primary or otherwise.
18. **Activity partial-data failure:** if one Activity data source fails to load, the rest of the Activity list still renders, with one small inline notice for the failed portion -- not a blank Activity page.
19. **Permission denial:** attempting an action outside VFX authority (reachable only via direct URL manipulation, since normal navigation never offers it) shows a message naming the actual owning role, not a generic "forbidden."
20. **Browser refresh on every Tier-1 route:** refreshing `/vfx`, `/vfx/shots/:shotId`, `/vfx/shots/:shotId/intent`, `/vfx/shots/:shotId/alignment`, and `/vfx/shots/:shotId/versions/:versionId` each reloads correctly from the URL alone, with no reliance on client-only state that a refresh would lose (confirming the route-context contracts in §5 are sufficient on their own).

---

## 17. Unresolved implementation risks

1. **The seed's exact backend entry point (§4.4) is unnamed** -- a concrete router/module choice (new `demo` module vs. an addition to `ops`) is deferred to Step `7C-1`; this document specifies the contract (idempotent, real domain rows) but not the exact endpoint path.
2. **Resolved by `16_...md` §3, no longer a risk:** the D1 walkthrough's step 6 fallback-seed exception is now decided -- the seed runs the real generation service calls under the deterministic provider for the full stable starting state, and the Demo's starting Current focus is locked. See §15's step 6, corrected above.
3. **Resolved by `16_...md` §6, no longer a risk:** the `ExternalSource` extension to include `"demo"` is now owner-approved (not merely recommended) -- see `16_...md` §6 for the locked semantics. Implementing the change itself remains Step `7C-1` work.
4. **Cross-implementation testing (§6.8)'s shared fixture-scenario table has no home yet** -- this document requires it exist and be shared conceptually between the Python and TypeScript test suites, but does not create the file or decide its exact format (JSON fixture vs. a documented markdown table both remain open); this is Step `7C-1` work.
5. **The exact revision `status` value for "superseded" (§13.1) was not independently re-verified this session** beyond the docstring's description of the CAS mechanism -- Step `7C-1`/`7C-2` should confirm the literal string value against `CoreAnchorRevision`'s actual status column/contract before building the Activity/history display that depends on distinguishing "superseded" from "rejected."
6. **Route Handler fallback for a future non-form mutation (§12.1) is named but not designed** -- if Step 8's ftrack webhook work later needs one, this document does not specify its shape; it only clears the ground by stating the current scope needs none.

---

## 18. Handoff to Step 7C-0D

Step 7C-0D receives, from this document, exactly:

- **Locked interaction sequences** (§8-§11): the full Intent/Alignment/Version/Activity flows, step by step, including every Server Action call and its exact backend endpoint.
- **Route-context rules** (§5): required params, validation, breadcrumb/tab behaviour, and not-found/redirect handling for all seven VFX routes.
- **Current-focus predicates** (§6): six focus types with exact, timestamp-grounded predicates, exclusions, and the honest partial-prerequisite substitution rule -- ready to be translated into spatial layout without any remaining ambiguity about *when* each state applies.
- **Page states** (§13, §16): state-transition tables per domain lifecycle, plus 20 concrete browser-acceptance scenarios describing exactly what must be visible in each state.
- **Action labels**: every primary/secondary action's exact label text used throughout this document (e.g. "Review and confirm," "Generate assessment," "Choose a Task"/"Choose a Version," "Open Intent Workspace") -- Step 7C-0D should reuse these verbatim rather than re-inventing copy.
- **Disclosure behaviour** (§9's Alignment sequence, `14_...md` §11 reaffirmed): the segmented-switch pattern for role perspectives, collapsed-by-default history/compatibility sections, and the ON_DEMAND Evidence pattern -- ready for spatial placement.
- **Mutation outcomes** (§14): exact scoped-refresh/navigation table per mutation -- Step 7C-0D can lay out *where* on the page each region lives without re-deciding *whether* it refreshes.
- **Data dependencies**: every real API/service call named throughout §8-§13, so Step 7C-0D's page layouts can be checked against exactly what data is actually available per region, not assumed.
- **Responsive interaction requirements**: none newly introduced by this document beyond `14_...md` §9.1's existing desktop/narrow-width Inbox behaviour -- Step 7C-0D should extend the same restrained-collapse pattern (not a redesign) to the other Tier-1 pages' narrow-width behaviour, which this document does not yet specify per-route.

**Step 7C-0D's job, not started here:** turn the above into spatial low-fidelity page structures (exact region placement, sizing, responsive breakpoints) and the final implementation brief (allowed files, exact route scope per batch, test list) -- this document deliberately stops at *sequence and contract*, never *layout*.

---

## 19. Validation

- `git diff --check`: run, see final report.
- No frontend or backend tests run -- no production code changed by this task.
