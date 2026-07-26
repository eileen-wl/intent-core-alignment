# IMPLEMENTATION_STATUS_AND_ROADMAP.md

**Project:** Intent Core Alignment System
**Document type:** Repository status baseline and locked future roadmap
**Status:** Source of truth for "what is actually implemented" and "what comes next, in what order"
**Baseline established:** Step 0A, against branch `chore/step0-baseline-roadmap`, evaluated at commit `babb916`

This document exists because `docs/TEAM_WORKFLOW.md` §2 requires shared knowledge to live in the repository, not in personal conversations. It replaces any informal, conversational description of "the roadmap" with one committed document. It must be kept current as future steps land — this is a living status document, not a one-time snapshot.

---

## A. Canonical architecture

ICAS is built around exactly four Agents, organised as:

```
Core Agent
    +
Role Layer
    ├── VFX Supervisor Agent
    ├── CG Supervisor Agent
    └── Artist Agent
    +
Dashboard (shared human control surface)
```

This structure is fixed. It must not be reinterpreted, and no future step may collapse the Role Layer into the Core Agent or treat the Core Agent as a stand-in for any Role Agent.

### Authority table

| Actor | Kind | Advisory or authoritative | May confirm/reject an Anchor or Decision? | May write to ftrack? |
|---|---|---|---|---|
| **Core Agent** | Agent | Advisory only | No | No |
| **VFX Supervisor Agent** | Agent (not implemented) | Advisory only (by design, once built) | No | No |
| **CG Supervisor Agent** | Agent (not implemented) | Advisory only (by design, once built) | No | No |
| **Artist Agent** | Agent (not implemented) | Advisory only (by design, once built) | No | No |
| **Human VFX Supervisor** | Human | Authoritative | Yes — Core Anchor confirm/reject; Alignment Assessment accept/reject | Yes — Core Anchor write-back, human-requested |
| **Human CG Supervisor** | Human | Authoritative | Yes — Execution Anchor confirm/reject (backend only; no frontend yet) | Within CG authority (not yet implemented) |
| **Human Artist** | Human | Non-authoritative (cannot confirm/modify Anchors) | No | No |

This table is a direct restatement of `docs/ROLE_PERMISSIONS.md` §2–3, not a new policy. It is included here so the current implementation status (section C onward) can be checked against it without cross-referencing multiple documents.

---

## B. Critical terminology boundaries

The following statements are non-negotiable and must be treated as guardrails for every future implementation step and every future status report:

- **Core Agent != VFX Supervisor Agent.** Core Agent is the system-level intent control centre (`docs/AGENT_CONTRACTS.md` §4). It is not a generic name for "the VFX side" of the system, and it is not a placeholder that stands in for the VFX Supervisor Agent until the latter is built.
- **Human Gate != Role Agent.** A human (VFX Supervisor, CG Supervisor, or Artist) confirming, rejecting, accepting, or requesting write-back through a Human Gate is a human-authority workflow. It does not prove that the corresponding Role Agent exists. Today's Human Gates (Core Anchor confirm/reject, Alignment Assessment accept/reject) are exercised entirely by **humans**, not by any Agent.
- **ContextSnapshot != Context Reconstruction.** `ContextSnapshot` (implemented, `agents/models.py`) is runtime provenance — an immutable record of exactly what local data one Agent Run was given. It is not the Core Agent's documented "Context Reconstruction" product capability (`docs/AGENT_CONTRACTS.md` §4, `docs/PRODUCT_SCOPE.md` §6.3), which is a structured, human-readable summary object with its own output shape. No such summary object exists yet.
- **Core Agent Alignment Assessment != VFX Supervisor Agent's role-specific creative review.** The implemented `alignment_assessment` capability is Core Agent's own, general-purpose capability (`docs/AGENT_CONTRACTS.md` §4: "Alignment Assessment... Produces: structured Alignment Assessment"). It is a different, documented capability from the VFX Supervisor Agent's "creative-alignment Assessment" (`docs/AGENT_CONTRACTS.md` §5), which is specifically story/emotion/rhythm/visual-focus dimensioned and does not exist in code.
- **Execution Anchor backend != CG Supervisor Agent.** The Execution Anchor confirm/reject/draft backend (`intent/execution_anchor_service.py`) is fully implemented and is exercised by the **human** CG Supervisor. A permission allowlist entry exists that *would* allow a `cg_supervisor_agent`-typed actor to create a draft, but no such actor is ever constructed by any production code path.
- **AgentType reservation != Agent implementation.** `vfx_supervisor_agent`, `cg_supervisor_agent`, and `artist_agent` are all valid values of the `AgentType` `Literal` (`apps/api/src/intent_core_api/workflow/actors.py`). A name existing in this type, in a document, in a code comment, in a test helper, or in a permission allowlist is **not** evidence that the corresponding Agent is implemented. The only valid evidence of implementation is: a real generator/service function, a real capability constant, a real prompt or deterministic behaviour, a reachable production code path that calls `build_agent_actor(...)` with that type, a persisted `AgentRun` row using that type, an API endpoint, and — where applicable — a UI surface.

---

## C. Current real Agent count

**The repository currently implements exactly one (1) real Agent: Core Agent.**

Evidence:

- `build_agent_actor()` (`apps/api/src/intent_core_api/workflow/actors.py:91`) is the only function in the codebase capable of constructing an `agent`-kind `ActorContext`.
- Across all of `apps/api/src`, it is called exactly once, in `apps/api/src/intent_core_api/agents/core_agent_service.py:270`, always with the literal `"core_agent"`.
- Every `AgentRun` row this codebase can currently produce therefore has `agent_type="core_agent"` (also written explicitly at `agents/core_agent_service.py:250` and `agents/alignment_assessment_service.py:349`).
- No other `AgentType` value is ever written by production code.

Per-Agent status:

| Agent | Status | Evidence |
|---|---|---|
| **Core Agent** | Implemented (4 of ~6 documented capabilities) | `agents/core_agent_service.py` (`core_anchor_drafting`), `agents/alignment_assessment_service.py` (`alignment_assessment`), `agents/intent_decomposition_service.py` (`intent_decomposition`, Step 1B — merged to `main`, commit `fc233bd`), `agents/context_reconstruction_service.py` (`context_reconstruction`, Step 1C — implemented and validated on `feat/step1c-context-reconstruction`, pending merge to `main`); all four use `ContextSnapshot`/`AgentRun`; deterministic provider for all four, real DeepSeek provider proven for Alignment Assessment, Intent Decomposition, and Context Reconstruction |
| **VFX Supervisor Agent** | Not started | `vfx_supervisor_agent` appears only in the `AgentType` `Literal` and its mirrored contracts (`packages/contracts/python/.../agents/envelope.py`, `packages/contracts/ts/src/generated/api.ts`). No service file, capability, generator, prompt, `AgentRun` path, API, test, or UI references it. |
| **CG Supervisor Agent** | Permission scaffolding only | `apps/api/src/intent_core_api/intent/execution_anchor_service.py:78`: `_DRAFT_CREATE_AGENT_TYPES = frozenset({"cg_supervisor_agent"})`, consumed at line 119. The only place this actor is ever actually constructed is `apps/api/tests/test_execution_anchor_service_actor_kinds.py` (`build_agent_actor("cg_supervisor_agent", ...)`) — a unit test proving the permission system's tolerance, not a real capability. No generator, prompt, `ContextSnapshot` use, `AgentRun` row, API, or UI exists for it. |
| **Artist Agent** | Not started | `artist_agent` appears only in the `AgentType` `Literal` and mirrored contracts. No permission allowlist even references it (unlike CG Supervisor Agent), no service file, no capability, no test construction, no UI. |

---

## D. Completed implementation inventory

Commit hashes below are taken directly from `git log --oneline` on branch `chore/step0-baseline-roadmap` at the time this document was written. They are exact, not assumed.

