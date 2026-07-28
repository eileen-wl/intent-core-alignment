# ICAS Step 7 Experience Architecture Master Plan

**Version:** v1.0  
**Status:** Planning baseline  
**Scope:** Step 7 — Role-aware Dashboard / Product Experience Layer  
**Next sub-stage:** 7A-1 — Roles, Identity, Permissions, and Demo Mode

---

## 1. Why Step 7 exists

Steps 0–6 proved that ICAS can actually work:

- Core semantic objects exist.
- Core Anchor and Execution Anchor workflows exist.
- VFX Supervisor, CG Supervisor, and Artist Agents exist.
- ContextSnapshot and AgentRun provenance exist.
- Cross-role Assessment, Re-anchor Proposal, and Intent Signal exist.
- Human authority boundaries have been validated.
- Real-provider execution has been validated.

Step 7 has a different responsibility.

It must turn the existing technical system into a coherent product experience that:

1. different production roles can understand and use;
2. clearly distinguishes production facts, Agent interpretation, Agent proposals, and human-confirmed decisions;
3. makes the full ICAS workflow visible without forcing viewers to inspect code;
4. provides a credible portfolio and demonstration surface;
5. prepares the information architecture for the Step 8 ftrack integration.

Step 7 is therefore not a visual polish pass. It is the design and implementation of the product-facing experience architecture.

---

## 2. Step 7 final outcome

At the end of Step 7, ICAS should provide:

- a coherent application shell;
- role-based entry points and workspaces;
- a complete navigation and route structure;
- clear Project, Shot, Task, Version, Intent, Alignment, Decision, and Activity views;
- a global Intent Signal attention layer;
- integration-ready ftrack linkage and sync presentation;
- clear Human-in-the-loop interaction flows;
- a reusable visual language for authority, evidence, status, and history;
- a complete three-role demo path;
- production-quality frontend states and build validation.

The final experience must allow a reviewer to understand the system without reading the codebase.

---

## 3. Locked architectural facts

The following are already fixed by the current system and must not be contradicted by Step 7.

### Human roles

- Human VFX Supervisor
- Human CG Supervisor
- Human Artist

### Agents

- one central Core Agent;
- one VFX Supervisor Agent;
- one CG Supervisor Agent;
- one Artist Agent.

Agents are not login roles and do not receive their own human workspace.

### Human authority

- Human VFX Supervisor controls the Core Anchor.
- Human CG Supervisor controls the Execution Anchor.
- Human Artist cannot establish or modify Anchors.
- Re-anchor Proposal is advisory.
- Intent Signal is derived attention guidance, not a Decision.
- Agents do not confirm HumanGates.
- Agents do not create authoritative Decisions.

### Existing domain structure

The system already contains or relies on:

- Project
- Shot
- Task
- Version
- ReviewNote
- IntentBrief
- IntentDecomposition
- ContextReconstruction
- CoreAnchor / CoreAnchorRevision
- ExecutionAnchor / ExecutionAnchorRevision
- HumanGate
- Decision
- VFXSupervisorReview
- CGSupervisorReview
- ArtistAgentGuidance
- CrossRoleAssessment
- ReAnchorProposal
- IntentSignal
- ContextSnapshot
- AgentRun
- ftrack connector and write-back foundations

Step 7 reorganises how these are experienced. It does not redefine their authority.

---

## 4. Core planning principles

### 4.1 Role-based, not role-switching

A normal user must not freely switch between VFX Supervisor, CG Supervisor, and Artist inside the main product UI.

The final experience must separate:

- normal product mode;
- demo mode;
- development/testing mode.

Role identity should remain fixed during a normal or demo session.

### 4.2 One page, one primary task

A page should not attempt to show every object and every workflow at once.

Each page should have one main purpose, such as:

- understand current Shot status;
- inspect creative intent;
- review execution constraints;
- act on a Version;
- inspect cross-role alignment;
- make or review a human-controlled decision.

### 4.3 Progressive disclosure

Primary content should be readable without exposing every UUID, evidence object, revision, and AgentRun.

