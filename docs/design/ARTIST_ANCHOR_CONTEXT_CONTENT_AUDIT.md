# Artist Anchor Context — Content Contract Audit

> **Status:** Read-only content audit. No layout is proposed here; no code was changed to produce it.
> **Purpose:** Establish a precise content contract for the Artist Anchor Context (`AnchorContextLayer`, Artist-role branch) before further visual-layout iteration continues, so future work has a fixed reference for what content exists, why it exists, where it comes from, and which state it belongs to.
> **Scope:** `AnchorContextLayer.tsx`'s Artist-role rendering (collapsed state, shared with VFX/CG; expanded state, Artist-only via `ArtistExpandedAnchor` / `ArtistSecondaryDetail`), mounted frame-level in `ArtistTaskWorkspaceFrame.tsx` across all `/artist/tasks/:taskId/*` routes.
> **Change rule:** Update this document when the Artist Anchor Context's underlying data contract (`AnchorContextRead`) or its Artist-role presentation logic changes. It is a snapshot of the content contract, not a running implementation diary.

**Authorities read:** `docs/design/ICAS_DESIGN.md`, `docs/design/ICAS_VISUAL_LANGUAGE_V1.md` (§9.5), `docs/GLOSSARY.md`, `docs/ROLE_PERMISSIONS.md`, `docs/product-improvement/00_ICAS_PRODUCT_IMPROVEMENT_BASELINE.md` (§5.3, §5.4).

**Code read:** `apps/web/src/design/semantic/anchor-context/AnchorContextLayer.tsx` (full), `apps/web/src/design/semantic/anchor-context/presentation.ts`, `apps/web/src/app/artist/tasks/[taskId]/ArtistTaskWorkspaceFrame.tsx`, `apps/web/src/app/artist/tasks/[taskId]/current-version/CurrentVersionPage.tsx`, `apps/web/src/design/semantic/anchor-context/AnchorContextLayer.test.tsx`.

**Data model read:** `packages/contracts/python/src/intent_core_contracts/api/anchor_context.py` (the Pydantic source of `AnchorContextRead`), `apps/api/src/intent_core_api/anchor_context/service.py` (the derivation logic for every field).

---

## A. Artist Anchor surface map

- **Component:** `AnchorContextLayer` (`apps/web/src/design/semantic/anchor-context/AnchorContextLayer.tsx`). For Artist, the collapsed state is shared markup (`!expanded` branch, used by all three roles); the expanded state is an Artist-only render tree — `ArtistExpandedAnchor` + `ArtistSecondaryDetail` — reached via an early `if (context.role === "artist") return <ArtistExpandedAnchor .../>` branch that never touches the VFX/CG shared code path.
- **Mount point:** `ArtistTaskWorkspaceFrame.tsx` — **frame-level**, not page-level. It renders once per Artist task workspace and persists across every tab (`overview`, `current-version`, `feedback-history`) via `ContextTabs`.
- **Routes where Artist sees it:** every route under `/artist/tasks/:taskId/*` that uses this frame (confirmed: Task Overview, Current Version, Feedback History).
- **Collapsed vs expanded default:** `defaultExpanded={activeTab === "overview"}` — expanded by default only on the Overview tab; collapsed by default elsewhere, then remembered per-task via `sessionStorage` key `icas:anchor-context:artist:{task_id}`.
- **Role-specific branch:** yes — `ArtistExpandedAnchor`/`ArtistSecondaryDetail` are 100% Artist-only functions, never invoked for `vfx_supervisor`/`cg_supervisor`.
- **Shared code paths with VFX/CG:** the `context === null` unavailable state, the entire collapsed (`!expanded`) state, `attentionTone`, `contextStateLabel`, `revisionLabel`, `ATTENTION_LABEL`/`GUIDANCE_LABEL`, and the `conciseDirection`/`stripGeneratorLabel`/`upstreamState` presentation helpers.
- **Conditional states:** `context === null` (Anchor context failed to load — distinct from any field inside it being empty), `!expanded` (collapsed), `expanded` (Artist tree).
- **Adjacent-but-distinct surface, not covered by this audit:** `AnchorContextSummary` (`anchor-context/AnchorContextSummary.tsx`) is a different component used on Worklist-archetype rows (Task/Shot list rows, inbox rows) — it is not `AnchorContextLayer` and was intentionally out of scope here.

---

## B. Complete content inventory

