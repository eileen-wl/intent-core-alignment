# Step 8B — ICAS ftrack Version / ReviewNote Sync Contract

**Status:** Contract locked (design only — no slice implemented in this task)
**Nature of this document:** an architecture/contract document plus targeted real-workspace evidence. No application source file, migration, generated contract, or local database row was changed. No ftrack entity was created, updated, or deleted.

---

## 1. Executive contract decision

Step 8A's proposal is **revised, not accepted as-is**, on two material points that new real-workspace evidence in this task disproves or complicates:

1. **Task lineage is not dispensable.** Real ftrack data proves one Shot (`bc0040`) has AssetVersions from **three distinct Tasks** (Compositing, Rotoscoping, Layout), and reading the actual current CG/Artist page code (`loadVersionReviewWorkspaceData`, `loadCurrentVersionData`) confirms both call `listVersionsForShot(shot_id)` with **zero Task filtering**. Shot-only storage (Step 8A's recommendation) would make a CG Supervisor's "Rotoscoping" Task Workspace display Compositing and Layout Versions too. **Decision: add a nullable `Version.task_id`** (§4).
2. **The "66% via ReviewSessionObject" figure is not what it appears.** A full, exhaustive resolution of all 68 distinct `ReviewSessionObject` ids referenced by real Notes shows only **8 of 68 (11.8%) still resolve** to a live `ReviewSessionObject`; the other **60 of 68 (88.2%) point at an already-deleted `ReviewSessionObject`** (confirmed against a full unfiltered `ReviewSessionObject` listing — only 11 rows exist workspace-wide today, and cross-checked with `session.get`, not just the query parser). Step 8A's single-example trace was real but not representative. **Decision: this is expected, permanent orphaning, not a bug to fix** (§12).

Additionally, this task's own required checks disprove the missing-timestamp assumption in the other direction: it is **not "unresolved," it is now confirmed absent** — `AssetVersion` and `Note` schema attribute lists (queried directly from the live server) contain no `updated_at`/`modified_at`/`date_updated`/`last_modified`/`modification_date` field of any kind. Only `date` exists. This locks in an explicit non-goal (§14) rather than leaving it open.

**Selected contract, in one paragraph:** `Version` gains four additive, nullable columns — `task_id`, `source_created_at`, `external_author_id`, `external_author_name` — and `ReviewNote` gains three (the same set minus `task_id`, which has no meaning on a Note); no existing row's value ever changes. `external_author_id` is always sourced from the real ftrack stable id field (`user.id`/`author.id`), **never** from `username`, email, or a display name (§7). Neither `VersionCreate` nor `ReviewNoteCreate` (the public manual-create contracts) is touched — ftrack identity is accepted only through a new **trusted-only internal sync endpoint**, distinct from the public create path, additionally gated by an internal shared-secret header (§8). Reconciliation performs a **complete targeted sweep of every already-linked Shot on every run** — bounded by scope (only already-linked Shots), not by a cursor; exact `ExternalEntityLink` identity already makes a repeat sync idempotent, so **no `Version`/`ReviewNote` `SyncCursor` row is created or needed** (§10). A synced Version/Note is a **true no-op on repeat sync** (never mutated) — consistent with their existing immutable/append-only product rule — which means content edited in ftrack after first sync is never reflected in ICAS; this is named and accepted, not hidden (§14).

**Readiness verdict: Ready for Step 8C** (§17).

---

## 2. Step 8A evidence inherited

Everything in `docs/step-8/01_STEP_8A_FTRACK_VERSION_NOTE_RELATIONSHIP_VALIDATION.md` is inherited unless explicitly revised below:

- Real access to the same controlled workspace (`bristol-l.ftrackapp.com`) succeeds.
- `AssetVersion.asset.parent` and `AssetVersion.task.parent` agree on the same Shot for Shot-scoped work; Asset-Build-parented AssetVersions have no Shot lineage at all (unchanged, re-confirmed by this task's own broader 99-row sample, §5).
- Real Notes: 45 `asset_version`-direct, 93 `review_session_object`-attached, 2 `task`-parented ICAS write-back echoes, 140 total (unchanged).
- `Note.parent_type` filter values are snake_case (`asset_version`, `review_session_object`, `task`) though displayed values render PascalCase (unchanged, structurally revalidated in this task's own query set).
- `Note.author.username` is inconsistently populated; `first_name`/`last_name` are reliable (unchanged).
- The `"[Intent Core Alignment System]"` write-back marker is real and present on real data (unchanged).

**Revised in this task**, both are real-workspace findings, not inference:

- §1 item 1 above: exhaustive `ReviewSessionObject` resolution (§9 below) replaces the single-example trace.
- §1 item 2 above: the timestamp question moves from "unresolved" to "confirmed absent" (§9 below).

---

## 3. Additional real-workspace checks

Both checks used only `session.query(...)`, `session.get(...)`, and `session.types[...].attributes` (client-side schema introspection, read-only) through the existing `FtrackConnector`. No write method was called.

### A. Timestamp capability

Every plausible field name was tried directly as a query field (not guessed from documentation) against both entity types, and the full real schema attribute list was also pulled directly from the server for cross-verification:

| Field tried | `AssetVersion` result | `Note` result |
|---|---|---|
| `updated_at` | `ParseError: No attribute 'updated_at' exists` | same error |
| `modified_at` | `ParseError` | same |
| `date_updated` | `ParseError` | same |
| `last_modified` | `ParseError` | same |
| `modification_date` | `ParseError` | same |

Full real schema attribute lists (queried directly, not inferred):

- `AssetVersion`: `_link, asset, asset_id, comment, components, custom_attributes, date, id, incoming_links, is_latest_version, is_published, link, lists, metadata, notes, outgoing_links, project, project_id, review_session_objects, status, status_changes, status_id, task, task_id, thumbnail, thumbnail_id, thumbnail_url, used_in_versions, user, user_id, uses_versions, version`
- `Note`: `author, category, category_id, completed_at, completed_by, completed_by_id, content, date, frame_number, id, in_reply_to, in_reply_to_id, is_todo, metadata, note_components, note_label_links, parent_id, parent_type, project, project_id, recipients, replies, thread_activity, user_id`

**Result: `date` is the only timestamp field on either entity, confirmed exhaustively, not by guessing a small set of names.** `Note.completed_at` exists but is a distinct concept (a to-do-style Note's completion marker, paired with `is_todo`/`completed_by`) — not a general modification timestamp, and not populated as such in this workspace's data.

**Clarification of what `date` means:** `date` is creation-time, not last-modified. This is supported two ways: (1) there is structurally no other timestamp field for it to be conflated with, and (2) `AssetVersion` is ftrack's publish-immutable unit by convention — a re-export creates a new `AssetVersion` row (a new `version` number) rather than mutating an existing one, which is why the schema has no modification field at all. `Note.date` is more genuinely ambiguous in principle (a user could in theory edit posted note text), but there is no schema-level way to detect this in this workspace, and no evidence either way was found in the sampled real data. **Treat `date` as creation-time for both; treat "was this content edited after posting" as unknowable and out of scope** (§14).

### B. ReviewSessionObject completeness

All 93 real Notes with filter-comparable `parent_type == "review_session_object"` were read for their `parent_id`, producing **68 distinct `ReviewSessionObject` ids** (multiple Notes commonly share one review-session object). Each of the 68 was then resolved with a direct, targeted query (`select id, asset_version.id, asset_version.asset.parent.object_type.name from ReviewSessionObject where id is "<id>"`), and the aggregate outcome was:

| Outcome | Count | % of 68 |
|---|---|---|
| Resolves to a live `ReviewSessionObject` with a non-null, Shot-scoped `asset_version` | 8 | 11.8% |
| Resolves to a live `ReviewSessionObject` with a null `asset_version` | 0 | 0% |
| Resolves to a live `ReviewSessionObject` with an Asset-Build-scoped `asset_version` | 0 | 0% |
| **Does not resolve at all** (query returns zero rows) | **60** | **88.2%** |
| Resolves but the object-type lookup itself errors | 0 | 0% |

The 60-unresolvable figure was independently cross-checked two ways, not accepted on a single query form: (1) an unfiltered `select id from ReviewSessionObject` (no `where` clause at all) returns exactly **11** total live rows in the entire workspace — consistent with only a small subset of the 68 referenced ids ever being resolvable; (2) `session.get("ReviewSessionObject", <id>)` (bypassing the query-string parser entirely) was tried directly against three specific ids and agrees exactly with the query-based result — `None` for two ids the query also reported unresolvable, and a real object for the one id already known-good from Step 8A's trace.

**Interpretation:** these `ReviewSessionObject` rows have been deleted from ftrack since the Notes were posted — a normal, expected ftrack workflow (review sessions are commonly cleaned up after use while Notes on the underlying Version persist). The `parent_id` values that fail to resolve are older-generation ids (timestamp-prefixed UUIDs from 2019, e.g. `a1ea780a-a899-11e9-...`) versus the resolvable ones being newer; this is consistent with, though not proof of, an age-based cleanup pattern. **This is real-workspace evidence, exhaustively checked (all 68, not a sample), not inference.**

### C. External author id stability (correction task)

Targeted, minimal-field, read-only queries only (`id`, `user.id`/`author.id`, `username`, `first_name`, `last_name` — no Note content, no credentials). Presence/absence only is reported below; no real id, username, or name value is reproduced.

Three required representative examples, each checked individually:

| Example | `user.id`/`author.id` | `username` | `first_name`/`last_name` |
|---|---|---|---|
| A normal `AssetVersion` author (the same real AssetVersion used throughout Step 8A/8B) | **present** | present | present |
| A normal direct (`asset_version`-parented) Note author | **present** | present | present |
| The previously observed guest/client reviewer Note (`review_session_object`-parented, real `username` already known missing from Step 8A) | **present** | absent (null) | first_name present, last_name empty string |

The third row is the important, non-obvious result: **the guest/client reviewer's `author.id` is present even though `username` is not.** The originally assumed framing — "a guest reviewer has no stable author id" — is not quite what real data shows once checked exhaustively (below); the reviewer's *account* does carry a stable id, only their `username` is unset.

Exhaustive checks (every real row, not a sample) to characterize how general this is:

| Population | Total | Author relation entirely absent (`null`) | Author present, `.id` populated | Author present, `.id` absent |
|---|---|---|---|---|
| `AssetVersion.user` (all real AssetVersions) | 99 | 0 | **99 (100%)** | 0 |
| `Note.author`, `asset_version`-direct Notes | 45 | 0 | **45 (100%)** | 0 |
| `Note.author`, `review_session_object`-parented Notes | 93 | **60 (64.5%)** | 33 (35.5%) | 0 |

**Conclusion, exhaustively confirmed, zero counterexamples across all 237 real rows checked:** whenever `AssetVersion.user` or `Note.author` is populated at all, `.id` is *always* populated alongside it — there is no real case of "author link present but id missing" in this workspace. The real failure mode for `review_session_object`-parented Notes is not "guest reviewer lacks a stable id" but **"no author relation is recorded on the Note at all"** (64.5% of that category) — a coarser, all-or-nothing absence, not a partial one. This corrects, and replaces, the task's originally assumed framing; the locked contract in §7/§13 reflects the real result, not the original assumption.

---

## 4. Final Version lineage decision

**Selected: Option B — `Version` receives a nullable `task_id` FK.**

Evidence against the alternatives, using this task's own required comparison points:

| # | Contract | Verdict | Why |
|---|---|---|---|
| A | Shot-only (Step 8A's original proposal) | **Rejected** | Real data: Shot `bc0040` has AssetVersions from 3 distinct Tasks (Compositing ×2, Rotoscoping ×1, Layout ×2 — §5). Real code: `loadVersionReviewWorkspaceData` (CG) and `loadCurrentVersionData` (Artist) both call `listVersionsForShot(shot_id)` with no Task filter — confirmed by reading `apps/web/src/features/cg/version-review-workspace/data.ts` and `apps/web/src/features/artist/current-version/data.ts` directly. Shot-only storage would show a CG Supervisor working the Rotoscoping Task the Compositing and Layout Versions too. |
| B | Nullable `task_id` FK | **Selected** | Matches ftrack's own real shape 1:1 (`AssetVersion.task` is a single direct reference, never multi-valued) — no join table needed. Resolved via `ExternalEntityLink` on the real `task.id`, never a name. Nullable, so every existing manually-created `Version` row is untouched (`task_id IS NULL` for all of them, forever, unless a human chooses otherwise later — out of this contract's scope). |
| C | External Task reference only / denormalised Task name | **Rejected** | The task brief's own constraint ("avoid name-based identity matching") rules out a name field as the *filtering* key; a name-only field could be kept as a display convenience but cannot replace a real FK for CG/Artist page filtering, since ftrack Task names are not guaranteed stable or unique (a rename would silently break any name-based join). |
| D | Other minimal relational design | **Not needed** | No real evidence supports anything beyond a single nullable FK — `AssetVersion` never has more than one `task`, so no many-to-many shape is justified by real data. |

Constraint check against the task's five stated requirements:

- **Preserve manual Shot-level Versions** — yes; `task_id` is nullable and unset for every existing/future manually-created `Version`, exactly matching today's already-accepted convention (`versions_and_feedback/models.py`'s own docstring: "a Shot may have several Tasks and several Versions with no join between them" — a documented, deliberate existing gap for manual entry, left untouched).
- **Retain real ftrack Task lineage where available** — yes, via the FK, resolved from the real `AssetVersion.task.id`.
- **Avoid name-based identity matching** — yes; `task_id` is resolved via `ExternalEntityLink` on the real ftrack Task id, never the Task's name.
- **Prevent incorrect Task/Version pairing** — yes; a ftrack-sourced `Version` is only ever paired with the Task ftrack itself already associated it with (`AssetVersion.task`), never inferred.
- **Remain compatible with VFX Shot-wide Versions pages** — yes; `apps/web/src/features/vfx/versions-workspace/data.ts`'s `loadVersionsWorkspaceData` calls `listVersionsForShot` unchanged and simply ignores the new `task_id` field; no VFX page needs to change.
- **Remain compatible with CG/Artist Task-scoped pages** — yes, but this is a real, necessary Step 8C consequence, not automatic: `loadVersionReviewWorkspaceData`/`loadCurrentVersionData` must be updated to filter by `task_id` when present, with the existing full-Shot-list behavior kept as the fallback for legacy/manual Versions where `task_id IS NULL` (Step 8C slice, §15 item 8 — **not implemented in this task**).

`CrossRoleAssessment`'s existing pattern (`task_id` supplied explicitly by the caller at generation time, validated against the target Version's Shot: `apps/api/src/intent_core_api/agents/cross_role_assessment_service.py` lines ~1506-1511) is additional real evidence this design direction is already the accepted shape elsewhere in the codebase for exactly this problem — Step 8B's `Version.task_id` follows the same spirit at the storage layer instead of requiring every caller to re-supply it.

---

## 5. Final ReviewNote lineage decision

Unchanged in shape from Step 8A (`ReviewNote.version_id` stays a hard FK to `Version`, no new relational target), but the resolution logic is revised given §3.B's real evidence:

- **`parent_type == "asset_version"`**: resolve `Version` directly via `ExternalEntityLink` on `parent_id`. Reliable — 45/45 real examples resolve this way.
- **`parent_type == "review_session_object"`**: resolve the `ReviewSessionObject` first; **expect roughly 9 of 10 to fail to resolve at all** in steady state (§3.B), not a rare edge case. A failed resolution is skipped and logged, never invented against a guessed `Version` (unchanged principle from Step 8A, now backed by an exact real rate instead of an unverified assumption).
- **`parent_type == "task"`** whose content begins with the write-back marker: excluded outright, never treated as incoming content (unchanged).

**Practical consequence, stated honestly:** at this workspace's current state, only 45 + 8 = **53 of 140 real Notes (37.9%)** are realistically ingestable as a `ReviewNote` today — not the 138/140 (98.6%) Step 8A's single-example trace implied. This is the corrected, exhaustively-checked figure and should replace the earlier one in any future reference to this workspace's ingestable Note rate.

---

## 6. Timestamp semantics

**Decision: `Version.created_at`/`ReviewNote.created_at` keep their existing meaning — ICAS ingestion time — unchanged for every row, manual or synced.** Two new nullable columns, `source_created_at` (on both `Version` and `ReviewNote`), hold the real ftrack `date` value separately.

Rejected: redefining `created_at` itself to mean "external ftrack event time" for synced rows. Real code already depends on `created_at`'s current ingestion-time meaning for ordering, and changing its meaning silently for only some rows (source-dependent semantics on one column) would be a hidden contract change, not an additive one:

- `versions_and_feedback/service.py`'s `list_versions_for_shot` orders by `Version.created_at`.
- `apps/web/.../vfx/versions-workspace/data.ts` sorts by `created_at` (newest-first display).
- `apps/web/.../artist/current-version/data.ts` sorts `sortedVersions` by `created_at`.
- A first historical backfill sync could ingest years of real AssetVersions/Notes in a single job run; if `created_at` meant "external event time," a years-old real Note synced today would still need `created_at` distinct from "when ICAS learned about it" for audit/debugging purposes anyway — so both meanings are genuinely needed, not substitutable for each other.

`source_created_at := AssetVersion.date` / `Note.date` (the only real timestamp available, §3.A). **No `source_updated_at` field is added** — there is nothing real to source it from (§3.A's exhaustive result), and fabricating one (e.g., defaulting it to `source_created_at`) would misrepresent an absence of information as a positive claim. If ftrack ever exposes a real modification signal, or Event Hub integration supersedes polling, this can be revisited as a new, explicit change — not assumed now.

**Historical ordering implication (a real Step 8C consequence, not implemented here):** any page that wants correct chronological order for ftrack-origin rows must sort by `COALESCE(source_created_at, created_at)`, not blindly by `created_at` — otherwise a same-day backfill run would show a decade of real historical Versions as if they all happened "just now." Flagged explicitly in §15 slice 8.

---

## 7. External author / provenance semantics

**Decision: keep both existing fields *and* add new ones — they answer different questions.**

- `created_by_actor_kind := "system"`, `created_by_actor_id := "ftrack-sync"` (a fixed, distinct identifier from the generic `"system"` constant already used for cascade side-effects elsewhere, so audit rows are traceable to this specific ingestion path), `created_by_human_role := None`, **always**, for every ftrack-synced `Version`/`ReviewNote`. This answers "who/what wrote this row into ICAS" — the sync process, never a human, matching `ActorContext`'s own hard invariant that only `actor_kind="human"` may carry a `human_role`, and the task's explicit authority rule.
- New nullable `external_author_id`/`external_author_name` columns (on both `Version` and `ReviewNote`) hold the *real* ftrack author as pure provenance metadata, sourced from **two structurally distinct fields, never conflated**:
  - **`external_author_id`** — the real ftrack stable id: `AssetVersion.user.id` (confirmed present in 99/99 real AssetVersions, §3.C) or `Note.author.id` (confirmed present in every case where the `author` relation exists at all — 45/45 direct Notes, 33/33 non-null-author `review_session_object` Notes, §3.C). **Never** `username`, email, or a display name — a stable ftrack account id is a materially different, more durable identity than a mutable username, and the task's own constraint forbids substituting one for the other. `external_author_id` is `null` only when the `author`/`user` relation itself is entirely absent on the source row (confirmed real for 60/93, 64.5%, of `review_session_object`-parented Notes — never for `AssetVersion.user` or direct-Note `author`, §3.C) — not merely when `username` happens to be unset. A guest/client reviewer whose `author` link exists (as in the specifically-checked example) still gets a real, non-null `external_author_id`.
  - **`external_author_name`** — `username` when present, else `f"{first_name} {last_name}"` (or just `first_name` when `last_name` is empty, as in the checked guest-reviewer example) — a display-only fallback, matching the already-confirmed fallback need from Step 8A §7 (`author.username` is not reliably populated for guest reviewers). `null` only when `external_author_id` is also `null` (no author recorded at all).
  
  This answers "who authored the content in the source system" — explicitly *not* wired into `human_role`, permissions, `require_human_role`, or any Decision/HumanGate path.

Comparison against the task's three named options: this is deliberately **both** "reuse `created_by_actor_kind`/`created_by_actor_id`" *and* "add `external_author_name`/`external_author_id`" — not an either/or, because they are not competing answers to the same question. Using only the existing fields (setting `created_by_actor_id` to the ftrack username directly) would either violate the `human`-requires-`human_role` invariant if `actor_kind="human"` were used, or discard the real author's identity entirely if `actor_kind="system"` were used without new columns. Using only new fields without the `system`/`"ftrack-sync"` convention would leave `created_by_actor_kind`/`created_by_actor_id` inconsistent with every other row in the same tables.

**Authority rule, restated as enforced by this design:** nothing in this contract ever sets `created_by_human_role` from ftrack data, and `external_author_*` is never read by any permission check, `require_human_role` call, or Decision/HumanGate/Anchor-confirmation path anywhere in the system — those remain exclusively human-actor, header-driven (`get_current_actor`), completely untouched by this contract. A ftrack author appearing in `external_author_name` is display-only production provenance, never an ICAS Human VFX Supervisor, Human CG Supervisor, or Human Artist.

---

## 8. Trusted sync API boundary

**Real finding, this task's own required inspection:** `POST /projects`, `POST /shots`, `POST /tasks` (`apps/api/src/intent_core_api/production_context/router.py`) already accept `source="ftrack"` + arbitrary `external_id` through the **ordinary public create contract**, with **no actor dependency and no role check at all** — confirmed by reading the router: `create_project`/`create_shot`/`create_task` take no `Depends(get_current_actor)` and call no `require_human_role`. The only validation is `_check_external_id_matches_source` (contracts-layer: source/external_id must be consistent with each other), which checks internal consistency, not caller identity. **Any client on the network can already inject a fake Project/Shot/Task claiming `source="ftrack"` with a fabricated `external_id` today.**

**Decision: do not repeat this pattern for Version/ReviewNote — Option C, a shared sync-only payload/endpoint, gated stronger than the existing precedent.**

- `VersionCreate`/`ReviewNoteCreate` (the public manual-create contracts) are **not extended** with `source`/`external_id` at all. They stay exactly as they are today, human-actor-only, `require_human_role`-gated.
- New, separate contracts (`VersionSyncCreate`, `ReviewNoteSyncCreate`, e.g. in a new `packages/contracts/python/src/intent_core_contracts/api/ftrack_version_note_sync.py`) carry `external_id`, `shot_external_id`, `task_external_id` (optional), the mapped fields (§13), `external_author_id`/`external_author_name`, `source_created_at`. `source` is **not** a client-settable field on this contract at all — it is hardcoded `"ftrack"` server-side, since this endpoint's only purpose is connector-owned ingestion.
- New endpoints `POST /internal/sync/versions`, `POST /internal/sync/review-notes` (reusing the existing `/internal` prefix convention already established by `ops/router.py` and `demo_seed/router.py`), additionally protected by a **shared internal-service token header** (e.g. `X-Internal-Sync-Token`, checked against a value configured only in `apps/api`'s and `services/worker`'s `.env`, never logged — per `CLAUDE.md`'s "do not expose or print secrets" rule). This is a genuine, concrete strengthening over the existing Project/Shot/Task precedent, chosen because Version/ReviewNote feed `AlignmentAssessment`/`CrossRoleAssessment` (AI evaluation of creative alignment) — a spoofed ftrack-labeled Version or Note could pollute an assessment with fabricated "production evidence," a materially worse consequence than a spoofed container row.
- **Named, explicit non-fix (out of this task's scope):** Project/Shot/Task's existing unauthenticated `source`/`external_id` exposure is a real, already-existing gap this task surfaces but does not remediate. Step 8B recommends a follow-up apply the same internal-token check retroactively; this is not part of the Step 8C slices below (§15) unless separately approved, since retrofitting an existing public contract's auth behavior is itself a "change to a public API contract" under `CLAUDE.md`'s change-boundary list and needs its own explicit sign-off.

**Contract answers to the task's five required points:**

- **Who may submit ftrack identity:** only the new internal sync endpoints, called exclusively by `services/worker`'s reconciliation job (itself invoking `services/ftrack-connector`), matching ADR-0008's existing worker→apps/api-over-HTTP pattern. No human-facing client ever supplies `external_id`.
- **Where `ExternalEntityLink` is created:** inside the sync endpoint's service function, in the same request/transaction as the `Version`/`ReviewNote` insert — mirrors `create_project`'s existing `add → flush → record_external_link → commit` sequence exactly.
- **Transaction/atomicity boundary:** one DB transaction per `Version` (or per `ReviewNote`) — not batched across multiple rows in one transaction, so one bad row's failure never blocks the rest of a sync run (matches "idempotency over production-scale optimisation").
- **Duplicate/conflict response behavior:** a repeat sync of an already-linked `external_id` is a **true no-op**, not an update — deliberately different from Project/Shot/Task's existing update-on-repeat-sync behavior, because `Version`/`ReviewNote` are documented immutable/append-only with no update endpoint anywhere in the API surface (their own model docstrings). A genuine concurrent-insert race on the same `external_id` surfaces as a conflict (mirrors the existing `IntegrityError` → `ConflictError` translation pattern in `versions_and_feedback/service.py`'s `decide_alignment_assessment`), not a silent double-insert.
- **Partial Version-without-link or Note-without-link rows:** not possible under normal operation, by the same atomic-transaction guarantee already relied on for Project/Shot/Task — if `record_external_link`'s insert fails, the whole transaction (including the `Version`/`ReviewNote` insert) rolls back.

---

## 9. ExternalEntityLink rules

No schema change to `ExternalEntityLink` itself — reused exactly as-is (ADR-0010). `entity_type="version"` / `entity_type="review_note"`, `source="ftrack"`, `external_id` = the real `AssetVersion.id` / `Note.id`. One link per synced row (matches the existing `UNIQUE(entity_type, entity_id, source)` constraint, already sufficient for two more entity types without modification).

---

## 10. Reconciliation strategy

**Selected: Option B — a complete targeted sweep for every already-linked Shot, on every reconciliation run. No `SyncCursor` row is created for Version/Note sync.** This is a revision of this document's earlier draft, which additionally proposed two placeholder `SyncCursor`s (`"ftrack_version_reconciliation"`, `"ftrack_note_reconciliation"`) that were never actually read to control which rows a run would examine — pure unused scaffolding. They are removed, not merely deprioritized: Step 8C must not create those rows, must not add cursor fields for this purpose, and must not write to them, because nothing in the selected strategy would ever consult them.

Why not Option A (pure timestamp-incremental) alone: real evidence conclusively shows there is no `updated_at` on either entity (§3.A). A cursor-only design would have no way to distinguish "nothing changed since the cursor" from "the cursor missed something," since there is no field to sanity-check it against — exactly the failure mode the task instructed this contract to avoid. New *content* discovery (a new AssetVersion, a new Note) is in principle still reliably caught by date-filtering on `Note.date`/`AssetVersion.date` (genuine creation timestamps), but the bigger, more concrete risk is **under-covering a Shot's baseline the moment it becomes linked**, since a newly-linked Shot can already have years of real history a cursor starting "now" would never see.

Why the selected strategy needs no cursor at all: the safety property a cursor would normally provide — "don't miss content, don't reprocess forever" — is already fully provided by two things already in place, independent of any cursor: (1) the **complete per-Shot sweep** re-derives the full real relationship graph from the Shot down, every run, so nothing about the *scope of what's examined* depends on remembering a timestamp; and (2) **exact `ExternalEntityLink` identity** (`find_linked_entity_id(entity_type, source="ftrack", external_id)`) already makes re-examining an already-synced row a true no-op (§8, §11) — re-scanning the same `AssetVersion`/`Note` on every run costs a query, not a duplicate write. A cursor would only earn its keep as a way to *avoid re-querying* ftrack itself at larger scale — a real, named, but explicitly deferred production-scale optimization (§16), not a correctness requirement at this prototype's scale (a handful of linked Shots).

**The strategy, concretely:**

1. **Every run, for every already-linked Shot:** run one **complete, unbounded** targeted sweep — `AssetVersion where asset.parent.id is <shot_id>` (no date filter), then for each returned `AssetVersion`, both the direct-Note query and the `ReviewSessionObject`-mediated Note query (§5). Scope is bounded by "already-linked Shots" (a small, controlled set), not by time — this is what keeps "prefer correctness" affordable at prototype scale, and it applies identically whether the Shot was linked years ago or was linked for the first time moments before this run.
2. **Exact `ExternalEntityLink` identity makes a repeat encounter a true no-op:** every `AssetVersion`/`Note` the sweep re-discovers is looked up via `find_linked_entity_id(entity_type, source="ftrack", external_id)`; if already linked, nothing is written (§8, §11) — the sweep's cost on a re-run is read-only re-querying of ftrack, never a duplicate or mutated local row.
3. **Deleted/moved/unresolvable external rows:** skipped and logged; the corresponding already-synced local `Version`/`ReviewNote` (if one exists) is left untouched as historical data — **never deleted**, matching the explicit instruction and the existing additive-only pattern.
4. **Why the second identical run is a no-op:** directly by construction of point 2 — no cursor, timestamp, or other run-to-run state is needed for this property to hold.
5. **`SyncCursor`:** the existing `"ftrack_shot_reconciliation"` cursor (Project/Shot/Task reconciliation, ADR-0011) is **unchanged and unaffected** by this contract — Version/Note sync does not read or write it, and creates no cursor row of its own.
6. **What remains deferred for production scale, explicitly not implemented or scaffolded now:** a per-Shot or global `SyncCursor` for Version/Note sync (to avoid re-querying ftrack for already-swept Shots on every run) once the number of linked Shots is large enough that a full per-Shot sweep every run becomes expensive; parallelizing per-Shot sweeps; replacing polling with Event Hub-based change notification (ADR-0009's existing deferral); any mechanism for detecting a genuine content edit in ftrack (no real signal exists to build this on today, §3.A). Each of these is a later, evidence-driven decision to make when production scale actually demands it — not a placeholder to build ahead of that need.

**No remote deletion of local historical rows** — satisfied by construction (step 3); nothing in this contract ever issues a `DELETE` against `versions`/`review_notes`.

---

## 11. Idempotency and atomicity

Covered in full in §8 (trusted API boundary) and §10 (reconciliation) — restated here for completeness per the required document structure: idempotency is keyed **entirely** by `ExternalEntityLink(entity_type, source="ftrack", external_id)`; atomicity is one DB transaction per synced row, matching the existing Project/Shot/Task pattern; a repeat sync is a true no-op (not an update), a deliberate, named divergence from Project/Shot/Task justified by `Version`/`ReviewNote`'s existing immutability rule. **No `SyncCursor` row is created, read, or written for Version/Note sync** — idempotency does not depend on cursor state at all, only on the exact `ExternalEntityLink` lookup, so a run with no prior cursor behaves identically to the hundredth run.

---

## 12. Deletion/move/orphan behavior

- A `Note` whose `parent_type == "review_session_object"` and whose `ReviewSessionObject` no longer resolves: **expected in the large majority of cases** (88.2% of real Notes referencing a `ReviewSessionObject` in this workspace, §3.B) — skipped and logged as a normal, common outcome, not flagged as an anomaly per occurrence. A future dashboard/log summary should report this as an aggregate rate, not per-row noise.
- An `AssetVersion` whose Shot lineage resolves to an Asset-Build (no Shot at all): skipped, unchanged from Step 8A (§4 of that document).
- An already-synced `Version`/`ReviewNote` whose external counterpart is later deleted in ftrack entirely: left as historical, orphaned-but-intact local data — never deleted, per the explicit instruction and the existing "confirmed records must be versioned; do not overwrite history" product rule (`CLAUDE.md`).
- A Shot that is unlinked/moved in ftrack: out of scope for this contract (Project/Shot/Task reconciliation's existing behavior governs Shot-level identity; Version/Note sync only ever operates on Shots that are already linked, and does not itself re-derive or re-link Shot identity).

---

## 13. Locked field mapping

### AssetVersion → `Version`

| ICAS field | Source | Notes |
|---|---|---|
| `external_id` (via `ExternalEntityLink`) | `AssetVersion.id` | |
| `name` | derived: `f"{asset.name}_v{version:03d}"` | no direct 1:1 field exists (Step 8A §8, unchanged) |
| `version_number` | `AssetVersion.version` | |
| `description` | `AssetVersion.comment` | empty string allowed |
| `status` | **not synced** | explicit non-goal, unchanged from Step 8A — Step 8's own scope excludes status write-back; read-only status mirroring is a distinct, later decision |
| `shot_id` | resolved via `ExternalEntityLink` on `asset.parent.id` (preferred), cross-checked against `task.parent.id` | skip + log if neither resolves to an already-linked Shot |
| `task_id` (new, nullable) | resolved via `ExternalEntityLink` on `task.id` | **new in Step 8B** (§4); null if the Task itself is not yet linked (skip only the `task_id` assignment, not the whole `Version`, if Shot resolves but Task does not) |
| `source` | hardcoded `"ftrack"` server-side | never client-settable (§8) |
| `source_created_at` (new, nullable) | `AssetVersion.date` | **new in Step 8B** (§6) |
| `external_author_id` (new, nullable) | `user.id` | **new in Step 8B/correction** (§7, §3.C); confirmed present in 99/99 real AssetVersions; never `username`/email/display name |
| `external_author_name` (new, nullable) | `user.username` when present, else display name | **new in Step 8B** (§7); display-only fallback |
| `created_by_actor_kind`/`created_by_actor_id`/`created_by_human_role` | `"system"` / `"ftrack-sync"` / `None` | **new in Step 8B** (§7), always these fixed values for synced rows |
| Asset-Build / no-Shot AssetVersions | **not synced** | unchanged non-goal from Step 8A |

### Note → `ReviewNote`

| ICAS field | Source | Notes |
|---|---|---|
| `external_id` (via `ExternalEntityLink`) | `Note.id` | |
| `content` | `Note.content` | |
| `version_id` | resolved via §5's two-shape logic | direct for `asset_version`-parented; one-hop for `review_session_object`-parented (expect ~88% unresolvable for the latter, §3.B, §5) |
| `external_author_id` (new, nullable) | `author.id` | **new in Step 8B/correction** (§7, §3.C); present whenever `author` relation exists at all (45/45 direct, 33/33 non-null-author `review_session_object`); `null` only when `author` is entirely absent (60/93 of `review_session_object`-parented Notes) — never `username`/email/display name |
| `external_author_name` (new, nullable) | `author.username` if present, else `f"{first_name} {last_name}"` | display-only fallback; `null` only when `external_author_id` is also `null` |
| `source_created_at` (new, nullable) | `Note.date` | **new in Step 8B** |
| category | **not synced** | unreliable field (Step 8A §7: populated on only 1/7 sampled); not needed for any current ICAS use |
| `in_reply_to`/thread handling | **not synced, not flattened** | no real non-null example found in either task's sampling; deferred until a real example exists to validate a design against |
| `parent_type == "task"` (write-back echo) | **excluded outright** | never ingested, marker-matched (`content` startswith `"[Intent Core Alignment System]"`) |
| unresolvable parent (either shape) | skipped and logged | never invented against a guessed `Version` |
| `source` | hardcoded `"ftrack"` | never client-settable |

**Mandatory real constraints from Step 8A, all still locked in:** snake_case `parent_type` filter values; both `asset_version` and `review_session_object` shapes implemented from the start; write-back marker exclusion; no name-based lineage inference anywhere; Asset-Build/no-Shot AssetVersions skipped and recorded, not silently dropped; manually-created ICAS data untouched (guaranteed structurally — a manual row never has an `ExternalEntityLink`, so no sync path ever matches or mutates it).

---

## 14. Explicit non-goals

- **Detecting or reflecting a content edit made in ftrack after first sync.** No real modification signal exists (§3.A, exhaustively checked); combined with `Version`/`ReviewNote`'s existing immutability rule, a synced row reflects its state *at first sync time only*, permanently. This is a named, accepted limitation, not a bug budget item.
- Any write-back of `ReviewNote`/`Version` content or status to ftrack beyond what already exists (Core Anchor confirmation write-back only).
- Component/media download, proxy generation, or any binary asset handling.
- Event Hub real-time sync (ADR-0009's existing deferral, unchanged).
- Syncing Notes attached to any parent type other than `asset_version`/`review_session_object`.
- Syncing Asset-Build-parented (non-Shot) AssetVersions.
- Retrofitting the existing Project/Shot/Task public endpoints' auth gap (§8) — named, not fixed, here.
- `in_reply_to`/thread representation (§13).
- Read-only `status.name` mirroring (§13).
- **Any `SyncCursor` (per-Shot or global) for Version/Note sync.** None is created in Step 8C. Introducing one — to avoid re-querying ftrack for already-swept Shots at larger scale — is an explicit, later, evidence-driven production-scale decision (§10 item 6), not something to scaffold ahead of need.
- Any change to Event-Hub-vs-polling (§10 item 6; ADR-0009's existing deferral, unchanged).

---

## 15. Step 8C ordered implementation slices

None of the following was implemented in this task. Each slice states its required verification commands.

1. **Migration + models.** Add nullable `task_id` (FK `tasks.id`), `source_created_at`, `external_author_id`, `external_author_name` to `Version` and `ReviewNote` (`apps/api/src/intent_core_api/versions_and_feedback/models.py`). New Alembic migration (template: the existing single-table migrations, e.g. `0021`/`0022`). **Commands:** `alembic revision --autogenerate` (review the diff by hand before accepting), `alembic upgrade head` against the local dev Postgres, `ruff check`, `mypy` (`apps/api`).
2. **Python contracts.** New `VersionSyncCreate`/`ReviewNoteSyncCreate` (e.g. new `packages/contracts/python/src/intent_core_contracts/api/ftrack_version_note_sync.py`); extend `VersionRead`/`ReviewNoteRead` with the three new optional fields (additive, backward compatible). **Commands:** `mypy` (`packages/contracts`), `pytest` (contract validation tests), regenerate OpenAPI → TS types (`export_openapi` → `openapi-typescript`, matching the existing regeneration process).
3. **`apps/api` internal sync endpoints + service.** New `POST /internal/sync/versions`, `POST /internal/sync/review-notes`, protected by the internal shared-secret token header (§8); service layer implements the idempotent-no-op-on-repeat logic, Shot/Task resolution via `find_linked_entity_id`, skip+log for unresolvable lineage. **Commands:** `pytest` (new focused test file, e.g. `test_ftrack_version_note_sync.py`, covering idempotency, missing-link skip, token rejection, malformed-payload rejection), `ruff check`, `mypy`.
4. **`services/ftrack-connector` read models/query helpers.** `read_asset_versions_for_shot`, `read_notes_for_asset_version` (direct), `read_review_session_objects_for_asset_version`, `read_notes_for_review_session_object` — applying the real snake_case `parent_type` filter and the write-back-marker exclusion. **Commands:** `pytest` (`services/ftrack-connector/tests`, mocked-session pattern matching existing tests), `ruff check`, `mypy`.
5. **`services/ftrack-connector` sync client extension.** `sync_client.py` gains functions posting to the new internal endpoints (including the internal token header), mirroring `sync_shot_context`'s existing shape. **Commands:** `pytest`, `ruff check`, `mypy`.
6. **`services/worker` new reconciliation job.** `reconcile_ftrack_versions_and_notes`, implementing §10's complete-per-linked-Shot-sweep strategy — no `SyncCursor` read or written by this job — registered in the worker's arq job list. **Commands:** `pytest` (mirrors `test_tasks.py`'s existing `reconcile_ftrack_shots` test shape, minus any cursor-read/write assertions, since this job has none), `ruff check`, `mypy`.
7. **Tests, full pass.** Full backend + connector + worker `pytest` suites green; one manually-run, owner-executed real-workspace acceptance check against the controlled ftrack workspace (matching the roadmap's existing "Acceptance evidence required: a real, owner-validated sync of at least one real Version/Note pair" requirement — **not** part of automated CI). Result recorded as a new row in `docs/VALIDATION_EVIDENCE.md` by whoever runs it.
8. **Existing VFX/CG/Artist page integration.** Update `loadVersionReviewWorkspaceData` (CG) and `loadCurrentVersionData` (Artist) to filter by `task_id` when present, falling back to the full Shot list for `task_id IS NULL` rows (preserves today's exact behavior for manual/legacy Versions). Update chronological sort keys to `COALESCE(source_created_at, created_at)` wherever ftrack-origin rows may appear (§6). Leave VFX's `loadVersionsWorkspaceData` unchanged (Shot-wide by design). Display `external_author_name` distinctly from a Human role label wherever an author is shown, so a ftrack-authored Note is never visually presented as an ICAS Human Artist/Supervisor. **Commands:** `eslint`, `tsc --noEmit`, `vitest` (new/updated tests per touched page).
9. **Documentation and validation evidence.** Update `docs/DOMAIN_MODEL.md` (new nullable `Version`/`ReviewNote` fields), `docs/FTRACK_INTEGRATION.md` (mark the now-resolved open questions), `docs/IMPLEMENTATION_STATUS_AND_ROADMAP.md` (Step 8 status), `docs/VALIDATION_EVIDENCE.md` (once the real acceptance check in slice 7 runs). **Commands:** none beyond normal doc review; `git diff --check`.

Every slice ends with `git diff --check` before any commit, per the repository's own convention observed throughout Step 7/8A.

---

## 16. Risks and rollback boundaries

- **Spoofing risk on the new internal endpoints is reduced, not eliminated** — the shared-secret token (§8) is a real mitigation but is a static shared secret, not a full service-identity system; rotate it like any other secret, never commit it, never log it.
- **The existing Project/Shot/Task public-endpoint gap (§8) remains open** — explicitly named, not fixed by this contract. Any future incident involving a spoofed Project/Shot/Task row should reference this document as prior notice.
- **The 88.2% `ReviewSessionObject` orphan rate is workspace-specific** — this is one controlled demo/trial workspace (`docs/FTRACK_FEASIBILITY.md` §4's existing claim boundary); a real production workspace's review-session cleanup cadence could differ materially in either direction. Step 8C's acceptance check (slice 7) should record the real rate observed at that time as a fresh data point, not assume this document's figure still holds.
- **Rollback boundary:** every schema addition in this contract is a nullable, additive column with no backfill and no change to any existing row's value — an Alembic downgrade of the Step 8C migration is a pure column-drop with zero data-loss risk to existing manual `Version`/`ReviewNote` rows. The new internal endpoints and worker job can be disabled independently (stop calling them / unregister the arq job) without touching any already-synced row, since sync is additive-only and idempotent by construction.
- **A schema-shape risk named but not resolved:** if a future real workspace's `ReviewSessionObject`/`AssetVersion` relationship shapes differ from this one controlled workspace's (e.g., a workspace where Asset-Build items *do* have Shot-like lineage, or where Notes attach to parent types not observed here), the connector's per-entity-type try/except isolation (already the existing convention in `sample_entities.py`) contains the blast radius to that one query, not the whole sync run — but the *mapping decisions* in §13 are workspace-evidence-derived and should be re-validated, not assumed universal, before a second real workspace is connected.

---

## 17. Readiness verdict

**Ready for Step 8C.** Every open question Step 8A left for Step 8B to resolve has a locked answer: Task lineage (§4), timestamp semantics (§6), provenance/authority (§7), the trusted API boundary (§8), the reconciliation strategy (§10), and the final field mapping (§13). The two additional real-workspace checks this task required (§3) both returned conclusive, exhaustively-verified answers rather than partial ones. No blocker was found. The named risks (§16) are real but bounded and do not gate starting Step 8C — they are operational considerations for how Step 8C's slices should be built (internal token handling, honest orphan-rate reporting, additive-only migration discipline), not open design questions.