Detailed evidence, provenance, history, and integration metadata should remain available through expandable or secondary layers.

### 4.4 Authority must be visible

The UI must make it immediately clear whether something is:

- a production fact;
- human-authored intent;
- human-confirmed state;
- Agent interpretation;
- Agent proposal;
- derived attention signal;
- historical output.

### 4.5 Intent Signal is an attention layer

Intent Signal should not exist only as a card inside Cross-role Assessment.

It should appear appropriately across:

- role homepages;
- Project and Shot lists;
- contextual page headers;
- a global signal entry point;
- assessment detail.

Step 7 should not fake unread, acknowledge, dismiss, assignment, or resolution state unless new backend support is explicitly approved.

### 4.6 ftrack is production context, not a duplicated product

ICAS should not recreate the ftrack interface.

Step 7 should define where linked production facts, sync status, source-of-truth, and write-back state appear. Step 8 will connect the real Version, ReviewNote, entity linkage, and write-back data.

### 4.7 Demo quality matters

The final product must support a clear 5–10 minute demonstration across the three roles without relying on source code or database inspection.

---

## 5. Planning and implementation structure

Step 7 is divided into two major phases:

- **Step 7A — Experience architecture and product specification**
- **Step 7B–7D — Frontend implementation and validation**

No large frontend implementation should begin before Step 7A is approved.

---

# Part I — Step 7A: Experience Architecture

## 6. Step 7A-1 — Roles, Identity, Permissions, and Demo Mode

### Purpose

Define who uses ICAS, how identity is established, what each role is trying to accomplish, and what each role can see or do.

### Questions to resolve

- Which human roles have formal workspaces?
- Is Production Coordinator represented as a user, production fact, or future extension?
- How is role identity resolved in normal product mode?
- How does demo mode work?
- How does a user exit one demo role and enter another?
- What remains visible only in development mode?
- What content is complete, summarised, hidden, or read-only for each role?
- Which actions are role-restricted?
- Which Agent outputs are visible to each role?
- How are Agent identity and human identity distinguished?
- Who can access integration health and provenance?
- What is the minimum realistic authentication placeholder for the portfolio prototype?

### Required outputs

1. Actor inventory
2. Role definitions
3. Role goals and responsibilities
4. Identity-mode model
5. Product mode vs Demo mode vs Development mode
6. Permission matrix
7. Content-visibility matrix
8. Role-specific homepage goals
9. Role-specific daily task model
10. Role-switching policy
11. Open decisions and alternatives
12. Locked 7A-1 specification

### Decision gate

7A-1 is complete only when:

- role switching is no longer an ambiguous UI behaviour;
- each role has a clear product entry;
- each role has a clear primary responsibility;
- content visibility and action authority are defined;
- Demo mode is separated from normal product mode.

---

## 7. Step 7A-2 — Information Architecture, Sitemap, and Routes

### Purpose

Define the complete product structure before detailed page design.

### Questions to resolve

- What is the global hierarchy between Project, Shot, Task, and Version?
- Which objects deserve independent pages?
- Which objects are page sections, panels, drawers, or history items?
- Which pages are shared and which are role-specific?
- How does a user move from overview to detail?
- Which routes must be directly shareable and reload-safe?
- Where do Intent, Execution, Alignment, Decisions, Activity, History, Evidence, and Integrations live?
- Should Signal have a global list and a contextual detail view?
- How should Project-level and Shot-level activity be related?
- Where should ftrack linkage and sync status appear?
- What belongs in global navigation, contextual navigation, and breadcrumbs?
- Which existing routes are retained, replaced, or redirected?

### Required outputs

1. Complete sitemap
2. Global navigation model
3. Role-specific navigation model
4. Route map
5. Page inventory
6. Page-purpose statements
7. Shared vs role-specific page matrix
8. Object-to-page mapping
9. Breadcrumb rules
10. Deep-linking rules
11. History and Activity placement
12. Evidence and provenance placement
13. Integration placement
14. Existing-route migration map
15. Locked 7A-2 specification

