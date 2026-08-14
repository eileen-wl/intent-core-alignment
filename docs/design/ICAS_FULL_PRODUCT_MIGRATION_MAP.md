# ICAS Full-Product Visual Migration — Page Inventory & Migration Map

> **Status:** Read-only planning deliverable for Phase 2 (Full-Product Visual Language Migration) — the inventory and batch plan below is otherwise unmodified from when it was written. **Update (checkpoint):** Batch C's Worklist-family Inbox verification sub-scope (`/cg/inbox`, `/artist/inbox`) has since been implemented and owner-accepted, confirming the migration-goal expectation in §Batch C ("expected outcome for 7 of 8 pages: no change needed") for those two; the checklist in §L is left unchecked as originally written rather than edited here. Batch C's `/artist` Workspace Home item remains **not** implemented — the one prior visual-migration attempt on it was browser-rejected and reverted, and it is the next page targeted by this plan. The rest of Batch C, and Batches A/B/D/E in full, remain not started.
> **Parent authority:** `docs/design/ICAS_DESIGN.md`, `docs/design/ICAS_VISUAL_LANGUAGE_V1.md` (see its §26 "Full-product migration note")
> **Purpose:** Build a complete route/page inventory, cross-check it against the approved IA, classify every remaining page, map shared-component regression risk against the four locked archetypes, and organize the remaining work into controlled, risk-graduated implementation batches.
> **Scope note:** This document describes a plan. It does not itself change page responsibilities, role permissions, route semantics, or any domain/API contract.

**Authorities read:** `docs/design/ICAS_DESIGN.md`, `docs/design/ICAS_VISUAL_LANGUAGE_V1.md`, `docs/design/ARTIST_ANCHOR_CONTEXT_CONTENT_AUDIT.md`, `docs/ROLE_PERMISSIONS.md`, `docs/product-improvement/00_ICAS_PRODUCT_IMPROVEMENT_BASELINE.md`, `apps/web/src/lib/roleNavigation.ts`, all 30 `apps/web/src/app/**/page.tsx` route files, the three role workspace frames (`VfxShotWorkspaceFrame`, `CgTaskWorkspaceFrame`, `ArtistTaskWorkspaceFrame`), and the `@/design` component tree (60 files).

---

## A. Executive inventory summary

> **Reconciliation note (this revision):** counts below are recalculated after re-verifying three shared-component consumer claims against current code (§F) and after splitting non-locked pages into **implementation targets** (a concrete visual/code finding exists) vs **verification-only** (no concrete finding — confirm in browser, do not invent work). See §4/§H for the page-by-page split.

| Category | Count |
|---|---|
| Total real `page.tsx` routes | 30 |
| Locked reference archetypes (no redesign) | 4 |
| Real product surfaces (non-locked, non-root, non-legacy/dev/demo) | 18 |
| — of which **implementation targets** (concrete finding, real change expected) | 8 |
| — of which **verification-only** (no concrete finding, confirm only) | 10 |
| Root entry surface (real, but architecturally outside the shell — verification-only) | 1 |
| Legacy/pre-role-split routes (`/shots/**`, not migration targets) | 3 |
| Dev-only surfaces (`/dev/**`, not migration targets) | 3 |
| Demo redirect stub (`/demo`, not a migration target) | 1 |
| — Implementation-target severity: light | 2 (VFX Shot Overview, Artist Task Overview) |
| — Implementation-target severity: standard | 4 (VFX Versions, CG Task Overview, CG Dependencies, Artist Workspace Home — conditional) |
| — Implementation-target severity: **heavy/gated** | 2 (VFX Intent, CG Execution) |

18 = 8 implementation targets + 10 verification-only. This reconciles exactly with the route table in §B.

---

## B. Route inventory table

"Migration need" now states **TARGET** (concrete finding in §D, real change expected) or **VERIFY** (no concrete finding — confirm in browser only, do not invent work) per item 4 of this reconciliation pass.