Every item below is read directly from `ArtistExpandedAnchor`/`ArtistSecondaryDetail` (expanded) or the shared `!expanded` branch (collapsed), cross-checked against `AnchorContextRead`'s Pydantic definition and `anchor_context/service.py`'s derivation.

### Collapsed state (shared with VFX/CG)

| # | Display concept | Source field(s) | Source object | Kind | State | Conditional? | Editable? |
|---|---|---|---|---|---|---|---|
| C1 | "Anchor context" kicker | static label | — | navigation label | collapsed | no | read |
| C2 | Attention badge | `context.attention.level` → `ATTENTION_LABEL` | Attention | derived presentation state | collapsed | **yes** — hidden when `level === "not_assessed"` | read |
| C3 | Collapsed identity | `core_anchor.confirmed_revision_number`, `core_anchor.lifecycle_state` | Core Anchor | persisted domain data | collapsed | no (always renders; `revisionLabel`/`contextStateLabel` supply fallback text) | read |
| C4 | Collapsed direction | `execution_anchor?.direction_summary ?? core_anchor.direction_summary`, via `conciseDirection` | Execution Anchor (preferred) / Core Anchor (fallback) | persisted domain data (presentation-filtered) | collapsed | no (fallback: "No concise direction is available yet.") | read |
| C5 | "Show anchor context" button | — | — | disclosure control | collapsed | no | read |

### Expanded — Artist header

| # | Display concept | Source field(s) | Source object | Kind | State | Conditional? | Editable? |
|---|---|---|---|---|---|---|---|
| E1 | "Anchor context" kicker | static | — | label | expanded | no | read |
| E2 | Execution state badge | `execution_anchor.context_state` | Execution Anchor | status | expanded | yes — only if `execution` exists | read |
| E3 | Attention badge | `context.attention.level` | Attention | status | expanded | **no** — unlike C2, this one is unconditional and does render "Not assessed yet" | read |
| E4 | Guidance state badge | `context.guidance_state` | Guidance (task-level) | status | expanded | no | read |
| E5 | Upstream badge | `upstreamState(context)` (derived) | cross-cutting (Core/Execution Anchor state) | derived presentation state | expanded | yes — only if a real upstream blocker exists | read |
| E6 | "Collapse anchor context" button | — | — | disclosure control | expanded | no | read |

### Expanded — Primary narrative rows

| # | Display concept | Source field(s) | Source object | Kind | Conditional? | Editable? |
|---|---|---|---|---|---|---|
| P1 | Why (statement) | `core_anchor.direction_summary` via `conciseDirection` | Core Anchor | persisted domain data | no (fallback text) | read |
| P1a | Why (supporting metadata) | `core_anchor.confirmed_revision_number`, `.lifecycle_state` | Core Anchor | persisted domain data | no | read |
| P2 | What must I preserve | `core_anchor.must_preserve` via `stripGeneratorLabel` | Core Anchor | persisted domain data | no (fallback text) | read |
| P3 | What to do now (statement) | `next_action.title` | Attention/Readiness (computed) | computed readiness state | no | read |
| P3a | What to do now (why) | `next_action.why_now` | Attention/Readiness (computed) | computed readiness state | technically conditional on truthy `why_now`, but the field is non-optional `str` in the contract and every code path in `service.py` populates it, so it always renders in practice | read |
| P3b | What to do now (action link) | `next_action.target_route`, `.action_label`, `.executable` | Attention/Readiness (computed) | navigation/action | yes — genuinely conditional (all three must be truthy) | action (navigate) |

### Expanded — Secondary Artist detail

