# ICAS Step 7B-3 — Shared Semantic Components: Implementation Note

**Status:** Implemented on `feat/step7-role-aware-dashboard`, not yet merged
**Batch:** 3 of 8 (per `06_STEP_7_LOCKED_SOURCE_OF_TRUTH.md` §14)
**Scope:** Shared Intent Signal, authority/advisory, Evidence/Provenance,
and ftrack linkage components only -- no VFX/CG/Artist domain pages, no
backend change.
**Base commit:** `5384c26` (Step 7B-2 + guided-demo correction)

## 1. Component inventory

All new files live under `apps/web/src/design/semantic/` (four families)
and `apps/web/src/app/dev/semantic-components/` (the Development
preview). 33 components/modules, 27 focused test files, 92 tests.

### Intent Signal (`design/semantic/intent-signal/`)

`IntentSignalIndicator` (level 1, global), `IntentSignalTray` (level 2,
compact collection), `IntentSignalCard` (level 3, homepage card),
`IntentSignalBadge` (level 4, list-row), `IntentSignalBanner` (level 5,
contextual), `IntentSignalDetail` (level 6, full detail) -- exactly the
six presentation levels from `05_STEP_7A4_...md` §7, implemented as one
reusable family sharing `intentSignalModel.ts`'s wording/tone/label
functions and the `IntentSignalAvailability` view model.

### Authority (`design/semantic/authority/`)

`AuthorityBoundary` (primitive owner-statement), `HumanDecisionNotice`,
`AgentAdvisoryNotice`, `ConfirmationRequiredPanel`,
`ReadOnlyAuthorityNotice`. All reuse the existing 7B-1 `AuthorityLabel`
and `PermissionState` rather than introducing a second vocabulary.

### Evidence / Provenance (`design/semantic/evidence/`)

`EvidenceProvenanceDrawer`, `EvidenceSourceList`, `SourceReference`,
`AgentRunReference`, `ContextSnapshotReference`, `ProvenanceMetadata`,
plus `evidenceModel.ts` (`humanizeSourceType`, `EvidenceReferenceLike`).

### ftrack linkage (`design/semantic/ftrack/`)

`FtrackLinkageBadge`, `FtrackObjectLinkage`, `FtrackSyncSummary`,
`IntegrationAvailabilityNotice`.

Each family has a barrel `index.ts`; `design/semantic/index.ts`
re-exports all four, and `design/index.ts` now exports `./semantic`
alongside `./layout`, `./components`, and `./shell`.

## 2. Component-to-domain mapping

Every prop is traced to a real field in `@intent-core/contracts`
(`packages/contracts/ts/src/generated/api.ts`) -- nothing here was
invented before inspecting the actual schemas:

| Component(s) | Real contract fields used |
|---|---|
| Intent Signal family | `IntentSignalRead` (`attention_level`, `signal_output`, `created_at`), `IntentSignalOutput` (`summary`, `drivers`, `role_coverage`, `re_anchor_proposal_present`, `caveats`), `IntentSignalDriver` (`code`, `summary`, `priority`, `assessment_section`, `assessment_item_index`), `RoleCoverage` |
| `HumanDecisionNotice` | The `confirmed_by_human_role` / `confirmed_at` / rationale shape shared by `CoreAnchorRevisionRead`, `ExecutionAnchorRevisionRead`, `DecisionRead` |
| `AgentAdvisoryNotice` | `AgentRunRead` (`agent_type`, `capability`, `provider`) |
| `ConfirmationRequiredPanel` | `HumanGateRead` (`gate_type`, `required_role`, `opened_at`) -- display only, no Confirm/Reject |
| `ReadOnlyAuthorityNotice` | `HumanRole` (owner) + reused `PermissionState` |
| Evidence components | `CrossRoleEvidenceReference` (`source_type`, `source_id`, `label`) -- see §2.1 below for why this one shape covers four contracts |
| `AgentRunReference` | `AgentRunRead` in full (`status`, `error`, `provider`, `model_name`, `started_at`) |
| `ContextSnapshotReference` | `ContextSnapshotRead` (`id`, `created_at` only -- never `payload`) |
| `FtrackLinkageBadge`, `FtrackObjectLinkage` | `RecordSource` (`ProjectRead`/`ShotRead`/`TaskRead`/`VersionRead`/`ReviewNoteRead`'s `source: "manual" \| "ftrack"`) |
| `FtrackSyncSummary` | `SyncCursorRead` (`key`, `last_synced_at`) |
| `IntegrationAvailabilityNotice` | `WritebackRecordRead` (`entity_type` -- currently only `"core_anchor_revision"` -- `status`, `error`, `target_external_id`, `external_note_id`) |

### 2.1 `EvidenceReferenceLike` -- the one frontend display view model

`CrossRoleEvidenceReference`, `VFXReviewEvidenceReference`,
`CGReviewEvidenceReference`, and `ArtistEvidenceReference` all already
share the identical `{source_type, source_id, label}` shape (only their
`source_type` literal unions differ). Rather than building four
near-duplicate evidence components, `evidenceModel.ts` declares one
structural interface, `EvidenceReferenceLike`, that any of the four real
contract types is assignable to without a cast. This is the only
frontend-only type introduced in this batch; it is derived entirely
from real fields, invents no production facts, and does not duplicate
any backend persistence logic -- it exists purely so one evidence
component family can render all four evidence-reference kinds.

### 2.2 `IntentSignalAvailability` -- the one other display view model

`IntentSignalRead` only ever exists after a **successful** Cross-role
Assessment, so "why is there nothing to show" (never attempted, latest
attempt failed, or simply not fetched yet) is not a field on the
persisted object -- it comes from a caller combining an `AgentRun`
status with the presence/absence of a signal. `IntentSignalAvailability`
(`{status: "available", signal} | {status: "no-assessment"} |
{status: "generation-failed"} | {status: "unavailable"}`) is that
union, shared by all six Intent Signal components so they share one
honest state model instead of six different empty-state conventions.

No backend fields or database migrations were added for either view
model.

## 3. Intent Signal wording mapping

`intentSignalModel.ts` defines two wording functions, kept deliberately
separate:

- **`intentSignalLevelWording(level)`** -- generic, role-agnostic,
  matches the persisted `label` field 1:1 (`low_attention` -> "Low
  attention", `attention_needed` -> "Attention needed",
  `human_review_required` -> "Human review required"). Used by the
  global indicator, tray, and list-row badge, where no specific
  viewing role applies.
- **`intentSignalRoleWording(role, level)`** -- role-specific framing
  per `02_STEP_7A1_...md` §10, used by the homepage card, banner, and
  detail view:

  | Role | Wording at medium/high attention | Wording at low attention |
  |---|---|---|
  | VFX Supervisor | Human review required | Low attention |
  | CG Supervisor | Execution clarification required | Low attention |
  | Artist | Supervisor clarification pending | Low attention |

  **Documented rule:** at `attention_level: "low"` every role falls back
  to the neutral level wording instead of an action phrase. Nothing
  requires action at low attention, so showing e.g. "Execution
  clarification required" when nothing actually needs clarifying would
  misrepresent the signal -- this is a deliberate truthfulness choice,
  not an oversight, and is unit-tested directly
  (`intentSignalModel.test.ts`).

Both functions confirm the persisted `IntentSignalRead` is one object:
every component in the family takes the *same* signal and receives
`role` as a separate prop -- there is no per-role signal record.

## 4. Truthfulness constraints applied

- No numeric unread/signal count anywhere (`IntentSignalIndicator`
  renders presence + level only; `TopBar` from Step 7B-2 already has no
  count and remains untouched).
- No `role="status"`/`role="alert"` live-region wrapping on any Intent
  Signal component -- those ARIA roles specifically imply "this content
  changes and will be announced automatically," which would misrepresent
  a one-shot derived snapshot as a live feed. (`ErrorState`'s `role="alert"`
  is still used correctly inside `AgentRunReference`/`IntegrationAvailabilityNotice`
  for genuine one-time failure announcements -- that is a real, transient
  render-time state, not a live monitor.)
- `IntentSignalBadge` renders nothing (not an "unavailable" chip) when
  no signal exists, so absent badges never imply "everything is fine."
- Every "no-assessment"/"generation-failed"/"unavailable" branch across
  all six Intent Signal components renders distinct, honest copy --
  never optimistic placeholder content, never a fabricated summary.
- ftrack: only the `source: "manual" | "ftrack"` field is used for
  per-object linkage; no per-object sync timestamp or external id is
  shown because none is persisted per object yet (see §7/§8).
- `IntegrationAvailabilityNotice` shows no connector-health,
  credential-presence, or configuration detail -- none of that is
  exposed by any Read contract.

## 5. Authority rules represented

- `HumanDecisionNotice` always renders `AuthorityLabel
  variant="human-confirmed"` (the neutral tone, never green -- matches
  the "green only for confirmed technical success" rule).
- `AgentAdvisoryNotice` always renders `AuthorityLabel
  variant="ai-interpretation"` or `"ai-proposal"` (the violet Agent
  accent) plus the fixed sentence "Advisory only -- not automatically
  applied." It has no prop that could wire up an apply/confirm action.
- `ConfirmationRequiredPanel` represents a pending `HumanGateRead` with
  zero interactive controls -- no Confirm/Reject/Apply of any kind
  (HumanGate interactions remain out of scope for this batch).
- `ReadOnlyAuthorityNotice` reuses `PermissionState` to represent
  Artist's read-only Core/Execution Anchor access, naming the actual
  owning role (`Human {ROLE_LABEL[ownerRole]} controls the
  {objectLabel}`) rather than a generic "access denied."
- Tests (`authorityDistinction.test.tsx`) directly assert
  `HumanDecisionNotice` and `AgentAdvisoryNotice` render visibly
  different `AuthorityLabel` text and that neither notice contains any
  button.

## 6. Evidence / Provenance fields represented

Human-readable label first, technical identifier secondary
(`SourceReference` renders `label`, then a humanized `source_type`,
then `source_id` last, verified by DOM-order assertion in
`SourceReference.test.tsx`). `AgentRunReference` shows `agent_type`,
`capability`, `provider`, `model_name` (only when present),
`status`, `started_at`; a `"failed"` run renders its existing
`error` field via `ErrorState` rather than hiding the failure.
`ContextSnapshotReference` shows only `id` and `created_at` -- the raw
`payload` field is never rendered (verified directly in
`ContextSnapshotReference.test.tsx`). No provider API keys, hidden
prompts, environment values, or stack traces are part of any component
prop or rendered output -- there was never a field to expose, since
`model_gateway.py`'s existing sanitisation already keeps `AgentRunRead.error`
safe before it ever reaches the frontend.

`EvidenceProvenanceDrawer` uses a native `<details>`/`<summary>`
disclosure (no modal framework), matching the pattern already used for
Cross-role Assessment history and the Demo entry's "Explore by role"
section.

## 7. Supported ftrack linkage states

Grounded directly in persisted fields:

- **Linked to ftrack** / **No linked ftrack entity** -- `source:
  "manual" | "ftrack"` on `ProjectRead`, `ShotRead`, `TaskRead`,
  `VersionRead`, `ReviewNoteRead`.
- **Controlled write-back not requested** -- no `WritebackRecordRead`
  exists for the entity.
- **Write-back pending / succeeded / failed** -- `WritebackRecordRead.status`,
  with the failed branch rendering `WritebackRecordRead.error` honestly.
- **System reconciliation summary** (secondary Integrations page only,
  not object-level) -- `SyncCursorRead.key` / `last_synced_at`.

## 8. Unsupported ftrack states, deferred to Step 8

Documented explicitly rather than fabricated:

- **Per-object sync timestamp / "last synced" for a specific Shot, Task,
  or Version.** No Read contract currently persists this -- only the
  system-wide `SyncCursorRead` exists, and it is not wired to any
  per-object query today. `FtrackObjectLinkage` always renders "Sync
  status unavailable" honestly instead.
- **Per-object external ftrack identifier.** `TaskCreate` accepts an
  optional `external_id` at creation time, but `TaskRead` does not
  return it -- so it cannot be displayed even for ftrack-sourced Tasks.
  `VersionRead`/`ShotRead` have no external-id field at all.
- **Connector health / credential presence / validated mode.** Not
  exposed by any Read contract; `IntegrationAvailabilityNotice`
  deliberately shows none of this.
- **Controlled write-back for any entity type other than
  `core_anchor_revision`.** `WritebackRecordRead.entity_type` is a
  literal constant today; the component does not imply broader
  write-back coverage exists.
- **Read-only connector validated** and **Integration-ready** states
  from `06_STEP_7_LOCKED_SOURCE_OF_TRUTH.md` §9's truthful-states list
  have no backing field yet and are not implemented; only the states
  above are.

## 9. Development fixture isolation

All fixture data lives in `apps/web/src/app/dev/semantic-components/fixtures.ts`,
imported only by `SemanticComponentsPreview.tsx` (itself reachable only
via direct URL at `/dev/semantic-components`, not linked from `/demo`,
`/vfx`, `/cg`, `/artist`, or any App Shell navigation -- verified by
`portfolioNavigation.test.ts`, which asserts no `ROLE_SIDEBAR_ITEMS`
entry starts with `/dev`). Test-only fixtures live separately in
`intentSignalTestFixtures.ts`, imported only by `.test.tsx` files. No
production component embeds Demo records; every production component in
this batch receives its data through props only. The preview itself
displays "Development fixture — not live production data" directly
under its page header.

## 10. Accessibility decisions

- `EvidenceProvenanceDrawer` uses native `<details>`/`<summary>` --
  expanded/collapsed state is exposed by the browser natively, matching
  the disclosure pattern already established in this codebase (no new
  ARIA wiring, no modal framework).
- Intent Signal and ftrack badges never rely on colour alone: distinct
  wording text always accompanies the `StatusBadge`/`AuthorityLabel`
  tone (e.g. "Low attention" vs. "Human review required" are different
  sentences, not just different colours).
- `IntentSignalDetail`'s role coverage renders as a plain sentence
  ("Covered: vfx_supervisor, cg_supervisor · Not covered: artist"), not
  colour-coded icons.
- Historical vs. current: `IntentSignalDetail`'s `variant="historical"`
  renders the existing `AuthorityLabel variant="historical"` (marker +
  border style + text, not colour alone); `variant="latest"` renders no
  historical marker at all -- the two are never visually merged.
- No disabled/unavailable action is ever rendered as a clickable
  control: `ConfirmationRequiredPanel`, `AgentAdvisoryNotice`, and
  `IntegrationAvailabilityNotice` contain zero `<button>`/`<a>` elements
  (asserted directly in tests).
- No screen-reader-only text implies a notification/live feature:
  Intent Signal components deliberately avoid `role="status"` /
  `role="alert"` (see §4); `ErrorState`'s `role="alert"` is reserved for
  genuine one-time failure announcements elsewhere in the same family.
- Heading hierarchy in the Development preview: one real `<h1>` (page
  title), `<h2>` section headings, `<h3>` sub-labels -- no skipped
  levels (verified in `SemanticComponentsPreview.test.tsx`).
- Focus states reuse the existing `:focus-visible` foundation from
  Step 7B-1; no new focus styling was introduced.

## 11. Explicit Step 7C deferrals

Everything these components will eventually be wired into remains
unbuilt: the final VFX Alignment Inbox, CG Execution Inbox, and Artist
My Tasks; Project/Shot/Task/Version pages; Version collection pages;
Intent Workspace; Alignment Workspace; any HumanGate interaction
(Confirm/Reject); any Anchor or Decision mutation; Cross-role Assessment
or Re-anchor generation actions; live Signal generation; real ftrack
launch, authentication, identity mapping, sync execution, or write-back
execution; integration configuration UI. This batch only built the
shared, prop-driven presentation layer those pages will consume.

## Automated validation

- Focused Step 7B-3 tests: 92/92 passed (27 new test files: Intent
  Signal x7, authority x6, evidence x7, ftrack x4, Development preview
  x3).
- Full frontend test suite: 363/363 passed (271 pre-existing + 92 new).
- TypeScript (`tsc --noEmit`): clean.
- ESLint: clean.
- Prettier (`--check`): clean.
- `git diff --check`: clean.
- Next.js production build: attempted, blocked by the same recurring
  environmental conflict recorded in `08_STEP_7B1_...md` and
  `09_STEP_7B2_...md` -- a dev server already running on port 3000
  holds a lock on `.next/trace`, producing `EPERM` on `next build`. All
  other checks above passed; the dev server was left untouched.