| Route | Role | Page responsibility | Primary object | Reachability | Classification | Migration need | Closest reference grammar | Product-risk | Effort |
|---|---|---|---|---|---|---|---|---|---|
| `/` | none | Role-selection entry | none | Direct entry point | Real product surface (deliberately outside `AppShell`) | VERIFY | n/a (own scoped design) | LOW | — |
| `/demo` | none | Permanent redirect to `/` | none | Compatibility only | Legacy-transitional (redirect stub) | NOT A MIGRATION TARGET | — | — | — |
| `/dev`, `/dev/semantic-components`, `/dev/ui-foundation` | none | Engineering component/token catalogues | none | Not in role nav | Dev-smoke-test surface | NOT A MIGRATION TARGET | — | — | — |
| `/shots`, `/shots/[shotId]`, `/shots/[shotId]/versions/[versionId]` | none (pre-role-split) | Legacy Shot/Anchor/Version CRUD console | Shot/Anchor/Version | Nav-orphaned (only linked from unreachable `/dev`) | Legacy-transitional | NOT A MIGRATION TARGET (see §G) | — | — | — |
| `/vfx` | VFX Sup. | Workspace Home overview | Work item (aggregate) | Primary nav | Real product surface | VERIFY — no concrete finding | Worklist (object-row reuse) | LOW | — |
| `/vfx/shots` | VFX Sup. | Shots catalogue/browse | Shot | Primary nav | Real product surface | VERIFY — no concrete finding | Worklist (object-list rows) | LOW | — |
| `/vfx/shots/[shotId]` | VFX Sup. | Shot Overview | Shot | Tab (shared frame) | Real product surface | **TARGET** — light | Work (current-object + guardrail) | LOW | S–M |
| `/vfx/shots/[shotId]/intent` | VFX Sup. | Core Anchor authoring workspace | Anchor (Core) | Tab (shared frame) | Real product surface | **TARGET** — heavy, gated | Decision (Human action + Agent + Evidence disclosure) | **HIGH** | **L** |
| `/vfx/shots/[shotId]/versions` | VFX Sup. | Production Version + review-note workspace | Version | Tab (shared frame) | Real product surface | **TARGET** — standard | Review (object + evidence + agent) | MEDIUM | M |
| `/vfx/shots/[shotId]/activity` | VFX Sup. | Shot activity timeline | Activity event | Tab (shared frame) | Real product surface | VERIFY — no concrete finding | History sub-pattern | LOW | — |
| `/vfx/inbox` | VFX Sup. | **LOCKED** — Worklist reference | Work item | Primary nav | Locked | — | — | — | — |
| `/vfx/shots/[shotId]/alignment` | VFX Sup. | **LOCKED** — Decision reference | Cross-role Assessment | Tab (shared frame) | Locked | — | — | — | — |
| `/cg` | CG Sup. | Workspace Home overview | Work item (aggregate) | Primary nav | Real product surface | VERIFY — no concrete finding | Worklist (object-row reuse) | LOW | — |
| `/cg/inbox` | CG Sup. | Review Inbox | Work item | Primary nav | Real product surface | VERIFY — no concrete finding beyond confirming its architecture already parallels the locked VFX inbox | Worklist (near-identical composition already) | LOW | — |
| `/cg/tasks` | CG Sup. | Tasks catalogue/browse | Task | Primary nav | Real product surface | VERIFY — no concrete finding | Worklist (object-list rows) | LOW | — |
| `/cg/tasks/[taskId]` | CG Sup. | Task Overview | Task | Tab (shared frame) | Real product surface | **TARGET** — standard | Work (current-object + guardrail) | LOW–MEDIUM | M |
| `/cg/tasks/[taskId]/execution` | CG Sup. | Execution Anchor authoring workspace | Anchor (Execution) | Tab (shared frame) | Real product surface | **TARGET** — heavy, gated | Decision (Human action + Agent + Evidence disclosure) | **HIGH** | **L** |
| `/cg/tasks/[taskId]/dependencies` | CG Sup. | Dependency/coordination workspace | Dependency | Tab (shared frame) | Real product surface | **TARGET** — standard–heavy | Worklist-adjacent (row list) + Decision (Human action) | MEDIUM | M–L |
| `/cg/tasks/[taskId]/activity` | CG Sup. | Task activity timeline | Activity event | Tab (shared frame) | Real product surface | VERIFY — no concrete finding | History sub-pattern | LOW | — |
| `/cg/tasks/[taskId]/version-review` | CG Sup. | **LOCKED** — Review reference | Version | Tab (shared frame) | Locked | — | — | — | — |
| `/artist` | Artist | Workspace Home overview | Work item (aggregate) | Primary nav | Real product surface | **TARGET** — light, conditional on §E confirming real content-length variability | Worklist (object-row reuse) + long-form audit (§E) | LOW | S–M |
| `/artist/inbox` | Artist | Review Inbox | Work item | Primary nav | Real product surface | VERIFY — no concrete finding beyond confirming its architecture already parallels the locked VFX inbox | Worklist (near-identical composition already) | LOW | — |
| `/artist/tasks` | Artist | Tasks catalogue/browse | Task | Primary nav | Real product surface | VERIFY — no concrete finding | Worklist (object-list rows) | LOW | — |
| `/artist/tasks/[taskId]` | Artist | Task Overview | Task | Tab (shared frame) | Real product surface | **TARGET** — standard | Work-adjacent — composition to be derived from this page's own content, not copied from the Artist Anchor (see §6/Batch D) | LOW–MEDIUM | M |
| `/artist/tasks/[taskId]/feedback-history` | Artist | Feedback History timeline | Review Note event | Tab (shared frame) | Real product surface | VERIFY — no concrete finding | History sub-pattern | LOW | — |
| `/artist/tasks/[taskId]/current-version` | Artist | **LOCKED** — Work reference | Version | Tab (shared frame) | Locked | — | — | — | — |

---

## C. Approved IA vs. implementation discrepancies

Cross-checked against `roleNavigation.ts` (the actual, current 3-item-per-role primary nav: Workspace Home / Review Inbox / Shots-or-Tasks) and each workspace frame's own documented locked tab order (`VfxShotWorkspaceFrame`: Overview/Intent/Versions/Alignment/Activity; `CgTaskWorkspaceFrame`: Overview/Execution/Version Review/Dependencies/Activity; `ArtistTaskWorkspaceFrame`: Overview/Current Version/Feedback History).

**No missing-route or extra-route discrepancies found.** The implementation matches its own documented IA exactly for all three roles — every tab in every frame corresponds to a real, reachable page; nothing in `ICAS_DESIGN.md`, `ROLE_PERMISSIONS.md`, or the product-improvement baseline mandates a route that doesn't exist.

