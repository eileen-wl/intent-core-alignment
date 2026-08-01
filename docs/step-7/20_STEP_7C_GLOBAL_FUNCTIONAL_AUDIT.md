# Step 7C — Global Functional Audit (Read-Only)

**Date:** audit conducted against `recovery/step7c2-functional-clean`
**HEAD at audit time:** `dbf2a30` — `fix: complete deepseek artist guidance generation`
**Nature of this document:** a read-only audit. No source file, migration, test, or database row was created, modified, deleted, reset, or committed during the audit. Two read-only `GET` requests were made against the already-seeded local dev Postgres database (started and stopped for this purpose only) purely to cross-check code-level findings against live state; no write request was made and no demo/reset endpoint was called.

**Methodology:** required-reading docs (`PROJECT_CONTEXT.md`, `PRODUCT_SCOPE.md`, `GLOSSARY.md`, `ROLE_PERMISSIONS.md`) plus the Step 7 IA lineage (`06_STEP_7_LOCKED_SOURCE_OF_TRUTH.md` → `18_STEP_7C1_IA_RECONCILIATION_AUDIT.md` → `19_STEP_7C1_REVIEW_WORK_ITEM_ARCHITECTURE_REPORT.md`) were read in full. Two parallel read-only research agents (VFX Workspace, CG Workspace) completed their briefs and their findings are incorporated and cross-verified below. Three further research agents (Agent Runtime capability matrix, Cross-role Assessment/Re-anchor Proposal, ftrack connector/demo seed) hit a session usage limit partway through; that research was completed directly by this session instead, using the same evidence standard (file path + line citation, or a specific test/doc reference) — no finding below is unverified speculation.

**Correction note (same-day, still HEAD `dbf2a30`, documentation-only):** three findings in the original audit text were corrected in place rather than left standing alongside a separate errata list, since each was a factual misstatement rather than a judgment call: (1) `alignment_assessment` was originally grouped with `core_anchor_drafting` as "deterministic-only with no DeepSeek code path" — it is not; it supports both providers and has historic real-provider validation (`VALIDATION_EVIDENCE.md` row 26), and is legacy/superseded for the new VFX Workspace, which is a product-scope classification, not a provider-support gap. (2) `execution_anchor_drafting` was originally reported as having zero recorded live evidence — the project owner has since supplied the missing validation record (provider, model, prompt version, succeeded `AgentRun`/`ContextSnapshot`, all eight fields persisted, human-confirmation boundary intact), now written into `VALIDATION_EVIDENCE.md`'s Step 7 section; the original finding correctly identified an evidence gap, not an implementation gap, and this note preserves that distinction. (3) the blanket "all nine capabilities persist an immutable, append-only result" statement was imprecise — Anchor Draft Revisions (`core_anchor_drafting`, `execution_anchor_drafting`) are editable while in draft status; only confirmed/superseded revisions and `AgentRun` history are immutable/retained. No other finding in this document was altered.

---

## 1. Executive completion verdict

The three role-aware workspaces (VFX Supervisor, CG Supervisor, Artist) are **structurally complete and internally consistent**: every locked-IA route exists as a real page backed by real persisted data, every Review Inbox work-item type resolves to a real destination (no dead ends found in any of the three inboxes), and the shared Agent Runtime's failure semantics (atomic — no partial result ever persisted) hold across all nine registered capabilities without exception.

The honest qualifier is **provider maturity, not architecture**: of the nine Agent capabilities, six have documented, reproducible-from-evidence real-DeepSeek acceptance (`intent_decomposition`, `context_reconstruction`, `creative_review`, `execution_review`, `alignment_assessment`, `cross_role_assessment`), and two now have first-hand or newly-recorded real-DeepSeek acceptance following this documentation pass (`iteration_guidance` v2, validated live in this session's own prior work; `execution_anchor_drafting`, reported by the project owner as validated during implementation — provider `deepseek`, model `deepseek-v4-flash`, prompt `cg_execution_anchor_drafting.v1`, a succeeded `AgentRun` and real `ContextSnapshot`, all eight supported Execution Anchor fields persisted as a Draft, Human CG Supervisor confirmation still required to move it past draft status; see `VALIDATION_EVIDENCE.md`'s Step 7 section for the recorded entry). Only `core_anchor_drafting` remains **deterministic-only with no DeepSeek code path at all** — its own service module docstring confirms this wiring was never built. `alignment_assessment` is not deterministic-only: it supports both providers and has historic real-provider validation (`VALIDATION_EVIDENCE.md` row 26) — it is **legacy and superseded** by `cross_role_assessment` for the new VFX Workspace (read-only compatibility history there), which is a product-scope classification, not a provider-support gap.

