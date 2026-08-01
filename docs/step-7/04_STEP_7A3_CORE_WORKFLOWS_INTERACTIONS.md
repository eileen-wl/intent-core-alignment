# ICAS Step 7A-3 — Core Workflows and Interaction Architecture

**Version:** v1.0  
**Status:** Proposed for owner review  
**Parent:** Step 7 Experience Architecture Master Plan  
**Depends on:** Step 7A-1 and Step 7A-2  
**Scope:** Define how users move through the key ICAS workflows, including context, input, Agent/system action, human authority, success, failure, history, and next navigation.

---

## 1. Purpose

Step 7A-2 established where information lives.

Step 7A-3 defines how the product behaves.

Every major workflow must answer:

```text
Who starts it?
→ From which page?
→ What context is shown?
→ What input is required?
→ What does the system or Agent do?
→ What result appears?
→ Where does human authority apply?
→ What is saved?
→ What happens on failure?
→ Where does the user go next?
```

---

## 2. Shared interaction principles

### 2.1 Reading and acting are visually distinct

The interface must distinguish:

- Current state
- Draft
- Agent advisory output
- Human review required
- Human-confirmed
- Historical

### 2.2 Agent generation is never the final authority step

```text
Context
→ Generate
→ Running
→ Review Agent output
→ Human decides what to do next
```

Agents do not automatically:

- confirm an Anchor;
- create an authoritative Decision;
- apply a Re-anchor Proposal;
- pass or fail a Version;
- resolve an escalation;
- write back to ftrack.

### 2.3 High-authority actions require explicit confirmation

Explicit human confirmation is required for:

- Core Anchor HumanGate;
- Execution Anchor HumanGate;
- authoritative Decision;
- future controlled ftrack write-back.

### 2.4 Immutable outputs are not edited in place

Agent outputs, confirmed Anchor revisions, CrossRoleAssessments, ReAnchorProposals, IntentSignals, AgentRuns, ContextSnapshots, and Decisions remain immutable.

### 2.5 Current and historical outputs are separated

- newest current result expanded;
- previous results collapsed;
- timestamp and provenance visible;
- historical outputs never presented as current.

### 2.6 Failure preserves current confirmed state

A failed action must not:

- overwrite current confirmed state;
- display invalid partial output as valid;
- create a partial Decision;
- create a partial Assessment / Proposal / Signal chain.

---

# 3. Shared interaction patterns

## 3.1 Read-only summary card

Used for:

- Core Anchor summary;
- Execution Anchor summary;
- Agent output summary;
- Intent Signal;
- ftrack linkage;
- Decision outcome.

## 3.2 Dedicated workspace

Used for:

- Core Anchor;
- Execution Anchor;
- Version review;
- Cross-role Alignment;
- Decisions;
- Dependencies;
- Integrations.

## 3.3 Evidence / provenance drawer

Used for:

- evidence references;
- ContextSnapshot;
- AgentRun;
- provider and model;
- source details;
- ftrack technical linkage;
- safe diagnostics.

## 3.4 Explicit generation panel

Contains:

- prerequisite checklist;
- selected context;
- capability explanation;
- input fields, where required;
- Generate button;
- running state;
- success or failure state.

## 3.5 Human authority panel

Contains:

- proposed revision;
- current confirmed state;
- difference summary;
- evidence;
- actor;
- rationale;
- Confirm / Reject.

---

# 4. Core Anchor workflow

**Actor:** Human VFX Supervisor  
**Page:** `/vfx/shots/:shotId/intent`

## Purpose

Create, review, and confirm the shared creative-intent boundary for a Shot.

## Main states

### No confirmed Core Anchor

Show:

- IntentBrief;
- IntentDecomposition;
- ContextReconstruction;
- missing-Anchor explanation;
- `Create Core Anchor draft`.

### Draft revision exists

Show:

- current confirmed Anchor, if any;
- draft revision;
- changed semantic objects;
- evidence;
- `Continue editing`;
- `Submit for human confirmation`.

