# Step 9A — Current-State and Implementation Map

**Status:** Audit complete
**Branch:** `feat/step9a-presentation-baseline-audit`
**HEAD at audit:** `6ed51f2` — `Merge pull request #17 from eileen-wl/feat/step8c89-real-ftrack-acceptance`
**Date:** 2026-08-02
**Companion documents:** `docs/step-9/01_STEP_9_PRESENTATION_AND_COMPREHENSION_BASELINE.md` (locked baseline, treated as authoritative and not rewritten by this document), `docs/step-8/04_STEP_8_COMPLETION_BASELINE.md`, `docs/step-8/03_STEP_8C_REAL_FTRACK_ACCEPTANCE.md`, `docs/step-7/21_STEP_7_COMPLETION_BASELINE.md`, `docs/step-7/20_STEP_7C_GLOBAL_FUNCTIONAL_AUDIT.md`, `docs/IMPLEMENTATION_STATUS_AND_ROADMAP.md` §L.

**Evidence-type key used throughout this document:**
- **[CODE]** — repository-code evidence: a file path, line range, or exact symbol read directly in this task.
- **[FTRACK]** — a real, authenticated, read-only ftrack query run in this task against the controlled trial workspace (`bristol-l.ftrackapp.com`).
- **[STEP8]** — Step 8 acceptance evidence already recorded in `docs/step-8/03_STEP_8C_REAL_FTRACK_ACCEPTANCE.md`/`04_STEP_8_COMPLETION_BASELINE.md`, reused here rather than re-derived.
- **[INFER]** — a reasonable inference from the evidence above, not independently verified in this task.
- **[REC]** — a recommendation for Step 9B, not a finding.

---

## 1. Executive finding

The existing VFX/CG/Artist information architecture, role boundaries, and data model are **sufficient to build every Priority 1 and Priority 2 item** `docs/step-9/01_...md` §5 names, using only existing authoritative objects, without a new authoritative domain table, without a new API endpoint class, and without reopening Step 7/Step 8's settled architecture.

Concretely:

- **Role-aware Working Direction** (§6) is a derived, read-only summary of data every one of the three Overview pages' loaders already fetches or could fetch with one or two additional calls to already-existing endpoints. No line in `01_...md`'s three "Current ... Direction" specifications requires a field that does not already exist on a real, persisted object.
- **Production Evidence / Agent Interpretation / Human Decision layering** (§7) is already substantially present in the underlying data (every Agent-output object carries `agent_run_id`/`context_snapshot_id`; every `Decision` carries `actor_id`/`actor_human_role`/`rationale`/`supersedes_decision_id`) — the gap is presentational grouping in the six priority pages, not missing data.
- **Department Execution Overview** (§8) requires exactly one new thing: a way for the VFX frontend to enumerate a Shot's Tasks and each Task's Execution Anchor/dependency/latest-Version state without N+1 fetching. The backend endpoints this needs already exist (`GET /shots/{shot_id}/tasks`, per-Task Execution Anchor/dependency reads) — what is missing is a small aggregate read model, the same shape as the existing `VfxInboxItemRead`/`CgInboxItemRead` pattern, not a new subsystem.
- **Media/thumbnail/ftrack context** (§9) has real, positive evidence from a live, read-only ftrack query performed in this task: of 32 real synced `AssetVersion`s, **32/32** have a resolvable thumbnail URL and **30/32** have an MP4-like Component the SDK could locate. **[CORRECTED — Step 9B-4, see §17]** "resolvable" here described SDK/Component-level availability, not proven browser-safe playability — Step 9B-4's own implementation found the only method that actually produces a Component URL (`Location.get_url()`) embeds live ftrack credentials, unsafe to send to a browser; see §17 for the reclassified, browser-safe capability numbers. No ICAS `Version` field persists any of this today — it must be resolved live, server-side, per request (ftrack's signed URLs are not safely cacheable as a static field). This is the one area of `01_...md` §2.1 where "we do not yet know" becomes, after this audit, "we know, and the honest answer is better than assumed" — with the further refinement in §17 that "we know it's locatable" and "we know it's safe to show a browser" turned out to be two different claims.

No Step 8 architecture is reopened. No concrete implementation defect was found that would justify doing so (§10).

---

## 2. Repository and Step 8 baseline

