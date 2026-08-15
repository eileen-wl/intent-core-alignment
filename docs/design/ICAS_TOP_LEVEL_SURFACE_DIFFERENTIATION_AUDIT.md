# ICAS Top-Level Surface Differentiation + Shots/Tasks Object-Browser Audit

> **Status:** Read-only content/product-architecture audit. No UI, CSS, routes, or product code were changed to produce this document.
> **Purpose:** Make Workspace Home, Review Inbox, and the Shots/Tasks object browser conceptually impossible to confuse — in responsibility, density, object model, interaction, and content grammar — before any redesign begins.
> **Scope:** Product/content architecture only. No pixel layouts, CSS, component names, or visual composition are proposed here.
> **Builds on:** `docs/design/ICAS_WORKSPACE_HOME_RESPONSIBILITY_AUDIT.md` (accepted). OWNER decisions carried forward as constraints: Home separated from the Worklist archetype (recommendation only, `ICAS_DESIGN.md` not edited); Home capped at 1 Primary Focus + 2 secondary signals + aggregate/route (not implemented yet); feedback clustering, "since last visit," and the canonical Intent Signal vocabulary remain product gaps, not to be assumed or renamed into existence; the rejected Artist Home visual variant is superseded by the upcoming redesign; no backend Home aggregation is commissioned by this document.

**Authorities read:** `docs/design/ICAS_WORKSPACE_HOME_RESPONSIBILITY_AUDIT.md`, `docs/design/ICAS_DESIGN.md` §6 (page archetypes), `docs/GLOSSARY.md`, `docs/ROLE_PERMISSIONS.md`, `docs/product-improvement/00_ICAS_PRODUCT_IMPROVEMENT_BASELINE.md` §11.

**Code read:** `apps/web/src/app/{vfx,cg,artist}/*WorkspacePage.tsx`; `apps/web/src/app/{vfx,cg,artist}/inbox/*ReviewInboxPage.tsx`; `apps/web/src/app/vfx/shots/ShotsListPage.tsx` + `ShotRow.tsx`; `apps/web/src/app/cg/tasks/TasksListPage.tsx` + `CgTaskListRow.tsx`; `apps/web/src/app/artist/tasks/TasksListPage.tsx` + `ArtistTaskListRow.tsx`; the row components shared with Home (`InboxRow`, `CgTaskRow`, `ArtistTaskRow`) and Inbox (`WorkItemRow`, `CgTaskWorkItemRow`, `ArtistTaskWorkItemRow`); `ShotOverviewPage.tsx` / `TaskOverviewPage.tsx` (CG, Artist); `AnchorContextLayer.tsx` / `AnchorContextSummary.tsx`; Version-media resolution path (`resolveVersionMediaAction`, `VersionMediaResolver`, `VersionMediaPanel`) — see §9.

---

## 1. Executive conclusion

The Workspace Home audit found that Home currently duplicates the List page's own row component. This audit finds the deeper, three-way version of the same problem: **Review Inbox and the Shots/Tasks object browser today share not just similar filters and similar row shapes, but the same underlying filter *pattern*** (a Project select + a state-type select + an optional Department select, "Showing N of/items" counter text), and **all three top-level surfaces (Home, Inbox, List) draw from the exact same `*InboxItemRead[]` array**, differing only in how much of it is shown and which fields are foregrounded. There is currently no *object model* distinction between "a Shot I might want to browse" and "a work item waiting for me" — both are the same record, `VfxInboxItemRead`/`CgInboxItemRead`/`ArtistInboxItemRead`, just adapted or filtered differently at render time.

This is the real reason all three surfaces "feel like variations of the same list": they structurally are. The fix is not visual — it is establishing that Review Inbox's primary unit is a **derived work item** (`ReviewWorkItem`/`CgReviewWorkItem`/`ArtistReviewWorkItem` — already a distinct adapted type, this part is correct) while the Shots/Tasks browser's primary unit should be the **production object itself**, presented for recognition and comparison, not for "why does this need me." Today the List pages already use the raw inbox-item record (correct primary unit) but render it through a row grammar (full `AnchorContextSummary` block, action-labeled CTA, "reason to look" framing) borrowed from the Inbox/Home lineage — the object model is nearly right; the presentation grammar is what collapses it back into the same family.

VFX raises a genuine, distinct opportunity the other two roles do not share to the same degree: a Shot is a visual creative object, and if real preview media is available, showing it is the single strongest, cheapest way to make `/vfx/shots` stop feeling like a list of facts and start feeling like a catalogue of Shots. §9 investigates this with hard evidence, not assumption.

---

## 2. Current top-level collision map

Every collision below is a **content-structure** match, not merely a shared component.

