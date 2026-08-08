# ICAS Package C — Journey Mutation Audit Report

**Status:** Audit-only. No code was changed and no mutation endpoints were executed while producing this report (per `ICAS_PACKAGE_C_JOURNEY_REBASE_CLAUDE_HANDOFF.md` §16).

**Goal restated:** Before any Package C rebase code is written, identify exactly why the D1 journey mutates itself after Reset when the owner only navigates normal read pages, and evaluate the current implementation against the J0–J4 state machine defined in the handoff doc.

**Docs read:** `docs/PROJECT_CONTEXT.md`, `docs/PRODUCT_SCOPE.md`, `docs/GLOSSARY.md`, `docs/ROLE_PERMISSIONS.md`, plus the module contracts in `apps/api/src/intent_core_api/demo_seed/` (`router.py`, `d1_scenario.py`, `d1_journey.py`) and the read-path routers (`vfx_inbox`, `cg_inbox`, `artist_inbox`, `anchor_context`, `production_context`, `intent`, `versions_and_feedback`).

---

## 1–3. The exact causal path (root cause)

**The hidden mutation is not in any page GET handler. It's in role entry.**

`apps/web/src/app/demo/actions.ts` — `enterDemoRole()` (a Next.js Server Action fired the moment a user clicks the "VFX Supervisor" / "CG Supervisor" / "Artist" card on `/`) calls:

```
resolveD1DemoShotId()  →  POST /internal/demo/ensure-d1-scenario  →  ensure_d1_scenario(session)
```

`ensure_d1_scenario` (`demo_seed/d1_scenario.py`) is a **separate, older, still-live idempotent seed pipeline** that predates the Package C journey rebuild. It resolves/creates its own Version via `_resolve_or_create_version`, scoped by a marker prefix `D1_MARKER = "[ICAS Demo — D1]"` — which is a _different_ string from the Journey's own marker `D1_JOURNEY_MARKER = "[ICAS Demo — D1 Journey]"` ("`D1 Journey]`" is not a prefix match for "`D1]`"). So after `reset_d1_journey` deletes the D1_JOURNEY_MARKER versions, `ensure_d1_scenario`'s own lookup finds nothing and creates a brand-new legacy version on the **same canonical shot and same canonical "comp" task** (both pipelines target the identical `icas-demo:d1` / `icas-demo:d1:shot-010` / `icas-demo:d1:shot-010:compositing-review` external IDs — `d1_journey.py` literally imports `D1_TASK_EXTERNAL_ID` from `d1_scenario.py` as its "comp" task).

Once that legacy version exists, `ensure_d1_scenario` walks through:

- `_ensure_confirmed_core_anchor` / `_ensure_confirmed_execution_anchor` — no-ops, R1 anchors already exist and are reused.
- `_ensure_vfx_review(session, version)` — scoped to the **new legacy version**, none exists → creates a new `VFXSupervisorReview`.
- `_ensure_cg_review` — scoped to the execution anchor revision, which already has a review from the Journey's own `_evidence()` step → reused, no-op.
- `_ensure_artist_guidance(session, version, task)` — scoped to (legacy version, comp task), none exists → **creates the 4th `ArtistAgentGuidance`**.
- `_ensure_cross_role_assessment(session, shot, version, task)` — scoped only by `shot_id` ("does _any_ assessment exist for this shot"), none exists right after Reset → **creates `CrossRoleAssessment` #1**, via `DeterministicD1CrossRoleAssessmentGenerator`, which always attaches a `ReAnchorProposal` and (via `derive_intent_signal`) drives attention to `high`. This is **Proposal #1**.

So the "explicit Generate Cross-role Assessment" action from J1 is being silently replicated by role entry, because role entry still runs the legacy `ensure_d1_scenario` seed pipeline against the same canonical objects the new Journey state machine owns.

## 4. Why the UI showed "Completed / high attention" while `journey-status` reported `assessments = 0`

Both numbers are correct for what they each measure — the bug is in the counting logic, not just the write:

- `journey-status` (`inspect_d1_journey`) computes `counts["assessments"]` via `_result()`, which filters `CrossRoleAssessment.version_id.in_(version_ids)` where `version_ids` are **only** versions matching `D1_JOURNEY_MARKER`. The legacy assessment's `version_id` points at the `D1_MARKER` version, so it's invisible to this count → `assessments = 0`.
- The same `inspect_d1_journey` computes `proposal_count` by first finding `CrossRoleAssessment.task_id.in_(task_ids)` — **task-scoped, not version-scoped**. The comp task is one of the three canonical tasks, so the legacy assessment _is_ caught here → `proposals = 1`. Same story for `guidance_count` (`ArtistAgentGuidance.task_id.in_(task_ids)`) → `4`.
- Meanwhile the real product pages (`vfx_inbox/service.py`, Shot Alignment, etc.) query `CrossRoleAssessment`/`ReAnchorProposal`/`IntentSignal` directly by shot/task — no journey-marker filter at all — so they honestly render the row that really exists: a completed, high-attention assessment with a proposal.

There are two different bugs compounding: (a) a legacy ensure-pipeline still writes into the canonical Journey graph from a non-explicit path, and (b) the invariant-counter itself uses three inconsistent scoping keys (version-marker for assessments, task-id for proposals/guidance) so it can't even self-consistently detect the damage the first bug does.

## 5. Persistence relationships

```
CoreAnchorRevision(shot) ──┐
ExecutionAnchorRevision(task) ──┤
VFXSupervisorReview(version) ──┤→ CrossRoleAssessment(shot_id, task_id, version_id, core_anchor_revision_id, execution_anchor_revision_id)
CGSupervisorReview(exec_rev) ──┤        │
ArtistAgentGuidance(version,task) ┘      ├──1:0/1──▶ ReAnchorProposal(cross_role_assessment_id UNIQUE)
                                          └──1:1────▶ IntentSignal(cross_role_assessment_id UNIQUE)

AlignmentAssessment(version_id, core_anchor_revision_id)   ← unrelated sibling concept, single-version/single-anchor
                                                              alignment check, no relation to CrossRoleAssessment at all.
```