One other honest gap: the ftrack connector's read-sync path is real code (`services/ftrack-connector/`, real `ftrack_api.Session`), but the only recorded "real ftrack sync" event is a self-reported, non-reproducible manual claim with no committed transcript (per `VALIDATION_EVIDENCE.md`'s own stated limitation). Separately, at the time this audit was first conducted, the platform's core narrative documents (`IMPLEMENTATION_STATUS_AND_ROADMAP.md`, `VALIDATION_EVIDENCE.md`) predated Step 7 entirely and still described the whole role-aware workspace effort as future work; both now carry a dated Step 7 completion section (see `21_STEP_7_COMPLETION_BASELINE.md`), so that specific gap is closed as of this correction pass.

None of the above are architectural defects. They are exactly the kind of provider-maturity and documentation-currency gaps a visual-refinement pass should not need to wait on, but that a reviewer must not mistake for "fully validated."

---

## 2. Final route map by role

### Entry / shared

| Route | Behavior |
|---|---|
| `/` | Role-selection Home (`RoleSelectionHome.tsx`) — three real, clickable role-entry cards (VFX Supervisor, CG Supervisor, Artist), no sidebar, no preselected identity |
| `/demo` | Permanent redirect to `/` (`apps/web/src/app/demo/page.tsx`) — preserves old bookmarks |
| `/dev`, `/dev/semantic-components`, `/dev/ui-foundation` | Development-mode component previews, out of product scope |
| `/shots`, `/shots/[shotId]`, `/shots/[shotId]/versions/[versionId]` | **Legacy pre-Step-7 engineering workflow** (`ShotAnchorPage.tsx`/`VersionPage.tsx`), fully functional, still the home of legacy `AlignmentAssessment` generation/Accept-Reject (`docs/step-7/14_...md` §5.2 — locked as "read-only compatibility history" only *inside* the new `/vfx` workspace; still mutable in this legacy route) |

### VFX Supervisor (`/vfx/**`)

Sidebar (exactly 3, `ROLE_SIDEBAR_ITEMS.vfx_supervisor`): **Workspace Home** (`/vfx`) · **Review Inbox** (`/vfx/inbox`) · **Shots** (`/vfx/shots`).
Shot `ContextTabs` (exactly 5): **Overview · Intent · Versions · Alignment · Activity**, all real routes: `/vfx/shots/[id]`, `/intent`, `/versions`, `/alignment`, `/activity`.

### CG Supervisor (`/cg/**`)

Sidebar (exactly 3, `ROLE_SIDEBAR_ITEMS.cg_supervisor`): **Workspace Home** (`/cg`) · **Review Inbox** (`/cg/inbox`) · **Tasks** (`/cg/tasks`).
Task `ContextTabs` (exactly 5): **Overview · Execution · Version Review · Dependencies · Activity**, all real routes: `/cg/tasks/[id]`, `/execution`, `/version-review`, `/dependencies`, `/activity`.

### Artist (`/artist/**`)

