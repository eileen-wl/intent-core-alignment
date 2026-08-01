# Step 7C-1 — VFX Review Work-Item Architecture — Final Report

**Repository:** `D:\25fall everything\26summer\intent-core-alignment-recovery`
**Branch:** `recovery/step7c2-functional-clean`
**Starting HEAD:** `98b532f` — `feat: align VFX workspace information architecture`
**Final commit:** `61e3707` — `feat: establish VFX review work-item architecture`
**Current roadmap step:** Step 7C-1 — VFX Workspace content-architecture correction
**Next roadmap step:** Step 7C-2 — final Intent Workspace visual implementation

## 1. Repository, branch, starting HEAD

Verified before any change: correct path, branch `recovery/step7c2-functional-clean`, HEAD exactly `98b532f` (confirmed to exist), tracked tree clean except the 5 untracked root-level ZIP archives, both stashes intact.

## 2. Files created / modified

**Created**
- `apps/web/src/features/vfx/review-inbox/workItem.ts` — model + adapter + architecture note
- `apps/web/src/features/vfx/review-inbox/workItem.test.ts`
- `apps/web/src/app/vfx/WorkItemRow.tsx`
- `apps/web/src/app/vfx/WorkItemRow.module.css`

**Modified**
- `apps/web/src/app/vfx/VfxWorkspacePage.tsx` + `VfxWorkspacePage.test.tsx`
- `apps/web/src/app/vfx/inbox/ReviewInboxPage.tsx` + `ReviewInboxPage.test.tsx`

Nothing else touched (verified via `git status`).

## 3. Real focus types discovered

Source: `apps/api/src/intent_core_api/vfx_inbox/current_focus.py` + `packages/contracts/python/src/intent_core_contracts/api/vfx_inbox.py` (Python and generated TS contracts in sync).

Six locked types, in precedence order:

1. `core_anchor_gate_pending`
2. `core_anchor_draft_needs_review`
3. `alignment_not_followed_by_anchor_action`
4. `re_anchor_proposal_present`
5. `assessment_generation_available`
6. `none` (never actionable)

Each `VfxInboxItemRead` carries exactly one `current_focus` plus 0–2 `next_candidates`, a real `sort_rank`, and independent Project / Shot / Task / Version / `core_anchor_state` / `shot_source` fields — no hidden fields beyond what's documented.

## 4. Review work-item model

`ReviewWorkItem` (in `workItem.ts`):

- `id` — always `${sourceType}:${sourceId}` (for `current_focus`, additionally folds in `focusType`); never `shotId` alone
- `sourceType` — extensible union: `current_focus | version_review | assessment | proposal | conflict | escalation | acknowledgement`
- `sourceId`, `category`, `title`, `explanation`, `sortRank`, `actionLabel`
- optional `status`, `project`, `shot`, `task`, `version`, `coreAnchorState`
- `route`

## 5. Current-focus adapter mappings

| `focus_type` | Category | Route |
|---|---|---|
| `core_anchor_gate_pending` | Core Anchor confirmation | Intent |
| `core_anchor_draft_needs_review` | Draft review | Intent |
| `alignment_not_followed_by_anchor_action` | Alignment interpretation | Shot Overview |
| `re_anchor_proposal_present` | Alignment interpretation | Shot Overview |
| `assessment_generation_available` | Attention required | Shot Overview |
| `none` | never creates a work item | — |

`title` / `explanation` are passed through verbatim (already honest).

**Important finding:** the backend's own `target_route` for the three alignment-family types still points at `/vfx/shots/:id/alignment`, which does not exist until Step 7C-3. The adapter deliberately does not forward it, re-deriving the destination from the locked route rule instead.

## 6. Step 7C-3 multi-source extension boundary

Documented as a module-level doc comment in `workItem.ts` (not a separate `docs/step-7` file, to avoid implying a new roadmap step): future adapters for Version/Review Note, Assessment, Proposal, conflict, escalation, and acknowledgement will each independently produce `ReviewWorkItem[]` from their own real objects/ids and concatenate into the same flat collection. Both Workspace Home and Review Inbox already consume that flat shape, so neither needs to change shape when Step 7C-3 lands.

## 7. Workspace Home — final structure