| Collision | VFX | CG | Artist | Evidence |
|---|---|---|---|---|
| Same underlying data array powers all three surfaces | `VfxInboxRead.items` feeds `/vfx`, `/vfx/inbox` (via `adaptCurrentFocusToWorkItems` etc.), and `/vfx/shots` directly | `CgInboxRead.items` feeds `/cg`, `/cg/inbox` (via `adaptCgCurrentFocusToWorkItems`), and `/cg/tasks` directly | `ArtistInboxRead.items` feeds `/artist`, `/artist/inbox` (via `adaptArtistCurrentFocusToWorkItems`), and `/artist/tasks` directly | One backend read per role, three presentations |
| Same filter *pattern*: Project select + state-type select + optional Department select + "Showing N ..." counter | Inbox: Project + Core Anchor state. List: Project + Core Anchor state + Task. | Inbox: Project + Execution Anchor state + Department. List: Project + Execution Anchor state + Department + "Requiring attention only." | Inbox: Project + Guidance state + Department. List: Project + Department + Guidance state + Latest-Version + "Requiring attention only." | Read directly from `ReviewInboxPage.tsx`/`CgReviewInboxPage.tsx`/`ArtistReviewInboxPage.tsx` and the three `TasksListPage.tsx`/`ShotsListPage.tsx` files |
| Same compact Anchor-summary block embedded in every row, on every one of the three surfaces | `AnchorContextSummary` in `InboxRow` (Home), `WorkItemRow` (Inbox), `ShotRow` (List) | Same in `CgTaskRow` (Home), `CgTaskWorkItemRow` (Inbox), `CgTaskListRow` (List) | Same in `ArtistTaskRow` (Home), `ArtistTaskWorkItemRow` (Inbox), `ArtistTaskListRow` (List) | All three roles' row components import the same `AnchorContextSummary` |
| Same CTA structure: `next_action.action_label ?? "<generic Open/Review label>"` as a trailing action-affordance | `anchorContext?.next_action.action_label ?? "Open Shot"` (List); `?? "Review item"` (Inbox) | `?? "Open Task"` (List); `?? "Review item"` (Inbox) | `?? "Open Task"` (List); `?? "Review item"` (Inbox) | Every row component, all three roles |
| Same "focus/state" leading line pattern, differing only in which field wins | List leads with a *state* label (`coreAnchorStateLabel`/`executionAnchorStateLabel`); Inbox and Home's priority rows lead with the *action* title (`current_focus.title`/`next_action.title`) — the one place these currently do differ correctly, per each row component's own field choice | Same pattern | Same pattern | Confirms the *field* choice is already correct in places; the *surrounding row grammar* (Anchor-summary block, CTA, ftrack badge, secondary line) is what's shared/collided |
| Repeated count summaries | Home: "Anchor health" 5 counts. List: no counts, only "Showing X of Y." | Home: "Execution readiness" 5 counts. List: no counts beyond "Showing X of Y." | Home: "Task overview" 7 counts. List: no counts beyond "Showing X of Y." | Counts don't collide across surfaces directly, but Home's per-role count set and the List page's own filter *options* are drawn from the identical field set (e.g. VFX Home counts `core_anchor_state` buckets; VFX List filters by the same field) — same fact, computed twice, independently |
| Repeated object context (Project/Shot/Task identity + ftrack badge) | Shown on every row on all three surfaces | Same | Same | `FtrackLinkageBadge`, `project_name`, `shot_name`/`task_name` appear identically on Home, Inbox, and List rows |

**What is NOT currently collided:** Inbox's primary unit genuinely is a distinct adapted type (`ReviewWorkItem` etc.), scoped to actionable items only, grouped by category — this part of the architecture is sound and should not be touched (per the Inbox freeze, §12). The collision is that the List pages' *presentation* borrows the same row grammar as Inbox/Home, not that the List pages lack their own underlying object type.

---

## 3. Four-level responsibility model

| | **A — Workspace Home** | **B — Review Inbox** | **C — Shots/Tasks** | **D — Selected Shot/Task Workspace** |
|---|---|---|---|---|
| Mental model | "My role's current work landscape" | "Things waiting for my action" | "The production objects in my scope" | "I am now working inside one production object" |
| Purpose | Synthesize → Prioritize → Orient → Route | Enumerate → Inspect → Act | Browse → Compare/Find → Enter | Understand → Inspect evidence → Decide/execute |
| Primary unit | Cross-object signal/focus/state | Work item | **Production object** (Shot / Task / assigned Task) | One selected Shot/Task |
| Density ceiling | 1 Primary Focus + up to 2 secondary signals + aggregate (OWNER-set, §0.2) | Full actionable population, grouped | Full population in scope, filterable/comparable | Full depth for one object |
| Must not become | A detailed object workspace, or a second Inbox queue | (frozen, out of scope) | Review Inbox, Workspace Home, or a mini Overview | — |

Level C sits **between** B and D and is frequently missing its own identity in the current implementation — it borrows B's row grammar upward and anticipates D's Overview content downward (see §7). This audit's central job is giving C (Shots/Tasks) its own grammar.

---

## 4. Home vs Inbox boundary

Carried forward from the accepted Home audit, restated as a hard boundary:

- **Home may surface:** Primary Focus object identity (1), up to 2 secondary attention/up-next signals, aggregate work-state counts. Never a filterable list, never more than 3 named objects total.
- **Inbox owns:** the complete actionable work-item population, grouped by category, with its own filters (Project/state/Department, as it has today).
- Home may link to Inbox ("Go to Review Inbox →"); Home must never reproduce Inbox's grouped list or filter controls.
- **Not yet implemented per OWNER instruction §0.2** — this boundary is recorded here as a decision, not built.

---

## 5. Home vs Object Browser boundary

- **Home may surface:** the same ceiling as §4 — Primary Focus + ≤2 secondary signals + aggregate counts — regardless of whether those signals happen to be individual Shots/Tasks (they will be, since Home's Primary Focus *is* an object). The distinction from the Object Browser is *quantity and framing*, not object type: Home shows 1–3 objects, each reduced to identity + one-line why + route; the Object Browser shows the *entire* scoped population, reduced to identity + comparable state, with no "why" narrative at all (see §7/§11).
- **Object Browser owns:** the complete browsable population, filters/sorting for discovery, comparable object-level state, and the enter-object action. It has no concept of "why this deserves attention right now" — that framing belongs to Home/Inbox.
- Home must not replicate the Object Browser's cards/rows, its full catalogue, or its filters. Today it partially does (§2) — Home's priority rows use the *same* row component as the List page, just pre-filtered.

---

## 6. Inbox vs Object Browser boundary

This is the boundary most at risk of collapsing, because both currently filter the *same* underlying array and use *structurally identical* filter controls (§2). The distinction must be enforced at the object-model level, not just presentation:

- **Inbox's primary unit is a derived work item**: one row per *actionable reason*, not one row per object — a single Task can appear zero times (nothing actionable) or, in principle, contribute multiple distinct reasons if its `current_focus` situation changes over time (though today's adapters produce at most one row per Task/Shot). Its filters exist to narrow *which reasons* are shown.
- **Object Browser's primary unit is the object itself**: exactly one row per Shot/Task that exists in scope, whether or not anything is actionable about it. Its filters exist to narrow *which objects* are shown, for recognition/comparison — never "why."
- **Consequence for filters specifically:** an Object Browser filter like CG/Artist's current "Requiring attention only" checkbox is an *Inbox-shaped* filter transplanted onto the object catalogue — it filters by the same predicate Inbox itself uses to decide inclusion, and it has no browse/comparison purpose (see §16).
- **Consequence for row content:** Inbox's row leads with the *reason* (`title`/`explanation` of the actionable focus) and ends with a *human-action* CTA (`action_label`). The Object Browser's row must lead with *object identity* and end with a neutral *enter* affordance ("Open"), never an action-justification CTA borrowed from the actionable-focus field.

---

## 7. Object Browser vs Object Overview boundary

Applying "would this make the Overview redundant?" to the current List row fields:

| Catalogue field (current) | Keep on catalogue? | Overview equivalent (fuller) | Verdict |
|---|---|---|---|
| Shot/Task name, Project name | Yes | `TaskContextHeader`/breadcrumb identity | Pure identity — never redundant, Overview needs it too but at a different level (breadcrumb, not a data point) |
| Core/Execution Anchor **state** (as a compact label, e.g. "Confirmed") | Yes | Full Anchor content (Intent/Execution tab): scalars, collections, provenance | Not redundant — state alone supports comparison ("which Shots are still draft"); the Overview's job is explaining *why* it's in that state, which the catalogue must not attempt |
| Full `AnchorContextSummary` block (Anchor state+revision, direction, attention, readiness, **next action**) | **No — currently over-shown** | `AnchorContextLayer` (full), `CurrentFocusPanel`/`TaskCurrentFocusPanel` (full title+explanation) | This is exactly the field set that makes the Overview redundant — "why it matters, current direction" is the Overview's job (per the instruction's own example), and today's catalogue row already renders nearly all of it |
| `current_focus.title` as the row's leading state line (VFX/CG/Artist Home & Inbox usage) vs. the state label the List rows actually use today (`coreAnchorStateLabel`/`executionAnchorStateLabel`) | Yes, the **state label** version (already what List does); no to the **focus-title** version | `CurrentFocusPanel` shows the full focus title + explanation | List already gets this mostly right — its own doc comments explicitly note it swaps to a state label instead of the action title used elsewhere. Preserve this distinction; do not regress it. |
| Dependency **count** ("2 open dependencies") | Yes, as a signal | Dependencies tab: which dependencies, kind, severity, status, actor, timestamps | Matches the instruction's own example exactly — count is catalogue-appropriate, detail is not |
| Guidance **state** ("Guidance updated"/"current"/"outdated") | Yes, as a state label | Task Overview's full Guidance panel: executive summary + 4 structured lists | Matches the instruction's own example |
| ftrack linkage badge | Yes | Same badge, reused on Version rows in Overview/Versions | Compact, identity-adjacent, not detail — fine on catalogue |
| Latest Version identity (name/number) | Yes | Full Version list + media + review notes (Versions/Version-Review/Current-Version tab) | Identity is catalogue-appropriate; content is not |
| Department (CG/Artist) | Yes | Same field, shown again in Overview's context header | Identity-adjacent, comparison-useful, not detail |