### HumanGate pending

Show:

- current confirmed revision;
- proposed revision;
- difference summary;
- evidence;
- HumanGate panel.

### Confirmed

Show:

- current confirmed Core Anchor;
- confirming actor;
- linked Decision;
- revision history;
- `Create new revision`.

## Interaction sequence

```text
Open Intent Workspace
→ Review intent context
→ Create or edit draft
→ Save draft
→ Review differences
→ Submit to HumanGate
→ Confirm or reject
→ Persist outcome and Decision
→ Return to current Core Anchor
```

## Placement

- reading and editing: dedicated Intent Workspace;
- confirmation: full authority panel on the page;
- final Confirm / Reject: small explicit dialog;
- evidence: drawer;
- history: collapsed section.

## Authority

Only Human VFX Supervisor can confirm or reject Core Anchor HumanGate.

## Success

- confirmed CoreAnchorRevision;
- HumanGate outcome;
- Decision;
- Activity event;
- previous revision remains historical.

## Failure

- draft remains available;
- current confirmed Anchor is unchanged;
- no partial Decision;
- validation errors appear next to affected fields.

## Next navigation

Remain in Intent Workspace, with links to:

- Shot Overview;
- CG execution context;
- Alignment Workspace.

---

# 5. Execution Anchor workflow

**Actor:** Human CG Supervisor  
**Page:** `/cg/tasks/:taskId/execution`

## Purpose

Translate the confirmed Core Anchor into department-level execution boundaries.

## Prerequisites

- Task exists;
- confirmed Core Anchor exists;
- CG Supervisor has authority;
- Shot and Project context resolve.

## Interaction sequence

```text
Open Execution Workspace
→ Review confirmed Core Anchor
→ Review Task and dependencies
→ Create or edit Execution Anchor draft
→ Save draft
→ Review differences
→ Submit to CG HumanGate
→ Confirm or reject
→ Persist confirmed revision and Decision
→ Return to current Execution Anchor
```

## Placement

- Core Anchor context and current Execution Anchor: same workspace;
- draft editing: dedicated page state;
- confirmation: HumanGate panel;
- dependencies: summary with link to Dependencies page;
- evidence: drawer;
- history: collapsed section.

## Authority

Only Human CG Supervisor confirms or rejects Execution Anchor HumanGate.

## Success

- confirmed ExecutionAnchorRevision;
- Decision;
- Activity event;
- Artist Task context updates to the latest confirmed summary.

## Failure

- current confirmed Execution Anchor unchanged;
- draft remains available;
- missing Core Anchor blocks submission;
- no partial confirmation.

---

# 6. VFX Supervisor Agent review

**Human starter:** Human VFX Supervisor  
**Agent:** VFX Supervisor Agent  
**Page:** `/vfx/shots/:shotId/versions/:versionId`

## Purpose

Assess one Version against shared creative intent.

## Prerequisites

- explicit Shot;
- explicit Task;
- explicit Version;
- confirmed Core Anchor;
- authorised VFX actor.

## Sequence

```text
Open VFX Version Review
→ Review selected context
→ Open generation panel
→ Verify context
→ Generate VFX review
→ Running state
→ AgentRun and ContextSnapshot
→ Validate structured output
→ Persist immutable review
→ Human reviews result
```

## Placement

Generation and result remain on the same Version Review page.

## Authority boundary

The review does not:

- approve the Version;
- modify the Core Anchor;
- resolve a HumanGate;
- create a Decision automatically.

## Failure

- existing latest successful review remains current;
- invalid output is not rendered;
- safe diagnostics remain in provenance;
- retry creates a new run.

---

# 7. CG Supervisor Agent review

**Human starter:** Human CG Supervisor  
**Agent:** CG Supervisor Agent  
**Page:** `/cg/tasks/:taskId/versions/:versionId`

## Purpose

Assess a Version against confirmed execution guidance and dependencies.

## Prerequisites