| Slice | Commit | Correct architectural owner/category | What it proves | What it does not prove |
|---|---|---|---|---|
| A1 Core Anchor workflow | `1553a43` feat: implement A1 primary intent workflow | Human authority / shared domain (Intent module) | A full Core Anchor (`CoreAnchor`/`CoreAnchorRevision`) draft→confirm/reject→supersede lifecycle exists, gated to the human VFX Supervisor | Does not prove Core Agent or VFX Supervisor Agent exists — A1's draft creation is human-authored at this stage |
| A2 Execution Anchor workflow | `f2eac72` feat: implement A2 execution anchor workflow | Human authority / shared domain (Intent module) | A full Execution Anchor lifecycle exists, gated to the human CG Supervisor, including the stale-propagation cascade from Core Anchor confirmation | Does not prove CG Supervisor Agent exists; does not prove a frontend Human Gate UI exists for this workflow (it does not, see section G) |
| ftrack sync/write-back infrastructure | `2b27fca` feat: implement ftrack sync and writeback workflow | Workflow Connector (ftrack integration) | Real Project/Shot/Task sync and controlled, human-requested Core Anchor write-back both work end-to-end | Does not prove Version/ReviewNote sync from ftrack (not implemented); does not prove any Agent capability |
| D0 contracts pipeline | `daf05fb` feat: generate TypeScript contracts from OpenAPI | Shared runtime / infrastructure | OpenAPI → generated TypeScript contracts pipeline works and is re-run at every subsequent slice | Does not prove any product capability by itself |
| UTC timestamp fix | `91070b3` fix: align timestamp columns with UTC | Shared runtime / infrastructure | A real Postgres timezone-awareness defect was found and fixed | Not an Agent- or Human-Gate-related change |
| D1 Shot Anchor page | `ad5dff4` feat: implement D1 Shot Anchor page | UI / presentation layer | The first real frontend page exists, proving apps/web ↔ apps/api ↔ Postgres works end-to-end | Does not prove any Agent or Human Gate exists yet at this commit — those were added by later slices on top of this page |
| B1 Core Agent drafting | `2756322` feat: implement B1 Core Agent draft generation | Core Agent capability | The first real Agent capability (`core_anchor_drafting`), with a deterministic provider, `ContextSnapshot`, and `AgentRun`, attributed to `agent_type="core_agent"` | Does not prove any Role Agent exists; does not prove a real (non-deterministic) model provider for this specific capability — it still has none |
| A3 Human Gate UI | `320af92` feat: implement A3 Human Gate UI | Human authority / Human Gate (UI) | A real Core Anchor confirm/reject UI (`CoreAnchorGate`) exists, gated in the frontend to the VFX Supervisor role selection and enforced authoritatively by the backend | Does not prove VFX Supervisor Agent exists — this is a human interaction surface, not an Agent |
| ContextSnapshot + AgentRun | `65ad62d` feat: add context snapshots and agent runs | Shared Agent Runtime foundation | Immutable input/output provenance now exists for Core Agent runs | Does not itself constitute "Context Reconstruction" (see section B) and does not prove any additional Agent exists |
| Version + ReviewNote | `c6c7d6e` feat: add versions and review notes | Shared domain object | Manual-creation-only `Version`/`ReviewNote` objects exist with full lineage fields | Does not prove ftrack sync for these objects (not implemented) |
| Alignment Assessment | `05ec741` feat: add alignment assessment capability | Core Agent capability | A second real Core Agent capability, with a deterministic provider **and a real DeepSeek provider**, correctly attributed to `agent_type="core_agent"` per `docs/AGENT_CONTRACTS.md` §4 | Does not prove VFX Supervisor Agent's own, distinct "creative-alignment Assessment" capability exists — it does not |
| Alignment Assessment Decisions | `8917efb` feat: add alignment assessment decisions | Human authority / Human Gate | Human VFX Supervisor accept/reject for Alignment Assessment, plus real Decision supersession (`Decision.supersedes_decision_id`) is now wired and tested | Does not prove any Agent resolves this gate — `decision_service.record_decision` hard-rejects any non-human actor |
| Version / Assessment UI | `babb916` feat: add alignment assessment review UI | UI / presentation layer | Shot page Versions list, Version detail page, Assessment display, generation button, Human Gate UI, and supersession labelling all exist and are tested | Does not prove any Role Agent, Dashboard, or role-aware view exists — this is a single generic page, not the multi-role Dashboard described in `docs/PRODUCT_SCOPE.md` §13 |
| Step 1A-Backend Core Anchor semantic objects | `173f32e` feat: add core anchor semantic objects | Human authority / shared domain (Intent module) | Five ordered, revision-owned semantic-child tables (`Constraint`, `VariationZone`, `DriftRisk`, `AnchorReference`, `OpenQuestion`; migration `0014_core_anchor_semantic_objects.py`) exist, each belonging to exactly one `CoreAnchorRevision`, writable only while that revision is `draft`, immutable once confirmed/rejected/superseded, returned as empty arrays when absent, with real-HTTP-validated PATCH replace/omit/clear semantics and meaningful (not count-only) before/after `AuditEvent` content | Does not prove Step 1A-UI exists on its own (see next row); does not prove Core Agent Intent Decomposition, Core Agent Context Reconstruction, or a persistent `HumanGate` object exist (Step 1B/1C/1D, all still not started); does not prove any Role Agent exists |
| Step 1A-UI Core Anchor semantic editors | Merged to `main` via PR #7, merge commit `2d1101f` (`4e544dd` feat: add core anchor semantic editors; `cc18fc4` style: format intent module readme) | UI / presentation layer | The existing Shot Anchor page's Core Anchor Human Gate (`CoreAnchorGate`) now lets the Human VFX Supervisor view/add/edit/remove/move up/move down/save/cancel all five semantic collections (Must preserve/Allowed variation/High-risk drift points/References/Open questions) on a draft revision, inside the existing draft workflow — no new route, no new endpoint; preserves the backend's dirty-collection PATCH contract (omitted = unchanged, empty = clear, populated = replace) and uses the server-returned revision as the new frontend source of truth; a successful save shows an accessible "Changes saved." status, Save shows "Saving…" and is disabled while pending, a failed save preserves unsaved content, and Cancel restores the last server-known state; Human CG Supervisor and Human Artist see a read-only "Draft details" view (all scalar fields and all five semantic collections, no edit controls) instead of a disabled form; confirmed revisions render all five collections read-only | Does not prove Core Agent Intent Decomposition, Core Agent Context Reconstruction, or a persistent `HumanGate` object exist beyond what is separately recorded below; does not prove any Role Agent exists |
| Step 1B Core Agent Intent Decomposition | Merged to `main` via PR #8, merge commit `cd24eaf` (`fc233bd` feat: add core agent intent decomposition) | Core Agent capability + Human authority workflow | A third real Core Agent capability (`intent_decomposition`, migration `0015_intent_decomposition.py`) structures an `IntentBrief` into an immutable `IntentDecomposition` (core intent summary, anchor-relevant content, exactly seven dimensions each with summary+rationale, candidate constraints, candidate variation zones, contextual information, uncertainties) with its own `ContextSnapshot`/`AgentRun`, deterministic provider for automated tests and a real DeepSeek provider for manual validation; generating a decomposition never creates or modifies a Core Anchor; a new, explicitly human-triggered action (`create_core_anchor_draft_from_decomposition`, Human VFX Supervisor only) maps a chosen decomposition's fields into a fresh, fully editable `CoreAnchorRevision` draft, stamping `source_intent_decomposition_id` for lineage, without a second model call and without creating a `Decision`; the existing direct Core Anchor generation path remains backend-compatible but is demoted from the primary UI position | Does not prove Core Agent Context Reconstruction or a persistent `HumanGate` object exist beyond what is separately recorded below; does not prove any Role Agent exists; does not prove Step 1 as a whole is complete |
| Step 1C Core Agent Context Reconstruction | Pending merge to main — implemented and validated on `feat/step1c-context-reconstruction` | Core Agent capability | A fourth real Core Agent capability (`context_reconstruction`, migration `0016_context_reconstruction.py`) produces an immutable, model-generated interpretation of the exact local facts recorded in a fresh `ContextSnapshot` (project/shot identity, current IntentBrief, all IntentDecompositions, current draft and/or confirmed Core Anchor revision with its semantic children and decomposition lineage, Execution Anchor state, relevant recorded human Decisions, Version/ReviewNote metadata) — answering "why are we doing it this way?" without ever judging Version alignment/drift, role performance, or recommending a re-anchor; every structured conclusion (`original_intent`, `current_creative_direction`, `execution_context`, and each `key_decisions`/`active_constraints`/`allowed_variations`/`unresolved_questions` entry) cites one or more evidence references back to real ids in that same snapshot; deterministic provider for automated tests, real DeepSeek provider proven by manual acceptance | Does not prove Step 1C has been merged to `main`; does not prove a persistent `HumanGate` object exists (Step 1D, still not started); does not prove any Role Agent exists; does not prove Step 1 as a whole is complete |

---

## E. Manual validation evidence supplied by the project owner

The following validations were reported by the project owner as having been executed manually, outside the automated test suite. They are recorded here because they are relevant project history, but **they are not independently provable from Git history or repository state alone** — no artifact of their execution (e.g., a logged transcript, a screenshot, an exported response body) is committed to this repository. They are recorded as owner-supplied claims, not as repository-verified facts. See `docs/VALIDATION_EVIDENCE.md` for the structured evidence table and explicit evidence-type labelling.