| # | Display concept | Source field(s) | Source object | Kind | Conditional? | Editable? |
|---|---|---|---|---|---|---|
| S1 | Current direction (statement) | Execution/Core `direction` (same value already resolved for the collapsed state, threaded down as a prop) | Execution Anchor (preferred) | persisted domain data | no (fallback text) | read |
| S1a | Current direction (metadata) | `execution_anchor.confirmed_revision_number`, `.context_state` | Execution Anchor | persisted domain data | no | read |
| S2 | Allowed to vary | `execution_anchor?.allowed_refinement ?? core_anchor.allowed_variation` | Execution Anchor (preferred) / Core Anchor (fallback) | persisted domain data | no (fallback text) | read |
| S3 | Execution boundary | `execution_anchor.execution_boundary` | Execution Anchor | persisted domain data | yes — only if execution exists and the field is truthy | read |
| S4 | Intent attention (statement) | `attention.summary ?? attention.review_requirement` | Attention | AI-derived summary (preferred) / rule-derived requirement (fallback) | no | read |
| S4a | Intent attention (sub-text) | `attention.review_requirement` | Attention | rule-derived, role-specific requirement text | no (`review_requirement` is non-optional `str`) | read |
| S5 | Readiness / next action (secondary) | `next_action.downstream_effect` | Attention/Readiness (computed) | computed readiness state | conditional in code, but `downstream_effect` is non-optional `str` and always populated by `service.py` — effectively always renders | read |
| S6 | Upstream state | `upstreamState(context)` — same derived value as E5 | cross-cutting | derived presentation state | yes — same truthiness gate as E5 | read |
| S7 | Draft distinction | `core_anchor.newer_draft_exists`, `.pending_human_gate_exists`, `.confirmed_revision_number`, `.draft_revision_number` | Core Anchor | persisted domain data + provenance | yes — genuinely conditional | read |
| S8 | Current draft source | `execution_anchor.draft_revision_number`, `.draft_source` | Execution Anchor | provenance/status | yes — genuinely conditional | read |
| S9 | Current production context | `current_version.name`, `.version_number` | Current Artist Task/Version | production context | no (fallback text) | read |
| S10 | Related context | `context.attention.link_target` (via the shared `hasContextLinks` gate) | Attention | navigation | yes — see §F/§K: structurally unreachable for Artist under the current backend contract | action (navigate) |

Everything listed in the source audit's illustrative checklist is accounted for above except `confirmed_by_actor_id`/`confirmed_by_human_role` (present in the contract, deliberately not surfaced to Artist — see §K) and Guidance-state prose (already removed by a prior correction turn; only the E4 badge remains).

---

## C. Collapsed content contract

| Item | Purpose | Source | Essential first-reading? |
|---|---|---|---|
| Attention badge (C2) | Signal whether anything needs the Artist's attention before they even open the panel | Attention | Yes |
| Core Anchor identity/state (C3) | Ground the Artist in *which* confirmed direction currently governs the shot | Core Anchor | Yes |
| Direction text (C4) | The actual creative direction sentence, prioritizing Execution over Core so Artist sees the department-translated version first | Execution Anchor → Core Anchor | Yes |

This is deliberately thin — three facts plus a toggle — consistent with `ICAS_DESIGN.md` §12 ("show a compact current-state summary first").

## D. Expanded content contract

| Item | Purpose | Source | Semantic owner | Primary guidance or supporting context? |
|---|---|---|---|---|
| E2–E5 (status badges) | At-a-glance state of everything that could block or qualify the Artist's work | Execution Anchor, Attention, Guidance, cross-cutting upstream | Attention/Readiness (as a cluster) | Supporting (state summary, not guidance itself) |
| P1 Why | The creative "why" behind the work | Core Anchor | Core Anchor | Primary execution guidance |
| P2 What must I preserve | The hard constraint the Artist cannot violate | Core Anchor | Core Anchor | Primary execution guidance |
| P3 What to do now | The concrete next step, computed from workflow/readiness state | Attention/Readiness | Attention/Readiness | Primary execution guidance |
| S1 Current direction | The department-specific (Execution Anchor) restatement of direction, one level more concrete than P1 | Execution Anchor | Execution Anchor | Supporting context |
| S2 Allowed to vary | The counterpart to "must preserve" — where flexibility exists | Execution Anchor / Core Anchor | Execution Anchor (preferred owner) | Supporting context (arguably primary — see §G) |
| S3 Execution boundary | A harder technical/production constraint distinct from "must preserve" | Execution Anchor | Execution Anchor | Supporting context |
| S4 Intent attention | The reasoning behind the attention level shown as a badge | Attention | Attention/Readiness | Supporting context |
| S5 Readiness / downstream effect | What happens next if the Artist acts | Attention/Readiness | Attention/Readiness | Supporting context |
| S6 Upstream state | Explains why the Artist may be blocked by someone else's pending action | Cross-cutting (Core+Execution Anchor state) | Provenance/supporting | Supporting context |
| S7 Draft distinction | Clarifies that a newer, unconfirmed draft exists without making it look authoritative | Core Anchor | Provenance/supporting | Supporting context |
| S8 Current draft source | Explains where a pending Execution Anchor draft came from | Execution Anchor | Provenance/supporting | Supporting context |
| S9 Current production context | Names the actual Version the Anchor facts apply to | Current Version | Production Context | Supporting context |
| S10 Related context | Navigation to Alignment — currently dead for Artist, see §F/§K | Attention | Provenance/supporting | Supporting context (when reachable) |