Sidebar (exactly 3, `ROLE_SIDEBAR_ITEMS.artist`): **Workspace Home** (`/artist`) · **Review Inbox** (`/artist/inbox`) · **Tasks** (`/artist/tasks`).
Task tabs (exactly 3, deliberately narrower than VFX/CG per Step 7C-5's own scope): **Task Overview · Current Version · Feedback History**, real routes: `/artist/tasks/[id]`, `/current-version`, `/feedback-history`. No Intent/Execution/Dependencies/Decisions/Activity tab exists for Artist — Feedback History is the Artist-facing history surface by design, not an omission.

No route in any of the three sidebars or tab sets was found to 404 or render a placeholder.

---

## 3. End-to-end journey audit

### A. VFX Supervisor — Role entry → Review Inbox/Shots → Core Anchor → Versions → Alignment/Re-anchor → Decision/Activity

**Fully wired, real data at every step.** Role entry lands on `/vfx` (real Workspace Home summary). Review Inbox (`vfx_inbox/current_focus.py`, 6-state precedence: `core_anchor_gate_pending → core_anchor_draft_needs_review → alignment_not_followed_by_anchor_action → re_anchor_proposal_present → assessment_generation_available → none`) and Shots both source from the same real `fetchVfxInbox()` data; no dead-end route for any focus type. Core Anchor: full draft → pending `HumanGate` → confirm/reject → `Decision` cycle is real (`intent/core_anchor_service.py`), backed by a DB partial-unique-index enforcing at most one confirmed revision. **Core Anchor drafting itself is deterministic-only** — `core_agent_service.py`'s own docstring states the DeepSeek wiring for this specific capability was never done (`_get_generator()` has no non-deterministic branch). Versions/Alignment/Activity tabs are real pages with real backend data, not stubs. Cross-role Assessment generation on the Alignment tab is real DeepSeek work (`DeepSeekCrossRoleAssessmentGenerator`, `cross_role_assessment_service.py`), and Re-anchor Proposal is rendered with a link into Intent Workspace (labelled "Review proposal →", not the locked doc's literal "Open Intent Workspace" wording — a cosmetic, non-functional discrepancy, no Apply action exists either way).

**Journey verdict: Complete and live-validated** (Core Anchor lifecycle, Versions, Activity — automated + `VALIDATION_EVIDENCE.md` Step 1D/2 real-provider rows) for everything except Core Anchor *drafting*, which is **Complete but demonstrated through deterministic/demo data only** (no DeepSeek path exists to validate).

### B. CG Supervisor — Role entry → Review Inbox/Tasks → confirmed Core Anchor context → DeepSeek Execution Anchor draft → Human confirmation → Version Review → dependency/escalation → VFX Review Inbox → Activity

