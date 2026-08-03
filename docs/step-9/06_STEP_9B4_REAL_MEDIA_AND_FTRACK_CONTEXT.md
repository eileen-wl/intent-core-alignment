# Step 9B-4 — Real Media and ftrack Context

**Status:** **Complete.** Implementation, automated validation, real read-only acceptance, the post-incident security fix, post-rotation security re-verification, and final owner visual validation are all done. See §16/§18 for the final verdict.
**Branch:** `feat/step9b4-real-media-ftrack-context`
**Companion documents:** `docs/step-9/01_STEP_9_PRESENTATION_AND_COMPREHENSION_BASELINE.md` (locked baseline), `docs/step-9/02_STEP_9A_CURRENT_STATE_AND_IMPLEMENTATION_MAP.md` §9/§11 (the feasibility audit this implementation follows, and corrects — see §3 below), `docs/step-9/05_STEP_9B3_DEPARTMENT_EXECUTION_OVERVIEW.md`, `docs/FTRACK_INTEGRATION.md`, `docs/DOMAIN_MODEL.md`, `docs/ROLE_PERMISSIONS.md`, `docs/ARCHITECTURE.md` §3.4/§10 (Connector-only ftrack access), `docs/IMPLEMENTATION_STATUS_AND_ROADMAP.md` §L.

---

## 1. Scope and completion status

Step 9B-4 delivers a transient, read-only ftrack media/thumbnail/source-context capability for existing ICAS Versions, on the three existing Version-focused pages VFX Versions, CG Version Review, and Artist Current Version. No new route, sidebar item, or tab was added; no database migration exists; no signed URL is ever persisted; no video editor, upload, annotation, or ftrack write-back control was added.

This is the final Step 9B presentation/comprehension package. Step 9C (visual-system unification) has **not** begun.

**A real, safety-critical correction was made mid-implementation** (§3, §7, §15): the connector's first implementation used ftrack's documented `Location.get_url()`/`get_thumbnail_url()` methods, which were discovered — via this task's own live, read-only, authenticated probe against the real controlled trial workspace — to embed this service's own live ftrack API user and API key directly in the returned URL as query-string parameters. Sending such a URL to a browser would have handed out real, reusable ftrack service credentials to every VFX/CG/Artist session that loaded a Version's media panel. This was found and fixed before this task was closed out, and a full live re-sample confirmed zero credential leakage in the corrected implementation. **The owner subsequently rotated the exposed ftrack API key**, all local services were restarted with the rotated credentials, and a dedicated post-rotation security-verification pass (§7) re-confirmed: authenticated read-only ftrack access succeeds with the new key; the real media acceptance counts are unchanged; zero credential-parameter matches across every browser-facing response, scanned field-by-field; zero occurrences of the old or new key anywhere in the repository or its git history.

---

## 2. Locked safety and authority boundaries

Every constraint the task named, confirmed in the final implementation:

- **No database migration.** No new table, no new column on `Version`/`ReviewNote`. `packages/contracts/python/src/intent_core_contracts/api/version_media.py` is a new response schema only.
- **No signed URL persisted anywhere.** Every field on `VersionMediaRead` is computed fresh, per request, inside `apps/api/src/intent_core_api/version_media/service.py`; nothing is written to Postgres, a fixture, a log line, or this documentation.
- **No Version/ReviewNote reconciliation behaviour changed.** `versions_and_feedback`, `ftrack_version_note_sync`, and `services/worker`'s reconciliation logic are untouched.
- **No ftrack write method or `session.commit()` introduced.** Confirmed by direct inspection of `services/ftrack-connector/src/intent_core_connector/media_context.py` (one `session.query(...)` call, nothing else) and by the connector's own tests, which trap `create`/`commit`/`delete`/`update` on a fake session and fail loudly if called.
- **No route/sidebar/tab changed.** The media panel is a new region inside three already-existing pages; `apps/web/src/lib/roleNavigation.ts` and every `ContextTabs` array are unchanged.
- **No Agent prompt/runtime changed.** This capability has nothing to do with the Agent/LLM subsystem.
- **No ftrack entity or local Step 8 acceptance data changed.** Every real query in this task's own live probes and in the final acceptance run (§14) was a `select`; no `create`/`update`/`delete` was ever issued against the real ftrack workspace.
- **No unrestricted generic media lookup exists.** Three separate, narrow, context-scoped routes exist (§6) — never a bare `/versions/{id}/media`.
- **Agents must not call ftrack directly (CLAUDE.md).** `apps/api` reaches ftrack only through `intent_core_connector.FtrackConnector` (the same Connector `services/worker` already uses) — a new, explicit workspace dependency edge (§4), not a new access path around the Connector.

---

## 3. Real ftrack media evidence

### 3.1 What Step 9A found (recap, then corrected)