---

## E. Semantic ownership map

- **CORE ANCHOR:** C3, C4 (fallback source), P1, P1a, P2, S2 (fallback source), S7.
- **EXECUTION ANCHOR:** C4 (preferred source), E2, S1, S1a, S2 (preferred source), S3, S8.
- **CURRENT ARTIST TASK/VERSION:** S9.
- **ATTENTION/READINESS:** C2, E3, P3, P3a, P3b, S4, S4a, S5, S10.
- **GUIDANCE:** E4 only — the Anchor Context's Guidance badge is a status flag about the separate Artist Guidance panel elsewhere on the page; Anchor Context itself carries no Guidance *content*, only its current/outdated/missing/unavailable state.
- **PRODUCTION CONTEXT:** S9 (same item as above; "Production Context" and "Current Artist Task/Version" collapse to one thing here).
- **PROVENANCE/SUPPORTING CONTEXT:** E5, S6 (upstream — cross-cutting, listed here since its purpose is explanatory/provenance-like even though it draws on both Anchors), S7, S8.
- **OTHER:** none needed.

---

## F. Duplication analysis

### A. True presentation duplication (found, not yet acted on)

1. **Upstream state (E5 vs S6).** When `upstreamState(context)` is truthy, the identical string renders twice: once as the header status badge, once as a full secondary row with the same text as its sole content. Same fact, same wording, no different reading purpose between the two — the same shape of duplication as the Guidance-badge issue already fixed in a prior turn, just not caught then because it wasn't in the primary-row scope.
2. **Intent attention (S4 vs S4a) — conditional duplication.** When `attention.summary` is null (which happens whenever no AI/rule summary has been generated for the current signal), `context.attention.review_requirement` is used as both the main content (S4) and the `<small>` sub-text (S4a) — the identical sentence appears twice in the same row. When `summary` *is* present, this is legitimate reinforcement (see category B below) — but the null-summary case is a true duplicate the current code doesn't distinguish.

### B. Necessary reinforcement (do not merge)

- Intent attention when `attention.summary` is present: main text = AI-interpreted summary, sub-text = the role-specific rule requirement — genuinely different facts (interpretation vs. rule).
- Why (P1) vs Current direction (S1): P1 is the Core Anchor's own direction; S1 is the Execution Anchor's (department-translated) direction. Different revision, different authority (VFX vs. CG), legitimately both needed — this is the WHY/HOW split from `00_ICAS_PRODUCT_IMPROVEMENT_BASELINE.md` §5.3, just positioned as primary+secondary rather than as siblings (see §K.6).
- "Execution ... state" badge (E2) vs S1a's "Execution Anchor R{n} · {state}" metadata: the badge is a quick status flag; S1a is the same fact restated as supporting metadata attached to the actual direction prose it qualifies. Borderline — flagged as reinforcement rather than duplication because they serve different reading moments (scan vs. read), but worth a second look at the next visual pass.

### C. Similar wording, different semantic meaning (must not be merged)

- Must preserve (P2, Core Anchor) vs Execution boundary (S3, Execution Anchor): P2 is a creative constraint from VFX; S3 is a technical/production constraint from CG. Different owners, different authority, must stay separate per `ROLE_PERMISSIONS.md`'s Core/Execution Anchor split.
- Allowed to vary (S2) vs the P3 "What to do now" action: S2 describes a boundary, P3 describes a specific next step — not interchangeable even though both are "positive-space" guidance.
- Readiness / next action (P3, primary "why_now") vs Readiness / next action (S5, secondary "downstream_effect"): already deduplicated in a prior turn — P3 explains why this action now, S5 explains what happens after you act. Different tenses, different facts, correctly kept separate.

---

## G. P1 / P2 / P3 information priority (expanded state only)

