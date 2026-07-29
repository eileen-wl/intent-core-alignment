# ICAS Step 7C-0A — VFX Supervisor Task Model, Decision Hierarchy, and Workspace IA Options

**Status:** Owner-reviewed. Corrected below (§0). This document is the **option-analysis input**; its factual issues are corrected here and its open decisions are **resolved and locked** by `14_STEP_7C0B_VFX_WORKSPACE_LOCKED_IA_AND_IMPLEMENTATION_PLAN.md`. Where the two disagree, document 14 governs.
**Scope:** Repository-grounded analysis preceding VFX Workspace implementation. No production UI, routes, backend, or contract changes are made by this document.
**Depends on:** `03_STEP_7A2_...md`, `04_STEP_7A3_...md`, `05_STEP_7A4_...md`, `06_STEP_7_LOCKED_SOURCE_OF_TRUTH.md`, `10_FTRACK_ENTRY_AND_IA_AMENDMENT.md`, `11_STEP_7B3_...md`, `12_STEP_7B3_...md`

---

## 0. Corrections made during Step 7C-0B review

This document's option analysis (§§1-18 below) is preserved as originally written except for the corrections in this section, applied after owner review. Read this section first; it overrides the specific claims named below wherever they appear later in the document.

1. **`VersionPage.tsx` does not contain Cross-role Assessment.** §3.10 originally listed "Cross-role Assessment generation entry point" as part of `VersionPage.tsx`'s implemented content. This was wrong. `VersionPage.tsx` contains AlignmentAssessment generation and Accept/Reject, VFX Supervisor Agent review, Artist Agent guidance, ReviewNotes, and Version context -- and nothing else. Cross-role Assessment, Intent Signal, and Re-anchor Proposal live exclusively in the legacy `ShotAnchorPage.tsx` flow today. (Verified by grep: `VersionPage.tsx` has zero matches for `CrossRoleAssessment`/`IntentSignal`/`ReAnchorProposal`; `ShotAnchorPage.tsx` has 24.)
2. **The VFX workflow is not "implemented end-to-end" as a product experience.** §1 and §2's framing overstated this. The corrected conclusion: the repository already contains most of the required persisted domain capabilities and engineering validation paths, but the final VFX role workflow is not implemented end-to-end as a role-specific product experience. Step 7C requires real IA redesign, interaction redesign, role-specific data orchestration, fixed-session identity integration, extraction from the monolithic engineering pages, scoped loading and mutation refresh, honest error/permission/historical states, and real role routes consuming the existing domain model -- not merely visual restyling of what already exists.
3. **`ShotAnchorPage.tsx` is a monolithic multi-role engineering and regression surface, not the new workspace's architecture.** It is a functional reference and compatibility surface -- proof that the underlying domain workflow works end-to-end at the API level, and a safety net during migration -- not a template to copy sections out of, and not the component or data-loading architecture for the new role workspaces. Wherever §3 below marks a task **CI** ("currently implemented"), read this as "present in the legacy engineering page and its backing API," not "present in a role-specific product surface."
4. **No persisted D1 Demo data exists.** §7's Guided Demo entry analysis assumed `D1 Demo Project` / `Shot 010` / `Compositing Review` / `D1_STEP3_VFX_REVIEW_001` were "known, fixed" ids the page could call directly. Repository-wide search found no seed or bootstrap script anywhere in `apps/api`, and no backend test references these names -- they exist only as static display copy in `apps/web/src/app/demo/DemoEntryPage.tsx` and in documentation. This is a real implementation gap, resolved in `14_...md` §8, not a detail the Demo entry path can assume away.

---

## 1. Executive conclusion

**Corrected per §0.2:** the repository already contains most of the required persisted domain capabilities and engineering validation paths for the VFX Supervisor workflow -- as backend services, persisted domain rows, and a working (if visually undifferentiated) engineering frontend at `apps/web/src/app/shots/[shotId]/ShotAnchorPage.tsx` (3,274 lines) and its Version page. But the final VFX role workflow is **not** implemented end-to-end as a role-specific product experience: Step 7C requires real IA redesign, interaction redesign, role-specific data orchestration, fixed-session identity integration, extraction from the monolithic engineering pages, scoped loading and mutation refresh, honest error/permission/historical states, and real role routes consuming the existing domain model. This is substantially more than visual restyling, even though little of it requires new backend capability. The two genuine backend gaps identified are (a) no backend aggregation for "which Shots need attention" across more than one Shot, and (b) thin per-object ftrack linkage/sync detail beyond the `source: manual | ftrack` field already on every production-context Read model -- see `14_...md` §6 for a third, related gap found during 7C-0B review: no persisted D1 Demo scenario data.

The `/dev/semantic-components` gallery (Step 7B-3) is confirmed, per the owner's framing, as **not** the VFX Workspace design -- it is a component inventory. This document derives the actual workspace design from the human work and the real domain model instead.

**Recommendation (not locked):** Alternative A -- *Inbox → dedicated contextual workspace*, using the already-locked `03_STEP_7A2_...md` route family, with Alternative C's *task-rail* concept adopted as the Shot Overview page's primary content pattern (a short, derived "what needs doing on this Shot" list replacing a flat information dump). See §10.

---

## 2. Repository-grounded capability summary

Inspected without editing: `apps/api/src/intent_core_api/{intent,versions_and_feedback,production_context,integrations,ops}/router.py`, `main.py`; `apps/web/src/lib/api.ts` and `api-client.ts`; `packages/contracts/ts/src/generated/api.ts`; `apps/web/src/app/shots/[shotId]/ShotAnchorPage.tsx` and its Version page; `apps/web/src/app/vfx/*`; `apps/web/src/design/shell/*` and `design/semantic/*`; `docs/ROLE_PERMISSIONS.md`.

Headline findings:

