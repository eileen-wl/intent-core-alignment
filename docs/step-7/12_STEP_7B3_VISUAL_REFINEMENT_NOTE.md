# ICAS Step 7B-3 — Visual Refinement Note

**Status:** Implemented on `feat/step7-role-aware-dashboard`, not yet committed
**Scope:** Visual-only refinement of the Step 7B-3 semantic components and
the `/dev/semantic-components` preview -- no domain logic, data mapping,
routes, or behaviour changed.
**Base:** Step 7B-3 Shared Semantic Components (uncommitted, on top of
`5384c26`)

## 1. Visual problems addressed

Per the owner's assessment of the first-pass preview:

- typography too small, especially for primary conclusions;
- weak hierarchy between conclusion, explanation, and metadata;
- too many repeated pale `Card`/`Panel` rectangles with identical
  weight for primary and secondary content ("cards inside cards");
- the amber attention colour repeated as large uniform blocks (Intent
  Signal banners) and as heavy dashed boxes (empty/unavailable states),
  reading as monotonous rather than a controlled accent;
- the result read as an engineering component library, not a product
  system with a coherent visual grammar.

## 2. Typography changes

No design-token *values* changed (the existing 12/14/16/20/24/32px
scale was already within the requested 14-16px body / ≥12px metadata
range) -- the fix was reassigning which token each element uses, and
strengthening the weight/size gap between hierarchy levels:

- `AuthorityLabel` (`design/components/AuthorityLabel.module.css`): the
  semantic text (`.text`) now inherits `--font-size-sm` (14px, up from
  12px) instead of the compact `.label` base; the decorative `.marker`
  (e.g. `SIGNAL`, `AI`) got its own explicit `--font-size-xs` (12px) so
  it stays a genuinely compact marker while the label text it
  introduces reads at body size. This is the one token-usage change
  broad enough to touch a 7B-1 primitive; it only affects the
  `/dev/ui-foundation` preview and the Step 7B-3 semantic family today
  (no portfolio-facing page uses `AuthorityLabel` yet), so the change
  is safe per the brief's "does not unexpectedly damage 7B-1/7B-2
  surfaces" condition.
- `IntentSignalCard` conclusion: `--font-size-lg` (20px), weight 700 --
  up from an unstyled inherited 16px.
- `IntentSignalDetail` conclusion: `--font-size-xl` (24px, up from
  `lg`/20px) -- the single largest text on the page, since this is the
  most detailed, most-read view.
- `IntentSignalBanner` conclusion: `--font-size-md` (16px) explicit
  weight 700, instead of relying on default cascade weight alone.
- Section titles (`IntentSignalDetail`, `EvidenceProvenanceDrawer`)
  changed from unstyled `<h4>` to an explicit 700-weight `--font-size-sm`
  treatment, distinguishing "section title" from "component title" from
  "conclusion" as three distinct steps rather than two.
- Metadata (`MetadataRow`, technical IDs) was already at `--font-size-xs`
  (12px) / `--font-size-sm` (14px) and is unchanged -- it was already at
  the floor the brief asks for, not the source of the "too small"
  complaint.
- Uppercase micro-labels reduced to their intended use: `AuthorityLabel`'s
  marker and driver-priority tags remain uppercase (genuinely compact
  semantic markers); `MetadataRow` labels remain uppercase (short
  single-word field names like "CREATED", by design already a compact
  marker); no *new* uppercase text was introduced, and prose text
  (summaries, explanations, statements) is never uppercase.
- Prose width: `IntentSignalCard` description capped at `42ch`,
  `IntentSignalDetail` summary and `IntentSignalBanner` explanation
  capped at `60ch`, so long sentences do not stretch the full grid-cell
  or panel width.

## 3. Surface and card-system changes

Replaced repeated `Card`/`Panel` boxes with a small set of shared
structural treatments, applied consistently rather than as one
repeated template:

- **Left accent bar** -- a 3px coloured left border on an otherwise
  plain surface, used for: `AuthorityBoundary` (tone-coloured: neutral
  for human, violet for Agent, amber for confirmation-required),
  `IntentSignalCard` (amber only when attention is genuinely present),
  `IntentSignalDetail` (amber/grey/neutral by state),
  `IntentSignalBanner` (replacing the previous full-surface amber
  block), `FtrackObjectLinkage` (teal when linked, grey when not).
  This is the single shared rule producing visual consistency across
  four different component families without four different card
  templates.
- **Compact inline notices** -- `AgentRunReference`'s failed state and
  `IntegrationAvailabilityNotice`'s failed state now use a small
  red-accent-bar row instead of the full `ErrorState` card, so a
  failure is visible without the entire Evidence area (or the whole
  ftrack notice) reading as one large red block.
  `IntegrationAvailabilityNotice`'s "not requested" state (the common
  case) dropped the padded, dashed-border `EmptyState` card for a
  single muted inline sentence -- a one-line fact no longer gets a
  large empty card.
  `EvidenceSourceList`'s empty state similarly dropped `EmptyState` in
  favour of one inline sentence, since it already sits inside
  `EvidenceProvenanceDrawer`'s own border (avoiding a card inside a
  card).
- **Dividers over duplicate cards** -- the Development preview's six
  Intent Signal levels and the ftrack section now use `Divider`
  between sub-groups instead of wrapping every example in its own
  `Panel`.
- **One elevated comparison, not six** -- `Panel` is now reserved in
  the preview for the one place a real boundary matters: the latest-
  vs-historical `IntentSignalDetail` comparison. Authority and ftrack
  component demonstrations render directly (each already carries its
  own accent-bar boundary), removing "cards inside cards."
- `IntentSignalIndicator` no longer reuses the `StatusBadge` pill --
  levels 1 (global indicator) and 4 (list-row badge) previously looked
  identical; the indicator is now a minimal dot-plus-text row, visually
  distinct from the badge chip, matching their different product roles
  (a quiet top-bar marker vs. a list-row chip).

## 4. Intent Signal hierarchy refinements

All six presentation levels keep their approved semantic roles;
`intentSignalModel.ts`'s wording/tone functions are untouched.

- **Global indicator**: minimal dot + text, no pill, no count -- reads
  as a state marker, not a notification badge.
- **Tray**: gained an optional, presentational `historical?: boolean`
  field on `IntentSignalTrayItem` (caller-supplied, not a new domain
  field) so a tray can show a current signal and a superseded one in
  the same list, each row separated by a hairline divider, historical
  rows carrying a small "Historical" tag and a muted dot.
- **Homepage card**: restructured to lead with the conclusion (large,
  bold), then the explanation, then a new optional `contextLabel` prop
  (what object this relates to), then a footer row holding the
  "Intent Signal" authority marker and the optional next-step link --
  the marker now supports the conclusion instead of sitting above it
  competing for attention.
- **List-row badge**: unchanged in structure (already the right
  treatment: a small pill, not repeating other row content).
- **Contextual banner**: converted from a full-width amber block to a
  left-accent strip on a neutral surface; amber only applies when
  attention is genuinely present (medium/high), never for `low`
  attention or the honest empty/unavailable states.
- **Detail view**: regrouped in the brief's requested order --
  conclusion, attention-level facts (in a bordered "facts" `MetadataRow`),
  role coverage, drivers (each now a scannable head row: code + a small
  uppercase priority tag, summary, source), caveats, then a new optional
  `provenance?: ReactNode` composition slot (the Signal itself has no
  AgentRun/ContextSnapshot fields -- those belong to the parent
  CrossRoleAssessment, so the caller composes an `EvidenceProvenanceDrawer`
  there when they have that data). The whole view gained a left accent
  bar (amber/grey/neutral) so current vs. historical is visible before
  reading any text, while historical text itself stays full-contrast
  (never dimmed to the point of being hard to read).