| Item | Priority | Why |
|---|---|---|
| P1 Why | P1 | Artist cannot correctly interpret anything else without knowing the creative intent first |
| P2 What must I preserve | P1 | A hard constraint; violating it silently is the exact failure mode ICAS exists to prevent |
| P3 What to do now | P1 | The concrete action — this is literally "what to execute right now" |
| E2–E5 status badges | P1 | Gate everything else — a blocked/outdated state changes how the Artist should read the rest of the panel |
| S1 Current direction | P2 | One level more concrete than Why, needed to actually execute, but P1's Why is the thing that must land first |
| S2 Allowed to vary | P2 | Directly execution-relevant (defines safe exploration space) — arguably borderline-P1 |
| S3 Execution boundary | P2 | Important but narrower/more technical than must-preserve; relevant when doing the work, not before starting to read |
| S4 Intent attention | P2 | Explains why the attention badge says what it says — supporting reasoning for a P1 signal |
| S5 Readiness / downstream effect | P2 | Useful for understanding consequences, not needed to decide the immediate action |
| S6 Upstream state | P3 | Explanatory/provenance — only matters once the Artist realizes they're blocked |
| S7 Draft distinction | P3 | Provenance — protects against confusing an unconfirmed draft with the real Anchor, but only relevant on inspection |
| S8 Current draft source | P3 | Pure provenance |
| S9 Current production context | P3 | Identifies which Version the facts apply to — useful for cross-checking, not for deciding what to do |
| S10 Related context | P3 | Navigation convenience, not information |

This priority classification is informational only — it is not permission to hide or delete P2/P3 items.

Note: S2 "Allowed to vary" is arguably as decision-critical as P2 "Must preserve" (they are the two halves of the same boundary), which is worth flagging for the next visual-design step even though this audit does not recommend moving it.

---

## H. Content-length / behavior risks

| Field | Length profile | Notes |
|---|---|---|
| `core_anchor.direction_summary` | Short–medium sentence typically; `confirmed.core_summary or confirmed.shot_objective` — either field could vary in length depending on which one was populated at confirm time | Filtered by `conciseDirection`: a single-alphanumeric-character value is treated as a placeholder and replaced with fallback text — legacy/demo rows with terse placeholder direction text will silently show the "unavailable" fallback, not the raw placeholder |
| `core_anchor.must_preserve` / `allowed_variation` | Free-text `.content` field on a constraint/variation-zone row; unbounded at the DB level, no observed max-length enforcement in the read model | Could be multi-sentence for older/manually-authored Anchors; any future row grammar needs to survive that |
| `execution_anchor.execution_boundary` | `production_ready_criteria or delivery_conditions or parameter_ranges` — three different possible source fields, each potentially different in tone/length | Whichever is non-null wins; no guarantee of consistent length/format across Tasks |
| `next_action.why_now` / `downstream_effect` | Server-authored, curated sentences from fixed dictionaries (`_DOWNSTREAM_EFFECT`) or hand-written per-branch strings in `_focus_action`/`_get_task_context` | Bounded and short by construction — these are the safest fields, unlikely to ever be long |
| `attention.summary` | AI-generated (`signal_output.get("summary")`), may be missing entirely (`None`) | No enforced length bound found; treat as potentially longer prose |
| `attention.review_requirement` | Fixed dictionary lookup (`_ATTENTION_REQUIREMENT`), short, always present | Safe |
| `upstreamState(...)` | One of two fixed sentences, or `null` | Safe, short |
| Generator-label leakage | All Core/Execution Anchor free-text and attention/summary fields pass through `stripGeneratorLabel` before display (except S4a's raw `review_requirement` and S1a's metadata line — server-authored, not user/generator text, so never candidates for label leakage) | Confirms the presentation-layer cleaning is already applied consistently for genuine domain free-text |

No field in this inventory has a hard backend length cap. Any next layout must assume "could be one short phrase, could be several sentences" for every free-text row (P1, P2, S1, S2, S3, S4).

---

## I. Artist permission boundary

Per `ROLE_PERMISSIONS.md` and `docs/product-improvement/00_ICAS_PRODUCT_IMPROVEMENT_BASELINE.md` §5.3: Artist may read both Anchors, compare output against them, prepare rationale, and ask for clarification. Artist may **not** modify, confirm, or re-anchor either Anchor type, and cannot approve/confirm production-ready state.

Checked against the current component: **no violation found.** Every item in the inventory is read-only (no edit affordance anywhere in `ArtistExpandedAnchor`/`ArtistSecondaryDetail`); the only interactive elements are the collapse/expand toggle and the P3b/S10 navigation links, neither of which performs a write or implies authority.