1. **Real ftrack sync** — real Project/Shot/Task data was synchronised from a real ftrack workspace; Shot `bc0040` appeared in ICAS with `source=ftrack`; the reconciliation worker job (`reconcile_ftrack_shots`) completed successfully.
2. **Real ftrack controlled write-back** — a confirmed Core Anchor revision produced exactly one ftrack Shot Note on target Shot `bc0040`; no existing Note was overwritten; the write-back was triggered by a human VFX Supervisor's Decision/request (`request_write_back=True` on confirm), not automatically.
3. **Real DeepSeek Alignment Assessment** — a real (non-deterministic) call was made with `provider=deepseek`; the resulting `AgentRun.status=succeeded`; the produced `AlignmentAssessment.alignment_state=significant_drift`; `envelope.requires_human_gate=true`; the evidence field referenced the confirmed Core Anchor, the Version description, and a Review Note; no Anchor or ftrack state was modified by the call.
4. **Decision supersession** — a later human Decision was recorded that superseded a prior active Decision (`supersedes_decision_id` populated correctly); the old Decision remained unmodified and independently readable via `GET /assessments/{id}/decisions`.
5. **Browser validation** — the Version page correctly rendered Version fields, Review Notes, the confirmed Core Anchor summary, Alignment Assessments, AI provenance (agent type/provider/run status/context snapshot), the Human Gate, and the supersession labels ("Superseded by a later decision" / "Supersedes decision `<id>`").
6. **Step 1A-Backend Core Anchor semantic objects — real HTTP API acceptance.** Unlike items 1–5 above, this validation is *self-supplied within this repository's own tooling*, not an external-system claim — but it still used a real running process and real HTTP requests, not `TestClient`, so it is recorded with the same discipline. A real `uvicorn` process was started against an isolated, temporary SQLite database (never `apps/api/dev.db`, never the developer's PostgreSQL database), with `MODEL_PROVIDER=deterministic` and no ftrack credentials loaded. Against that process: a synthetic Project/Shot/IntentBrief/Core Anchor draft was created; all five semantic collections (`constraints`/`variation_zones`/`drift_risks`/`references`/`open_questions`) were created with server-generated ids/`order_index`/`created_at`; a PATCH correctly distinguished an omitted collection (unchanged), an explicit empty list (cleared), and a populated list (fully replaced); the resulting `AuditEvent` recorded normalized before/after content, not counts; a blank required value returned 422; Human CG Supervisor and Human Artist both received 403; confirming the revision and then attempting to PATCH it again returned 409 with all semantic content unchanged; a second revision created afterward returned five empty collections and shared no child row with the first; editing semantic content created no `AgentRun`/`ContextSnapshot`/`ExecutionAnchor`/`ExecutionAnchorRevision`/`WritebackRecord`; confirming with `request_write_back=false` created exactly one human `Decision` and no `WritebackRecord`. See `docs/VALIDATION_EVIDENCE.md` for the structured table entry and the exact scenario list.
7. **Step 1A-UI Core Anchor semantic editors — browser acceptance.** The project owner manually verified, in a real browser session against the Step 1A-UI implementation on `feat/step1a-core-anchor-semantics`: all five semantic editors rendered under the current Core Anchor draft; the Human VFX Supervisor could add and edit sentence-length content, and the add/remove/reorder controls worked; the Reference editor's label, optional URI, and optional note all rendered and saved correctly; Open Question reordering was preserved; blank required content was blocked by client-side validation; Save persisted the data and displayed "Changes saved."; making a further edit cleared that prior success status; Cancel restored the last server-saved values; the Human CG Supervisor saw a read-only "Draft details" view with actor id `cg-1`, and the Human Artist saw the corresponding read-only view with actor id `artist-1` — neither received any semantic or scalar editing control; a manually-entered custom Actor id was preserved across role changes within the same page session, and a full browser refresh restored the current role's default Actor id; confirming the draft preserved all semantic collections and rendered them read-only; no ftrack write-back was requested; and browser use did not modify any repository file. See `docs/VALIDATION_EVIDENCE.md` for the structured table entry and the full 17-item scenario list. As with item 6, this is not independently provable from Git history alone.
8. **Step 1B — Real DeepSeek Intent Decomposition acceptance.** A real (non-deterministic) `provider=deepseek`, `model=deepseek-v4-flash` call was made against a dedicated local acceptance Shot (`D1_STEP1B_ACCEPTANCE_001`), exactly one model call; `AgentRun.status=succeeded`; all seven dimensions had non-blank summary and rationale; candidate constraints, candidate variation zones, and contextual information were all populated; uncertainties was an explicit empty list; the `ContextSnapshot` payload contained exactly `project`/`shot`/`intent_brief`/`tasks`; no Core Anchor or `CoreAnchorRevision` was created during generation; no `Decision`, `WritebackRecord`, Role Agent run, or ftrack network call occurred. See `docs/VALIDATION_EVIDENCE.md` for the structured table entry, the local evidence ids, and the security note covering the local `.env` handling during this acceptance run.
9. **Step 1B — Decomposition-to-Core-Anchor browser acceptance.** The project owner manually verified, in a real browser session: the real DeepSeek decomposition appeared after Intent Brief and before Core Anchor, labelled "AI proposal — Core Agent"; provider, succeeded run status, and `ContextSnapshot` provenance were visible; all seven dimensions and rationales rendered; five candidate Must-preserve items and three candidate Allowed-variation items rendered; contextual information rendered; uncertainties displayed an explicit empty state; the Human VFX Supervisor explicitly used the decomposition, creating a new editable `CoreAnchorRevision` draft with visible source-decomposition lineage; scalar fields mapped from the selected decomposition; exactly five Constraints and three VariationZones were created, with no DriftRisk, AnchorReference, or OpenQuestion invented; the generated draft content remained editable, with working save feedback and persistence; the draft remained unconfirmed, with no automatic Decision or ftrack write-back; the existing-draft conflict check prevented a silent duplicate overwrite; browser actions did not modify any repository file. See `docs/VALIDATION_EVIDENCE.md` for the structured table entry and the full 20-item scenario list. As with items 6 and 7, this is not independently provable from Git history alone.
10. **Step 1C — Real DeepSeek Context Reconstruction acceptance.** A real (non-deterministic) `provider=deepseek`, `model=deepseek-v4-flash` call was made against the same dedicated local acceptance Shot used for item 8 (`1e433dca-5a9e-46c1-9f6d-25938af49efd`, `D1_STEP1B_ACCEPTANCE_001`), exactly one model call; `AgentRun.status=succeeded`; all required output sections (`context_summary`, `original_intent`, `current_creative_direction`, `execution_context`, `key_decisions`, `active_constraints`, `allowed_variations`, `unresolved_questions`, `context_gaps`) were present; 11 structured items were validated with non-blank summary/rationale; 18 evidence references all resolved to real ids in the saved `ContextSnapshot`; the output correctly described the Core Anchor as an unconfirmed draft, not a confirmed direction; the output made no unsupported alignment, drift, pass/fail, role-judgment, or re-anchor claim; missing facts (no Execution Anchor, no Decision, no Version) were represented honestly through `execution_context` and an explicit `context_gaps` list, not omitted or invented; no `IntentBrief`/`IntentDecomposition`/`CoreAnchor`/`CoreAnchorRevision`/semantic-child/`ExecutionAnchor`/`Decision`/`AlignmentAssessment`/`Version`/`ReviewNote`/`WritebackRecord` was created, modified, confirmed, rejected, or deleted; only one `ContextSnapshot`, one Core Agent `AgentRun`, and one `ContextReconstruction` were created; no Role Agent run and no ftrack network call occurred. See `docs/VALIDATION_EVIDENCE.md` for the structured table entry and the local evidence ids.
11. **Step 1C — Context Reconstruction browser acceptance.** The project owner manually verified, in a real browser session: the Context reconstruction section appeared after Core Anchor and before Execution Anchors; the output was labelled "AI reconstruction — Core Agent"; provider, succeeded run status, and `ContextSnapshot` provenance were visible; the context summary rendered; original intent rendered with rationale and evidence; current creative direction correctly described the Core Anchor as an unconfirmed draft; execution context correctly stated that no Execution Anchors existed; key decisions displayed an explicit empty state; five active constraints and three allowed variations rendered; unresolved questions displayed an explicit empty state; five context gaps rendered; evidence references rendered beneath every structured conclusion; the Human VFX Supervisor saw the Generate action; the Human CG Supervisor saw the reconstruction read-only, without a Generate action; no edit, accept, reject, apply, HumanGate, or Decision control appeared anywhere on the reconstruction; browser activity did not modify any repository file. See `docs/VALIDATION_EVIDENCE.md` for the structured table entry and the full 17-item scenario list. As with items 6, 7, and 9, this is not independently provable from Git history alone.

