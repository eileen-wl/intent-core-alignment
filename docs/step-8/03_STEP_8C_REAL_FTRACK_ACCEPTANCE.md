# Step 8C-8 — Real ftrack Version/ReviewNote Reconciliation Acceptance

**Status: Acceptance complete — automated, database, and owner visual validation all passed.**

**Nature of this document:** a real-workspace, real-local-database acceptance report. `apps/api`, `services/worker`, `services/ftrack-connector` were exercised live against the real controlled ftrack trial workspace and the real local Postgres database. Real `Version`/`ReviewNote` rows (and, as a documented prerequisite, real `Project`/`Shot`/`Task` rows) were written to the local ICAS database through the existing, unmodified sync pathways. **No ftrack entity was created, updated, or deleted** — every ftrack-facing call in this task was `session.query(...)`/`session.get(...)` through the existing `FtrackConnector`; `session.commit()` and every write-capable connector method (`write_note_to_shot`) were never called. No application source file, migration, contract, or test was changed by this task.

---

## 1. Repository/runtime baseline

- **Repository:** `D:\25fall everything\26summer\intent-core-alignment-recovery`
- **Branch:** `feat/step8c89-real-ftrack-acceptance`
- **Starting HEAD:** `1440685` (`feat: scope synced versions to task workspaces`)
- **Working tree at start:** clean (`git status --porcelain` empty).
- **Alembic:** local Postgres database confirmed at `0024` (head) via `alembic current` / `alembic heads` — both report `0024 (head)`. No migration was run by this task.
- **Local service state at task start:** `infra-postgres-1` and `infra-redis-1` (Docker containers from `infra/docker-compose.yml`) already running and healthy (`pg_isready`/`redis-cli ping` both healthy). No `apps/api`, `worker`, or `web` process was running.
- **Real ftrack read access:** confirmed via `FtrackConnector.connect()` against the real controlled trial workspace (`bristol-l.ftrackapp.com`, same workspace as Step 8A/8B) — succeeded, credentials present (lengths checked, values never printed).
- **Linked ftrack Shot count at task start: 0.** Verified two independent ways: (1) the real `GET /internal/sync/linked-shots` endpoint, called with the configured token, returned an empty list; (2) a direct read-only query of `external_entity_links` showed only `source="demo"` rows (`project`×1, `shot`×2, `task`×3) — zero `source="ftrack"` rows of any entity type. This is a real, verified starting condition, not an assumption — see §2 for what this required before Section 5 of the task could proceed at all.

## 2. Controlled workspace and claim boundary

Same controlled trial workspace as Step 8A/8B (`bristol-l.ftrackapp.com`), containing synthetic/demo project data (`sync`, `napo`, `showroom` per Step 8A §13). This acceptance run validates real technical integration with this workspace — not a production ftrack configuration, permissions model, or production-scale data/performance (unchanged claim boundary from Step 8A/8B).

**A real, necessary deviation from the task's assumed starting state, resolved with explicit user approval before proceeding:** the task's own required reading list and Section 3 preflight checklist assumed at least one Shot would already be linked (referencing "the internal linked-shots endpoint" as something to "confirm succeeds," implying non-empty data). Real inspection (§1) showed 0 linked Shots — this local database instance had never had a real Project/Shot/Task reconciliation run against it; Step 8A's own final safety section confirms its real-workspace queries went directly through `FtrackConnector`, never through `apps/api`, and so never touched this local database.

Two approval checkpoints were used, in order, both answered by the user before any further write occurred:

1. **Whether to run `reconcile_ftrack_shots` first** (a pre-existing, already-implemented, already-tested job from an earlier step, not part of this task's own required-reading list) to establish a real linked Shot as a prerequisite. **Approved.** Run for real (`await reconcile_ftrack_shots({})`, exactly as the repository's own tests invoke it) — completed without error but linked **zero** Shots, because with no prior `SyncCursor` row it defaults to a 24-hour bootstrap lookback window on `Task.created_at`, and every real Task in this workspace is several years old (Step 8A's own UUID-based evidence). A real, working-as-designed limitation of that job's bootstrap behavior against this specific historical real workspace, not a code defect.
2. **How to actually obtain a real linked Shot given that finding.** **Approved: seed a far-past `SyncCursor`.** `PUT /integrations/sync-cursor/ftrack_shot_reconciliation` with `last_synced_at="2000-01-01T00:00:00Z"` (the existing, unmodified cursor endpoint — this only supplies input state a pre-existing code path was already designed to consume, not a new mechanism), then re-ran `reconcile_ftrack_shots({})` unmodified. This linked **9 real Shots** with 9 real Tasks (one Task per Shot, matching that job's own documented "first new Task per Shot" shape) across the workspace's `sync`/`napo` projects, including `bc0040` — continuing the same Shot Step 8A/8B used for evidentiary continuity.

No ftrack entity was written by either step above — both calls are real-`session.query`-only reads against ftrack, writing only to the local Postgres database via `apps/api`'s existing public `/projects`/`/shots`/`/tasks` endpoints (the same pathway `reconcile_ftrack_shots` always uses; distinct from the Version/ReviewNote trusted internal sync API this task's own write scope names). This consumed real read-only ftrack queries and real local writes, but no code, contract, or migration change.

## 3. Token/configuration safety

- `INTERNAL_SYNC_TOKEN` was **absent entirely** from the root `.env` at task start (confirmed via key-presence check, never by reading the file's secret content). A new value was generated with Python's `secrets.token_urlsafe(32)` and appended to `.env` in a single script execution; **the value was never printed, echoed, logged, or otherwise reproduced** at any point in this task, including in this report.
- Verified only presence/length/shared resolution, never the value: `apps/api`, `services/worker`, and `services/ftrack-connector` each independently load `Settings` from the same absolute repo-root `.env` path (`pydantic_settings`, `env_file=_REPO_ROOT / ".env"`) and each reported `internal_sync_token` configured, length **43** (all three identical) — confirming shared resolution across all three services without exposing the secret.
- `.env.example` was **not** modified. No existing ftrack credential (`FTRACK_SERVER`/`FTRACK_API_USER`/`FTRACK_API_KEY`) was touched.
- `apps/api` was started fresh after the token was written, so it read the new value on process start; `services/worker`/`services/ftrack-connector` were invoked as direct Python function calls (see §5), which load `Settings` fresh on each invocation — no stale-process reload concern for either.
- A real, incidental finding while inspecting `.env`, **not fixed** (out of this task's scope): `REDIS_URL` is present in `.env` but blank, which would break `arq.connections.RedisSettings.from_dsn(...)` if the worker were launched via `uv run arq intent_core_worker.worker_settings.WorkerSettings`. This did not block this task — see §5 for why.

## 4. Pre-sync database baseline

Recorded before the first Version/ReviewNote reconciliation run (after the Shot-linking prerequisite in §2, before any Version/Note sync):

| Metric | Value |
|---|---|
| Total `Version` count | 2 |
| Total `ReviewNote` count | 1 |
| `Version` by source | `manual`: 2 |
| `ReviewNote` by source | `manual`: 1 |
| `ExternalEntityLink(entity_type="version", source="ftrack")` | 0 |
| `ExternalEntityLink(entity_type="review_note", source="ftrack")` | 0 |
| ftrack `Version` rows missing their `ExternalEntityLink` | 0 |
| ftrack `ReviewNote` rows missing their `ExternalEntityLink` | 0 |
| `Version`/`ReviewNote` `ExternalEntityLink` rows pointing at a missing row | 0 |

**No partial rows existed at baseline** — all four integrity checks returned 0, so this was not a blocker.

Manual rows recorded for later unchanged-comparison (ids, names, `created_at` — no Note content beyond a short prefix already used in prior steps' own evidence convention):

- `Version` `99727ff4-ddf1-4142-b330-db26548e8d96` — `D1_STEP3_VFX_REVIEW_001`, v1, `manual`, `created_at=2026-08-01T19:43:37.717268Z`
- `Version` `d1b7f3a3-9e9d-42bb-90e6-07585769969a` — `DEV_SEED_UNINIT_001`, v1, `manual`, `created_at=2026-08-01T19:43:38.093431Z`
- `ReviewNote` `b503af5e-8ae2-4a5e-a865-7101ff64e12f` — on the first Version above, `manual`, `created_at=2026-08-01T19:43:37.735460Z`

## 5. First real reconciliation result

Executed `await reconcile_ftrack_versions_and_notes({})` directly — the exact invocation shape the repository's own `services/worker/tests/test_reconcile_versions_and_notes.py` already uses for every one of its cases, not a new launch method. Real read-only ftrack access, the local `apps/api` (already running, real token configured), and the local Postgres database; no mocked session or mocked HTTP anywhere in the call chain. Redis was not required for this specific invocation — `reconcile_ftrack_versions_and_notes`'s own body never touches `redis_url`; Redis is only needed by `arq`'s job-queue wrapper around it, which this direct-call invocation bypasses (same pattern the repository's own tests use, for the same reason).

```json
{
  "linked_shots_examined": 9,
  "asset_versions_discovered": 32,
  "asset_versions_skipped": 0,
  "direct_notes_discovered": 40,
  "review_session_object_notes_discovered": 10,
  "review_session_objects_unresolved": 0,
  "write_back_echoes_excluded": 0,
  "api_created": 82,
  "api_already_exists": 0,
  "api_skipped": 0,
  "api_conflicts_or_failures": 0
}
```

No systemic authentication/API error occurred (no 401/403/5xx from any sync call, which would have propagated uncaught per `_is_systemic_sync_error` and failed the run rather than being reported as a misleading success). `82 = 32 Versions + 50 Notes` (`40` direct + `10` ReviewSessionObject-mediated), matching `api_created` exactly — every discovered item was created, none skipped or conflicted.

## 6. Version mapping evidence

Post-run integrity, verified by direct read-only SQL against the real local database:

- **Total `Version` count: 34** (`32 ftrack + 2 manual` — the 2 manual rows are the same rows recorded in §4, byte-identical: same ids, names, `version_number`, `created_at`).
- **Every ftrack `Version` has exactly one `ExternalEntityLink(entity_type="version", source="ftrack")`** — a `GROUP BY`/`HAVING count != 1` query across all 32 returned zero rows.
- **`shot_id` resolves correctly:** spot-checked for `bc0040` — 5 real Versions (`bc0040_roto_v001`, `bc0040_layout_v001`, `bc0040_layout_v002`, `bc0040_comp_v002`, `bc0040_comp_v003`), each joined through its own `ExternalEntityLink` back to the local Shot row named `bc0040` — confirmed for 3 of the 5 individually, matches for all by construction (the sweep is scoped per-Shot from the start).
- **`task_id` resolution is real, not name-matched, and correctly `None` when the Task itself isn't separately linked:** `8` of `32` ftrack Versions have a non-null `task_id`; `24` have `task_id IS NULL`. Concretely: `bc0040`'s Task-linking prerequisite (§2) happened to link its `Tracking` Task, which has zero real Versions among the 5 — so all 5 of `bc0040`'s synced Versions correctly show `task_id=NULL` (the Task each Version's real `AssetVersion.task` field actually points to — Rotoscoping/Layout/Compositing — was never itself linked as a local `Task` row in this pass, so the FK correctly cannot resolve; it is never guessed or name-matched). Conversely, `S1020`'s linked `Animation` Task has 3 real Versions (`Animation_v001/002/003`) that all correctly resolved `task_id` to that Task's real local id, while `S1020`'s 4th real Version (`Compositing_v001`, whose real Task was never linked) correctly shows `task_id=NULL`.
- **`source_created_at` populated for all 32** (0 nulls); **`created_at` is the real ICAS-ingestion timestamp** (task-run time), independently confirmed different from `source_created_at` on the same row (e.g. `bc0040_comp_v003`: `source_created_at=2026-05-11T00:00:00Z`, `created_at=2026-08-02T09:48:57.525591Z` — this workspace's real `AssetVersion.date` values are set within a fictional in-story 2026 production timeline distinct from ftrack's actual multi-year-old entity-creation history, itself a real, non-obvious finding: `AssetVersion.date`/`Note.date` and `Task.created_at` are two structurally different real fields with materially different real values in this workspace).
- **`external_author_id` populated for all 32/32 ftrack Versions** — consistent with Step 8B's exhaustive 99/99 real-workspace finding that `AssetVersion.user.id` is reliably present.
- **`created_by_actor_kind="system"` / `created_by_actor_id="ftrack-sync"` / `created_by_human_role=NULL` for all 32/32** — no exception, exactly per the locked contract.

## 7. ReviewNote mapping evidence

- **Total `ReviewNote` count: 51** (`50 ftrack + 1 manual`, the manual row byte-identical to its §4 baseline value).
- **Every ftrack `ReviewNote` has exactly one `ExternalEntityLink(entity_type="review_note", source="ftrack")`** — same `HAVING count != 1` check, zero rows.
- **`version_id` resolves through the linked ftrack AssetVersion** for both source shapes: 40 direct (`parent_type="asset_version"`) + 10 ReviewSessionObject-mediated (`parent_type="review_session_object"`, one hop) — spot-checked for `bc0040`'s 5 Versions (9 real Notes across them, sample confirmed each `version_id` resolves to the correct local Version row).
- **`source_created_at` populated for all 50** (0 nulls); **`external_author_id` populated for all 50/50** in this synced subset — real evidence, not the Step 8B workspace-wide figure (which found `author` entirely absent on 60/93 *review_session_object*-parented Notes workspace-wide): this run's particular 10 ReviewSessionObject-mediated Notes all happened to have a populated `author` relation. Both figures are real and not in tension — they describe different, only partially-overlapping populations (this run's 32-Version/9-Shot subset vs. Step 8B's full 140-Note workspace sample).
- **`created_by_actor_kind="system"` / `created_by_actor_id="ftrack-sync"` / `created_by_human_role=NULL` for all 50/50.**

## 8. Orphan/write-back exclusion evidence

- **`review_session_objects_unresolved: 0`** — and this is the structurally expected outcome, not a lucky sample. Reading `services/ftrack-connector/src/intent_core_connector/version_note_context.py` directly: `read_review_session_object_notes_for_asset_version` discovers ReviewSessionObjects only in the *forward* direction (`ReviewSessionObject where asset_version.id is "<version_id>"`) — it structurally can never encounter Step 8B's measured 60/68-orphaned-`ReviewSessionObject` problem, because that measurement came from the *reverse* direction (an already-orphaned Note's `parent_id`, resolved backward), which this connector code deliberately never attempts (per its own docstring and this task's own instruction not to attempt that recovery). `review_session_objects_unresolved` here tracks a narrower, different failure mode: a *forward-discovered, provably live* ReviewSessionObject whose own Note sub-query then fails for an unrelated reason (permissions, transient error) — none occurred in this real run.
- **`write_back_echoes_excluded: 0`** — also structurally expected, verified by reading the exclusion check itself (`content.startswith(WRITE_BACK_MARKER)`, present and active in both `read_direct_notes_for_asset_version` and `read_review_session_object_notes_for_asset_version`). Step 8A found exactly 2 real write-back-marker Notes in the entire workspace, both attached via `parent_type="task"` — a parent type this sync path never reads at all (only `asset_version`/`review_session_object` are queried). The 0 count means the exclusion logic had no real occurrence to act on in this run's data, not that it was untested — the check itself is real, present, and unconditionally evaluated on every Note this run did examine.
- **No `AssetVersion` from an Asset-Build/no-Shot context was imported** — structurally guaranteed both by `read_asset_versions_for_shot`'s own query (`asset.parent.id is "<shot_external_id>"`, always a real, already-linked Shot) and by `reconcile_ftrack_shots`'s own Shot-only filter (`parent.object_type.name == "Shot"`) that governs which Shots could ever be linked in the first place (§2). `asset_versions_skipped: 0` in this run confirms no shot-lineage-disagreement warning fired either.
- **No manual Version or ReviewNote was mutated** — confirmed twice (post-first-run in §6/§7, and again post-second-run in §9) by exact-value comparison against the §4 baseline.
- **No partial domain-row/link pair exists** — the same four integrity queries from §4, re-run post-sync, all returned 0 (see §6/§7's "exactly one link" findings, which subsume this).
- **No `Version`/`ReviewNote` `SyncCursor` exists** — confirmed by inspecting `reconcile_ftrack_versions_and_notes`'s source directly: it never reads or writes any `SyncCursor` key. The only `SyncCursor` row touched anywhere in this task is the pre-existing `ftrack_shot_reconciliation` key (§2), which governs Project/Shot/Task reconciliation only, per its own established, unrelated contract (ADR-0011) — untouched by ADR-0014's Version/Note design, exactly as locked.

## 9. Second-run idempotency result

Ran `await reconcile_ftrack_versions_and_notes({})` again, immediately after, with no intentional source-data change:

```json
{
  "linked_shots_examined": 9,
  "asset_versions_discovered": 32,
  "asset_versions_skipped": 0,
  "direct_notes_discovered": 40,
  "review_session_object_notes_discovered": 10,
  "review_session_objects_unresolved": 0,
  "write_back_echoes_excluded": 0,
  "api_created": 0,
  "api_already_exists": 82,
  "api_skipped": 0,
  "api_conflicts_or_failures": 0
}
```

| | First run | Second run |
|---|---|---|
| `linked_shots_examined` | 9 | 9 |
| `asset_versions_discovered` | 32 | 32 |
| `direct_notes_discovered` | 40 | 40 |
| `review_session_object_notes_discovered` | 10 | 10 |
| `api_created` | 82 | **0** |
| `api_already_exists` | 0 | **82** |
| `api_conflicts_or_failures` | 0 | 0 |

Discovery counts (what real ftrack has) are identical, as expected for a complete per-Shot sweep with no intervening real change. Outcome counts flip exactly as the locked no-op-on-repeat contract predicts.

Database verification, before vs. after the second run:

| Metric | Before 2nd run | After 2nd run |
|---|---|---|
| Total `Version` count | 34 | 34 |
| Total `ReviewNote` count | 51 | 51 |
| `ExternalEntityLink(source="ftrack")` total (all entity types) | 102 | 102 |

- **No duplicate `Version`, `ReviewNote`, or `ExternalEntityLink`** — a `GROUP BY (entity_type, external_id) HAVING count(*) > 1` query across all ftrack links returned zero rows.
- **Existing synced row values remain unchanged** — spot-checked `bc0040_comp_v003` in full (name, version_number, description, source_created_at, external_author_id, external_author_name, created_at) after the second run; all fields consistent with a row that was never re-written.
- **Manual rows remain exactly as recorded in §4** — same 2 Versions/1 ReviewNote, same ids and values, reconfirmed after the second run.

**Idempotency verdict: confirmed.** No duplicate rows, no mutation of first-run data, `api_created=0`/`api_already_exists=82` on repeat, matching the contract's "true no-op on repeat sync" design exactly.

## 10. Manual/local-row preservation

The 2 manual `Version` rows and 1 manual `ReviewNote` row present at task start (§4) are, after both reconciliation runs, present with **identical** `id`, `name`/`content`-linkage, `version_number`, `source="manual"`, and `created_at` values. No sync path ever queries or writes a row lacking an `ExternalEntityLink`, so no manual row was ever a candidate for mutation by construction — confirmed empirically, not only by design reasoning.

## 11. No-partial-row integrity check

Re-run after both reconciliation passes (identical to the §4 baseline queries):

| Check | Result |
|---|---|
| ftrack `Version` rows missing their `ExternalEntityLink` | 0 |
| ftrack `ReviewNote` rows missing their `ExternalEntityLink` | 0 |
| `Version` `ExternalEntityLink` rows pointing at a missing `Version` | 0 |
| `ReviewNote` `ExternalEntityLink` rows pointing at a missing `ReviewNote` | 0 |
| ftrack `Version`/`ReviewNote` rows with `!= 1` link (0 or ≥2) | 0 / 0 |

**No blocker.** Every ftrack-sourced row has exactly one link, and every link resolves to an existing row.

## 12. No-ftrack-mutation confirmation

Every ftrack-facing call made in this task, across §2 (Shot-linking prerequisite) and §5-§9 (Version/Note reconciliation), went through `FtrackConnector`'s existing read methods only: `connect()`, `close()`, `read_shot_contexts_with_new_tasks(...)` (used internally by `reconcile_ftrack_shots`), `read_asset_versions_for_shot(...)`, `read_direct_notes_for_asset_version(...)`, `read_review_session_object_notes_for_asset_version(...)` (used internally by `reconcile_ftrack_versions_and_notes`) — every one of these is, at its core, `session.query(...)`. `session.commit()` was never called against the ftrack session at any point. `FtrackConnector.write_note_to_shot` / `writeback_client.write_note_to_shot` were never imported or invoked anywhere in this task. All local-database writes went through `apps/api`'s existing HTTP endpoints (`/projects`, `/shots`, `/tasks`, `/internal/sync/versions`, `/internal/sync/review-notes`), never a direct database write from the worker or connector (ADR-0008, unchanged).

## 13. Page-validation URLs and expected results

Local services: `apps/api` on `http://localhost:8000`, `apps/web` (dev) on `http://localhost:3000`. Entry point is `http://localhost:3000/demo` (role selection) per the existing product convention — deep-linking directly to a role-scoped URL without first selecting a role via `/demo` may redirect back to role selection, since role identity is resolved via a Server Action / cookie, not the URL alone.

**Primary targets** (real, from this run's actual synced data):

| Role page | Exact URL | Real object |
|---|---|---|
| VFX Shot Versions | `http://localhost:3000/vfx/shots/d79f904f-89ce-429f-8e82-eea9f5bca638/versions` | Shot `bc0040` (project `sync`) — 5 real Versions across 3 real ftrack Tasks (Rotoscoping, Layout, Compositing), none locally Task-linked in this pass |
| VFX Shot Versions (2nd example) | `http://localhost:3000/vfx/shots/8a878495-608b-401f-8609-2a15334da415/versions` | Shot `S1020` (project `napo`) — 4 real Versions, 3 Task-linked (`Animation`) + 1 not (`Compositing_v001`) |
| CG Task Version Review | `http://localhost:3000/cg/tasks/f1451fda-80be-4820-8d9f-172d71df668f/version-review` | Task `Animation` under Shot `S1020` |
| Artist Task Current Version | `http://localhost:3000/artist/tasks/f1451fda-80be-4820-8d9f-172d71df668f/current-version` | Same `Animation` Task |
| Artist Feedback History | `http://localhost:3000/artist/tasks/f1451fda-80be-4820-8d9f-172d71df668f/feedback-history` | Same `Animation` Task |

**Expected-result checklist:**

**VFX** (`bc0040` and `S1020` URLs above):
- [ ] All of the Shot's real Versions appear regardless of which real ftrack Task each belongs to (5 for `bc0040`; 4 for `S1020`).
- [ ] `FtrackLinkageBadge`/source indicator shows `ftrack` for every synced row (never confused with the 2 pre-existing `manual` rows, which belong to different, unrelated Shots and won't appear here).

**CG** (`Animation` Task under `S1020`):
- [ ] The 3 real, Task-linked Versions (`Animation_v001/002/003`) appear.
- [ ] `Compositing_v001` (real, but `task_id` unresolved in this pass — the task-scoped-null-compatibility case) may also remain visible, per the locked compatibility rule.
- [ ] No Version from a *different resolved* real Task appears. **Named limitation on this specific real dataset:** because `reconcile_ftrack_shots` only ever links one Task per Shot per run (§2), no Shot in this run has Versions resolved to two *different* real Task ids simultaneously — so this specific real pass cannot demonstrate the "excluded because linked to a different real Task" case end-to-end. That exact filter behavior is already directly, automatically verified by the Step 8C-6/8C-7 Vitest suite (`filterVersionsForTask`/`isVersionInTaskScope` unit and data-loader tests, all passing) — this real run provides complementary real-integration evidence for the rest of the pipeline, not a substitute for that existing proof.

**Artist** (`Animation` Task under `S1020`):
- [ ] Current Version page shows the same Task-scoped Version set as CG's page for this Task.
- [ ] Feedback History does not show events tied to a Version outside this Task's scope.

**Chronology/provenance** (any of the above pages):
- [ ] ftrack-sourced Versions/ReviewNotes order by `source_created_at` (e.g. `bc0040`'s Versions span `2026-05-09` to `2026-05-11` by `source_created_at`, materially different from their shared `created_at` ingestion timestamp of `2026-08-02`).
- [ ] Where a page already shows author/creator info, an ftrack `external_author_name` (e.g. a real email-shaped username from this workspace) renders labeled as source provenance ("Source author: …"), never as "VFX Supervisor"/"CG Supervisor"/"Artist".
- [ ] The one pre-existing manual `ReviewNote`/`Version` (on an unrelated Shot, not among the URLs above) still renders with its original Human-role author display, unaffected by this sync.

## 14. Owner visual validation — complete

The owner manually opened and verified the four real-data pages named in §13's primary target list (`bc0040`'s VFX Versions page was the VFX example actually opened; the `S1020`/`Animation` Task was used for CG, Artist Current Version, and Artist Feedback History). This is real, human-observed evidence, distinct from the automated/database evidence in §4-§12 above — recorded here as what the owner reported observing, not re-derived from the database.

**VFX Shot Versions** (`http://localhost:3000/vfx/shots/d79f904f-89ce-429f-8e82-eea9f5bca638/versions`, Shot `bc0040`):
- Page opened successfully.
- Five real Versions were visible for the Shot.
- Versions from multiple production contexts (multiple real ftrack Tasks — Rotoscoping/Layout/Compositing) were visible together, as intended for the Shot-wide page.
- ReviewNotes loaded.
- External authors displayed as source provenance.

**CG Task Version Review** (`http://localhost:3000/cg/tasks/f1451fda-80be-4820-8d9f-172d71df668f/version-review`, Task `Animation` under `S1020`):
- Page opened successfully for the Animation Task.
- Version list, selected Version, and ReviewNotes loaded.
- Task/Shot/source metadata displayed correctly.
- External authors displayed as "Source author", never as an ICAS Human role.

**Artist Current Version** (`http://localhost:3000/artist/tasks/f1451fda-80be-4820-8d9f-172d71df668f/current-version`, same `Animation` Task):
- Page opened successfully.
- The selected Version and its ReviewNotes loaded.
- Task/Shot/source metadata displayed correctly.
- External author provenance displayed correctly.

**Artist Feedback History** (`http://localhost:3000/artist/tasks/f1451fda-80be-4820-8d9f-172d71df668f/feedback-history`, same `Animation` Task):
- Page opened successfully.
- Production Version and Review Note events loaded in the timeline.
- No obvious duplicate records were observed.
- **Known limitation, unchanged, confirmed still present:** `ArtistFeedbackEventRead` does not expose `external_author_name`, so these timeline events display System provenance rather than the real ftrack author's name — this is the same, already-named frontend-contract limitation from Step 8C-6/8C-7 (fixing it would require a backend contract change, out of that step's and this step's scope).

**Role guarding, exercised successfully:**
- Direct access to a role-scoped route without holding that role redirected to the role-selection page with a `returnTo` parameter.
- Selecting the correct role returned the user to the originally requested page.

**Not visually demonstrated, and not claimed here:** exclusion of a different *resolved* Task's Version from the same Shot. As already named in §13/§15, the real bootstrap in §2 linked only one Task per Shot, so no real Shot in this dataset has Versions resolved to two different real Task ids — that specific rule remains supported by the completed, passing Step 8C-6/8C-7 automated test suite, not by this visual pass.

No screenshot, Note content, credential, or token value is included in this record.

## 15. Blockers and limitations

- **Real, resolved blocker (not a defect):** 0 Shots were linked to ftrack at task start, which would have made Version/Note reconciliation a no-op. Resolved with explicit user approval via the two-step Shot-linking prerequisite in §2 (running the existing `reconcile_ftrack_shots` job, then seeding a far-past `SyncCursor` so its bootstrap window covered this workspace's real, multi-year-old Task history). No code was changed to resolve this.
- **Real, named limitation (not fixed):** `reconcile_ftrack_shots`'s 24-hour default bootstrap lookback (no prior cursor) does not usefully bootstrap a workspace whose real Tasks are all older than 24 hours — worth a future, separate decision (e.g., a longer or configurable default bootstrap window) if this reconciliation path is exercised again from a genuinely empty cursor state. Out of this task's scope to change.
- **Real, named limitation (§13):** this specific real run cannot demonstrate the "Version linked to a *different resolved* real Task under the same Shot is excluded" case end-to-end via the browser, because `reconcile_ftrack_shots` only linked one Task per Shot in this pass. That exact behavior is already covered by the existing, passing Step 8C-6/8C-7 Vitest suite.
- **Real, incidental environment fix (not an application defect):** the already-running `apps/web` dev server (from a prior, unrelated session task) returned HTTP 500 on `/demo` due to a stale `.next` build-artifact mismatch (a `next build` production build had been run over the same `.next` directory a `next dev` process was still serving from). Resolved by killing the stale process and restarting `npx next dev` cleanly from `apps/web` — the exact documented local command (`apps/web/README.md`), not a new launch method. Both `/demo` and `/vfx/shots` returned real (307 redirect) responses afterward.
- **Named, unchanged from Step 8B (§8/§16):** the existing Project/Shot/Task public endpoints (`/projects`, `/shots`, `/tasks`) still accept `source="ftrack"` + an arbitrary `external_id` with no actor/role check — used as-is by `reconcile_ftrack_shots` in §2, per its own existing, already-accepted design. Not remediated by this task, consistent with ADR-0014's explicit deferral.

## 16. Readiness for Step 8C closeout

**Ready.** Automated evidence (§4-§12) and owner visual validation (§14) are both now complete. Step 8/Step 8C closeout documentation (`docs/VALIDATION_EVIDENCE.md`, `docs/DOMAIN_MODEL.md`, `docs/FTRACK_INTEGRATION.md`, `docs/IMPLEMENTATION_STATUS_AND_ROADMAP.md`, `docs/step-8/04_STEP_8_COMPLETION_BASELINE.md`) is updated in Step 8C-9, not in this document.
