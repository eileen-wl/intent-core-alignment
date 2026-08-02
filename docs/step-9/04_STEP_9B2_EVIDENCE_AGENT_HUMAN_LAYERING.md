# Step 9B-2 — Production Evidence / Agent Interpretation / Human Decision Layering

**Status:** Implementation and automated validation complete. Owner visual validation pending.
**Branch:** `feat/step9b2-evidence-agent-human-layering`
**Starting HEAD:** `9997477`
**Companion documents:** `docs/step-9/01_STEP_9_PRESENTATION_AND_COMPREHENSION_BASELINE.md` (locked baseline), `docs/step-9/02_STEP_9A_CURRENT_STATE_AND_IMPLEMENTATION_MAP.md` §7 (the Evidence/Agent/Human layering map this implementation follows), `docs/step-9/03_STEP_9B1_ROLE_AWARE_WORKING_DIRECTION.md` (the authority vocabulary and shared component pattern this step reuses), `docs/IMPLEMENTATION_STATUS_AND_ROADMAP.md` §L.

---

## 1. Scope and completion status

**Step 9B-2 is complete: the six locked priority pages** — VFX Intent, VFX Alignment, CG Execution, CG Version Review, Artist Current Version, Artist Feedback History — **now group their existing content into three explicit, consistently-labelled explanatory layers**: Production Evidence, Agent Interpretation, and Human Decision and Provenance. This is a presentation and comprehension pass over data every page already fetched (per `02_STEP_9A_...md` §7's own finding) — no new authoritative domain object, no new Agent workflow, no ftrack or Step 8 acceptance data touched.

One small, additive frontend change was needed beyond pure regrouping: `features/cg/execution-workspace/data.ts` now also fetches the confirmed Execution Anchor's real `confirm_execution_anchor` Decision, reusing the exact `GET /intent/execution-anchor-revisions/{id}/decisions` endpoint Step 9B-1 already added and role-gated — no new backend endpoint, no new contract type, no migration (§11).

Not started, per this task's explicit scope: Step 9B-3 (Department Execution Overview), Step 9B-4 (media/thumbnail), Step 9C (visual-system unification).

---

## 2. Locked IA and authority boundaries

No route, sidebar item, tab, or page responsibility was added, removed, or renamed. Every page's existing `ContextTabs` array, breadcrumb structure, and `AppShell`/sidebar wiring is byte-for-byte unchanged — confirmed directly in the diff, which touches only: the six page components' internal JSX grouping, one loader (`execution-workspace/data.ts`) and its `page.tsx`'s identity resolution, and new shared presentation files.

Authority is preserved exactly as it was:

- No Anchor confirm/reject/edit control was added, removed, or moved. VFX Intent's `CoreAnchorRevisionEditor` and CG Execution's `ExecutionAnchorEditor` — the two active decision-making surfaces on these six pages — are deliberately **not** wrapped in any Evidence Layer Section: an in-progress edit/confirm/reject control is an *action* surface, not a passive information layer, and wrapping it would blur exactly the distinction this step exists to sharpen. Both editors are unchanged from Step 7C-2/7C-4, and every existing interaction test for both (24 + 8 tests) still passes unmodified.
- `GenerateArtistGuidanceButton` (Artist Current Version) and the CG Version Review escalate/generate actions are unchanged and remain reachable exactly where they were — the former is deliberately kept *inside* its Agent Interpretation section (requesting more Agent output is not itself a Human Decision, unlike Confirm/Reject), the latter stays outside any layer section entirely (§6).
- CG's read of the Execution Anchor confirm Decision reuses the **exact same role gate** Step 9B-1 added (`_EXECUTION_ANCHOR_DECISION_READERS = {cg_supervisor, vfx_supervisor}`, `docs/ROLE_PERMISSIONS.md` §2) — VFX read access to this data was already authorized in 9B-1 and is not newly exercised by a VFX-facing caller here either. No role gained new read access, and no role's write authority changed.
- Artist gains no new Decision/HumanGate visibility. Artist Current Version's Human Decision and Provenance section states only that the Core/Execution Anchors are confirmed and who owns them (VFX Supervisor / CG Supervisor) — it does not surface confirmation rationale, actor id, or timestamp, matching the pre-existing, unchanged role boundary (`02_STEP_9A_...md` §5: "Anchor confirmation Decision/rationale is not surfaced to Artist at all currently, an intentional boundary, not a gap").

---

## 3. Shared three-layer presentation model

**`apps/web/src/design/components/EvidenceLayerSection.tsx`** (+ `.module.css`) — the one new shared component, registered in the `@/design` barrel export. A thin heading-and-content wrapper, not a data model:

```ts
export type EvidenceLayerKind =
  | "production-evidence"
  | "agent-interpretation"
  | "human-decision";
```

Each `kind` renders a fixed, non-overridable title and one-line question via the existing `SectionHeader` component (Step 9B-1's own primitive, `title`/`description`/`actions`/`level` props, unchanged):

| `kind` | Title | Question |
|---|---|---|
| `production-evidence` | Production Evidence | What actually happened or is currently recorded? |
| `agent-interpretation` | Agent Interpretation | What does the Agent infer from that evidence? |
| `human-decision` | Human Decision and Provenance | What did an authorised person decide, and why? |

A `data-evidence-layer` attribute on the rendered `<section>` makes each layer's kind distinguishable in the DOM directly, not only by colour — the basis for every "grouped under the right heading" test in §13. An optional `className` lets a caller keep an existing layout class (e.g. `ConfirmedAnchorSummary.module.css`'s `.mainCard` CSS Grid item) on the section itself, so no already-tested grid had to be restructured to adopt this component (§5). An optional `headingLevel` (`2 | 3`) lets a nested usage (inside an already-`<h2>`-headed card) use `<h3>` instead, matching `SectionHeader`'s own existing convention.

**`apps/web/src/lib/decisionProvenance.ts`** — `decisionProvenanceItems(decision: DecisionRead): { label: string; value: string }[]`, the standard `MetadataRow` items (Actor role, Rationale, Decided at, and Supersedes when applicable) for a real `Decision`'s Human Decision and Provenance block. Reused by VFX Intent (already existed via `HumanDecisionNotice`, unchanged) and newly by CG Execution (§7); never fabricates a rationale when none was recorded (`rationale || "No rationale was provided."`, matching the exact existing VFX Intent copy).

**`apps/web/src/lib/feedbackEventLayer.ts`** — `feedbackEventLayer(eventType: ArtistFeedbackEventType): EvidenceLayerKind`, a pure lookup table classifying each of the eleven real `ArtistFeedbackEventType` values (§10).

Every field the task's shared-model requirement names is expressed, but not all as one generic renderer — most pages' existing content (`MetadataRow`, finding lists, note lists, `AuthorityLabel`) already carried label/value/detail/provenance shape from Step 8/9B-1 and is reused as `EvidenceLayerSection`'s `children`, per the task's own "reorganise existing content" instruction, rather than being flattened into a new generic item array that would have discarded page-specific structure (drift-risk lists, finding priority badges, note author/timestamp lines) for no comprehension benefit. `sourceId`-shaped values are never rendered as visible text anywhere in this step, matching Step 9B-1's convention exactly (§9).

No three-equal-width-column layout was built anywhere — every page stacks its layers vertically (or, for VFX Intent's `ConfirmedAnchorSummary`, keeps its existing two-column card grid, with each card individually re-labelled in place, §5).

---

## 4. Classification rules

Applied identically across all six pages (deviating only where a page's own real data genuinely differs, noted per-page below):

- **Production Evidence**: confirmed Anchor content (concise, never the second full duplicate — §5), Production Version, ReviewNote (always, regardless of whether its author is human or ftrack-external — a ReviewNote is never promoted to Human Decision merely because a human wrote it), Task/Shot/Project context, Dependency, structural escalation records.
- **Agent Interpretation**: `CrossRoleAssessmentRead` (findings, tensions, risks, re-anchor proposal content), `ArtistAgentGuidanceRead`, `CGSupervisorReviewRead`, Intent Signal output, drift risks (an interpretive risk-identification category, not a plain fact, per `01_...md` §2.3's own grouping), any Agent-authored draft content, `AgentRun` provenance. Never labelled confirmed merely because a human has viewed or is currently editing it.
- **Human Decision and Provenance**: `HumanGateRead`, `DecisionRead` (actor role, rationale, decided-at, supersession — via `decisionProvenanceItems`), a confirmed Anchor's confirmation event specifically (as distinct from its content, shown concisely in Production Evidence — §5's non-duplication rule), a real acknowledgement/resolution action. **Never manufactured** from a ReviewNote, a Version status label, the presence of an action button, a pending review, or an Agent recommendation (§8) — where no real Decision exists for a page's specific context, the layer states so honestly (VFX Alignment §6, CG Version Review §8) rather than being omitted silently, since an explicit "no Decision recorded" statement is itself informative here (the alternative — silently vanishing a whole layer — reads as an omission bug, not an honest absence, on a page where the other two layers are always present).
- **Action layer (explicitly outside all three)**: `current_focus`-derived pending work, unchanged from Step 9B-1 — not re-touched by this step, and never mistaken for a completed Human Decision anywhere in the new grouping.

---

## 5. VFX Intent implementation

**File:** `apps/web/src/app/vfx/shots/[shotId]/intent/IntentWorkspacePage.tsx` + `ConfirmedAnchorSummary.tsx`.

- **Production Evidence**: `ConfirmedAnchorSummary`'s existing `mainCard` (the confirmed revision's `core_summary`/`shot_objective`/`emotional_tone`/`visual_focus`, the expandable Constraints/Variation Zones/Drift Risks/Open Questions/References, revision number, Active badge) is now wrapped in `<EvidenceLayerSection kind="production-evidence" className={styles.mainCard} headingLevel={3}>` — the existing `.mainCard` grid-item class is preserved via `className`, so the two-column `ConfirmedAnchorSummary` grid is completely unchanged structurally; only a new "Production Evidence" heading and question now appear inside the card, above the pre-existing "Core Anchor confirmed" heading (kept, not removed — both convey different information: the layer category, and this specific revision's confirmed status).
- **Human Decision and Provenance**: the existing `supportingCard`'s "Decision recorded" block (`HumanDecisionNotice`, supersession note, evidence-count line, next-step statement) is now wrapped in `<EvidenceLayerSection kind="human-decision" className={styles.supportingCard} headingLevel={3}>`. The confirming Decision's real rationale (`confirmedDecisionRationale`, already fetched, unchanged) renders only here — never duplicated inside Production Evidence.
- **Agent Interpretation**: `IntentEvidenceDisclosures` (the Evidence/Provenance drawer plus Intent Decomposition/Context Reconstruction disclosure — unchanged internally) is now wrapped in `<EvidenceLayerSection kind="agent-interpretation">` at the page level (`IntentWorkspacePage.tsx`), around its existing render site.
- **The draft editor (`CoreAnchorRevisionEditor`) is untouched** — no layer wrapper, no visual change, all Save/Confirm/Reject/Discard controls exactly where they were (§2).

Requirements verified: a draft Anchor never renders inside `ConfirmedAnchorSummary` at all (mutually exclusive branches in `IntentWorkspacePage.tsx`, unchanged); the confirmed/superseded distinction is unchanged (`previousConfirmedRevision`, "Supersedes Revision N" text, unchanged); Agent recommendations (the disclosures) are visually and structurally separate from the confirm/reject controls (always were, now additionally under a distinct heading); the confirmed Anchor's content is never duplicated in Human Decision and Provenance (verified by test, §13).

---

## 6. VFX Alignment implementation

**File:** `apps/web/src/app/vfx/shots/[shotId]/alignment/AlignmentWorkspacePage.tsx`.

- **Production Evidence**: a new section holding only "Assessed Version" and "Core Anchor used" — the two real object references the assessment ran against, split out of the pre-existing summary `MetadataRow` (which previously mixed these with the assessment's own authorship metadata).
- **Agent Interpretation**: the existing summary card (`ai-interpretation`/`human-review-required` badges, executive summary, "Assessed at"/"Assessor" metadata), the Findings section (agreements, tensions, risks, open questions, recommendations, drift risks), the Recommended-next-action section (Intent Signal summary, re-anchor proposal card), and Assessment history — all now grouped under one `<EvidenceLayerSection kind="agent-interpretation">`, unchanged internally.
- **Human Decision and Provenance**: new — an honest statement that no Decision is recorded directly against the Assessment (`02_STEP_9A_...md` §7's own finding: "no Decision object is attached to a CrossRoleAssessment at all, by design, Step 6"), with a link to the Intent page, where a re-anchor proposal's eventual confirm/reject Decision is actually recorded once accepted.

Requirements verified: the re-anchor proposal card still only links to Intent, never confirms anything itself (unchanged `GenerateAssessmentButton`/`Link` behaviour); Assessment severity (`attention_level`) is never presented as a Decision — it stays inside Agent Interpretation exactly as before; production facts (Version, Core Anchor reference) are traceable via the same `versionsById`/`revisionsById` lookups already used; "Review alignment"/"Review proposal" actions are unchanged.

---

## 7. CG Execution implementation

**Files:** `apps/web/src/app/cg/tasks/[taskId]/execution/ExecutionPage.tsx`, `apps/web/src/features/cg/execution-workspace/data.ts`, `apps/web/src/app/cg/tasks/[taskId]/execution/page.tsx`.

- **Production Evidence**: "Active Core Anchor (read-only)" and the confirmed Execution Anchor's content fields (`contentFieldRows` — technical boundaries, parameter ranges, delivery conditions, production-ready criteria, downstream dependencies, publish requirements, allowed refinements, escalation conditions, each already using Step 9B-1's field-specific-fallback wording) are grouped under one `<EvidenceLayerSection kind="production-evidence">`.
- **Human Decision and Provenance**: new. `loadExecutionWorkspaceData` now also calls `listExecutionAnchorRevisionDecisions` (Step 9B-1's endpoint) for the confirmed revision and finds its `confirm_execution_anchor` Decision. When found, `decisionProvenanceItems` renders the real actor role, rationale, decided-at, and supersession. When not found (legacy-compatibility — a confirmed revision from before Decision listing existed, or one whose Decision genuinely carries no rationale), the section falls back to the revision's own `confirmed_by_human_role`/`confirmed_at` fields — the exact `MetadataRow` that rendered unconditionally before this step, now conditional and honest about which source it used.
- **No Agent Interpretation section on this page.** `CGSupervisorReviewRead` (the one real Agent-output object connected to CG Execution's domain) is fetched by the Version Review and Current Version loaders, not `execution-workspace/data.ts` — this page's loader has no Agent-output object to show today. Per the classification rule's own "when no applicable content exists, omit" convention (§4), no empty Agent Interpretation section was added here; adding one with nothing but an honest-empty-state sentence was considered and rejected as pure noise on a page where the omission itself is exactly what "no applicable Agent output already available here" honestly looks like. Named explicitly in §14, not silently dropped.
- **The draft editor (`ExecutionAnchorEditor`) is untouched** — same reasoning as VFX Intent (§5/§2).

**Backend/contract change:** none — `listExecutionAnchorRevisionDecisions` and its role gate already existed from Step 9B-1; only a new call site. `loadExecutionWorkspaceData`'s signature gained one parameter (`actorHeaders: Record<string, string>`), and `page.tsx` now resolves the real session identity via `resolveIdentity()`/`actorHeaders()` before calling it — the identical pattern Step 9B-1 already established for CG Task Overview's `page.tsx`.

Requirements verified: an unconfirmed (draft-only) Execution Anchor never renders inside the Production Evidence section (the section is conditional on `data.confirmedRevision`, unchanged); the Step 9B-1 field-specific fallback behaviour for `production_ready_criteria` is untouched (same selector-independent rendering, still exercised by the existing `contentFieldRows` helper); VFX's read access to the Decision endpoint is unchanged and not newly exercised from a VFX call site; all CG confirm/edit controls in `ExecutionAnchorEditor` are unchanged.

---

## 8. CG Version Review implementation

**File:** `apps/web/src/app/cg/tasks/[taskId]/version-review/VersionReviewPage.tsx`.

- **Production Evidence**: the selected Version's `MetadataRow` (Created/Source/Task/Shot), "Active Core Anchor (read-only)", "Active Execution Anchor (read-only)", and "Review notes" — all grouped under one `<EvidenceLayerSection kind="production-evidence">`.
- **Agent Interpretation**: "CG Supervisor reviews" (count of `CGSupervisorReviewRead` rows for the active Execution Anchor) under its own `<EvidenceLayerSection kind="agent-interpretation">`.
- **Human Decision and Provenance**: new — an honest statement that no Human Decision has been recorded for this specific Production Version review, explicitly naming that escalating to VFX records a Dependency, not a Decision (a real, verified distinction — `VersionReviewActions`' escalate control creates a `TaskDependency(kind="escalation")`, confirmed against the existing CG selector code from Step 9B-1, never a `Decision` row).
- **`VersionReviewActions`** (Escalate to VFX, Generate CG Supervisor review) stays outside every layer section, unchanged — it is the page's action surface, not a passive layer.

Requirements verified directly against the task's explicit "do not manufacture" list: no Decision is fabricated from a ReviewNote, a Version status label, the Escalate button's mere presence, or a pending CG Supervisor review — the Human Decision section's text is static and does not vary with any of those four things. Task-scoped Version filtering (`filterVersionsForTask`), nullable `task_id` compatibility, and external-author-as-provenance-only (`getAuthorDisplayText`) are all unchanged, reused exactly as before.

---

## 9. Artist Current Version implementation

**File:** `apps/web/src/app/artist/tasks/[taskId]/current-version/CurrentVersionPage.tsx`.

- **Production Evidence**: the selected Version's `MetadataRow`, "Active Core Anchor (read-only)", "Active Execution Anchor (read-only)", and "Review notes" — one `<EvidenceLayerSection kind="production-evidence">`.
- **Agent Interpretation**: "Applicable Artist guidance" (including the `GenerateArtistGuidanceButton` — kept here deliberately, since requesting more Agent output is itself an Agent-Interpretation-adjacent action, not a Human Decision), "CG Supervisor reviews", and "Cross-role Assessments" — one `<EvidenceLayerSection kind="agent-interpretation">`.
- **Human Decision and Provenance**: new — two short, honest reference statements ("This Task's Core Anchor is confirmed, owned by the VFX Supervisor" / "...Execution Anchor is confirmed, owned by the CG Supervisor", or the honest "not confirmed yet" fallback), plus an explicit statement that Artist has read-only reference access and cannot confirm, reject, or edit either Anchor. Deliberately **not** the full actor/rationale/timestamp provenance CG Execution now shows — Artist has no role-permitted access to that (`ROLE_PERMISSIONS.md`, unchanged), and this section does not claim otherwise.

Requirements verified: Artist Agent guidance is never labelled anything but `ai-interpretation`-equivalent (unchanged rendering, now just regrouped); no Anchor confirm/reject/edit control exists anywhere on this page (never did); the external ftrack author is never presented as an ICAS human-role authority (`getAuthorDisplayText`, unchanged); this page's layering is independent of, and does not duplicate, Step 9B-1's Working Direction summary on the separate Task Overview page (no content or component is shared between the two — different route, different data shape); Current Version selection (`?version=`) and Review Note relationships are unchanged.

---

## 10. Artist Feedback History implementation

**File:** `apps/web/src/app/artist/tasks/[taskId]/feedback-history/FeedbackHistoryPage.tsx`, new `apps/web/src/lib/feedbackEventLayer.ts`.

**The chronological timeline responsibility is fully preserved** — this page does **not** use `EvidenceLayerSection` at all (confirmed: zero occurrences of the three layer headings on this page, verified directly against the rendered HTML in §15). Splitting a single newest-first timeline into three separate non-chronological sections was explicitly ruled out by the task itself; instead, each event now carries one small `AuthorityLabel` badge (reusing the exact Step 9B-1 vocabulary — `production-fact` / `ai-interpretation` / `human-confirmed`) classifying it, while the `<ol>` timeline order, `EVENT_TYPE_LABEL` text, actor footer, and `Open →` link are all completely unchanged.

Classification (`feedbackEventLayer`, keyed by the real, persisted `event_type` — never the visible actor label):

| Event type | Layer | Why |
|---|---|---|
| `version_recorded` | Production Evidence | a real recorded Version |
| `review_note_recorded` | Production Evidence | a real recorded Note — human-authored or not |
| `dependency_recorded` | Production Evidence | a structural production fact |
| `escalation_recorded` | Production Evidence | a structural production fact (an escalation `TaskDependency`, not a Decision — §8) |
| `artist_guidance_generated` | Agent Interpretation | real Agent output |
| `cg_supervisor_review_generated` | Agent Interpretation | real Agent output |
| `cross_role_assessment_involving_task` | Agent Interpretation | real Agent output |
| `dependency_acknowledged` | Human Decision and Provenance | a real human acknowledgement action |
| `dependency_resolved` | Human Decision and Provenance | a real human resolution action |
| `execution_anchor_confirmed` | Human Decision and Provenance | a real confirm Decision event |
| `execution_anchor_draft_discarded` | Human Decision and Provenance | a real reject/discard Decision event |

Verified by test (§13) that a `dependency_recorded` event authored by a real human role (`actor_human_role: "cg_supervisor"`) still classifies as Production Evidence, not Human Decision or Agent Interpretation — the classification is keyed strictly by `event_type`, never by `actor_kind`/`actor_human_role`.

**The `ArtistFeedbackEventRead.external_author_name` limitation remains, unchanged and undisguised** — this page's event footer still shows only `actor_human_role ?? actor_kind`, exactly as before; this step adds no external-author display anywhere and does not claim the limitation is resolved. Repeated-reconciliation deduplication is a backend aggregate concern (`build_task_feedback_history`), unchanged by this frontend-only step. No event contract gap was found that blocks any of the eleven required classifications — every real `ArtistFeedbackEventType` value maps cleanly to exactly one layer (§8/§10 above), so no backend contract change was needed or requested.

---

## 11. Provenance handling

- **Production Evidence**: source object type/id kept internal (React keys, `href` targets) only, never rendered as visible text; `source`/`external_author_name` via the existing, unchanged `getAuthorDisplayText` helper; `source_created_at`-aware ordering via the existing, unchanged `getEffectiveTimestamp` helper — neither helper was touched by this step.
- **Agent Interpretation**: `AgentRun`/`agent_run_id`/model/prompt provenance is unchanged where it already existed (VFX Intent's Evidence/Provenance drawer, showing `provider`/`model_name`/`prompt_version` via `AgentRunReference`, untouched); no new AgentRun-provenance surface was added on the other five pages, since none of their loaders fetch a distinct `AgentRun` object beyond what Intent already showed — CG Execution's, CG Version Review's, and Artist Current Version's Agent-output objects (`CGSupervisorReviewRead`, `ArtistAgentGuidanceRead`, `CrossRoleAssessmentRead`) already carry `agent_run_id`/`context_snapshot_id` internally (per `02_STEP_9A_...md` §7) but this step does not add a new rendered drill-down for them — a real, named limitation (§14), not a gap this step's own scope required closing.
- **Human Decision**: `decisionProvenanceItems` renders actor role, rationale (honest "No rationale was provided." fallback, never fabricated), decided-at, and — only when real — a "Supersedes: An earlier Decision" line that never renders the superseded Decision's raw id.
- **Nothing exposed**: no credential, internal token, raw external-author id, or raw UUID is rendered as visible copy anywhere in this step's new code — verified directly by test for `decisionProvenanceItems` (§13) and by the existing, unchanged, already-tested raw-id assertions on every one of the six pages' pre-existing test suites, all of which remain green.
- **No missing provenance is presented as if it existed** — every fallback in this step (CG Execution's Decision-not-found case, VFX Alignment's and CG Version Review's honest Human Decision statements) states the real absence in words, never a blank space or a default-confirmed appearance.

---

## 12. Duplication and density decisions

Per page, the specific content that already existed and was only *regrouped*, never duplicated:

- **VFX Intent**: `ConfirmedAnchorSummary`'s two cards, `IntentEvidenceDisclosures` — same components, same props, new heading wrapper only. Zero new content rendered twice.
- **VFX Alignment**: the summary `MetadataRow` was split in two (Version/Anchor reference vs. assessment authorship) — the only page where existing content was divided across two layers, and only because both halves were genuinely distinct real facts previously co-located in one row.
- **CG Execution**: the pre-existing "Confirmed by"/"Confirmed at" `MetadataRow` is now conditional on `confirmDecision` — same two facts, richer when a real Decision exists, never shown twice.
- **CG Version Review / Artist Current Version**: existing sections moved under new headings verbatim; only the Human Decision section's text is new content (a short, honest sentence, not a duplicate of anything already on the page).
- **Artist Feedback History**: no new content at all — one badge per existing event.

No disclosure/collapse was added anywhere in this step (unlike Step 9B-1's `DetailedContext`) — none of the six pages' pre-existing content was found to be *directly duplicated* by this step's own additions, so there was nothing to collapse. All content stays immediately visible; no active `HumanGate` or confirm/reject control is hidden behind anything new. Every existing keyboard-operable control (`ExecutionAnchorEditor`'s buttons, `CoreAnchorRevisionEditor`'s buttons, `VersionReviewActions`, `GenerateArtistGuidanceButton`) is unchanged and unwrapped.

---

## 13. Tests and validation

**New focused test files:**

- `apps/web/src/design/components/EvidenceLayerSection.test.tsx` (6 tests) — fixed heading/question text per `kind`, `data-evidence-layer` attribute, children rendering, `className` merging.
- `apps/web/src/lib/decisionProvenance.test.ts` (3 tests) — real actor/rationale/timestamp, honest no-rationale fallback, supersession without a raw id.
- `apps/web/src/lib/feedbackEventLayer.test.ts` (4 tests) — all eleven event types classify correctly, including the explicit "human-authored Production Evidence event stays Production Evidence" case.

**New tests added to existing page-component test files** (one to three per page, all passing alongside every pre-existing test in the same file, none weakened or deleted):

- `IntentWorkspacePage.test.tsx` (+1, 14 total): confirmed content under Production Evidence, the Decision's rationale under Human Decision and Provenance, not duplicated in Production Evidence.
- `AlignmentWorkspacePage.test.tsx` (+1, 13 total): Version/Anchor reference under Production Evidence, findings under Agent Interpretation, the honest no-Decision statement under Human Decision and Provenance.
- `ExecutionPage.test.tsx` (+2, 10 total): a real Decision's actor/rationale render under Human Decision and Provenance (and not duplicated in Production Evidence); the legacy fallback to the revision's own confirmed-by/at fields when no Decision is found.
- `VersionReviewPage.test.tsx` (+1, 12 total): Production Evidence/Agent Interpretation grouping, and the honest Human Decision statement present (never manufactured).
- `CurrentVersionPage.test.tsx` (+1, 17 total): Agent Interpretation groups guidance/reviews/assessments; Human Decision states Anchor authority ownership without duplicating the Working Direction summary.
- `FeedbackHistoryPage.test.tsx` (+1, 8 total): chronology (newest-first) preserved across mixed-layer events; classification badge matches `event_type`, including the human-authored-but-Production-Evidence case; no cross-contamination between badges.

**Full regression, all green:**

- Frontend: Vitest 934/934 (120 files), ESLint (0 errors, 1 pre-existing/unrelated warning), `tsc --noEmit` (apps/web and contracts package, both clean), Prettier (clean, repo-root), production `next build` (30 routes, succeeded).
- Backend: no Python source was changed in this step (only the existing, already-tested Step 9B-1 endpoint gained one more caller) — no backend/contract test re-run was required or performed, per the task's own instruction to run API/contract tests only when an approved additive contract change is made (none was).
- Every one of the 934 tests that existed before this step still passes unmodified — confirmed by running the complete suite both before and after this step's changes.

---

## 14. Known limitations

- **CG Execution has no Agent Interpretation section.** `CGSupervisorReviewRead` — the one Agent-output object connected to this domain — is fetched by Version Review and Current Version, not by `execution-workspace/data.ts`. Adding a fetch here to populate an Agent Interpretation section was considered and rejected as outside this step's "reorganise existing content" scope (§11's "prefer existing endpoints... do not add an aggregate endpoint merely for visual convenience" applies by extension to a new *fetch*, not only a new *endpoint*). A future step could add this fetch if CG Execution is judged to need Agent-authored draft context surfaced directly on that page.
- **AgentRun/model/prompt drill-down is not newly added on five of six pages.** Only VFX Intent already had it (via `IntentEvidenceDisclosures`/`AgentRunReference`, unchanged). CG Execution, CG Version Review, Artist Current Version, and Artist Feedback History's Agent-output objects all carry `agent_run_id`/`context_snapshot_id` internally, but this step does not add a new UI drill-down for any of them — a real, deliberate scope boundary, not an oversight, since the task's own required checklist does not name this as a per-page requirement (only "AgentRun provenance... may include").
- **`ArtistFeedbackEventRead.external_author_name` remains absent**, unchanged from Step 8C-6/8C-7/9A — Feedback History's actor footer still shows only `actor_human_role ?? actor_kind`. This step neither hides nor claims to fix this pre-existing, already-documented contract gap.
- **VFX Alignment's Human Decision section is necessarily thin** — there is genuinely no persisted Decision object scoped to a `CrossRoleAssessment` (a real, by-design Step 6 characteristic, not a defect this step could or should retrofit).

---

## 15. Owner visual-validation targets

Local services: `apps/api` on `http://localhost:8000`, `apps/web` (dev) on `http://localhost:3000`, entry via `http://localhost:3000/demo`. **The owner has not yet performed this validation; it is not claimed as complete.**

| Page | Exact URL | Checklist |
|---|---|---|
| VFX Intent | `http://localhost:3000/vfx/shots/8a72858d-8d06-47ab-a28d-5ee077f561c8/intent` | Production Evidence / Human Decision and Provenance / Agent Interpretation headings are understandable at a glance; the confirmed Anchor's content and its confirming Decision are visibly distinct, not duplicated; provenance (confirmed-by role, rationale) is readable; the draft editor (if a draft exists) is untouched and its Save/Confirm/Reject controls remain reachable; no role boundary changed |
| VFX Alignment | `http://localhost:3000/vfx/shots/8a72858d-8d06-47ab-a28d-5ee077f561c8/alignment` | Assessed Version/Core Anchor reference reads as Production Evidence, distinct from the Agent's findings/recommendations; the Human Decision section honestly states no Decision is recorded against the Assessment; Review proposal still leads only to Intent; page density remains manageable |
| CG Execution | `http://localhost:3000/cg/tasks/4cd95082-df46-4d67-92bb-a217cf0e8684/execution` | Confirmed Execution Anchor content reads as Production Evidence; the real confirm Decision's actor/rationale/timestamp render under Human Decision and Provenance; VFX read access was not turned into edit access; all CG confirm/edit controls remain reachable |
| CG Version Review | `http://localhost:3000/cg/tasks/4cd95082-df46-4d67-92bb-a217cf0e8684/version-review` | Version/Anchor context reads as Production Evidence; CG Supervisor reviews read as Agent Interpretation; the Human Decision section never implies a Decision exists where none does; Escalate/Generate actions remain reachable |
| Artist Current Version | `http://localhost:3000/artist/tasks/4cd95082-df46-4d67-92bb-a217cf0e8684/current-version` | Artist Guidance reads as clearly advisory; the Human Decision section states Anchor ownership without exposing confirmation rationale to Artist; nothing here duplicates the Task Overview's Working Direction section; Generate/Regenerate guidance remains reachable |
| Artist Feedback History | `http://localhost:3000/artist/tasks/4cd95082-df46-4d67-92bb-a217cf0e8684/feedback-history` | Chronological order is unchanged; each event's small layer badge is understandable without breaking the timeline's read flow; a human-authored production event (e.g. a Dependency) still reads as Production Evidence, not Human Decision; Open → links remain correct |

Each of the six URLs above returned `200` and rendered its expected layer content against freshly restarted `apps/api`/`apps/web` processes in this task (§17). **This does not constitute owner visual validation.**

---

## 16. Explicit non-goals

- Step 9B-3 (Department Execution Overview), Step 9B-4 (media/thumbnail/ftrack context), and Step 9C (visual-system unification) were not started.
- No new authoritative domain object, table, or migration was added.
- No new Agent workflow, prompt, or runtime behaviour was added or changed — every Agent-output object shown is exactly the same one already produced by the existing, unchanged Agent pipelines.
- No ftrack entity or local Step 8 acceptance data row was read differently or modified — no ftrack call was made in this task.
- No new route, sidebar item, tab, or role permission was added or broadened.
- No generic Decision-search endpoint or aggregate endpoint was added, per §11's explicit boundary — the one new call site reuses Step 9B-1's existing, role-gated, per-revision endpoint exactly.

---

## 17. Readiness for Step 9B-3

**Ready**, pending owner visual validation of this step (§15). Step 9B-3's own scope (a VFX-facing Department Execution Overview aggregate) is unaffected by and independent of this step's work — it needs its own new aggregate read endpoint (per `02_STEP_9A_...md` §8, explicitly out of this step's boundary, §16) and does not depend on the `EvidenceLayerSection` component, though it may reuse it if Department Execution Overview rows are later judged to need Evidence/Agent/Human grouping of their own.

**Fresh-process re-verification (this task):** `apps/api`/`apps/web` restarted fresh; all six §15 URLs returned `200`; all three layer headings confirmed present (via direct grep of the rendered HTML) on VFX Intent, VFX Alignment, CG Execution (Production Evidence + Human Decision and Provenance only, per §7/§14), CG Version Review, and Artist Current Version; Artist Feedback History confirmed to render zero layer-section headings (by design, §10) and real per-event `Production fact`/`AI interpretation`/`Human-confirmed` badges (4/12/4 respectively, across its real D1 demo event history) instead. CG Execution's Human Decision and Provenance section confirmed showing the real `cg_supervisor` actor role and a real `2026-08-01` decided-at timestamp, sourced live from `listExecutionAnchorRevisionDecisions`, not fabricated.

**Files changed (exhaustive):** `apps/web/src/design/components/EvidenceLayerSection.tsx` + `.module.css` (new); `apps/web/src/design/components/index.ts`; `apps/web/src/lib/decisionProvenance.ts` (new) + `.test.ts` (new); `apps/web/src/lib/feedbackEventLayer.ts` (new) + `.test.ts` (new); `apps/web/src/app/vfx/shots/[shotId]/intent/{IntentWorkspacePage,ConfirmedAnchorSummary}.tsx` + `IntentWorkspacePage.test.tsx`; `apps/web/src/app/vfx/shots/[shotId]/alignment/AlignmentWorkspacePage.tsx` + `.test.tsx`; `apps/web/src/features/cg/execution-workspace/data.ts`; `apps/web/src/app/cg/tasks/[taskId]/execution/page.tsx`; `apps/web/src/app/cg/tasks/[taskId]/execution/ExecutionPage.tsx` + `.test.tsx`; `apps/web/src/app/cg/tasks/[taskId]/version-review/VersionReviewPage.tsx` + `.test.tsx`; `apps/web/src/app/artist/tasks/[taskId]/current-version/CurrentVersionPage.tsx` + `.test.tsx`; `apps/web/src/app/artist/tasks/[taskId]/feedback-history/FeedbackHistoryPage.tsx` + `.test.tsx`.