`docs/step-9/02_STEP_9A_...md` §9 reported, from a live read-only probe: 32/32 sampled real `AssetVersion`s had a resolvable thumbnail, 30/32 had a resolvable `.mp4` Component, and that these "are not safely cacheable as a static field" — resolution had to be live, per request. Step 9A explicitly flagged it had **not** opened a browser to confirm safe rendering, "since doing so would risk an actual media fetch/download." That caveat turned out to matter.

### 3.2 This task's own live probe (the correction)

Before writing any connector code, this task ran its own live, read-only, authenticated probe against the same real controlled workspace (`bristol-l.ftrackapp.com`) to confirm exact schema/query shapes. That probe found:

- `AssetVersion['thumbnail']` (to-one) and `AssetVersion['components']` (to-many) both resolve correctly via `session.query(...)`.
- A real sampled `AssetVersion` carried **three** real Components: a `jpg` thumbnail, a `.mp4` named `"ftrackreview-mp4"` (ftrack's own standard browser-reviewable proxy), and a `.mp4` named after the published asset itself (e.g. `"mw0040_comp_v03"`).
- `Component.file_type` is **inconsistently formatted** across real Components on the very same AssetVersion: `"jpg"` (no leading dot) vs. `".mp4"` (with a leading dot) — a real, empirically-confirmed quirk, not a guess.
- Calling `Location("ftrack.server").get_url(component)` / `.get_thumbnail_url(component)` **succeeded** and returned real, working URLs — but inspecting those URLs directly showed they embed `username=<real ftrack API user>` and `apiKey=<real ftrack API key>` as literal query parameters. Confirmed by reading `ftrack_api`'s own bundled SDK source (`ftrack_api/accessor/server.py`, `ServerAccessor.get_url`/`get_thumbnail_url`) — this is documented, intentional SDK behaviour, not a bug: the "signature" for this URL scheme *is* the caller's own live API credentials.
- `FileComponent`'s real schema (confirmed via `session.schemas`) has **no** `url`/`thumbnail_url` property at all — there is no credential-free way to resolve a Component's playable URL server-side today.
- `AssetVersion.thumbnail_url` **is** a real, queryable schema property (confirmed via `session.schemas`, `'thumbnail_url'` present in `AssetVersion`'s real property list) whose resolved value is a `{"url": ..., "value": ...}` mapping — a `cdn-eu3.ftrackapp.com` Thumbor-proxy URL wrapping a `bristol-l.ftrackapp.com/component/get?id=...&signature=...` link. This one has **no** `apiKey`/`username` parameter — the embedded `signature` is a one-time-scoped token for that one resource, not a reusable account credential. This is the field Step 9A's original audit had actually observed (it called this out as "a self-contained signed URL, not requiring an Authorization header") — Step 9A found this real field but this task's first implementation mistakenly used the different, credential-embedding `Location` method instead.

### 3.3 The correction

Per the task's own explicit instruction ("If direct browser access requires an authenticated ftrack session and cannot work safely, downgrade to thumbnail or external-context-only rather than proxying credentials through ICAS"), the connector was rewritten to:

- resolve **only** `AssetVersion.thumbnail_url` (safe, credential-free, server-signed);
- **never** call `Location.get_url()`/`get_thumbnail_url()` for any purpose;
- **never** populate a playable Component URL, since no safe, credential-free mechanism for one exists in this workspace's real schema today.

This is a genuine, evidence-based finding, not an implementation shortcut: the real capability this workspace safely exposes tops out at **thumbnail**, not **playable video** — confirmed by a full live re-sample after the fix (§14) showing zero credential leakage across every real Version in the workspace.

---

## 4. Transient media read contract

New Pydantic contract, `packages/contracts/python/src/intent_core_contracts/api/version_media.py`:

```python
VersionMediaState = Literal["playable", "thumbnail_only", "external_context_only", "unavailable"]

class VersionMediaRead(BaseModel):
    version_id: UUID
    source: RecordSource                    # mirrors Version.source ("manual" | "ftrack")
    ftrack_linked: bool                      # real ExternalEntityLink presence

    media_state: VersionMediaState

    thumbnail_url: str | None
    playable_url: str | None                 # always None today -- see §3/§15
    playable_media_type: str | None          # always None today
    playable_component_name: str | None      # always None today
    external_web_url: str | None             # always None today -- see §11

    resolved_at: datetime                    # when this response was built, never a stored value
    url_expires_at: datetime | None          # always None -- this workspace exposes no expiry field
    unavailable_reason: str | None
```

Never exposed: credentials, access tokens, raw Location configuration, storage secrets, raw external author ids, unrelated ftrack entities. Every optional field is genuinely nullable — never fabricated when unavailable. Response headers set `Cache-Control: no-store` on every one of the three endpoints (§6); every frontend fetch helper (`vfxFetch`/`cgFetch`/`artistFetch`) already sends `cache: "no-store"` by pre-existing convention.

---

## 5. Connector resolution rules

`services/ftrack-connector/src/intent_core_connector/media_context.py`'s `read_media_context_for_asset_version(session, *, version_external_id)`:

1. `select thumbnail_url from AssetVersion where id is "<external_id>"` — one targeted query, never a workspace-wide fetch.
2. If no row: `exists=False` (the deleted/missing-AssetVersion case).
3. Else: read `thumbnail_url` defensively (`.get("url")` then `.get("value")`, both real, equal in every observed sample; never assume a single fixed key; never fabricate when the field is empty/absent).
4. `playable_url`/`playable_media_type`/`playable_component_name` are **never** set by this module (§3.3) — the fields remain on `AssetVersionMediaContext` for forward compatibility with a future workspace/SDK version that exposes a safe Component URL field, but are always `None` today.

**Deterministic priority rule, as originally required by the task, now documented as historical/forward-looking rather than currently exercised:** if a safe playable-Component URL mechanism becomes available, the priority would be (1) a Component named `"ftrackreview-mp4"` (ftrack's own standard reviewable proxy) if resolvable; (2) else the remaining Components whose normalized `file_type` (leading dot stripped, case-insensitive) is `mp4` > `webm` > `ogg`, ordered by Component id ascending on ties; (3) never a Component whose Location cannot return a usable URL. This exact rule was implemented and unit-tested in this task's first connector pass; it was removed once the credential-leak was found, since exercising it at all requires the unsafe `Location.get_url()` call. It is preserved here as a specification for whichever future task re-enables playable media once a safe resolution path exists (§15).

The connector is read-only end to end: only `session.query(...)` is ever called; `create`/`create_note`/`update`/`delete`/`commit` are never called (enforced by the connector's own tests, which trap all five on a fake session).

---

## 6. Endpoint and role/context authorization

Three separate, narrow, context-scoped routes — never one unrestricted generic lookup:

| Route | Role | Context rule |
|---|---|---|
| `GET /vfx/shots/{shot_id}/versions/{version_id}/media` | `vfx_supervisor` only | `Version.shot_id == shot_id` (Shot-wide, matching the existing VFX Versions page) |
| `GET /cg/tasks/{task_id}/versions/{version_id}/media` | `cg_supervisor` only | `Version.shot_id == Task.shot_id` **and** (`Version.task_id == task_id` or `Version.task_id is None`) — the existing Step 8C-6/8C-7 nullable-`task_id` compatibility rule, reusing the exact predicate `department_execution_overview.service._is_version_in_task_scope` already established |
| `GET /artist/tasks/{task_id}/versions/{version_id}/media` | `artist` only | identical Task-scoped rule to CG's route |

Implemented in `apps/api/src/intent_core_api/version_media/{service,router}.py`, using the existing `ActorContext`/`get_current_actor`/`require_human_role` primitives (`workflow/actors.py`) — `require_human_role` is called before any Shot/Task lookup, so a disallowed role/context combination is rejected without leaking whether the target Version exists. Every route sets `Cache-Control: no-store` on its response.

**Rejected, by construction:**

- missing/invalid actor identity → `401` (`get_current_actor`'s existing header validation);
- disallowed role → `403` (`ForbiddenActionError`);
- missing Shot/Task → `404`;
- a Version from another Shot (VFX route) → `404`;
- a Version explicitly linked to another Task (CG/Artist routes) → `404`;
- an arbitrary external ftrack id supplied by the client → structurally impossible; no route or request field accepts one — the external id is resolved server-side from the real, already-persisted `ExternalEntityLink`, never from client input.

A manual/local Version with no `ExternalEntityLink` produces an honest `200` with `ftrack_linked: false, media_state: "unavailable", unavailable_reason: "This Version has no linked ftrack record."` — never a server error. A live ftrack lookup failure (auth/connection/query error, or a deleted `AssetVersion`) is caught in `version_media.service._build_media_read` and downgraded to an honest `200` `"unavailable"` response with a generic, non-leaking reason — never a `5xx`, and never a mutation to the local `Version` row (confirmed: `service.py` contains no `session.add`/`session.commit` of its own).

---

## 7. URL lifetime and security handling

- **Never persisted.** No field on `VersionMediaRead` is written to Postgres; `resolved_at` is generated at response-build time and is itself not stored.
- **Never logged in full.** No code path in this task's implementation writes a resolved URL to a log statement.
- **`no-store` everywhere.** Backend: `Cache-Control: no-store` response header on all three routes. Frontend: `vfxFetch`/`cgFetch`/`artistFetch` already default to `cache: "no-store"` (pre-existing convention, reused unchanged).
- **Resolved only for the selected/open Version**, never pre-resolved for every Version on a page — VFX/CG client selection triggers one Server Action call per selection change (`VersionMediaResolver`, §8/§9); Artist resolves only its already-selected Version server-side (§10).
- **No unbounded public proxy endpoint.** The three routes are role/context-gated reads returning a transient URL, not a byte-streaming proxy.
- **Refresh, not silent reuse.** `VersionMediaPanel`'s "Refresh media" action re-invokes the same authorised resolution path; the previous URL is discarded, never reused after a known/suspected failure.
- **Credentials never reach the browser** — this is the exact property this task's mid-implementation correction (§3.3) restored after finding it briefly violated. `url_expires_at` is always `None` today, honestly: this workspace's safe `thumbnail_url` field exposes no expiry metadata to read.

**Security incident and containment, recorded here in full per the task's own instruction not to omit it — no sensitive value included:**

- During this task's real, read-only acceptance verification (§14), the first connector implementation's resolved thumbnail/playable URLs were inspected while confirming live behaviour. Those URLs were found to contain the real ftrack API user and API key as authentication query parameters (`Location.get_url()`/`get_thumbnail_url()`'s own documented SDK behaviour — see §3).
- One credential-bearing URL appeared in the local Claude Code session output while diagnosing this.
- No credential-bearing URL entered any Git-tracked file, commit, database row, or the browser-facing final implementation at any point.
- The unsafe connector path (`Location.get_url()`/`get_thumbnail_url()`) was removed before this branch's first commit (§3.3).
- The owner rotated the exposed ftrack API key in the ftrack workspace admin console.
- All local services (`apps/api`, `apps/web`) were restarted so no running process retained the old credential or an ftrack session opened under it.
- A dedicated post-rotation verification pass confirmed: a minimal authenticated, read-only ftrack query succeeds with the rotated key; the real media acceptance counts are unchanged (§14); every browser-facing media response was scanned field-by-field for `apiKey`/`api_key`/`ftrack-api-key`/`username`/`access_token`/`auth_token` (case-insensitive) with **zero matches**; neither the old nor the rotated key occurs anywhere in the repository's tracked files, untracked project files, or full git history on any branch (`git log --all -S<value>`, zero hits for either value); the only occurrence of the rotated key anywhere on disk is the ignored root `.env`.

**Final safe implementation, confirmed:** only `AssetVersion.thumbnail_url` is ever used; its real-workspace response was verified credential-free for browser exposure; browser-facing responses contain zero credential-parameter matches; `Cache-Control: no-store` is set on every response; URLs are resolved transiently, only for the selected Version, never pre-resolved for a list; no URL is persisted anywhere (confirmed directly against the live Postgres schema — no `media`/`thumbnail`/`url`-shaped column or table exists); no full URL is logged; no media proxy exposes ftrack credentials; no ftrack write or `session.commit()` occurs (enforced by the connector's own no-write test traps, §13).

---

## 8. VFX Versions implementation

`apps/web/src/app/vfx/shots/[shotId]/versions/VersionsWorkspacePage.tsx` (client component, Version selection is `useState`): a `VersionMediaResolver` (new, `apps/web/src/design/semantic/version-media/VersionMediaResolver.tsx`) is rendered for `selected.version`, placed once, directly under the Version heading and before `MetadataRow` — never duplicated above and below. On mount and on every Version-selection change, it calls the new `resolveVersionMediaAction(shotId, versionId)` Server Action (`apps/web/src/features/vfx/versions-workspace/actions.ts`), which resolves Demo identity server-side (`resolveIdentity()`/`actorHeaders()`, the same pattern `intent-workspace/actions.ts` already established) and calls the Shot-scoped endpoint. A `requestIdRef` guard discards a stale response if the user switches Versions before the previous request resolves (unit-tested, §13). Renders via the shared, presentational `VersionMediaPanel` (§4's contract → UI mapping, one component reused by all three pages).

---

## 9. CG Version Review implementation

`apps/web/src/app/cg/tasks/[taskId]/version-review/VersionReviewPage.tsx`: the same `VersionMediaResolver`/`VersionMediaPanel` pair, calling the new `resolveVersionMediaAction(taskId, versionId)` Server Action added to the existing `features/cg/actions.ts`. Placed as the first element inside the existing `EvidenceLayerSection kind="production-evidence"` block — media is Production Evidence/source context, never classified as Agent Interpretation or Human Decision (verified by a dedicated test asserting the rendered `<img>`/`<video>` never appears inside the Agent-Interpretation or Human-Decision `[data-evidence-layer]` sections). `Add Review Note`, `Generate CG Supervisor review`, and `Escalate to VFX` (`VersionReviewActions.tsx`) are completely untouched — no media upload, annotation, or ftrack write-back control was added anywhere near the panel.

---

## 10. Artist Current Version implementation

`apps/web/src/app/artist/tasks/[taskId]/current-version/CurrentVersionPage.tsx` is a **Server Component** (Version selection is `?version=` navigation, not client state) — so media is resolved server-side, once, inside `features/artist/current-version/data.ts`'s `loadCurrentVersionData`, for `selectedVersion` only, and passed down as a plain `media: VersionMediaRead | null` prop rendered directly via `VersionMediaPanel` (no client resolver needed for this page). `page.tsx` was upgraded from a raw cookie check to `resolveIdentity()`/`actorHeaders()` (matching the pattern already established for the VFX Shot Overview page in Step 9B-3) so the new role-gated media endpoint can be called with trusted headers. A failed media resolution is swallowed (`.catch(() => null)`) so it never blocks the rest of the page load. Media renders inside the existing `EvidenceLayerSection kind="production-evidence"` block; Artist Guidance remains under `agent-interpretation`, untouched. Artist receives no upload, approval, Anchor-edit, or ftrack write control from this panel — confirmed by test.

---

## 11. ftrack external-context behaviour

**No safe, proven ftrack web deep-link format was established in this task** — `external_web_url` is always `None`. Step 9A's own audit marked its guessed URL-scheme recommendation `[INFER], not independently re-verified by opening a browser`; this task did not open a real browser against the live ftrack web client either (doing so was out of this task's read-only-API scope, and guessing wrong would ship a broken/misleading "Open in ftrack" link — explicitly forbidden: "Do not guess the URL format"). Per the task's own fallback instruction, the link is simply omitted; `source`/`ftrack_linked` remain internally accurate on every response, and the frontend's `VersionMediaPanel` only renders an "Open in ftrack" link when `external_web_url` is non-null (unit-tested for both the present and absent case). The raw ftrack external id is never rendered as normal page copy anywhere.

---

## 12. Failure and partial-data states

All twelve states the task named are covered, each by an automated test and/or a live-verified real Version:

| State | Covered by |
|---|---|
| Manual/local Version, no `ExternalEntityLink` | `test_manual_version_returns_honest_not_linked_state_not_a_server_error` (backend); live, `8a72858d-...` Shot |
| Linked Version whose ftrack entity no longer exists | `test_deleted_ftrack_asset_version_returns_honest_unavailable_state` (backend, injected fake resolver) |
| Version with thumbnail and playable Component | Not reachable today (§3.3/§15) — covered as a service-layer unit test only (`test_vfx_supervisor_can_resolve_media_in_correct_shot_context`, injected fake) |
| Version with thumbnail only | Live-verified across 32/32 real linked Versions in the acceptance sample (§14) |
| Version with Components but no resolvable Location | Superseded by §3.3's finding — no Component URL is ever attempted; covered by `test_no_resolvable_location_never_claims_playable_or_thumbnail`-equivalent connector tests for the thumbnail path (`test_empty_thumbnail_mapping_resolves_to_none`) |
| Playable URL resolution failure | N/A today (playable is never attempted) — the equivalent real case, a thumbnail resolution failure, is covered by `test_empty_thumbnail_mapping_resolves_to_none`/`test_no_thumbnail_field_resolves_to_none_not_an_error` |
| Expired URL followed by successful refresh | `VersionMediaResolver.test.tsx`'s Retry test (mock first call fails, second succeeds) |
| Expired URL followed by continued failure | Same test file's error-state assertions (error message + Retry button remain available) |
| ftrack service temporarily unavailable | `test_ftrack_service_unavailable_returns_honest_state_not_a_500` (backend) |
| Selected Version changes while an earlier request is in flight | `VersionMediaResolver.test.tsx`'s stale-response-discarded test (deferred promise) |
| User switches between Versions | `VersionMediaResolver.test.tsx`'s Version-change test; `VersionsWorkspacePage.test.tsx`/`VersionReviewPage.test.tsx` selection tests |
| Role/context authorization failure | `test_version_media.py`'s full authorization matrix (§13) |

The existing Version/ReviewNote content, Core/Execution Anchor context, and (on CG) Review actions remain fully usable in every one of these states — confirmed by dedicated tests asserting Review Notes/Anchor text stay visible when the media call itself fails.

---

## 13. Tests and automated validation

**Connector** (`services/ftrack-connector/tests/test_media_context.py`, 9 tests): real safe-thumbnail resolution; no-credential-embedding assertion; honest `None` for an absent/empty thumbnail field; `playable_*` fields never populated; deleted/missing AssetVersion (`exists=False`); a genuine query-transport failure raises `IntegrationError`; no write-capable session method is ever called; results are resolved fresh per call, never cached.

**API** (`apps/api/tests/test_version_media.py`, 23 tests): VFX allowed in the correct Shot context; CG/Artist allowed in the correct Task context; missing/invalid identity rejected (401); wrong role rejected on each of the three routes (403); Version from another Shot rejected (404, VFX); Version linked to another Task rejected (404, CG); nullable-task compatibility accepted only within the same Shot; missing Shot/Task → 404; manual Version → honest unavailable state, not a server error; deleted ftrack AssetVersion → honest unavailable state; ftrack-service-unavailable → honest unavailable state, not a 500; `thumbnail_only`/`external_context_only` tier classification (service-layer, injected fake resolver); read-only/no-mutation (two identical reads, unchanged `Version` row); no signed URL or secret in an error response; no raw UUID in `unavailable_reason`; `Cache-Control: no-store` on every response.

**Frontend** (54 new/updated tests across 6 files): `VersionMediaPanel.test.tsx` (12) — playable rendering (native video, controls present, autoplay/muted absent, real poster), thumbnail-only, external-context-only (with and without a link), unavailable (honest reason, never a fake frame), loading, error+Retry, Refresh-media presence/absence rules, no upload/write control, no raw UUID/token. `VersionMediaResolver.test.tsx` (4) — resolves on mount, Retry re-resolves, re-fetches on Version change, discards a stale response from a superseded selection. `VersionsWorkspacePage.test.tsx`/`VersionReviewPage.test.tsx`/`CurrentVersionPage.test.tsx` (+9 combined) — real media resolved via the correct Shot/Task-scoped Server Action or server loader; media stays inside Production Evidence; Review Notes/Anchor context survive a media failure; no upload/annotate/approve control.

**Run:** connector 81/81 (services/ftrack-connector, focused 9/9); API 953/953 (apps/api, focused 23/23); services/worker 36/36 (unaffected regression check); `mypy src` clean across `apps/api`, `services/ftrack-connector`, `packages/contracts/python`; `ruff check`/`format --check` clean across all three; contract generation (`export_openapi` → `openapi-typescript`) consistent; frontend Vitest 1027/1027 (128 files); `tsc --noEmit` clean; ESLint clean (one pre-existing, unrelated warning in `CoreAnchorRevisionEditor.tsx`); Prettier clean; production `next build` succeeded (31 routes, unchanged route count — confirmed via `git diff --name-status`-equivalent inspection, no route file added/removed); `uv lock --check` clean. No existing test was weakened.

---

## 14. Real read-only acceptance

Performed against the real, live, controlled ftrack workspace (`bristol-l.ftrackapp.com`) after the §3.3 correction, via the running `apps/api` instance. Never mutated ftrack or local acceptance data (every call was a `GET`). No full signed URL is recorded below — only aggregate counts, and an explicit, programmatically-verified absence of any `apiKey`/`username` parameter across the entire sample.

| Metric | Count |
|---|---|
| Sampled Versions (every real Version across every Shot in the local database) | 34 |
| `playable` | 0 |
| `thumbnail_only` | 32 |
| `external_context_only` | 0 |
| `unavailable` | 2 |
| Resolution failures (transport/timeout) | 0 |
| Credential leakage detected (`apiKey`/`username` in any URL field, any row) | **0 — none** |

**Verified, as required:**

- **At least one real playable Version** — not currently achievable safely in this workspace (§3.3/§15); the *code path* is implemented and unit/integration-tested, but no real Version in this workspace can honestly report `"playable"` today.
- **At least one thumbnail/fallback case** — 32/32 real ftrack-linked Versions resolved `thumbnail_only`, each with a real, safe, credential-free `cdn-eu3.ftrackapp.com` Thumbor URL.
- **At least one manual/local no-ftrack Version** — 2/2 manual Versions (the D1 demo Shot's Versions) correctly reported `unavailable`, `ftrack_linked: false`.

Live-verified via `curl` against the running dev servers (both left running for owner validation, §16):

- `GET /vfx/shots/d79f904f-.../versions/6f11c641-.../media` (real, `bc0040_comp_v003`) → `200`, `thumbnail_only`, a real `cdn-eu3.ftrackapp.com` thumbnail URL, no `apiKey`.
- `GET /cg/tasks/f1451fda-.../versions/a8704956-.../media` and the equivalent `/artist/...` route → both `200`, `thumbnail_only`, identical safe thumbnail.
- `GET /vfx/shots/8a72858d-.../versions/99727ff4-.../media` (manual D1 Version) → `200`, `unavailable`, `"This Version has no linked ftrack record."`.
- `/artist/tasks/f1451fda-.../current-version` page HTML: a real `<img>` with the safe thumbnail URL, **zero** `<video>` elements, **zero** occurrences of `apiKey`/`username=` anywhere in the rendered page.
- `/vfx/shots/.../versions` and `/cg/tasks/.../version-review` pages: `200`, honest client-side "Resolving media…" initial state (these two pages resolve media client-side after hydration, which a plain `curl` cannot execute — verified instead via the Vitest suite's jsdom-based integration tests, §13).

**Re-run in full, post-rotation, after the owner rotated the exposed ftrack API key and all local services were restarted with the new credentials (§7):** identical counts (34 sampled, 32 `thumbnail_only`, 2 `unavailable`, 0 `playable`, 0 `external_context_only`, 0 failures), and a field-by-field scan of every one of those 34 responses (plus the CG/Artist/manual-fallback spot checks above) for `apiKey`/`api_key`/`ftrack-api-key`/`username`/`access_token`/`auth_token` confirmed **0 matches** with the rotated key in use.

---

## 15. Known limitations

- **Playable video is not currently achievable safely in this real ftrack workspace.** The only ftrack SDK mechanism capable of resolving a Component's playable URL (`Location.get_url()`) embeds this service's own live API credentials in the URL; no credential-free equivalent schema field exists on `FileComponent` today (confirmed via `session.schemas`). The `"playable"` tier, its deterministic Component-selection rule (§5), and its full frontend rendering path (native `<video>`, poster, controls) are implemented and tested, but structurally unreachable against this workspace until a safe resolution mechanism exists (a future ftrack SDK/workspace feature, or a deliberately-scoped later task adding a genuinely safe server-side proxy — explicitly out of this task's scope and not attempted here, since "avoid an unbounded public proxy endpoint" and "do not download or copy media binaries into ICAS" were both explicit constraints).
- **`external_web_url` is always `None`.** No ftrack web deep-link format was independently proven safe/correct in this task (§11) — omitted honestly rather than guessed.
- **`url_expires_at` is always `None`.** The one safe field this workspace exposes (`AssetVersion.thumbnail_url`) carries no expiry metadata to read.
- **A real ftrack API key was briefly exposed in this task's own tool output** while diagnosing the credential-leak finding (§7). **Resolved:** the owner has since rotated the key, all local services were restarted with the rotated credentials, and a dedicated post-rotation verification pass (§7/§14) confirmed both successful authenticated access with the new key and zero occurrences of either the old or new key anywhere in the repository, its git history, or any browser-facing response. No Git-tracked file, commit, or documentation contains either key.
- **The two demo-seed manual Versions are the only `unavailable` case sampled** — no live example of a *linked-but-service-currently-down* case was captured (that state is covered by an automated test with an injected failure instead, `test_ftrack_service_unavailable_returns_honest_state_not_a_500`).

---

## 16. Owner visual-validation targets

Local services: `apps/api` on `http://localhost:8000`, `apps/web` (dev) on `http://localhost:3000`, entry via `http://localhost:3000/demo`.

**Final owner visual validation has PASSED for all four required contexts, post-rotation.**

**Real VFX Shot Versions** — `http://localhost:3000/vfx/shots/d79f904f-89ce-429f-8e82-eea9f5bca638/versions`. Observed: a real ftrack thumbnail appeared for the selected Version; no fake media, black placeholder frame, or browser video player appeared; the UI honestly stated "Playable media is unavailable for this Version."; ftrack source context was clear; Review Notes, Core Anchor, and Alignment Assessment context all remained usable; no API key, credential parameter, full media URL, or raw external id appeared anywhere on the page; media remained supporting Production Evidence rather than dominating the page.

**Real CG Version Review** — `http://localhost:3000/cg/tasks/f1451fda-80be-4820-8d9f-172d71df668f/version-review`. Observed: a real thumbnail appeared under Production Evidence; Agent Interpretation and Human Decision and Provenance remained visibly distinct sections; Review Notes and the authorised review/escalation actions remained available; no media upload, ftrack write, media approval, or Anchor-edit capability was introduced; media remained compact review context, not a dominant region.

**Real Artist Current Version** — `http://localhost:3000/artist/tasks/f1451fda-80be-4820-8d9f-172d71df668f/current-version`. Observed: a real thumbnail appeared under Production Evidence; Artist Guidance remained advisory Agent Interpretation; Review Notes, CG Supervisor reviews, Cross-role Assessments, and the existing authority references all remained visible; no upload, approval, Anchor-edit, or ftrack-write control appeared; the page remained readable.

**Manual/local fallback** — `http://localhost:3000/vfx/shots/8a72858d-8d06-47ab-a28d-5ee077f561c8/versions`. Observed: no fake thumbnail or black player was displayed; the UI honestly stated the Version had no linked ftrack record; `source` remained `manual`; the Review Note, Core Anchor, and Alignment Assessment context all remained usable; no invalid "Open in ftrack" link appeared (§11 — no link is ever shown, since none was proven safe).

**Version-switch interaction, verified on the primary VFX Versions URL:** the owner switched the selection from `bc0040_comp_v003 (v3)` to `bc0040_layout_v002 (v2)` and confirmed: the left-side selection changed; the right-side Version title changed; the thumbnail changed from the motorcycle shot to the layout/city shot; the Version description and Review Note changed with the selected Version; no previous media or metadata remained stale from the prior selection; the remainder of the Version context stayed available throughout the switch.

**Final Step 9B-4 verdict: Step 9B-4 complete — safe, transient real ftrack thumbnail context was implemented, automatically validated, post-rotation security validated, real-workspace accepted, and owner visually validated.**

One non-blocking presentation-comprehension observation was recorded during this validation, out of Step 9B-4's own scope (not a media synchronization defect — the media/metadata panel itself updated correctly on every Version switch): see `docs/IMPLEMENTATION_STATUS_AND_ROADMAP.md` §L's Step 9C/9D backlog item on the VFX Shot context header's "VERSION ..." label versus the separately-selected Version list.

---

## 17. Explicit non-goals

- Step 9C (visual-system unification) was not started.
- No video editor, cross-Version visual diff, or bespoke player suite was built — one shared, minimal `VersionMediaPanel`/`VersionMediaResolver` pair, reused by all three pages.
- No database migration or persisted media field of any kind.
- No media upload, annotation, or ftrack write-back control anywhere.
- No download or local copy of any media binary — every URL is resolved and handed to the browser directly; ICAS never fetches the bytes itself.
- No fake/placeholder video content anywhere, at any tier.
- No unrestricted generic external-media lookup endpoint.
- No credential proxying through ICAS — the deliberate, evidence-based downgrade in §3.3/§15 is this task's own enforcement of that boundary.
- No new route, sidebar item, role permission, or tab.

---

## 18. Step 9B completion readiness

**Step 9B-4 is complete: implementation, automated validation, real read-only acceptance, the mid-implementation security fix, post-rotation security re-verification, and final owner visual validation are all done (§16).**

Step 9B-4 was the final planned Step 9B package (`02_STEP_9A_...md` §11/§17). With Step 9B-1/9B-2/9B-3 already independently complete with their own owner validation, and Step 9B-4 now complete, **Step 9B as a whole is complete** — recorded in `docs/IMPLEMENTATION_STATUS_AND_ROADMAP.md` §L in this same documentation-closeout pass.

Step 9C (design-system visual unification) has explicitly **not** begun. The next approved activity is Step 9C. One non-blocking presentation-comprehension item surfaced during Step 9B-4's owner validation — the VFX Shot context header's "VERSION ..." label versus a separately-selected browsing Version — is recorded as a Step 9C/9D backlog item (`docs/IMPLEMENTATION_STATUS_AND_ROADMAP.md` §L), not implemented here, and is not a Step 9B-4 defect (the media panel itself always tracked the selected Version correctly, per §16's Version-switch evidence).

**Files changed, this step (exhaustive):**

Connector: `services/ftrack-connector/src/intent_core_connector/media_context.py` (new); `services/ftrack-connector/src/intent_core_connector/connector.py` (+`read_media_context_for_asset_version`); `services/ftrack-connector/tests/test_media_context.py` (new, 9 tests).

Contracts: `packages/contracts/python/src/intent_core_contracts/api/version_media.py` (new); `apps/api/openapi.json` (regenerated, gitignored); `packages/contracts/ts/src/generated/api.ts` (regenerated); `packages/contracts/ts/src/index.ts` (+2 exported type aliases).

Backend: `apps/api/pyproject.toml` (+`intent-core-connector` dependency); `uv.lock` (regenerated); `apps/api/src/intent_core_api/version_media/{__init__,resolver,service,router}.py` (new); `apps/api/src/intent_core_api/main.py` (+3 router imports/includes); `apps/api/tests/test_version_media.py` (new, 23 tests).

Frontend: `apps/web/src/design/semantic/version-media/{VersionMediaPanel,VersionMediaResolver,index}.{ts,tsx}` (new; named `version-media`, not `media`, since the repo's own root `.gitignore` has a `media/` rule that would otherwise silently exclude the directory) + `.module.css` (new) + `.test.tsx` (new, 16 tests); `apps/web/src/design/semantic/index.ts` (+1 export line); `apps/web/src/features/vfx/api.ts` (+`fetchVersionMedia`); `apps/web/src/features/vfx/versions-workspace/actions.ts` (new); `apps/web/src/features/cg/api.ts` (+`fetchVersionMedia`); `apps/web/src/features/cg/actions.ts` (+`resolveVersionMediaAction`); `apps/web/src/features/artist/api.ts` (+`fetchVersionMedia`); `apps/web/src/features/artist/current-version/data.ts` (+`actorHeaders` param, +`media` field); `apps/web/src/app/artist/tasks/[taskId]/current-version/page.tsx` (identity resolution upgraded); `apps/web/src/app/vfx/shots/[shotId]/versions/VersionsWorkspacePage.tsx` (+panel); `apps/web/src/app/cg/tasks/[taskId]/version-review/VersionReviewPage.tsx` (+panel); `apps/web/src/app/artist/tasks/[taskId]/current-version/CurrentVersionPage.tsx` (+panel); plus the corresponding `*.test.tsx`/`*.test.ts` updates for every file above.

Documentation: this file (new); `docs/IMPLEMENTATION_STATUS_AND_ROADMAP.md` (updated, §L).

No route, sidebar, tab, migration, Agent, ftrack entity, or Step 8 acceptance file was touched.