1. **Production overview** — 4 distinct `SummaryCard`s: Total Shots / Requiring attention / Human review required / No Core Anchor. The old duplicative "Attention needed" (medium-signal) card is gone.
2. **Priority actions** — ≤3 `ReviewWorkItem`s via `WorkItemRow`; required action leads, Shot is secondary context; honest empty state.
3. **Production snapshot** — compact `StatusBadge` distribution: Confirmed / Draft pending review / No Core Anchor.
4. **Important Shots** — ≤3, Shot-led `InboxRow`, routes to `/vfx/shots`.

No Recent Decisions / Activity section added.

## 8. Review Inbox — final Step 7C-1 structure

Consumes `adaptCurrentFocusToWorkItems(inbox.items)` directly — no raw Shot rows. Each row: category → required-action title → explanation → Project/Shot/Task/Version/Core-Anchor-state/ftrack context → contextual link. Supports multiple work items referencing the same Shot (proven by test). Honest "Review Inbox is clear" empty state with a route to Shots.

## 9. Route-target rules (locked, shared by both pages via the adapter)

- Core Anchor confirmation/draft work → Intent (`/vfx/shots/:id/intent`)
- Every other currently supported work item → Shot Overview (`/vfx/shots/:id`)
- Never `/versions`, `/alignment`, or `/activity`

## 10. Shots preservation

Zero diff in `apps/web/src/app/vfx/shots/**` (confirmed via `git status`). Shot-led rows, Project/Core-Anchor-state/Task filters, the uninitialized Shot, and both empty/no-results states are untouched.

## 11. Empty-state results

- **Workspace Home:** "No priority actions require your attention" (overview/snapshot/Shots access remain visible) vs. "No Shots exist yet" (genuinely zero Shots) vs. `ErrorState` (fetch failure) — three distinct, honest states.
- **Review Inbox:** "Review Inbox is clear" + route to Shots vs. `ErrorState`.

## 12. Step 7C-2 preservation result

Zero diff in Core Anchor domain services/routers, Intent lifecycle actions, HumanGate/Decision persistence. `ShotOverviewPage.tsx` / `IntentWorkspacePage.tsx` untouched. Complete Intent test group (all five states) passed unchanged.

## 13. Backend tests

- Focused `test_vfx_inbox.py`: 12/12 passed
- Full suite: 743/743 passed
- No backend files were touched this task (confirmed via `git status apps/api`)

## 14. Frontend tests

- New adapter tests: 13/13
- New/updated Workspace Home: 13/13
- New/updated Review Inbox: 8/8
- Complete suite: **71 files / 517 tests, all passed** (includes Shots regression, sidebar, breadcrumbs, route tests, and the complete Intent test group, all unaffected)

## 15. Lint, mypy, typecheck, build

- `eslint .`: clean
- `tsc --noEmit`: clean
- `next build`: succeeded (exit 0) after killing a stale leftover `next dev` server (from an earlier, unrelated session) that was locking `.next/trace` and causing the first two build attempts to fail/hang — a local process cleanup only, no files touched
- `mypy .`: the same 32 pre-existing baseline errors as the prior task, all in files this task never touched — none new

## 16. Documentation added

The architecture note lives as a module-level doc comment in `workItem.ts` itself (Step 7C-1 source, Step 7C-3 extension boundary, "flat collection not a Shot collection" contract) — deliberately not a new numbered `docs/step-7/*.md` file, to avoid any appearance of adding a roadmap step.

## 17. Schema-migration conclusion

None required; `apps/api/migrations` diff is empty (no backend changes at all this task).

## 18. Preservation checks (all empty-diff-verified)

- Core Anchor domain services
- Core Anchor routers
- Intent lifecycle actions
- HumanGate/Decision persistence
- ftrack connector
- migrations
- Versions/Alignment/Activity (still no such routes)
- write-back policy
- role entry/route hierarchy (`/`, `/demo`, sidebar, breadcrumbs, ContextTabs)
- both stashes and all 5 ZIP archives untouched

## 19. Final commit

`61e3707` — `feat: establish VFX review work-item architecture`, 8 files changed (867 insertions, 128 deletions), on `recovery/step7c2-functional-clean`.

## 20. `git diff --check`

Clean, exit 0.

## 21. Final `git status --short`

```
?? icas-demo-alignment-correction-v4.zip
?? icas-demo-measured-correction-v3.zip
?? icas-demo-reference-code-patch.zip
?? icas-demo-visual-refinement-v2.zip
?? icas-intent-workspace-visual-patch-v1.zip
```

## 22. Confirmation

Nothing was pushed. Neither `stash@{0}` nor `stash@{1}` nor the older recovery source branch was touched at any point.