**Evidence-type discipline applied throughout this document:**

- **Automated test evidence** — proven by a passing test in this repository's test suite (backend `pytest`, frontend `vitest`). Reproducible by any reader by running the suite.
- **Repository evidence** — proven by inspecting committed code, migrations, or Git history directly. Reproducible by any reader with repository access.
- **Manual owner-supplied validation evidence** — reported by the project owner as having occurred, against real external systems (a real ftrack workspace, a real DeepSeek API call) that this repository's automated tests deliberately never touch (per this project's own testing rules — automated tests must never make a real ftrack or model-provider call). Not independently reproducible from the repository alone; recorded here as project history, not as a repository-verifiable fact.

---

## F. Design Concept completeness matrix

| Module | Sub-capability | Status | Basis |
|---|---|---|---|
| **Core Agent** | Intent decomposition | **Complete, merged to `main`** (PR #8, `cd24eaf`) | `agents/intent_decomposition_service.py`, migration `0015_intent_decomposition.py`; deterministic provider for automated tests, real DeepSeek provider proven by manual acceptance (`docs/VALIDATION_EVIDENCE.md`) |
| | Core Anchor establishment | **Partial** overall — Step 1A semantic objects complete and merged; Step 1B decomposition-led upstream proposal complete and merged; wider Step 1 remains Partial because the minimal persistent HumanGate (Step 1D) is not implemented | `core_anchor_drafting` (direct path, still backend-compatible but demoted in the UI) plus the Step 1B decomposition-led path (`intent_decomposition` → Human VFX Supervisor review → explicit "Use in Core Anchor draft" → editable `CoreAnchorRevision` draft with `source_intent_decomposition_id` lineage) both exist; confirmation and full semantic-content authorship remain human acts via the UI (Step 1A). Establishment is not yet complete because the minimal persistent HumanGate (Step 1D) is still not started. |
| | Core Anchor semantic supporting objects | **Complete, merged to `main`** (backend + minimal UI, Step 1A; PR #7, `2d1101f`) | `Constraint`/`VariationZone`/`DriftRisk`/`AnchorReference`/`OpenQuestion` (migration `0014`, committed `173f32e`) plus the Human VFX Supervisor view/add/edit/remove/move/save/cancel UI inside the existing Core Anchor draft workflow (`CoreAnchorGate`, committed `4e544dd`); human-authored only — Core Agent does not populate these directly |
| | Context reconstruction | **Complete on feature branch, pending merge to main** — implemented and validated on `feat/step1c-context-reconstruction` | `agents/context_reconstruction_service.py`, migration `0016_context_reconstruction.py`; produces an immutable, evidence-backed interpretation of a fresh `ContextSnapshot` (`ContextSnapshot` itself remains a different object — see section B); deterministic provider for automated tests, real DeepSeek provider proven by manual acceptance (`docs/VALIDATION_EVIDENCE.md`) |
| | Alignment assessment | Completed (as Core Agent's own capability) | `agents/alignment_assessment_service.py`, deterministic + real DeepSeek provider |
| | Re-anchor proposal | Not started | No code references `ReAnchorProposal` or equivalent |
| | Intent Signal | Not started | No code references `IntentSignalRecord`, "Stable/Stretching/Drifting/Re-anchor Needed" states, or a Signal Engine |
| **Role Agents** | VFX Supervisor Agent | Not started | Section C |
| | CG Supervisor Agent | Scaffold only | Section C |
| | Artist Agent | Not started | Section C |
| **Dashboard** | Shared shot view | **Partial** — a single generic Shot Anchor page exists; it is not the role-aware "shared shot view" `docs/PRODUCT_SCOPE.md` §13.1 describes (intent signal, version/decision timeline are absent) | `ShotAnchorPage.tsx` |
| | VFX view | Not started | No role-specific dashboard view exists; the minimal Shot/Version pages are role-agnostic (they show the same content regardless of selected role) |
| | CG view | Not started | Same as above |
| | Artist view | Not started | Same as above |

**Important distinctions preserved explicitly, per instruction:**
- Core Anchor drafting is **partial** completion of "Anchor establishment" as a whole (the drafting half is done; the module is not "complete" merely because one human+one-agent half of it works).
- The current `ContextSnapshot` does **not** complete "Context Reconstruction" — they are different objects with different purposes (see section B).
- The current Alignment Assessment is explicitly a **Core Agent** capability, not a VFX Supervisor Agent capability.
- The minimal Shot/Version pages do **not** complete the role-aware Dashboard — they are one generic view, not four role-differentiated ones.

---

## G. Work Package completeness

| Work Package | Status | Detail |
|---|---|---|
| **WP-A — Intent Core & Workflow** | Partial | Completed: Core Anchor lifecycle (A1), Execution Anchor lifecycle (A2), stale propagation, Decision/WorkflowTransition/AuditEvent foundations, Human Gate UI for Core Anchor (A3), Version/ReviewNote (Step 4a), Alignment Assessment + its Human Gate + supersession (Step 4b/4c), Version/Assessment UI (Step 4d), Core Anchor semantic objects **backend** (Step 1A-Backend, migration `0014`, committed `173f32e`) and **minimal semantic editing UI** (Step 1A-UI, `CoreAnchorGate`) — **Step 1A as a whole is merged to `main`** (PR #7, `2d1101f`) — plus Core Agent Intent Decomposition and the decomposition-led Core Anchor draft workflow (Step 1B, migration `0015`) — **Step 1B is merged to `main`** (PR #8, `cd24eaf`) — plus Core Agent Context Reconstruction (Step 1C, migration `0016`) — **Step 1C is complete on `feat/step1c-context-reconstruction`, pending merge to `main`.** Not started: Execution Anchor's own frontend Human Gate UI (backend exists, UI does not); Step 1D minimal persistent HumanGate (see section H/I). |
| **WP-B — Agent Runtime & Evaluation** | Partial | Completed: `ContextSnapshot`/`AgentRun` foundation; deterministic-provider pattern; one real model provider (DeepSeek) proven for three capabilities (Alignment Assessment, Intent Decomposition, Context Reconstruction). Not started: a dedicated Model Gateway module (`docs/ARCHITECTURE.md` §3.5 describes one; today each capability's provider selection is inline, not extracted); a capability registry; prompt version registry as a distinct system; a formal evaluation harness. |
| **WP-C — ftrack Connector** | Partial | Completed: real Project/Shot/Task sync (reconciliation worker), real controlled write-back for Core Anchor confirmation. Not started: Version/ReviewNote sync from ftrack; write-back for Alignment Assessment decisions; Execution Anchor write-back; ftrack Action/embedded-Widget entry points (`docs/ARCHITECTURE.md` §3.4, `docs/PRODUCT_SCOPE.md` §14.4). |
| **WP-D — Dashboard & Interaction** | Partial (minimal) | Completed: a single generic Shot Anchor page and Version detail page, both functional and tested. Not started: role-aware multi-view Dashboard (`docs/PRODUCT_SCOPE.md` §13.1–13.5); drift timeline; audit/history view; cross-department Shot Assembly view. Deliberately deferred as non-essential enterprise scope for this stage: multi-tenant administration, generic dashboards, real-time infrastructure. |

No Work Package is marked "complete." Each has real, tested, committed slices and real, identified gaps.

---

## H. Locked future implementation order

This sequence is locked. Steps must not be skipped or silently reordered. Any scope change requires explicit project-owner approval and must be recorded as an update to this document before implementation begins. Completed work (sections C–G above) remains valid unless repository evidence proves otherwise — this baseline is not being redone.

```
0. Repository status and Roadmap baseline; merge current baseline        [Step 0A — done]
1. Core Anchor semantic objects
   + Core Agent Intent Decomposition
   + Core Agent Context Reconstruction
   + minimal HumanGate

   Internal sub-slice order (locked, does not change Step 1's position
   among 0-9):
     1A-Backend  Semantic objects backend                    [DONE — merged to main, committed 173f32e]
     1A-UI       Minimal Core Anchor semantic editors          [DONE — merged to main via PR #7, 2d1101f]
     1B          Core Agent Intent Decomposition                [DONE — merged to main via PR #8, cd24eaf]
     1C          Core Agent Context Reconstruction               [DONE — implemented + validated on feat/step1c-context-reconstruction, pending merge to main]
     1D          Minimal persistent HumanGate                    [NEXT — not started]

   Step 1A and Step 1B are both merged to main. Step 1C is complete on
   its feature branch, pending merge to main. Step 1D must not begin
   until, in order: (1) the Step 1C docs commit is made; (2) the feature
   branch is pushed; (3) Step 1C is merged into main; (4) local main is
   synchronised and clean.
2. Lightweight shared Agent Runtime
3. VFX Supervisor Agent
4. CG Supervisor Agent
   + Execution Anchor CG Human Gate UI
5. Artist Agent
6. Cross-role Assessment
   + Re-anchor Proposal
   + Intent Signal
7. Role-aware Dashboard
8. Necessary ftrack Version / Note / link extensions
9. Evaluation, complete demonstration, and project close-out
```

---

## I. Detailed remaining-work outline

Each future step below states purpose, minimum prototype scope, dependencies, explicit exclusions, and the acceptance evidence required before the next step may begin. None of these steps are implemented by this document — this section is planning input only, matching the boundaries already approved in prior scope discussions.

### Step 1 — Core Anchor semantic objects + Core Agent Intent Decomposition + Context Reconstruction + minimal HumanGate

- **Purpose:** complete the Core Anchor's supporting domain objects and give Core Agent its two remaining, most foundational capabilities.
- **Minimum prototype scope:** `Constraint`, `VariationZone`, `DriftRisk`, `AnchorReference`, `OpenQuestion` domain objects (per `docs/DOMAIN_MODEL.md` §5 — implemented under the class name `AnchorReference`, not the generic `Reference`); `intent_decomposition` capability (Core Agent); `context_reconstruction` capability (Core Agent, distinct from `ContextSnapshot`); a minimal persistent `HumanGate` object/escalation record (today, "Human Gate" is a UI/workflow pattern, not its own persisted domain object — `docs/DOMAIN_MODEL.md` §9 names `HumanGate` as its own object, which does not yet exist as a table).
- **Dependencies:** none blocking; reuses the existing `ContextSnapshot`/`AgentRun`/Protocol-generator pattern.
- **Explicit exclusions:** no Role Agent work; no Dashboard changes beyond what is needed to surface the new objects minimally.
- **Acceptance evidence required:** backend tests for each new domain object and capability; no regression in existing Core Anchor/Alignment Assessment tests; updated status baseline in this document.
- **Current status (sub-sliced; see section H for the locked internal order):**
  - **Step 1A-Backend — committed as `173f32e` (feat: add core anchor semantic objects).** All five semantic-child tables exist (migration `0014_core_anchor_semantic_objects.py`), reachable through the existing Core Anchor draft/update/get/list/confirm/reject endpoints (no new endpoints). Automated evidence: 18 focused tests + full 206-test backend suite + 43-test frontend suite passing, migration upgrade/downgrade/upgrade verified, `ruff`/`mypy`/OpenAPI export/TypeScript contract regeneration/typecheck all passing (all automated/repository evidence, reproducible from this repository). Manual evidence: a real-`uvicorn`, real-HTTP acceptance pass against an isolated temporary SQLite database — see section E item 6 and `docs/VALIDATION_EVIDENCE.md`.
  - **Step 1A-UI — merged to `main` via PR #7, merge commit `2d1101f`** (`4e544dd` feat: add core anchor semantic editors; `cc18fc4` style: format intent module readme). The Human VFX Supervisor can view/add/edit/remove/move up/move down/save/cancel all five semantic collections on a draft revision, inside the existing `CoreAnchorGate` workflow; Human CG Supervisor and Human Artist see a read-only "Draft details" view instead of a disabled form; confirmed revisions render all five collections read-only. Automated evidence: 70 frontend tests passing (54 Shot Anchor + 16 Version page), web TypeScript typecheck/ESLint/Prettier/production build all passing, no backend/migration/contract/generated/Version-page/dependency file touched. Manual evidence: a real-browser acceptance pass — see section E item 7 and `docs/VALIDATION_EVIDENCE.md`.
  - **Step 1A as a whole (1A-Backend + 1A-UI) is merged to `main`.**
  - **Step 1B (Core Agent Intent Decomposition) is merged to `main` via PR #8, merge commit `cd24eaf`** (`fc233bd` feat: add core agent intent decomposition). Core Agent generates an immutable `IntentDecomposition` from an `IntentBrief`; the Human VFX Supervisor reviews the AI proposal and may explicitly use it to create a new, fully editable `CoreAnchorRevision` draft (migration `0015_intent_decomposition.py`). See sections D and E above and `docs/VALIDATION_EVIDENCE.md` for the full automated, real-DeepSeek, and browser evidence.
  - **Step 1C (Core Agent Context Reconstruction) is complete on `feat/step1c-context-reconstruction`, pending merge to `main`.** Core Agent produces an immutable, evidence-backed interpretation of the exact local facts recorded in a fresh `ContextSnapshot` (migration `0016_context_reconstruction.py`), explaining why the current production context exists without ever judging Version alignment/drift, role performance, or recommending a re-anchor; every structured conclusion cites one or more evidence references back to real ids in that same snapshot. See sections D and E above and `docs/VALIDATION_EVIDENCE.md` for the full automated, real-DeepSeek, and browser evidence.
  - **Step 1 overall is *not* complete** — Step 1D (minimal persistent HumanGate) remains not started.
  - **Step 1D (minimal persistent HumanGate) is the immediate next locked step.** It may not begin until, in order: the Step 1C docs commit is made; the feature branch is pushed; Step 1C is merged into `main`; local `main` is synchronised and clean. Step 1D is not planned or implemented by this document.

### Step 2 — Lightweight shared Agent Runtime

- **Purpose:** extract the provider-selection/capability-registration pattern that is currently duplicated inline in `core_agent_service.py` and `alignment_assessment_service.py` into a small, shared, reusable layer before a second and third Agent copy that duplication a third and fourth time.
- **Minimum prototype scope:** capability registry (a lookup from capability name to its Protocol/generator pair); a lightweight Model Gateway (single interface for provider selection, reused by all Agents); a prompt registry/version field, already partially present per-capability today but not centralised; structured evidence-reference handling shared across capabilities; a basic evaluation harness (a way to run a capability against a fixture and inspect output — not a scoring system).
- **Dependencies:** Step 1's capabilities are good candidates to be the first consumers, but this step is really a refactor of the existing two Core Agent capabilities plus a shared seam for the Role Layer.
- **Explicit exclusions:** no new product-facing capability; no Role Agent implementation yet; no enterprise-grade queueing/retry infrastructure.
- **Acceptance evidence required:** existing Core Agent capabilities pass all existing tests unchanged after being migrated onto the shared runtime; no behavioural change to any existing endpoint.

### Step 3 — VFX Supervisor Agent

- **Purpose:** implement the first Role Agent.
- **Minimum prototype scope:** VFX feedback processing; feedback clustering/prioritisation; creative review pre-check; drift-risk identification; review-question drafting; reference and re-anchor *suggestions* only.
- **Dependencies:** Step 2's shared runtime (recommended, not strictly blocking); the existing `ContextSnapshot`/`AgentRun`/`ActorContext` pattern (already available, no dependency).
- **Explicit exclusions:** no final approval authority of any kind; cannot alter the Core Anchor; cannot resolve the VFX Supervisor's own Human Gate.
- **Acceptance evidence required:** a real `AgentRun` with `agent_type="vfx_supervisor_agent"`; a real capability constant and generator; tests proving the Agent's output is advisory-only and creates no `Decision`; UI (if any, per Step 7 scope) clearly labels output as VFX Supervisor Agent's, not Core Agent's.

### Step 4 — CG Supervisor Agent + Execution Anchor CG Human Gate UI

- **Purpose:** implement the second Role Agent, and close the existing frontend gap for the human CG Supervisor's own Human Gate (backend already exists, per section G).
- **Minimum prototype scope:** CG Execution Anchor drafting (reusing the already-scaffolded `cg_supervisor_agent` permission allowlist — see section C); technical-translation explanation; production-readiness risk; downstream-impact assessment; a CG Human Gate UI (confirm/reject Execution Anchor in the frontend, mirroring `CoreAnchorGate`); escalation when a technical issue may affect the Core Anchor.
- **Dependencies:** none blocking; the permission scaffold already exists and is the natural entry point.
- **Explicit exclusions:** cannot redefine the Core Anchor; cannot autonomously confirm production-ready state.
- **Acceptance evidence required:** a real `AgentRun` with `agent_type="cg_supervisor_agent"` from production code (not just a test); a working CG Human Gate UI with backend-enforced permissions, tested the same way `CoreAnchorGate` is tested.

### Step 5 — Artist Agent

- **Purpose:** implement the third Role Agent.
- **Minimum prototype scope:** task-context briefing; anchor-to-action translation; output/reference comparison; submission-rationale preparation support.
- **Dependencies:** none blocking.
- **Explicit exclusions:** no Anchor authority of any kind; cannot choose the final Version on the Artist's behalf.
- **Acceptance evidence required:** same shape as Steps 3–4 — real `AgentRun` with the correct `agent_type`, tests proving advisory-only behaviour.

### Step 6 — Cross-role Assessment + Re-anchor Proposal + Intent Signal

- **Purpose:** build the capabilities that depend on multiple Agents/Assessments already existing.
- **Minimum prototype scope:** a cross-department/cross-role assessment capability (`docs/AGENT_CONTRACTS.md` §8); a re-anchor proposal capability (Core Agent, `docs/AGENT_CONTRACTS.md` §4); Intent Signal with exactly the four documented states (Stable / Stretching / Drifting / Re-anchor Needed), explainable per `docs/PRODUCT_SCOPE.md` §6.6.
- **Dependencies:** meaningfully benefits from Steps 3–5 existing (more Assessment sources to aggregate), though a minimal version could read only Core Agent + human Decision data if sequenced earlier — this is a product decision, not a technical blocker.
- **Explicit exclusions:** Intent Signal remains derived/read-only, never independently editable; no automatic re-anchoring.
- **Acceptance evidence required:** a Signal Engine producing an explainable, inspectable state; tests proving the signal is derived, not authored.

### Step 7 — Role-aware Dashboard

- **Purpose:** build the multi-role Dashboard described in `docs/PRODUCT_SCOPE.md` §13.
- **Minimum prototype scope:** shared shot view, VFX view, CG view, Artist view, each showing only what `docs/PRODUCT_SCOPE.md` §13.1–13.4 requires at minimum; visual distinction between Production Fact, AI Proposal, and Human Decision (§13.5's requirement, applied throughout, not just in an audit view).
- **Dependencies:** benefits from Steps 3–6 existing (there is more role-specific content to show), but the visual-distinction requirement itself has no technical dependency.
- **Explicit exclusions:** no generic multi-tenant admin UI; no enterprise design system.
- **Acceptance evidence required:** one page or view per role, each tested; a visible, testable distinction between fact/proposal/decision.

### Step 8 — Necessary ftrack Version / Note / link extensions

- **Purpose:** close the ftrack-integration gaps identified in section G.
- **Minimum prototype scope:** validate the targeted ftrack `AssetVersion` and Note relationships against the real test workspace; per-Shot Version/Note sync; an ICAS link or ftrack Action entry point; still **no autonomous write-back** — every write-back remains human-requested, exactly as Core Anchor write-back already works.
- **Dependencies:** the existing `ExternalEntityLink`/`WritebackRecord`/reconciliation-worker pattern (already proven for Project/Shot/Task) is the template.
- **Explicit exclusions:** no autonomous write-back of any kind; no write-back of raw AI Assessments (`docs/PRODUCT_SCOPE.md` §14.5 forbids this explicitly).
- **Acceptance evidence required:** a real, owner-validated sync of at least one real Version/Note pair, following the same manual-validation-evidence discipline as section E.

### Step 9 — Evaluation, complete demonstration, and project close-out

- **Purpose:** prove the four-Agent architecture is real, differentiated, and authority-bounded, end to end.
- **Minimum prototype scope:** a four-Agent differentiation evaluation (proving each Agent's `AgentRun`s are distinguishable and correctly attributed); an authority-boundary evaluation (proving no Agent of any type can create a `Decision`, confirm an Anchor, or write back autonomously — extending the existing guarantee in `decision_service.record_decision` to be re-verified against all four Agents); an evidence-traceability review; one complete, real, manually-validated demonstration combining a real DeepSeek call and real ftrack sync/write-back in a single walkthrough.
- **Dependencies:** Steps 1–8.
- **Explicit exclusions:** no new product capability introduced at this step — it is evaluation and documentation of what Steps 0–8 built.
- **Acceptance evidence required:** an updated version of this document and `docs/VALIDATION_EVIDENCE.md` reflecting the final state, with the same evidence-type discipline (automated test / repository evidence / manual owner-supplied) applied throughout.
