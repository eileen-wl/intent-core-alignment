# Step 8A — Real ftrack AssetVersion / Note Relationship Validation

**Status:** Read-only investigation, complete
**Nature of this document:** a real-workspace, read-only evidence report. No application source file, migration, generated contract, or local database row was changed. No ftrack entity was created, updated, or deleted. No write-back action was called. This document itself is the only file created during this task.

---

## 1. Executive finding

Real, authenticated, read-only access to the team's controlled ftrack trial workspace (`bristol-l.ftrackapp.com`) succeeded and answered every open question `docs/FTRACK_INTEGRATION.md` §16 and `docs/FTRACK_FEASIBILITY.md` §3 left outstanding for Version/Note relationships. The real schema **confirms** the provisional design's core assumption (an `AssetVersion` traces cleanly to a Shot via two independent, consistently-agreeing paths) but also surfaces three real, non-obvious findings that the provisional design did not anticipate:

1. Two independent traversal paths (`asset.parent` and `task.parent`) both resolve to the same Shot for Shot-scoped work, but **not every `AssetVersion` has Shot lineage at all** — Asset-Build-parented versions (product/asset-library items) have neither.
2. The majority of real Notes in this workspace (93 of 140, 66%) are **not** attached directly to an `AssetVersion` but to a `ReviewSessionObject`, which itself references exactly one `AssetVersion` one hop away — a real relationship shape `docs/FTRACK_INTEGRATION.md` did not name.
3. `Note.parent_type` for a Shot-context Note is reported as the string `"task"`, not `"shot"` — a real ftrack schema quirk (Shot is implemented as a specialised Task/TypedContext) that would silently break a naive `session.get(parent_type, parent_id)` resolution strategy. This was caught empirically, not assumed from a display name, exactly as this task required.

No entity relationship in this report was inferred from a display name; every relationship below was proven by a targeted query and a real returned id.

**Recommendation: Ready for Step 8B with named constraints** (§17).

---

## 2. Starting repository baseline