Structurally important: **none of `CrossRoleAssessment`, `ReAnchorProposal`, `VFXSupervisorReview`, `CGSupervisorReview`, `ArtistAgentGuidance` has a "current/historical" or "active" flag or pointer.** Every module docstring says so explicitly ("no active/latest pointer"). "Current" is purely an ad-hoc query-time concept, and every consumer (the Journey's own counter, the inbox loaders, the alignment page) currently defines "current" with a _different_ filter. That absence of a first-class "current" concept is why the doc's J0–J4 invariants ("current assessments = 0", "current guidance = 3") can't be reliably computed today — there is no schema-level way to distinguish a Journey-owned row from a legacy-seed row, or a superseded row from an authoritative one.

## 6–7. Comparison against J0–J4 and violations

| Doc requirement                                                                                                                                                            | Current state                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §6 "No mutation from role entry"                                                                                                                                           | **Violated.** `enterDemoRole` → `ensure_d1_scenario` runs on every role entry, not just first-time bootstrap.                                                                                                                                                                                                                                                                                                                                  |
| §7 Bootstrap vs Reset are different operations; "normal role entry should not run a … state-advancing bootstrap"                                                           | **Violated.** `ensure_d1_scenario` is exactly the state-advancing bootstrap the doc says role entry must not run, and it is wired directly into role entry.                                                                                                                                                                                                                                                                                    |
| §8 J0 exact invariants (assessments=0, proposals=0, guidance=3, …)                                                                                                         | Can be produced by Reset, but not preserved — see above.                                                                                                                                                                                                                                                                                                                                                                                       |
| §8 "Anything else → mixed. Do not hide inconsistencies by guessing."                                                                                                       | Partially honored (falls through to `"mixed"`), but the counts backing that verdict are themselves internally inconsistent (see §4), so `"mixed"` can under-report what actually changed.                                                                                                                                                                                                                                                      |
| §9 referential graph invariants ("current proposal must never exist with current assessment count = 0 unless the domain explicitly models the distinction and reports it") | **Violated as observed** — proposals=1 with assessments=0, and nothing in the status payload explains _why_ that split exists; it reads as a bug, not a modeled distinction.                                                                                                                                                                                                                                                                   |
| §10 read-purity                                                                                                                                                            | The GET/page-loader layer itself (`vfx_inbox`, `cg_inbox`, `artist_inbox`, `anchor_context`, `production_context`, `intent` GET routes, `versions_and_feedback` GET routes) is clean — no `generate_`/`ensure_`/`create_` calls wired to any `@router.get`. The violation is one layer up, in the Next.js Server Action invoked by clicking a role card, which is conceptually "role entry," i.e. exactly the surface §10 requires to be pure. |
| §13 developer endpoints only, no user-facing controls                                                                                                                      | Endpoints match the doc (`reset-journey`, `load-completed-journey`, `journey-status`), but `/internal/demo/ensure-d1-scenario` is a **fourth**, still-live internal endpoint from the pre-Package-C design that the Journey rebase doesn't own or gate the same way (no `_require_d1_journey_tools_enabled()` check, unlike the three Journey endpoints).                                                                                      |

No evidence was found of hidden mutation in the deterministic-role read routers themselves (`anchor_context`, `vfx_inbox`, `cg_inbox`, `artist_inbox`, `production_context` GETs, `intent` GETs) — every `generate_*`/`create_*`/`confirm_revision` call in `intent/router.py` and `versions_and_feedback/router.py` sits behind a `@router.post`. `production_context/router.py` has writes, but only inside its own `POST /projects|/shots|/tasks` handlers; its `GET` handlers are plain selects.

## 8. Smallest correction plan (proposed, not yet implemented)

The minimal fix does not require inventing new states — it requires cutting the one wrong edge and tightening one counting scheme:

1. **Stop `enterDemoRole` from calling `ensure_d1_scenario`.** Role entry should only set the role cookie and redirect. If a first-time-bootstrap guarantee is still wanted for a genuinely empty database, it belongs behind an explicit, idempotent-but-non-destructive bootstrap check that a normal Reset/dev-server-start runs once — not something re-triggered by every browser role selection. This alone removes the entire causal chain in §1–3.
2. **Stop `d1_journey._canonical_root` from depending on the legacy `ensure_d1_scenario` pipeline** for its Project/Shot resolution. It only needs `find_linked_entity_id` for the `D1_PROJECT_EXTERNAL_ID`/`D1_SHOT_EXTERNAL_ID`, the same lookup `inspect_d1_journey` already uses — it doesn't need the legacy version/review/guidance/assessment side effects at all, since `_delete_journey_records` immediately erases them anyway. This removes the wasteful create-then-delete churn on every Reset and, more importantly, removes the _only_ other call site of `ensure_d1_scenario` touching canonical D1 objects.
3. **Decide the fate of `ensure_d1_scenario`/`d1_scenario.py` itself.** Per §14 (legacy data policy), Shot 020 and Shot 030 fixtures inside that same module must be kept. But the _rich_ D1_SHOT_EXTERNAL_ID scenario built by `ensure_d1_scenario` (project/shot/comp-task/version/anchors/reviews/assessment) now collides identity-for-identity with the Package C canonical Shot 010. Once (1) and (2) land, nothing should call the rich half of `ensure_d1_scenario` anymore — it should either be deleted or reduced to just the Shot 020 / Shot 030 fixtures, deferred to the "separate dependency audit" §14 already asks for.
4. **Give "current" a real, single definition.** Rather than three different ad-hoc scopes (version-marker, task-id, shot-id), the invariant checker should compute every J0–J4 count from one consistent, explicit graph walk rooted at the three canonical Task ids (or better, a `journey_owned` flag/marker applied consistently at creation time across every row type the Journey creates). This directly fixes the assessments=0/proposals=1 paradox and makes `"mixed"` mean something diagnosable instead of masking a real defect.
5. Re-run the reset → role-entry → journey-status sequence and add it as the first read-purity test from §10 before any other Package C work continues.

Items 1–2 are the smallest, lowest-risk fix and would resolve the owner-reported bug on their own; items 3–5 are the structural hardening the rebase doc's state-machine design asks for.