Role-specific wording (`Human review required` / `Execution
clarification required` / `Supervisor clarification pending`) and its
low-attention fallback are unchanged -- verified by the pre-existing
`intentSignalModel.test.ts` suite, which passes unmodified.

## 5. Authority refinements

`AuthorityBoundary` became the one shared shell for `HumanDecisionNotice`,
`AgentAdvisoryNotice`, and `ConfirmationRequiredPanel` (previously each
built its own ad hoc layout around the primitive). It now takes a
`tone: "human" | "agent" | "attention"` plus a `label` slot (the
`AuthorityLabel` instance) and renders: a tone-coloured left accent bar,
the authority-type marker, a prominent owner statement, then a bordered
metadata/detail region -- one consistent visual grammar for owner,
authority type, state, and supporting detail, per the brief. Tone only
changes the accent-bar colour, never the surface background or the
statement's font weight, so **human authority is not represented by a
stronger colour than Agent advisory** -- both are equally restrained,
just different hues (neutral-dark for human, violet for Agent, matching
the existing `AuthorityLabel` vocabulary). `ReadOnlyAuthorityNotice`
keeps its existing `PermissionState` reuse (already visually distinct
via its dashed border, appropriately different from the confirmed/
advisory family). `ConfirmationRequiredPanel`'s gate-type value is now
humanized ("Core Anchor confirmation" instead of the raw
`core_anchor_confirmation` enum) as a small readability improvement, not
a data change. No mutation control was added anywhere in the family --
verified by `authorityDistinction.test.tsx` and
`ConfirmationRequiredPanel.test.tsx`/`AgentAdvisoryNotice.test.tsx`'s
existing "no button" assertions, which still pass.

## 6. Evidence and Provenance refinements

- `SourceReference`: two-line layout -- the human-readable label on its
  own line, the humanized source type and the source id (restrained
  monospace) on a secondary muted line below, so the label reads first
  without competing with the technical detail.
- `EvidenceProvenanceDrawer`: the summary row gained an explicit
  chevron indicator that rotates on `details[open]` (not relying solely
  on the native marker, which renders inconsistently across platforms)
  and an evidence count ("3 sources"), so open/closed state and
  "is this worth opening" are both visible before expanding.
- `AgentRunReference`: a failed run now renders as a compact red-accent
  row (not the full `ErrorState` card) so a failure is visible without
  the whole Evidence area reading as red; a missing run/snapshot
  renders a small muted sentence instead of unstyled default text.
  `ContextSnapshotReference` never renders `payload` -- unchanged.
- No prompts, credentials, environment values, or secrets are exposed
  anywhere in this family -- unchanged (nothing here ever had access to
  them; `AgentRunRead.error` is already sanitised server-side before it
  reaches the frontend).

## 7. ftrack linkage refinements

`FtrackObjectLinkage` gained a left accent bar (teal when linked, grey
when not) so the linked/not-linked distinction -- the most important
one per the brief -- reads before the supporting sentence.
`IntegrationAvailabilityNotice`'s write-back states were rebalanced so
write-back stays visually secondary to object linkage: "not requested"
(the common case) is now one muted sentence instead of a padded empty
card; "failed" is a compact red-accent row matching `AgentRunReference`'s
treatment (visual consistency across families, not a shared component);
"pending"/"succeeded" remain the existing compact `StatusBadge`.
`FtrackSyncSummary`'s "not yet run" state got the same muted-sentence
treatment. No new ftrack states were introduced and no active control
(`Launch from ftrack`, `Sync now`, `Retry`, `Write back`, `Configure`)
exists anywhere in the family -- verified by the existing
`IntegrationAvailabilityNotice.test.tsx` "never renders ... execution
control" assertion, which still passes.

## 8. Development preview changes

- The fixture warning (`Development fixture — not live production
  data`) changed from a heavy amber dashed box to a small neutral pill
  -- it is a development note, not a product attention state, and was
  itself one of the sources of "repeated amber."
- Added a compact local section index (a `<nav>` of anchor links to
  Intent Signal / Role wording / Failure states / Authority / Evidence
  & Provenance / ftrack linkage) -- plain text links, no navigation
  framework, no fake sidebar.