One thing confirmed as **intentional, not a discrepancy**: `docs/product-improvement/00_ICAS_PRODUCT_IMPROVEMENT_BASELINE.md` §5.4 requires Anchor information to "not exist only on deep Intent/Execution pages" — confirmed satisfied: `AnchorContextLayer` is mounted frame-level and appears on every tab for all three roles, not just the deep authoring pages.

One thing confirmed as **intentional legacy, not a discrepancy**: `/shots/**` is explicitly excluded from the role-routing layer (`roleForPathname("/shots")` returns `null`; `isSafeReturnToPath("/shots")` is `false`, both asserted in tests) and is only reachable through `/dev`'s own explicitly-labelled "Legacy Shot smoke test" link — itself unreachable from any role nav. This is documented, deliberate, pre-role-split scaffolding kept for backward compatibility, not a gap.

---

## D. Page-by-page visual audit

Only pages with concrete, real findings are listed; pages marked VERIFY in §B had nothing worth reporting and are not repeated here.

### VFX

**`/vfx/shots/[shotId]` (Shot Overview)** — `DetailedContext`'s `<dl>` puts a full narrative sentence (`latest_signal_summary`) in a `dd` next to short-label rows — a settings-table pattern holding prose, though mitigated by being collapsed-by-default. `TaskExecutionRow` stacks five near-identical muted meta lines with no visual differentiation between them (dense, not clearly hierarchical).

**`/vfx/shots/[shotId]/intent` (Intent)** — the heaviest issue set in the product:

- Real card-soup: `ConfirmedAnchorSummary` nests an `EvidenceLayerSection` "main card" plus several independently-bordered `.supportingCard` divs beside it.
- Deep nested grids in `CoreAnchorRevisionEditor`'s first-draft layout (`firstDraftWorkspace` → `firstDraftEditorGrid` → `firstDraftFieldGroup` fieldsets → `firstDraftScalarRow`), each level bordered.
- Icon-per-field: every field in `CoreAnchorRevisionEditor`/`ConfirmedAnchorSummary` gets its own small `FieldIcon`.
- **Confirmed bug:** `ReanchorProposalReview.module.css` styles the "High attention" badge with `var(--state-danger-surface, var(--surface-muted))` / `var(--state-danger, var(--text-primary))` — `--state-danger*` is not defined anywhere in `tokens.css`, so the badge silently falls back to plain neutral colors, undercutting its intended urgency signal. Verified directly against `tokens.css`.

**`/vfx/shots/[shotId]/versions` (Versions)** — moderate card-nesting: the `.detail` panel contains several `.section` blocks each with its own top border, plus a bordered `AgentContributionPanel` — noticeable but shallower than Intent. The two-column grid (`minmax(0,1fr) minmax(0,1.4fr)`) is a variable-fraction layout, not equal-width, so it is **not** an instance of the narrative-column anti-pattern.

### CG

**`/cg/tasks/[taskId]` (Task Overview)** — the "Execution operations" panel renders Production-ready criteria / Technical boundaries / Escalation conditions as a `<dl>` where the `dd` values are full sentences — prose in a settings-table shape. These same three fields (of the full eight) also appear again, more completely, on `/execution` — a content-duplication pattern of the same shape already found and fixed on the Artist Anchor (see `ARTIST_ANCHOR_CONTEXT_CONTENT_AUDIT.md` §F). Two separately-bordered `Panel tone="elevated"` cards (Current Focus, then Execution Operations) sit back-to-back rather than reading as one flow.

**`/cg/tasks/[taskId]/execution` (Execution)** — the most extreme label/value-for-prose instance found anywhere: `contentFieldRows()` maps **8** narrative fields (Technical boundaries, Parameter ranges, Delivery conditions, Production-ready criteria, Downstream dependencies, Publish requirements, Allowed refinements, Escalation conditions) into one `<dl>`, each `dd` a full `white-space: pre-wrap` paragraph under a small-caps label. `AgentContributionPanel` (a bordered card) sits standalone between two un-boxed `EvidenceLayerSection`s — inconsistent card rhythm. **Confirmed:** `ExecutionAnchorEditor.module.css`'s primary button (Confirm/Generate/Create-new-revision — all Human-triggered) uses the literal `--accent-agent-*` tokens rather than the redesignated `--accent-selected-*` alias `tokens.css` itself documents as the correct call-site name. Not a visible bug today (the alias currently resolves to the same values), but a semantic-naming staleness.

**`/cg/tasks/[taskId]/dependencies` (Dependencies)** — closest to genuine card-soup found: `RecordDependencyForm` is its own bordered card, and every `DependencyRow` across all three sections (Open/Cross-role conflicts/Resolved) is independently bordered too. **Confirmed:** the same stale `--accent-agent-*`-for-Human-action token pattern repeats in `DependencyRow.module.css` and `RecordDependencyForm.module.css`. This page uses **no** `@/design` semantic components at all (no `EvidenceLayerSection`, `MetadataRow`, `AuthorityLabel`) — it visually reads differently from its sibling tabs, which do use that vocabulary.

### Artist