### Candidate route structure to evaluate

```text
/
/demo
/vfx
/vfx/projects
/vfx/projects/:projectId
/vfx/shots/:shotId
/vfx/shots/:shotId/intent
/vfx/shots/:shotId/alignment
/vfx/shots/:shotId/decisions

/cg
/cg/tasks
/cg/tasks/:taskId
/cg/tasks/:taskId/execution
/cg/tasks/:taskId/versions
/cg/tasks/:taskId/dependencies

/artist
/artist/tasks
/artist/tasks/:taskId
/artist/tasks/:taskId/versions/:versionId
/artist/tasks/:taskId/history

/signals
/integrations
```

This route list is not locked. It is a planning candidate for 7A-2.

### Decision gate

7A-2 is complete only when:

- every major domain object has a clear product location;
- each role has a coherent navigation path;
- there is no dependence on one infinite Shot page;
- ftrack, Intent Signal, history, evidence, and decisions all have defined locations;
- the route plan can support both portfolio demonstration and implementation.

---

## 8. Step 7A-3 — Core Workflows and Interaction Architecture

### Purpose

Define what happens before, during, and after every major human or Agent action.

### Workflows to specify

1. Create / review / confirm Core Anchor
2. Create / review / confirm Execution Anchor
3. Generate VFX Supervisor review
4. Generate CG Supervisor review
5. Generate Artist guidance
6. Submit or inspect Version
7. Capture and inspect ReviewNote
8. Generate Cross-role Assessment
9. Inspect Intent Signal
10. Review Re-anchor Proposal
11. HumanGate confirmation or rejection
12. Decision creation and history
13. Escalation from Artist to CG
14. Escalation from CG to VFX
15. ftrack sync and linkage display
16. controlled write-back preparation and result display
17. historical result inspection
18. evidence and provenance inspection

### Questions to resolve

- Which actions happen inline?
- Which actions use a dedicated page?
- Which actions use a modal, drawer, stepper, or confirmation page?
- What context must be shown before a Generate action?
- How does the user review generated output before any human action?
- What is immutable, editable, confirmable, or advisory?
- What happens after a HumanGate is resolved?
- How are failures and incomplete prerequisites shown?
- How are historical outputs separated from current outputs?
- How does a user return to the main task after inspecting evidence?
- Which interactions require backend additions and which are presentation-only?

### Required outputs

For each workflow:

- actor;
- entry point;
- prerequisite;
- context shown;
- user input;
- system action;
- Agent action, if any;
- review state;
- human authority point;
- success result;
- failure result;
- history behaviour;
- navigation after completion;
- Step 7 vs Step 8 ownership.

### Decision gate

7A-3 is complete only when every high-authority action has a clear interaction sequence and no critical workflow is hidden inside a long page.

---

## 9. Step 7A-4 — Wireframes, Visual System, and Demo Specification

### Purpose

Translate the approved architecture into screen structures, reusable components, visual rules, and an implementation-ready demonstration plan.

### Required wireframes

At minimum:

- Demo role entry
- VFX Alignment Inbox
- VFX Project Overview
- VFX Shot Overview
- VFX Intent Workspace
- VFX Cross-role Alignment
- VFX Decisions
- CG Execution Inbox
- CG Task Workspace
- CG Execution Anchor workflow
- CG Version Review
- CG Dependencies / Escalations
- Artist My Tasks
- Artist Task Detail
- Artist Version Workspace
- Artist Feedback History
- Global Intent Signal view
- Integration status view
- Evidence / provenance pattern
- Historical output pattern
- Empty, loading, error, and permission states

### Visual system requirements

Define a reusable language for:

- production fact;
- human intent;
- confirmed state;
- Agent interpretation;
- Agent proposal;
- derived signal;
- open question;
- historical output;
- ftrack-linked state;
- sync success / stale / failed;
- priority;
- role;
- HumanGate status;
- Decision status.

### Component inventory

Candidate components include:

