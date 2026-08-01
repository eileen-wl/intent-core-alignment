# ICAS Step 7C-0B — VFX Workspace Locked IA, Interaction Architecture, Data Boundaries, and Implementation Plan

**Status:** Locked (for the decisions this document makes explicit below). Planning and repository-audit only -- no production UI, routes, backend, contracts, migrations, or Agent behaviour are changed by this document.
**Supersedes for locking purposes:** the option analysis in `13_STEP_7C0A_VFX_TASK_MODEL_AND_IA_OPTIONS.md` -- document 13 remains the grounding/option-analysis input; where the two disagree, this document governs.
**Clarified by `15_STEP_7C0C_VFX_END_TO_END_INTERACTION_AND_DATA_FLOW.md`:** §4.2's wording (non-persisted "addressed" semantics), §6.4's Task-Version generation rule (now the exact, locked selection contract), and §8's Demo mechanism (now resolved to a single locked mechanism, not two open alternatives) are clarified in place below -- document 15 also specifies the full exact interaction sequences, state-transition tables, and route-context contracts this document's structure implies but does not itself spell out. This document's locked IA (§1-§6, §10-§18) is unchanged and not reopened by document 15.
**Further supplied by `16_STEP_7C0D_VFX_LOW_FIDELITY_BLUEPRINTS_AND_FINAL_IMPLEMENTATION_BRIEF.md`:** the spatial low-fidelity page blueprints, responsive rules, component reuse/adaptation map, and the final implementation brief that §12/§15 below describe only architecturally are now fully specified there -- read document 16 before beginning Step 7C-1. §8's Demo mechanism is additionally refined by document 16 §2's exact seed-identity convention (superseding the name-based default this document's §8.3 originally pointed at).
**Corrected by owner review after 7C-0D:** the previously-introduced `7C-1A`-`7C-1F` batch sequence (originally in §15 below) was not part of the approved plan and has been replaced. The locked implementation route is now: **`7C-1`** (VFX foundations, Alignment Inbox, and Shot Overview) → **`7C-2`** (VFX Intent Workspace) → **`7C-3`** (VFX Alignment, Versions, Activity, and VFX close-out) → **`7C-4`** (CG Supervisor Workspace) → **`7C-5`** (Artist Workspace) → **`7D`** (cross-role finalisation). Also corrected: §5.2's legacy AlignmentAssessment treatment now fully prohibits any Accept/Reject exposure (not merely "not principal") anywhere in the new VFX Workspace -- read-only history only.
**Depends on:** `03_STEP_7A2_...md`, `04_STEP_7A3_...md`, `05_STEP_7A4_...md`, `06_STEP_7_LOCKED_SOURCE_OF_TRUTH.md`, `10_FTRACK_ENTRY_AND_IA_AMENDMENT.md`, `13_STEP_7C0A_...md`

---

## 1. Locked decisions (summary)

1. Structural backbone: Alignment Inbox → Shot Workspace → Intent Workspace / Alignment Workspace / Versions collection / Version Workspace / Activity, on the already-locked route family (§3).
2. Page tiering: 5 pages fully implemented and polished in the first pass, 2 supporting, 3 deferred (§3.2).
3. Alternative A is the route/page backbone; Alternative C contributes only a bounded "Current focus + up to two Next in this Shot" pattern inside the Shot Overview -- no persistent task rail, no ticket queue (§4).
4. Shot Overview interaction hierarchy: production context header → Current focus (exactly one) → Next in this Shot (0-2) → minimal supporting context (§4).
5. CrossRoleAssessment is the formal Step 7 alignment mechanism and owns the Alignment Workspace; legacy AlignmentAssessment is preserved as Version-Workspace-only compatibility history, not promoted as a primary VFX decision (§5).
6. A bounded, real backend aggregation (`GET /vfx/inbox`, provisional) is specified but **not implemented** in this task (§6).
7. A server-side identity-to-Actor adapter is defined: no editable Role/Actor controls on `/vfx`; identity resolves from the server session; mutations go through a same-origin adapter that injects trusted Actor headers (§7).
8. The Demo scenario has no persisted identifiers today -- this is recorded as a real gap with a recommended resolver, not assumed away (§8).
9. Current-focus derivation and precedence are defined deterministically, grounded in real domain states, with human-exclusive authority (HumanGate) outranking advisory Agent interpretation (§9 uses §4's ordering).
10. The locked implementation route is `7C-1` through `7C-5`, then `7D` (§15) -- none of them are started by this task.

---

## 2. Factual corrections carried from Step 7C-0A

Applied directly to `13_...md` §0 (not repeated in full here; summarised for traceability):

1. `VersionPage.tsx` contains AlignmentAssessment generation/Accept-Reject, VFX Supervisor Agent review, Artist Agent guidance, ReviewNotes, and Version context -- **not** Cross-role Assessment, Intent Signal, or Re-anchor Proposal, which remain exclusive to the legacy `ShotAnchorPage.tsx` flow.
2. The VFX workflow is not implemented end-to-end as a role-specific product experience. The repository contains most of the required persisted domain capabilities and engineering validation paths; Step 7C is real IA redesign, interaction redesign, role-specific data orchestration, identity integration, extraction from monolithic engineering pages, scoped loading/refresh, honest state handling, and real role routes -- not visual restyling.
3. `ShotAnchorPage.tsx` is a monolithic multi-role engineering and regression surface -- a functional reference and compatibility surface, not the component or data-loading architecture for the new workspaces.
4. No persisted D1 Demo data exists anywhere in the repository (no seed/bootstrap script; the scenario is static display copy only). Resolved in §8 below.

Additional finding from this task's own repository re-inspection, not previously recorded in document 13:

5. **`Version` has no `task_id` foreign key.** `Shot` has a 1-to-many relationship to both `Task` and `Version` independently (`versions_and_feedback/models.py`, `production_context/models.py`) -- there is **no persisted relationship between a Task and a Version at all**. Every backend capability that needs both (e.g. `cross_role_assessment_service.generate_cross_role_assessment`) requires the caller to supply `task_id` explicitly alongside a `version_id`; the pairing is asserted at generation time, never stored. Today's legacy page resolves this by silently taking `versions[0]` (`ShotAnchorPage.tsx:3130`, first item in an unfiltered, unordered-by-relevance list) -- an implicit assumption this document replaces with an explicit rule (§6.4).
6. **Real (if unwired) ftrack write-back capability already exists.** `POST /core-anchor-revisions/{id}/confirm` accepts an optional `request_write_back: bool`; when true and the Shot has a real `ExternalEntityLink` to ftrack, the backend creates a `WritebackRecord` and enqueues a real `write_back_core_anchor_confirmation` worker job (`integrations/writeback_service.py`, ADR-0012). `apps/web/src/lib/api.ts` never sets this flag and no UI exposes it. This is real backend capability, not Step 8 -- but it depends on a real ftrack Shot linkage that does not exist for the Demo Shot, so it is out of the first VFX implementation pass (§11, §15) pending real ftrack linkage work.

---

## 3. Final route inventory and tiering

### 3.1 Backbone (locked, matches `03_...md`/`06_...md`, unchanged)

```text
/vfx                                    Alignment Inbox
/vfx/shots/:shotId                      Shot Workspace (Overview)
/vfx/shots/:shotId/intent               Intent Workspace
/vfx/shots/:shotId/alignment            Alignment Workspace
/vfx/shots/:shotId/versions             Version collection
/vfx/shots/:shotId/versions/:versionId  Version Workspace
/vfx/shots/:shotId/activity             Activity
```

No route is added, removed, or renamed relative to `06_STEP_7_LOCKED_SOURCE_OF_TRUTH.md` §5. `/vfx/projects`, `/vfx/projects/:projectId`, `/vfx/integrations`, `/vfx/signals` remain locked routes but are re-tiered below.

### 3.2 Page priority (locked)

**Tier 1 -- fully implemented and polished in the first VFX pass:**

| Route | Purpose |
|---|---|
| `/vfx` | Alignment Inbox |
| `/vfx/shots/:shotId` | Shot Overview |
| `/vfx/shots/:shotId/intent` | Intent Workspace |
| `/vfx/shots/:shotId/alignment` | Alignment Workspace |
| `/vfx/shots/:shotId/versions/:versionId` | Version Workspace |

**Supporting -- lighter implementation:**

| Route | Purpose |
|---|---|
| `/vfx/shots/:shotId/versions` | Version collection |
| `/vfx/shots/:shotId/activity` | Activity |

**Deferred from the first VFX implementation pass:**

- `/vfx/projects`, `/vfx/projects/:projectId` -- not needed while the Demo/portfolio scale is single-Project; real data exists (`GET /projects`, unwired) whenever this is picked up.
- `/vfx/integrations` -- secondary System/technical-status destination per `10_...md` §7; still correct to defer given real per-object ftrack data remains thin (§2.6, §12).

**Explicitly deferred: `/vfx/signals`.** Reason (reaffirmed from `13_...md` §11): a separate Signal page would repeat the same single-Shot Signal before a real cross-Shot aggregation exists -- it would violate the "no repeated Signal representation" principle (§15) rather than serve a distinct purpose. Revisit only once `GET /vfx/inbox` (§6) is real and multi-Shot.

### 3.3 Alternative A + C synthesis (locked)

Alternative A (Inbox → dedicated routed workspaces) is the route and page backbone -- unchanged from the locked route family. From Alternative C, only the following is adopted, and only inside the Shot Overview:

- exactly **one** `Current focus` (§4.2, §9);
- at most **two** weaker `Next in this Shot` items (§4.3);
- both link into the dedicated routed workspaces (Intent/Alignment/Versions/Activity) -- they are navigation entries into Tier-1 pages, not a self-contained in-page workflow.

**Explicitly not built:** a persistent task-management rail that survives navigation across pages; multiple equal-weight task cards; a ticket queue, assignment model, notification model, or SLA model. The Shot Overview's Current-focus/Next-in-this-Shot block is a one-time orientation read at the top of one page, not a recurring UI chrome element.

---

## 4. Shot Overview interaction model (locked)

The Shot Overview is a focused orientation surface, not a dashboard-card grid.

### 4.1 Production context header

Always visible, in this order:

1. Project name
2. Shot name
3. relevant Task (§6.4 resolves ambiguity)
4. relevant Version (§6.4 resolves ambiguity)
5. source badge (`manual` | `ftrack`)
6. current Core Anchor state (`No Core Anchor` / `Draft pending review` / `Confirmed`)

Technical UUIDs are never part of this header -- they remain in `ON_DEMAND` disclosures per §11.

### 4.2 Current focus

Exactly one. Answers: what requires attention; why; which object it concerns; what the human can do next. Contains one dominant navigation/action entry (a single button or link, styled as the page's primary action).

**Deterministic focus-precedence rule (locked), highest to lowest, grounded in real domain states from `13_...md` §4:**

1. **Pending Core Anchor HumanGate** (`HumanGateRead.status == "pending"` for the Shot's active `core_anchor_confirmation` gate) → focus type `core_anchor_gate_pending`; action: "Review and confirm" → `/vfx/shots/:shotId/intent`.
2. **Core Anchor draft exists but no gate is pending yet** (a `CoreAnchorRevisionRead` with `status="draft"` and no linked `HumanGateRead`, or `create_pending_gate`'s legacy-compatibility path applies) → focus type `core_anchor_draft_needs_review`; action: "Review draft" → `/vfx/shots/:shotId/intent`.
3. **Clarified by `15_...md` §2 and §6.3 -- corrected wording, precedence unchanged:** the latest CrossRoleAssessment's Intent Signal is `medium` or `high` attention, **and no newer Core Anchor revision or HumanGate action has followed that Assessment** (a real timestamp-ordering fact, not a persisted "addressed" status -- no such field exists anywhere in the domain model, so this document no longer describes it as "not yet led to" or "unaddressed") → focus type `alignment_not_followed_by_anchor_action`; title: "Cross-role assessment may need your interpretation"; explanation: "No newer Core Anchor action has followed this assessment"; action: "Review alignment" → `/vfx/shots/:shotId/alignment`.
4. **A Re-anchor Proposal is present on the latest Assessment and unaddressed** (subsumed by #3 in practice, since a Re-anchor Proposal only ever accompanies an Assessment -- listed separately only to make the precedence explicit when #3's Signal is `low` but a Proposal still exists) → focus type `re_anchor_proposal_present`; action: "Review proposal" → `/vfx/shots/:shotId/alignment`.
5. **No successful Cross-role Assessment exists yet, but generation prerequisites are met** (confirmed Core Anchor, confirmed Execution Anchor for the relevant Task, a VFX/CG review and Artist guidance all present for the relevant Version) → focus type `assessment_generation_available`; action: "Generate assessment" → `/vfx/shots/:shotId/alignment`.
6. **No current VFX action required** (confirmed Core Anchor, no pending gate, latest Signal `low` or absent with prerequisites unmet) → focus type `none`; no action button; text: "Nothing requires your attention on this Shot right now."

Pending human-exclusive authority (#1) always outranks advisory Agent interpretation (#3-#5) -- this directly encodes the CLAUDE.md rule that Agents never gain decision authority over humans. No focus type is invented beyond these six; each maps to a real, checkable domain state, not a heuristic guess.

### 4.3 Next in this Shot

Zero, one, or two items -- never more. Each item: concise issue/destination, why it may matter (one clause), destination route. Rendered as a short list, visually subordinate to Current focus (smaller type, no icon/button parity with the primary action) -- it must not read as a second task queue. Candidate sources, in order, filling the 0-2 slots with whichever of §4.2's precedence list items 2-5 were **not** selected as Current focus, plus (only if a slot remains) "AlignmentAssessment pending review" on the current Version if unresolved (compatibility-only, §5.2).

### 4.4 Supporting context

Minimal, below Current focus / Next in this Shot:

- current confirmed Core Anchor summary (one-line: `core_summary` field only, not the full field set);
- latest Version identity (name + number, not full facts);
- latest successful Cross-role Assessment state (Signal level + one-line summary, not perspectives/tensions/evidence);
- latest Intent Signal summary (same data as above, not repeated separately -- see §11's `ALWAYS_VISIBLE` row for Intent Signal, which this satisfies once).

**Explicitly not shown on Overview:** full Core Anchor field set, three role perspectives, all Signal drivers, full Evidence, full history, integration/ftrack metadata beyond the source badge.

---

## 5. AlignmentAssessment versus CrossRoleAssessment (locked)

### 5.1 CrossRoleAssessment

The formal Step 7 cross-role alignment mechanism. Supports VFX/CG/Artist perspectives, agreements and tensions, local-optimum risks, unresolved dependencies, Evidence, Intent Signal, and an optional Re-anchor Proposal. Belongs in the Alignment Workspace (`/vfx/shots/:shotId/alignment`). Remains advisory -- any change to shared creative intent must move into the Core Anchor draft and HumanGate workflow (Intent Workspace); the Alignment Workspace never mutates an Anchor directly.

### 5.2 Legacy AlignmentAssessment

Remains persisted, API-accessible, tested, and available in the legacy `/shots` engineering workflow (never deleted -- backend, contracts, tests, and legacy controls there are untouched by this document). **Corrected by owner review after 7C-0D:** in the new portfolio-facing VFX Workspace, legacy AlignmentAssessment is **read-only historical compatibility information, with no mutation surface of any kind**:

- it is **not** a primary decision workflow;
- **no Generate control is exposed** anywhere in the new VFX Workspace;
- **no Accept control is exposed** anywhere in the new VFX Workspace;
- **no Reject control is exposed** anywhere in the new VFX Workspace;
- existing decisions may be shown as **collapsed historical compatibility information** on the Version Workspace (§9.6) -- read-only, showing only the historic result and historic Decision records, a secondary, visually de-emphasised, collapsed-by-default section;
- it is **not included in Current focus** and **not included in Next in this Shot** (§4) -- it can never become the reason a human is directed to act;
- it is not shown at all on the Shot Overview or Alignment Workspace (preventing exactly the "two competing alignment-assessment decision models" confusion this section exists to resolve);
- it must never become a primary or secondary mutation anywhere under `/vfx`.

This is a deliberate, explicit product decision: CrossRoleAssessment is the Step 7 alignment story going forward; AlignmentAssessment is read-only compatibility history from Steps 1-6 inside the new Workspace, kept fully working and mutable **only** in its original home, the legacy `/shots` engineering workflow, which this document does not alter.

---

## 6. VFX Alignment Inbox read model (specification only -- not implemented)

### 6.1 Provisional endpoint

```text
GET /vfx/inbox
```

Read-only, no mutation. Not implemented by this task.

### 6.2 Proposed contracts (naming follows the repository's existing `*Read` convention, e.g. `packages/contracts/python/src/intent_core_contracts/api/integrations.py`'s `SyncCursorRead`/`WritebackRecordRead`: `ConfigDict(from_attributes=True)`, `Literal` unions, a module docstring citing the relevant domain-model section)

```python
# packages/contracts/python/src/intent_core_contracts/api/vfx_inbox.py (proposed, not created)

VfxCurrentFocusType = Literal[
    "core_anchor_gate_pending",
    "core_anchor_draft_needs_review",
    "alignment_requires_interpretation",
    "re_anchor_proposal_present",
    "assessment_generation_available",
    "none",
]

class VfxInboxCurrentFocusRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    focus_type: VfxCurrentFocusType
    title: str                     # concise, e.g. "Core Anchor draft awaiting confirmation"
    explanation: str                # one sentence, why it matters
    target_route: str               # e.g. "/vfx/shots/{shot_id}/intent"

class VfxInboxItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    project_id: UUID
    project_name: str
    shot_id: UUID
    shot_name: str
    shot_source: Literal["manual", "ftrack"]
    core_anchor_state: Literal["none", "draft_pending", "confirmed"]
    active_core_anchor_revision_id: UUID | None
    active_core_anchor_summary: str | None       # core_summary field only
    pending_human_gate_id: UUID | None
    relevant_task_id: UUID | None
    relevant_task_name: str | None
    relevant_version_id: UUID | None
    relevant_version_name: str | None
    relevant_version_number: int | None
    latest_assessment_id: UUID | None
    latest_assessment_created_at: datetime | None
    latest_signal_id: UUID | None
    latest_signal_attention_level: Literal["low", "medium", "high"] | None
    latest_signal_summary: str | None
    latest_signal_role_coverage: list[str] | None
    re_anchor_proposal_present: bool
    current_focus: VfxInboxCurrentFocusRead
    sort_rank: int                  # deterministic, see §6.3

class VfxInboxRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    items: list[VfxInboxItemRead]
    generated_at: datetime
```

Names are proposed, not locked to the letter -- the implementing batch should confirm exact naming against the contracts package's conventions at build time, but the shape (a bounded per-Shot row + an explicit nested current-focus object) is locked.

### 6.3 Deterministic sorting (locked ordering, exact predicates to confirm against real states at build time)

1. Shots with a pending Core Anchor HumanGate first.
2. Then Shots with an unresolved `high` or `medium` Intent Signal.
3. Then Shots with a reviewable Assessment or Re-anchor Proposal not yet acted on.
4. Then Shots missing an Assessment where generation prerequisites are ready.
5. Then Shots with no current action, last.

Within each bucket, most-recently-updated first (using the most recent of: HumanGate creation, Assessment creation, Core Anchor revision creation). This mirrors §4.2's Current-focus precedence exactly -- the Inbox is many Shots' worth of the same per-Shot derivation the Shot Overview performs for one.

### 6.4 Resolving "relevant Task and Version" for a Shot (locked rule)

**A Shot may have more than one Task and more than one Version, and there is no persisted Task-Version relationship (§2.5).** This document does not assume a Shot always has exactly one of either. Locked, smallest-honest rule for `GET /vfx/inbox` and the Shot Overview alike:

1. If a `CrossRoleAssessmentRead` exists for the Shot, its own `task_id` and the `version_id` it was generated against are the relevant Task/Version -- these were an explicit, human/Agent-asserted pairing at generation time, not a guess.
2. Otherwise, if a pending `HumanGateRead` exists for a Core Anchor revision, there is no Version/Task association at that layer (Core Anchor is Shot-scoped, not Task/Version-scoped) -- Task/Version fields on the Inbox row are `null` in this case, and the UI must not imply a pairing that doesn't exist.
3. Otherwise, fall back to the most-recently-created Task and the most-recently-created Version for the Shot, **shown independently, never implied to be paired** (e.g. "Latest Task: Compositing Review" and "Latest Version: D1_STEP3_VFX_REVIEW_001" as two separate facts, not "Compositing Review · D1_STEP3_VFX_REVIEW_001" styled as one linked object).
4. If a Shot has zero Tasks or zero Versions, the corresponding field is `null` and the UI renders "No Task recorded yet" / "No Version recorded yet" rather than omitting the row or guessing.

This is a stricter rule than today's legacy page (`versions[0]`, §2.5) precisely because the Inbox aggregates across many Shots where a silent wrong guess would be more consequential and less visible than on a single already-open Shot page.

**Clarified by `15_...md` §3:** the display rule above is display-only. For **Cross-role Assessment generation specifically**, the rule is stricter still and now fully locked: when no existing Assessment already defines a pairing, the Human VFX Supervisor must **explicitly choose** one Task and one Version via a selector before generation -- no automatic latest/first/index-zero pairing is used for generation, even though §6.4's own display rule above permits showing "latest" as an independent orientation fact elsewhere on the page. Once an Assessment exists, its own persisted `task_id`/`version_id` become the established pairing, and the Assessment itself is the persisted evidence of that selection (no new Task-Version relationship table is introduced). See `15_...md` §3 for the full selector specification (entry point, validation, zero/one/multiple-Task-Version states).

### 6.5 Implementation requirements (documented, not started)

- **New read-model service**: yes -- a new `vfx_inbox` (or similarly named) module in `apps/api/src/intent_core_api`, composing existing `production_context`, `intent`, and `versions_and_feedback` queries; no new domain mutation logic.
- **New contracts**: yes, per §6.2.
- **New router**: yes, one read-only `GET /vfx/inbox` endpoint (plausibly under a new `vfx` or `dashboards` module -- naming to confirm against repository convention at build time, e.g. compare with how `ops`/`integrations` are named as capability-scoped, not role-scoped, modules).
- **Tests**: yes -- unit tests for the focus-precedence derivation (§4.2/§6.3) against each of the 6 focus types, and for the Task/Version resolution rule (§6.4) against 0/1/many Task and Version counts per Shot.
- **Migration**: **no** -- every field in §6.2 is derived from existing tables (`Shot`, `CoreAnchor`/`CoreAnchorRevision`, `HumanGate`, `CrossRoleAssessment`, `IntentSignal`, `ReAnchorProposal`, `Task`, `Version`); no new persisted column or table is required.

---

## 7. Identity-to-backend-actor adapter (locked architecture)

### 7.1 Problem

Portfolio-facing role pages (`/vfx`, ...) must not reuse the legacy editable `ActorSelector`. Current mechanism split across two independent layers that have never been connected:

- **Page rendering**: server-readable `icas_demo_role` httpOnly cookie (`apps/web/src/lib/demoIdentity.ts`, `apps/web/src/middleware.ts`) -- already real, already enforced server-side for route access.
- **Browser API mutations**: `apps/web/src/lib/api.ts` sends client-provided `X-Actor-Role`/`X-Actor-Id` headers on every mutating call -- today these come from the legacy page's own editable `ActorSelector` state, not from the session.

### 7.2 Locked principles

- No editable Role selector on `/vfx`.
- No editable Actor ID on `/vfx`.
- The current human identity is resolved from the server-side session (the existing `icas_demo_role` cookie today; a future short-lived ftrack-derived session per `10_...md` §2-3 later).
- Portfolio-facing mutations must not accept an arbitrary actor from page/client form state.
- The current Demo identity maps centrally, in one place: `vfx_supervisor` → "Maya Chen" → a stable Demo actor id such as `vfx-1` (exact literal to confirm at build time against `docs/ROLE_PERMISSIONS.md`'s actor-id conventions).
- Future ftrack identity will implement the same resolved-identity interface (§7.4), not a parallel mechanism.
- Legacy direct actor controls remain available only under `/dev` and `/shots` -- untouched by this document.

### 7.3 Recommended pattern (smallest robust Next.js shape, to evaluate at build time -- not built here)

```text
server-side role session (icas_demo_role cookie, already real)
  → server-side identity resolver (new: cookie/session → { role, actorId, displayName })
    → Next.js Server Action or same-origin Route Handler (new, per mutation or per feature)
      → injects trusted X-Actor-Role / X-Actor-Id headers when calling FastAPI
```

This mirrors the existing `enterDemoRole` Server Action pattern (`apps/web/src/app/demo/actions.ts`) already in the codebase -- a `"use server"` function that reads/writes the session server-side and never exposes a raw actor object to the Client Component tree. The identity resolver is the one new piece of shared logic; every mutation-performing feature module calls it, so no Client Component invents its own actor object.

### 7.4 Identity type and boundaries

```ts
// apps/web/src/lib/session/identity.ts (proposed, not created)
export interface ResolvedIdentity {
  role: HumanRole;
  actorId: string;      // e.g. "vfx-1" for the Demo VFX Supervisor
  displayName: string;  // e.g. "Maya Chen" -- display only
}
```

- **Safe to reach Client Components**: `role`, `displayName` (already used today for `AppShell`/`RoleIdentity` rendering -- unchanged).
- **Must remain server-side**: `actorId` never needs to reach client-side JavaScript at all -- it is injected into the `X-Actor-Id` header by the server-side adapter (§7.3) at the point a mutation is issued, not passed down as a prop. Read operations (`GET`) do not require actor headers at all today (confirmed: `api.ts`'s read functions take no actor argument; only mutations do) -- no change needed there.
- **Future ftrack resolver boundary**: a second implementation of the same `ResolvedIdentity`-producing interface, backed by the Step 8 production session (`10_...md` §2-3) instead of the Demo cookie. Not implemented here; the adapter's server-side placement (§7.3) is what makes this swap possible without touching Client Components later.
- **`/dev/shots` preservation**: the legacy `ActorSelector`-driven path is untouched -- it continues to call `api.ts`'s existing mutation functions directly with client-chosen headers, exactly as today. The new adapter is additive, used only by the new `/vfx` (and future `/cg`, `/artist`) feature modules.

No enterprise authentication, SSO, or FastAPI authentication change is proposed or implied.

---

## 8. Demo scenario resolver (locked, gap recorded honestly)

### 8.1 Inspection result

No stable persisted identifiers exist today for D1 Demo Project / Shot 010 / Compositing Review Task / D1_STEP3_VFX_REVIEW_001 Version. Confirmed by repository-wide search: no `seed`/`bootstrap` script anywhere under `apps/api`; no backend test references these literal names; the strings exist only as static display copy in `apps/web/src/app/demo/DemoEntryPage.tsx` and across `docs/step-7/*`. This is a **real implementation gap**, not assumed away.

### 8.2 Resolved mechanism (locked by `15_...md` §4 -- superseding the two-alternative framing originally here)

**Locked: an idempotent server-side seed/bootstrap**, not a request-time-only resolver. A small, deterministic function, not a hardcoded raw id scattered across Client Components:

```text
apps/web/src/lib/session/demoScenario.ts (proposed, not created)
resolveD1DemoShotId(): Promise<string>  -- server-only
```

Backed by a single mechanism (previously left as two open alternatives here; resolved by `15_...md` §4.2 -- neither is a separate fake Demo domain model): an idempotent seed-or-find script/endpoint (mirroring the existing idempotent-by-external-id creation pattern already used in `production_context/router.py` for ftrack sync) that finds the D1 Project/Shot/Task/Version rows by a stable name-based key (`Project.name == "D1 Demo Project"`, no schema change, per `15_...md` §4.3) if they already exist, or creates the full real chain if not. This is preferred over a request-time-only resolver because the data must exist by *some* means regardless -- a bare resolver would still need to run this same find-or-create logic on every guided-demo entry, just implicitly and less observably. See `15_...md` §4 for the full specification: safe-repeatability requirements, what the seed does and does not pre-create, and failure behaviour when the API/database is unavailable.

**Unchanged:** raw mutable ids must not be placed across multiple Client Components. Exactly one server-side call site resolves the Demo Shot id; Client Components receive only the already-resolved, already-authorized route (`/vfx/shots/:shotId`) via a redirect, never the raw id as a prop to construct URLs themselves.

### 8.3 Locked future guided-entry flow

```text
/demo
→ "Start guided demonstration"
→ enterDemoRole("vfx_supervisor") [existing Server Action, sets session cookie]
→ resolveD1DemoShotId() [new, server-side, per §8.2]
→ redirect to /vfx/shots/:shotId
```

The Demo does **not** first stop at an Inbox containing only one Shot -- it redirects directly into the Shot Workspace, which is honest because the Demo's entire point is one specific, pre-known Shot (once §8.2 resolves it), not a triage decision across many. **Standalone VFX entry still lands at `/vfx`** (the Inbox) -- this flow is exclusively for the guided Demo's dominant "Start guided demonstration" action (`10_...md` §4), not a change to normal entry. **Future ftrack entry** deep-links to the closest relevant object workspace per `10_...md` §2 (unimplemented, Step 8) -- this document does not change that.

---

## 9. Page-by-page textual wireframes

### 9.1 `/vfx` — Alignment Inbox

List/table work surface, not dashboard cards.

```text
┌─────────────────────────────────────────────────────────┐
│ Alignment Inbox                                          │
│ Where VFX Supervisor attention surfaces across your Shots.│
├─────────────────────────────────────────────────────────┤
│ [honest scope line: "Showing N Shots" or                 │
│  "No Shots currently need your attention" -- never a     │
│  fake count]                                              │
├─────────────────────────────────────────────────────────┤
│ Shot 010 — Final confrontation      D1 Demo Project       │
│   Core Anchor draft awaiting confirmation                 │
│   Human review required · Compositing Review · v3         │
│                                              [Open →]      │
├─────────────────────────────────────────────────────────┤
│ Shot 022 — ...                       ...                  │
│   ...                                                      │
│                                              [Open →]      │
└─────────────────────────────────────────────────────────┘
```

Each row: Shot name, Project name, current-focus title (§4.2/§6.2), Signal/authority state (role-worded), relevant Task/Version (per §6.4's honest pairing rule), one `Open` destination (→ Shot Overview). No global metrics, no fake counts, no separate notification tray -- the scope line states the real row count or the real empty state, nothing invented.

**Desktop:** rows as above, full-width, all fields visible inline. **Narrower width:** each row collapses to two lines (Shot/Project on line 1, current-focus title + Signal state on line 2), Task/Version detail moves to a `Details` disclosure per row rather than being dropped -- never silently hidden.

### 9.2 `/vfx/shots/:shotId` — Shot Overview

Per §4 exactly: production context header → Current focus (one) → Next in this Shot (0-2) → minimal supporting context → route-backed contextual tabs (Overview/Intent/Versions/Alignment/Activity, per `03_...md` §5.1). No card grid. No full Evidence. No full role-perspective display -- both remain `ON_DEMAND`/`SECONDARY_ROUTE` per §11.

### 9.3 `/vfx/shots/:shotId/intent` — Intent Workspace

The human-authority workspace. Dedicated comparison flow, top to bottom:

```text
┌─────────────────────────────────────────────────────────┐
│ Intent Workspace — Shot 010                                │
├─────────────────────────────────────────────────────────┤
│ Human authority: Core Anchor confirmation is owned by the  │
│ VFX Supervisor. [AuthorityBoundary / HumanDecisionNotice]  │
├───────────────────────────┬───────────────────────────────┤
│ Current confirmed          │ Proposed draft revision        │
│ (semantic fields, compact) │ (semantic fields, editable)    │
├───────────────────────────┴───────────────────────────────┤
│ Change summary: what differs, field by field                │
├─────────────────────────────────────────────────────────┤
│ Rationale: [text input]                                    │
│              [Reject]                       [Confirm]      │
├─────────────────────────────────────────────────────────┤
│ ▸ Evidence / Provenance (on demand)                         │
│ ▸ Intent Decomposition / Context Reconstruction (on demand) │
│ ▸ Historical revisions → see Activity                       │
└─────────────────────────────────────────────────────────┘
```

Confirm/Reject opens a **small explicit final confirmation dialog** (per `03_...md` §9.5, `06_...md` §7) rather than acting immediately on click. Advisory decomposition/reconstruction output is inspectable via disclosure, never rendered above the comparison/decision block -- it supports the decision, it does not precede it. Historical revisions are not listed on this page; they route to Activity (§9.7).

### 9.4 `/vfx/shots/:shotId/alignment` — Alignment Workspace

Locked interaction order:

1. Latest Intent Signal conclusion (role-worded, one line + summary).
2. What is causing tension (top 1-2 `CrossRoleFinding` tension/local-optimum items, not the full list).
3. Current CrossRoleAssessment summary (agreements count, tensions count -- counts of real items, not fabricated scores).
4. Role-perspective inspection (see disclosure pattern below).
5. Re-anchor Proposal, when present (own section, clearly advisory-labelled).
6. Evidence/Provenance on demand.
7. `Open Intent Workspace` -- never `Apply`.

**Locked disclosure pattern for the three role perspectives: a segmented switch (VFX / CG / Artist), one perspective visible at a time.** Not tabs (tabs imply independent pages/routes, which these are not -- they're one Assessment's three facets); not simultaneous three-column display (this is exactly the "all evidence and all perspectives visible by default" problem §10/§15 forbid); not a nested-accordion-per-perspective (adds an extra click per perspective for what is fundamentally a 3-way toggle, and reads as more structure than three facts warrant). A segmented switch keeps exactly one perspective's `current_position`/`protected_intent`/`main_concerns`/evidence on screen at a time, reduces cognitive load to "read one, flip, read the next" rather than "scan three columns simultaneously," and matches the same restrained-disclosure principle already used for the Core Anchor draft-vs-confirmed comparison (two states, one visible focus each). Historical Assessments remain collapsed (a `CrossRoleAssessmentHistory`-style disclosure, mirroring the already-proven `ShotAnchorPage.tsx` pattern).

### 9.5 `/vfx/shots/:shotId/versions` — Version collection

Restrained list, not a tile dashboard:

```text
┌─────────────────────────────────────────────────────────┐
│ Versions — Shot 010                                        │
├─────────────────────────────────────────────────────────┤
│ D1_STEP3_VFX_REVIEW_001   v3   manual   "contrast note..." │
│                                                  [Open →]   │
│ D1_STEP2_VFX_REVIEW_001   v2   manual   —                  │
│                                                  [Open →]   │
└─────────────────────────────────────────────────────────┘
```

Fields: Version identity (name), number, source badge, latest ReviewNote summary (one line, when available -- `"—"` when none, never invented), open action. **No render-review or media-inspection state is invented** -- there is no persisted field for render/media review status anywhere in the domain model, so none is displayed.

### 9.6 `/vfx/shots/:shotId/versions/:versionId` — Version Workspace

```text
┌─────────────────────────────────────────────────────────┐
│ Version Workspace — D1_STEP3_VFX_REVIEW_001 (v3)           │
├─────────────────────────────────────────────────────────┤
│ Version context + ReviewNotes                              │
├─────────────────────────────────────────────────────────┤
│ Confirmed Core Anchor summary (one line, links to Intent)  │
├─────────────────────────────────────────────────────────┤
│ VFX Supervisor Agent review (advisory)                     │
│ "Based on Version description and ReviewNote text --       │
│  no media was inspected." [text-evidence-only notice]      │
├─────────────────────────────────────────────────────────┤
│ ▸ Evidence / Provenance (on demand)                         │
│ ▸ AlignmentAssessment history (collapsed, secondary,        │
│    compatibility only -- no primary Accept/Reject here)     │
└─────────────────────────────────────────────────────────┘
```

**No primary Accept/Reject flow for legacy AlignmentAssessment** (§5.2) -- if shown at all, it is inside the collapsed compatibility disclosure, visually secondary (muted tone, smaller type), never the page's primary action. **No Artist Agent action** appears in the VFX role workspace (Artist guidance belongs to the Artist's own Version Workspace, per `03_...md` §8's object-placement matrix -- VFX sees it, if at all, as a read-only secondary summary, not an action surface). The VFX Supervisor Agent review card explicitly states its text-only evidence basis -- it must never imply the Agent visually inspected media, footage, or renders (matches the domain model: no visual-inspection capability exists anywhere in the Agent contracts).

### 9.7 `/vfx/shots/:shotId/activity` — Activity

Chronological, inspection-only. Grouped or timeline-like list (not a card grid), covering: Core Anchor revisions, HumanGate outcomes, Decisions, CrossRoleAssessments, Intent Signals, relevant Version review history. Each entry visually distinguishes its authority type (Production fact / Human-confirmed / AI interpretation, per `06_...md` §10's required labels) -- not a chat feed, not an enterprise activity centre, no read/unread/acknowledge state.

---

## 10. (intentionally reserved -- see §11 for the disclosure matrix, kept as its own numbered section per the deliverable's required structure)

---

## 11. Information-disclosure matrix (locked)

| Information item | Classification |
|---|---|
| Core Anchor summary (one-line `core_summary`) | `ALWAYS_VISIBLE` (Overview supporting context, §4.4) |
| Full Core Anchor fields (all semantic collections) | `CURRENT_FOCUS_ONLY` on Intent Workspace when a decision is live; otherwise `ON_DEMAND` |
| Draft-vs-confirmed comparison | `CURRENT_FOCUS_ONLY` -- Intent Workspace, only while a draft/gate exists |
| HumanGate status | `ALWAYS_VISIBLE` wherever the gate is the Current focus (Overview + Intent); `SECONDARY_ROUTE` (Activity) once resolved |
| Intent Signal (conclusion + summary) | `ALWAYS_VISIBLE` (Overview supporting context + Alignment Workspace step 1) |
| Signal drivers (full list) | `ON_DEMAND` (Alignment Workspace disclosure) |
| Three role perspectives | `ON_DEMAND` via the segmented switch (§9.4) -- one visible at a time, never all three by default |
| Re-anchor Proposal | `CURRENT_FOCUS_ONLY` when present and unaddressed (Overview Next-in-this-Shot / Alignment step 5); `SECONDARY_ROUTE` (Activity) once superseded |
| Evidence | `ON_DEMAND` everywhere it appears -- never expanded by default |
| AgentRun | `ON_DEMAND` (inside Evidence/Provenance disclosure) |
| ContextSnapshot id | `ON_DEMAND`, technical-details layer only; snapshot payload itself is `NOT_SHOWN` |
| Technical ids (UUIDs) | `DEV_ONLY` as primary labels; may appear inside an `ON_DEMAND` technical-details layer, never as a heading |
| ftrack source badge | `ALWAYS_VISIBLE` (header, §4.1) as presence-only |
| ftrack sync details | `SECONDARY_ROUTE` (`/vfx/integrations`) |
| Historical Assessments | `SECONDARY_ROUTE` (Activity) / `ON_DEMAND` collapsed disclosure on Alignment Workspace |
| Historical Decisions | `SECONDARY_ROUTE` (Activity), scoped per §13 of `13_...md` (no Shot-wide Decision endpoint exists -- Activity composes from revision/assessment-scoped Decision lists) |
| Intent Decomposition | `ON_DEMAND` (Intent Workspace disclosure, below the decision block) |
| Context Reconstruction | `ON_DEMAND` (Intent Workspace disclosure, below the decision block) |
| Execution Anchor | `SECONDARY_ROUTE`/contextual only -- CG-owned, VFX sees a read-only summary at most, never a management surface |
| CG Supervisor Review | `NOT_SHOWN` on the VFX Workspace (belongs to CG's own Version Review per `03_...md` §8's object-placement matrix; VFX may see a summary reference only if explicitly required later -- not assumed here) |
| Artist Agent guidance | `NOT_SHOWN` as an action surface on VFX Version Workspace (§9.6); at most a read-only reference, never primary |
| Legacy AlignmentAssessment | `SECONDARY_ROUTE`/`ON_DEMAND` collapsed disclosure on Version Workspace only (§5.2, §9.6) -- never `ALWAYS_VISIBLE`, never on Overview or Alignment |

This matrix is the concrete mechanism preventing "everything visible at once" -- every information item above has exactly one locked classification; a page implementation that shows an item at a stronger visibility than its row permits is a defect against this document.

---

## 12. Frontend workflow architecture (locked direction, not built)

**Not** a plan to copy sections out of the 3,000-line legacy page into new route files. A modular architecture:

- **Route-level Server Components** for initial data (Shot identity, Core Anchor state, latest Assessment/Signal summary) -- fetched server-side, matching the existing `demoIdentity`/session pattern already in the codebase.
- **Small Client Component interaction islands only where mutation or local editing require them** -- the Core Anchor draft editor, the Confirm/Reject dialog, the role-perspective segmented switch, the Generate-assessment button. Everything else (headers, summaries, lists) stays server-rendered.
- **Page-specific data loaders / read-model functions** -- one per feature module (§12.1), not a single monolithic fetch-everything function mirroring the legacy page's pattern.
- **Shared object-context header** -- one component implementing §4.1's production context header, reused across Overview/Intent/Alignment/Versions/Version/Activity (all of them need the same Project/Shot/Task/Version/source identity strip).
- **VFX-specific workflow view models** -- thin, page-scoped types translating raw contract types (`CoreAnchorRevisionRead`, `CrossRoleAssessmentRead`, ...) into exactly what each page's components need (e.g. a `ShotOverviewViewModel` combining Shot + Core Anchor state + current focus, rather than components reaching into raw contract shapes directly).
- **A current-focus derivation module** -- one shared function implementing §4.2/§6.3's precedence rule, called both server-side for `/vfx/shots/:shotId` and (once §6 is built) reused conceptually by the backend's own `GET /vfx/inbox` derivation (kept as parallel implementations of the same documented rule, not a shared runtime, since one runs in Python and one in TypeScript -- but both must implement the exact same precedence order from §4.2).
- **Identity-resolved mutation adapters** -- per §7.3, one place per feature module where a mutation calls through the server-side identity resolver rather than accepting a client-passed actor.
- **Query invalidation / scoped refresh after mutations** -- per §13, each mutation documents its own minimum refresh scope; no page-wide reload (the legacy page's pattern, explicitly not to be duplicated).
- **Shared error/loading/not-found patterns** -- reusing the already-built `LoadingSkeleton`/`ErrorState`/`EmptyState`/`PermissionState` shell components (`06_...md` §12), not new ad hoc treatments per page.
- **Reuse of Step 7B semantic components only where they support the task** -- `IntentSignalBanner`/`IntentSignalIndicator`/`AuthorityLabel`/`EvidenceProvenanceDrawer`/`FtrackLinkageBadge` families are real, tested, and ready for real data; adopt them where the wireframes in §9 call for the pattern they already implement, rather than rebuilding equivalents.

### 12.1 Proposed folders and responsibilities (naming to confirm against repository convention at build time)

```text
apps/web/src/features/vfx/
  inbox/            -- /vfx: data loader, row view model, list rendering
  shot-overview/     -- /vfx/shots/:shotId: context header, current-focus
                        derivation call-site, Next-in-this-Shot, supporting
                        context
  intent-workspace/  -- /vfx/shots/:shotId/intent: comparison, draft
                        editing, HumanGate confirm/reject, confirmation
                        dialog
  alignment-workspace/ -- /vfx/shots/:shotId/alignment: Signal, tension
                        summary, segmented role-perspective switch,
                        Re-anchor Proposal, generate action
  version-workspace/  -- /vfx/shots/:shotId/versions(/:versionId): Version
                        collection + single-Version review, legacy
                        AlignmentAssessment compatibility disclosure
  activity/          -- /vfx/shots/:shotId/activity: chronological
                        composition from existing scoped endpoints

apps/web/src/features/session/
  identity.ts         -- ResolvedIdentity type + Demo resolver (§7.4)
  demoScenario.ts      -- D1 Demo Shot resolver (§8.2)
  actorAdapter.ts       -- server-side mutation header injection (§7.3)

apps/web/src/lib/
  currentFocus.ts       -- shared derivation module (§12, precedence from §4.2)
```

**Explicitly not introduced:** a large state-management library (React Query/Redux/Zustand or similar) -- the existing `fetch`-in-Server-Component + small Client islands pattern already used by the codebase is sufficient at this scale; a large UI framework beyond the existing `@/design` system; a single all-Client-Component Workspace; any duplication of the legacy page's one-global-reload-after-any-mutation pattern.

---

## 13. Mutation and refresh boundaries

| Mutation | Owning page | Server authority | Preconditions | Result | Minimum refresh | Stays historical | Error state | Tier 1? |
|---|---|---|---|---|---|---|---|---|
| Generate Intent Decomposition | Intent Workspace (disclosure) | VFX Supervisor | confirmed Core Anchor context exists (Shot has an IntentBrief) | new `IntentDecompositionRead` | the decomposition disclosure list only | prior decompositions | `AgentGenerationError` → 502, sanitised message | No (supporting, disclosure-only) |
| Create Core Anchor draft from decomposition | Intent Workspace | VFX Supervisor (Agent-originated content, human-triggered) | a decomposition exists | new draft `CoreAnchorRevisionRead` + pending `HumanGateRead` | Intent Workspace's draft/comparison block; Overview's Current focus | none created yet | `ConflictError` if a draft already pending | Yes |
| Update Core Anchor draft | Intent Workspace | VFX Supervisor | draft is `status="draft"` | updated `CoreAnchorRevisionRead` | the draft editor's own fields only | n/a (same row) | validation error (blank required field) | Yes |
| Confirm Core Anchor revision | Intent Workspace | VFX Supervisor only, enforced server-side | pending `HumanGateRead`, rationale provided | `HumanGateRead.status=confirmed`, `DecisionRead` created, revision becomes active | Intent Workspace comparison (now shows new confirmed state); Overview Current focus (re-derives, likely to `none` or next item); Activity (new entry) | prior confirmed revision | `ForbiddenActionError` → 403 if wrong role; `ConflictError` if gate already resolved | Yes |
| Reject Core Anchor revision | Intent Workspace | VFX Supervisor only | pending `HumanGateRead`, rationale provided | `HumanGateRead.status=rejected`, `DecisionRead` created | Intent Workspace (draft marked rejected); Overview Current focus | rejected revision itself | same as Confirm | Yes |
| Generate Context Reconstruction | Intent Workspace (disclosure) | VFX Supervisor | Shot has an IntentBrief | new `ContextReconstructionRead` | the reconstruction disclosure list only | prior reconstructions | `AgentGenerationError` → 502 | No |
| Generate CrossRoleAssessment | Alignment Workspace | VFX Supervisor only (`_GENERATE_ROLES = {"vfx_supervisor"}`, confirmed in `cross_role_assessment_service.py`) | confirmed Core Anchor, confirmed Execution Anchor for the relevant Task, VFX review + CG review + Artist guidance all present for the relevant Version | new `CrossRoleAssessmentRead` + required `IntentSignalRead` + optional `ReAnchorProposalRead` | Alignment Workspace (new Assessment becomes latest, prior collapses to history); Overview Current focus/supporting context | prior Assessments | `AgentGenerationError` → 502; missing-prerequisite → explicit "prerequisites not met" state, not a generic error | Yes |
| Generate VFX Supervisor Agent review | Version Workspace | VFX Supervisor | Version exists | new `VFXSupervisorReviewRead` | Version Workspace's review section only | prior reviews (no active/latest pointer -- all shown, newest first) | `AgentGenerationError` → 502 | Yes |

**Legacy AlignmentAssessment Accept/Reject: classified as compatibility-only, not part of the new primary VFX flow** (§5.2) -- if surfaced at all on the Version Workspace's collapsed disclosure, it remains fully functional (real mutation, real `DecisionRead`) but is explicitly not listed as a Tier-1 primary action in this table, and its own refresh scope is confined to that disclosure.

**Not added:** Re-anchor Proposal `Apply` (confirmed absent in the codebase and not proposed here); automatic Agent orchestration (every generation above is human-triggered, one click per capability, never chained automatically).

---

## 14. Honest page-state model (Tier 1 pages)

For each Tier 1 page (`/vfx`, Shot Overview, Intent Workspace, Alignment Workspace, Version Workspace), the following 10 states apply. Where a page-specific nuance exists, it is noted; otherwise the row is the shared default.

| State | What the user sees | Action available | Must not be implied |
|---|---|---|---|
| Loading | `LoadingSkeleton` per region (header loads independently of body) | none | data exists before load completes |
| Empty | Page-specific honest empty copy (Inbox: "No Shots currently need your attention"; Alignment: "No Cross-role Assessment yet") | the one action that would resolve the empty state, if any (e.g. "Generate assessment") | that emptiness is an error, or that something is being monitored continuously |
| Ready | Full Layer-1/2 content per §11's classifications | the page's Tier-1 primary action | nothing beyond what's rendered |
| Partial data | Header/context loads; a sub-region (e.g. Evidence) fails or is still pending independently | page remains usable; failed region shows its own compact error, not a full-page failure | that the whole page failed when only one region did |
| Permission denied | `PermissionState` naming the actual owning role (e.g. "Execution Anchor confirmation belongs to the CG Supervisor") | none for the denied action; navigation elsewhere remains available | that the action doesn't exist anywhere, or that the current role is wrong/broken |
| API unavailable | `ErrorState` with the `describeError()`-mapped message (already implemented: 401/403/404/409/502/network) | Retry (re-fetch) | that data is empty rather than unreachable |
| Agent generation failed | Compact failure row, sanitised error only, previous successful result (if any) remains fully visible and marked current | Retry = a new "Generate" action, never silent auto-retry | that the prior successful result was lost |
| Historical data present | `AuthorityLabel variant="historical"`, collapsed by default | expand only | that historical data is current |
| Current decision pending | Comparison/decision block fully expanded (Intent Workspace) or Current-focus names it (Overview) | Confirm/Reject or the relevant generate action | that the draft is already in effect |
| Current decision resolved | Outcome shown with actor/timestamp/linked Decision; decision block collapses to a summary | none (historical from this point); a new draft can start a new cycle | that it can be silently reopened |

`/vfx`-specific note: "Empty" here means zero Inbox rows -- a real, honest state once §6 exists, distinct from "Loading" and from an API error.

---

## 15. Implementation route (locked)

None started by this task. **Corrected by owner review after 7C-0D** -- the previously-introduced `7C-1A`-`7C-1F` batch sequence is replaced. The locked, final implementation route:

```text
7C-1  VFX foundations, Alignment Inbox, and Shot Overview
7C-2  VFX Intent Workspace
7C-3  VFX Alignment, Versions, Activity, and VFX close-out
7C-4  CG Supervisor Workspace
7C-5  Artist Workspace
7D    Cross-role finalisation (guided Demo, final consistency, final acceptance)
```

Each is one implementation stage with one owner acceptance gate -- internal dependency order within a stage (e.g. backend read-model before the frontend page that consumes it) may be documented, but must not be presented as separate numbered batches, sub-batches, commits, or roadmap stages. The full, detailed brief for `7C-1` through `7C-3` (exact files, tests, browser acceptance per stage) is specified in `16_STEP_7C0D_...md` §17 -- this section records only the locked route names and scope boundary; document 16 is authoritative for stage detail. `7C-4`, `7C-5`, and `7D` are named and scoped only at the high level given above -- not designed, reopened, or elaborated here.

CG and Artist implementation remain entirely out of scope for `7C-1` through `7C-3`.

---

## 16. Browser acceptance criteria (VFX workspace summary)

A VFX Supervisor reviewer, using only the browser (no dev tools, no direct API calls), must be able to:

1. Enter via `/demo` → "Start guided demonstration" and land on a real Shot Overview with a real Current focus, without seeing any raw UUID as a primary label.
2. Enter via `/vfx` directly (standalone) and see either a real Inbox row for the Demo Shot or an honest empty state -- never a fabricated count.
3. From the Shot Overview, follow the Current focus's primary action into the correct Tier-1 page for that focus type (all 6 types from §4.2 must each resolve to a working destination).
4. On the Intent Workspace, review a draft-vs-confirmed comparison, enter a rationale, and Confirm (or Reject) through the explicit confirmation dialog -- and see the Overview's Current focus visibly change afterward without a full page reload.
5. On the Alignment Workspace, read the latest Signal, switch between VFX/CG/Artist perspectives via the segmented control, and open a Re-anchor Proposal if present -- and confirm no control anywhere claims to "Apply" it.
6. On the Version Workspace, read ReviewNotes and the VFX Agent review, and expand (but not be forced to see by default) the legacy AlignmentAssessment compatibility history.
7. On Activity, see a chronological, authority-labelled record without any read/unread/acknowledge control.
8. Trigger at least one permission-denied state (e.g. attempting an action outside VFX's authority, if reachable through normal navigation) and confirm it names the correct owning role rather than a generic "forbidden."
9. Observe at least one Agent-generation-failed state (achievable via a documented fixture or a deliberately-broken prerequisite) and confirm the prior successful result, if any, remains visible and correctly marked current.
10. At no point see a fake metric, a fake ftrack sync/launch control, an unread badge, or enterprise queue language anywhere in the above.

---

## 17. Explicit non-goals

- No VFX Workspace implementation, no production UI components, no route creation, no backend/contract/migration/Agent-behaviour change -- this remains a planning document.
- No CG or Artist workspace implementation or scope change.
- No enterprise notification, assignment, SLA, or administration pattern.
- No fabricated ftrack sync, launch, or write-back control -- including the real-but-unwired `request_write_back` capability found in §2.6, which is documented but not exposed until real ftrack Shot linkage exists for at least one object.
- No large state-management library, no large UI framework addition.
- No persistent task-management rail, ticket queue, or multi-card task grid (§3.3).
- No promotion of legacy AlignmentAssessment to a primary decision workflow (§5.2).
- No change to `/dev` or `/shots` legacy behaviour.
- No enterprise authentication, SSO, or FastAPI authentication change (§7).
- No implementation of the Demo seed/bootstrap mechanism itself (§8.2 records the recommendation; building it is `7C-1`'s job, not this document's).

---

## 18. Remaining Step 8 dependencies

- Real ftrack Action/Widget launch, ftrack user authentication, ftrack-user-to-ICAS-identity mapping, project-role mapping persistence, production ICAS session creation (`10_...md` §2-3) -- the future ftrack identity resolver boundary named in §7.4 depends entirely on this.
- Per-object ftrack sync timestamp / external-id exposure on Read models (beyond the existing coarse `source` field) -- needed for any real `/vfx/integrations` detail beyond system-level `SyncCursorRead`.
- An entity→`WritebackRecordRead` lookup endpoint -- needed to surface real per-object write-back status once the already-real `request_write_back` capability (§2.6) is exposed in the UI.
- Real ftrack Shot linkage (`ExternalEntityLink`) for at least one Demo-relevant Shot -- a precondition for exercising `request_write_back` at all, live or in the Demo.
- Any real cross-Shot `/vfx/signals` page (§3.2) remains gated on `GET /vfx/inbox` (§6) existing and being multi-Shot in practice, which itself only becomes meaningful once real production data (via ftrack sync) populates more than one or two Shots.

---

## Validation

- `git diff --check`: run, see final report.
- No frontend or backend tests run -- no production code changed by this task.