- explicit Task;
- explicit Version;
- confirmed Core Anchor;
- confirmed Execution Anchor;
- authorised CG actor.

## Sequence

```text
Open CG Version Review
→ Review Version, ReviewNote, Anchors
→ Generate CG review
→ Running state
→ AgentRun and ContextSnapshot
→ Validate output
→ Persist immutable CG review
→ Human reviews concerns, dependencies, and escalation needs
```

## Placement

Generation and result stay on the CG Version Review page.

## Authority boundary

The review does not:

- modify the Execution Anchor;
- submit Artist work;
- resolve dependencies;
- create VFX-level Decisions.

---

# 8. Artist Agent guidance

**Human starter:** Human Artist  
**Agent:** Artist Agent  
**Page:** `/artist/tasks/:taskId/versions/:versionId`

## Purpose

Translate intent, execution guidance, and feedback into practical actions, reasons, self-checks, and supervisor questions.

## Prerequisites

- explicit Task;
- explicit Version;
- confirmed Core Anchor;
- confirmed Execution Anchor;
- relevant ReviewNote / role feedback;
- authorised Artist actor.

## Sequence

```text
Open Artist Version Workspace
→ Review Version and feedback
→ Review confirmed boundaries
→ Generate Artist guidance
→ Running state
→ AgentRun and ContextSnapshot
→ Persist immutable guidance
→ Artist reviews:
   practical actions
   why it matters
   self-checks
   supervisor questions
   evidence gaps
```

## Placement

Generation and guidance stay on the Artist Version Workspace.

## Authority boundary

Guidance does not:

- modify either Anchor;
- resolve supervisor questions;
- submit a new Version;
- mark feedback complete.

---

# 9. Version and ReviewNote workflow

## Purpose

Present Version and ReviewNote as production facts and connect them to role-specific review.

## Role-specific pages

- VFX Version Review
- CG Version Review
- Artist Version Workspace

## Step 7 flow

```text
Open role-specific Version page
→ Inspect Version facts
→ Inspect ReviewNote
→ Inspect confirmed Anchor context
→ Generate or inspect role-specific Agent output
→ Review history and evidence
```

## Placement

- Version facts and latest ReviewNote: same page;
- Version history: timeline / history section;
- future new-Version submission: separate deliberate flow;
- ftrack technical details: linkage panel or drawer.

## Boundary

ICAS must not invent:

- Version approval;
- completed submission;
- successful ftrack sync;
- resolved feedback.

---

# 10. Cross-role Assessment workflow

**Human starter:** Human VFX Supervisor  
**Agent:** Core Agent  
**Capability:** `cross_role_assessment`  
**Page:** `/vfx/shots/:shotId/alignment`

## Purpose

Synthesize confirmed Anchors and the newest VFX, CG, and Artist outputs.

## Prerequisites

- explicit Shot;
- explicit Task;
- explicit Version;
- confirmed Core Anchor;
- confirmed Execution Anchor;
- latest VFX review;
- latest CG review;
- latest Artist guidance;
- authorised VFX actor.

## Pre-generation state

Show:

- prerequisite checklist;
- selected Task and Version;
- Anchor status;
- latest role-output timestamps;
- existing latest Assessment;
- `Generate new cross-role assessment`.

## Sequence

```text
Open Alignment Workspace
→ Review prerequisites
→ Verify selected Task and Version
→ Generate
→ Running state
→ Core Agent executes once
→ Validate schema, evidence, and unsupported numerics
→ Persist:
   CrossRoleAssessment
   optional ReAnchorProposal
   deterministic IntentSignal
   AgentRun
   ContextSnapshot
→ Latest result appears
→ Previous results remain collapsed
```

## Placement

- prerequisites, generation, and result: same Alignment Workspace;
- three role perspectives and synthesis: same page;
- evidence and provenance: drawer;
- history: collapsed;
- actual Anchor revision: separate Intent Workspace.

## Authority boundary

The Assessment does not:

- rank roles;
- pass or fail a Version;
- modify either Anchor;
- resolve a HumanGate;
- apply a Proposal;
- trigger a Role Agent;
- write to ftrack.

## Failure

- no partial Assessment / Proposal / Signal persists;
- existing latest successful result remains current;
- failed AgentRun / ContextSnapshot may remain as safe evidence;
- invalid output is not presented as valid.

---

# 11. Intent Signal workflow

## Creation

Derived automatically and deterministically from a successful CrossRoleAssessment.

Users do not manually create or edit it.

## Presentation

- role homepage;
- list badge;
- contextual page banner;
- role Signal page;
- Alignment Workspace.

## User flow

```text
Signal appears
→ User opens summary
→ Reads role-specific explanation
→ Opens supporting Alignment, Task, or Version context
```

## Role interpretation

### VFX

- human review;
- shared creative ambiguity;
- cross-role tension;
- re-anchor consideration.

### CG

- execution clarification;
- missing boundaries;
- unresolved dependencies;
- escalation need.

### Artist

- what remains confirmed;
- pending supervisor clarification;
- whether work can continue within existing boundaries.

## Boundary

Intent Signal is not:

- a Decision;
- a gate;
- pass / fail;
- acknowledgement;
- resolution state.

If no Signal exists, show:

```text
No current Intent Signal
A successful Cross-role Assessment is required.
```

Do not imply low risk.

---

# 12. Re-anchor Proposal workflow

**Primary human:** VFX Supervisor  
**Page:** `/vfx/shots/:shotId/alignment`

## Purpose

Review advisory suggestions for missing or unclear Anchor boundaries.

## Sequence

```text
Open Alignment Workspace
→ Review tensions and evidence
→ Expand Re-anchor Proposal
→ Inspect constraints, variation zones, and open questions
→ Choose:
   No action
   Continue coordination
   Open Intent Workspace
```

## Locked rule

There is no `Apply proposal` button.

## Authority

Only Human VFX Supervisor decides whether to start a new Core Anchor revision.

## State impact

Reviewing the Proposal creates no authoritative state change.

---

# 13. HumanGate and Decision workflow

**Actors:**  
- Human VFX Supervisor for Core Anchor  
- Human CG Supervisor for Execution Anchor

## Sequence

```text
Draft revision exists
→ Submit to HumanGate
→ Gate becomes pending
→ Authorised human reviews:
   current state
   proposed revision
   differences
   evidence
   rationale
→ Confirm or reject
→ Explicit final confirmation
→ Persist HumanGate outcome and Decision
→ Update current state only on confirmation
```

## Placement

- HumanGate panel inside the relevant Anchor workspace;
- Decision history in Decisions / authority context;
- small confirmation dialog only after full comparison is visible.

## Rules

- no Agent resolves a gate;
- unauthorised roles see read-only state;
- rejection does not delete historical material;
- confirmation creates immutable authority history.

## Failure

- gate remains pending;
- current state unchanged;
- duplicate submission prevented;
- permission failure is explicit.

---

# 14. Artist clarification and CG escalation

## Goal

Represent unresolved questions without building an enterprise messaging system.

## Artist clarification

```text
Artist Version Workspace
→ Review supervisor questions from Artist guidance
→ See “Clarification required from CG Supervisor”
→ CG sees the same question in Task / Dependencies context
```

Where no persisted question object exists:

- display as immutable Agent-guidance content;
- do not show fake assignment, acknowledgement, or resolution.

## CG escalation

```text
CG Version Review or Dependencies
→ Review unresolved issue
→ See “Requires VFX clarification”
→ Open linked VFX Shot / Alignment context
```

Where no escalation object exists:

- show a recommendation and deep link;
- do not build status management.

## Deferred

- chat;
- messaging inbox;
- SLA;
- assignment workflow;
- acknowledgement lifecycle.

---

# 15. ftrack linkage and sync

## Step 7 purpose

Show where production facts come from and whether an object is integration-ready.