**`/artist` (Workspace Home)** — the single-ready-task view renders a 3-up equal-width `Grid` of Why/How/What-to-do-now `SummaryCard`s — the same conceptual triad already identified as anti-pattern-prone on the Artist Anchor itself (§E flags this for closer inspection). The 7-tile metric grid in "Task overview" borders on card-soup for a landing page, though each tile holds only a short label+number.

**`/cg/tasks/[taskId]` and `/artist/tasks/[taskId]`** both have a `DetailedContext` `<dl>` holding a mix of short facts and one narrative sentence — same pattern as VFX Shot Overview, same mitigation (collapsed by default).

**No other pages had findings worth reporting** — VFX/CG/Artist Workspace Homes, Shots/Tasks list pages, and all three Activity/History pages were inspected and are already visually consistent with the locked pages' grammar (flat rows, no card nesting, no equal-width prose grids, correct color semantics).

---

## E. Long-form equal-column audit

| Route | Component | Fields shown | Length variable? | Verdict |
|---|---|---|---|---|
| `/artist` (Workspace Home, single-ready-task view) | inline `SummaryCard` grid | Why / How / What to do now | Likely — same conceptual triad the Artist Anchor correction moved away from equal-width columns for | **Candidate anti-pattern** — needs the actual card content inspected for real length variability before concluding it needs the same semantic-block treatment; not yet confirmed as a violation, flagged for inspection |
| `/vfx`, `/cg`, `/artist` Workspace Homes | `Grid` of `SummaryCard` "Anchor health"/"Task overview" tiles | Short labels + numeric counts | No — genuinely short, comparable, predictable | **Correctly** using equal-width grid (§9.5's own carve-out) |
| `/vfx/shots/[shotId]/intent` | `contentOverview` | 4 short metric numbers | No | **Correctly** using equal-width grid |
| `/vfx/shots/[shotId]/versions` | `.grid` (two-column detail layout) | Description, review notes, executive summaries | Yes, but columns are variable-fraction (`1fr`/`1.4fr`), not equal-width | **Not** the anti-pattern — degrades gracefully |
| `cg/tasks/[taskId]` and `cg/tasks/[taskId]/execution` `<dl>` patterns | definition lists | Full narrative sentences per field | Yes, highly | **Not** a column anti-pattern per se (it's a label/value-row pattern, the sibling anti-pattern §9.5 also now explicitly names) — see §D |
| `cg/tasks/[taskId]/dependencies`, `artist`/`vfx`/`cg` Task/Shot Overview `<dl>`s | definition lists | Mixed short facts + occasional narrative sentence | Partially | Same label/value-row concern as above, lower severity |
| Shared Anchor "review" variant `guardrailMatrix` (CG Version Review, **LOCKED**) | `AnchorContextLayer` review variant | Must preserve / May vary / Execution boundary / Intent attention | Yes | **Confirmed anti-pattern**, already known and explicitly deferred in `ICAS_VISUAL_LANGUAGE_V1.md` §9.5's migration note — do not touch without deliberately reopening the locked Review page |

No other genuine equal-width-narrative-column instances were found in the remaining product. The dominant anti-pattern in the *remaining* pages is not equal-width columns (that was mostly an Anchor Context-specific problem, now fixed there) — it's the **label/value `<dl>`-for-prose** pattern, concentrated on CG's Task Overview/Execution pages and, more mildly, on the collapsed `DetailedContext` disclosures shared by VFX/CG/Artist Overview pages.

---

## F. Shared-component impact map

> **Reconciled against current code** (this revision). Three consumer claims in the prior version of this document were based on stale/historical assumptions, not the actual final four-archetype code. Corrected rows are marked ✅ **CORRECTED**; the exact verification performed is documented under §4 of the reconciliation report below.

| Component | Consumers/routes (current, verified) | Consistent with Visual Language v1? | Migrate at | Regression risk | Locked page(s) affected |
|---|---|---|---|---|---|
| `AnchorContextLayer` — shared collapsed state | VFX (all 5 shot tabs), CG (4 non-review tabs), Artist (all 3 task tabs) | Yes, already final | N/A — already done | **Highest blast radius in the app** | **VFX Alignment, Artist Current Version** |
| `AnchorContextLayer` — standard expanded (VFX/CG branch) | VFX (all 5 shot tabs), CG (4 non-review tabs) | Yes, already final for VFX/CG | N/A — Artist-only work already isolated this path | High | **VFX Alignment** |
| `AnchorContextLayer` — "review" variant | CG Version Review only | Contains the known guardrail-matrix anti-pattern (§E), explicitly deferred | Per-page, only when the Review archetype is deliberately reopened | Editing this **is** editing the locked page | **CG Version Review** (direct) |
| `AnchorContextLayer` — Artist branch | Artist (all 3 task tabs) | Yes, already final | N/A | Medium (isolated to Artist role) | **Artist Current Version** |
| ✅ **CORRECTED** `AnchorContextSummary` (row-level, separate component from `AnchorContextLayer`) | **8** real JSX consumers, verified by grepping actual `<AnchorContextSummary` usage, not just imports: `ArtistTaskRow`, `ArtistTaskWorkItemRow`, `ArtistTaskListRow`, `CgTaskRow`, `CgTaskWorkItemRow`, `CgTaskListRow`, `InboxRow`, `ShotRow`. **`WorkItemRow` (used by the locked VFX Review Inbox) no longer renders it** — confirmed via its own doc comment: "Visual-language pass: dropped the per-row `AnchorContextSummary`." Only imports the *type* `AnchorContextSummaryRead`, not the component. | **Not yet audited** against the final Visual Language — a distinct, un-reviewed surface, but no longer touches a locked page | Once, at shared-component level, after individual list pages are settled | Medium (8 consumers, all non-locked) | **None** — VFX Review Inbox removed from blast radius |
| ✅ **CORRECTED** `SignalStrip` | **2** real JSX consumers, verified the same way: `VersionReviewPage.tsx` (CG Version Review), `AlignmentWorkspacePage.tsx` (VFX Alignment). **`CurrentVersionPage.tsx` (Artist Current Version) no longer imports or renders it at all** — confirmed via its own doc comment: "Work archetype correction: replaces the previous SignalStrip... with a short, [actionable guidance rows]." | Yes, validated on 2 of 4 locked pages | Locally per new consumer only — do not touch the shared component casually | **Extreme** if touched at shared level | **VFX Alignment, CG Version Review** (2 of 4, not 3) |
| `AuthorityLabel` / `AuthorityBoundary` / `MetadataRow` / `EvidenceProvenanceDrawer` | VFX Alignment (locked), VFX Intent, VFX Versions, Artist Feedback History, others | Yes, validated on VFX Alignment | Shared-component level is safe for additive changes; regression-test VFX Alignment for any visual change | High if changed at shared level | **VFX Alignment** |
| `EvidenceLayerSection` | CG Execution, VFX Intent, VFX Intent's `ConfirmedAnchorSummary` only | **Not** used by any locked page (only referenced in doc comments on Artist/CG Version Review explaining why it was retired there) | Safe to migrate at shared-component level | **None** | **None** |
| ✅ **CORRECTED** `AgentContributionPanel` | **3** real JSX consumers, verified the same way: `ExecutionPage.tsx` (CG Execution), `IntentWorkspacePage.tsx` (VFX Intent), `VersionsWorkspacePage.tsx` (VFX Versions). **`CurrentVersionPage.tsx` (Artist Current Version) no longer imports or renders it at all** — confirmed via its own doc comment: "retires the previous... full-report `AgentContributionPanel`, the same way CG Version Review and VFX Alignment already did." | Not used by any locked page — safe to treat as a normal shared component | Shared-component level | Low (3 consumers, all non-locked) | **None** — Artist Current Version removed from blast radius |
| `WorkingDirectionSection` | Artist Task Overview, CG Task Overview, VFX Shot Overview | Not yet audited | Per-page or shared — low risk, no locked-page consumer found | Low | None found |
| `StatusBadge`, `Icon` | Universal — every page including all 4 locked pages | Yes, validated everywhere | **Global polish only, deferred** (§K) | Maximum if changed carelessly | **All 4 locked pages** |
| `DetailedContext` | VFX/CG/Artist Overview pages | Contains the `<dl>`-for-prose pattern (§D/§E) | Per-page, since content differs, but the *pattern fix* (if any) should be decided once and reused | Low (collapsed by default) | None |

---

## G. Product / IA questions discovered

These are flagged, not resolved or silently folded into the visual plan.

1. **CG Task Overview and Execution show the same 3 fields (of 8) with near-identical wording.** Is Overview meant to be a compact *summary* tier and Execution the *full working detail* tier (in which case the duplication is presentational and fixable the same way the Artist Anchor's `downstream_effect` dedup was), or is this intentional reinforcement? Needs a product decision before the visual fix, not just a design call.
2. **`AnchorContextSummary` (row-level component) has never been through a content-contract or visual-language audit**, unlike `AnchorContextLayer`. It feeds 9 row components including the locked VFX Review Inbox. Before migrating anything that touches it, someone should confirm whether its current field selection is still the intended one.
3. Carried over from `ARTIST_ANCHOR_CONTEXT_CONTENT_AUDIT.md` §K, still unresolved and now confirmed relevant beyond Artist: **`context.attention.link_target` (feeding every role's "Related Context" capability) is only ever populated for `vfx_supervisor` in the backend.** CG and Artist's Related-Context capability is currently always-dead code, not a visual issue.
4. Also carried over: **`open_vfx_escalation` is computed by the backend but rendered nowhere in the entire frontend.** Worth a product/backend conversation before any migration work assumes it's either "handled elsewhere" or "safe to ignore."
5. **`/shots/**` disposition.** It's confirmed legacy and nav-orphaned, but it's still a live read/write surface hitting the real API. This plan does not include it as a migration target, but someone should decide whether it should eventually be deleted, moved behind a dev-only flag, or left exactly as-is — that's a product/repo-hygiene decision, not a visual one.

---

## H. Migration batches

**Prerequisite (not a batch, fold into whichever batch touches these files):** the two confirmed token issues — `--state-danger*` undefined in `ReanchorProposalReview.module.css`, and stale `--accent-agent-*` (should be `--accent-selected-*`) in `ExecutionAnchorEditor.module.css`/`DependencyRow.module.css`/`RecordDependencyForm.module.css` — are trivial, zero-visual-risk token hygiene, not migration work. Fix them as part of Batch A/B when those specific files are touched anyway.

### Batch C — Worklist-family consistency (do first)

- **Pages, split by role (item 4 of this reconciliation pass):**
  - **VERIFICATION ONLY** (no concrete finding — confirm in browser, do not invent work): `/vfx`, `/cg` (Workspace Homes), `/cg/inbox`, `/artist/inbox`, `/vfx/shots`, `/cg/tasks`, `/artist/tasks` (list pages) — 7 pages.
  - **IMPLEMENTATION TARGET, conditional:** `/artist` (Workspace Home) — the Why/How/What card grid flagged in §E. Before doing any work, first inspect the real card content lengths; only proceed with a semantic-block-style fix if the content genuinely varies in length the way §E suspects. If the content turns out to be short/predictable, reclassify this page VERIFICATION ONLY too and do nothing.
- **Shared components involved:** `SummaryCard`, `Grid`, `AnchorContextSummary`, row components (`InboxRow`, `CgTaskRow`, `ArtistTaskRow`, list-row variants)
- **Migration goal:** confirm the already-locked Worklist archetype grammar (VFX Review Inbox) is already consistently expressed across its CG/Artist siblings (expected outcome for 7 of 8 pages: no change needed); resolve the Artist Workspace Home's card grid only if inspection confirms it's a real instance of the anti-pattern.
- **Grammar reference:** `ICAS_VISUAL_LANGUAGE_V1.md` §24.1 Worklist grammar
- **Product-risk:** LOW throughout
- **Effort:** none for the 7 verification-only pages; S–M for Artist Workspace Home, only if confirmed
- **Prerequisites:** none
- **Acceptance screenshots:** 1 confirmation screenshot per verification-only page (7 pages, "looks consistent, no change made"); for Artist Workspace Home, 1 default view + (if changed) 1 populated-multi-item view
- **Locked pages needing regression review:** none — `AnchorContextSummary` no longer touches any locked page (§F correction); listed here only because this batch is where its 8 real consumers live, should Batch E later find something to fix

### Batch D — Artist Task Overview

- **Pages:** `/artist/tasks/[taskId]` — **IMPLEMENTATION TARGET** (standard): the guidance `Panel`'s four undifferentiated stacked lists, and the `<dl>`-for-prose inside `DetailedContext` (§D).
- **Shared components involved:** `DetailedContext`, `Panel`, `WorkingDirectionSection`
- **Migration goal — composition is NOT pre-decided.** The Artist Anchor Context's Core/Execution/Readiness compact-semantic-block composition is a **role/surface-specific implementation**, locked for that one surface, and must not be treated as a template to reapply here. Task Overview has a different content shape (four guidance-list categories, a current-focus panel, and a detail disclosure — not two Anchors plus a readiness state), so this batch must derive its own composition from Task Overview's actual locked content and page responsibility, not copy the Anchor's block structure.
  What Task Overview **may** reuse from the validated Visual Language, as *principles*, not as a prescribed layout:
  - hierarchy principles (what the Artist needs to read first vs. on inspection);
  - narrative grouping principles (related facts read as one block rather than one row per field, where the content genuinely calls for it);
  - Human > Agent authority ordering (Supervisor feedback/Current Focus above Agent-authored guidance);
  - natural text wrapping (no arbitrary `ch` caps);
  - surface discipline (no card-soup, no containers added just to look designed).
  Do not prescribe Core/Execution/Readiness-style blocks unless the actual four guidance categories genuinely support that specific shape once inspected during implementation.
- **Grammar reference:** `ICAS_VISUAL_LANGUAGE_V1.md` §9.5 (Narrative composition principles only) and §24.4 (Work archetype priority order); **not** §23 as a template
- **Product-risk:** LOW–MEDIUM (no edit forms, read-only guidance display)
- **Effort:** M
- **Prerequisites:** none
- **Acceptance screenshots:** 1 default, 1 expanded `DetailedContext` state, 1 no-guidance-yet state
- **Locked pages needing regression review:** Artist Current Version (shares the frame + `AnchorContextLayer`, not this page's own body)

### Batch A — VFX Shot supporting pages

- **Pages:** `/vfx/shots/[shotId]` (Overview, **TARGET** — light) and `/vfx/shots/[shotId]/versions` (**TARGET** — standard) as one lower-risk group; `/vfx/shots/[shotId]/activity` (**VERIFY** — no concrete finding, confirm only) folded into the same regression pass since it shares the frame; `/vfx/shots/[shotId]/intent` (**TARGET** — heavy) **split out as its own gated sub-step**
- **Shared components involved:** `DetailedContext`, `WorkingDirectionSection`, `AgentContributionPanel`, `EvidenceLayerSection` (Intent only), `FieldIcon` (Intent only)
- **Migration goal:** Overview/Versions/Activity — reduce `<dl>`-for-prose and card-nesting; Intent — reduce card-soup and deep grid nesting *without* touching the multi-conditional Core Anchor draft/confirm/gate-pending state logic.
- **Grammar reference:** §24.4 Work-adjacent (Overview/Versions), History sub-pattern (Activity), §24.2 Decision-adjacent (Intent — Human action + Agent + Evidence)
- **Product-risk:** LOW (Overview/Versions/Activity), **HIGH (Intent — real edit/confirm/gate forms)**
- **Effort:** S–M (Overview/Versions/Activity), **L (Intent)**
- **Prerequisites:** Batch C/D complete (team has practiced the pattern on lower-risk pages first)
- **Acceptance screenshots:** Overview/Versions/Activity — 1 default + 1 expanded-disclosure state per page (3 pages); Intent — 1 screenshot per real lifecycle state (no Anchor / draft / confirmed-no-draft / confirmed-plus-newer-draft-pending-gate)
- **Locked pages needing regression review:** VFX Alignment (shares `VfxShotWorkspaceFrame` + standard `AnchorContextLayer`)

### Batch B — CG Task supporting pages

- **Pages:** `/cg/tasks/[taskId]` (Overview, **TARGET** — standard) and `/cg/tasks/[taskId]/activity` (**VERIFY** — no concrete finding, confirm only) as the lower-risk group; `/cg/tasks/[taskId]/dependencies` (**TARGET** — standard–heavy) next; `/cg/tasks/[taskId]/execution` (**TARGET** — heavy) **split out as its own gated sub-step, last**
- **Shared components involved:** `Panel`, `DetailedContext`, `EvidenceLayerSection`, `AgentContributionPanel`, `AuthorityBoundary`/`AuthorityLabel` (Execution only)
- **Migration goal:** Overview — resolve the 3-field duplication with Execution (pending the §G.1 product decision) and the stacked-`Panel` card issue; Dependencies — reduce card-on-card, introduce the shared semantic vocabulary it currently lacks entirely, fix the stale purple token; Execution — reduce the 8-field `<dl>`-for-prose pattern and inconsistent card usage *without* touching the real draft/confirm/discard Execution Anchor workflow.
- **Grammar reference:** §24.4 Work-adjacent (Overview), Worklist-adjacent + Decision-adjacent (Dependencies), §24.2 Decision-adjacent (Execution)
- **Product-risk:** LOW (Overview/Activity), MEDIUM (Dependencies), **HIGH (Execution — real write/confirm/discard forms)**
- **Effort:** M (Overview), M–L (Dependencies), **L (Execution)**
- **Prerequisites:** §G.1 answered before touching Overview's duplicated fields; Batch A's Intent sub-step completed first (same risk class, reuse what was learned)
- **Acceptance screenshots:** Overview — default + expanded `DetailedContext`; Dependencies — default, one Open/one Resolved state, the Record form in its default state; Execution — one screenshot per real lifecycle state (no Anchor / draft / confirmed / confirmed-plus-newer-draft), matching Intent's approach
- **Locked pages needing regression review:** none directly (CG Version Review uses the isolated "review" variant), but re-verify the shared standard-variant `AnchorContextLayer` chrome still matches VFX Alignment after this batch

### Batch E — Global shared-component consistency (do last)

- **Scope, corrected per §F's current-code reconciliation:**
  - `AnchorContextSummary` audit (**VERIFY** — currently un-reviewed against final Visual Language, but confirmed to touch **zero** locked pages now that `WorkItemRow` no longer renders it; a real fix here, if any, only affects non-locked list/inbox rows)
  - `SignalStrip` consistency check (**VERIFY** — already validated on its 2 real current locked-page consumers, VFX Alignment and CG Version Review; Artist Current Version is no longer a consumer at all and does not need re-checking here)
  - `AgentContributionPanel` review (**VERIFY** — confirmed to touch zero locked pages; 3 non-locked consumers only)
  - `Icon`/`StatusBadge` family review (**VERIFY** — universal, touches all 4 locked pages if anything is found)
- **Migration goal:** confirm these shared surfaces are still consistent with the final Visual Language after all individual pages have settled — this is verification/light-touch, not a redesign. The blast radius is smaller than previously documented: only `Icon`/`StatusBadge` still carries multi-locked-page risk; the other three components no longer touch any locked page.
- **Grammar reference:** `ICAS_VISUAL_LANGUAGE_V1.md` §25 (shared grammar)
- **Product-risk:** LOW (verification-only) unless a real change is found, in which case treat as its own separate, carefully-scoped follow-up
- **Effort:** S (audit) to L (if a real fix is needed)
- **Prerequisites:** Batches A–D complete
- **Acceptance screenshots:** none required for the audit itself; a resulting `Icon`/`StatusBadge` fix would need full regression across all 4 locked pages; a resulting `AnchorContextSummary`/`AgentContributionPanel`/`SignalStrip` fix needs regression only against their own (now non-locked, except SignalStrip's 2 locked) consumers
- **Locked pages needing regression review:** VFX Alignment + CG Version Review (only if `SignalStrip` changes); all 4 (only if `Icon`/`StatusBadge` changes); none for `AnchorContextSummary`/`AgentContributionPanel`

---

## I. Recommended implementation order

> **Order unchanged by this reconciliation pass.** The current-code corrections in §F lower Batch E's blast radius (2 of its 4 components no longer touch any locked page) and clarify that most of Batch C is verification rather than implementation, but neither finding changes the *sequence* — low-risk/verification first, gated high-risk authoring pages last, shared-component work only after individual pages have settled, still holds.

1. **Batch C** (Worklist-family — now confirmed mostly verification-only) — lowest risk, lowest effort, reinforces an already-validated pattern across all three roles, safe place to build momentum.
2. **Batch D** (Artist Task Overview) — still low risk, and the Artist Anchor grammar is freshest in institutional memory right now.
3. **Batch A, low-risk group** (VFX Overview/Versions/Activity) — no edit forms, moderate effort.
4. **Batch B, low-risk group** (CG Overview/Activity) — same reasoning; resolve §G.1 before finishing Overview.
5. **Batch B, Dependencies** — medium risk, real write actions but simple state model.
6. **Batch A, Intent** (gated, HIGH risk) — do only after the team has practice from steps 1–5; extra browser-review cadence.
7. **Batch B, Execution** (gated, HIGH risk) — do last among page batches, directly reusing what was learned doing Intent (same risk shape: multi-state Anchor authoring form).
8. **Batch E** (shared-component consistency) — only after every individual page is settled, since it has the widest blast radius.
9. **Global final polish** (§K) — once, after everything above.

This is 8 controlled batches with browser acceptance between each, not one all-pages migration.

---

## J. Browser acceptance plan

| Batch | Minimum screenshots |
|---|---|
| C — verification-only (7 pages) | 1 confirmation screenshot per page — "already matches, no change made" |
| C — Artist Workspace Home (conditional target) | 1 default view; +1 populated-multi-item view only if the card grid is actually changed |
| D (target) | 1 default, 1 expanded `DetailedContext`, 1 no-guidance-yet state |
| A — Overview/Versions (targets) | 1 default + 1 expanded-disclosure state per page (2 pages) |
| A — Activity (verify) | 1 confirmation screenshot |
| A — Intent (target, gated) | 1 screenshot per real lifecycle state (4 states) |
| B — Overview (target) | 1 default + 1 expanded `DetailedContext` state |
| B — Activity (verify) | 1 confirmation screenshot |
| B — Dependencies (target) | 1 default, 1 Open-items state, 1 Resolved-items state, 1 Record-form state |
| B — Execution (target, gated) | 1 screenshot per real lifecycle state (4 states) |
| E | none for the verification items; full regression only against the specific locked page(s) named in Batch E's scope if a real change is made |

Kept deliberately minimal — no batch requests every conceivable state, only the states that actually exist as distinct conditional branches in the code.

---

## K. Deferred final-polish checklist

Explicitly **not** done during any migration batch above unless it's blocking that batch's own work:

- cross-page spacing consistency
- small typography adjustments
- tiny alignment issues
- header eyebrow duplication
- minor icon-size inconsistencies
- responsive edge cases
- residual premature wrapping
- minor disclosure-arrow consistency
- small badge density inconsistencies

These are collected into one pass after Batch E, not mixed into per-page migration work.

---

## L. Final migration checklist

`[T]` = implementation target (concrete finding, real change expected). `[V]` = verification only (no concrete finding — confirm in browser, do not invent work). Every real page must be addressed as one or the other before ICAS Visual Language v1 can be called migrated across the full product.

**Locked — reference only, no redesign:**

- [x] VFX Review Inbox
- [x] VFX Alignment
- [x] CG Version Review
- [x] Artist Current Version

**Batch C:**

- [ ] `[V]` `/vfx` Workspace Home
- [ ] `[V]` `/cg` Workspace Home
- [ ] `[T]` `/artist` Workspace Home — conditional on §E confirming real content-length variability; reclassify `[V]` if not confirmed
- [ ] `[V]` `/vfx/shots` list
- [ ] `[V]` `/cg/tasks` list
- [ ] `[V]` `/artist/tasks` list
- [ ] `[V]` `/cg/inbox`
- [ ] `[V]` `/artist/inbox`

**Batch D:**

- [ ] `[T]` `/artist/tasks/[taskId]` Task Overview — composition derived from its own content, not the Artist Anchor's block structure (§6)

**Batch A:**

- [ ] `[T]` `/vfx/shots/[shotId]` Shot Overview
- [ ] `[T]` `/vfx/shots/[shotId]/versions`
- [ ] `[V]` `/vfx/shots/[shotId]/activity`
- [ ] `[T]` `/vfx/shots/[shotId]/intent` (gated, high-risk)

**Batch B:**

- [ ] `[T]` `/cg/tasks/[taskId]` Task Overview (pending §G.1 decision)
- [ ] `[V]` `/cg/tasks/[taskId]/activity`
- [ ] `[T]` `/cg/tasks/[taskId]/dependencies`
- [ ] `[T]` `/cg/tasks/[taskId]/execution` (gated, high-risk)

**Batch E (verification, not redesign — corrected regression scope):**

- [ ] `[V]` `AnchorContextSummary` shared-component audit (touches 0 locked pages)
- [ ] `[V]` `SignalStrip` consistency check (touches 2 locked pages: VFX Alignment, CG Version Review — not Artist Current Version)
- [ ] `[V]` `AgentContributionPanel` review (touches 0 locked pages)
- [ ] `[V]` `Icon`/`StatusBadge` family review (touches all 4 locked pages if anything is found)

**Explicitly out of scope for this migration (flagged in §G, not silently included):**

- `[V]` `/` Role Selection Home — confirmed needs nothing
- `/demo`, `/dev/**` — not product surfaces
- `/shots/**` — legacy, disposition is a separate product decision
