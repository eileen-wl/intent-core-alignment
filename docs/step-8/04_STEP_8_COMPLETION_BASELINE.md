# Step 8 — Completion Baseline

**Status:** Closed
**Branch:** `feat/step8c89-real-ftrack-acceptance`
**HEAD at closure:** `1440685` — `feat: scope synced versions to task workspaces`
**Date:** 2026-08-02
**Companion documents:** `docs/step-8/01_STEP_8A_FTRACK_VERSION_NOTE_RELATIONSHIP_VALIDATION.md`, `02_STEP_8B_VERSION_NOTE_SYNC_CONTRACT.md`, `03_STEP_8C_REAL_FTRACK_ACCEPTANCE.md`, `docs/decisions/ADR-0014-ftrack-version-note-sync-contract.md`, `docs/IMPLEMENTATION_STATUS_AND_ROADMAP.md` §K, `docs/VALIDATION_EVIDENCE.md`'s "Step 8" section, `docs/DOMAIN_MODEL.md` §4.1, `docs/FTRACK_INTEGRATION.md` §17.

This document is the single closure record for Step 8 — it exists so a reader does not have to reassemble Step 8's status from four separate step documents plus three closeout documents. It restates conclusions already established elsewhere; it does not introduce new findings beyond what those documents already recorded.

---

## 1. Completion verdict

**Step 8 complete — real controlled-workspace ftrack Version / ReviewNote reconciliation validated.**

Real, read-only ftrack investigation locked a sync contract; that contract was implemented across the trusted internal API, the connector, the worker, and the VFX/CG/Artist frontends; and the complete pipeline was then exercised for real against the controlled trial workspace and the real local ICAS database, with the resulting real data visually confirmed by the project owner across all four page types. No step in this chain was skipped, mocked-only, or left partially implemented.

---

## 2. Repository baseline

- **Repository:** `D:\25fall everything\26summer\intent-core-alignment-recovery`
- **Branch:** `feat/step8c89-real-ftrack-acceptance`
- **Starting HEAD (Step 8C-8):** `1440685`
- **HEAD at Step 8 closure:** `1440685` (Step 8C-8 and Step 8C-9 are both documentation/acceptance tasks against real external/local systems — neither changed application source, so HEAD is unchanged across both; this closeout commit is the first commit since `1440685`)
- **Migration head:** `0024` (`0024_version_review_note_sync_metadata.py`) — the four/three new nullable columns on `Version`/`ReviewNote`.
- **Prior Step 8 commits on this lineage:** `aed58d7` (migration + models), `4f42194` (contracts), `0974d5c` (trusted sync API), `0e89178` (connector reads + worker job), `a6f5b4a`/`1ffa10e` (two reliability corrections), `1440685` (frontend Task-scoped integration).

## 3. Step 8A relationship evidence

Real, authenticated, read-only access to the controlled ftrack trial workspace (`bristol-l.ftrackapp.com`) confirmed the real `AssetVersion`/Note relationship graph: `AssetVersion.asset.parent`/`AssetVersion.task.parent` agree on the same Shot for Shot-scoped work but Asset-Build-parented versions have no Shot lineage at all; 32%/66%/1.4% of real Notes were `asset_version`-direct / `ReviewSessionObject`-mediated / ICAS's own write-back echoes respectively; `Note.parent_type` is filter-comparable only in snake_case despite rendering PascalCase. Full detail: `docs/step-8/01_STEP_8A_FTRACK_VERSION_NOTE_RELATIONSHIP_VALIDATION.md`.

## 4. Step 8B locked contract

Two material revisions to Step 8A's own proposal, both evidence-driven: (1) `Version` gains a nullable `task_id` FK after all — real data showed one Shot with `AssetVersion`s from three distinct Tasks, and the existing CG/Artist pages had zero Task filtering; (2) exhaustive re-checking found only 8 of 68 referenced `ReviewSessionObject`s still resolve (88.2% expected, permanent orphaning, not a bug). Locked: `created_at` keeps ICAS-ingestion-time meaning; `source_created_at`/`external_author_id`/`external_author_name` added as pure provenance, never wired to `human_role` or permissions; ftrack identity enters only through a new, separately-token-gated internal sync boundary, not the public create contracts; reconciliation is a complete per-linked-Shot re-sweep with no Version/Note `SyncCursor`. Full detail: `docs/step-8/02_STEP_8B_VERSION_NOTE_SYNC_CONTRACT.md`, `docs/decisions/ADR-0014-ftrack-version-note-sync-contract.md`.

## 5. Step 8C implementation delivered