## Step 7 flow

```text
Open Project / Shot / Task / Version
→ View ftrack linkage component
→ Inspect linked state, entity type, source-of-truth, sync availability, external link
```

## Truthful states

- Linked to ftrack
- Integration-ready
- No linked ftrack entity
- Read-only connector validated
- Sync status unavailable
- Controlled write-back not available

## Failure

- local ICAS state remains available;
- integration failure is distinct from Agent failure;
- no secrets exposed;
- no local confirmed authority rewritten.

---

# 16. Controlled ftrack write-back

**Status:** Step 8 dependency

## Future sequence

```text
Human Decision exists
→ Open write-back preparation
→ Review destination entity
→ Review exact payload
→ Confirm controlled write-back
→ Connector executes
→ Persist success or failure evidence
→ Show Activity
```

## Locked boundaries

- no automatic write-back from Agent output;
- no write-back from Re-anchor Proposal;
- no hidden retry;
- no write-back without explicit human confirmation;
- no false success state.

Step 7 only shows capability readiness honestly.

---

# 17. History pattern

## Placement

- Core Anchor history → Intent Workspace
- Execution Anchor history → Execution Workspace
- VFX review history → VFX Version Review
- CG review history → CG Version Review
- Artist guidance history → Artist Version Workspace / Feedback History
- Cross-role Assessment history → Alignment Workspace
- Decision history → Decisions / authority context
- integration history → Activity / Integrations

## Interaction

```text
Current result expanded
→ Previous outputs (N)
→ Historical group collapsed
→ User expands a record
→ Timestamp, source, warning, provenance visible
```

## Rules

- no editing;
- no deleting from normal product flow;
- historical records never look current;
- validation-rule differences stated where relevant.

---

# 18. Evidence and provenance

## Evidence flow

```text
User sees evidence badge
→ Opens Evidence drawer
→ Reviews source type, source label, object link
→ Returns to current page
```

## Provenance flow

```text
User selects View provenance
→ Drawer shows:
   Agent
   capability
   provider
   model
   prompt version
   run status
   ContextSnapshot
   timestamp
   safe diagnostics
```

## Role treatment

- VFX: full expandable access;
- CG: full access for relevant execution context;
- Artist: simplified explanation first, technical detail expandable.

## Rules

- credentials never shown;
- invalid provider output not exposed as valid content;
- raw UUIDs remain secondary;
- evidence types match persisted contracts.

---

# 19. Shared loading, empty, failure, and permission states

## Loading

- skeletons for page data;
- explicit running state for Agent generation;
- existing valid data remains visible where possible;
- duplicate Generate action disabled while running.

## Empty state

Must explain:

- what is missing;
- why it matters;
- who can create it;
- the next valid action.

Example:

```text
No confirmed Core Anchor
A VFX Supervisor must confirm the shared creative boundary before execution guidance can be established.
```

## Failure categories

- prerequisite missing;
- permission denied;
- Agent generation failed;
- structured output invalid;
- integration unavailable;
- network / API failure.

## Permission state

Show:

- current role;
- action owner;
- read-only explanation;
- valid path back.

Do not rely only on hiding controls.

---

# 20. Navigation after major actions

| Action | Result |
|---|---|
| Save Anchor draft | Stay in Anchor workspace |
| Submit HumanGate | Stay and show pending |
| Confirm / reject HumanGate | Stay and show outcome |
| Generate role review | Stay in Version Review |
| Generate Artist guidance | Stay in Artist Version Workspace |
| Generate Cross-role Assessment | Stay in Alignment |
| Open evidence | Drawer, then return |
| Review Re-anchor Proposal | Stay in Alignment |
| Begin re-anchor work | Navigate to Intent Workspace |
| Exit Demo role | Return to `/demo` |
| Open ftrack entity | New external tab |
| Inspect history | Expand in current context |

---

# 21. Backend implications

These are planning findings, not automatic implementation approval.

## Likely required

