# ICAS Three-Role Workspace Home — Content & Responsibility Audit

> **Status:** Read-only content/product-architecture audit. No UI, CSS, routes, or product code were changed to produce this document.
> **Purpose:** Establish a correct content-responsibility model for Workspace Home (`/vfx`, `/cg`, `/artist`) — as distinct from Review Inbox and the Shot/Task Workspace — before any redesign begins.
> **Scope:** Product/content architecture only. No pixel layouts, CSS, component names, or visual composition are proposed here.

**Authorities read:** `docs/PROJECT_CONTEXT.md`, `docs/PRODUCT_SCOPE.md`, `docs/GLOSSARY.md`, `docs/ROLE_PERMISSIONS.md`, `docs/AGENT_CONTRACTS.md`, `docs/design/ICAS_DESIGN.md`, `docs/design/ICAS_VISUAL_LANGUAGE_V1.md`, `docs/design/ICAS_FULL_PRODUCT_MIGRATION_MAP.md`, `docs/product-improvement/00_ICAS_PRODUCT_IMPROVEMENT_BASELINE.md`, `docs/design/ARTIST_ANCHOR_CONTEXT_CONTENT_AUDIT.md`.

**Code read:** `apps/web/src/app/{vfx,cg,artist}/*WorkspacePage.tsx` and their row components; `apps/web/src/app/{vfx,cg,artist}/inbox/*ReviewInboxPage.tsx`; `apps/web/src/app/{vfx/shots,cg/tasks,artist/tasks}/*ListPage.tsx`; every Shot/Task tab page under `apps/web/src/app/{vfx/shots,cg/tasks,artist/tasks}/[id]/**`; `apps/web/src/design/semantic/anchor-context/AnchorContextLayer.tsx` and `AnchorContextSummary.tsx`; the `features/{vfx,cg,artist}/reviewInbox.ts` adapters.

---

## 1. Executive conclusion

**The current problem is not visual. It is architectural, and it is already documented — just never implemented.**

`docs/product-improvement/00_ICAS_PRODUCT_IMPROVEMENT_BASELINE.md` (status: *"Approved product-improvement source of truth"*) already states, in its own §11 "Page responsibility principles":

> **Workspace Home** answers: What should this role focus on now? ... What changed since the last human action? **It should not duplicate the full object list or deep object Overview.**
> **Review Inbox** ... remains work-item-first ...
> **Shots / Tasks** ... is an object catalogue, not the primary to-do list.

This is, almost verbatim, the three-level model the current instruction re-asserts. It was written down and approved, but it was never propagated into the two documents that actually govern how Home gets built:

- `docs/design/ICAS_DESIGN.md` §6.1 classifies **Workspace Home as a representative page of the same "Worklist Archetype" as Review Inbox, Shots, and Tasks** — i.e. the currently-authoritative page-archetype system tells an implementer that Home should look and behave like a work-item list, not like a distinct product surface.
- `docs/design/ICAS_FULL_PRODUCT_MIGRATION_MAP.md` explicitly tags all three Workspace Homes `"Worklist (object-row reuse)"`, rates them `LOW` risk, and concludes (for VFX/CG) *"no concrete finding"* / *"no change needed"* — i.e. the most recent visual-migration planning pass looked directly at this and signed off on it.

Current production code is faithful to *these* two documents, not to the Baseline's §11. Concretely, across all three roles:

- Home renders a **client-side-filtered slice of the exact same `*InboxItemRead[]` array** that backs the Shots/Tasks list and (via a different adapter) the Review Inbox — there is no Home-specific backend read, no synthesis, no cross-object aggregation beyond `Array.filter().length` counts.
- Home's "priority" rows use the **plain object-row component** (`InboxRow`/`CgTaskRow`/`ArtistTaskRow`) — literally the same component the Shots/Tasks list page uses (`ShotRow`/`CgTaskListRow`/`ArtistTaskListRow` are thin variants reusing the same CSS and helpers) — not even the role's own `*WorkItemRow` component that Review Inbox uses. Several current source-code doc comments *claim* these rows are "shared between Workspace Home and Review Inbox," but that is no longer true of the actual imports in `VfxWorkspacePage.tsx`/`CgWorkspacePage.tsx`/`ArtistWorkspacePage.tsx` — a stale-comment discrepancy worth correcting whenever this page is next touched, independent of the redesign itself.
- Every row on Home embeds the full compact `AnchorContextSummary` block (Anchor state+revision, direction, attention, readiness, next action) — the same component embedded in every Inbox and List row, and a strict subset of the same `AnchorContextLayer` shown in full on every Shot/Task tab.

So Home today is closer to *"the Shots/Tasks list, pre-filtered to 3-5 rows, with some counts on top"* than to a synthesized orientation surface. This audit treats that as the central problem to solve, and treats the Baseline's §11 (not the Worklist Archetype grouping) as the correct existing authority to build forward from. **Reconciling `ICAS_DESIGN.md` §6.1 and the Migration Map's Home disposition is itself an open decision for OWNER approval — see §16.**