| Slice | Delivered |
|---|---|
| 8C-1 | Migration `0024`; `task_id`/`source_created_at`/`external_author_id`/`external_author_name` on `Version`/`ReviewNote` ORM models |
| 8C-2 | `VersionSyncCreate`/`ReviewNoteSyncCreate`/`VersionNoteSyncItemResult` Python contracts; extended `VersionRead`/`ReviewNoteRead` with the three/four new optional fields |
| 8C-3 | `X-Internal-Sync-Token`-gated `POST /internal/sync/versions`, `POST /internal/sync/review-notes` |
| 8C-4/8C-5 | Connector read models (`read_asset_versions_for_shot`, `read_direct_notes_for_asset_version`, `read_review_session_object_notes_for_asset_version`); sync-client extension; `GET /internal/sync/linked-shots`; worker job `reconcile_ftrack_versions_and_notes` |
| Reliability x2 | Fail fast on a systemic 401/403/5xx sync error; fail closed on a missing/blank internal sync token |
| 8C-6/8C-7 | VFX stays Shot-wide; CG/Artist apply the locked Task-scoped compatibility filter; chronology uses `source_created_at ?? created_at` everywhere; external author renders as "Source author", never an ICAS Human role; Artist Feedback History's own cross-Task leak (a pre-existing, unrelated backend gap) closed frontend-only |
| 8C-8 | Real controlled-workspace acceptance run (§6 below) |
| 8C-9 | This closeout: owner visual validation recorded, documentation updated, this baseline created |

## 6. Real reconciliation results

A real Project/Shot/Task bootstrap (the pre-existing `reconcile_ftrack_shots` job, real read-only ftrack access, approved by the project owner as a necessary prerequisite once 0 Shots were found linked) linked **9 real Shots** and **9 real Tasks**.

First real `reconcile_ftrack_versions_and_notes` run:

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

Database: `Version` `2 → 34` (32 ftrack + 2 pre-existing manual, unchanged); `ReviewNote` `1 → 51` (50 ftrack + 1 pre-existing manual, unchanged).

Second, immediately repeated run: `api_created=0`, `api_already_exists=82`, all discovery counts identical, database counts unchanged, zero duplicates.

Full detail, including per-row mapping evidence: `docs/step-8/03_STEP_8C_REAL_FTRACK_ACCEPTANCE.md` §5-§9.

## 7. Idempotency and integrity evidence

- Every synced `Version`/`ReviewNote` has exactly one `ExternalEntityLink` (verified by `HAVING count != 1` queries returning zero rows, both before and after the second run).
- Zero partial domain/link rows before or after either run (four integrity checks, each returning 0).
- `task_id` resolution is real FK resolution, never name-matching: 8 of 32 ftrack Versions resolved a `task_id`; 24 correctly show `task_id=NULL` because their real ftrack Task was never itself linked in this pass — never guessed.
- `review_session_objects_unresolved=0` and `write_back_echoes_excluded=0` are both structurally expected, not merely lucky: the connector only ever discovers `ReviewSessionObject`s in the forward (already-live) direction, and the write-back-marker check is real and active but had nothing to act on in this run's specific data (verified by reading the connector source directly, not inferred from the zero count alone).
- Second-run verdict: **true no-op confirmed** — `api_created=0`, `api_already_exists=82`, no duplicate row of any kind, no mutation of any first-run value.

## 8. Owner visual validation

The project owner opened and verified all four named page types against the real synced data:

- **VFX Shot Versions** (`bc0040`): 5 real Versions across multiple real Tasks visible together, as intended for the Shot-wide page; ReviewNotes loaded; external authors shown as source provenance.
- **CG Task Version Review** (`Animation` Task, `S1020`): Version list, selected Version, and ReviewNotes loaded; metadata correct; external authors shown as "Source author", never an ICAS Human role.
- **Artist Current Version** (same Task): selected Version and ReviewNotes loaded; metadata and provenance correct.
- **Artist Feedback History** (same Task): Version/Note events loaded; no obvious duplicates; the known `ArtistFeedbackEventRead`-has-no-`external_author_name` limitation confirmed still present (System provenance shown instead — a named, unfixed frontend-contract limitation from Step 8C-6/8C-7, not a new Step 8 defect).
- **Role guarding:** direct access without the required role redirected to role selection with `returnTo`; selecting the correct role returned the user to the requested page.

**Not demonstrated, and not claimed:** exclusion of a different *resolved* Task's Version from the same Shot — the real bootstrap linked only one Task per Shot, so no real Shot has Versions resolved to two different real Task ids. This exact rule remains supported by the passing Step 8C-6/8C-7 automated test suite. Full detail: `docs/step-8/03_STEP_8C_REAL_FTRACK_ACCEPTANCE.md` §14.

## 9. Security and authority boundaries