- Each of the six Intent Signal levels now has a one-line usage hint
  explaining its intended placement, and sub-groups are separated by
  `Divider` instead of six more `Panel` boxes.
- `SectionHeader` descriptions added to every major section explaining
  what it demonstrates and why, per the brief's "short section
  descriptions only where they help explain intended usage."
- Authority and ftrack component demonstrations no longer sit inside an
  extra `Panel` wrapper (each component now carries its own boundary).
- Still a component gallery: no application shell, no sidebar, no top
  bar, no fake role dashboard was added.

## 9. Preserved behavioural and domain boundaries

Unchanged, and verified by the full pre-existing test suite passing
unmodified except where an accessible-query needed updating for a
structural change (see §11 of the task -- five pre-existing tests
adjusted for new DOM shape, zero for behaviour):

- Intent Signal data mapping (`intentSignalModel.ts`) -- not edited.
- Role-specific Signal wording and its low-attention fallback rule --
  not edited.
- Authority ownership rules (Core Anchor -> Human VFX Supervisor,
  Execution Anchor -> Human CG Supervisor, Artist read-only) -- not
  edited, still explicit in rendered text.
- Agent advisory-only rule -- still no mutation control anywhere.
- Evidence domain mapping (`evidenceModel.ts`, `EvidenceReferenceLike`)
  -- not edited.
- ftrack state mapping (`RecordSource`, `WritebackRecordRead.status`)
  -- not edited; no new states invented.
- Development fixture isolation -- fixtures still live only in
  `fixtures.ts` / `intentSignalTestFixtures.ts`; `portfolioNavigation.test.ts`
  still confirms no portfolio route links to the preview.
- Route behaviour, middleware, Demo identity, backend code, API
  contracts, generated OpenAPI schema, database schema, Agent
  behaviour -- none touched.

## 10. Remaining visual work deferred to Step 7C and Step 7D

- Placing these refined components inside real VFX/CG/Artist pages,
  where real layout constraints (sidebar width, contextual tabs) will
  likely require further placement-specific adjustment.
- A live-data pass once real `IntentSignalRead`/`WritebackRecordRead`
  values flow through these components instead of fixtures -- some
  drivers/caveats lists may be longer or shorter than the fixtures used
  here, and the layout should be re-checked against real distributions.
- Dark-mode visual QA of the new accent-bar treatments (the existing
  dark-mode token overrides apply automatically, but this batch did not
  do a dedicated dark-mode visual pass).
- Any accessibility audit beyond the automated/behavioural checks in
  this batch (e.g. a manual screen-reader pass) -- deferred to Step 7D
  per the locked implementation sequence.

## Automated validation

- Focused Step 7B-3 tests: 99/99 passed (27 test files -- 94 pre-existing
  plus 5 new structural tests: `IntentSignalCard` context/DOM-order,
  `IntentSignalTray` historical labelling, `IntentSignalDetail`
  conclusion-order and provenance slot, plus the preview's local-index
  test).
- Full frontend test suite: 370/370 passed (271 pre-existing-before-7B3
  + 99 semantic/preview).
- TypeScript (`tsc --noEmit`): clean.
- ESLint: clean.
- Prettier (`--check`): clean.
- `git diff --check`: clean.
- Next.js production build: not attempted this batch. The frontend dev
  server was active on port 3000 for the duration of this work, and
  every prior attempt to run `next build` against a live dev server in
  this repository has produced an `EPERM` lock on `.next/trace`
  (recorded in `08_STEP_7B1_...md`, `09_STEP_7B2_...md`, and
  `11_STEP_7B3_...md`); this batch also touched no build-relevant code
  (no routes, no server components -- only presentational component and
  CSS changes), which the full Vitest suite and `tsc` already exercise
  directly. Per this task's instruction not to run the build if it
  would conflict with the active server, it was skipped rather than
  repeat a known conflict.