One thing worth flagging: Artist never sees who confirmed an Anchor (`confirmed_by_human_role`/`confirmed_by_actor_id` exist on both Anchor objects but are read only inside VFX's `AuthorityChain` branch, e.g. "Confirmed by VFX Supervisor") — Artist's rows show revision number and lifecycle state, but not confirming authority. This under-shares rather than over-shares, so it does not risk implying authority Artist doesn't have; if anything it's conservative. No content item was found that risks implying Artist authority it doesn't actually hold.

---

## J. VFX / CG / Artist content comparison (content only, not layout)

**Shared across all three roles:** Core Anchor identity/state, Core Anchor direction, attention level + reasoning, upstream/readiness computation shape (`next_action.title/why_now/downstream_effect`), current production Version identity, draft-distinction logic, collapsed-state contract (identical component).

**VFX-specific:** sees Core Anchor's `confirmed_by_human_role` (who confirmed it); `core.link_target` ("Open Intent →") is only ever exposed for `vfx_supervisor`; `attention.link_target` ("Open Alignment →") is only ever populated for `vfx_supervisor` in the backend (`service.py`: `link_target=... if role == "vfx_supervisor" else None`) — meaning **VFX is the only role for which "Related context" is ever actually reachable** under the current backend contract. VFX never sees an Execution Anchor (`execution_anchor` is always `None` for this role).

**CG-specific:** sees the full Core→Execution authority chain as two linked nodes (`AuthorityChain`'s cg branch / `ReviewRelationship` in the "review" variant); `execution.link_target` ("Open Execution →") is exposed only for `cg_supervisor`; CG's Version Review page uses a distinct "review" variant (`ReviewRelationship`, `ReviewAttention`, a 4-cell equal-width `guardrailMatrix`) not shared with Artist or VFX at all.

**Artist-specific:** no Anchor-confirmation authority attribution shown (see §I); the only role whose `guidance_state` badge is exposed in Anchor Context at all (VFX/CG hard-code `guidance_state: "unavailable"` server-side); the only role using the row-grammar (WHY/MUST-PRESERVE/WHAT-TO-DO-NOW) presentation established in the Artist Current Version row-grammar correction.

**Structurally dead for Artist specifically:** "Related context" (S10) — see §F and §K.

---

## K. Implementation accidents / uncertainties

Flagged conservatively — none of these are recommendations to remove anything, only surfaced for a human decision.

1. **"Related context" (S10) is unreachable for Artist under the current backend contract.** `hasContextLinks` requires `core.link_target && role === "vfx_supervisor"`, or `attention.link_target` (server-populated only for `vfx_supervisor`), or `execution.link_target && role === "cg_supervisor"` — all three clauses are false whenever `role === "artist"`. The JSX conditional exists and looks live, but no real data state can ever satisfy it for Artist. **Uncertain** whether this is intentional (Artist shouldn't navigate directly to Alignment/Intent/Execution from Anchor Context) or an oversight (e.g., should Artist have a link to their own Guidance panel or Feedback History here instead).
2. **Upstream-state duplication (E5/S6, §F.A.1)** — likely a straightforward carry-over gap from the primary-row dedup pass done in a prior turn, which only looked at the primary rows' overlap with secondary, not the header badges' overlap with secondary. Fairly confident this is an accident, not intentional reinforcement — the header badge and the secondary row serve the same "why am I blocked" purpose with the same wording.
3. **Intent-attention duplication when `summary` is null (S4/S4a, §F.A.2)** — same character: an accidental duplicate in one specific data state (no AI summary yet), not in the common case. Likely an accident, not verified as intentional.
4. **`downstream_effect` (S5) and `why_now` (P3a) are coded as conditional but are contractually guaranteed non-empty** (`AnchorNextActionRead.downstream_effect: str`, not `str | None`; every backend branch populates it). This isn't wrong, just means the "conditional" framing in the component doesn't reflect a real absent-data case today — worth knowing so a future refactor doesn't assume these can legitimately be empty for some other reason.
5. **`core_anchor.exists` / `execution_anchor.exists` / `open_vfx_escalation` are present in `AnchorContextRead` but read nowhere in `AnchorContextLayer.tsx`**, for any role — not just Artist. `open_vfx_escalation` in particular is a real, backend-computed signal (an open VFX escalation task exists) that appears in zero production `.tsx` file across the entire frontend — only ever set in test fixtures. **Uncertain**: this could be legitimately handled elsewhere (e.g., a Dependencies/escalation-specific surface), or it could be a genuinely dropped signal that never made it into any UI. Worth a direct question to product/backend rather than assuming either way.
6. **Two different "WHAT TO DO NOW" concepts exist in the product**, and they are not the same field. `docs/product-improvement/00_ICAS_PRODUCT_IMPROVEMENT_BASELINE.md` §5.3 defines Artist's triad as `WHY = Core Anchor / HOW = Execution Anchor / WHAT TO DO NOW = Artist Agent Guidance for the selected Version`. The implemented Anchor Context row grammar instead uses `WHY / WHAT MUST I PRESERVE / WHAT TO DO NOW`, where "What to do now" is sourced from `next_action` (a workflow-readiness computation: "Continue within current Guidance", "Request CG clarification", etc.) — not the actual Artist Agent Guidance content (iteration priorities, feedback translations), which lives in a separate "Artist guidance" section elsewhere on `CurrentVersionPage`. This is not a bug — the current row grammar was an explicit owner-approved instruction — but the label "What to do now" is used for two conceptually different things in the product (a readiness nudge inside Anchor Context, vs. the actual Agent guidance payload outside it), which is worth resolving explicitly rather than assuming either document is stale.
7. **Not a new accident, already flagged and deferred on purpose:** CG's "review" variant `guardrailMatrix` (Must preserve / May vary / Execution boundary / Intent attention as four equal-width grid cells) is exactly the anti-pattern §9.5 of `ICAS_VISUAL_LANGUAGE_V1.md` just eliminated from Artist — it was explicitly deferred to a later migration pass, not missed. Restated here only so it isn't rediscovered as "new."
8. **Confirming-authority attribution (`confirmed_by_human_role`) is shown to VFX but not to Artist or CG** in the current code — not clearly a decision vs. an oversight; flagged as **uncertain** rather than assumed intentional, since `ROLE_PERMISSIONS.md` doesn't explicitly say Artist shouldn't see who confirmed an Anchor, only that Artist can't confirm one.

Nothing found that looks like legacy/demo data leaking into presentation beyond the already-handled `stripGeneratorLabel` allowlist (which is itself evidence this was already audited once, per `presentation.ts`'s own doc comments).

---

## L. Final locked content checklist

Every fact/capability the next visual design must preserve for the Artist Anchor Context, regardless of layout:

**Collapsed:**
- [ ] Attention badge, hidden when not-yet-assessed
- [ ] Core Anchor revision number + lifecycle state
- [ ] Direction text (Execution-preferred, Core-fallback), with unavailable-fallback text
- [ ] Expand control

**Expanded — header/status:**
- [ ] Execution Anchor state badge (when execution exists)
- [ ] Attention badge (always, including "Not assessed yet")
- [ ] Guidance state badge
- [ ] Upstream badge (when a real upstream blocker exists)
- [ ] Collapse control

**Expanded — primary:**
- [ ] Why (Core Anchor direction) + its revision/state metadata
- [ ] What must I preserve (Core Anchor)
- [ ] What to do now: title + why_now + conditional action link

**Expanded — secondary:**
- [ ] Current direction (Execution Anchor) + its revision/state metadata
- [ ] Allowed to vary (Execution-preferred, Core-fallback)
- [ ] Execution boundary (conditional on existing)
- [ ] Intent attention: reasoning + rule-requirement sub-text
- [ ] Readiness / downstream effect
- [ ] Upstream state (conditional)
- [ ] Draft distinction (conditional)
- [ ] Current draft source (conditional)
- [ ] Current production context (Version name + number, with fallback)
- [ ] Related-context link (conditional — currently dead for Artist, preserve the capability regardless)

**Non-negotiable boundaries:**
- [ ] Every item stays read-only; no edit/confirm/approve affordance
- [ ] Core Anchor vs. Execution Anchor authority never merged into one fact
- [ ] Draft vs. confirmed state never visually implies the draft is authoritative
- [ ] Generator/demo labels stay stripped from all free-text fields
- [ ] No field assumes a fixed/bounded text length

**Not yet resolved — needs a product decision before the next visual pass, not a visual fix:**
- [ ] Upstream duplication (E5/S6) — merge, or confirm intentional reinforcement?
- [ ] Intent-attention duplication when `summary` is null (S4/S4a)
- [ ] Whether "Related context" should ever be reachable for Artist, and if so, to what destination
- [ ] Whether the "What to do now" label should be disambiguated from the separate Artist Guidance panel
