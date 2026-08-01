# ICAS Step 7B-1 — Shared Design Foundation: Implementation Note

**Status:** Implemented on `feat/step7-role-aware-dashboard`, not yet merged
**Batch:** 1 of 8 (per `06_STEP_7_LOCKED_SOURCE_OF_TRUTH.md` §14)
**Scope:** Shared frontend design foundation only -- no role workspace, no
Demo flow, no backend change.

## What this batch added

All new files live under `apps/web/src/design/` (tokens, layout
primitives, shared components) and `apps/web/src/app/dev/ui-foundation/`
(the Development preview route). Nothing outside `apps/web` changed.

### Design tokens (`apps/web/src/design/tokens.css`)

CSS custom properties on `:root`, imported once from `globals.css`, with
a `prefers-color-scheme: dark` override block. Covers: page/panel/
elevated/muted surfaces, primary/secondary/muted text, subtle/strong
borders, the neutral human-authority tone (kept separate from
`--state-success`, which is reserved only for confirmed technical
success per source-of-truth §11), the violet Agent accent, the
blue/teal production-fact/ftrack accent, amber attention, red blocking,
grey historical, an 8-step spacing scale, radius, shadow, focus ring, a
typographic scale, and three content widths (reading/comparison/wide).
Breakpoints are documented as reference custom properties but repeated
as literal `px` values inside each component's `@media` rule, since CSS
custom properties cannot be interpolated into a media query condition.

The reading content width (`--content-width-reading: 45rem` / 720px)
intentionally matches the legacy `main { max-width: 720px }` rule so the
existing `/shots` smoke-test pages keep their current measure.

### Global visual foundation (`apps/web/src/app/globals.css`)

Added a `box-sizing: border-box` reset, token-driven body typography and
page background, a semantic heading scale (`h1`-`h6`), link/button/form
inheritance, a visible `:focus-visible` ring using the focus-ring token,
and a `prefers-reduced-motion: reduce` block that collapses animation
and transition durations. The pre-existing `main` rule was preserved
(now token-driven, same computed values), so the legacy pages render
unchanged.

### Layout primitives (`apps/web/src/design/layout/`)

`Container`, `ReadingColumn`, `ComparisonArea`, `Stack`, `Row`, `Grid`,
`Panel` (`panel` / `elevated` / `muted` tones), `Card`, `Divider`,
`Section`. Each is plain CSS Modules + typed React props (no styling
library added; the repository's existing plain-CSS convention was
extended with CSS Modules, which Next.js supports natively). Vertical
(`Stack`) and horizontal (`Row`) gap, and `Section` spacing, take a
shared `SpaceScale` (1-8) mapped to the `--space-N` tokens.

### Shared components (`apps/web/src/design/components/`)

`PageHeader`, `SectionHeader`, `SummaryCard`, `StatusBadge`,
`AuthorityLabel`, `MetadataRow`, `EmptyState`, `ErrorState`,
`PermissionState`, `LoadingSkeleton`.

- **`StatusBadge`** takes a fixed `status` enum (`neutral` / `active` /
  `confirmed` / `attention` / `blocking` / `historical` /
  `integration-ready` / `unavailable`) purely for visual treatment, plus
  a caller-supplied `label` string -- no production wording is
  hardcoded in the component itself.
- **`AuthorityLabel`** supports exactly the eleven variants required by
  source-of-truth §10 (`production-fact`, `human-intent`,
  `human-confirmed`, `ai-interpretation`, `ai-proposal`,
  `intent-signal`, `human-review-required`, `open-question`,
  `historical`, `integration-ready`, `read-only`). Unlike `StatusBadge`,
  the label text is fixed per variant -- this is the product's
  authority vocabulary, not free-form caller text. Every variant
  combines a colour token, a border style (`solid` / `dashed` /
  `dotted`), and a short decorative marker (`aria-hidden`, e.g. `FACT`,
  `AI`, `SIGNAL`) so no distinction relies on colour alone.
  `human-confirmed` deliberately uses the neutral tone, not green,
  matching the "green only for confirmed technical success" rule.
- **`EmptyState`** (`role="status"`), **`ErrorState`**
  (`role="alert"`), and **`PermissionState`** (no role, deliberately not
  styled as an error) are visually and semantically distinct so a page
  can tell "nothing here yet," "something failed," and "you can't see
  this" apart at a glance.
- **`LoadingSkeleton`** only animates its shimmer under
  `prefers-reduced-motion: no-preference`.

### Development preview (`/dev/ui-foundation`)

`apps/web/src/app/dev/ui-foundation/page.tsx` renders
`UiFoundationPreview.tsx`, a static, presentational demonstration of
every token, layout primitive, and shared component -- typography
scale, surface/accent swatches, reading column, comparison area, cards,
all eleven `AuthorityLabel` variants, all eight `StatusBadge` statuses,
`MetadataRow`, `EmptyState`/`ErrorState`/`PermissionState`,
`LoadingSkeleton`, a responsive grid, and keyboard-focusable example
controls. Labelled "Development preview" in its own heading and page
`<title>`. No link to it was added from the home page or any other
portfolio-facing surface, so it is reachable only by direct URL. Static
preview content only -- no fetched or persisted production state.

## What was intentionally not touched

- `/shots` legacy routes, the Role selector, and the Actor ID control
  (`ActorSelector.tsx`) are unchanged.
- No `/demo`, `/vfx`, `/cg`, or `/artist` route was created.
- No App Shell, role sidebar, role session, or role locking.
- No backend route, model, migration, or API contract change.
- No Agent, Anchor, HumanGate, or Version behaviour change.
- `packages/ui` (the workspace-reserved shared-UI package) was left
  untouched; this batch built the foundation directly in `apps/web/src`
  to use Next.js's built-in CSS Modules support without introducing a
  cross-package CSS build question.

## Deferred to Step 7B-2 and later batches

Per source-of-truth §14: App Shell and Demo identity (batch 2), shared
Signal/ftrack/authority components that depend on real data (batch 3),
then the VFX/CG/Artist core pages (batches 4-6), supporting pages and
legacy migration (batch 7), and Demo fixtures and final validation
(batch 8). This batch's components are the reusable substrate those
later batches will consume; none of their page-level logic exists yet.

## Validation

- Focused tests (new components + preview): 40/40 passed.
- Full frontend test suite: 192/192 passed (152 pre-existing + 40 new).
- TypeScript (`tsc --noEmit`): clean.
- ESLint: clean.
- Prettier (`--check`): clean.
- `git diff --check`: clean.
- Next.js production build: blocked by an environmental conflict, not
  a code defect -- a dev server already running on port 3000 held a
  lock on `.next/trace`, producing `EPERM` on `next build`. All other
  checks above passed; the dev server was left untouched per
  instructions not to stop unrelated user processes.

Base commit for this batch: `3717d40` (merge of Step 6, cross-role
alignment) on `feat/step7-role-aware-dashboard`.