- role-resolved session;
- stable current-result selectors;
- role homepage aggregation where current APIs would require fragile client joins.

## Needs investigation

- Task assignment;
- persisted escalation / question state;
- Version submission support;
- Activity aggregation;
- ftrack linkage summaries;
- current vs historical output APIs.

## Explicitly deferred

- notification lifecycle;
- live messaging;
- automatic proposal application;
- automatic escalation resolution;
- automatic Agent chains;
- enterprise assignment system;
- global task management.

---

# 22. Proposed decisions to lock

1. Core Anchor remains a dedicated VFX Intent workflow.
2. Execution Anchor remains a dedicated CG Execution workflow.
3. Agent generation remains on the relevant Version or Alignment page.
4. Every generation shows prerequisites before starting.
5. Agent outputs remain immutable and advisory.
6. HumanGate confirmation is separate from Agent generation.
7. HumanGate actions remain inside the relevant Anchor workspace.
8. Cross-role Assessment is generated and reviewed in Alignment.
9. Re-anchor Proposal is reviewed in Alignment but acted on only through Intent.
10. Intent Signal is derived automatically and only navigates attention.
11. Version approval is not invented.
12. Artist clarification and CG escalation remain contextual recommendations unless new persisted objects are approved.
13. Evidence and provenance use secondary layers.
14. History stays in object context, not a global archive.
15. ftrack linkage appears truthfully in Step 7; real sync and write-back remain Step 8.
16. Controlled write-back requires an existing Human Decision and explicit confirmation.
17. Major failures preserve existing confirmed state.
18. Failed or invalid runs never replace the current successful result.

---

# 23. Decisions for owner confirmation

## A. Anchor draft editing

**Recommendation:** edit inside the dedicated Anchor workspace, not in a modal.

## B. HumanGate confirmation

**Recommendation:** full comparison stays on the page; final Confirm / Reject uses a small explicit dialog.

## C. Agent generation

**Recommendation:** generate on the same role-specific Version or Alignment page; no generic Agent page.

## D. Cross-role context visibility

**Recommendation:** show the exact selected Task and Version before generation. Defaults are allowed, hidden inference is not.

## E. Re-anchor Proposal

**Recommendation:** only provide `Open Intent Workspace`; no `Apply proposal`.

## F. Artist clarification

**Recommendation:** surface supervisor questions to CG context, but do not build chat or fake assignment state.

## G. CG escalation

**Recommendation:** show escalation recommendations and deep links to VFX context; no enterprise escalation system.

## H. History

**Recommendation:** latest result expanded, previous results collapsed within the relevant object page.

## I. Evidence

**Recommendation:** evidence and provenance open in a drawer, not a separate route.

## J. Version submission

**Recommendation:** do not implement a full submission flow in Step 7 unless the current backend already supports an honest local Version-creation path. Reserve the UI location and complete the real production flow in Step 8.

---

# 24. Acceptance criteria

7A-3 is complete when:

1. Core Anchor workflow is approved;
2. Execution Anchor workflow is approved;
3. all three Role Agent workflows are approved;
4. Cross-role Assessment workflow is approved;
5. Intent Signal behaviour is approved;
6. Re-anchor Proposal behaviour is approved;
7. HumanGate and Decision authority are approved;
8. Version and ReviewNote behaviour is approved;
9. clarification and escalation scope is approved;
10. ftrack linkage and future write-back interaction are approved;
11. history, evidence, and provenance patterns are approved;
12. loading, empty, failure, and permission states are approved;
13. Decisions A–J are resolved;
14. no workflow introduces enterprise scope or new authority silently.

---

# 25. Next step

Step 7A-4 will convert the approved role model, information architecture, and workflows into:

- page wireframes;
- layout hierarchy;
- visual authority language;
- Intent Signal widget designs;
- ftrack linkage components;
- shared design system;
- component inventory;
- three-role Demo story and click path;
- implementation backlog;
- Claude Code task boundaries;
- final acceptance checklist.