**Stated boundary:** the Object Browser supports **recognition and comparison** — it should never contain a field whose value cannot be understood without also reading a sentence of explanation. If a field needs "why," it belongs to Home (as a reduced signal) or the Object Workspace (in full) — never to the catalogue in between.

---

## 8. Current VFX Shots audit

Source: `ShotsListPage.tsx` + `ShotRow.tsx` (confirmed directly).

- **Filters:** Project (select), Core Anchor state (select: none/draft_pending/confirmed), Task (select, only rendered if any Task names exist). All client-side over the already-loaded `VfxInboxRead.items`.
- **Counter:** "Showing X of Y Shots."
- **Row content (`ShotRow`):** `shot_name`, `project_name`; leading state line = `coreAnchorStateLabel(core_anchor_state)` (correctly a state, not an action title — see §7); full `AnchorContextSummary` block; secondary line = `signalStateLabel(latest_signal_attention_level)`, `taskDisplayText(item)`, `versionDisplayText(item)`, `FtrackLinkageBadge(shot_source)`; CTA = `anchorContext?.next_action.action_label ?? "Open Shot"`.
- **No visual/image content of any kind today.**
- **A. Identity fields (present):** `shot_name`, `project_name`.
- **B. Useful browse/comparison fields (present, keep):** `core_anchor_state` (as label), `taskDisplayText` (relevant Task), `versionDisplayText` (latest Version identity), ftrack linkage.
- **C. Useful state signals (present, keep as signal only):** `latest_signal_attention_level` (as a compact badge, not the full attention summary text it currently renders via `AnchorContextSummary`).
- **D. Fields present but belonging downstream, candidates for removal:** the full `AnchorContextSummary` block's direction/attention-summary/readiness-detail/next-action-title content (belongs to Home's Primary Focus or the Object Workspace, per §7); the action-justified CTA label (`next_action.action_label`) — an Object Browser "enter" affordance should be neutral, not action-framed.
- **E. Actions:** implicit row-click/CTA-link to the Shot Overview. No other action exists (no bulk action, no inline state change) — correctly so, per the Object Browser's non-action-queue responsibility.

---

## 9. VFX media/thumbnail capability audit

**Real, working, ftrack-backed thumbnail media exists in this system today — confirmed live against a real ftrack trial workspace — but it is architected as a single-Version, per-request, transient resolution, never a list-scale read, and is not exposed anywhere on the current `/vfx/shots` list response.**

**The pipeline (all confirmed real, not stubbed):**
- `services/ftrack-connector/.../media_context.py` queries ftrack's own `AssetVersion.thumbnail_url` live per Version, deliberately avoiding the SDK's `Location.get_url()`/`get_thumbnail_url()` helpers because those were confirmed, in this project's own prior investigation, to leak this service's live ftrack API credentials into the returned URL. It returns a real signed `cdn-eu3.ftrackapp.com` thumbnail URL.
- `apps/api`'s `version_media` module exposes three role-scoped routes — `GET /vfx/shots/{shot_id}/versions/{version_id}/media`, plus CG/Artist equivalents — each returning a `VersionMediaRead` with an honest `media_state` (`playable` | `thumbnail_only` | `external_context_only` | `unavailable`). `playable` is defined in the contract but **never currently reachable** — this ftrack workspace exposes no credential-free playable Component URL — so the best case today is a static thumbnail image, never video. This is documented as an intentional, honest gap in the code itself, not something this audit is inferring.
- The frontend already consumes this real endpoint on three pages — VFX Versions, CG Version Review, Artist Current Version — each resolving media for exactly **one selected Version at a time**. `VersionMediaResolver.tsx` is explicitly documented in its own source to never pre-resolve every Version on a page.
- **Manually-sourced Shots/Versions (no ftrack link) always return `unavailable`** — there is no media of any kind for this subset, permanently, regardless of engineering effort.
- Neither the `Shot` nor `Version` SQLAlchemy models persist any thumbnail/image/media field (confirmed by exhaustive grep), and no cache/object-store layer exists for it (a MinIO container is present in `infra/docker-compose.yml` but is explicitly commented as dev-parity scaffolding, unused by anything media-related).
- The current `/vfx/shots` list response (`VfxInboxItemRead`, 30+ fields, fully enumerated) and `AnchorContextSummaryRead` both carry **zero** image/media/thumbnail fields, and `ShotRow.tsx` renders no `<img>`/`<video>` element — confirmed by direct reading of both the contract and the component, not inference.

**Classification: C — supported deeper in the stack but not exposed on this read, with a real architectural cost, not a trivial "add a field."** Surfacing a thumbnail per row on the Shots list would mean either (a) one live, blocking ftrack round-trip per visible row on every list render — a materially different cost/latency/reliability profile than today's single-Version detail views, which the existing per-request architecture was not designed for — or (b) a new caching/pre-resolution layer that does not exist anywhere in this codebase today. Whether the real ftrack API's rate limits and latency make option (a) acceptable at small scale, or whether (b) is warranted, could not be determined by static code reading and is flagged as genuinely unknown, not guessed at.