- AppShell
- GlobalNav
- RoleIdentityHeader
- Breadcrumbs
- ProjectCard
- ShotCard
- TaskCard
- VersionCard
- IntentSignalWidget
- SignalBadge
- AttentionInboxItem
- AnchorSummary
- AnchorRevisionHistory
- HumanGatePanel
- DecisionPanel
- RolePerspectiveCard
- AlignmentSummary
- ReAnchorProposalPanel
- AgentOutputCard
- EvidenceDrawer
- ProvenancePanel
- HistoricalOutputGroup
- FtrackLinkBadge
- SyncStatusPanel
- ActivityTimeline
- EmptyState
- LoadingSkeleton
- ErrorState
- PermissionState

### Demo specification

The demo must define:

- entry point;
- scenario;
- role order;
- screens visited;
- actions performed;
- facts narrated;
- human-control moments;
- ftrack story;
- Signal story;
- final conclusion;
- expected duration;
- fallback path if live services fail.

### Decision gate

7A-4 is complete only when Claude Code could implement the experience without inventing major product decisions.

---

# Part II — Step 7B–7D: Implementation

## 10. Step 7B — Application Shell and Shared Design System

### Scope

- application shell;
- navigation;
- role identity;
- Demo entry;
- layout primitives;
- typography and spacing;
- cards and panels;
- status badges;
- authority visual language;
- empty/loading/error/permission states;
- shared evidence, provenance, history, and ftrack-ready components.

### Primary goal

Create a stable shared foundation before rebuilding individual role pages.

### Out of scope

- new Agent capability;
- new notification lifecycle;
- real Step 8 ftrack extension work;
- enterprise authentication;
- media playback;
- real-time collaboration.

---

## 11. Step 7C — Role Workspaces and Core Pages

Implementation should proceed in demonstration priority order.

### 7C-1 VFX Supervisor experience

1. Alignment Inbox
2. Project Overview
3. Shot Overview
4. Intent Workspace
5. Cross-role Alignment
6. Decisions

### 7C-2 CG Supervisor experience

1. Execution Inbox
2. Task Workspace
3. Execution Anchor workflow
4. Version Review
5. Dependencies / Escalations

### 7C-3 Artist experience

1. My Tasks
2. Task Detail
3. Version Workspace
4. Feedback History

### 7C-4 Shared supporting experiences

- Intent Signal entry and contextual widget
- Integrations page structure
- Activity
- History
- Evidence
- Provenance
- route migration and redirects

---

## 12. Step 7D — Demo Readiness and Final Validation

### Functional validation

- role-specific entry and locked identity;
- correct navigation;
- correct read/write authority;
- current and historical outputs;
- Intent Signal placement;
- ftrack-ready linkage states;
- HumanGate and Decision flows;
- all existing Agent capabilities remain usable.

### UX validation

- first-time reviewer understands the product;
- each role knows what to do next;
- no page is an unstructured infinite data dump;
- Agent advisory content is not mistaken for human-confirmed state;
- evidence remains available without overwhelming primary reading;
- current and historical outputs are distinguishable;
- empty/loading/error/permission states are credible.

### Demo validation

- complete VFX → CG → Artist narrative;
- no arbitrary role switching inside workspaces;
- live demo can be completed in 5–10 minutes;
- fallback screenshots or recorded path exist;
- all routes work after refresh;
- production build passes.

### Technical validation

- frontend tests;
- TypeScript;
- ESLint;
- Prettier;
- production build;
- route tests;
- accessibility checks for core interactions;
- no authority regression;
- no Step 8 behaviour falsely presented as complete.

---

## 13. Step 7 and Step 8 boundary

### Step 7 owns

- where ftrack information appears;
- linkage and sync visual components;
- source-of-truth language;
- integration status page structure;
- Activity representation;
- controlled write-back status presentation;
- integration-ready empty states;
- navigation to future ftrack-linked data.

### Step 8 owns

- real Version linkage;
- real ReviewNote linkage;
- real entity ids and URLs;
- sync results;
- inbound production updates;
- controlled write-back;
- failure and retry evidence;
- connector-specific data and validation.