- **Branch:** `feat/step9a-presentation-baseline-audit`
- **HEAD:** `6ed51f2` **[CODE]** (`git rev-parse HEAD`), a merge commit for PR #17, which contains `11cb4ba` (`docs: close step 8 ftrack integration baseline`).
- **Working tree at task start:** the only untracked path was `docs/step-9/` containing exactly `01_STEP_9_PRESENTATION_AND_COMPREHENSION_BASELINE.md` **[CODE]** (`git status --short` → `?? docs/step-9/`). No unrelated changes were present.
- **Step 8 merged into the current baseline:** confirmed — `git log --oneline -5` shows `6ed51f2` as a merge of `feat/step8c89-real-ftrack-acceptance` into the branch this task started from, and `11cb4ba` (the Step 8 closeout commit) is an ancestor of `HEAD`. **[CODE]**
- **Step 9 not previously started:** confirmed by the absence of any `docs/step-9/02_*` file before this task, and by `docs/IMPLEMENTATION_STATUS_AND_ROADMAP.md` §K.4/§L (as it read before this task's edit) stating Step 9 had not started. **[CODE]**
- **Local services available for this audit:** `apps/api` was already running (`GET /health` → 200) **[CODE]**; Postgres (`infra-postgres-1`) and Redis (`infra-redis-1`) containers were already healthy — the same environment Step 8C-8 left running, reused rather than restarted. No database write occurred in this task.

---

## 3. Locked IA and role boundaries

Every boundary named in the task's Section 2 was independently confirmed from code, not assumed from documentation:

- **Role-selection Home (`/`):** `apps/web/src/app/RoleSelectionHome.tsx` renders no `AppShell`/sidebar; three role-entry cards. **[CODE]**
- **Server-side role lock:** `apps/web/src/middleware.ts` **[CODE]** — matches `/vfx/:path*`, `/cg/:path*`, `/artist/:path*` (its own `config.matcher`); compares the `DEMO_ROLE_COOKIE` cookie value against `roleForPathname(pathname)`; on any mismatch (no session, or a different role's session) redirects to `/` with `?returnTo=<originally requested path>`. This is the authoritative gate — page-level checks (e.g. `apps/web/src/app/vfx/shots/[shotId]/page.tsx`'s own cookie check, read in this task) are explicitly documented in-code as "defense-in-depth," not primary.
- **Exit role view:** every role's `AppShell` receives an `onExitRole` handler wired to a real Server Action (`exitRoleView`, imported from `demo/actions` in every `page.tsx` read in this task) — confirmed present on VFX Shot Overview, and by the same import pattern across CG/Artist pages.
- **Sidebar item sets, exact:** `apps/web/src/lib/roleNavigation.ts` **[CODE]** — `ROLE_SIDEBAR_ITEMS` is a `Record<HumanRole, SidebarNavItem[]>` with exactly three entries per role, all `implemented: true`:
  - `vfx_supervisor`: Workspace Home (`/vfx`) · Review Inbox (`/vfx/inbox`) · Shots (`/vfx/shots`)
  - `cg_supervisor`: Workspace Home (`/cg`) · Review Inbox (`/cg/inbox`) · Tasks (`/cg/tasks`)
  - `artist`: Workspace Home (`/artist`) · Review Inbox (`/artist/inbox`) · Tasks (`/artist/tasks`)
- **Tab sets, exact** (confirmed by reading each page component's `ContextTabs` `tabs` array directly):
  - VFX Shot: **Overview · Intent · Versions · Alignment · Activity** — `ShotOverviewPage.tsx`, `IntentWorkspacePage.tsx`, `VersionsWorkspacePage.tsx`, `AlignmentWorkspacePage.tsx`, `ActivityWorkspacePage.tsx`.
  - CG Task: **Overview · Execution · Version Review · Dependencies · Activity** — `TaskOverviewPage.tsx`, `ExecutionPage.tsx`, `VersionReviewPage.tsx`, `DependenciesPage.tsx`, `TaskActivityPage.tsx`.
  - Artist Task: **Task Overview · Current Version · Feedback History** (exactly 3, deliberately narrower — no Intent/Execution/Dependencies/Activity tab exists for Artist, by Step 7C-5's own scope, re-confirmed in code, not only in `docs/step-7/20_...md`) — `TaskOverviewPage.tsx`, `CurrentVersionPage.tsx`, `FeedbackHistoryPage.tsx`.

**None of the six explicitly-forbidden proposals** (global role switcher, combined all-role Shot page, CG embedded in VFX, Review Inbox replaced by a catalogue, tabs merged/renamed without a defect) are proposed anywhere in this document. §8 explicitly re-confirms the Department Execution Overview stays read-only/navigate-only from VFX, per the task's own constraint.

---

## 4. Actual route map

Reproduced here from direct code inspection (Glob of `apps/web/src/app/{vfx,cg,artist}/**/page.tsx`), not copied from any prior document:

```text
/                                          Role-selection Home
/demo                                      Permanent redirect to /

/vfx                                       VFX Workspace Home
/vfx/inbox                                 VFX Review Inbox
/vfx/shots                                 VFX Shots (structural catalogue)
/vfx/shots/[shotId]                        Shot Overview
/vfx/shots/[shotId]/intent                 Intent (Core Anchor lifecycle)
/vfx/shots/[shotId]/versions               Versions
/vfx/shots/[shotId]/alignment              Alignment
/vfx/shots/[shotId]/activity               Activity

/cg                                        CG Workspace Home
/cg/inbox                                  CG Review Inbox
/cg/tasks                                  CG Tasks (structural catalogue)
/cg/tasks/[taskId]                         Task Overview
/cg/tasks/[taskId]/execution               Execution (Execution Anchor lifecycle)
/cg/tasks/[taskId]/version-review          Version Review
/cg/tasks/[taskId]/dependencies            Dependencies
/cg/tasks/[taskId]/activity                Activity

/artist                                    Artist Workspace Home
/artist/inbox                              Artist Review Inbox
/artist/tasks                              Artist Tasks (structural catalogue)
/artist/tasks/[taskId]                     Task Overview
/artist/tasks/[taskId]/current-version     Current Version
/artist/tasks/[taskId]/feedback-history    Feedback History
```

This matches `docs/step-7/20_STEP_7C_GLOBAL_FUNCTIONAL_AUDIT.md` §2 exactly, re-verified independently in this task rather than trusted from that document alone. **[CODE]**

Legacy, untouched, out of Step 9 scope: `/shots`, `/shots/[shotId]`, `/shots/[shotId]/versions/[versionId]` — the pre-Step-7 engineering workflow, still the only mutable home of legacy `AlignmentAssessment`.

---

## 5. Current page/data/source matrix

For every page: route; responsibility; data loader (exact file); backend endpoints called (from the loader, traced to `features/{role}/api.ts`); domain objects available; source/provenance fields available; Agent output available; HumanGate/Decision info available; ftrack data available; important missing data; Step 9 enhancement classification.

### VFX

| Page | Route | Loader | Endpoints called |
|---|---|---|---|
| Shot Overview | `/vfx/shots/[shotId]` | inline in `page.tsx` via `fetchVfxInboxItem` | `GET /vfx/inbox/{shot_id}` |
| Intent | `/vfx/shots/[shotId]/intent` | `features/vfx/intent-workspace/data.ts::loadIntentWorkspaceData` | `GET /vfx/inbox/{id}`, `GET /intent/shots/{id}/core-anchor/revisions`, `GET /intent/core-anchor-revisions/{id}/human-gate`, `GET /intent/core-anchor-revisions/{id}/decisions`, `GET /intent/shots/{id}/intent-decompositions`, `GET /intent/shots/{id}/context-reconstructions`, `GET /intent/agent-runs/{id}`, `GET /intent/context-snapshots/{id}` |
| Versions | `/vfx/shots/[shotId]/versions` | `features/vfx/versions-workspace/data.ts::loadVersionsWorkspaceData` | `GET /vfx/inbox/{id}`, `GET /shots/{id}/versions`, `GET /versions/{id}/review-notes`, `GET /intent/shots/{id}/cross-role-assessments` |
| Alignment | `/vfx/shots/[shotId]/alignment` | `features/vfx/alignment-workspace/data.ts::loadAlignmentWorkspaceData` | `GET /vfx/inbox/{id}`, `GET /intent/shots/{id}/cross-role-assessments`, `GET /shots/{id}/versions`, `GET /intent/shots/{id}/core-anchor/revisions` |
| Activity | `/vfx/shots/[shotId]/activity` | `features/vfx/activity-workspace/data.ts::loadActivityWorkspaceData` | `GET /vfx/inbox/{id}`, `GET /shots/{id}/activity` |

- **Domain objects available across VFX pages:** `VfxInboxItemRead` (incl. `current_focus`, `next_candidates`, `active_core_anchor_summary`, `relevant_version_*`, `latest_signal_*`, `re_anchor_proposal_present`, `open_cg_escalation_*`), `CoreAnchorRevisionRead` (incl. `constraints`/`variation_zones`/`drift_risks`/`references`/`open_questions`, confirmed present on the contract **[CODE]** `packages/contracts/ts/src/generated/api.ts:2393-2402`), `HumanGateRead`, `DecisionRead`, `VersionRead`, `ReviewNoteRead`, `CrossRoleAssessmentRead` (incl. attached `intent_signal`/`re_anchor_proposal`), `IntentDecompositionRead`, `ContextReconstructionRead`, `AgentRunRead`, `ContextSnapshotRead`, `ShotActivityRead`.
- **Source/provenance available:** `Version.source`/`external_author_name` (Step 8), `CoreAnchorRevisionRead.created_by_actor_kind/actor_id/human_role/agent_type/agent_run_id`, `.confirmed_by_human_role/actor_id/confirmed_at`.
- **Agent output available:** `IntentDecompositionRead`, `ContextReconstructionRead`, `CrossRoleAssessmentRead` (with `intent_signal`, `re_anchor_proposal`), all with `agent_run_id`/`context_snapshot_id`.
- **HumanGate/Decision available:** full — `HumanGateRead` (status/opened_at/resolved_at/required_role), `DecisionRead` (actor_id/actor_human_role/rationale/supersedes_decision_id/write_back_requested).
- **ftrack data available:** `Version.source`, `external_author_id/name`, `source_created_at` (Step 8); Shot/Project have `source`/external linkage via `ExternalEntityLink` (not directly exposed on `VfxInboxItemRead` today — see §9).
- **Important missing data:** no Task-listing capability anywhere in `features/vfx/api.ts` (needed for §8); no media/thumbnail field on `VersionRead` (§9); Shot Overview's `dl` block has no explicit Evidence/Agent/Human grouping (§7).
- **Step 9 classification:** Shot Overview → **frontend composition + one new small backend read model** (Working Direction summary + Department Execution Overview, §6/§8). Intent/Alignment → **frontend composition only** for evidence layering (§7); data already present. Versions → frontend composition only for media (once §9's endpoint exists). Activity → no change proposed.

### CG

| Page | Route | Loader | Endpoints called |
|---|---|---|---|
| Task Overview | `/cg/tasks/[taskId]` | `features/cg/task-overview/data.ts::loadTaskOverviewData` | `GET /cg/inbox/{id}`, `GET /intent/shots/{id}/core-anchor`, `GET /tasks/{id}/dependencies`, `GET /tasks/{id}/activity`, `GET /intent/shots/{id}/core-anchor/revisions` |
| Execution | `/cg/tasks/[taskId]/execution` | `features/cg/execution-workspace/data.ts::loadExecutionWorkspaceData` | `GET /cg/inbox/{id}`, `GET /intent/shots/{id}/core-anchor`, `GET /intent/tasks/{id}/execution-anchor/revisions`, `GET /intent/execution-anchor-revisions/{id}/human-gate` |
| Version Review | `/cg/tasks/[taskId]/version-review` | `features/cg/version-review-workspace/data.ts::loadVersionReviewWorkspaceData` | `GET /cg/inbox/{id}`, `GET /shots/{id}/versions`, `GET /intent/shots/{id}/core-anchor`, `GET /intent/tasks/{id}/execution-anchor/revisions`, `GET /versions/{id}/review-notes`, `GET /intent/shots/{id}/core-anchor/revisions`, `GET /intent/execution-anchor-revisions/{id}/cg-supervisor-reviews` |
| Dependencies | `/cg/tasks/[taskId]/dependencies` | `features/cg/dependencies-workspace/data.ts::loadDependenciesWorkspaceData` | `GET /cg/inbox/{id}`, `GET /tasks/{id}/dependencies` |
| Activity | `/cg/tasks/[taskId]/activity` | `features/cg/activity-workspace/data.ts::loadTaskActivityWorkspaceData` | `GET /cg/inbox/{id}`, `GET /tasks/{id}/activity` |

- **Domain objects available:** `CgInboxItemRead` (incl. `current_focus`, `execution_anchor_state`, `pending_human_gate_id`, `latest_version_*`, `open_dependency_count`), `ExecutionAnchorRevisionRead` (flat fields only — `technical_boundaries`/`parameter_ranges`/`delivery_conditions`/`production_ready_criteria`/`downstream_dependencies`/`publish_requirements`/`allowed_refinements`/`escalation_conditions`; **confirmed no semantic-collection fields exist on this contract**, unlike `CoreAnchorRevisionRead` **[CODE]** `api.ts:2730-2790`), `CoreAnchorRevisionRead` (read-only reference only), `TaskDependencyRead` (incl. `kind`, `status`, `severity`, `escalated_to_role`, resolver fields), `CGSupervisorReviewRead`, `VersionRead`/`ReviewNoteRead` (Task-scoped, per Step 8C-6/8C-7), `TaskActivityRead`.
- **Source/provenance available:** same `Version`/`ReviewNote` fields as VFX, already Task-scoped; `ExecutionAnchorRevisionRead`'s own `created_by_*`/`confirmed_by_*` fields.
- **Agent output available:** `CGSupervisorReviewRead` (`review_output`, `agent_run_id`, `context_snapshot_id`).
- **HumanGate/Decision available:** `HumanGateRead` via `getExecutionAnchorRevisionHumanGate`; Decision history for Execution Anchor is not separately listed in `features/cg/api.ts` today (VFX's equivalent `listDecisionsForRevision` has no CG counterpart — a real, small, additive gap, not a defect, since the backend `/intent/execution-anchor-revisions/{id}/decisions`-shaped endpoint pattern already exists for Core Anchor and is a template, not a new concept).
- **ftrack data available:** identical to VFX's Version/ReviewNote fields, Task-scoped.
- **Important missing data:** no Decision-history listing endpoint call for Execution Anchor confirmation rationale (a template already exists on the VFX side); no media field (§9).
- **Step 9 classification:** Task Overview → **frontend composition** for Working Direction (data present) **+ one small addition** (a Decision-rationale fetch, mirroring VFX's existing pattern, if "latest Decision" is included). Execution/Version Review → frontend composition only for evidence layering.

### Artist

| Page | Route | Loader | Endpoints called |
|---|---|---|---|
| Task Overview | `/artist/tasks/[taskId]` | `features/artist/task-overview/data.ts::loadTaskOverviewData` | `GET /artist/inbox/{id}`, `GET /intent/shots/{id}/core-anchor`, `GET /intent/tasks/{id}/execution-anchor`, `GET /tasks/{id}/dependencies`, `GET /intent/shots/{id}/core-anchor/revisions`, `GET /intent/tasks/{id}/execution-anchor/revisions`, `GET /intent/versions/{id}/artist-guidances` |
| Current Version | `/artist/tasks/[taskId]/current-version` | `features/artist/current-version/data.ts::loadCurrentVersionData` | `GET /artist/inbox/{id}`, `GET /shots/{id}/versions`, `GET /intent/shots/{id}/core-anchor`, `GET /intent/tasks/{id}/execution-anchor`, `GET /versions/{id}/review-notes`, `GET /intent/versions/{id}/artist-guidances`, `GET /intent/versions/{id}/cross-role-assessments?task_id=`, `GET /intent/shots/{id}/core-anchor/revisions`, `GET /intent/tasks/{id}/execution-anchor/revisions`, `GET /intent/execution-anchor-revisions/{id}/cg-supervisor-reviews` |
| Feedback History | `/artist/tasks/[taskId]/feedback-history` | `features/artist/feedback-history/data.ts::loadFeedbackHistoryData` | `GET /artist/inbox/{id}`, `GET /tasks/{id}/feedback-history`, `GET /shots/{id}/versions` (Step 8C-6/8C-7 Task-scope leak-prevention filter) |

- **Domain objects available:** `ArtistInboxItemRead` (incl. `guidance_state`, `latest_version_*`, `open_review_note_count`), `ArtistAgentGuidanceRead` (`agent_run_id`, `context_snapshot_id`, `task_id`, `execution_anchor_revision_id`), `CoreAnchorRevisionRead`/`ExecutionAnchorRevisionRead` (read-only reference only), `VersionRead`/`ReviewNoteRead` (Task-scoped), `CrossRoleAssessmentRead`, `CGSupervisorReviewRead`, `ArtistFeedbackHistoryRead` (`events[]`, each with `event_type`/`actor_kind`/`actor_human_role`/`summary`/`related_version_id`/`route`).
- **Source/provenance available:** same as CG.
- **Agent output available:** `ArtistAgentGuidanceRead` (advisory, real provenance), `CGSupervisorReviewRead` (read-only context).
- **HumanGate/Decision available:** none directly fetched on Artist pages today (Artist never confirms either Anchor, per role boundary) — Anchor confirmation Decision/rationale is not surfaced to Artist at all currently, an intentional boundary, not a gap, per `ROLE_PERMISSIONS.md`.
- **ftrack data available:** same Version/ReviewNote fields, Task-scoped; Feedback History's `ArtistFeedbackEventRead` has **no** `external_author_name` field (confirmed absent from the contract, matching the already-documented Step 8C-6/8C-7 limitation) — Feedback History timeline events cannot show real ftrack author names without a backend contract change.
- **Important missing data:** `ArtistFeedbackEventRead.external_author_name` (named, pre-existing limitation, not new); no media field (§9).
- **Step 9 classification:** Task Overview/Current Version → frontend composition only for Working Direction and evidence layering; data already present. Feedback History → frontend composition only for the Evidence/Human split that is possible today; the external-author gap is **blocked by missing real data** (a contract extension, explicitly out of this audit's implementation scope, named again in §10/§15).

---

## 6. Role-aware Working Direction feasibility

Verdict for all three roles: **fully derivable from existing authoritative objects, no new authoritative table required.** Every field below is traced to a real, already-fetchable object; any field this audit could not honestly source is marked **unsupported**, not filled with static copy, per the task's own instruction.

### VFX — Current Creative Direction

| Field | Source object | Authoritative/advisory | Fallback when missing | Role allowed to act | Provenance to keep visible |
|---|---|---|---|---|---|
| Current creative objective | `CoreAnchorRevisionRead.core_summary` (confirmed revision) | Authoritative (once confirmed) | "No confirmed Core Anchor yet." | VFX Supervisor | Confirmed-by actor/role/timestamp |
| What must remain unchanged | `CoreAnchorRevisionRead.constraints[]` | Authoritative | Empty list, honestly | VFX Supervisor | Same revision provenance |
| What may vary | `.variation_zones[]` | Authoritative | Empty list | VFX Supervisor | Same |
| Current risk | `.drift_risks[]`, or `latest_signal_attention_level`/`latest_signal_summary` from `VfxInboxItemRead` | Authoritative (risks) / Agent-derived (signal) — **must be labeled distinctly, not merged** | "No current Intent Signal." (already the existing Shot Overview copy) | — (read-only) | `IntentSignal` is Agent-derived, never a Decision |
| What needs your decision next | `VfxInboxItemRead.current_focus` | Derived read model (already the existing, tested Review-Inbox precedence logic) — advisory-shaped, routes to a real action | `focus_type="none"` — "Nothing requires your attention" (existing copy) | VFX Supervisor | `current_focus` is itself already labeled as a derived summary, not a Decision |
| When CG/Artist issues need VFX intervention | `open_cg_escalation_task_id/name/summary` on `VfxInboxItemRead` (already exists, Step 7C-4) | Real, structural (an open `TaskDependency(kind="escalation")`) | Absent fields → no escalation | VFX Supervisor | Links to the real `TaskDependency` |

Cross-role Assessment / latest Decision / latest Version/ReviewNote are all already directly available (`CrossRoleAssessmentRead`, `DecisionRead` via `listDecisionsForRevision`, `VersionRead`/`ReviewNoteRead`). **No field is unsupported for VFX.**

### CG — Current Execution Direction

| Field | Source object | Authoritative/advisory | Fallback | Role allowed to act | Provenance |
|---|---|---|---|---|---|
| What this Task must achieve | `ExecutionAnchorRevisionRead.technical_boundaries` (confirmed) | Authoritative | "No confirmed Execution Anchor yet." | CG Supervisor | Confirmed-by actor/role/timestamp |
| Relevant Core Anchor context | `CoreAnchorRevisionRead.core_summary` (read-only reference, already fetched by `task-overview/data.ts`) | Authoritative (VFX-owned) | "No confirmed Core Anchor yet." | Read-only for CG | Explicitly "VFX-owned, read-only" label |
| Confirmed execution boundaries | `.technical_boundaries`/`.parameter_ranges`/`.delivery_conditions` | Authoritative | Per-field null → honest "not specified" | CG Supervisor | Same revision provenance |
| Production-ready criteria | `.production_ready_criteria` | Authoritative | Same | CG Supervisor | Same |
| Current dependencies | `TaskDependencyRead[]` (`status="open"`) | Real, structural | Empty list | CG Supervisor | `created_by`/`kind`/`severity` |
| Latest Version status | `CgInboxItemRead.latest_version_*` | Real | `null` → "No Version recorded yet." | — | `Version.source`/provenance |
| What needs CG action next | `CgInboxItemRead.current_focus` | Derived read model (existing, tested) | `focus_type="none"` | CG Supervisor | Already labeled derived |
| When to escalate to VFX | `TaskDependency(kind="escalation")` creation (existing action) | Structural/action, not a passive field | N/A | CG Supervisor | — |

**No field is unsupported for CG.** One honest gap named, not filled: no "latest Decision" (confirm/reject rationale) is currently fetched on the CG side (§5) — the Working Direction module should either add that one small fetch (mirrors VFX's existing `listDecisionsForRevision` pattern against the CG-scoped equivalent endpoint) or omit that line rather than fabricate it.

### Artist — Current Working Direction

| Field | Source object | Authoritative/advisory | Fallback | Role allowed to act | Provenance |
|---|---|---|---|---|---|
| What you are being asked to do | `ExecutionAnchorRevisionRead.technical_boundaries` (read-only reference, already fetched) | Authoritative (CG-owned) | "No confirmed Execution Anchor yet." | Read-only for Artist | Explicit "CG-owned, read-only" label |
| Why this matters | `CoreAnchorRevisionRead.core_summary` (read-only reference) | Authoritative (VFX-owned) | Same pattern | Read-only for Artist | Explicit "VFX-owned, read-only" label |
| What must remain unchanged | `CoreAnchorRevisionRead.constraints[]` | Authoritative | Empty list | Read-only for Artist | Same |
| What you may explore | `ExecutionAnchorRevisionRead.allowed_refinements` (a single text field, **not** a `VariationZone[]` collection on Execution Anchor — confirmed by contract inspection, §5) | Authoritative | `null` → "Not specified." | Read-only for Artist | Same |
| Latest feedback | `ReviewNoteRead[]` (Task-scoped, already loaded) | Authoritative (Production Evidence) | Empty list | — | `source`/`external_author_name` |
| Artist Guidance | `ArtistAgentGuidanceRead` (already loaded) | **Advisory — must be labeled distinctly** | `guidance_state="none"` → existing empty copy | Artist may regenerate | `agent_run_id`/`context_snapshot_id` |
| Current Version | `VersionRead` (already loaded, Task-scoped) | Authoritative | Existing empty state | — | `source`/provenance |
| What to do next | `ArtistInboxItemRead.current_focus` | Derived read model (existing, tested) | `focus_type="none"` | Artist | Already labeled derived |
| When to ask CG for clarification | `TaskDependencyRead` (`kind="dependency"`, read-only for Artist — Artist cannot create an escalation itself per the existing role boundary, only CG can) | Real, structural | Empty list | Read-only trigger only | — |

**One field named as a real, minor naming mismatch, not a gap:** `01_...md`'s "allowed refinements / Variation Zones" phrasing conflates two different real objects (`ExecutionAnchorRevisionRead.allowed_refinements`, a flat string, vs. `CoreAnchorRevisionRead.variation_zones`, a collection) — Step 9B must source Artist's "what you may explore" from the correct one (`allowed_refinements`) and must not attempt to render Execution Anchor as if it had a `VariationZone[]` collection, since it structurally does not.

**Confirmed for all three roles, per the task's required checks:**
- No new authoritative `WorkingDirection` table is required — every field above traces to an already-persisted object.
- The summary is necessarily a derived, read-only aggregation (either a frontend composition over already-fetched data, or, where the same aggregation is needed in more than one place, a small backend read model mirroring the existing `current_focus` pattern) — never a new write path.
- Agent interpretation (`IntentSignal`, `CrossRoleAssessment`, `ArtistAgentGuidance`, `CGSupervisorReview`) is distinguishable from confirmed Human Decision at the data level in every case (`created_by_actor_kind`/`agent_run_id` vs. `Decision.actor_human_role`) — Step 9B's job is to keep that distinction visible in the UI, not to establish it, since it already exists in the data.

---

## 7. Evidence/Agent/Human layering map

For the six priority pages, mapped into Production Evidence (A) / Agent Interpretation (B) / Human Decision and Provenance (C).

| Page | A. Production Evidence (existing objects) | B. Agent Interpretation (existing objects) | C. Human Decision and Provenance (existing objects) | Currently visually mixed? | Gap |
|---|---|---|---|---|---|
| VFX Intent | `CoreAnchorRevisionRead` content fields, `constraints`/`variation_zones`/`drift_risks`/`references`/`open_questions`, `IntentDecompositionRead`, `ContextReconstructionRead` (as disclosure-only inputs) | Same objects when `created_by_actor_kind="agent"` (a draft), plus the disclosure list itself | `HumanGateRead`, `DecisionRead` (`rationale`, `confirmed_by_*`), `previousConfirmedRevision`/change summary | Partially — `IntentWorkspacePage.tsx`'s single revision object serves both evidence (once confirmed) and interpretation (while draft); the page does distinguish draft-vs-confirmed status but does not group by A/B/C headings | None in the data — presentational only |
| VFX Alignment | `VersionRead`, `ReviewNoteRead`, `CoreAnchorRevisionRead` (via `revisionsById`) | `CrossRoleAssessmentRead` (`role_perspectives`, `agreements`, `tensions`, `local_optimum_risks`), attached `IntentSignal`, optional `ReAnchorProposal` | `intent_signal`/`re_anchor_proposal` are advisory only, correctly — no Decision object is attached to a `CrossRoleAssessment` at all (by design, Step 6) | No — the existing page already groups by "assessment" as one card; A/B is implicit, not explicit | None in the data |
| CG Execution | `ExecutionAnchorRevisionRead` content fields (confirmed) | Same fields when draft + agent-authored (`created_by_agent_type="cg_supervisor_agent"`), `CGSupervisorReviewRead` | `HumanGateRead`, but **no Decision-rationale fetch exists today** (§5/§6) | Similar to VFX Intent — one revision object serves both roles depending on status | **Real, small gap:** add a Decision-listing call for Execution Anchor confirmation, mirroring VFX's existing `listDecisionsForRevision` |
| CG Version Review | `VersionRead`, `ReviewNoteRead` (Task-scoped) | None directly on this page today — `CGSupervisorReviewRead` is fetched (`cgSupervisorReviews`) but is Execution-Anchor-scoped context, not Version-scoped interpretation | `VersionReviewActions.tsx`'s escalate/generate actions (structural, not a stored Decision on the Version itself) | No | None — `CGSupervisorReviewRead`'s existing display already carries its own `agent_run_id` |
| Artist Current Version | `VersionRead`, `ReviewNoteRead` (Task-scoped), read-only Anchor references | `ArtistAgentGuidanceRead`, `CGSupervisorReviewRead` (context only), `CrossRoleAssessmentRead` | None directly — Artist never confirms an Anchor; the page already never renders a Decision/HumanGate control (confirmed in code, matches role boundary) | Partially — guidance and CG review context render in adjacent, distinctly-headed sections already (`CurrentVersionPage.tsx`'s existing section structure), close to but not labeled as A/B/C | Presentational grouping only |
| Artist Feedback History | `ArtistFeedbackEventRead[]` where `event_type` is Version/ReviewNote-sourced | `ArtistFeedbackEventRead[]` where `event_type` is guidance/CG-review/assessment-sourced | `ArtistFeedbackEventRead[]` where `event_type` is a Decision/escalation/dependency event | No — currently one flat, chronological timeline, by design (a timeline, not a layered view) | `external_author_name` absent on this contract (named limitation, unchanged) |

**Actor/role/rationale/timestamp/supersession data available:** confirmed present on `DecisionRead` (`actor_id`, `actor_human_role`, `rationale`, `supersedes_decision_id`, `created_at` via the generated contract) and `HumanGateRead` (`status`, `opened_at`, `resolved_at`, `required_role`) for every page above except CG Execution's missing Decision-listing call.

**AgentRun/model/prompt/evidence-reference provenance available:** every Agent-output object (`CrossRoleAssessmentRead`, `CGSupervisorReviewRead`, `VFXSupervisorReviewRead`, `ArtistAgentGuidanceRead`, `IntentDecompositionRead`, `ContextReconstructionRead`) carries `agent_run_id`/`context_snapshot_id`; `AgentRunRead` itself carries `provider`/`model_name`/`prompt_version`/`status` **[CODE]** `api.ts:1558-1593`. VFX Intent already fetches and displays this (`getAgentRun`/`getContextSnapshot` in `intent-workspace/data.ts`); the same pattern is directly reusable on the other five pages without a new endpoint.

**Backend or contract gap found:** exactly one — CG's missing Decision-history listing call (frontend-only fix, reusing an existing endpoint shape). No other priority page has a backend or contract gap for this layering.

**Not proposed:** displaying academic research or interview evidence inside any production workspace page, per the task's explicit instruction — this document does not name a location for that content inside `/vfx`, `/cg`, or `/artist`.

---

## 8. Department Execution Overview feasibility

Evaluated for VFX Shot Overview, per Task/Department under a Shot.

| Data point | Currently obtainable? | Source |
|---|---|---|
| Task/Department name | Yes | `TaskRead.name`/`.department`, via `GET /shots/{shot_id}/tasks` (exists, currently called only from `features/{cg,artist}/api.ts`, **not** `features/vfx/api.ts`) |
| Execution Anchor state | Yes | `GET /intent/tasks/{id}/execution-anchor` → `ExecutionAnchorRead.execution_anchor_state` (same shape already exposed on `CgInboxItemRead`) |
| Latest Production Version | Yes | `GET /shots/{shot_id}/versions`, filtered by `task_id` (Step 8C-6/8C-7 compatibility rule already implemented in `@/lib/taskScopedVersions`) |
| Current focus | Yes | `GET /cg/inbox/{task_id}` → `CgInboxItemRead.current_focus` (the same real, tested derivation CG's own Review Inbox uses — never re-derived) |
| Open dependency | Yes | `GET /tasks/{id}/dependencies`, or `CgInboxItemRead.open_dependency_count` directly |
| Current alignment concern | Yes | `CrossRoleAssessmentRead`/`IntentSignal` for the Task's latest Version — already the same object VFX Alignment reads |
| Escalation status | Yes | `TaskDependencyRead` where `kind="escalation"` — the same real object already surfaced in the VFX Review Inbox via `open_cg_escalation_*` |
| Last updated time | Yes | `TaskActivityRead.events[0].occurred_at`, or the latest of the above objects' own timestamps |
| Safe navigation destination | Yes | `/cg/tasks/{task_id}` (Task Overview) or `/vfx/shots/{shot_id}/alignment` (existing routes, no new route needed) |

**All nine data points are obtainable from already-existing backend endpoints.** No new endpoint concept is required — the gap is purely aggregation:

- **[REC]** The smallest trustworthy shape is **one new small backend read model**, e.g. `GET /vfx/shots/{shot_id}/department-overview`, mirroring the existing `CgInboxItemRead`/`VfxInboxItemRead` aggregate-row pattern (itself already precedent for exactly this kind of "one row per real object, several already-real fields projected together" shape — see `VfxInboxItemRead`'s own `generation_ready_task_id`/`latest_version_without_review_id`/`open_cg_escalation_*` additive-optional-field history, Step 7C-3). Doing this as N+1 frontend fetches (list Tasks, then per Task: get Execution Anchor, list dependencies, get activity) is possible but would not scale past a handful of Tasks and would require `features/vfx/api.ts` to call CG-scoped read endpoints directly — functionally safe (reads are not role-gated server-side, confirmed in `features/cg/api.ts`'s own comment: "reads never needed actor headers"), but a worse shape than one aggregate call.
- **[REC]** This read model requires **no migration** — every field is already computed from existing tables; it is a new query/aggregation function plus one new response contract (additive, matching every prior Inbox-item precedent), not a schema change.

**Confirmed constraints, from code, all satisfied by the design above:**
- VFX may inspect and navigate (a link to `/cg/tasks/{id}` or `/vfx/shots/{id}/alignment`), never edit — no mutation endpoint is proposed or reused here.
- No CG Workspace is embedded — the destination is a real navigation, not an iframe/inline render of CG's own page components.
- Identity is based on real Task ids — every data point above is keyed by `Task.id`, never a department-name string match (consistent with the already-locked Step 8B principle: "avoid name-based identity matching").
- Empty/partially-configured Tasks: `CgInboxItemRead`'s own existing fields are already `null`-safe for a Task with no Execution Anchor/Version/dependency (confirmed by reading `cg_inbox`'s current_focus precedence, which has a `"none"` terminal state) — the Department Execution Overview module inherits this honesty for free by reusing the same objects, not by inventing new empty-state logic.

---

## 9. Real ftrack media and external-link feasibility

Method: repository-code evidence first (ICAS `VersionRead`'s own field surface), then real, authenticated, read-only ftrack queries via `FtrackConnector._session` against the controlled trial workspace, reusing the real Shots already linked in Step 8C-8 (`bc0040`, `bc0050`, `bc0030`, `bc0060`, `S1010`-`S1050`). No `session.commit()` or write-capable method was called at any point. No binary media was downloaded. No credential, token, Note content, or signed-URL value is reproduced below — only URL scheme/host/path-shape and aggregate counts.

### ICAS-side (repository code)

`VersionRead` (`packages/contracts/ts/src/generated/api.ts`) has **no** thumbnail/media/component field of any kind — confirmed by a repository-wide grep for `thumbnail`/`component_locations`/`media_url`/`playable` across the generated contracts file: **zero matches**. **[CODE]** This means media information is **not currently persisted** anywhere in ICAS; any Step 9B media capability must be resolved live against ftrack, not read from a stored ICAS field.

### Real ftrack query results **[FTRACK]**

Sampled all 32 real, already-synced `AssetVersion`s across all 9 real linked Shots (the exact same 32 Versions Step 8C-8 synced into ICAS):

| Metric | Count | % |
|---|---|---|
| Total sampled real Versions | 32 | 100% |
| Versions with thumbnail metadata (`thumbnail_id` present) | 32 | 100% |
| Versions with a non-empty `thumbnail_url` field | 32 | 100% |
| Versions with at least one Component | 32 | 100% |
| Versions with at least one `.mp4` (video-shaped) Component | 30 | 93.8% |
| Versions with no usable media context at all (no thumbnail, no Component) | 0 | 0% |

**[CORRECTED — Step 9B-4, see §17]** The row above ("30/32 `.mp4` Component") is **Component/SDK evidence only** — it means the SDK could locate a video-shaped Component, not that a safe browser-facing URL for it exists. It is preserved here unedited as the original, real finding; §17 records why it does not, by itself, mean "playable."

For a real spot-checked subset (`bc0040`'s 5 real Versions, both a `.mp4` and a `.jpg` Component): both `Location("ftrack.server").get_url(component)` calls **succeeded**, each resolving to a real `https://bristol-l.ftrackapp.com/component/get?...` URL. `Component.component_locations` was queried for all 13 sampled components in this sub-check: **13/13** had `location.name == "ftrack.server"` and **13/13** had a non-empty `resource_identifier` — i.e., every sampled component's storage location is real and resolvable, not merely named. **[CORRECTED — Step 9B-4, see §17]** "Succeeded" here meant the SDK call did not raise and returned a URL string — this audit did not inspect that URL's own query parameters. Step 9B-4's implementation did inspect them and found live ftrack API credentials embedded in every such URL; `Location.get_url()` is therefore not a safe browser-facing resolution path in this workspace (§17).

`AssetVersion.thumbnail_url`'s resolved value is itself a real, direct HTTPS URL (`cdn-eu3.ftrackapp.com`, a Thumbor image-resizing proxy wrapping a signed `bristol-l.ftrackapp.com/component/get?id=...&signature=...` link) — a self-contained, pre-signed URL, not one that additionally requires an `Authorization` header from whatever client fetches it. **[FTRACK]** **[INFER]:** this matches ftrack's own standard signed-URL mechanism for exactly this purpose (embeddable directly in an `<img>`/`<video>` tag without further auth) — this task did not open a browser to confirm rendering, since doing so would risk an actual media fetch/download, which this task's instructions forbid.

**Authentication/expiry:** the URL is self-contained (a signature is embedded in the URL itself), but it must be resolved **fresh, server-side, per request** — it is a real ftrack platform behavior that these signed URLs are time-limited (this task did not measure the exact TTL, since doing so would require waiting past expiry and re-testing, out of this audit's scope). **This means a Step 9B media field cannot be a static, persisted ICAS column** — it must be a live read (a new, small, server-side proxy/resolve endpoint called at page-render time), which is itself a small, additive, read-only backend capability, not a data-model change.

**Component/external-link basis:** every synced `Version` already carries an `ExternalEntityLink(entity_type="version", source="ftrack", external_id=<real AssetVersion.id>)` (Step 8C). A safe ftrack web deep link is thus constructible from `FTRACK_SERVER` (already a configured, non-secret-shaped hostname) plus this real `external_id`, following ftrack's standard web-client entity-URL scheme. **[INFER], not independently re-verified by opening a browser in this task** — recorded as a recommendation to validate with one real, harmless click during Step 9B, not as confirmed-working evidence here.

### Honest media capability classification

Per the task's required four-way classification, all four apply, at the following honesty tiers, in order of preference:

1. **Real thumbnail** — **proven feasible**, 32/32 (100%) real sampled Versions.
2. **Real playable media** — **[CORRECTED — Step 9B-4, see §17] not proven browser-safe by this audit**, despite the "proven feasible for the large majority" wording originally used here. 30/32 (93.8%) real sampled Versions had an MP4-like Component the SDK could locate — Component/SDK-level evidence only. This audit did not verify that a Component's resolved URL was safe to hand to a browser; Step 9B-4 later found it was not (§17). The remaining ~6% (non-video Components only) would in any case have fallen back to tier 2/3.
3. **Safe ftrack external link** — feasible for **100%** of synced Versions (every one has a real `external_id`), as a fallback whenever tiers 1-2 are themselves unavailable or undesired (e.g. before a live resolve call has completed). **[CORRECTED — Step 9B-4, see §17]** the link format itself was never independently verified either; Step 9B-4 omitted it rather than guess.
4. **Media unavailable state** — required as an honest terminal state for a real future Version with none of the above (0/32 in this sample, but the real, unmodified manual/demo Versions predating Step 8 have no ftrack linkage at all and must render this state today, unchanged).

**No fake player is recommended.** **[REC]** Step 9B's media module should attempt tier 1/2 live, fall back to tier 3, and only show tier 4 when even the external link is unavailable (i.e., `Version.source != "ftrack"`). **[CORRECTED — Step 9B-4, see §17]** tier 2 (playable) turned out to require a resolution mechanism this workspace cannot expose safely to a browser — see §17 for the implemented, browser-safe capability.

---

## 10. Current Step 8 display limitations

Confirmed directly from code (not re-derived from documentation alone), each cross-referenced to its exact source:

| Limitation | Confirmed in code | Affects Step 9 presentation? |
|---|---|---|
| `Version.task_id` filtering (`task_id == current task OR task_id IS NULL`) | `apps/web/src/lib/taskScopedVersions.ts::isVersionInTaskScope`/`filterVersionsForTask`, applied in `features/cg/version-review-workspace/data.ts` and `features/artist/current-version/data.ts` | **Yes** — Working Direction and Department Execution Overview must reuse this exact filter, never re-derive it |
| VFX Shot-wide behavior | `features/vfx/versions-workspace/data.ts` applies no Task filter (confirmed, no `filterVersionsForTask` import) | **Yes** — VFX's Working Direction/media module must stay Shot-wide, consistent with the rest of that page |
| CG/Artist Task-scoped behavior | Same file as above, both loaders import `filterVersionsForTask` | **Yes** — same reuse applies |
| `source_created_at` ordering | `apps/web/src/lib/effectiveTimestamp.ts::getEffectiveTimestamp`, used in all three roles' Version/ReviewNote sorts | **Yes** — any Step 9B module presenting Versions/Notes chronologically must reuse this helper, never sort by `created_at` alone |
| External author provenance display | `apps/web/src/lib/authorProvenance.ts::getAuthorDisplayText`, already wired into all three roles' Version/ReviewNote detail views | **Yes** — Step 9B's evidence-layering module must reuse this exact helper for any new author-display location, never invent a second convention |
| Artist Feedback History's external-author limitation | `ArtistFeedbackEventRead` has no `external_author_name` field (confirmed absent from the generated contract, §5) | **Yes**, but **out of Step 9A's implementation scope** — a named, pre-existing, unfixed frontend-contract gap; Step 9B should surface it honestly (System provenance) rather than attempt a workaround |
| Direct + `ReviewSessionObject` Note ingestion boundaries | `services/ftrack-connector/src/intent_core_connector/version_note_context.py::read_direct_notes_for_asset_version`/`read_review_session_object_notes_for_asset_version` — confirmed present, forward-direction-only for the RSO path | No — a sync-time concern, not a presentation concern |
| Write-back-marker exclusion | Same file, `WRITE_BACK_MARKER` check in both read functions | No — sync-time only |
| No Version/ReviewNote `SyncCursor` | `services/worker/src/intent_core_worker/tasks.py::reconcile_ftrack_versions_and_notes` — confirmed no `SyncCursor` read/write | No — reconciliation-strategy concern, not presentation |
| Core Anchor controlled write-back boundary | Unchanged, `intent/core_anchor_service.py`'s existing write-back path (Core Anchor confirmation only, human-requested) | No — Step 9B adds no write-back of any kind; this boundary is reused unchanged, never touched |

**No concrete implementation defect was found in this audit** that would justify reopening any settled Step 8 architecture decision. The two "affects Step 9 presentation: yes" items that are genuinely new work (CG's missing Decision-listing call, §6/§7; the VFX Task-listing/Department-overview aggregate, §8) are both small, additive, and consistent with existing patterns — not defects in what Step 8 built.

---

## 11. Exact Step 9B implementation packages

Ordered; each package is independently shippable and independently testable.

### Step 9B-1 — Role-aware Working Direction

- **Exact pages touched:** VFX Shot Overview (`ShotOverviewPage.tsx`), CG Task Overview (`TaskOverviewPage.tsx`), Artist Task Overview (`TaskOverviewPage.tsx`).
- **Existing modules reused:** `VfxInboxItemRead`/`CgInboxItemRead`/`ArtistInboxItemRead` (already fetched by each page today), `CoreAnchorRevisionRead`/`ExecutionAnchorRevisionRead` (already fetched by Intent/Execution/Task Overview loaders — reused, not re-fetched, on the Overview page itself), `@/lib/effectiveTimestamp`, `@/lib/authorProvenance`.
- **New backend read model, endpoint, or contract needed:** none for VFX/Artist (pure frontend composition over already-loaded data, per §6). For CG: one small, additive read — a Decision-listing call for Execution Anchor confirmation, reusing the exact existing `GET /intent/core-anchor-revisions/{id}/decisions` shape against a new, parallel `GET /intent/execution-anchor-revisions/{id}/decisions` endpoint (same service-layer pattern as the existing `listDecisionsForRevision`, applied to the Execution Anchor's own `Decision.entity_type="execution_anchor_revision"` rows, which already exist in the database — this is a read-only endpoint addition, not a schema or contract shape change).
- **Migration needed:** no.
- **Tests required:** a data-loader test per role proving the Working Direction summary's each field traces to the correct real object and reflects "unsupported" honestly when a source object is null; a component test proving Agent-derived fields (Intent Signal, Guidance) render with distinct visual treatment from Human-confirmed fields (Anchor content, Decision rationale).
- **Authority/security risks:** none — read-only; no new mutation; the one new CG endpoint is a read, requiring no actor header, matching the existing convention.
- **Dependencies:** none beyond what Step 8 already delivered.
- **Explicit non-goals:** no new `WorkingDirection` table; no write path; no field not traceable to a real object (§6's "unsupported" rule).
- **Acceptance criteria:** every field in §6's three tables renders from the correct real source or renders its documented honest fallback; Agent interpretation is visually distinguishable from confirmed Decision content on all three Overview pages; existing Overview page tests remain green plus new focused tests.

### Step 9B-2 — Production Evidence / Agent Interpretation / Human Decision layering

- **Exact pages touched:** VFX Intent, VFX Alignment, CG Execution, CG Version Review, Artist Current Version, Artist Feedback History.
- **Existing modules reused:** every object listed in §7's table — all already fetched by the existing loaders for five of six pages.
- **New backend read model, endpoint, or contract needed:** the same one CG Decision-listing endpoint as 9B-1 (shared, not duplicated).
- **Migration needed:** no.
- **Tests required:** a rendering test per priority page proving the three layers are visually/structurally distinguishable (e.g. by DOM section, not merely by color) and that no Agent-authored content renders inside the Human Decision layer or vice versa.
- **Authority/security risks:** none — presentational only.
- **Dependencies:** benefits from 9B-1 existing first (shared CG endpoint) but is independently shippable.
- **Explicit non-goals:** no new Assessment/Decision object; no academic/research evidence surfaced in any production page (per the task's explicit instruction).
- **Acceptance criteria:** all six `01_...md` §8 "Evidence layering" checklist items pass on all six priority pages.

### Step 9B-3 — Department Execution Overview

- **Exact pages touched:** VFX Shot Overview only (per `01_...md`'s own recommended placement, §2.4).
- **Existing modules reused:** `TaskRead`, `ExecutionAnchorRead`, `VersionRead` (Task-scoped filter), `CgInboxItemRead.current_focus`, `TaskDependencyRead`, `TaskActivityRead` — all pre-existing objects and endpoints (§8's table).
- **New backend read model, endpoint, or contract needed:** **yes** — one new aggregate read endpoint (e.g. `GET /vfx/shots/{shot_id}/department-overview`), returning one row per real Task under the Shot, each row an additive-optional-field shape mirroring the existing Inbox-item contracts. This is the one package in this list that is not pure frontend composition.
- **Migration needed:** no — every source field already exists in already-migrated tables.
- **Tests required:** a backend test proving the aggregate correctly reflects each Task's real Execution Anchor/dependency/Version/activity state, including an empty/partially-configured Task's honest state; a frontend test proving VFX can navigate but no edit control renders anywhere in this module.
- **Authority/security risks:** low — read-only; must not expose any CG-only mutation surface to VFX. Enforced by construction (the new endpoint has no corresponding write path).
- **Dependencies:** none.
- **Explicit non-goals:** no CG Workspace embedding; no department-name-based Task matching (real `Task.id` only); no edit control.
- **Acceptance criteria:** all five `01_...md` §8 "Department overview" checklist items pass.

### Step 9B-4 — Media / thumbnail / ftrack context

- **Exact pages touched:** VFX Versions page (Production Version details), and/or VFX Shot Overview, and/or Artist Current Version — per `01_...md` §2.1's own instruction to pick **one** location, not all three.
- **Existing modules reused:** `Version.source`/`external_id` (via the existing `ExternalEntityLink`), the Task-scoped/Shot-wide Version lists already loaded by each candidate page.
- **New backend read model, endpoint, or contract needed:** **yes** — one new, small, read-only server-side resolve endpoint (e.g. `GET /versions/{id}/media`) that, given a `Version` with `source="ftrack"`, opens a real `FtrackConnector` session, resolves `thumbnail_url` (and, when a `.mp4` Component exists, its `Location.get_url()`), and returns those URLs fresh — never persisted, never cached past the request, consistent with §9's finding that these are time-limited signed URLs. **[CORRECTED — Step 9B-4, see §17]** `Location.get_url()` must **not** be used for this purpose — Step 9B-4's implementation found it embeds live ftrack API credentials in the returned URL. Only `thumbnail_url` is a safe, credential-free field in this workspace's real schema.
- **Migration needed:** no schema change to `Version`/`ReviewNote` — this endpoint reads live from ftrack, it does not add a stored column.
- **Tests required:** a mocked-connector test proving the endpoint's classification logic (tier 1/2/3/4 per §9) is correct for each real case (video present, thumbnail-only, external-link-only, `source="manual"`); an explicit test that no request is made to ftrack for a `source="manual"` Version.
- **Authority/security risks:** the new endpoint makes a real, per-request ftrack call — must be rate-considered (not gated on every list-page render, only on explicit user action or a single detail view) to avoid hammering the real ftrack API; must never expose the raw signed URL's signature in a way that outlives the response (no risk beyond what ftrack's own signed-URL mechanism already accepts).
- **Dependencies:** none beyond Step 8's existing `FtrackConnector`/`ExternalEntityLink`.
- **Explicit non-goals:** no video editor; no cross-Version visual diff; no player repeated on every page (per `01_...md`'s own explicit "do not" list).
- **Acceptance criteria:** all five `01_...md` §8 "Media preview" checklist items pass; the honest four-tier classification (§9) is visible in the UI, never defaulted to "fully synced" when only tier 3/4 is actually available.

---

## 12. Step 9C visual-unification boundaries

Not designed in this task (out of Step 9A's scope). Recorded here only as a boundary for whoever scopes Step 9C:

- Step 9C is a **design-system and visual-unification pass** over the IA Step 9A confirms is locked (§3) — it may restyle, it may not restructure. No route, tab set, or sidebar item named in §3/§4 is a Step 9C input for removal or renaming without a newly-discovered, concrete defect (the task's own constraint, unchanged).
- Step 9C should follow, not precede, Step 9B — several Step 9B modules (Working Direction, evidence layering, Department Overview, media) introduce new compact UI regions that a visual-unification pass should style once, not twice.
- Step 9C is out of this document's implementation-package detail (§11) by the task's own explicit instruction ("Do not implement Working Direction... Do not modify frontend pages or visual styles" applies to Step 9A itself, and Step 9C is explicitly a later, separate step in the same locked sequence, §14 of `01_...md`).

---

## 13. Step 9D–9F evaluation and closeout sequence

Not designed in this task; recorded only as the locked downstream sequence from `01_...md` §4 and `docs/IMPLEMENTATION_STATUS_AND_ROADMAP.md` §L:

- **Step 9D — Student usability testing.** Depends on Step 9B (and likely Step 9C) being real and navigable; out of this audit's scope to plan test scripts.
- **Step 9E — Synthetic role evaluation.** Depends on Step 9B; likely reuses the existing per-role demo-identity mechanism (`DEMO_ROLE_COOKIE`, `enterDemoRole`) already confirmed in §3 — no new identity mechanism is anticipated, but this is a recommendation for the step that actually scopes 9E, not a finding of this audit.
- **Step 9F — Final Demo, recording, Evidence Deck, and portfolio closeout.** Depends on 9B-9E; this document's own evidence-type distinctions (§ preamble) are offered as a reusable convention for whichever document eventually assembles the Evidence Deck, consistent with `docs/VALIDATION_EVIDENCE.md`'s existing discipline.

---

## 14. Risks and authority boundaries

- **Authority:** every Step 9B-1/9B-2/9B-3 package is read-only; the one new mutation-adjacent surface risk (Step 9B-3's navigation from VFX into CG-scoped context) is structurally a link, not an embed or a proxy write — confirmed no existing VFX-side mutation endpoint exists for Execution Anchor content anywhere in `features/vfx/api.ts` (§5), so there is no accidental write surface to expose.
- **Security:** Step 9B-4's new media-resolve endpoint is the only package that makes a new real external (ftrack) call at request time — rate/frequency consideration is named in §11 as a design constraint for whoever implements it, not resolved here.
- **Role boundary risk:** the CG Decision-listing endpoint (9B-1/9B-2) is a read; it must not be given to Artist without checking `ROLE_PERMISSIONS.md`'s existing boundary (Artist does not see Anchor confirmation rationale today, §5) — Step 9B must preserve that, not extend Decision visibility to a role that does not currently have it, unless a separate, explicit decision is made.
- **Data-honesty risk:** the single largest risk this audit identifies is Step 9B-4 accidentally implying "all ftrack Versions are fully media-available" — §9's own aggregate (30/32, not 32/32, had an MP4-like Component **[CORRECTED — Step 9B-4, see §17]**: not the same claim as "30/32 have playable media," which this audit's own wording conflated) and the pre-Step-8 manual/demo Versions (0% ftrack-linked) make this a real, current, mixed population; the four-tier classification (§9) exists specifically to prevent this overclaim. Step 9B-4's implementation found the risk was in fact larger than this audit anticipated: not merely "will Step 9B-4 overclaim availability," but "the one mechanism this audit recommended for tier 2 is itself unsafe" (§17).

---

## 15. Explicit non-goals

Restated from the task and from `01_...md`, not expanded:

- No Working Direction implementation in this task.
- No frontend page or visual style change in this task.
- No database table or migration in this task.
- No API endpoint added or changed in this task.
- No Agent prompt or runtime change in this task.
- No Step 9B, Step 9C, or Step 9 evaluation begun in this task.
- No redesign or replacement of the existing information architecture.
- No global role switcher, combined-role Shot page, CG-embedded-in-VFX, Review-Inbox-as-catalogue, or tab merge/rename proposed anywhere above.
- No fake media player recommended.
- No academic/research evidence recommended for display inside a production workspace page.
- No claim that this audit's real ftrack sampling constitutes a second, independent Step 8 acceptance run — it reuses the same real, already-synced 32 Versions Step 8C-8 produced, adding new field-level queries against them, not a new reconciliation.

---

## 16. Readiness verdict for Step 9B

**Ready.** Every Priority 1 item (`01_...md` §5) — Role-aware Working Direction, Evidence/Agent/Human layering, Department Execution Overview — is buildable from existing authoritative objects with at most one small, additive, read-only backend endpoint each (a Decision-listing call for CG, and one new aggregate for Department Execution Overview). The one Priority 2 item audited in depth (media/thumbnail/ftrack context) has real, positive, load-bearing evidence from a live read-only ftrack query performed in this task: 100% thumbnail feasibility, 93.8% Component-availability feasibility **[CORRECTED — Step 9B-4, see §17]** (originally written as "93.8% playable-media feasibility" — corrected: Component availability and proven browser-safe playability are different claims), 100% external-link-identity feasibility (not "external-link *URL*" feasibility — the web link format itself was never verified, §17), across all 32 real synced Versions — high enough to proceed, provided Step 9B implements the honest four-tier classification (§9) rather than assuming uniform media availability.

No concrete Step 8 implementation defect was found; no reason exists to reopen Step 8's architecture. No IA, role boundary, or tab structure requires alteration to build Step 9B as scoped.

---

## 17. Post-implementation correction (Step 9B-4 security finding)

Added during Step 9B-4's own documentation closeout, after real implementation and a real, read-only ftrack probe exposed a distinction this audit's original wording did not draw carefully enough. **Nothing above this section was deleted or rewritten** — every original number, query, and finding stands as originally recorded; this section narrows what those findings actually prove.

**The original overclaim, precisely:** §9 and its downstream references (§1, §11, §14, §16) used "playable," "resolvable," and "feasible" to describe two different things without distinguishing them:

1. **Component/SDK evidence** (what this audit actually measured): whether ftrack's Python SDK could locate an MP4-like `Component` for a Version, and whether calling `Location.get_url()` on it returned a URL string without raising an exception. **This part of the finding is correct and unchanged: 30/32 (93.8%) real sampled Versions had such a Component, and the SDK call succeeded for every one spot-checked.**
2. **Browser-safe playability** (what "real playable media" was written as if it meant): whether that URL is actually safe to hand to a browser. This audit explicitly noted it "did not open a browser to confirm rendering" (§9) — but its own summary language ("proven feasible," "100% ... playable-media feasibility") read as if rendering safety had already been established. It had not.

**What Step 9B-4's own implementation found, closing that gap:** inspecting the actual query parameters of a `Location.get_url()`-resolved URL (not merely whether the call succeeded) showed it embeds the calling process's own live ftrack API user and API key as literal query parameters — a real, working credential, not a scoped signature. No credential-free equivalent exists on `Component`'s real schema in this workspace. The one field that *is* credential-free and server-signed (`AssetVersion.thumbnail_url`) is exactly the one this audit's own §9 prose had already, separately, correctly described as "self-contained... not... requiring an Authorization header" — this audit found the right field but did not connect it to the wrong one being unsafe, since it never inspected `Location.get_url()`'s actual output.

**Corrected, browser-safe capability** (superseding every "playable"/"30/32"/"93.8%" figure above for the purpose of what Step 9B-4 actually implements and ships):

| Metric | Count |
|---|---|
| Real linked Versions resolving to `thumbnail_only` (safe) | 32 |
| Manual/local Versions resolving to `unavailable` | 2 |
| `playable` (safely browser-resolvable today) | 0 |
| `external_context_only` | 0 |
| Resolution failures | 0 |

Full detail, the exact defect, its containment, and the post-rotation re-verification are recorded in `docs/step-9/06_STEP_9B4_REAL_MEDIA_AND_FTRACK_CONTEXT.md` §3/§7/§15.

**Why this is a reclassification, not a retraction:** every real query this audit ran, and every count it reported, remains true and reproducible — Components are real, the SDK does locate them, `Location.get_url()` does not raise. What changes is the *label* applied to that evidence: "the SDK can resolve a Component" is Component/SDK evidence; "this is safe to render in a browser" is a separate, stronger claim this audit did not actually test and should not have implied it had.