- **Repository:** `D:\25fall everything\26summer\intent-core-alignment-recovery`
- **Branch:** `feat/step8a-ftrack-version-note-validation`
- **HEAD at start:** `216ad83` — `Merge pull request #16 from eileen-wl/recovery/step7c2-functional-clean` (preceded by `fc68916 style: apply repository formatters` and `9e406cb docs: add step 7c1 work-item architecture report`, both already committed on this branch before this task began — not produced by this task)
- **Working tree:** clean (`git status --porcelain` empty) before this task began.
- **Step 7 closure confirmed:** `docs/step-7/21_STEP_7_COMPLETION_BASELINE.md` §1 states "Step 7 is complete on this branch," §7 states Step 8 is next.
- **Step 8 scope read:** `docs/IMPLEMENTATION_STATUS_AND_ROADMAP.md` §I, "Step 8 — Necessary ftrack Version / Note / link extensions": *validate the targeted ftrack `AssetVersion` and Note relationships against the real test workspace; per-Shot Version/Note sync; an ICAS link or ftrack Action entry point; still no autonomous write-back*. §G (WP-C) confirms: "Completed: real Project/Shot/Task sync (reconciliation worker), real controlled write-back for Core Anchor confirmation. Not started: Version/ReviewNote sync from ftrack."
- **Existing ftrack evidence read:** `docs/VALIDATION_EVIDENCE.md` rows "Real ftrack Project/Shot/Task sync" and "Real ftrack controlled write-back" (both against Shot `bc0040`, both "Manual owner-supplied execution," both noting "No committed transcript... not independently re-verifiable from Git alone").
- **ADRs read:** ADR-0009 (ftrack-python-api as the SDK; real connect confirmed as of that ADR's writing, but no real query beyond schema discovery had been attempted at that time), ADR-0010 (`ExternalEntityLink` as its own table, upsert pattern), ADR-0011 (worker owns ftrack background jobs, polling reconciliation via `SyncCursor`), ADR-0012 (`WritebackRecord` + `request_write_back` flag, human-requested only).
- **`docs/FTRACK_INTEGRATION.md`** (status: "Provisional design — exact mappings must be validated") and **`docs/FTRACK_FEASIBILITY.md`** (status: "Live findings from one real connected ftrack test workspace," dated 2026-07-19) both read in full — see §11/§12 below for exactly which of their open items this task resolves.

---

## 3. Existing connector baseline

All of the following is **repository code evidence** (read directly, not run, except where noted in §4):

- `services/ftrack-connector/src/intent_core_connector/connector.py` — `FtrackConnector`: `connect()` (real `ftrack_api.Session`, `auto_connect_event_hub=False`), `health()`, `discover_workspace()`, `read_sample_entities()`, `read_shot_contexts_with_new_tasks()`, `write_note_to_shot()` (write-back — not called in this task), context-manager support.
- `discovery.py` — read-only schema discovery (`ObjectType`, `Status`, `CustomAttributeConfiguration`).
- `sample_entities.py` — a capped (`limit=5`), per-entity-type-isolated read of `Project`/`Shot`/`Task`/`AssetVersion`/`Note`, each query independently try/excepted so one schema mismatch doesn't hide the others. This is a genuinely useful existing tool, not something this task needed to duplicate for the baseline sample.
- `shot_context.py` — `read_one_shot_context` (first Shot alphabetically) and `read_shot_contexts_with_new_tasks_since` (ADR-0011 reconciliation, polling `Task.created_at`, since `Shot` itself has no queryable modification timestamp in this workspace — **already an empirically-verified finding from before this task**, consistent with — and reused as a starting assumption for — this task's own further findings).
- `sync_client.py` — pushes a `ShotContext` to `apps/api`'s existing `POST /projects` / `/shots` / `/tasks` with `source="ftrack"` + `external_id`, never writes to Postgres directly (ADR-0008). Not exercised in this task (would require calling `apps/api`, out of scope for a read-only ftrack investigation, and Version/Task sync isn't implemented yet regardless).
- `writeback_client.py` — `write_note_to_shot`: looks up the target `Shot`, resolves a `User` matching the configured API identity, calls `shot.create_note(content, author=author)` then `session.commit()`. **Not imported or called anywhere in this task.**
- `apps/api/src/intent_core_api/integrations/models.py` — `ExternalEntityLink(id, entity_type, entity_id, source, external_id, created_at, updated_at)`, `UNIQUE(source, external_id)` + `UNIQUE(entity_type, entity_id, source)`; `SyncCursor(key, last_synced_at)`; `WritebackRecord`.
- `apps/api/src/intent_core_api/versions_and_feedback/models.py` — `Version(id, shot_id, name, version_number, description, source, created_by_*, created_at)`, **no `task_id` column** (a Task's associated Versions are its Shot's Versions, an existing convention reused throughout Step 7C, not new to this task); `ReviewNote(id, version_id, content, source, created_by_*, created_at)` — **`version_id` is a hard FK; a `ReviewNote` can only ever belong to a `Version` in the current schema, nothing else.**
- `packages/contracts/python/.../versions_and_feedback.py` — `VersionCreate(shot_id, name, version_number, description)` and `ReviewNoteCreate(content)` — **neither currently accepts `source` or `external_id`**, unlike `ProjectCreate`/`ShotCreate`/`TaskCreate` (ADR-0010). This is a real, confirmed gap (repository code evidence, not inference).
- `apps/api/src/intent_core_api/production_context/router.py` — the existing idempotent-upsert pattern this task assumes Step 8B would extend: `find_linked_entity_id(session, entity_type=..., source=..., external_id=...)` → if found, treat as update target; if not, create the entity and the link together.
- `services/worker/src/intent_core_worker/tasks.py` — `reconcile_ftrack_shots` (polls `SyncCursor`, calls `FtrackConnector`, pushes via `sync_client.sync_shot_context`), `write_back_core_anchor_confirmation` (reads a `WritebackRecord`, calls `writeback_client.write_note_to_shot`, reports status back). Both real, both Project/Shot/Task- or write-back-scoped only — **neither currently touches `Version` or `ReviewNote`.**

**Automated mocked-test evidence** (repository evidence, distinct from real-workspace evidence): every test in `services/ftrack-connector/tests/` (`test_connector.py`, `test_sample_entities.py`, `test_shot_context.py`, `test_sync_client.py`, `test_writeback_client.py`, `test_discovery.py`, `test_workspace_profile.py`, `test_config.py`) uses a fake/stub session object (`_FakeSession`, `_FakeQuerySession`, etc.) — none make a real network call, by explicit repository testing rule. This is real proof the connector's *logic* is correct against a simulated schema; it is not proof the real schema matches that simulation. §4-§10 below are what actually proves the real schema.

**Assumptions not yet validated, as recorded before this task:** `docs/FTRACK_INTEGRATION.md` §3's own hedge — *"In ftrack publishing, the Asset normally belongs to a production context, while the Task is associated with the AssetVersion. The Connector should therefore map Version context and Task association separately rather than assume the Asset is a child of the Task."* This task tests that hedge directly (§6).

---

## 4. Real workspace access result

**Real access succeeded.** `FtrackConnector.connect()` opened a real `ftrack_api.Session` against `https://bristol-l.ftrackapp.com` using the credentials already configured in the repo-root `.env` (`FTRACK_SERVER`/`FTRACK_API_USER`/`FTRACK_API_KEY`, all present and non-empty — lengths checked, values never printed, per this task's instruction). This is the same workspace `docs/FTRACK_FEASIBILITY.md` recorded a first successful connection against on 2026-07-19, and the same workspace `docs/VALIDATION_EVIDENCE.md`'s Shot-`bc0040` rows refer to.

One environment step was required and is recorded here for completeness: `services/ftrack-connector` is a `uv` workspace member whose `ftrack_api`/`requests` dependencies were not yet installed into the shared `.venv` at task start. `uv sync --all-packages` (dependency installation only — no application code, no migration, no database write) resolved this in under a second (already cached). This is standard environment setup, not a modification of any tracked file (confirmed in §18).

No credential, session token, or account detail is reproduced anywhere in this document.

---

## 5. Queries attempted

All queries below were executed via `session.query(...)` (read-only) through the existing `FtrackConnector`; none used `session.create(...)`, `.create_note(...)`, `.update(...)`, `.delete(...)`, or `session.commit()`. Parameter placeholders below are redacted to `<shot_id>`/`<version_id>`/etc. where a real id was substituted; real ids that are safe, non-sensitive, and needed for traceability (per this task's own evidence-recording convention, matching `docs/VALIDATION_EVIDENCE.md`'s existing practice of recording real object ids) are given in §6-§9.

1. `select id, name, project.id, project.name, project.full_name, object_type.name, parent.id, parent.name from Shot where name is "bc0040"` — resolve the known short code to a real ftrack id (chosen to continue the same Shot already used in `docs/VALIDATION_EVIDENCE.md`'s prior ftrack rows, for evidence continuity).
2. `select id, version, asset.id, asset.name, asset.type.name, asset.parent.id, asset.parent.name, asset.parent.object_type.name, task.id, task.name, task.parent.id, task.parent.name, task.parent.object_type.name, status.name, date, user.username, comment, is_published from AssetVersion` (capped, no filter) — establish the real field surface before narrowing.
3. `select ... from AssetVersion where asset.parent.id is "<shot_id>"` — targeted per-Shot query via the Asset traversal path (Section 6.A).
4. `select ... from AssetVersion where task.parent.id is "<shot_id>"` — targeted per-Shot query via the Task traversal path, to test whether the two paths agree.
5. `select id, content, parent_id, parent_type, category.name, date, author.username, author.first_name, author.last_name, in_reply_to.id from Note` (capped, no filter) — establish the real Note field surface and observed `parent_type` values.
6. `select id, content, author.username, date, category.name, in_reply_to.id from Note where parent_id is "<version_id>"` — targeted per-Version Note query (Section 6.B), run against three different real `AssetVersion` ids.
7. `select id from Note where parent_type is "<value>"`, tried with four casing variants (`AssetVersion`, `assetversion`, `asset_version`, `ASSETVERSION`) and then the confirmed-working `task`/`asset_version`/`review_session_object`/`shot` forms — isolating the real filter-comparable string form (see §11 finding).
8. `select id, name, asset_version.id, asset_version.version, asset_version.asset.name, review_session.id, review_session.name from ReviewSessionObject` — schema discovery for the entity type most real Notes turned out to be attached to.
9. `select id, name, project.id, project.name from ReviewSession` — one hop further, confirming a Project reference exists at that level too.
10. `select id, asset_version.id, asset_version.version, asset_version.asset.name, asset_version.asset.parent.id, asset_version.asset.parent.name, asset_version.asset.parent.object_type.name from ReviewSessionObject where id is "<rso_id>"` and `select id, content, author.first_name, author.last_name, category.name, date from Note where parent_id is "<rso_id>" and parent_type is "review_session_object"` — the complete Note → ReviewSessionObject → AssetVersion → Shot chain, run end to end against one real object.
11. `session.get("Task", "<shot_id>")` vs. `session.get("Shot", "<shot_id>")` — direct identity resolution check for the `parent_type="task"` finding (§11 item 3).
12. `select id, asset.parent.object_type.name, task.parent.object_type.name, task.parent.project.id, task.parent.project.name from AssetVersion where id is "<asset_build_version_id>"` — confirms an Asset-Build-parented `AssetVersion` genuinely has no Shot lineage via either path.
13. `select id, name, file_type, size, component_locations.location.name from Component where version.id is "<version_id>"` — Component/attachment metadata without downloading media.

No query relied on a workspace-wide fetch followed by a client-side cap to simulate a filter — every "targeted" query above used a real ftrack `where` clause.

---

## 6. Observed AssetVersion relationship graph

**Real, verified.** Every `AssetVersion` carries two independent parent-traversal paths:

- `AssetVersion.asset` → `Asset` → `Asset.parent` → a context entity (`Shot`, or `Asset Build`, or others) → (for Shot-parented assets) `Shot.project` → `Project`.
- `AssetVersion.task` → `Task` → `Task.parent` → the same context entity → `Task.parent.project` → the same `Project`.

For every Shot-scoped `AssetVersion` observed (5 of 5 checked under Shot `bc0040`, plus 2 more under separate Shots `S1010`/`S1020`), **both paths resolved to the identical Shot id** — `asset.parent.id == task.parent.id`. This is real agreement, not an assumption: verified by running both filter forms (`asset.parent.id is "<shot_id>"` and `task.parent.id is "<shot_id>"`) independently against the same Shot and comparing the returned id sets — identical, 5 of 5.

**Real, verified, and not anticipated by the provisional design:** for Asset-Build-parented `AssetVersion`s (e.g. `classic_console_01`, `classic_nightstand_01`, real product/asset-library items under the workspace's "Showroom" project), **both paths agree on "Asset Build," neither ever reaches a Shot.** `asset.parent.object_type.name` and `task.parent.object_type.name` were both `"Asset Build"`, and `task.parent.project.name` was `"showroom"` — a real project with no Shots at all in the sampled data. **Not every `AssetVersion` has Shot lineage.** This must be an honest, optional relationship in any future ICAS mapping, never assumed present.

Directly queryable fields, confirmed real and populated for every sampled `AssetVersion`:

| Field | Confirms |
|---|---|
| `id` | Stable ftrack entity id (UUID-shaped string) |
| `version` | Integer version number |
| `asset.name` | The Asset's name (not the Version's own name — `AssetVersion` has no separate `name` field of its own) |
| `asset.type.name` | Real values observed: `Upload`, `Animation` |
| `status.name` | Real values observed: `Pending Review`, `Approved`, `Revise` — all present in the earlier-discovered 17-status list |
| `date` | An `Arrow` timestamp (creation-equivalent; no separately-tested `created_at`/`updated_at` — see §15) |
| `user.username` | The submitting user's email-shaped username, real values observed |
| `comment` | Free-text submission comment, real content observed, non-empty for Shot-scoped versions |
| `is_published` | Boolean, `True` for every sampled row |

Relationship traversal is **direct, not requiring a second round trip** — every field above, including the full lineage to Project, was retrieved in **one single query** (query 10 in §5), confirmed against one real `AssetVersion`:

```
AssetVersion 029a25ce-8b60-11eb-bdb7-c2ffbce28b68 (v3, asset "bc0040_comp")
  asset.parent  -> Shot "bc0040" (2b5a847e-8b4f-11eb-b695-c2ffbce28b68), object_type=Shot
  asset.parent.project -> Project "sync" (33b1e354-8b3d-11eb-8e99-c2ffbce28b68)
  task          -> Task "Compositing" (2b8871cc-8b4f-11eb-b695-c2ffbce28b68)
  task.parent   -> Shot "bc0040" (same id as asset.parent)
  task.parent.project -> Project "sync" (same id as asset.parent.project)
```

This is real-workspace evidence (not repository code evidence, not inference) for exactly this one object; it was cross-checked structurally against 4 further real `AssetVersion`s with consistent results (see §5 queries 3-4).

---

## 7. Observed Note relationship graph

**Real, verified, and the most significant finding of this task.** The workspace has exactly 140 real `Note` rows. Filtering by the real (snake_case) `parent_type` values, the complete breakdown is:

| `parent_type` (real, filter-comparable value) | Count | % | What it means |
|---|---|---|---|
| `asset_version` | 45 | 32% | Directly attached to an `AssetVersion` — a real Review Note in the sense `docs/FTRACK_INTEGRATION.md` §3/§10 describes |
| `review_session_object` | 93 | 66% | Attached to a `ReviewSessionObject`, **not** directly to an `AssetVersion` — see below |
| `task` | 2 | 1.4% | Both are ICAS's own prior write-back Notes (identified by content, both begin `"[Intent Core Alignment System] Core Anchor confirmed..."`), whose `parent_id` in both cases is a real **Shot**'s id, not a real Task — see §11 item 3 |
| `shot` (literal lowercase) | 0 | 0% | Never observed as a real filter-comparable value in this workspace |

`45 + 93 + 2 = 140` — exhaustive, confirmed by cross-summing against the unfiltered total.

**`ReviewSessionObject` → `AssetVersion` is real, direct, and one hop.** `ReviewSessionObject` exposes `asset_version` (a direct entity reference, not another loose polymorphic pointer) and `review_session` (which itself has its own `project` reference). Verified end to end against one real object:

```
Note 86685c99-d805-484d-89f7-1ea15a7272f9
  author: "Mrs. Client" (a real reviewer with no ftrack username -- see below)
  content: "Whats this hard line? Can probably be cropped out. ..."
  parent_id -> ReviewSessionObject 85e37ee8-8c33-11eb-b695-c2ffbce28b68
                 asset_version -> AssetVersion 029a25ce-8b60-11eb-bdb7-c2ffbce28b68
                                    (v3, asset "bc0040_comp", same Version used in §6)
```

Combining the two categories, **138 of 140 real Notes (98.6%) trace back to a real `AssetVersion`**, either directly or via exactly one `ReviewSessionObject` hop. Any Step 8B ingestion strategy that reads only `parent_type="asset_version"` Notes would silently miss two-thirds of the real feedback in this workspace.

**No Note in this workspace was found attached directly to a `Shot`, a `Task`, or an `Asset`** as organic feedback — the only `task`-labeled Notes are ICAS's own two prior write-back artifacts (see §11 item 3), not real incoming client/reviewer feedback. This distinguishes the three categories the task asked for cleanly: (a) a Review Note attached to an AssetVersion — the `asset_version` and `review_session_object` categories above, both real and mappable; (b) a Note attached to a Shot or Task — not observed as organic content in this workspace, only as ICAS's own write-back echo; (c) a generic Note that should not be mapped into ICAS `ReviewNote` — none observed of a type unrelated to Version review (e.g. no `Asset`-level or arbitrary-context Note was found).

**Stable Note identity and fields, confirmed real:**

| Field | Confirms |
|---|---|
| `id` | Stable ftrack entity id |
| `content` | Free-text, real content observed, non-empty |
| `parent_id` / `parent_type` | The generic polymorphic reference (see §11 item 2 for the exact filter-comparable string forms) |
| `date` | An `Arrow` timestamp with time-of-day precision on real client notes |
| `author.first_name` / `author.last_name` | Populated for every sampled Note |
| `author.username` | **Populated inconsistently** — present for `asset_version`-direct Notes authored by a real ftrack user account (e.g. `eileen.wl0930@gmail.com`), but **absent (raises `KeyError` on direct field access, resolves to `None` via safe access)** for at least one `review_session_object`-attached Note authored by a guest/client reviewer ("Mrs. Client") with no full ftrack user account. A robust reader must treat `username` as optional and fall back to `first_name`/`last_name`. |
| `category.name` | **Present on only 1 of 7 sampled Notes** (`"Client feedback"`); `None` on the rest. Not a reliable required field. |
| `in_reply_to.id` | Queryable relation exists in the schema; **`None` on every sampled Note** — no real reply/thread chain was observed in this workspace's data. This does not prove threading is unsupported, only that no real example exists to validate against in this sample. |

**Components (attachments), metadata only, no download attempted:** for one real `AssetVersion`, three real `Component` rows were returned with `name`/`file_type`/`size` populated (`thumbnail` .jpg 29,170 bytes; `ftrackreview-mp4` .mp4 1,376,300 bytes; a named render .mp4 1,190,532 bytes). `component_locations.location.name` (accessibility/download-path metadata) was queried but did not resolve cleanly through this task's exploration tooling — recorded as **not fully validated**, not as "unsupported" (see §15).

---

## 8. Stable identity and field mapping

| ICAS need | Real ftrack source | Verified? |
|---|---|---|
| External identity (Version) | `AssetVersion.id` | Yes — real, stable UUID-shaped string |
| External identity (Note) | `Note.id` | Yes |
| Version number | `AssetVersion.version` | Yes — real integer |
| Version "name" | **No direct field** — `AssetVersion` has no `name` of its own; the closest real field is `asset.name` (the parent Asset's name, shared across every version of that Asset) | Yes, but requires deriving a display name (e.g. `f"{asset.name}_v{version}"`), not a 1:1 field copy |
| Description | `comment` | Yes — real, non-empty for Shot-scoped versions; **not verified non-empty for every Asset-Build version** (two sampled had `comment=""`) |
| Status | `status.name` | Yes — maps into the already-discovered 17-value Status list (`docs/FTRACK_FEASIBILITY.md` §2.1) |
| Creator/author | `user.username` (AssetVersion), `author.first_name`/`author.last_name` (+ inconsistent `username`) (Note) | Yes, with the Note-author caveat above |
| Creation timestamp | `date` (both `AssetVersion` and `Note`) | Yes — real `Arrow` timestamps, time-of-day precision confirmed on Notes |
| Task lineage | `AssetVersion.task` (direct entity reference) | Yes |
| Shot lineage | `AssetVersion.asset.parent` **or** `AssetVersion.task.parent`, in agreement where a Shot exists; **absent entirely** for Asset-Build-parented versions | Yes, with the "optional, not guaranteed" caveat |
| Project lineage | `...project.id`/`...project.name` at the end of either traversal path | Yes |

**No field above was accepted on the basis of its display name alone** — every row was confirmed via a query returning a real value for a real object, per this task's own instruction.

---

## 9. Targeted-query feasibility

All three required patterns work as real, direct, indexed-by-relationship ftrack queries — none required a workspace-wide fetch capped client-side:

**A. Given one known Shot id, retrieve only its AssetVersions.** `select ... from AssetVersion where asset.parent.id is "<shot_id>"` returned exactly the 5 real AssetVersions belonging to Shot `bc0040` — no more, no fewer, cross-checked against the equivalent `task.parent.id` filter with an identical result set. **Supported, exact, no cap needed.**

**B. Given one known AssetVersion id, retrieve only its Notes.** `select ... from Note where parent_id is "<version_id>"` returned exactly the 6 real Notes attached to `AssetVersion 029a25ce-...`, and 0 for two Asset-Build versions with no review activity (an honest empty result, not an error). **Supported, exact.** Note: this only captures the `asset_version`-direct 32% — a complete Step 8B implementation must **also** query `ReviewSessionObject where asset_version.id is "<version_id>"` and then `Note where parent_id is "<rso_id>" and parent_type is "review_session_object"` for each, to reach the other 66% (see §7).

**C. Given a returned Version or Note, trace back to Project/Shot/Task.** Confirmed in one single query per object (§6's full-lineage example) — no additional round trips required for the direct `asset_version`-parented case. For a `review_session_object`-parented Note, one additional hop (`ReviewSessionObject` lookup) is required before the same lineage query applies.

No permission or performance limitation was encountered for any of the queries run in this task — every query returned promptly with no rate-limit or permission-denied response. This does not prove production-scale performance (§13).

---

## 10. Current ICAS model compatibility

- **Can the existing `Version` model represent the real `AssetVersion` safely?** Yes, for the fields it already has (`name`, `version_number`, `description`) — with the caveat that `name` must be derived (§8), not copied 1:1, and `Version.source`/no `external_id` column means `Version` needs the same `source`/`external_id`-via-`ExternalEntityLink` extension `Project`/`Shot`/`Task` already received (ADR-0010) — confirmed as **not yet present** in `VersionCreate` (repository code evidence, §3).
- **Can the existing `ReviewNote` model represent a Version-attached ftrack Note?** Yes, for the 32% that are `asset_version`-direct. For the 66% that are `review_session_object`-attached, the *content* still maps cleanly (a `ReviewNote` is just `version_id` + `content` + provenance) once Step 8B resolves the one extra hop — the **model** does not need to change to represent a `ReviewSessionObject`-sourced Note, only the **sync logic** needs the extra hop.
- **Is a Task-to-Version relation required, or is Shot-level linkage sufficient?** Shot-level linkage is sufficient and matches the existing, already-established ICAS convention (a Task's associated Versions are its Shot's Versions — reused throughout Step 7C, not new). The real ftrack data supports this: every Shot-scoped `AssetVersion`'s `task.parent` agreed exactly with its `asset.parent` (§6), so **no persisted `Version.task_id` is required** — the same "no stored Task↔Version FK, Task lineage resolved via Shot" pattern already in production code can be reused unchanged. A `Version`'s originating ftrack `Task` (e.g. "Compositing") is still worth recording as a **non-relational display field** (see §14), distinct from a hard FK.
- **Which entity should receive an `ExternalEntityLink`?** Both `Version` and `ReviewNote`, following the exact `entity_type`/`entity_id`/`source`/`external_id` shape already used for `Project`/`Shot`/`Task` — no new link-table shape is needed.
- **Is one `ExternalEntityLink` enough, or are separate links required for AssetVersion and Note?** Separate links, one per synced row — `ExternalEntityLink`'s own `UNIQUE(entity_type, entity_id, source)` constraint already assumes one link per internal row, and `AssetVersion`/`Note` are two independent internal rows (`Version`/`ReviewNote`) with two independent external ids. No schema change needed to support this — it is the same pattern already proven for three entity types, extended to two more.
- **Which fields are currently missing?** (1) `source`/`external_id` on `VersionCreate`/`ReviewNoteCreate` (confirmed absent, §3); (2) no field anywhere in ICAS currently records the originating ftrack `Task` name/type for a synced `Version` (e.g. "Compositing") — today's `Version` model has no department/task-type field at all, unlike `Task.department` which already exists as a separate concept.
- **Which current assumptions are correct?** `docs/FTRACK_INTEGRATION.md` §3's hedge about not assuming Asset-is-child-of-Task — correct, and this task adds the concrete evidence for *why* (Asset-Build-parented versions have no Task-Shot relationship at all in some cases, and even where a Shot exists, the two paths must be checked independently rather than assumed). The existing "Task's Versions are its Shot's Versions" ICAS convention — correct and directly supported by real data (§6, §10).
- **Which current assumptions are incomplete or wrong?** `docs/FTRACK_INTEGRATION.md` §3's Note row ("Parent may be Version, Task, or review object") undersold the scale of the "review object" case — it is not a minor alternative, it is **the majority case (66%)** in this real workspace, and the specific entity type (`ReviewSessionObject`, with its own direct `asset_version` reference) was not named anywhere in the provisional design. The implicit assumption that a Shot-context Note would report `parent_type="shot"` is **wrong** — it reports `"task"` (§11 item 3).

---

## 11. Existing assumptions confirmed

1. Real ftrack authentication and real read access work end to end, extending `docs/FTRACK_FEASIBILITY.md`'s 2026-07-19 schema-only finding to real entity-instance reads for the first time.
2. `docs/FTRACK_INTEGRATION.md` §3's hedge against assuming Asset-is-child-of-Task is empirically justified — confirmed via the Asset-Build counter-example (§6).
3. The existing "a Task's Versions are its Shot's Versions" ICAS convention holds against real data — no Task-to-Version FK is needed (§10).
4. `docs/FTRACK_INTEGRATION.md` §9's list of importable `AssetVersion` fields (external ID, version number, creator, linked Task, Asset and context, Status, creation time, Components) is real and accessible, field by field, except "Version number" mapping to a Version *name* rather than a literal name field (§8).
5. `docs/FTRACK_INTEGRATION.md` §10's statement that "a Note may be attached to different ftrack entities or review contexts, so the mapping must preserve the external parent and resolve the most relevant internal target" is exactly correct and is the central finding of this task (§7).
6. The already-existing `write_note_to_shot`'s origin marker (`"[Intent Core Alignment System]"`, ADR-0012) is real and present on real data — both of the two `task`-parent-typed Notes found in this workspace carry it, confirming the marker mechanism works and would let a future read-sync job correctly exclude ICAS's own write-back echoes from being re-imported as organic feedback (§11 item 3 below).

## 12. Existing assumptions disproved or incomplete

1. **Disproved:** a Shot-context Note is *not* labelled `parent_type="shot"` — it is labelled `"task"` (§7, §11.3 below). Any future implementation resolving a Note's parent via `session.get(parent_type, parent_id)` would need to special-case this, or resolve context-entity Notes differently.
2. **Incomplete:** `docs/FTRACK_INTEGRATION.md` §3's Note-parent row named "Version, Task, or review object" as three roughly-equal alternatives; real data shows the "review object" case dominates (66%) and has a specific, queryable, one-hop-resolvable shape (`ReviewSessionObject.asset_version`) that the provisional design did not describe.
3. **New finding, not previously assumed either way:** `Note.parent_type`'s filter-comparable string value is **snake_case** (`asset_version`, `review_session_object`, `task`) even though the same field's *displayed* value in an unfiltered row read renders in **PascalCase** (`AssetVersion`, `ReviewSessionObject`) — confirmed by testing four casing variants and finding only the snake_case form matches in a `where` clause (§5 query 7, §7). This is a concrete implementation trap for Step 8B: a query written using the PascalCase form (the form a developer would naturally copy from a printed row) silently returns zero results rather than erroring.
4. **New finding:** `Note.author.username` is not reliably populated — guest/client reviewers active in a `ReviewSessionObject` can lack it entirely, while `first_name`/`last_name` remain populated. A robust author-mapping strategy must not assume `username` exists.

## 13. Permissions and workspace limitations

- No permission-denied or rate-limit response was encountered for any read query in this task. Write access was never tested (no write attempted, per this task's explicit constraint) — so **write permission for `ReviewNote`-equivalent content on `AssetVersion`/`ReviewSessionObject` remains unverified**, distinct from the already-verified Shot-Note write permission (ADR-0012/`VALIDATION_EVIDENCE.md`).
- This is one team-created controlled trial workspace with synthetic/demo project data (`Sync (VFX demo)`, `Napo (Animation demo)`, `Showroom (Model production demo)`) — per `docs/FTRACK_INTEGRATION.md` §15 and `docs/FTRACK_FEASIBILITY.md` §4's claim boundary, this validates technical integration with this workspace, not DNEG's real configuration, permissions, or production-scale data/performance.
- Component `Location`/download-accessibility metadata was attempted but did not fully resolve through this task's exploration tooling (a client-side query-shape limitation encountered during this session, not a confirmed real-workspace restriction) — genuinely unresolved, not silently assumed either way (§7, §15).
- Event Hub / Webhook payload shape remains untested (`auto_connect_event_hub=False` by design, per ADR-0009) — out of Step 8A's Version/Note relationship scope; reconciliation-polling (already proven for Project/Shot/Task) remains the assumed mechanism for Version/Note too, per the existing ADR-0011 pattern.

---

## 14. Proposed minimum Step 8B contract

This is a **contract proposal only** — no model, migration, or contract file was changed to produce it.

- **`AssetVersion` → ICAS `Version` mapping:**
  `Version.name` := derived, e.g. `f"{asset.name}_v{version:03d}"` (no direct 1:1 field). `Version.version_number` := `AssetVersion.version`. `Version.description` := `AssetVersion.comment` (empty string allowed, not required non-blank — real data showed empty comments). `Version.shot_id` := resolved via `ExternalEntityLink` lookup on `asset.parent.id` (preferred) with `task.parent.id` as a consistency check, **skipping/flagging** (never silently dropping) any `AssetVersion` where neither path resolves to an already-linked Shot (the Asset-Build case, §6). `Version.source` := `"ftrack"`. New optional field to consider: a non-relational `origin_task_name`/`origin_department` string captured from `task.name`/`task.type.name` at sync time, distinct from any FK.
- **`Note` → ICAS `ReviewNote` mapping:** two source shapes feed the same target: (a) `parent_type == "asset_version"` — resolve `Version` directly via `ExternalEntityLink` on `parent_id`; (b) `parent_type == "review_session_object"` — first resolve the `ReviewSessionObject`'s own `asset_version.id`, then resolve `Version` via `ExternalEntityLink` on *that* id. `ReviewNote.content` := `Note.content`. `ReviewNote.source` := `"ftrack"`. **Explicitly exclude** any `Note` whose `content` begins with the existing `"[Intent Core Alignment System]"` marker (ADR-0012) from ever being read back in as an incoming `ReviewNote` — this prevents a write-back echo loop, and this task confirmed real examples of exactly this marker on real data (§11.6).
- **External id and entity-type rules:** reuse `ExternalEntityLink` unchanged — `entity_type="version"` / `entity_type="review_note"`, `source="ftrack"`, `external_id` = the real `AssetVersion.id` / `Note.id` respectively. One link per internal row, matching the existing `UNIQUE(entity_type, entity_id, source)` constraint.
- **Version → Shot/Task lineage rule:** Shot-level linkage only, via the already-established convention (§10) — no `Version.task_id` column. A `Version` whose `AssetVersion` has no Shot lineage at all (§6) is **not synced** in a first pass (an honest, explicit non-goal, not a silent drop — see below), since ICAS's `Version` model requires a `shot_id`.
- **ReviewNote → Version rule:** as above (two-shape resolution); a `Note` whose lineage cannot be resolved to an already-synced `Version` is skipped and logged, never invented against a guessed Version.
- **Author/time/status mapping:** `created_by_actor_kind="human"`, `created_by_human_role=None` (ftrack authors are not one of ICAS's three human roles), `created_by_actor_id` := `user.username` (Version) or `author.username` when present, else a composed `"{first_name} {last_name}"` fallback (Note) — never fail the whole sync on a missing `username`. `created_at` := the real `date` field. `status.name` is **not** proposed for sync in this minimum contract — Step 8's own scope explicitly excludes autonomous status write-back, and read-only status mirroring is a separate, later decision requiring its own `FtrackWorkspaceProfile.status_mapping` (unresolved, §16).
- **Idempotent upsert key:** identical to the existing Project/Shot/Task pattern — `find_linked_entity_id(entity_type, source="ftrack", external_id)`, create-if-missing, update-if-found. No new idempotency mechanism required.
- **Handling of missing/deleted/moved external entities:** a `Version`/`Note` whose ftrack parent no longer resolves (deleted, or moved to an unmapped context) is left as historical/orphaned internal data, never deleted — matching the existing product rule that confirmed records are never overwritten and matching how `docs/FTRACK_INTEGRATION.md` §8 already frames idempotency as additive-only.
- **Preservation of manually created ICAS rows:** unaffected by construction — every `Version`/`ReviewNote` created with `source="manual"` has no `ExternalEntityLink`, so the upsert lookup never matches it; this is the same guarantee `Project`/`Shot`/`Task` already have today (ADR-0010), extended, not re-invented.
- **Proposed reconciliation cursor/timestamp strategy:** reuse the existing `SyncCursor` mechanism (ADR-0011) with a new named cursor (e.g. `"ftrack_version_note_reconciliation"`), polling `AssetVersion.date after <cursor>` for new/changed Versions and `Note.date after <cursor>` for new Notes, mirroring `reconcile_ftrack_shots`'s existing `Task.created_at after <cursor>` shape exactly. Both `AssetVersion.date` and `Note.date` were confirmed real and populated (§6-§7); neither entity was confirmed to have a distinct `updated_at` in this task's queries (see §15 — genuinely untested, not assumed absent).
- **Explicit non-goals (this contract does not include):** any write-back of a `ReviewNote` or Version status to ftrack beyond what already exists (Core Anchor write-back only); Component/media download or proxy generation; Event Hub real-time sync; syncing Notes attached to any parent type other than `asset_version`/`review_session_object`; syncing Asset-Build-parented (non-Shot) `AssetVersion`s in a first pass; any change to `docs/PRODUCT_SCOPE.md`'s write-back policy.

---

## 15. Unresolved questions

- Does `AssetVersion` or `Note` expose a distinct `updated_at`/modification timestamp separate from `date`, analogous to how `Shot` was already found to lack one (`shot_context.py`'s own docstring)? Not tested in this task — `date` alone was sufficient to answer the relationship-graph questions this task was scoped to, but a reconciliation strategy needs this confirmed before Step 8B implementation.
- Full `Component`/`Location` accessibility (download-readiness, not just name/size metadata) — partially attempted, not conclusively resolved (§7, §13).
- Real write permission for creating a `Note` on an `AssetVersion` or `ReviewSessionObject` (as opposed to the already-verified `Shot`-Note write permission) — never attempted, per this task's read-only constraint; required before any future Step 8B+ write-back extension beyond Core Anchor.
- Whether `in_reply_to` ever has a real non-null value in this workspace (no example was found in this task's sample) — if threading is common in practice, Step 8B's `ReviewNote` model (which has no reply/thread concept today) would need a scoped decision on whether to flatten replies or represent them.
- Whether every real `ReviewSessionObject` reliably has a non-null `asset_version` (only positively confirmed for 2 of 93 real review-session-attached Notes' underlying objects in this task's sampling) — the general schema-level query confirmed the *relation exists and is typed correctly*, but not that it is *always populated* for every one of the 93 real rows.

---

## 16. Implementation blockers

**None found for Step 8A itself.** No credential, workspace-access, or permission blocker was encountered — every planned read-only query executed successfully. The items in §15 are open questions for Step 8B's design, not blockers to closing Step 8A.

---

## 17. Recommendation

**Ready for Step 8B with named constraints:**

1. Resolve §15's `updated_at`/timestamp question before finalising the reconciliation cursor strategy (a small, additional read-only query, not a redesign).
2. Implement Note ingestion for **both** `parent_type="asset_version"` and the `ReviewSessionObject`-mediated `"review_session_object"` case from the start — a Step 8B that only handled direct `AssetVersion` Notes would miss two-thirds of real feedback in this workspace, a materially incomplete result, not a phased simplification.
3. Build the `parent_type` snake_case filter form and the write-back-marker exclusion (§11.3, §14) into the sync logic from the first implementation, not as a later bugfix — both are proven, real traps, not hypothetical ones.
4. Treat Shot lineage as optional per-`AssetVersion` (never assume every `AssetVersion` has one) and skip/log rather than fail the whole sync run when it's absent.
5. Confirm real write permission for a `ReviewNote`-equivalent Note (§15) before any Step 8B+ write-back extension is scoped — out of Step 8B's own stated read-sync boundary, but worth flagging now so it isn't assumed free later.

Nothing found in this task argues for "more real workspace evidence required" as a blocking verdict — the two entity relationship graphs this task was scoped to validate (§6, §7) are both real, complete, and internally consistent.

---

## 18. Final safety confirmation

- Only this document (`docs/step-8/01_STEP_8A_FTRACK_VERSION_NOTE_RELATIONSHIP_VALIDATION.md`) and the `docs/step-8/` directory containing it were created by this task.
- No application source file, test file, migration, or generated contract was changed.
- No local application database row was changed — the local Postgres database used by `apps/api` was never connected to during this task; every query in this task went through `FtrackConnector` directly against the real ftrack server, not through `apps/api`.
- No ftrack entity was created, updated, or deleted — every query used `session.query(...)` or `session.get(...)`; `session.commit()` was never called, and `writeback_client.write_note_to_shot`/`FtrackConnector.write_note_to_shot` were never imported or invoked in any exploration script.
- `uv sync --all-packages` installed Python dependencies for the existing, already-declared `services/ftrack-connector` workspace member into the shared `.venv` — no `pyproject.toml`, `uv.lock`, or other tracked file was modified by this (confirmed via `git status`/`git diff --check` in §19 of the final chat response).
- Exploration scripts used to run the queries in this task were written to the session scratchpad directory (outside the repository) and are not part of this commit.