Step 7 must never fake a successful ftrack sync or write-back.

---

## 14. Backend-change policy during Step 7

Step 7 is primarily an experience and frontend stage, but planning may reveal missing backend support.

Every proposed backend addition must be classified as one of:

### A. Required for honest presentation

Without it, the UI would present false state or unusable flow.

### B. Useful but deferrable

The UI can truthfully show a read-only or integration-ready state.

### C. Out of scope

Enterprise features or new workflow capabilities not required for the portfolio prototype.

Potential backend gaps to evaluate include:

- role/session resolution;
- dashboard aggregation endpoints;
- signal aggregation;
- task assignment and ownership;
- Activity aggregation;
- integration health summary;
- demo fixture selection;
- notification lifecycle.

No backend addition should be implemented silently inside frontend work.

---

## 15. Planning artefacts

The Step 7 planning phase should produce one maintained specification set:

### Main document

`docs/STEP_7_EXPERIENCE_ARCHITECTURE.md`

### Supporting artefacts

- role and permission matrix;
- sitemap;
- route map;
- object-to-page matrix;
- workflow diagrams;
- page inventory;
- component inventory;
- wireframes;
- data-to-UI mapping;
- Step 7 / Step 8 boundary matrix;
- Demo script;
- implementation backlog;
- acceptance checklist.

These should remain internally consistent and versioned together.

---

## 16. Decision tracking

Every major planning item should use one status:

- **Locked**
- **Proposed**
- **Open**
- **Deferred**
- **Step 8 dependency**
- **Out of scope**

Every decision should include:

- question;
- decision;
- rationale;
- affected roles;
- affected pages;
- backend impact;
- implementation impact;
- validation requirement.

This prevents design decisions from being buried inside wireframes or code.

---

## 17. Recommended working sequence

### Phase 1 — Master Plan approval

Approve this document as the planning structure.

### Phase 2 — 7A-1

Complete and lock:

- roles;
- identity;
- permissions;
- Demo mode;
- role-specific goals;
- content visibility.

### Phase 3 — 7A-2

Complete and lock:

- sitemap;
- routes;
- page inventory;
- navigation;
- object placement.

### Phase 4 — 7A-3

Complete and lock:

- core workflows;
- interaction sequence;
- authority points;
- failure and history behaviour.

### Phase 5 — 7A-4

Complete and lock:

- wireframes;
- design system;
- components;
- demo specification;
- implementation backlog.

### Phase 6 — 7B

Build the shared shell and visual system.

### Phase 7 — 7C

Build role workspaces and core pages.

### Phase 8 — 7D

Validate and prepare the final demonstration.

No implementation phase should begin while major upstream decisions remain open.

---

## 18. Master acceptance criteria

The Step 7 Master Plan is complete when:

1. the purpose and final outcome of Step 7 are clear;
2. the role model and identity problem are explicitly scheduled for 7A-1;
3. the full information architecture problem is explicitly scheduled for 7A-2;
4. every major workflow is explicitly scheduled for 7A-3;
5. wireframes, visual language, components, and demo are explicitly scheduled for 7A-4;
6. Step 7B–7D implementation order is defined;
7. Step 7 and Step 8 responsibilities are separated;
8. backend gaps must be identified rather than hidden;
9. every stage has concrete outputs and a decision gate;
10. no large frontend implementation starts before the planning gates are complete.

---

## 19. Immediate next step

The next document to produce is:

# Step 7A-1 — Roles, Identity, Permissions, and Demo Mode Specification

It will make detailed and lockable decisions about:

- formal users and supporting identities;
- role responsibilities;
- role-specific product entry;
- normal mode;
- Demo mode;
- Development mode;
- session role locking;
- visibility;
- authority;
- permission matrix;
- role-specific homepage responsibilities;
- demo identity mechanics;
- backend implications;
- open alternatives;
- final decisions requiring owner approval.

No sitemap or page-level implementation should be locked before 7A-1 is complete.