**Do not invent a placeholder.** This audit found real, live, evidence-backed thumbnail capability — the honest classification is "real but expensive to bring to list scale," not "unsupported." A redesign should not fabricate a static/generic frame in its place; if a preview is wanted before the cost/caching question is resolved, the non-image alternatives below are the honest interim option.

**Non-image object-identity alternatives** (usable regardless of §9's outcome, and appropriate permanently for manually-sourced Shots that can never have media):
- A compact, deterministic visual identity mark derived from real data already on the row (e.g. a colored/patterned mark keyed to Core Anchor state, already a real field) — signal, not decoration.
- Leaning on the existing ftrack-linkage badge as the row's visual differentiator, already real and already rendered.
- Typographic/structural emphasis on Shot name and Project/Sequence context as the primary recognition device, which is what the row already does today, minus the current over-shown Anchor-summary content (§8).

---

## 10. VFX Shots target content grammar

Information regions only, no layout:

1. **Object identity** — Shot name, parent Project (and Sequence, if a Sequence concept exists in the domain model — not confirmed as a UI-surfaced field today, treat as unconfirmed rather than assumed).
2. **Visual identity** — real thumbnail media is confirmed to exist (§9) but is not currently list-scale-ready; this region should either (a) be deferred until the caching/cost question in §9 is resolved by OWNER, or (b) use one of §9's non-image identity alternatives in the interim — never a fabricated frame.
3. **Production context** — relevant Task, latest Version identity, ftrack linkage.
4. **Compact state signals** — Core Anchor state (label only), attention level (badge only) — no direction text, no attention summary sentence, no next-action title.
5. **Enter affordance** — a neutral "Open Shot," not an action-justified CTA.

**Excludes:** full Anchor direction, full current-focus explanation, full Alignment finding, detailed next-action reasoning, any "why this needs you" framing — all of these belong to Home (reduced) or the Shot Workspace (full), per §5/§7.

---

## 11. Current CG Tasks audit

Source: `TasksListPage.tsx` (CG) + `CgTaskListRow.tsx` (confirmed directly).

- **Filters:** Project (select), Execution Anchor state (select: none/draft_pending/confirmed), Department (select, conditional on existing values), **"Requiring attention only" (checkbox)**.
- **Counter:** "Showing X of Y Tasks."
- **Row content:** `task_name`, `shot_name`; leading state line = `executionAnchorStateLabel(execution_anchor_state)` (state, not action title — correct per §7); full `AnchorContextSummary`; secondary line = `project_name`, `department ?? "No department recorded"`, `versionDisplayText(item)`, `FtrackLinkageBadge(task_source)`; CTA = `anchorContext?.next_action.action_label ?? "Open Task"`.
- **A. Identity fields (present):** `task_name`, `shot_name` (parent), `project_name`, `department`.
- **B. Useful browse/comparison fields (present, keep):** `execution_anchor_state` (label), `department`, `versionDisplayText`, ftrack linkage.
- **C. Useful state signals (present, keep as signal only):** implicit — the compact Anchor-summary's `attention_level`/readiness badge, reduced to a badge rather than the full sentence-form summary it renders today.
- **D. Fields present but belonging downstream, candidates for removal:** same as VFX — the full `AnchorContextSummary` narrative content (direction, attention summary, readiness detail, next-action title/why/downstream-effect); the action-justified CTA.
- **E. The filter that makes this feel like a work queue:** **"Requiring attention only."** This is not an object-discovery filter — it filters by the exact predicate (`current_focus.actionable`) that decides Review Inbox *inclusion*. Its presence on the catalogue is the single clearest current signal that the CG Tasks page is scoped, at least partly, as a secondary Inbox rather than a pure catalogue (see §16).

---

## 12. CG Tasks target content grammar

A CG Task catalogue row should emphasize the Task as an **execution/production object**, not a translation-status report:

1. **Object identity** — Task name, Department, parent Shot, parent Project.
2. **Production state** (not action state) — Execution Anchor state as a label; production-readiness as a label if it can be derived without the full criteria text.
3. **Dependency presence** — a count/badge ("2 open"), never kind/description/severity.
4. **Current Version identity** — name/number only.
5. **Enter affordance** — neutral "Open Task."

**Distinguish object state from action required:** `execution_anchor_state` (none/draft_pending/confirmed) is genuinely object state — it describes the Task, independent of whether anything is currently actionable about it, and is legitimate catalogue content. `current_focus.actionable`/`current_focus.title` is action-required framing and belongs to Inbox/Home, not the catalogue.

**Fields to explicitly remove from the catalogue role:** the "Requiring attention only" filter (§11); the full `AnchorContextSummary` next-action/readiness-detail text; the action-labeled CTA (replace with a neutral "Open").

---

## 13. Current Artist Tasks audit

Source: `TasksListPage.tsx` (Artist) + `ArtistTaskListRow.tsx` (confirmed directly).

- **Filters:** Project (select), Department (select, conditional), Guidance state (select: none/outdated/current), Latest Version (select: any/has_version/no_version), **"Requiring attention only" (checkbox)**.
- **Counter:** "Showing X of Y Tasks."
- **Row content:** `task_name`, `shot_name`; leading line = `anchorContext?.next_action.title ?? item.current_focus.title` — **this is the one row, of the three roles' List pages, that leads with the *action* title rather than a state label**, inconsistent with VFX's and CG's own List rows (§7's "already correct in places" observation does not hold for Artist); full `AnchorContextSummary`; secondary line = `executionAnchorStateLabel`, `guidanceStateLabel`, `project_name`, `department ?? "No department recorded"`, `versionDisplayText(item)`, `FtrackLinkageBadge(task_source)`; CTA = `anchorContext?.next_action.action_label ?? "Open Task"`.
- **A. Identity fields (present):** `task_name`, `shot_name`, `project_name`, `department`.
- **B. Useful browse/comparison fields (present, keep):** `execution_anchor_state`, `guidance_state`, `department`, `versionDisplayText`, "has Version"/"no Version" (already a filter option, confirms it's a recognized comparison axis), ftrack linkage.
- **C. Useful state signals (present, keep as signal only):** guidance freshness as a compact badge.
- **D. Fields present but belonging downstream, candidates for removal:** the leading `next_action.title` line (should become a state label, e.g. readiness or guidance state, matching VFX/CG's own pattern — this is the clearest single fix for Artist's row); the full `AnchorContextSummary` narrative content; the action-justified CTA.
- **E. The filter that makes this feel like a work queue:** **"Requiring attention only"**, identical problem to CG (§11) — same `current_focus.actionable` predicate borrowed from the Inbox-inclusion rule.

---

## 14. Artist Tasks target content grammar

1. **Object identity** — Task name, Department, parent Shot, parent Project.
2. **Work readiness** (state, not action) — a label derived from readiness/Anchor confirmation, not the current focus title.
3. **Guidance freshness** — state label only (current/outdated/none), never guidance body.
4. **Current Version identity** — name/number, plus visual preview: the same real, ftrack-backed media pipeline confirmed in §9 for VFX is also already wired for Artist's own Current Version page (`CurrentVersionPage.tsx` already resolves and renders it there, single-Version, server-resolved). Extending it to every row of the Artist Tasks catalogue carries the identical list-scale cost caveat §9 raises for VFX — not a separate technical question, the same one.
5. **Feedback presence** — a count/badge if cheaply available (open Review Note count already exists on the item per the Home audit), never note content.
6. **Enter affordance** — neutral "Open Task."

Artist Tasks should read as **"my production work objects,"** not **"my Inbox"** — the leading-line fix (state label, not action title) is the single highest-leverage content change identified for this page, since it is currently the only List row of the three that leads with action framing rather than object state.

---

## 15. Shared Object Browser family grammar

**Shared across all three (the family grammar):**
- A searchable/filterable object collection, filtered for *discovery*, never for *actionability*.
- Clear object identity as the first thing every row establishes (name + immediate parent context).
- A comparable, compact **state** (never action/reason) signal set.
- A neutral enter-object affordance, not an action-justified CTA.
- An optional preview/visual-identity region — present only where real data supports it (VFX; see §9 for whether this extends to CG/Artist).

**VFX-specific:** Shot-level identity (no Department axis — Shots don't have one); Core Anchor state as the primary comparable state; potential visual preview as the most natural fit of the three roles (a Shot is inherently a visual creative object).

**CG-specific:** Department as a first-class identity/comparison axis; Execution Anchor state as the primary comparable state; dependency-count as a comparison-relevant signal (not present in this form for VFX/Artist).

**Artist-specific:** Department inherited from the parent Task; Guidance freshness as a comparable state unique to this role; "has Version / no Version" as an already-recognized comparison axis (existing filter option); potential Current-Version preview (own output, not necessarily the same media pathway as VFX's Shot preview — see §9).

**Do not force identical cards/rows** — the three roles' object types differ enough (Shot vs. Task vs. assigned-Task) that a forced-identical grammar would itself misrepresent the object, exactly the mistake the Home audit found when Artist's Home content was structurally forced to mirror VFX/CG's.

---

## 16. Filter/sort responsibility audit

| Filter (current) | Surface(s) | Object-discovery filter? | Action-queue filter? | Recommendation |
|---|---|---|---|---|
| Project | Inbox, Shots, CG Tasks, Artist Tasks | Yes | — | Keep everywhere — legitimate on both Inbox (narrow which work) and catalogue (narrow which objects) |
| Core/Execution Anchor state (none/draft_pending/confirmed) | Inbox (CG only, as `stateFilter`; VFX Inbox uses Core Anchor state too), Shots, CG Tasks | Yes, on catalogue | Partially, on Inbox (narrows which reason) | Keep on catalogue as pure object-discovery; on Inbox it is legitimately narrowing *which actionable reason*, a different but valid use of the same field — no change needed, this one is not actually a collision, just a shared field with two valid uses |
| Department | Inbox (CG, Artist), CG Tasks, Artist Tasks | Yes | — | Keep everywhere — legitimate object-discovery axis |
| Guidance state (none/outdated/current) | Inbox (Artist), Artist Tasks | Yes | — | Keep — legitimate comparison axis for Artist's object type |
| Latest Version (any/has/no) | Artist Tasks only | Yes | — | Keep — a genuine object-discovery axis unique to the catalogue (Inbox doesn't need it, since actionable items generally imply Version context already) |
| Task (VFX Shots' third filter) | Shots only | Yes | — | Keep — legitimate discovery axis (which Shot has which relevant Task) |
| **"Requiring attention only"** | CG Tasks, Artist Tasks | **No** | **Yes** | **Remove from the catalogue, or reclassify.** This filters by the identical predicate (`current_focus.actionable`) that determines Review Inbox membership — it is not a discovery/comparison filter, it is an "show me the Inbox subset" toggle sitting on the object browser. Its presence is itself evidence the CG/Artist Tasks pages are currently scoped as a secondary Inbox. If OWNER wants a fast path from catalogue to Inbox, that should be the existing "Go to Review Inbox →" link, not a filter that reproduces Inbox's own inclusion logic on a different page. |

**General principle for future filters:** an **object-discovery filter** narrows by a property of the object itself, independent of whether anything is currently actionable (Project, Department, Anchor state, Guidance state, Version presence). An **action-queue filter** narrows by whether the object currently demands the viewer's action (`actionable`, `readiness_state === "action_required"`, or equivalent). The former belongs on the catalogue; the latter belongs on Inbox only.

---

## 17. Surface differentiation matrix

| Surface | Unit | Primary question | Density | Detail depth | Action model | Visual/content character |
|---|---|---|---|---|---|---|
| Workspace Home | Cross-object signal | What deserves my attention, and why? | Very low (≤3 named objects + aggregate) | Reduced (one line per fact) | Route only (no in-page resolution) | Orientation, judgment-forward |
| Review Inbox | Work item | What's waiting for my action? | High (full actionable population) | Moderate (reason + context + state + CTA, no full object detail) | Enter-to-resolve (each item routes to where the action happens) | Enumerated, reason-forward |
| VFX Shots | Production object (Shot) | What Shots exist, and which do I want to enter? | High (full population in scope) | Low (identity + comparable state only) | Enter-to-inspect (neutral) | Catalogue, identity/visual-forward |
| CG Tasks | Production object (Task) | What Tasks exist, and which do I want to enter? | High | Low | Enter-to-inspect (neutral) | Catalogue, identity/state-forward |
| Artist Tasks | Production object (assigned Task) | What work objects are assigned to me, and which do I want to enter? | High | Low | Enter-to-inspect (neutral) | Catalogue, identity/state-forward |
| Selected VFX Shot | One Shot, full depth | What is happening in this Shot, and what do I do? | Low (one object, many tabs) | Full | Understand → inspect evidence → decide (Decision/Review/Work archetypes per tab) | Deep workspace |
| Selected CG Task | One Task, full depth | What is happening in this Task, and what do I do? | Low | Full | Same | Deep workspace |
| Selected Artist Task | One Task, full depth | What is happening in this Task, and what do I do? | Low | Full | Same | Deep workspace |

No two rows share both "Unit" and "Action model" — this is the structural test for confusability, and every current pairing that risked failing it (Home/List sharing a row component; Inbox/List sharing a filter+CTA pattern) is addressed in §§4–7/§16 above.

---

## 18. Data/product-gap matrix

| Item | Classification | Notes |
|---|---|---|
| Shot/Task identity, Project/Department, ftrack linkage | **A. Available today** | Already on every `*InboxItemRead` |
| Core/Execution Anchor state (label only) | **A. Available today** | Same |
| Current Version identity (name/number) | **A. Available today** | `latest_version_name`/`latest_version_number`/`relevant_version_*` fields already present |
| Guidance state | **A. Available today** | `guidance_state` on `ArtistInboxItemRead` |
| Dependency count | **A. Available today** | `open_dependency_count` on `CgInboxItemRead`/`ArtistInboxItemRead` |
| Feedback/Review-Note count | **A. Available today** | `open_review_note_count` on `ArtistInboxItemRead` (per the Home audit) |
| Filters/search as already implemented (Project, state, Department, Guidance, Version-presence, Task) | **A. Available today** | All client-side over the already-loaded array; no backend change needed to keep or reduce them |
| Reduced-field catalogue row (dropping the full `AnchorContextSummary` narrative content) | **A. Available today, presentation-only change** | No new data required — this is a *removal* of currently-rendered fields, not an addition |
| Shot/Version visual preview (thumbnail/frame) | **C. Supported deeper in the stack but not exposed on this read** | Real, live, ftrack-backed single-Version thumbnail resolution confirmed working today (VFX Versions, CG Version Review, Artist Current Version all already use it) — but architected per-request/single-Version, not list-scale; no persisted/cached thumbnail exists anywhere; manually-sourced (non-ftrack) Shots/Versions have no media source at all, permanently. See §9 for full evidence. |
| Object-level search-by-text (name search, not just select-filters) | **B. Derivable today** | All identity fields already loaded client-side; a text search box is a pure frontend addition over existing data |
| Backend-side pagination for the catalogue | **D. Not currently implemented** | Current pages load the full inbox-item array and filter/paginate (if at all) client-side; true backend pagination would require new API support — noted per the instruction's explicit ask, not recommended or scoped here |
| Sequence-level grouping for VFX Shots (if a Sequence concept exists) | **Unconfirmed — flag, do not assume** | Not verified against the domain model in this audit; if OWNER wants Sequence as a catalogue grouping axis, verify domain-model support first |

---

## 19. Revised archetype recommendation

Recommended direction (**not applied to `ICAS_DESIGN.md` in this turn**):

- **Workspace Home** → new **Workspace / Orientation Archetype**, distinct from Worklist. User goal: synthesize and route, not enumerate.
- **Review Inbox** → remains **Worklist Archetype**, as today — this is the one surface `ICAS_DESIGN.md` §6.1 already correctly describes, and the Inbox freeze (§12 below) means no change is proposed to its own classification.
- **Shots / Tasks** → new **Object Browser / Catalogue Archetype**, distinct from both Worklist and the Decision/Review/Work archetypes. User goal: recognize and compare objects, then enter one.
- **Alignment / Intent / Execution** → remain **Decision Archetype**, unchanged (already correctly classified in `ICAS_DESIGN.md` §6.2).
- **Version Review / Current Version** → remain **Review Archetype** (§6.3) and **Work Archetype** (§6.4) respectively, unchanged.

**Exact `ICAS_DESIGN.md` statements that would need revision later** (listed for OWNER review, not edited here):
1. §6.1 "Worklist Archetype" → "Representative pages" list currently reads `Review Inbox / Shots / Tasks / Workspace Home`. This should become `Review Inbox` only, with `Shots`/`Tasks` moved to a new archetype and `Workspace Home` moved to another new archetype.
2. A new §6.x "Object Browser / Catalogue Archetype" section would need to be authored, with its own User goal, Priority order, and Design principles (analogous in structure to the existing §6.1–6.4 sections), covering VFX Shots / CG Tasks / Artist Tasks.
3. A new §6.x "Workspace / Orientation Archetype" section would need authoring for Workspace Home, per the already-accepted Home responsibility audit.
4. `docs/design/ICAS_FULL_PRODUCT_MIGRATION_MAP.md`'s disposition of all three Workspace Homes and all three catalogue pages as `"Worklist (object-row reuse)"`, `LOW` risk, `"no change needed"` would need to be revisited once the archetype split above is approved — those pages' migration status should not be read as final sign-off under the old classification.

---

## 20. Open decisions requiring OWNER approval

1. **Archetype split itself** — confirm the Workspace/Orientation and Object Browser/Catalogue archetypes as proposed in §19 before `ICAS_DESIGN.md` is amended.
2. **VFX Shot visual preview** — §9 confirms real, live, ftrack-backed thumbnail media exists and already works for single-Version detail pages, but bringing it to list scale means either accepting N live ftrack round-trips per list render or commissioning a new caching layer (neither exists today). OWNER should decide: defer the preview until a caching approach is chosen, accept the live-per-row cost for a first version, or proceed with the non-image identity alternative in the interim.
3. **Whether CG/Artist Task catalogues should ever carry a preview** — the same media pipeline is already wired for Artist's Current Version page (and could analogously serve CG), so this is not a capability gap for those roles either — it is the same list-scale cost/caching question as #2, not a separate one. OWNER should confirm whether to pursue this for any role beyond VFX, or explicitly defer all three together.
4. **"Requiring attention only" filter removal** (§16) — confirm removal from the CG/Artist Tasks catalogues, or an explicit decision to keep it as a deliberate Inbox-shortcut despite the object-model inconsistency it creates.
5. **Artist Tasks' leading-line fix** (§13/§14) — confirm switching the leading row line from `next_action.title` to a state label, matching VFX/CG's existing pattern.
6. **Sequence-level grouping** for VFX Shots — unconfirmed against the domain model (§18); decide whether to investigate before the redesign proceeds.
7. **Search-by-text vs. select-only filtering** — confirmed derivable (§18) but not requested by name in the current instruction; confirm whether it's in scope for this redesign round.
8. **Backend pagination** — explicitly out of scope per §18/§0.5 (no backend commissioning this turn); confirm this remains deferred.
9. **Migration Map re-classification** — `ICAS_FULL_PRODUCT_MIGRATION_MAP.md`'s existing "no change needed" disposition for the Homes and catalogue pages should be treated as superseded once §19's archetype split is approved; confirm this is understood as a status change, not a contradiction of prior sign-off.