The rest of this document builds the responsibility model, audits current duplication block-by-block for all three roles, derives each role's target Home content from the agreed Design Concept, and separates what is actually implementable today from what would be a new product capability.

---

## 2. Home vs Inbox vs Object Workspace responsibility model

| | **Level A — Workspace Home** | **Level B — Review Inbox** | **Level C — Shot/Task Workspace** |
|---|---|---|---|
| Verb sequence | Synthesize → Prioritize → Orient → Route | Enumerate → Inspect pending work → Resolve/enter action | Understand one object → Inspect evidence → Decide/execute |
| Primary question | "What deserves my attention across my current work, and why?" | "What specific work items are waiting for my action?" | "What is happening in this specific Shot/Task, and what do I do here?" |
| Scope | Cross-object / cross-Shot / cross-Task | Work-item-first, flat list, still cross-object | Single object, full depth |
| Existing doc anchor | `00_ICAS_PRODUCT_IMPROVEMENT_BASELINE.md` §11 "Workspace Home" | same §11 "Review Inbox"; `ICAS_DESIGN.md` §6.1 Worklist Archetype | Baseline §11 "Overview" (4 universal questions) + `ICAS_DESIGN.md` §6.2 Decision / §6.3 Review / §6.4 Work archetypes |
| Must NOT become | A detailed object workspace, or a second Inbox queue | — | — |

This is a **synthesis layer above** Level B, not a peer of it. Level B's job is completeness for one predicate ("what's actionable"); Level A's job is judgment across everything ("what matters most, and why, right now"). A page that filters the same array Inbox filters and shows the first N rows is not doing Level A's job — it is doing a truncated version of Level B's job.

---

## 3. Global responsibility matrix

Legend — **Home**: Primary / Summary only / Signal only / No. **Inbox**: Primary / Context only / No. **Object Workspace**: Primary / Supporting / No.