- `INTERNAL_SYNC_TOKEN` is required, shared across `apps/api`/`services/worker`/`services/ftrack-connector` via the repo-root `.env`, and every internal sync endpoint fails closed (rejects) when it is blank — never treated as "no auth required."
- Every ftrack-synced `Version`/`ReviewNote` has `created_by_actor_kind="system"`, `created_by_actor_id="ftrack-sync"`, `created_by_human_role=NULL` — always, no exception (confirmed for all 32 Versions and all 50 ReviewNotes in the real run). `external_author_id`/`external_author_name` are pure display provenance, never read by any permission check, `require_human_role` call, or Decision/HumanGate/Anchor-confirmation path.
- `external_author_id` is always the real ftrack stable account id (`AssetVersion.user.id`/`Note.author.id`), never a username, email, or display name.
- Named, unremediated gap (unchanged from Step 8B/ADR-0014, not fixed by Step 8): the existing Project/Shot/Task public endpoints (`/projects`, `/shots`, `/tasks`) still accept `source="ftrack"` + an arbitrary `external_id` with no actor/role check — used as-is by the real Shot-linking bootstrap in Step 8C-8, per its own existing, already-accepted design.

## 10. Manual/local data preservation

The 2 manual `Version` rows and 1 manual `ReviewNote` row present before any Step 8C-8 sync activity are, after both real reconciliation runs, present with identical `id`, `name`/content-linkage, `version_number`, `source="manual"`, and `created_at` values. No sync path ever queries or writes a row lacking an `ExternalEntityLink`, so no manual row was ever a candidate for mutation — confirmed both by construction and empirically.

## 11. Known limitations and claim boundary

- Controlled/demo trial workspace (`bristol-l.ftrackapp.com`), not DNEG's production ftrack configuration, permissions, or production-scale data/performance.
- A deleted `ReviewSessionObject` referenced by a Note's `parent_id` cannot be reconstructed — a normal, expected ftrack review-session cleanup pattern (88.2% of the full workspace's referenced `ReviewSessionObject`s, per Step 8B), not a defect.
- A ftrack-side content edit made after first sync is never detected or reflected in ICAS — no real modification-timestamp field exists on either `AssetVersion` or `Note` (confirmed exhaustively in Step 8B); a synced row reflects its state at first-sync time only, permanently.
- The real Step 8C-8 dataset does not itself visually demonstrate cross-Task Version exclusion (§8 above) — that rule is automated-test-evidenced only.
- Artist Feedback History timeline events show System provenance rather than a real ftrack author's name, because `ArtistFeedbackEventRead` has no `external_author_name` field — a named, unfixed frontend-contract limitation, not new to this closeout.
- `reconcile_ftrack_shots`'s 24-hour default bootstrap lookback does not usefully bootstrap a workspace whose real Tasks are all older than 24 hours (worked around in Step 8C-8 by seeding a far-past `SyncCursor`, with the project owner's approval; not fixed in code).

## 12. Deferred work

Named as explicit non-goals throughout Step 8B/ADR-0014, unchanged by this closeout: Event Hub / Webhook real-time sync; Actions/Custom Widgets; Component/media download or proxy generation; any ftrack write-back beyond the pre-existing, separate, human-requested Core Anchor confirmation write-back; `in_reply_to`/thread representation; read-only `status.name` mirroring; any Version/ReviewNote `SyncCursor` (none exists, none is planned without a new, separate, evidence-driven decision); retrofitting the Project/Shot/Task public endpoints' authentication gap (§9 above).

## 13. Next approved activity

**Visual refinement — after Step 8, before Step 9.** This is the sequencing decision already recorded in `docs/IMPLEMENTATION_STATUS_AND_ROADMAP.md` §J.6, now active.

## 14. Final Step 8 status

**Step 8 complete — real controlled-workspace ftrack Version / ReviewNote reconciliation validated.**

- ftrack remained read-only throughout every Step 8 slice — every ftrack-facing call was `session.query(...)`/`session.get(...)`; `session.commit()` was never called against the ftrack session; no ftrack entity was created, updated, or deleted at any point in Step 8.
- Only local ICAS data was created — real `Project`/`Shot`/`Task`/`Version`/`ReviewNote` rows, all via existing, unmodified API endpoints, all additive, none overwriting or deleting any pre-existing row.
- No `Version`/`ReviewNote` `SyncCursor` exists — confirmed both by design (ADR-0014 Decision 4) and by direct inspection of `reconcile_ftrack_versions_and_notes`'s source.
- No autonomous Agent or connector write-back was introduced — the only ftrack write-back capability anywhere in the system remains the pre-existing, separate, human-requested Core Anchor confirmation write-back; Step 8 added none.
- Visual refinement is next.
- **Step 9 has not started.**