**Fully wired end-to-end, including the cross-role escalation hop.** Role entry lands on `/cg`. Review Inbox (`cg_inbox/current_focus.py`, 5-state precedence: `execution_anchor_gate_pending → execution_anchor_draft_needs_review → dependency_needs_attention → version_review_available → none`) and Tasks both real, no dead ends. Execution Anchor: draft → pending gate → confirm/reject → `Decision` is real (`intent/execution_anchor_service.py`), **and** a "new draft from confirmed" endpoint exists (`create_draft_revision_from_confirmed`, unlike Core Anchor which only supports a blank draft) — genuinely more complete than the VFX side on this one dimension. Drafting has a real `DeepSeekExecutionAnchorDraftGenerator` class (`cg_agent_service.py`) and, per the project owner, was live-validated during implementation (`provider=deepseek`, `model=deepseek-v4-flash`, `prompt_version=cg_execution_anchor_drafting.v1`, a succeeded `AgentRun`/real `ContextSnapshot`, all eight supported fields persisted as a Draft, Human CG Supervisor confirmation still required) — this documentation pass adds that record to `VALIDATION_EVIDENCE.md`; the automated DeepSeek-path test remains explicitly mocked-only, as it should be. CG Supervisor Review (`execution_review`) *is* independently real-DeepSeek-validated (`VALIDATION_EVIDENCE.md` rows 51-55, with a documented truncation-root-cause-and-fix history). Dependencies/Conflicts/Escalations (`cross_department/models.py`'s `TaskDependency`) are real, and an `escalation`-kind row genuinely surfaces in the VFX Review Inbox (`vfx_inbox/service.py` queries `TaskDependency` for `kind="escalation", status="open", escalated_to_role="vfx_supervisor"`, consumed by `adaptEscalationWorkItems` in `workItem.ts`) — confirmed wired, not aspirational. Task Activity aggregates five real event sources.

**Journey verdict: Complete and live-validated** across the whole journey, Execution Anchor drafting included — the gap this audit originally flagged there was durable repository evidence, not implementation or provider validation; that gap is closed by this documentation pass. The one residual item: unlike every other Step (1 through 7C-5), the commit that wired this capability (`be544bf`) produced no dedicated `docs/step-7/*.md` completion report of its own — see `21_STEP_7_COMPLETION_BASELINE.md`.

### C. Artist — Role entry → Review Inbox/Tasks → Anchor context → real DeepSeek Artist Guidance → Current Version → Review Notes/CG Review/Assessment context → outdated guidance and regeneration → Feedback History

**Fully wired, and the one capability in this audit with first-hand, this-session live verification, not just documentation review.** Role entry lands on `/artist`. Review Inbox (`artist_inbox/current_focus.py`, 5-state precedence: `guidance_outdated → review_note_needs_response → dependency_needs_attention → guidance_available → none`) and Tasks both real. Task Overview cleanly separates WHY (Core Anchor, read-only) / HOW (Execution Anchor, read-only) / WHAT TO DO NOW (Artist guidance) with no edit/confirm control reachable for either Anchor, matching `PRODUCT_SCOPE.md` §5.3's Artist boundary exactly. **`iteration_guidance` is real-DeepSeek-validated in this exact session**: prior to this session's fix, a real call failed with `finish_reason="length"` and *empty* content — root-caused to the configured model's internal reasoning tokens consuming the entire completion budget before any visible JSON (confirmed empirically: a trivial smoke-test call spent 88 of 97 completion tokens on `reasoning_tokens`). Fixed via a new `artist_iteration_guidance.v2` prompt/schema (tightened bounds, no field left unbounded) plus a `disable_reasoning=True` flag scoped to only this capability's `model_gateway.generate_deepseek()` call (every other capability's behavior is unchanged — confirmed by grep, only `artist_guidance_service.py:487` passes it). Live-verified this session: real generation succeeded (`AgentRun 31cfa3ad-...`, ~14s, real non-deterministic content), a newer confirmed Execution Anchor correctly flipped `guidance_state` to `outdated`, regeneration succeeded and created exactly one new row (`AgentRun a3a15b8c-...`), and the two pre-fix failed attempts created **zero** orphan rows (row count before/after matched exactly). Current Version page never confuses a Production Version with an Anchor Revision, and invents no upload/submit/approve action. Feedback History is confirmed structurally and by regression test to be a distinct capability from CG's Task Activity (`test_feedback_history_never_appears_on_cg_task_activity`), not the same object reused.

**Journey verdict: Complete and live-validated**, the strongest evidence chain of the three journeys precisely because it was exercised firsthand this session, not only read.

---

## 4. Cross-role object and authority chain

- **Does each downstream object reference the correct upstream Anchor revision?** Yes, structurally enforced. `CrossRoleAssessment` FKs directly to `core_anchor_revision_id` and `execution_anchor_revision_id` (not just "the Shot"/"the Task"); `ArtistAgentGuidance` FKs to `execution_anchor_revision_id`; `CGSupervisorReview` FKs to the specific `ExecutionAnchorRevision`. Confirmed live this session: a regenerated `ArtistAgentGuidance` row correctly cited the *new* confirmed Execution Anchor revision id, not the superseded one.
- **Can a newer Anchor make downstream guidance/assessment stale?** Yes — and this is derived honestly, not flagged by a stored boolean. Artist's `guidance_state` (`current`/`outdated`/`none`) is computed by comparing the latest guidance's cited revision id against the Task's currently-active confirmed revision id at read time (`artist_inbox/service.py`). Verified live: confirming a new Execution Anchor revision flipped `guidance_state` from `current` to `outdated` with no code change, no manual flag flip.
- **Is that staleness visible and actionable?** Yes on the Artist side — a "Regenerate guidance" action is offered directly on the outdated guidance panel, and clicking it performs the same real generation call. No equivalent staleness signal exists for CG Supervisor Review or legacy Alignment Assessment relative to a superseded Core/Execution Anchor revision (neither computes an analogous "outdated" state) — see §10.
- **Are escalation and re-anchor flows routed to the correct human authority?** Yes for both. `TaskDependency(kind="escalation")` hard-sets `escalated_to_role="vfx_supervisor"` (`cross_department/models.py`) and is surfaced only in the VFX Review Inbox, matching `ROLE_PERMISSIONS.md` §5's Human Gate ownership table exactly. Re-anchor Proposal generation and its evidence-diversity gate (`_validate_re_anchor_proposal`: ≥2 distinct role evidence categories, must cite the current confirmed Core Anchor revision, must be supported by a real `cross_role_tension`/`local_optimum_risk` elsewhere in the same response) are Core-Agent-produced but presented only for VFX Supervisor review, with no "Apply" action anywhere — a human must re-author the Core Anchor draft themselves.
- **Are HumanGate and Decision records consistently created?** Yes, atomically, for both Core Anchor and Execution Anchor: `create_draft_revision`'s choke point opens exactly one pending gate with the draft in the same transaction; `confirm_revision`/`reject_revision` resolve the gate and record a `Decision` together. `VALIDATION_EVIDENCE.md` documents four dedicated atomicity test cases (gate-creation failure leaves no draft, Decision-creation failure leaves the gate pending, etc.).
- **Are failed AgentRuns honest and free of partial result rows?** Yes, verified at the shared-runtime level (`agents/runtime.py:execute_agent` — ContextSnapshot always preserved, domain result persisted only after `persist_result` returns, AgentRun becomes `succeeded` only after that) and confirmed empirically this session for `iteration_guidance` (two real pre-fix failures, zero orphan rows) and historically for `execution_review`/`cross_role_assessment` (`VALIDATION_EVIDENCE.md` rows 52, 61-63 — multiple real truncation failures, every one leaving `AgentRun.status=failed` and no domain row).
- **Are Review Inbox items completable rather than dead-end links?** Yes across all three inboxes — every non-`none` focus type in `vfx_inbox`, `cg_inbox`, and `artist_inbox` resolves to a route with a real `page.tsx`; no capability-search across any of the three found an unrouted or 404-ing focus type.
- **Are structural catalogues kept separate from actionable inboxes?** Yes, and this separation is explicitly tested, not incidental. VFX Shots / CG Tasks / Artist Tasks each render *every* real object (structural); each role's Review Inbox renders only the subset with an actionable `current_focus` (work-item-first, adapter-derived — `workItem.ts` in each role's `features/` tree), and each Review Inbox has a dedicated regression test proving it is never the structural parent of a Shot/Task in breadcrumbs.

---

## 5. Agent capability matrix

All nine capabilities share one Prompt Registry (`agents/prompt_registry.py`) and one execution envelope (`agents/runtime.py::execute_agent` — atomic ContextSnapshot/AgentRun lifecycle, confirmed in §4).

| Capability | Agent type | Deterministic generator | DeepSeek generator | Live DeepSeek evidence | Prompt version | Persisted result | Human confirmation boundary |
|---|---|---|---|---|---|---|---|
| `core_anchor_drafting` | `core_agent` | Yes (`core_agent_service.py`) | **None exists** — module docstring states this wiring was never done | None (no code path) | v1 | `CoreAnchorRevision` (draft) | VFX Supervisor confirms/rejects via HumanGate |
| `intent_decomposition` | `core_agent` | Yes | Yes | Yes — `VALIDATION_EVIDENCE.md` row 37 (real ids: AgentRun `9eabe0b9-...`) | v1 | `IntentDecomposition` | Advisory only; feeds Core Anchor drafting, never auto-applied |
| `context_reconstruction` | `core_agent` | Yes | Yes | Yes — rows 40, 46 (two independent real-provider runs) | v1 | `ContextReconstruction` | Advisory/read-only, no gate |
| `alignment_assessment` | `core_agent` | Yes | Yes | Yes — row 26, but **legacy**: superseded by `cross_role_assessment` for the Step 7 VFX Workspace (`14_...md` §5.2), read-only-compatibility only there; still fully mutable in the legacy `/shots` route | v1 | `AlignmentAssessment` | VFX Supervisor accept/reject (legacy route only) |
| `creative_review` | `vfx_supervisor_agent` | Yes | Yes | Yes — rows 49-50 (real ids: VFXSupervisorReview `d94af31c-...`) | v1 | `VFXSupervisorReview` | Advisory, no gate; VFX-Supervisor-generation-only |
| `execution_review` | `cg_supervisor_agent` | Yes | Yes | Yes — rows 52-55, including a documented truncation-root-cause-and-fix cycle (4096→8192 tokens) | v1 | `CGSupervisorReview` | Advisory, no gate; CG-Supervisor-generation-only |
| `execution_anchor_drafting` | `cg_supervisor_agent` | Yes | Yes | Yes — reported by the project owner as live-validated during implementation (`provider=deepseek`, `model=deepseek-v4-flash`, `prompt_version=cg_execution_anchor_drafting.v1`, succeeded `AgentRun`/real `ContextSnapshot`, all eight fields persisted as a Draft); now recorded in `VALIDATION_EVIDENCE.md`'s Step 7 section. The automated DeepSeek-path test remains mocked-only by design | v1 | `ExecutionAnchorRevision` (draft) | CG Supervisor confirms/rejects via HumanGate |
| `iteration_guidance` | `artist_agent` | Yes | Yes | **Yes, this session** — real success (`AgentRun 31cfa3ad-...`), real outdated→regenerate cycle, real honest-failure-then-fix history (empty-content reasoning-budget failure, root-caused and resolved) | **v2** (bumped from v1 this session) | `ArtistAgentGuidance` | Advisory, no gate; Artist-generation-only |
| `cross_role_assessment` | `core_agent` | Yes | Yes | Yes — the most thoroughly documented capability in the repository: rows 60-67, three distinct real-provider failure modes root-caused in sequence (opaque validation error → source_type enum drift → genuine token truncation) before a final compliant run | v1 | `CrossRoleAssessment` + optional `ReAnchorProposal` + `IntentSignal` | Advisory, no gate; VFX-Supervisor-generation-only |

Seven of the nine capabilities (`intent_decomposition`, `context_reconstruction`, `alignment_assessment`, `creative_review`, `execution_review`, `iteration_guidance`, `cross_role_assessment`) persist a genuinely **immutable, append-only** result with no update path and no active/latest pointer at all. The remaining two — `core_anchor_drafting` and `execution_anchor_drafting` — persist an **Anchor Revision**, which is a different shape: it is editable in place while `status="draft"` (`update_draft_revision` exists for both Core and Execution Anchor), becomes immutable only once confirmed, rejected, or superseded, and every prior confirmed/superseded revision remains retained and independently readable, never overwritten (the partial-unique-index constraint enforces at most one *confirmed* revision per Anchor, not a cap on total revisions). `AgentRun`/`ContextSnapshot` history is retained unconditionally for all nine capabilities regardless of which shape the domain result takes. "Outdated" (Artist's `guidance_state`) is always a read-time comparison against the current confirmed Anchor revision, never a mutation of either the guidance or the Anchor's own history.

---

## 6. Review Inbox work-item matrix

| Role | Focus types (precedence order) | Route target | Dead ends found |
|---|---|---|---|
| VFX | `core_anchor_gate_pending` → `core_anchor_draft_needs_review` → `alignment_not_followed_by_anchor_action` → `re_anchor_proposal_present` → `assessment_generation_available` → `none` | Intent (first two), Alignment (next three) | None |
| VFX (multi-source) | + `version_review` (own adapter), + `escalation` (from CG, own adapter) | `/versions`, Shot Overview | None |
| CG | `execution_anchor_gate_pending` → `execution_anchor_draft_needs_review` → `dependency_needs_attention` → `version_review_available` → `none` | Execution, Dependencies, Version Review | None |
| Artist | `guidance_outdated` → `review_note_needs_response` → `dependency_needs_attention` → `guidance_available` → `none` | Task Overview, Current Version | None |

All three inboxes share the same architecture: a bounded `ReviewWorkItem`/adapter model (documented as a module-level doc comment in each role's `features/*/workItem.ts`/`reviewInbox.ts`, not a separate roadmap doc), work-item-first (required action leads, object is secondary context), honest empty states ("Review Inbox is clear" / equivalent) distinct from a fetch-error state, and no fabricated read/unread/acknowledged state anywhere (confirmed by dedicated tests in all three).

---

## 7. Demo/seed/heuristic boundary register

- **`demo_seed/d1_scenario.py`** is the single idempotent seed source (`ensure_d1_scenario`), producing exactly: 1 rich confirmed Shot (Compositing Review Task, confirmed Core+Execution Anchor, 1 Version, 1 Review Note, VFX+CG reviews, deterministic Artist guidance, 1 Cross-role Assessment), 1 uninitialized Shot (genuinely empty — the honest "Initial Empty" reachability path, no Guided-mode special-casing), and 1 CG-demo Task ("Lighting Pass": draft-not-confirmed Execution Anchor + 1 real open dependency, giving CG's Review Inbox/Dependencies real content out of the box). Re-running it is a true no-op (verified live this session: identical ids returned on a second call before any schema change).
- **Reset endpoints** (`/internal/demo/reset-uninitialized-shot`, `/internal/demo/reset-cg-demo-task`) each mutate exactly one bounded, named object back to its seed baseline — neither can touch unrelated data. Both are explicitly labeled dev-only scaffolding at the same trust boundary as `/internal/ping-worker`, not permission-checked (acceptable per their own docstrings only on a trusted local/dev network).
- **Heuristic boundary worth naming explicitly:** none of the "current focus" precedence lists in any of the three inboxes are DNEG-validated business rules — they are this project's own bounded, documented design decisions (each role's `current_focus.py` module docstring says so directly, e.g. Artist's: "No Artist-equivalent locked IA doc exists, so the five states and their precedence below are defined and documented here for the first time"). They are internally consistent and fully tested, but must not be read as an industry-validated triage rule.
- **A real, previously-undocumented data-hygiene finding from this audit's own live verification:** the dev database, prior to this session's schema reset, contained several `Task`/`ArtistAgentGuidance` rows (e.g. "FX Pass", "Texture Pass", "Rigging Pass" under the rich Shot) that are **not** produced by `ensure_d1_scenario` at all — they are leftover manual/ad hoc test artifacts from earlier work sessions. After the reset performed during the prior DeepSeek-fix task, the live database now contains exactly the 3 real seed-scripted Tasks (verified live this audit: CG inbox returns exactly 3 items, VFX inbox exactly 2 Shots, matching the seed function's own object count precisely). This is worth flagging only because a future reviewer inspecting an un-reset dev database might reasonably (but incorrectly) conclude the seed produces a richer dataset than it actually does.

---

## 8. Known technical debt

1. **`agents/models.py`'s module docstring is stale.** It states "Only one capability (Core Anchor drafting) produces these rows today" — false; all nine capabilities route through the shared `ContextSnapshot`/`AgentRun` pair via `agents/runtime.py`. `AgentRun.result_revision_id` is a Core-Anchor-specific FK column left over from before the runtime was generalized; every other capability correctly leaves it null and uses its own domain table's `agent_run_id` FK instead — functionally harmless, but the docstring should be corrected.
2. **`IMPLEMENTATION_STATUS_AND_ROADMAP.md` and `VALIDATION_EVIDENCE.md` predated Step 7 entirely at the time this audit was first conducted.** Both listed "Step 7 — Role-aware Dashboard" as future work in their own roadmap sections, and neither had a row for `execution_anchor_drafting`, the VFX/CG/Artist Workspace routes, Dependencies/Escalations, or Feedback History — all of which now exist and are tested on this branch. This is resolved by the dated Step 7 completion section added to both documents alongside this correction pass, and by `21_STEP_7_COMPLETION_BASELINE.md`; the historic per-Step rows in both documents are otherwise left exactly as originally recorded.
3. **`execution_anchor_drafting` still has no accompanying `docs/step-7/*.md` completion report of its own.** Every other Step (1 through 7C-5, including this session's own DeepSeek fix) produced a dedicated audit/completion document; the commit that wired this capability (`be544bf`) did not. Its live-provider evidence is now recorded in `VALIDATION_EVIDENCE.md`'s Step 7 section (owner-reported, not independently reproducible from the repository alone — the same evidence type used throughout that document), but a standalone implementation write-up analogous to Steps 1-6's was never produced.
4. **The reasoning-token-budget-sharing failure mode found and fixed for `iteration_guidance` this session very plausibly also affects `execution_review` and `cross_role_assessment`**, both of which independently hit real truncation and were "fixed" by raising `max_output_tokens` (8192 for both) rather than by disabling reasoning. Neither has been re-examined with the `disable_reasoning` lever now available in `model_gateway.generate_deepseek`. This is not a known bug in either capability today, but the root-cause pattern that explained `iteration_guidance`'s failure was never checked against the other two truncation histories.
5. **Re-anchor Proposal's VFX-side link label ("Review proposal →") does not match the locked doc's specified wording ("Open Intent Workspace")** — cosmetic only, no functional gap (no Apply action exists under either wording).
6. **No "outdated" staleness signal exists for `CGSupervisorReview` or legacy `AlignmentAssessment`** relative to a superseded Anchor revision, unlike the Artist-side `guidance_state` mechanism. CG's Review Inbox instead treats *any* Version without a review for the *current* revision as `version_review_available`, which covers the common case but does not explicitly distinguish "never reviewed" from "reviewed against a now-superseded revision."

---

## 9. Functional blockers before visual refinement

**None found.** Every route in every sidebar and tab set renders real data, no Review Inbox item is a dead end, no Agent capability leaves a partial/corrupt result on failure, and the one capability exercised live this session (`iteration_guidance`) round-trips correctly end-to-end including the outdated→regenerate cycle. A visual-refinement pass can proceed against the current information architecture without first resolving anything in this section.

---

## 10. Non-blocking issues suitable for the design pass

- Re-anchor Proposal link wording vs. the locked doc (§8 item 5) — a one-line copy fix, worth folding into the visual pass rather than a separate change.
- No staleness indicator for CG Supervisor Review / legacy Alignment Assessment (§8 item 6) — a genuine UX gap, but additive (new indicator, no restructuring) and not blocking.
- `execution_anchor_drafting`'s missing standalone completion report (§8 item 3) is a documentation task, not a code change; its live-provider evidence is now recorded in `VALIDATION_EVIDENCE.md`, but a dedicated write-up (matching Steps 1-6's pattern) can still be produced alongside the design pass without touching product behavior.

---

## 11. Remaining work after Step 7C

1. Produce a standalone `docs/step-7/*.md` completion report for `execution_anchor_drafting`, matching the write-up pattern already established for Steps 1-6, now that its live-provider evidence is recorded in `VALIDATION_EVIDENCE.md`.
2. Decide whether to apply the `disable_reasoning` fix to `execution_review` and `cross_role_assessment` as a preventive measure, or explicitly document why their existing `max_output_tokens=8192` budgets are considered sufficiently safe without it.
3. Consider a staleness signal for CG Supervisor Review analogous to Artist's `guidance_state`, if that asymmetry is judged worth resolving before a portfolio review.
4. A real (not self-reported) reproducible ftrack sync/write-back demonstration remains outstanding — the code and worker architecture are real (`services/ftrack-connector/`, real `ftrack_api.Session`), but no committed transcript or repository-verifiable evidence of an actual successful run exists, consistent with `VALIDATION_EVIDENCE.md`'s own stated limitation on that row.
5. Step 8 (necessary ftrack Version/ReviewNote/entity-link extensions) is the next locked step; visual refinement is deliberately sequenced after Step 8 and before Step 9 final evaluation — see `21_STEP_7_COMPLETION_BASELINE.md` for the recorded Step 7/Step 8 boundary. This is a project-sequencing decision, not a finding that Step 7C is functionally unready (§12 below still holds).

---

## 12. Final recommendation

**Functionally ready for visual refinement, whenever it is scheduled.**

No functional blocker was found across any of the three workspaces, any of the nine Agent capabilities, the Review Inbox architecture, the Anchor/Decision/HumanGate chain, or role-aware deep-link security. The technical debt and non-blocking items in §8/§10 are honest gaps worth tracking, not prerequisites — none of them constrain page structure, navigation, or component composition, which is what a visual-refinement pass would touch.

This is a readiness finding, not a scheduling one: per the project owner's recorded decision (`21_STEP_7_COMPLETION_BASELINE.md`), visual refinement is deliberately sequenced **after Step 8** (necessary ftrack Version/ReviewNote/entity-link extensions) and before Step 9's final evaluation, rather than immediately following Step 7C. Nothing in this audit argues against that sequencing — Step 7C's functional completeness does not depend on Step 8, and Step 8's ftrack extensions do not depend on the visual pass having happened first.

---

## Confirmation

This audit was entirely read-only. No source file, test, migration, or documentation file (other than this report, written afterward) was created, modified, or deleted. No commit was made. Two `GET` requests were issued against the already-seeded local dev database (server started and stopped solely for this purpose) to cross-check code-level findings; no write request was made, no reset/seed endpoint was called, and no new model output was generated. HEAD remains `dbf2a30` throughout.