| Content item | Home | Inbox | Object Workspace | Source of truth |
|---|---|---|---|---|
| Overall workload / work-state (e.g. "N Tasks, N ready, N waiting") | **Primary** (aggregate counts) | No | No | Home computes client-side from the same inbox-item feed; no dedicated backend endpoint |
| Cross-object priority ("what should I look at first") | **Primary** | Context only (implicit via list order/`sort_rank`) | No | Currently: client-side derivation from `current_focus`/anchor-summary fields already on the inbox item; no dedicated ranking service |
| Specific pending work item (one row of actionable work) | Signal only (top 1) | **Primary** | Supporting (the object it routes to) | Inbox's adapters (`adapt*CurrentFocusToWorkItems` etc.) |
| Shot/Task identity | Summary only | Context only | **Primary** | Shot/Task record (ftrack-derived + internal) |
| Core Anchor | Signal only (state/count) | Context only | **Primary** (Intent/Overview tab) | `CoreAnchorRevisionRead`, VFX Supervisor-owned |
| Execution Anchor | Signal only (state/count) | Context only | **Primary** (Execution tab) | `ExecutionAnchorRevisionRead`, CG Supervisor-owned |
| Working Direction (concise "why") | Summary only (one line, Anchor-derived) | Context only | **Primary/Supporting** (guardrail on every tab via Anchor Context; full text on Intent/Execution) | `direction_summary` on Core/Execution Anchor |
| Intent Signal (Stable/Stretching/Drifting/Re-anchor Needed) | **Summary only** (aggregate distribution, e.g. "2 Shots need attention") | Context only (per-item attention badge) | **Primary** (Alignment tab) | `AnchorAttentionContextRead.level`/Cross-role Assessment's `intent_signal` — **see §12, partially a product gap: the canonical Stable/Stretching/Drifting/Re-anchor-Needed 4-state vocabulary from `GLOSSARY.md` is not the literal enum currently returned; today's field is `attention_level` (low/medium/high/not_assessed), a related but different vocabulary** |
| Alignment Assessment (Cross-role) | Signal only (attention-level count) | Context only | **Primary** (Alignment tab, VFX only) | `CrossRoleAssessmentRead` |
| Drift risk | Signal only (folded into attention signal) | No | **Primary** (Alignment tab: `drift_risks[]`; Intent tab: same field, editable) | Core Anchor revision `drift_risks[]` |
| Cross-role conflict / tension | **Summary only** (aggregate signal, e.g. "1 Shot has a cross-role tension") | No (not currently modeled as its own work-item type) | **Primary** (Alignment tab's `cross_role_tensions` finding group) | `CrossRoleFinding[]` grouped by `cross_role_tensions` |
| Versions (list) | No | No | **Primary** (Versions/Version Review tab) | `VersionRead[]` |
| Version review (CG Supervisor Review of a Version) | Signal only (count/"ready for review") | **Primary** (as a work item, "Version review" category) | **Primary** (Version Review tab, full detail) | `CGSupervisorReviewRead` |
| Review Notes / feedback | Signal only (count) | **Primary** (as a work item, "Feedback"/similar category) | **Primary** (Current Version / Version Review tab: full note text) | `ReviewNote` records |
| Feedback clustering | **Not currently implemented anywhere** — see §12 | — | — | Defined as a VFX Supervisor Agent output in `AGENT_CONTRACTS.md` §5 ("feedback clusters and priorities") but not present in any current page |
| Dependencies | Signal only (open-count) | **Primary** (as a work item, "Dependency review" category) | **Primary** (Dependencies tab, full per-dependency detail) | `TaskDependencyRead[]` |
| Production readiness | **Summary only** (count of ready/blocked) | Context only | **Primary** (Execution tab's `production_ready_criteria`; Task Overview's "Execution operations") | Execution Anchor revision fields |
| Guidance (Artist) | Signal only (state/count) | **Primary** (as a work item, "Guidance update"/"Guidance available") | **Primary** (Task Overview's Guidance panel; full text on Current Version) | `ArtistGuidanceItem`/`guidance_output` |
| Next Human action | **Primary** (per top-priority item; the one thing Home should never omit) | **Primary** (per work item — this is the whole point of Inbox) | **Primary** (Anchor Context "Readiness / next action"; each Decision Archetype page's own attention block) | `AnchorNextActionRead` (`title`/`why_now`/`downstream_effect`/`target_route`/`action_label`) |
| Human Gate | Signal only (implied by "draft pending"/"action required" state) | Context only | **Primary** (Intent/Execution tab confirm/reject UI) | `HumanGate`/pending-gate fields on the Anchor revision |
| Re-anchor recommendation | Signal only (folded into attention/drift signal) | No | **Primary** (Alignment tab's Re-anchor Proposal card) | `proposal_output` on the Cross-role Assessment |
| Human Decisions (confirm/reject/etc.) | No | No | **Primary** (each tab's own decision/provenance section) | `Decision` records |
| Activity / history | No | No | **Primary** (Activity/Feedback History tab); **Supporting** (Task Overview's "last 5" preview) | `*ActivityEventRead[]` |
| Evidence / provenance | No | No | **Supporting** (disclosure, per `ICAS_DESIGN.md` §5.5) | `ContextSnapshot`/`AgentRun` records |
| ftrack linkage | Signal only (badge, folded into row identity) | Context only (badge) | Supporting (badge on Version/row) | `source: "manual" \| "ftrack"` field |
| Recent changes ("what changed since I last looked") | **Primary** (this is one of Home's two defining questions per the Baseline) | No | Supporting (Activity tab shows it in full, per-object) | **Product gap — see §12: no "since last visit" timestamp/diff concept exists in any current API response** |
| Metrics / counts (totals, by-state breakdowns) | **Primary** (this is legitimate Home content, not duplication — see §9) | No | No | Client-side aggregation over the existing inbox-item feed (today); would ideally be a dedicated backend aggregate (see §12) |

**Read of the matrix:** Home's honest content set is narrow — one thing that's a genuine synthesis judgment (top current focus + why), a handful of aggregate signals (never full objects), and routes. Almost every "Primary" cell for Home is either a **count** or a **single top item**; almost every other row's Home cell is "Signal only" or "No." That narrowness is not a lack of ambition — it is the correct shape for a Home page, and it is what §§8–9 formalize as a hard content ceiling.

---

## 4. Current VFX Home duplication audit

Source: `VfxWorkspacePage.tsx`. Three blocks, in order.

| Home block | Current content | Duplicates | Classification | Why |
|---|---|---|---|---|
| **"Anchor actions"** (`InboxRow` + `anchorContext`, up to 5 rows) | Full row: shot/project name, `current_focus.title` as heading, complete `AnchorContextSummary` block (Anchor state+revision, direction, attention, readiness, next action), task/version secondary line, ftrack badge, CTA | **A** Review Inbox (same `current_focus` fields, same `AnchorContextSummary`); **C** Shot Overview (`CurrentFocusPanel` shows the identical `title`/`explanation` in full); **C** every Shot tab (`AnchorContextLayer` shows the full, uncompressed version of the same `AnchorContextSummary` fields) | **RECOMPOSE** | The underlying judgment ("this Shot needs VFX attention now, here's why") is legitimate Home content — but rendering the *entire* Anchor-summary block per row, identical to what Inbox and every Shot tab already show, is not synthesis, it's a truncated copy. Recompose into a single top-priority module with reduced field set (see §7) plus a small ranked list, not N full inbox rows. |
| **"Anchor health"** (5 `SummaryCard`s: confirmed/draft/none Core Anchor counts, medium/high attention counts) | Pure counts, computed client-side over `inbox.items` | **B** Shots list (same `core_anchor_state` field, filterable there); **C** Intent tab (full Core Anchor content); **C** Alignment tab (full attention/finding detail) | **KEEP** | This is the one block that is already doing Home's actual job: aggregate signal, not object duplication. The counts are a fact about the *set*, not a copy of any one object's detail. |
| **"Important Shots"** (`InboxRow` without `anchorContext`, next 3 rows not already shown above) | Same row component as block 1, minus the Anchor-summary block; falls back to `current_focus.title`/`"Open Shot"` | **B** Shots list (this is, field-for-field, a truncated, unfiltered slice of the Shots list — `ShotRow` differs from this exact `InboxRow` usage only in swapping one label field) | **REMOVE AS DUPLICATE** | This block has no synthesis value at all: it is not "next 3 by priority," it is "next 3 in array order that aren't already above." It duplicates the Shots list with strictly less filtering/context than the Shots list itself provides. Its only honest function — "there's more to see" — is already served by the "View all Shots →" link the block already contains. |

---

## 5. Current CG Home duplication audit

Source: `CgWorkspacePage.tsx`. Four blocks (including page chrome).

| Home block | Current content | Duplicates | Classification | Why |
|---|---|---|---|---|
| **"Execution Anchor actions"** (`CgTaskRow` + `anchorContext`) | Full row: task/shot/project name, focus-title line, complete `AnchorContextSummary`, production-context line, CTA | **A** Review Inbox (`CgTaskWorkItemRow`, same `current_focus` fields via a *different* row component); **C** Task Overview (`TaskCurrentFocusPanel`); **C** every Task tab (`AnchorContextLayer`, full Anchor detail) | **RECOMPOSE** | Same reasoning as VFX block 1. Notably, this block reuses `CgTaskRow` — the **Tasks-list** row component — not `CgTaskWorkItemRow` (the Inbox's own row), despite the section header framing itself as "actions" (Inbox-like language). This is presentation-layer evidence of the same architecture problem: Home is built from the List page's component, not from a Home-specific one. |
| **"Execution readiness"** (5 `SummaryCard`s: confirmed/draft/missing Execution Anchor, ready-for-review, open-dependency counts) | Pure counts over `inbox.items` | **B** Tasks list (`execution_anchor_state` filterable there); **C** Execution tab (full 8-field Execution Anchor); **C** Dependencies tab (full per-dependency detail) | **KEEP** | Genuine aggregate signal, same reasoning as VFX's "Anchor health." |
| **"Important Tasks"** (`CgTaskRow`, no `anchorContext`, next 3 not already shown) | Same row component as block 1, minus Anchor-summary | **B** Tasks list (strict subset of `CgTaskListRow`'s field set: Tasks list additionally shows `department` and always attempts an anchor context) | **REMOVE AS DUPLICATE** | Same reasoning as VFX's "Important Shots" — array-order filler, not a priority judgment, and already covered by the "View all Tasks →" link. |
| Page chrome (breadcrumb/header) | No data | — | **KEEP** | Not a content block. |

---

## 6. Current Artist Home duplication audit

Source: `ArtistWorkspacePage.tsx` (committed state — see note below on the uncommitted, rejected visual variant).

> **Note on file state:** this file currently also carries an uncommitted, OWNER-rejected visual-migration attempt (a `Panel`/`readyClause` restyling of the block below) sitting locally, outside the committed history. This audit evaluates the **committed** content (`Grid` of three `SummaryCard`s), since that is the accepted current implementation; the uncommitted variant changes presentation, not the underlying fields, so this audit's conclusions apply to both.

| Home block | Current content | Duplicates | Classification | Why |
|---|---|---|---|---|
| **"Ready to work" — single-task case** (`readyTasks.total_count === 1`) | Bespoke inline markup (not a shared row): task/shot name + 3 `SummaryCard`s — **Why** (`core_direction` + Core Anchor revision), **How** (`execution_direction` + Execution Anchor revision), **What to do now** (`next_action.title` + guidance state) | **C** `AnchorContextLayer`'s Artist `AuthorityChain` (same Why/How/What-to-do-now triad, same underlying fields: `core_anchor.direction_summary`, `execution_anchor.direction_summary`, `next_action.title`); **C** Task Overview's full Guidance panel (executive summary + 4 structured lists) for "What to do now" specifically | **KEEP BUT REDUCE TO SUMMARY** | This is the closest any current Home page comes to a real Level-A synthesis module — it already reduces three Anchor/Guidance objects to one line each. It duplicates `AnchorContextLayer`'s content model (same 3-part shape) but Home's version is *more* reduced, not less — the correct direction, just needs the redundant field set (Anchor revision numbers, which add nothing a Human decides on) trimmed and an explicit acknowledgment that this triad's true source of truth is the Anchor Context, not a Home-owned computation. |
| **"Ready to work" — multi-task / zero case** (`ArtistTaskRow` list) | Full row: task/shot name, focus title, complete `AnchorContextSummary`, production-context line, CTA | **A** Review Inbox (`ArtistTaskWorkItemRow`, same `current_focus` fields via a different row component); **B** Tasks list (`ArtistTaskListRow`, near-identical, adds Execution-Anchor-state/Guidance-state/department) | **RECOMPOSE** | Same reasoning as VFX/CG block 1 — full-row duplication the moment there is more than one ready Task. The single-task case (above) proves a reduced form is possible; the multi-task fallback should use the same reduced form, ranked, not the full row. |
| **"Waiting for upstream direction"** (`ArtistTaskRow` list) | Same full row as above | **A** Review Inbox; **B** Tasks list | **RECOMPOSE** | Same reasoning. |
| **"Task overview"** (7 `SummaryCard`s: total/ready/waiting/attention/guidance/feedback/blocked counts) | Pure counts over `inbox.items` + the two summary lists' `total_count` | **B** Tasks list (several of these counts are literally the same predicate as a Tasks-list filter, e.g. "Requiring attention" ≡ the `attentionOnly` checkbox); **C** various tabs for full detail | **KEEP BUT REDUCE** | Aggregate signal is correct Home content, but 7 tiles is more than a landing page needs (see §9's ceiling discussion) — several of these counts (e.g. "Total Tasks," which has no decision attached to it) carry no action value and could be dropped or folded, not because they duplicate content elsewhere, but because they don't answer either of Home's two defining questions ("what should I focus on," "what changed"). |

**Cross-role pattern:** all three roles show the identical structural mistake (full-row duplication once past the single-item case) and the identical structural correctness (aggregate `SummaryCard` counts). Artist's single-Task case is the one existing implementation detail worth preserving as a *pattern*, generalized to the ranked-list case, not just the singular case.

---

## 7. VFX Home target responsibility

**Role statement:** *Prioritize creative attention.*

Per `PROJECT_CONTEXT.md` §6.1/§9.2 and `AGENT_CONTRACTS.md` §5, the VFX Supervisor (and their Agent) exists to interpret feedback, cluster and prioritize it, detect drift, identify cross-role tension, and decide when direction needs re-confirmation. Home should be the surface where that judgment is *entered*, not where its outputs are fully displayed.

Home should answer, per the instruction's own framing (confirmed against the Design Concept, not contradicted by it):

1. **Is creative direction broadly stable?** → one aggregate signal, derived from the distribution of attention levels / Intent Signal states across the Supervisor's Shots (today: `attention_level` counts; ideally the canonical Stable/Stretching/Drifting/Re-anchor-Needed vocabulary — see §12 gap).
2. **Where is creative attention most needed?** → a short ranked list (not a full row list) of Shots by attention level/urgency, title + one-line why, no full Anchor-summary block per row.
3. **Which Shots/issues should I review first, and why?** → the single top item, expanded slightly more than the rest of the list (mirrors Artist's existing single-task pattern), with a next-action route.
4. **Are feedback patterns or cross-role conflicts emerging?** → a signal only, e.g. "N Shots have a cross-role tension flagged" — **this specific capability (clustering) does not exist in current data; only "cross-role tension" as a Cross-role Assessment finding-group exists today, which can support a real count. "Feedback clustering" itself is a product gap (§12).**
5. **What changed since I last looked?** → **not currently supported by any API** (§12 gap) — Home cannot honestly answer this question today without new backend support (a last-visit timestamp or a recent-changes feed).

**Must not duplicate:** full Shot Anchor content (Intent tab owns this), full Alignment Assessment findings (Alignment tab owns this), full feedback/Review-Note text (Versions tab owns this), full Version Review, full Decision history. Home may name *that* something needs attention and *why in one sentence* — never the underlying finding text, editable fields, or provenance.

---

## 8. CG Home target responsibility

**Role statement:** *Control execution readiness.*

Per `PROJECT_CONTEXT.md` §6.2/§9.3, the CG Supervisor judges technical feasibility, production-readiness, downstream dependency impact, and whether/when to escalate to VFX. Home should surface the *state* of that judgment across all Tasks, not the judgment mechanics themselves.

1. **Is execution broadly ready/healthy?** → aggregate signal from confirmed/draft/missing Execution Anchor + open-dependency distribution (this is close to what "Execution readiness" already does — the one block worth keeping largely as-is).
2. **What is blocked or at production risk?** → short ranked list of Tasks by blocker severity/open-dependency count, not the full dependency description (that's Level C).
3. **Which technical decisions need attention first?** → top item + reason, routed to Execution or Version Review tab as appropriate.
4. **Where are dependencies affecting downstream work?** → a count/signal ("N Tasks blocked by downstream dependency"), never the dependency's own `description`/`kind`/`severity` fields (Dependencies tab owns those).
5. **Which issues may need VFX-level escalation?** → signal only, from `open_vfx_escalation`/dependency `kind === "conflict"` — a real, already-modeled field, safe to surface as a count.

**Must not duplicate:** the full Execution Anchor (8-field breakdown lives on Execution tab), the complete Dependencies chain (kind/description/severity/status/actor per item), detailed Version Review content (executive summary, technical concerns, questions), Task-specific execution constraints (`production_ready_criteria`/`technical_boundaries`/`escalation_conditions` full text), Task activity/history.

---

## 9. Artist Home target responsibility

**Role statement:** *Orient personal execution.*

Per `PROJECT_CONTEXT.md` §6.3/§8.3/§9.4, the Artist needs task *why*, current execution direction, what must be preserved vs. may vary, actionable guidance, and awareness of what requires upstream confirmation before they can proceed. Home is the daily entry point for "what do I do right now."

1. **What should I work on now?** → the single ready Task (already the strongest existing pattern — §6's "single-task case" — generalize its reduced Why/How/What-to-do-now shape to a short ranked list when more than one Task is ready, instead of falling back to full rows).
2. **What changed that affects my work?** → **product gap** (§12), same as VFX's equivalent question — no "since last visit" concept exists yet.
3. **What guidance/feedback requires attention?** → signal only: guidance-outdated count, feedback-needing-response count — never the guidance body or Review Note text (Task Overview / Current Version own those).
4. **What can safely continue?** → this is new framing not literally present today; derivable from the existing "ready" scope (Tasks whose Anchors are confirmed and current) without new backend work — a genuine, cheap win.
5. **What is waiting on upstream direction?** → the existing "Waiting for upstream direction" concept, kept, but reduced to a ranked list rather than full rows (§6).

**Must not duplicate:** the full Anchor Context (must-preserve/allowed-variation/execution-boundary text — Anchor Context panel on every tab already owns this), full Artist Guidance (executive summary + 4 structured lists — Task Overview owns this), full Current Version content (media, full Review Notes, full guidance history), complete Feedback History (chronological event list), detailed submission rationale.

---

## 10. Shared Workspace Home family grammar

All three current Homes already share an unstated structural grammar — the audit above shows the SAME three-block shape (priority rows → aggregate counts → filler rows) recurring independently in VFX/CG/Artist source. That convergence is evidence the family *should* share a grammar; the current one is simply the wrong one (a truncated Worklist, not a synthesis surface). Proposed replacement, stated as **information regions**, not layout:

- **A. Role Pulse** — one aggregate signal answering "is my area broadly stable/healthy?" (VFX: creative-direction stability; CG: execution readiness; Artist: is my Task set on track). One region, not a tile grid.
- **B. Primary Focus** — the single top-priority item (or, if none, an honest "nothing needs you right now" state), rendered with the reduced-field pattern Artist's single-Task case already proves out — never the full Anchor-summary/row block.
- **C. Attention / Ranked List** — a short (see the hard-maximum discussion below), ranked list of what else deserves a look, each entry reduced to title + one-line why + route — structurally similar across roles, differently ranked per role's own priority logic.
- **D. Scope Overview + routes** — the aggregate counts (the one thing all three current Homes already do correctly) plus explicit "go to Inbox" / "go to Shots-or-Tasks" routes, so Home never needs to reproduce either destination's own content to justify linking to it.

**Shared across all three:** the four-region shape; the "reduced item, never full row" rule; the "counts and signals only, no object detail" rule; routing rather than reproducing Inbox/List/Object content.

**Must be role-specific:** which fields feed the Role Pulse signal (creative-direction health vs. execution readiness vs. personal-Task health are different judgments, not the same field renamed); the ranking logic for the Attention list (VFX ranks by creative attention/drift signal, CG by production-risk/blocker severity, Artist by readiness + urgency); which counts appear in Scope Overview (VFX: Anchor-state distribution; CG: Anchor-state + dependency distribution; Artist: readiness + guidance + feedback distribution); the wording and tone of "why" (creative language for VFX, technical/production language for CG, task-instructional language for Artist).

### Hard-maximum philosophy

Rather than a fixed number, the ceiling should be **stated as a rule, applied per role**: *one Primary Focus item, an Attention list bounded by what's genuinely actionable right now (not a fixed slice of the full array), and counts that answer only "is this area healthy" — nothing that requires opening a second object to make sense of the number.* A fixed "top 3" is the wrong instrument when the honest count on a given day might be 0 or 1 — the current "Important Shots"/"Important Tasks" blocks are proof: they always render exactly 3 rows regardless of whether those 3 rows mean anything, which is precisely the failure mode a numeric ceiling alone doesn't prevent. The list should be allowed to be short (or empty, with an honest empty state) rather than padded to a target count.

---

## 11. Role-difference matrix

| | VFX Supervisor | CG Supervisor | Artist |
|---|---|---|---|
| **Statement** | Prioritize creative attention | Control execution readiness | Orient personal execution |
| **Primary question** | Is direction stable, and where does it need me first? | Is execution healthy, and what's blocked? | What do I work on now? |
| **Primary object of attention** | Shot (creative coherence across departments) | Task (execution translation + readiness) | Task (my own assigned work) |
| **Agent contribution** | Feedback interpretation/clustering, drift detection, review preparation (`VFX Supervisor Agent`, `AGENT_CONTRACTS.md` §5) — advisory only | Technical translation, production-readiness risk, downstream impact analysis (`CG Supervisor Agent`, §6) — advisory only | Task-why briefing, Anchor-to-action translation, output comparison, submission rationale (`Artist Agent`, §7) — advisory only |
| **Human decision/action** | Confirm/revise Primary (Core) Anchor; resolve creative-direction Human Gate; approve creative-direction change (`ROLE_PERMISSIONS.md` §2/§5) | Confirm/revise Secondary (Execution) Anchor; resolve technical-execution Human Gate; confirm production-ready state | Submit a Version; add Review Note within task context; accept/reject own draft/rationale — cannot confirm/revise either Anchor |
| **Must dominate Home** | Creative-attention signal + top Shot needing review | Execution-readiness signal + top blocked/at-risk Task | Current Task + why/how/what-to-do-now |
| **Must NOT dominate Home** | Full Alignment findings, full feedback text, per-Shot Version lists | Full 8-field Execution Anchor, full dependency chains, full Version Review content | Full Anchor Context text, full Guidance body, full Review Note history |

---

## 12. Data capability / gap matrix

| Proposed Home module/data | Classification | Notes |
|---|---|---|
| Core/Execution Anchor state counts (confirmed/draft/none) | **A. Already available** | Client-side count over existing `*InboxItemRead[].core_anchor_state`/`execution_anchor_state` — exactly what "Anchor health"/"Execution readiness" already compute |
| Attention-level counts (medium/high) | **A. Already available** | `AnchorContextSummaryRead.attention_level` already fetched for the anchor-actions join |
| Top-priority item + one-line why + route | **A. Already available** | `current_focus`/`next_action` fields already exist per item; only the *presentation* (reduced field set, ranked selection) is new, not the data |
| Open-dependency counts | **A. Already available** | `open_dependency_count` already on `CgInboxItemRead`/`ArtistInboxItemRead` |
| Guidance-state counts (Artist) | **A. Already available** | `guidance_state` already on `ArtistInboxItemRead` |
| Ranked "attention list" (more than the single top item, properly ordered by urgency rather than array order) | **B. Derivable from existing data** | The fields needed (`attention_level`, `readiness_state`, `sort_rank`, dependency counts) already exist per item; ranking logic itself does not exist yet and would need to be written (client-side is possible short-term; a backend-computed rank would scale better — implementation detail, not a data gap) |
| Cross-role tension count (VFX) | **B. Derivable from existing data** | Cross-role Assessment's `cross_role_tensions` finding group exists per Version/Shot today; aggregating it to a Home-level count requires a new read (currently only fetched per-Shot on the Alignment tab), not new backend capability |
| VFX escalation count (CG) | **B. Derivable from existing data** | `open_vfx_escalation` field already exists on `AnchorContextSummaryRead` |
| Intent Signal in the canonical Stable/Stretching/Drifting/Re-anchor-Needed vocabulary | **C. Implemented elsewhere but not currently exposed here** | `GLOSSARY.md` defines this 4-state vocabulary and it appears to inform `intent_signal.signal_output` on the Cross-role Assessment (Alignment tab), but the Home-relevant summary field (`AnchorContextSummaryRead.attention_level`) uses a different (low/medium/high/not_assessed) vocabulary — reconciling these is a real but bounded gap, not a new capability |
| Feedback clustering (grouping Review Notes/feedback by theme) | **D. Not currently implemented** | Named as a VFX Supervisor Agent output in `AGENT_CONTRACTS.md` §5 ("feedback clusters and priorities"), but no current page, adapter, or backend field produces a cluster — Review Notes are shown as a flat, unclustered list everywhere they appear (Versions tab, Current Version tab) |
| "What changed since I last looked" (recent-changes feed or last-visit diff) | **D. Not currently implemented** | No last-visit timestamp, no "recent changes" endpoint exists anywhere in the current API surface used by these pages; Activity/Feedback History tabs show full chronological history, not a "since-last-visit" delta |
| "Golden/Live data world" indicator | **D. Not currently implemented** | Referenced in `00_ICAS_PRODUCT_IMPROVEMENT_BASELINE.md` §11 as a Home-answerable question ("Which Golden/Live data world am I viewing?"), but this is a Package-C demo-data-provenance concept with no corresponding UI element in any current Home/Inbox/List/Object page read for this audit |
| "What can safely continue" (Artist) | **B. Derivable from existing data** | No dedicated field, but derivable as the subset of "ready" Tasks whose confirmed Anchors are current (not `outdated`) and have no open blocking dependency — all constituent fields already exist per item |
| Backend-computed Home aggregate endpoint (vs. today's client-side `Array.filter()` over the full inbox-item list) | **B. Derivable, not currently built** | Today's approach works at current data volumes but re-fetches/re-filters the entire inbox-item array to produce a handful of numbers; a dedicated aggregate read is an implementation optimization, not a new product capability — noted here because a redesign that adds more Home-level counts should not multiply client-side re-derivation without considering this |

**Do not fake Agent intelligence:** any Home module whose content would imply feedback clustering, an automatically-detected cross-role conflict beyond the existing `cross_role_tensions` finding group, or a "since you last looked" diff must be either scoped out of this redesign or explicitly flagged to OWNER as requiring new backend/Agent work before implementation — not approximated with static or misleading text.

---

## 13. Content that must be removed from Home

- **VFX "Important Shots"** and **CG "Important Tasks"** — array-order filler rows with no ranking logic, strictly duplicating the Shots/Tasks list with less context than the list itself provides. Already fully served by each block's own "View all →" link.
- **Full `AnchorContextSummary` block per row**, wherever it currently renders on Home (VFX "Anchor actions," CG "Execution Anchor actions," Artist's ready/waiting row lists) — Anchor state+revision, direction, attention, readiness, and next-action all rendered per row is object-level detail, not Home-level signal.
- **Full-row reuse of the List page's own row component** (`InboxRow`/`CgTaskRow`/`ArtistTaskRow`) for anything beyond the single top-priority item — if Home needs to show more than one item, it needs its own reduced presentation, not the List page's row.

---

## 14. Content that may remain only as summary/signal

- Core/Execution Anchor state, as a **count**, never as the row-level state+revision+direction bundle currently shown (VFX/CG/Artist "health"/"readiness" tiles — keep, this is the one already-correct pattern).
- Attention/urgency, as a **count or single top-item badge**, never as the full attention/finding detail (all three roles).
- Dependency/blocker presence, as a **count**, never as per-dependency `kind`/`description`/`severity` (CG, Artist).
- Guidance/feedback staleness, as a **count**, never as guidance body or Review Note text (Artist).
- Working Direction, as **one line** (already how `conciseDirection` renders it in the Anchor Context's collapsed state — Home can borrow this exact reduction), never the full scalar+collection Core/Execution Anchor content.
- Cross-role tension / VFX escalation, as a **count**, never as the finding text or dependency description.

---

## 15. Proposed information architecture for each Home (information regions only)

**VFX (`/vfx`)**
1. Role Pulse — creative-direction stability signal (derived from Anchor-state + attention-level distribution across Shots).
2. Primary Focus — top Shot needing creative review: title, one-line why, route.
3. Attention list — ranked Shots needing review beyond the top one (bounded by genuine urgency, not a fixed count); each entry: title + one-line why + route only.
4. Scope Overview — Anchor-state distribution counts, attention-level counts, cross-role-tension count (if the aggregation described in §12 is built); routes to Review Inbox and Shots.

**CG (`/cg`)**
1. Role Pulse — execution-readiness signal (derived from Execution-Anchor-state + open-dependency distribution across Tasks).
2. Primary Focus — top Task needing a technical decision: title, one-line why, route.
3. Attention list — ranked Tasks at production risk/blocked beyond the top one; each entry: title + one-line why + route only.
4. Scope Overview — Execution-Anchor-state distribution counts, open-dependency count, VFX-escalation count; routes to Review Inbox and Tasks.

**Artist (`/artist`)**
1. Role Pulse — personal work-set health signal (ready vs. waiting distribution).
2. Primary Focus — the current Task to work on: task/shot identity, Why (one line), How (one line), What to do now (one line) — generalizing the existing single-Task pattern.
3. Attention list — ranked additional ready Tasks (when more than one) plus Tasks waiting on upstream direction, each reduced to the same Why/How/What-to-do-now one-liners, not full rows.
4. Scope Overview — readiness/guidance/feedback-staleness counts (reduced from today's 7 tiles to the subset that answers "focus" or "changed," per §9); routes to Review Inbox and Tasks.

All three: no full `AnchorContextSummary`, no object-list rows beyond the reduced Primary Focus / Attention list items, no full guidance/finding/note text.

---

## 16. Open product decisions requiring OWNER approval

1. **Archetype reconciliation.** `ICAS_DESIGN.md` §6.1 currently classifies Workspace Home under the same "Worklist Archetype" as Review Inbox/Shots/Tasks, and `ICAS_FULL_PRODUCT_MIGRATION_MAP.md` rates the current Home implementation "no change needed." This audit concludes both should be superseded by `00_ICAS_PRODUCT_IMPROVEMENT_BASELINE.md` §11's already-approved Home/Inbox/Overview separation. OWNER approval is needed before `ICAS_DESIGN.md` is amended to give Home its own archetype (or an explicit sub-classification) distinct from Worklist — no visual-language doc was edited to produce this audit, per instruction.
2. **Ranking logic ownership.** The "Attention list" for all three roles needs a defined ranking (not array order). Whether this is computed client-side (fast to ship, doesn't scale) or via a new backend aggregate is a real architecture choice with cost implications, not a content question — flagged, not decided, here.
3. **Intent Signal vocabulary.** Whether to introduce the canonical Stable/Stretching/Drifting/Re-anchor-Needed states as a literal, Home-visible field (replacing or supplementing today's low/medium/high `attention_level`) is a domain-model decision beyond this audit's scope.
4. **Feedback clustering.** Confirmed product gap (§12). Decide whether VFX Home's "emerging feedback patterns" question is deferred until a real clustering capability exists, or answered today only via the narrower, already-real cross-role-tension count.
5. **"What changed since I last looked."** Confirmed product gap (§12), affecting both VFX and Artist Home's stated defining questions. Decide whether to scope this out of the redesign entirely, or commission the minimal backend support (a last-visit timestamp is the cheapest version) as a prerequisite.
6. **Hard-maximum enforcement.** §10 proposes a rule ("bounded by genuine urgency") rather than a fixed number. OWNER should confirm this is acceptable versus wanting an explicit numeric ceiling for implementation/testing clarity.
7. **Artist's contested "single ready Task" presentation.** An uncommitted, previously browser-rejected visual variant of this block exists locally (Panel/`readyClause` restyling). This audit's content conclusions (§6, §9) apply regardless of which visual form is eventually chosen, but the redesign should explicitly supersede — not silently inherit — whichever variant is on disk when implementation starts.
8. **Backend aggregate endpoint for Home.** §12's last row: today's Home pages re-derive every count client-side from the full inbox-item array. A redesign that adds more counts/signals should decide up front whether that pattern continues or a dedicated Home aggregate read is commissioned.