- **Every object named in this task's inspection list is a real, persisted, API-reachable row today**: Core Anchor / Core Anchor Revision, HumanGate, Decision, CrossRoleAssessment, ReAnchorProposal, IntentSignal, ContextSnapshot, AgentRun, Version, ReviewNote, Project, Shot, Task, plus `SyncCursorRead` and `WritebackRecordRead` for ftrack.
- **Two decision-producing pathways exist for Version-scoped review, not one.** `AlignmentAssessment` (Step 4b/4c, Core Agent capability `alignment_assessment`, already live with Accept/Reject buttons in `VersionPage.tsx`, producing a `DecisionRead` with `decision_type="accept_alignment_assessment"`) is older and narrower than `CrossRoleAssessment` (Step 6, richer, produces the required `IntentSignal` and optional `ReAnchorProposal`, has **no** accept/reject action of its own). Both are real and tested. See §16.
- **`GET /re-anchor-proposals/{id}` and `GET /intent-signals/{id}` exist on the backend** as standalone fetch-by-id endpoints, but `apps/web/src/lib/api.ts` does not wrap them -- today the frontend only ever receives these nested inside a `CrossRoleAssessmentRead`. `FRONTEND_INTEGRATION`, not a backend gap.
- **`GET /shots` and `GET /tasks` return every row in the system, unfiltered** -- no `project_id`/`shot_id` query parameter exists on either endpoint. The existing `listTasksForShot()` helper in `api.ts` already establishes the repository's own precedent for handling this: fetch the full list, filter client-side. This is honest and workable at portfolio scale; it is *not* a substitute for a real "Shots requiring attention" computation (see next point).
- **No endpoint answers "which Shots need attention."** Determining that requires walking Shot → Task → Version → `CrossRoleAssessmentRead.intent_signal` per Shot -- there is no read-model or aggregation for it. This is the single largest capability gap blocking a real, multi-Shot VFX Alignment Inbox.
- **No endpoint resolves a `WritebackRecordRead` from the entity it concerns.** `DecisionRead.write_back_requested` is a boolean with no forward link; `GET /writeback-records/{id}` requires already knowing the write-back record's own id. Object-level "has controlled write-back happened for this Anchor confirmation" cannot currently be looked up starting from the Anchor/Decision side.
- **`ShotAnchorPage.tsx` already implements**, and has passing tests for: Intent Brief listing, Intent Decomposition generation, Context Reconstruction generation, Core Anchor draft creation/edit/semantic-collection editing, Core Anchor HumanGate confirm/reject, Execution Anchor HumanGate (read-only from VFX's side), CG Supervisor Review display, Cross-role Assessment generation/display/history, Intent Signal card, Re-anchor Proposal card, Evidence references via `AgentProvenanceDetails.tsx`. **Corrected per §0.3:** this is a functional reference and compatibility surface proving the underlying domain workflow works end-to-end at the API level -- it is not the component architecture or data-loading architecture the new role-specific Workspace should copy sections out of.
- `/vfx` currently renders `VfxWorkspacePage.tsx`: `AppShell` + `Breadcrumbs` + `PageHeader("Alignment Inbox")` + a static placeholder Panel. No data is fetched. This is the confirmed starting point.
- The Step 7B-3 semantic component families (`design/semantic/intent-signal|authority|evidence|ftrack`) are visually refined (Step 7B-3 visual pass) but **have never been given real data** -- every prop they've received so far is a `/dev`-only fixture.

---

## 3. VFX task model

Grounded in the domain, not in existing component names. Each task states what is **currently implemented (CI)**, **partially implemented (PI)**, **planned Step 7 presentation (P7)**, or **deferred Step 8 (D8)**. Per §0.3, **CI means present in the legacy engineering surface (`ShotAnchorPage.tsx`/`VersionPage.tsx`) and its backing API** -- not present in a role-specific product surface. Building the actual VFX Workspace page for a CI task is still real frontend work (new components, new data orchestration, new interaction), even though it requires no new backend capability.

### 3.1 Review Shots that require attention -- **PI**

- **Trigger:** entering the VFX workspace with unresolved attention somewhere in the Supervisor's Shots.
- **Object in context:** Project / Shot (plural, unresolved).
- **Question:** "Which of my Shots need me right now, and why?"
- **Information required:** Shot identity, latest `IntentSignalRead.attention_level` per Shot (via its latest Task/Version/CrossRoleAssessment).
- **Authorised action:** none yet -- this is a triage/navigation task, not a decision.
- **Resulting record:** none.
- **Agent contribution:** the `IntentSignal` itself is Core Agent-derived (deterministically, not model-generated) per Shot, but nothing aggregates it across Shots.
- **Evidence required:** none at this level (evidence belongs to the Shot-level review).
- **Completion condition:** supervisor picks a Shot to open.
- **Next step:** Shot Overview (§3.3).
- **Grounding:** `GET /shots` exists (unfiltered); no per-Shot Signal join exists. **Gap:** SMALL_BACKEND_GAP for a real cross-Shot inbox; workable today only for a small, explicitly-known Shot set (e.g. the Demo's one Shot).

### 3.2 Understand why cross-role interpretation has diverged -- **CI** (data), **P7** (presentation)

- **Trigger:** an existing `CrossRoleAssessmentRead` for the Shot's current Task/Version.
- **Object:** Shot, Task, Version, the Assessment itself.
- **Question:** "Where do VFX, CG, and Artist readings disagree, and why does it matter?"
- **Information required:** `RolePerspectiveRead` ×3 (current_position, protected_intent, main_concerns, evidence), `CrossRoleFinding[]` for agreements/tensions/local-optimum risks/unresolved dependencies.
- **Authorised action:** read-only inspection; the only affirmative action available is "Generate new assessment" (§3.7).
- **Resulting record:** none (already persisted).
- **Agent contribution:** Core Agent `cross_role_assessment` capability, already generated.
- **Evidence:** `CrossRoleEvidenceReference[]` on every finding/perspective.
- **Completion:** supervisor forms a judgement on whether coordination or a new Core Anchor revision is warranted.
- **Next step:** either informal coordination (no persisted object) or opening the Intent Workspace (§3.4).
- **Grounding:** `GET /cross-role-assessments/{id}`, `GET /intent/versions/{versionId}/cross-role-assessments?task_id=` both exist; `listCrossRoleAssessmentsForVersionAndTask` already wired client-side and used in `ShotAnchorPage.tsx`.

### 3.3 Reviewing the current confirmed Core Anchor -- **CI**

- **Trigger:** opening a Shot.
- **Object:** Shot, `CoreAnchorRead.active_revision_id` → `CoreAnchorRevisionRead` (`status="confirmed"`).
- **Question:** "What is the shared creative intent right now?"
- **Information required:** scalar fields (shot_objective, emotional_tone, visual_focus, rhythm_intensity, character_relationship, narrative_priority, core_summary), semantic collections (constraints, variation_zones, drift_risks, references, open_questions), confirming role/actor/timestamp.
- **Authorised action:** none at this step beyond reading; "Create new revision" starts §3.4.
- **Resulting record:** none.
- **Agent contribution:** none for a confirmed revision (it is, by definition, human-confirmed).
- **Evidence:** the revision's own semantic collections *are* the evidence; no separate drawer needed here.
- **Completion:** supervisor understands current intent.
- **Next step:** either leave, or start a new revision.
- **Grounding:** `getCoreAnchor`, `listCoreAnchorRevisions` wired and exercised by `ShotAnchorPage.tsx`'s `ConfirmedAnchorCard`.

### 3.4 Reviewing a proposed Core Anchor revision (draft) -- **CI**

- **Trigger:** a `CoreAnchorRevisionRead` with `status="draft"` exists (from manual creation, from an Intent Decomposition, or in response to a Re-anchor Proposal).
- **Object:** the draft revision.
- **Question:** "What is being proposed, and by what authority?"
- **Information required:** draft's own fields, `created_by_actor_kind`/`created_by_human_role`/`created_by_agent_type` (so the VFX Supervisor can tell whether a human or the Core Agent authored the draft text -- both are possible; only a human can *confirm* it).
- **Authorised action:** edit the draft (`updateCoreAnchorRevision`), semantic-collection add/edit/remove/reorder.
- **Resulting record:** updated `CoreAnchorRevisionRead` (still draft).
- **Agent contribution:** may have authored the initial draft (`createCoreAnchorDraftFromDecomposition`) -- advisory only, edit and confirm remain human.
- **Evidence:** `source_intent_decomposition_id` link if Agent-originated.
- **Completion:** draft is ready for HumanGate submission.
- **Next step:** HumanGate comparison (§3.6).
- **Grounding:** `CoreAnchorGate` in `ShotAnchorPage.tsx`, fully tested (add/edit/remove/reorder semantic items, blank-field validation, save/cancel).

### 3.5 Comparing current and proposed intent -- **CI** (functionally), **P7** (as a deliberate comparison layout)

- Currently `ShotAnchorPage.tsx` renders the confirmed Anchor and the draft editor as two stacked sections on one long page -- functionally a comparison, not visually one. `04_STEP_7A3_...md` §4 calls for a dedicated "Human authority panel" pattern (proposed vs. current + explicit difference summary). This is the clearest example of a task that is **data-complete today** but **presentation-incomplete** relative to the approved workflow doc.

### 3.6 Completing a HumanGate decision -- **CI**

- **Trigger:** a draft revision has been submitted; `HumanGateRead` exists with `status="pending"`.
- **Object:** the `HumanGateRead` row, `gate_type="core_anchor_confirmation"`.
- **Question:** "Do I confirm this as the new shared intent, or reject it?"
- **Information required:** full comparison (§3.5), evidence, rationale field (human-entered).
- **Authorised action:** `confirmCoreAnchorRevision` or `rejectCoreAnchorRevision` -- **VFX Supervisor only**, enforced server-side (per `docs/ROLE_PERMISSIONS.md` §2, §5).
- **Resulting record:** `HumanGateRead.status` becomes `confirmed`/`rejected`; `DecisionRead` (`decision_type="confirm_core_anchor"`/`"reject_core_anchor"`) is created; on confirm, the revision becomes the Shot's active revision and the previous one becomes historical (never overwritten).
- **Agent contribution:** none -- this is the one point in the whole model where Agent involvement is architecturally zero.
- **Evidence:** the full draft-vs-confirmed comparison already shown.
- **Completion:** gate resolved.
- **Next step:** return to Shot Overview; historical revision now visible in history.
- **Grounding:** `CoreAnchorGate`/`HumanGateDetails` in `ShotAnchorPage.tsx`; backend `intent/core_anchor_service.py` lines ~554/649.

### 3.7 Reviewing a Cross-role Assessment -- **CI** (same grounding as §3.2)

Generation prerequisites (confirmed Core Anchor, confirmed Execution Anchor, latest VFX/CG/Artist outputs, explicit Task+Version) are enforced server-side and already exercised by ~150+ backend tests (Step 6 work). "Generate new assessment" is VFX-only.

### 3.8 Inspecting a Re-anchor Proposal -- **CI**

- Bundled in `CrossRoleAssessmentRead.re_anchor_proposal` (nullable). Contains `reason_for_consideration`, `preserved_elements`, `proposed_fields[]` (each with `current_problem`/`proposed_direction`/`why_it_may_help`/evidence), `adoption_risks`, `questions_for_human_vfx_supervisor`. **No `Apply` action exists anywhere in the codebase** -- confirmed absent, matching the locked rule. The only next step is "Open Intent Workspace" (a plain navigation action, not a mutation).

### 3.9 Reviewing the latest derived Intent Signal -- **CI**

- Bundled in `CrossRoleAssessmentRead.intent_signal` (required, non-null whenever an Assessment exists). `GET /intent-signals/{id}` exists standalone but is unwired client-side (`FRONTEND_INTEGRATION` only, needed if a bookmarkable Signal deep-link is ever wanted). **Naming note for §16:** `ShotAnchorPage.tsx` already has its own local `IntentSignalCard` function (line ~2815) distinct from the new `design/semantic/intent-signal/IntentSignalCard` component built in Step 7B-3 -- same name, different component, both real.

### 3.10 Inspecting Version and ReviewNote context -- **CI**

**Corrected per §0.1:** implemented in `VersionPage.tsx`: Version facts, ReviewNotes, AlignmentAssessment generation and Accept/Reject, VFX Supervisor Agent review (advisory, no accept/reject), Artist Agent guidance. `VersionPage.tsx` does **not** contain Cross-role Assessment, Intent Signal, or Re-anchor Proposal, and does not contain CG Supervisor Review (CG's own review capability is generated/displayed from the CG side, not surfaced here) -- those remain exclusive to `ShotAnchorPage.tsx` (§3.2, §3.7-3.9).

### 3.11 Reviewing Evidence and Provenance -- **CI** (data + one working pattern), **FRONTEND_INTEGRATION** (for the new semantic components)

`AgentProvenanceDetails.tsx` already fetches `AgentRunRead`/`ContextSnapshotRead` by id and renders them inline in `ShotAnchorPage.tsx` today. The Step 7B-3 `EvidenceProvenanceDrawer` family duplicates this concern with a more refined visual treatment but has never been wired to a real `agentRunId`/`contextSnapshotId` -- adopting it in the new Workspace is a genuine, bounded integration task, not new capability.

### 3.12 Understanding ftrack object linkage -- **PI**

Object-level `source: "manual" | "ftrack"` is real and already on `ProjectRead`/`ShotRead`/`TaskRead`/`VersionRead`/`ReviewNoteRead`. Anything past that (external id, last-synced timestamp, write-back status *for that specific object*) is unavailable from the object side today (see §2). `IntegrationAvailabilityNotice`/`FtrackSyncSummary` (Step 7B-3) are ready to consume real `WritebackRecordRead`/`SyncCursorRead` **once a caller can obtain the right id** -- currently only possible if the id is already known out-of-band.

### 3.13 Viewing historical or superseded Decisions -- **CI** (scoped), **not implemented** (Shot-wide)

`listDecisionsForRevision(revisionId)` and `listDecisionsForAssessment(assessmentId)` exist; there is no "all Decisions for this Shot" endpoint. This is actually a *good* constraint: it naturally supports `10_FTRACK_ENTRY_AND_IA_AMENDMENT.md`'s decision to distribute Decision visibility into Intent/Alignment/Activity rather than a single global page -- the backend shape and the locked IA agree without any change needed.

---

## 4. Decision hierarchy

Highest to lowest importance. Columns: Owner / Agent advisory? / Actionable now? / Informational only? / HumanGate? / Persisted? / May supersede? / Visible by default?

| # | Decision / review point | Owner | Agent advisory | Actionable now | Informational only | HumanGate | Persisted | May supersede | Default visibility |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Core Anchor HumanGate** (confirm/reject a draft) | Human VFX Supervisor | Yes (draft may be Agent-assisted) | Yes | No -- primary action | Yes | Yes | Yes (new confirmed revision supersedes) | **Primary**, always when pending |
| 2 | **Latest Intent Signal** | n/a (deterministic derivation) | n/a | No direct action | Yes (routes attention) | No | Yes | Chronologically, by newer Assessment | High, but supporting -- never competes with #1 |
| 3 | **Re-anchor Proposal** | n/a (Agent output) | Yes, fully advisory | No (`Open Intent Workspace` only) | Yes | No | Yes, immutable | No (stands alone per Assessment) | Secondary, only when present |
| 4 | **Cross-role Assessment** (as a whole) | n/a (Agent output) | Yes | "Generate new" only | Yes | No | Yes, immutable | Historically, by newer Assessment | Summary by default, full on demand |
| 5 | **AlignmentAssessment Accept/Reject** (legacy Version-level) | Human VFX Supervisor | Yes | Yes | No | No (direct accept/reject, no `HumanGateRead` row) | Yes | Per-Version, independent | Secondary -- lives on Version Review, not the primary Alignment flow (see §16) |
| 6 | **VFX Supervisor Agent review** (`creative_review`) | n/a (Agent output) | Yes | No action (read-only) | Yes | No | Yes, immutable | No | Secondary, on Version Review |
| 7 | **Execution Anchor** (from VFX's seat) | Human CG Supervisor (not VFX) | n/a | No -- VFX is read-only here | Yes | N/A for VFX | Yes | Yes (CG-owned) | Contextual only |
| 8 | **Evidence / Provenance / AgentRun / ContextSnapshot** | n/a | n/a | No | Yes | No | Yes | No | On demand only |
| 9 | **Historical Core Anchor revisions, past Decisions, past Assessments** | n/a | n/a | No | Yes | No | Yes | Already superseded | Collapsed by default |
| 10 | **ftrack linkage / sync / system metadata** | n/a | n/a | No | Yes | No | Partial (see §2 gap) | No | Secondary System destination only |

No two rows are given equal dashboard weight -- this is the direct rebuttal to the "equally prominent dashboard card" anti-pattern flagged in the brief.

---

## 5. Four-layer information-priority model

### Layer 1 -- Immediate orientation (always visible)

- Shot name (never a raw UUID as the primary label).
- Current Core Anchor state: none / draft pending / confirmed (one word, not a raw `status` enum).
- Latest Intent Signal, **role-worded** ("Human review required" for VFX), with its level.
- One-line "why": the Signal's `summary`, or the single highest-priority driver.
- The one primary next action (row 1 of §4, if pending; otherwise "Review assessment" or "Nothing pending").

### Layer 2 -- Decision support (visible in the main workspace body while a decision is live; otherwise below-the-fold or a contextual side panel)

- Draft-vs-confirmed Core Anchor comparison (§3.5).
- Cross-role Assessment role perspectives, tensions, local-optimum risks relevant to the pending decision.
- Re-anchor Proposal, if present.
- HumanGate rationale field.
- AlignmentAssessment state, on the Version Review page specifically (not the Shot Overview).

### Layer 3 -- Validation and traceability (behind a disclosure, e.g. `EvidenceProvenanceDrawer`, or a separate Activity/History surface)

- `CrossRoleEvidenceReference[]`, `AgentRunRead`, `ContextSnapshotRead`.
- Historical Core Anchor revisions.
- Historical Cross-role Assessments (`CrossRoleAssessmentHistory` pattern already proven in `ShotAnchorPage.tsx`).
- Past Decisions scoped to the current revision/assessment.

### Layer 4 -- System context (secondary System/Integrations destination only, never inline on a decision screen)

- ftrack `source` badge: **inline, Layer 1-adjacent** as a small badge only (its mere presence is orientation-relevant -- "did this come from ftrack" -- but its *detail* is Layer 4).
- Sync status, write-back status, technical identifiers (`FtrackSyncSummary`, `IntegrationAvailabilityNotice`).
- Raw UUIDs, `ContextSnapshot.payload` (never shown at all, per the existing 7B-3 rule).

This model is the explicit mechanism for reducing simultaneous information: a screen built against it shows Layer 1 always, Layer 2 only while relevant, Layers 3-4 never unless requested.

---

## 6. Action hierarchy

- **One primary action** per screen state, always the top row of §4 that is currently actionable (Confirm/Reject when a gate is pending; "Generate new assessment" when prerequisites are met and none exists yet; otherwise no primary action is forced -- an empty/attention-free state is allowed to have no button at all).
- **Contextual secondary actions:** "Open Intent Workspace" (from a Re-anchor Proposal), "View full assessment," "Create new revision," "Expand evidence." Never styled with the same visual weight as the primary action.
- **Navigation actions:** sidebar items, breadcrumbs, contextual tabs -- structurally distinct from both of the above (already established by the Step 7B-2 `RoleSidebar`/`Breadcrumbs`/`ContextTabs` components).
- **Inspection-only disclosures:** Evidence/Provenance drawer, historical-record expansion -- native `<details>`, never a button implying mutation.
- **Unavailable / read-only states:** Execution Anchor from VFX's seat (`ReadOnlyAuthorityNotice`), any ftrack write-back/sync/launch control (must not exist as a control at all, per the locked boundary).

Preserved explicitly: Human VFX ownership of the Core Anchor (only VFX can reach Confirm/Reject); Agent advisory-only behaviour (no Agent output ever renders next to a mutation control it could trigger itself); explicit HumanGate confirmation (no auto-confirm path exists or is proposed); Re-anchor Proposal has no Apply action (confirmed absent in the codebase, §3.8); controlled write-back stays a Step 8 boundary (no control proposed); no fabricated ftrack sync/launch action anywhere in this document's recommendations.

---

## 7. Entry-context analysis

### Guided Demo entry

The user arrives at `/vfx` already carrying the `icas_demo_role=vfx_supervisor` session cookie (Step 7B-2), as "Maya Chen." **Corrected per §0.4:** the D1 Demo scenario (`D1 Demo Project` / `Shot 010` / `Compositing Review` / `D1_STEP3_VFX_REVIEW_001`) is not yet a "known, fixed" set of database ids -- no seed or bootstrap script persists it anywhere in the repository today; it exists only as static display copy on `/demo`. The original framing here (that the missing cross-Shot aggregation capability is "irrelevant for this entry path" because the ids are already known) does not hold until that gap is closed. See `14_...md` §8 for the resolved Demo scenario resolver and the corrected guided-entry flow (`/demo` resolves the real persisted D1 context server-side and redirects straight to `/vfx/shots/:shotId`, rather than the Inbox depending on a hardcoded id). Once resolved, the underlying principle here still holds: the Demo should use the same real API calls (`getCoreAnchor`, `listCoreAnchorRevisions`, `listCrossRoleAssessmentsForVersionAndTask`, etc.) a real multi-Shot flow would use for one row -- a seeded fallback (§11) is for presentation stability only, never a separate mock system.

### Future ftrack entry (Step 8, not implemented)

Desired landing behaviour, recorded but not built: the launch context should carry at minimum a Shot id (ideally Task/Version too); ICAS should resolve directly to that Shot's Overview (or, if a HumanGate is already pending there, straight to the Intent Workspace). This is the entry path Alternative C's task-rail concept fits best (§9).

### Standalone ICAS entry

The user opens `/vfx` cold and must find "what needs attention" themselves. Given the aggregation gap, this **cannot yet be a computed, trustworthy multi-Shot list** at real scale -- honest options are (a) a short, explicitly-scoped list (the Shots the current session/actor has touched, or all Shots if the total count stays small, which is true at portfolio scale), or (b) requiring the user to pick a Shot from `/vfx/projects` first. A **list-first Inbox leading into a dedicated Shot workspace** (not a persistent split-view -- see §9) fits best today: the "list" side has genuinely little to show without the aggregation capability, so permanently reserving half the screen for it is premature.

---

## 8. Workspace IA alternatives

### Alternative A -- Inbox → dedicated contextual workspace

- **Page structure:** `/vfx` (Alignment Inbox) → `/vfx/shots/:shotId` (Overview) → `/vfx/shots/:shotId/intent` | `/versions/:versionId` | `/alignment` | `/activity`, each a separate route.
- **Navigation model:** fixed role sidebar (already built) + breadcrumbs + contextual route-backed tabs on the Shot -- exactly the already-locked `03_STEP_7A2_...md`/`06_...md` route family.
- **Information hierarchy:** one primary concern per page (§5's Layer 1/2 change per route; Layer 3/4 always behind disclosure).
- **Primary interaction:** select from the Inbox, drill into the page matching the current concern.
- **Strengths:** matches the already-approved routes exactly; each page has one job (`03_STEP_7A2_...md` §3.4); scales cleanly as Shot/Task/Version counts grow; every route maps 1:1 onto an already-wired granular API call.
- **Weaknesses:** more page loads for a first-time Demo reviewer; the Inbox needs *something* to show (§7 resolves this for Demo, not yet for standalone).
- **Fit with real data:** excellent -- no new aggregation required except the Inbox list itself.
- **ftrack-entry fit:** excellent -- any route is independently deep-linkable by id.
- **Cognitive load:** low per page.
- **Implementation complexity:** moderate; most of the "new" work is the Inbox list and re-presenting already-working `ShotAnchorPage.tsx`/`VersionPage.tsx` logic through the new Shell and semantic components.
- **Demo quality:** good, once the Inbox honestly shows the one Demo Shot.
- **Risks:** if the Inbox is left generic/empty, the whole alternative feels hollow on first load.

### Alternative B -- Persistent master-detail split view

- **Page structure:** one route, a permanent left list pane + a right detail pane that swaps content in place (parallel/intercepting routes or heavy client state).
- **Navigation model:** list selection drives detail content; no full page transition.
- **Information hierarchy:** must cram Overview + Intent + Alignment concerns into one detail pane unless further subdivided -- risks recreating the "too much on one screen" problem this whole exercise is meant to fix.
- **Primary interaction:** click a list row, detail updates.
- **Strengths:** fast switching for a supervisor triaging many Shots (classic inbox-app pattern).
- **Weaknesses:** the list pane is nearly empty at Demo/portfolio scale, permanently wasting half the screen; harder to deep-link cleanly to a specific sub-concern; would require **reopening the already-locked separate-route IA** in `03_STEP_7A2_...md`/`06_...md`, which this task is explicitly not authorised to do.
- **Fit with real data:** fine at the list level, awkward at the detail level.
- **ftrack-entry fit:** workable but requires more routing engineering to make the detail pane resolvable from a raw URL.
- **Cognitive load:** low once learned, confusing on first visit (unclear what's "selected").
- **Implementation complexity:** higher than A.
- **Demo quality:** weaker narrative for a reviewer seeing the product for the first time.
- **Risks:** conflicts with locked architecture; not recommended without an explicit re-approval this task is not seeking.

### Alternative C -- Object-centred Shot workspace with a task/action rail

- **Page structure:** enter directly at `/vfx/shots/:shotId`; a compact header (identity + Signal + primary action) plus a short, **derived** rail of 1-3 concrete next actions specific to this Shot ("Confirm Core Anchor revision," "Review Cross-role Assessment"); selecting a rail item switches the main pane's content in place rather than routing to a wholly separate page.
- **Navigation model:** rail replaces (or supplements) generic tabs; content switches within the page.
- **Information hierarchy:** naturally Layer-1-then-Layer-2, since the rail *is* a Layer-1 orientation device that always names the next Layer-2 concern.
- **Primary interaction:** pick the top-of-rail item (usually already pre-selected as "the" thing to do).
- **Strengths:** the most literal embodiment of "task and next action lead" and "one dominant work focus at a time"; best fit for the future ftrack-entry path (§7), since ftrack already supplies exact Shot/Task/Version context and this alternative lands the user straight into "what to do about it."
- **Weaknesses:** does not solve the cross-Shot "which Shot needs me" problem at all -- it is a complement to an Inbox, not a replacement; if implemented as in-page section switching rather than routes, it blurs the already-locked Intent-Workspace-vs-Alignment-Workspace route separation unless the rail items are themselves just links to those existing separate routes (in which case it converges with Alternative A plus a smarter Overview page).
- **Fit with real data:** excellent, same objects as A, reframed.
- **ftrack-entry fit:** best of the three.
- **Cognitive load:** low.
- **Implementation complexity:** moderate-to-high -- requires a genuinely new small piece of client logic ("given this Shot's current Anchor/Signal/Gate state, what are the 1-3 relevant next actions"), which does not exist anywhere in the repository today.
- **Demo quality:** strong -- a rail literally narrates "here is what to do next."
- **Risks:** low if implemented as a smarter Overview page inside Alternative A's route family (recommended synthesis, §10); higher if implemented as a route-collapsing alternative to A.

*(A fourth family, a decision-first work queue -- listing pending decisions directly rather than Shots -- was considered and set aside: at portfolio scale (1-2 pending decisions total) it reads as an enterprise ticketing pattern the brief explicitly asks to avoid, and it depends on the same missing cross-Shot aggregation as Alternative A's Inbox with no offsetting benefit.)*

---

## 9. Qualitative decision matrix

No numeric scoring -- `Strong` / `Moderate` / `Weak`, grounded in the reasoning above.

| Criterion | A: Inbox → workspace | B: Master-detail split | C: Object-centred + rail |
|---|---|---|---|
| Task clarity | Strong | Moderate | Strong |
| Cognitive load | Strong (low per page) | Moderate | Strong |
| Authority clarity | Strong | Moderate | Strong |
| Evidence accessibility | Strong (disclosure pattern fits naturally) | Moderate | Strong |
| Fit with real system data | Strong | Moderate | Strong |
| ftrack-entry compatibility | Strong | Moderate | **Strongest** |
| Implementation feasibility | Strong (matches locked routes) | Weak (reopens locked IA) | Moderate |
| Demonstration narrative | Moderate (needs a populated Inbox) | Weak at Demo scale | Strong |
| Extensibility to CG/Artist without forcing identical layouts | Strong (each role already has its own route family) | Moderate | Strong |

---

## 10. Recommended alternative (not locked)

**Alternative A** as the structural backbone (it is the only option that does not require reopening the already-locked route architecture), with **Alternative C's task-rail concept adopted inside the Shot Overview page** (`/vfx/shots/:shotId`) as its primary content pattern, replacing a flat information dump with a short, derived "what needs doing on this Shot" list whose top item is the same primary action identified in §4/§6. This satisfies the ftrack-entry strength of C (§7) without reopening any locked route decision, and gives the Demo (§7, §11) a genuine narrative anchor.

This is a recommendation for Step 7C-0B to evaluate and the owner to approve -- **it is not adopted or implemented by this document.**

---

## 11. Proposed page inventory

| Route | Purpose | Object | Primary question | Primary action | Default-visible | Secondary | Data source | Tier | Disposition |
|---|---|---|---|---|---|---|---|---|---|
| `/vfx` | Orientation entry | Shot(s) | "What needs me?" | Open a Shot | Short Shot list + top Signal per Shot | -- | `GET /shots` (filtered/known-set), per-Shot Signal (gap, §2) | 1 | Keep |
| `/vfx/projects` | Browse by Project | Project(s) | "What Projects exist?" | Open a Project | Project list | -- | `GET /projects` (unwired client-side yet) | 2 | Keep, de-prioritise (single-Project Demo doesn't need it) |
| `/vfx/projects/:projectId` | Project-scoped Shot browse | Project | "What Shots are in this Project?" | Open a Shot | Shot list (client-filtered) | -- | `GET /shots` filtered client-side | 2 | Keep, de-prioritise |
| `/vfx/shots/:shotId` | Shot Overview + task rail | Shot | "What's the state, what do I do?" | Top rail item | Layer 1 + derived task rail | Layer 2 summary | `getShot`, `getCoreAnchor`, latest Assessment | 1 | Keep, **enhance** (§10) |
| `/vfx/shots/:shotId/intent` | Core Anchor authority | Core Anchor / Revision | "Confirm or reject?" | Confirm / Reject | Draft-vs-confirmed comparison | History, evidence | `getCoreAnchor`, `listCoreAnchorRevisions`, HumanGate | 1 | Keep |
| `/vfx/shots/:shotId/versions` | Version collection | Task's Versions | "Which Version?" | Open a Version | Version list | -- | `listVersionsForShot` (client-filtered by Task) | 2 (planned) | Keep planned; degrade gracefully to a short list at Demo scale (1 Version) |
| `/vfx/shots/:shotId/versions/:versionId` | Version review | Version | "Is this Version aligned?" | Accept/Reject AlignmentAssessment (§16) | Version facts, ReviewNotes, VFX review | Evidence, history | `getVersion`, `listReviewNotesForVersion`, `listAssessmentsForVersion`, VFX review endpoints | 1 | Keep -- **AlignmentAssessment Accept/Reject belongs here**, not on Alignment |
| `/vfx/shots/:shotId/alignment` | Cross-role Alignment | Cross-role Assessment | "Where does interpretation diverge, and is a re-anchor needed?" | Generate new assessment / Open Intent Workspace | Signal, perspectives, tensions | Re-anchor Proposal, evidence, history | `listCrossRoleAssessmentsForVersionAndTask`, `generateCrossRoleAssessment` | 1 | Keep |
| `/vfx/shots/:shotId/activity` | Chronological record | Shot | "What happened, in order?" | none (inspection only) | Chronological Decisions/revisions/assessments | -- | Composed client-side from already-scoped Decision/revision/assessment endpoints | 2 | Keep -- absorbs the "Decisions" concern per the IA amendment |
| `/vfx/signals` | Cross-Shot Signal list | Signal(s) | "What's flagged across my Shots?" | Open supporting context | Signal list | -- | Same aggregation gap as `/vfx` | 2 | **Defer** -- would just re-show the single Demo Signal already visible on Alignment; do not build until the aggregation gap is closed (avoids the "same Signal, six times" anti-pattern) |
| `/vfx/integrations` | System/technical status | System | "Is ftrack healthy?" | none | `FtrackSyncSummary`, honest unavailable states | -- | `SyncCursorRead` (system-level only) | 2/3 | Keep, strictly secondary per `10_...md` §7 |

**Redundant/removed:** no standalone Decisions route (already correctly absent). **Newly flagged for deferral:** `/vfx/signals`, until the cross-Shot aggregation gap (§2) is closed -- building it earlier would violate the brief's own "no six simultaneous representations of the same Signal" principle.

---

## 12. Real data and capability mapping

| Screen region | Domain object | API / client source | Label | Missing field / capability | Truthful fallback |
|---|---|---|---|---|---|
| Inbox Shot list | `ShotRead` | `GET /shots` (`production_context/router.py`), unwired in `api.ts` | `FRONTEND_INTEGRATION` | none for the list itself | -- |
| Inbox "needs attention" per Shot | `IntentSignalRead` via `CrossRoleAssessmentRead` | no join exists | `SMALL_BACKEND_GAP` | Shot→latest-Signal read model | Show only Shots the caller already knows the Task/Version for (Demo); omit the rest rather than guess |
| Shot Overview identity + Core Anchor state | `ShotRead`, `CoreAnchorRead` | `getShot`, `getCoreAnchor` -- wired | `AVAILABLE_NOW` | none | -- |
| Task rail derivation | (derived client-side from HumanGate/Signal/Assessment state) | none exists | `FRONTEND_INTEGRATION` (new client logic, no backend change) | none | -- |
| Core Anchor draft/confirm/reject | `CoreAnchorRevisionRead`, `HumanGateRead`, `DecisionRead` | fully wired, exercised in `ShotAnchorPage.tsx` | `AVAILABLE_NOW` | none | -- |
| Cross-role Assessment + Signal + Proposal | `CrossRoleAssessmentRead` | `listCrossRoleAssessmentsForVersionAndTask`, `generateCrossRoleAssessment` -- wired | `AVAILABLE_NOW` | none | -- |
| Standalone Signal/Proposal deep-link | `IntentSignalRead`, `ReAnchorProposalRead` | `GET /intent-signals/{id}`, `GET /re-anchor-proposals/{id}` exist, unwired | `FRONTEND_INTEGRATION` | thin wrapper functions in `api.ts` | -- |
| Evidence / Provenance | `CrossRoleEvidenceReference`, `AgentRunRead`, `ContextSnapshotRead` | `getAgentRun`, `getContextSnapshot` -- wired; pattern proven in `AgentProvenanceDetails.tsx` | `AVAILABLE_NOW` (data), `FRONTEND_INTEGRATION` (wiring the new semantic components) | none | -- |
| AlignmentAssessment Accept/Reject | `AlignmentAssessmentRead`, `DecisionRead` | wired, exercised in `VersionPage.tsx` | `AVAILABLE_NOW` | none | -- |
| Object ftrack badge | `RecordSource` (`source` field) | already on `ShotRead`/`TaskRead`/`VersionRead`/`ReviewNoteRead` | `AVAILABLE_NOW` | none | -- |
| Object ftrack sync detail (per-object) | none | no per-object sync/external-id field on any Read model | `SMALL_BACKEND_GAP` | per-object last-synced/external-id | "Sync status unavailable" (already the Step 7B-3 component behaviour) |
| Object write-back status (per-object) | `WritebackRecordRead` | `GET /writeback-records/{id}` only, no entity-scoped lookup | `SMALL_BACKEND_GAP` | entity→writeback-record lookup | "Controlled write-back not requested" when no id is known |
| Real ftrack launch / identity / sync execution | -- | none | `STEP_8_FTRACK` | entire capability | Never simulated; no control rendered |
| Enterprise notification/assignment/SLA on any of the above | -- | none, and not wanted | `OUT_OF_SCOPE` | -- | -- |

No proposal in this document substitutes fake metrics for any of the `SMALL_BACKEND_GAP`/`STEP_8_FTRACK` rows -- each has an explicit truthful fallback instead.

---

## 13. Honest state model

| State | What the user sees | Action available | Must not be implied |
|---|---|---|---|
| Loading | `LoadingSkeleton` in place of the region being fetched | none | that data exists before it has loaded |
| No items requiring attention | Explicit "Nothing requires your attention right now" (EmptyState-family) | none forced | that the system is continuously watching (§Intent Signal honesty rule) |
| No successful Cross-role Assessment yet | "No current Intent Signal -- a successful Cross-role Assessment is required" (already the exact 7B-3 wording) | "Generate new assessment," if prerequisites met | that a Signal will appear automatically |
| Latest Intent Signal available | Role-worded conclusion + summary + drivers | "Open supporting context" | urgency at `low` attention (already handled, §12-of-7B3) |
| Agent generation failed | Compact failure row (already the 7B-3 `AgentRunReference`/`ErrorState` treatment), sanitised error only | Retry is a new "Generate" action, not an auto-retry | that the previous successful result was lost -- it remains available, historical |
| HumanGate pending | Draft-vs-confirmed comparison + Confirm/Reject | Confirm/Reject (VFX only) | that the draft is already in effect |
| HumanGate completed | Confirmed/rejected outcome, actor, timestamp, linked Decision | none (historical from this point) | that it can be silently re-opened |
| Historical / superseded record | `AuthorityLabel variant="historical"` marker, collapsed by default | Expand only | that it is current |
| Read-only / unauthorised | `PermissionState`/`ReadOnlyAuthorityNotice`, names the actual owning role | none | that the action doesn't exist at all elsewhere (it does, for the owning role) |
| ftrack linked | `FtrackLinkageBadge` "Linked to ftrack" | none | sync recency |
| Not linked | `FtrackLinkageBadge` "No linked ftrack entity" | none | that linkage will happen automatically |
| Sync information unavailable | "Sync status unavailable." | none | that sync failed (it may simply be unmeasured) |
| API error | `ErrorState` with the `describeError()`-mapped message (`api.ts`, already implemented: 401/403/404/409/502/network) | Retry (re-fetch), never silent fallback to stale data | that the underlying data is empty rather than unreachable |

No notification lifecycle (read/unread/acknowledge/dismiss/assign/resolve) appears anywhere in this table, matching the locked boundary.

---

## 14. Interaction and visual principles

Each principle is tied to the work it serves, not stated as styling alone:

- **Task and next action lead** → the Shot Overview's task rail (§10) exists specifically so the primary decision (§4 row 1, when pending) is the first thing read, not discovered by scrolling.
- **One dominant work focus at a time** → each route in §11 has exactly one primary question and one primary action; Layer 2 content only appears while that focus is live.
- **The current production object remains visible** → Shot/Task/Version identity is Layer 1, present on every route inside the Shot, never dropped when navigating between Intent/Alignment/Versions.
- **Intent Signal directs attention but does not become the whole page** → it occupies Layer 1 as a short conclusion + summary, with its full six-level detail (`IntentSignalDetail`) reserved for the Alignment route, never repeated identically across the Overview, Intent, and Alignment routes at once.
- **Agent interpretation appears beside the human decision it supports** → the VFX Supervisor Agent review sits on the same Version Review page as the AlignmentAssessment Accept/Reject it informs, not on a separate "Agent outputs" page.
- **Authority is contextual, not a standalone explanatory gallery** → `AuthorityBoundary`/`HumanDecisionNotice`/`AgentAdvisoryNotice` appear attached to the specific Decision or output they describe (e.g. inline on the HumanGate panel), never as a generic "how authority works" section.
- **Evidence and Provenance are available on demand** → `EvidenceProvenanceDrawer`'s collapsed-by-default disclosure is the only place evidence appears; it is never pre-expanded on page load.
- **ftrack linkage remains secondary system context** → the badge is Layer-1-adjacent (orientation only); everything else about ftrack lives on `/vfx/integrations` per §11.
- **Technical IDs are secondary** → already enforced by the 7B-3 `SourceReference` label-first, monospace-id-second treatment; the new Workspace reuses it rather than reinventing it.
- **History is collapsed or placed on a separate surface** → `/vfx/shots/:shotId/activity` and the existing `CrossRoleAssessmentHistory` collapsed-by-default pattern.
- **No repeated card grid, no six simultaneous representations of the same Signal, no equal-weight dashboard tiles** → directly enforced by §4's decision hierarchy and §5's four layers; no route in §11 shows more than one Signal presentation level at once.
- **No fake metrics, no fake integration controls, no enterprise administration patterns** → directly enforced by §12's fallback column and §6's "unavailable" action category.

---

## 15. D1 VFX walkthrough

Using only the approved D1 scenario and real domain concepts. **[REAL]** marks what the current repository data already supports; **[SEEDED FALLBACK]** marks where stable seeded data would carry the presentation if live Agent generation is unavailable at demo time -- the fallback still flows through the same domain model, the same `CoreAnchorRevisionRead`/`CrossRoleAssessmentRead` shapes, and the same API paths, never a separate mock.

1. **Entry [REAL]** -- Maya Chen enters via `/demo` → "Start guided demonstration" → lands on `/vfx`, `icas_demo_role` cookie set, middleware-enforced (Step 7B-2, unchanged by this document).
2. **Orientation [REAL]** -- `/vfx` resolves the one known D1 Shot (`Shot 010 — Final confrontation`) via `getShot`; Layer 1 shows the Shot name, current Core Anchor state, and the latest Intent Signal's VFX wording ("Human review required").
3. **Attention trigger [REAL, or SEEDED FALLBACK if regenerating live]** -- the Signal's `summary` names the camera-timing/compositing-contrast tension; its `drivers[]` cite the specific `cross_role_tensions`/`re_anchor_proposal` items.
4. **Inspection [REAL]** -- Maya opens `/vfx/shots/010/alignment`; the three `RolePerspectiveRead` rows (VFX/CG/Artist) show where "restrained, internal" and "more action-led" readings diverge, each with its own evidence.
5. **Agent-supported interpretation [REAL]** -- the Re-anchor Proposal (if present in this Assessment) explains `reason_for_consideration` and `proposed_fields` -- read-only, advisory, no Apply button.
6. **Human authority point [REAL]** -- Maya opens `/vfx/shots/010/intent`, creates or reviews a draft Core Anchor revision reflecting the resolved intent, and reaches the HumanGate comparison.
7. **Decision outcome [REAL]** -- Confirm (or Reject) -- `HumanGateRead.status` resolves, a `DecisionRead` is persisted, the confirmed revision becomes current, the prior one historical.
8. **Handoff [REAL]** -- the Shot Overview task rail (§10) now shows nothing pending for VFX; the CG Supervisor's own Execution Inbox (out of scope here) would next see the updated confirmed Core Anchor context.

If live DeepSeek generation is unavailable at presentation time, step 3-5's specific Assessment/Signal/Proposal content should come from a **seeded, previously-real, persisted** `CrossRoleAssessmentRead` (e.g. one of the real-provider-generated records already recorded in `VALIDATION_EVIDENCE.md` from Step 6's acceptance runs) rather than an invented one -- this keeps the fallback honest per §4 of this document's own product standard.

---

## 16. Unresolved questions and repository contradictions

1. **Two Version-level review/decision pathways coexist** (`AlignmentAssessment` Accept/Reject vs. `CrossRoleAssessment` + Intent Signal). Both are real, tested, and currently reachable from `VersionPage.tsx`. This document places AlignmentAssessment on the Version Review route and Cross-role Assessment on the Alignment route (§11), but **the product intent behind having both was never explicitly re-confirmed for Step 7** -- recommend the owner confirm whether AlignmentAssessment remains a first-class VFX decision point going forward, or is considered superseded in spirit by Cross-role Assessment and should only be preserved for Steps 1-6 compatibility.
2. **Naming collision, not a functional conflict:** `ShotAnchorPage.tsx`'s local `IntentSignalCard` function and `design/semantic/intent-signal/IntentSignalCard` are two different components with the same name in different modules. No import collision exists today (they're never imported into the same file), but implementers should rename one during the actual Step 7C-0B build to avoid confusion.
3. **No backend endpoint answers "Shots requiring attention."** This document treats it as `SMALL_BACKEND_GAP` and routes around it for the Demo case (§7) -- but a real standalone-entry Inbox (§7, §11) cannot be fully honest at any scale beyond "the few Shots I already know about" until this is addressed. Recommend explicitly scoping this decision to Step 7C-0B or a dedicated small backend task, not silently deferring it forever.
4. **No entity→`WritebackRecordRead` lookup exists.** Recorded as `SMALL_BACKEND_GAP` (§2, §12); flagging here because it also blocks any future per-object "controlled write-back status" UI even after Step 8's launch/identity/sync work lands, unless addressed separately.

---

## 17. Explicit non-goals (for this document and for Step 7C-0B)

- No VFX Workspace implementation, no production UI components, no route creation or modification.
- No backend, API contract, database, or Agent behaviour change.
- No locking of the recommended IA alternative -- §10 is a recommendation only.
- No enterprise notification, assignment, SLA, or administration pattern.
- No fabricated ftrack sync, launch, or write-back control.
- No replacement of missing aggregation data with invented metrics.
- No change to CG or Artist workspace scope (out of scope for this VFX-focused analysis).

---

## 18. Scope for Step 7C-0B

Suggested next steps, **not started here**:

1. Owner review and (dis)confirmation of the Alternative A + C-rail recommendation (§10).
2. Owner resolution of the AlignmentAssessment-vs-CrossRoleAssessment product question (§16.1).
3. A bounded decision on whether to build the Shots-requiring-attention capability as a small backend read-model now, or explicitly defer `/vfx` to a known-Shot-set pattern for the first VFX Workspace implementation pass.
4. Once resolved, an implementation-brief-style task (matching the Step 7B batch format) scoping the actual `/vfx` and `/vfx/shots/:shotId` build against this document's task model, decision hierarchy, and information-priority model.
5. `api.ts` additions for `getIntentSignal(id)`/`getReAnchorProposal(id)`/`getCrossRoleAssessment(id)` if a Signal/Proposal/Assessment deep-link is wanted (thin wrappers only, backend already supports them).

---

## Validation

- `git diff --check`: run, see final report.
- No frontend tests or builds run -- no production code changed by this task.
