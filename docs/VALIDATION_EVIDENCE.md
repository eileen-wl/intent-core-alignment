# VALIDATION_EVIDENCE.md

**Project:** Intent Core Alignment System
**Purpose:** A concise, evidence-typed record of what has been validated, how, and with what limitations.
**Companion document:** `docs/IMPLEMENTATION_STATUS_AND_ROADMAP.md` §E covers the same manual validations in narrative form; this document is the structured table.

## Evidence types

- **Automated test** — a passing test in this repository's committed test suite. Reproducible by running `pytest` (`apps/api`) or `vitest run` (`apps/web`).
- **Repository evidence** — provable by inspecting committed code, migrations, or Git history directly.
- **Manual owner-supplied execution** — reported by the project owner as having been run against a real external system (real ftrack workspace, real DeepSeek API). Not reproducible from the repository alone; this project's own testing rules deliberately keep real external calls out of the automated suite.

No API keys, credentials, full environment-variable values, or other sensitive account details appear anywhere in this document.

## Validation table

| Validation name | Date / session time | Object / Shot used | Expected result | Observed result | Evidence type | Limitations |
|---|---|---|---|---|---|---|
| Real ftrack Project/Shot/Task sync | Reported during the ftrack integration work (see commit `2b27fca`) | Shot `bc0040` | Real ftrack Project/Shot/Task data appears in ICAS as `source=ftrack`; reconciliation worker completes without error | Reported as observed by the project owner | Manual owner-supplied execution | No committed transcript or log of the run exists in this repository; not independently re-verifiable from Git alone |
| Reconciliation worker (`reconcile_ftrack_shots`) — automated behaviour | N/A (test suite) | Synthetic fixture Shots | Cursor advances correctly; a second run against unchanged data is a no-op | Passing | Automated test | Only proves the polling/cursor logic against a mocked ftrack session, not that a real workspace was actually reached |
| Real ftrack controlled write-back | Reported alongside the sync validation above (commit `2b27fca`, ADR-0012) | Shot `bc0040` | Confirming a Core Anchor with `request_write_back=True` produces exactly one new ftrack Shot Note; no existing Note is overwritten; write-back is human-requested, not automatic | Reported as observed by the project owner | Manual owner-supplied execution | No committed transcript; the write-back content marker (`"[Intent Core Alignment System]"`) is repository-verifiable, but the actual ftrack-side Note creation is not |
| Write-back request/record creation — automated behaviour | N/A (test suite) | Synthetic fixture Shots | A `WritebackRecord` is created only when the Shot has a real `ExternalEntityLink`; a human-requested write-back enqueues the worker job | Passing | Automated test | Only proves the local record/enqueue logic; does not reach real ftrack |
| Real DeepSeek Alignment Assessment | Reported during Step 4b/ADR-0013 follow-up manual testing | A Version under Shot `bc0040` | `provider=deepseek`; `AgentRun.status=succeeded`; `AlignmentAssessment.alignment_state=significant_drift`; `envelope.requires_human_gate=true`; evidence field cites the confirmed Core Anchor, the Version description, and a Review Note; no Anchor or ftrack state modified | Reported as observed by the project owner | Manual owner-supplied execution | No committed transcript of the raw DeepSeek response exists in this repository (by design — it may contain content not appropriate to commit); the deterministic-provider path and the DeepSeek adapter's request-construction logic are separately covered by automated tests (next row) |
| DeepSeek adapter request/response handling — automated behaviour | N/A (test suite) | Synthetic fixture assessment payload | Adapter makes exactly one non-streaming JSON-mode call with the correct model/messages/`response_format`; empty-content responses raise `AgentGenerationError` | Passing | Automated test | Uses a mocked SDK client (`openai.OpenAI` stubbed) — never a real network request, by explicit project rule |
| Decision supersession | Reported alongside the DeepSeek validation, and separately covered by automated tests | Assessments under Shot `bc0040` | A later human Decision correctly sets `supersedes_decision_id` to the prior active Decision for the same Shot; the old Decision remains unmodified and independently readable | Reported as observed by the project owner (manual); also proven automatically (next row) | Manual owner-supplied execution + Automated test | The manual run demonstrates it against real generated data; the automated tests demonstrate the same logic against fixtures, including a 3-link chain and cross-Shot isolation |
| Decision supersession chain — automated behaviour | N/A (test suite) | Synthetic fixture assessments across 2 Shots | A 3-Decision chain supersedes only the current unsuperseded head, not always the first; a Decision on another Shot never joins the chain | Passing | Automated test | `apps/api/tests/test_alignment_assessment_decisions.py` |
| Browser validation of the Version/Assessment UI | Reported after Step 4d | A Version under Shot `bc0040` | Version fields, Review Notes, confirmed Core Anchor summary, Alignment Assessments, AI provenance (agent type/provider/run status/context snapshot), Human Gate, and supersession labels all render correctly in a real browser session | Reported as observed by the project owner | Manual owner-supplied execution | The same rendering logic is separately covered by 16 automated frontend tests (`VersionPage.test.tsx`) using a mocked `fetch`, not a real backend |
| Frontend rendering — automated behaviour | N/A (test suite) | Fixture data | Version description, Review Notes, every Assessment field, `requires_human_gate`, DeepSeek provenance, Accept/Reject gating by role, accept/reject request shape, no-second-decision-action, supersession labels, generate-button loading/refresh, loading/error states all render/behave correctly | Passing (43/43 across `ShotAnchorPage.test.tsx` + `VersionPage.test.tsx`) | Automated test | Mocked `fetch` throughout; never calls a real backend or DeepSeek |

## What this table does not claim

- It does not claim DNEG production data was used anywhere (`docs/PRODUCT_SCOPE.md` §14.6's claim boundary applies: the ftrack validation used a controlled test workspace).
- It does not claim the manual validations are reproducible by a third party from this repository alone — they required real, owner-held ftrack and DeepSeek credentials that are never committed.
- It does not claim any Role Agent (VFX Supervisor Agent, CG Supervisor Agent, Artist Agent) was validated — none exists yet (see `docs/IMPLEMENTATION_STATUS_AND_ROADMAP.md` §C).
