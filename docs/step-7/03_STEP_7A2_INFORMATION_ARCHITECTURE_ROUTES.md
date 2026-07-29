# ICAS Step 7A-2 — Information Architecture, Sitemap, Navigation, and Route Specification

**Version:** v1.0  
**Status:** Proposed for owner review  
**Parent:** Step 7 Experience Architecture Master Plan  
**Depends on:** Step 7A-1 — Roles, Identity, Permissions, and Demo Mode  
**Scope:** Portfolio-grade, role-based product information architecture  
**Not in scope:** Detailed wireframes, final visual design, enterprise authentication, notification lifecycle, Step 8 ftrack data implementation

> **Amended by `10_FTRACK_ENTRY_AND_IA_AMENDMENT.md`:** the VFX Shot and
> CG Task contextual navigation (Decisions folded into Intent/Alignment/
> Activity; a `Versions` collection tab added ahead of Version detail),
> the Integrations placement (secondary System destination, not a
> primary VFX workflow), and the three product entry modes. Read the
> amendment alongside this document; sections below are marked
> `[Amended]` where it applies.

---

## 1. Purpose

Step 7A-2 defines where every major ICAS object, Agent output, human decision, Intent Signal, ftrack relationship, history record, and evidence layer belongs in the product.

It answers:

- What is the overall product hierarchy?
- Which pages exist?
- Which role enters which pages?
- Which objects receive independent pages?
- Which objects are summaries, panels, drawers, tabs, or historical records?
- How does a user move between Project, Shot, Task, and Version?
- Where do Intent Signal, Activity, ftrack, Evidence, and Decisions live?
- Which current routes are retained, migrated, or moved into Development mode?
- Which detailed processes belong on the same page and which require a separate interaction sequence?

This specification does not yet define the exact layout of every component. That belongs to Step 7A-4.

---

# 2. Locked inputs from Step 7A-1

The following decisions are already locked:

1. Formal production roles:
   - Human VFX Supervisor
   - Human CG Supervisor
   - Human Artist

2. Agents are not login roles.

3. Normal product mode:
   - role is resolved at entry;
   - role remains fixed during the session;
   - there is no in-workspace role switcher.

4. Demo mode:
   - begins at a dedicated role-entry page;
   - selected role persists across refresh;
   - switching requires `Exit role view`.

5. Development mode:
   - retains raw role and actor controls;
   - is hidden from the portfolio-facing product.

6. Role homepages:
   - VFX Supervisor → Alignment Inbox
   - CG Supervisor → Execution Inbox
   - Artist → My Tasks

7. Artist:
   - sees task-relevant Cross-role Assessment and Re-anchor Proposal summaries by default;
   - may expand the full immutable outputs read-only.

8. Intent Signal:
   - is one persisted object;
   - receives role-specific explanation;
   - does not gain unread, acknowledge, dismiss, assign, or resolve state in Step 7.

9. ftrack:
   - full Integration overview for VFX;
   - Task-level operational linkage for CG;
   - object-level linkage for Artist.

10. No Production Coordinator workspace and no Integration Administrator workspace are added.

---

# 3. Information-architecture principles

## 3.1 Role workspace first

The first level of navigation is the human role workspace, not a generic database-object browser.

Each role enters through a homepage shaped around their responsibilities.

## 3.2 Domain hierarchy remains visible

Even though workspaces are role-specific, the underlying production hierarchy remains:

```text
Project
└── Shot
    ├── Intent
    │   ├── IntentBrief
    │   ├── IntentDecomposition
    │   ├── ContextReconstruction
    │   └── CoreAnchor / Revisions
    ├── Task
    │   ├── ExecutionAnchor / Revisions
    │   └── Version
    │       ├── ReviewNote
    │       ├── VFXSupervisorReview
    │       ├── CGSupervisorReview
    │       └── ArtistAgentGuidance
    ├── CrossRoleAssessment
    │   ├── ReAnchorProposal
    │   └── IntentSignal
    ├── HumanGate
    ├── Decision
    ├── Activity
    └── ftrack linkage
```

The product must preserve this relationship without forcing every role to inspect the full tree.

## 3.3 Overview pages summarise; workspaces act

- Overview pages answer: “What is happening?”
- Workspace pages answer: “What do I need to understand or do?”
- Detail layers answer: “What evidence and history support this?”

## 3.4 One main purpose per page

A page may include supporting context, but only one primary understanding task or authority action.

Examples:

- Shot Overview: understand current Shot state.
- Intent Workspace: understand and manage shared creative intent.
- Alignment Workspace: inspect cross-role agreements, tensions, Signal, and proposal.
- Execution Workspace: manage department execution boundaries.
- Version Workspace: understand and act on one Version iteration.

## 3.5 Progressive disclosure

Default content should not include:

- full UUIDs;
- raw AgentRun records;
- raw ContextSnapshot JSON;
- all historical revisions;
- unrelated Tasks or Versions;
- repeated evidence trees;
- raw ftrack payloads.

These remain available through Evidence, Provenance, History, Activity, or Development mode.

## 3.6 Route-backed primary sections

Important workspace sections should have stable URLs.

This enables:

- browser refresh;
- direct links;
- clear Demo navigation;
- testability;
- credible product behaviour.

Small supporting interactions may use drawers, expandable regions, or dialogs.

---

# 4. Global application structure

## 4.1 Public / entry layer

### `/`

Purpose:

- product title and concise explanation;
- normal sign-in entry when available;
- Demo entry;
- no raw role selector.

For the prototype, `/` may redirect directly to `/demo` until normal authentication exists.

### `/demo`

Purpose:

- explain the shared production scenario;
- present three role-entry cards;
- establish a session-scoped Demo identity;
- enter the selected role workspace.

Contents:

- project / scenario summary;
- role responsibility;
- “What this role is trying to answer”;
- Enter as VFX Supervisor;
- Enter as CG Supervisor;
- Enter as Artist.

### `/dev`

Purpose:

- retain existing raw role and actor controls;
- access development fixtures and direct diagnostic pages;
- remain outside the portfolio-facing navigation.

This route is not part of the Demo story.

---

## 4.2 Shared workspace shell

Every role workspace shares:

- product identity;
- current user and role;
- `Demo mode` indicator when applicable;
- `Exit role view`;
- role-specific primary navigation;
- contextual breadcrumbs;
- contextual Project / Shot / Task / Version identity;
- Intent Signal entry;
- Activity access where relevant;
- Evidence / provenance pattern;
- ftrack linkage pattern.

The shell does not contain a role dropdown.

---

# 5. VFX Supervisor information architecture

## 5.1 Primary navigation

```text
Alignment Inbox
Projects
Intent Signals
Integrations
```

Contextual Shot navigation appears after entering a Shot: **[Amended]**

```text
Overview
Intent
Versions
Alignment
Activity
```

`Decisions` is no longer an isolated top-level tab -- see the
`10_FTRACK_ENTRY_AND_IA_AMENDMENT.md` §5.1 for the reason and where
Decision visibility now lives (inside Intent, Alignment, and Activity).

## 5.2 VFX routes

**[Amended]** adds `/vfx/shots/:shotId/versions` (planned, not
implemented); removes `/vfx/shots/:shotId/decisions` as an isolated
route.

```text
/vfx
/vfx/projects
/vfx/projects/:projectId
/vfx/shots/:shotId
/vfx/shots/:shotId/intent
/vfx/shots/:shotId/versions
/vfx/shots/:shotId/versions/:versionId
/vfx/shots/:shotId/alignment
/vfx/shots/:shotId/activity
/vfx/signals
/vfx/integrations
```

## 5.3 Page inventory

### A. `/vfx` — Alignment Inbox

**Primary purpose:** decide what needs VFX Supervisor attention next.

Shows:

- high-attention Intent Signals;
- Shots requiring human review;
- pending Core Anchor work;
- recent cross-role tensions;
- Re-anchor Proposals awaiting consideration;
- recent Decisions;
- recent ftrack / production changes where available.

Does not show:

- full Cross-role Assessment text;
- complete Anchor revision history;
- all Agent outputs.

Each item links to its context.

---

### B. `/vfx/projects` — Projects

**Primary purpose:** find and compare active Projects.

Shows per Project:

- name;
- concise status;
- Shot count;
- high / medium / low attention distribution;
- confirmed / missing Core Anchor summary;
- recent update;
- ftrack connection state.

---

### C. `/vfx/projects/:projectId` — Project Overview

**Primary purpose:** understand project-level alignment state.

Shows:

- Project summary;
- Intent context;
- Shot attention distribution;
- Shot list;
- recent Human Decisions;
- recent Intent Signals;
- ftrack Project linkage;
- recent Activity.

Does not become a full project-administration page.

---

### D. `/vfx/shots/:shotId` — Shot Overview

**Primary purpose:** understand the current Shot state and the next human action.

Header:

- Project;
- Shot;
- current selected Task;
- current selected Version;
- current phase;
- latest Intent Signal;
- last updated;
- ftrack linkage.

Main content:

1. Current attention
2. Recommended next human action
3. Creative-intent summary
4. Confirmed Core Anchor summary
5. Confirmed Execution Anchor summary
6. latest Version summary
7. role-state overview
8. unresolved dependencies
9. recent Decision / HumanGate facts
10. links to deeper workspaces

Does not display every detailed object continuously.

---

### E. `/vfx/shots/:shotId/intent` — Intent Workspace

**Primary purpose:** inspect and manage the shared creative-intent chain.

Contains:

- IntentBrief;
- IntentDecomposition;
- ContextReconstruction;
- current Core Anchor;
- Core Anchor semantic objects;
- Core Anchor revision history;
- Core Anchor HumanGate;
- linked Decision;
- Agent provenance and evidence;
- entry to Core Anchor draft / review process.

This is the formal home of Core Anchor authority.

Detailed create / review / confirm interaction is defined in 7A-3.

---

### E2. `/vfx/shots/:shotId/versions` — Versions **[Amended, planned]**

**Primary purpose:** the Version collection for a Shot -- lead here
before a single Version's detail/review, since a Shot's Task(s) may
have more than one Version.

Not implemented in Step 7B-2 or by this amendment; see
`10_FTRACK_ENTRY_AND_IA_AMENDMENT.md` §6.

---

### F. `/vfx/shots/:shotId/versions/:versionId` — VFX Version Review

**Primary purpose:** inspect one Version from the VFX perspective.

Contains:

- Version production facts;
- ReviewNotes;
- current Shot intent summary;
- VFX Supervisor Agent review;
- selected CG / Artist summaries;
- current issues;
- evidence and provenance;
- ftrack Version / ReviewNote linkage;
- historical VFX reviews.

Does not show the full Alignment Workspace by default.

---

### G. `/vfx/shots/:shotId/alignment` — Cross-role Alignment Workspace

**Primary purpose:** understand agreement, tension, local optimisation, and the need for human coordination.

Contains:

- latest Intent Signal;
- CrossRoleAssessment;
- three role perspectives;
- agreements;
- cross-role tensions;
- local-optimum risks;
- unresolved dependencies;
- human-coordination priorities;
- ReAnchorProposal;
- assessment history;
- evidence and provenance;
- link to Intent Workspace when a human chooses to begin a new Core Anchor process.

This page does not automatically modify an Anchor.

---

### H. Decision visibility **[Amended -- no longer an isolated route]**

**Correction:** `/vfx/shots/:shotId/decisions` is removed as a
top-level workspace. Decisions are contextual records produced inside
other flows and lose their meaning (which Anchor revision, which
Assessment, which gate) when isolated from that context. See
`10_FTRACK_ENTRY_AND_IA_AMENDMENT.md` §5.1.

Decision content that this section previously described (pending
HumanGates, confirmed/rejected outcomes, linked Anchor revision,
linked evidence, actor, rationale, history) is distributed instead:

- Core Anchor and HumanGate decisions -> **inside Intent** (section E);
- cross-role coordination decisions -> **inside Alignment** (section G);
- historical and superseded decisions -> **inside Activity** (section I).

This remains VFX-level human authority history, not a generic
organisation-wide decision system -- only its placement changed.

---

### I. `/vfx/shots/:shotId/activity` — Shot Activity

**Primary purpose:** understand the chronological sequence of production facts, Agent outputs, human actions, and integration events.

Activity types:

- ftrack production fact;
- Version / ReviewNote event;
- Agent output;
- ContextSnapshot / AgentRun completion summary;
- HumanGate;
- Decision;
- Signal creation;
- Re-anchor Proposal creation;
- sync / write-back state where available.

Activity items visually distinguish authority type.

---

### J. `/vfx/signals` — Intent Signals

**Primary purpose:** review attention signals across relevant Projects and Shots.

Shows:

- attention level;
- role-contextual explanation;
- Project / Shot / Task / Version context;
- drivers;
- proposal-present flag;
- created time;
- link to supporting Alignment Workspace.

Does not add read / unread / resolve actions.

---

### K. `/vfx/integrations` — Integrations **[Amended: placement]**

**Correction:** this is a **secondary, System/technical-status
destination** -- useful for demonstration and operational transparency,
but **not part of the VFX Supervisor's primary daily workflow** (which
remains Alignment Inbox -> Shot Overview -> Intent/Alignment). See
`10_FTRACK_ENTRY_AND_IA_AMENDMENT.md` §7. Object-level ftrack linkage
remains visible in context on Project, Shot, Task, Version, and
ReviewNote regardless of this page.

**Primary purpose:** understand ICAS connection readiness and current ftrack status.

Step 7 presentation:

- connector status;
- configured / not configured;
- read-only / controlled write-back capability state;
- latest known validation;
- Project / Shot / Task / Version linkage coverage;
- recent integration Activity;
- honest empty states;
- Step 8-dependent capabilities clearly labelled.

It must not imply successful entity sync when none exists.

---

# 6. CG Supervisor information architecture

## 6.1 Primary navigation

```text
Execution Inbox
Tasks
Intent Signals
```

Contextual Task navigation: **[Amended]**

```text
Overview
Execution
Versions
Dependencies
Activity
```

The singular `Version Review` tab is replaced with `Versions` -- a
Task may contain more than one Version, so primary navigation must lead
to a Version **collection** before a single Version's detail/review.
See `10_FTRACK_ENTRY_AND_IA_AMENDMENT.md` §5.2.

## 6.2 CG routes

**[Amended]** adds `/cg/tasks/:taskId/versions` (planned, not
implemented).

```text
/cg
/cg/tasks
/cg/tasks/:taskId
/cg/tasks/:taskId/execution
/cg/tasks/:taskId/versions
/cg/tasks/:taskId/versions/:versionId
/cg/tasks/:taskId/dependencies
/cg/tasks/:taskId/activity
/cg/signals
```

## 6.3 Page inventory

### A. `/cg` — Execution Inbox

**Primary purpose:** decide which execution issue needs attention next.

Shows:

- assigned Tasks;
- missing / draft / rejected / confirmed Execution Anchor state;
- new Versions;
- new ReviewNotes;
- unresolved dependencies;
- required escalations;
- relevant Intent Signals;
- recent VFX changes.

---

### B. `/cg/tasks` — Tasks

**Primary purpose:** find and compare current Tasks.

Shows per Task:

- Task name;
- Shot;
- department;
- status;
- current Version;
- Execution Anchor status;
- relevant Intent Signal;
- dependency count;
- latest update;
- ftrack linkage.

---

### C. `/cg/tasks/:taskId` — Task Workspace

**Primary purpose:** understand the Task context and next execution action.

Header:

- Project;
- Shot;
- Task;
- department;
- current Version;
- status;
- relevant Intent Signal;
- ftrack linkage.

Main content:

1. Task goal
2. Core Anchor summary
3. current Execution Anchor summary
4. latest VFX feedback summary
5. latest CG review summary
6. Artist state
7. unresolved dependencies
8. escalation status
9. next action

This is the CG equivalent of the VFX Shot Overview.

---

### D. `/cg/tasks/:taskId/execution` — Execution Anchor Workspace

**Primary purpose:** create, inspect, and confirm department execution boundaries.

Contains:

- Core Anchor context;
- current Execution Anchor;
- Execution Anchor revisions;
- requirements;
- constraints;
- supported variation;
- dependency and escalation conditions;
- HumanGate;
- Decision;
- Agent evidence;
- ftrack Task linkage.

Detailed create / review / confirm flow belongs to 7A-3.

---

### D2. `/cg/tasks/:taskId/versions` — Versions **[Amended, planned]**

**Primary purpose:** the Version collection for a Task -- lead here
before a single Version's detail/review.

Not implemented in Step 7B-2 or by this amendment; see
`10_FTRACK_ENTRY_AND_IA_AMENDMENT.md` §6.

---

### E. `/cg/tasks/:taskId/versions/:versionId` — CG Version Review

**Primary purpose:** review one Version against confirmed execution guidance.

Contains:

- Version production facts;
- ReviewNotes;
- Execution Anchor context;
- CG Supervisor Agent review;
- relevant VFX review;
- relevant Artist guidance;
- execution concerns;
- proposed guidance and underlying intent;
- evidence and provenance;
- ftrack linkage;
- historical CG reviews.

---

### F. `/cg/tasks/:taskId/dependencies` — Dependencies and Escalations

**Primary purpose:** understand and coordinate cross-department execution dependencies.

Contains:

- dependency list;
- affected departments;
- current status;
- why it matters;
- linked evidence;
- owner or responsible human where known;
- escalation question;
- whether VFX clarification is required;
- relevant Signal.

Step 7 must not invent assignment or resolution state if it is not persisted.

---

### G. `/cg/tasks/:taskId/activity` — Task Activity

**Primary purpose:** inspect the chronological Task workflow.

Shows:

- ftrack Task and Version facts;
- ReviewNotes;
- Execution Anchor revisions;
- HumanGate and Decision events;
- CG review;
- Artist guidance;
- relevant Signal;
- sync / write-back status.

---

### H. `/cg/signals` — Intent Signals

**Primary purpose:** show signals that affect execution responsibility.

Role-specific interpretation emphasises:

- execution ambiguity;
- missing boundaries;
- unresolved dependencies;
- escalation need.

Links go to Task Workspace, Execution Workspace, Version Review, or VFX coordination context.

---

# 7. Artist information architecture

## 7.1 Primary navigation

```text
My Tasks
Intent Signals
```

Contextual Task navigation:

```text
Task Overview
Current Version
Feedback History
```

## 7.2 Artist routes

```text
/artist
/artist/tasks
/artist/tasks/:taskId
/artist/tasks/:taskId/versions/:versionId
/artist/tasks/:taskId/history
/artist/signals
```

## 7.3 Page inventory

### A. `/artist` — My Tasks

**Primary purpose:** decide what to work on next.

Shows:

- assigned Tasks;
- priority;
- current Version;
- latest feedback;
- practical next action;
- clarification status;
- relevant Intent Signal;
- ftrack linkage.

The page does not expose Project-wide management information.

---

### B. `/artist/tasks` — Task List

**Primary purpose:** find current and recent assigned Tasks.

Shows:

- Task;
- Shot;
- department;
- status;
- latest Version;
- latest feedback;
- next action;
- signal state;
- last updated.

This may initially share most content with `/artist`; 7A-4 may decide whether the separate list route is necessary.

---

### C. `/artist/tasks/:taskId` — Artist Task Detail

**Primary purpose:** understand what the Task requires and why.

Contains:

- Task goal;
- Shot context;
- intent summary;
- Core Anchor summary;
- Execution Anchor summary;
- non-negotiables;
- allowed variations;
- dependencies;
- supervisor questions;
- current Version;
- next action;
- ftrack linkage.

Does not default to raw revisions, full Decisions, or technical provenance.

---

### D. `/artist/tasks/:taskId/versions/:versionId` — Artist Version Workspace

**Primary purpose:** understand and act on one Version iteration.

Contains:

- Version facts;
- ReviewNote;
- practical feedback;
- why it matters;
- self-checks;
- Artist Agent guidance;
- relevant VFX / CG summaries;
- evidence gaps;
- questions for Human CG Supervisor;
- feedback and guidance history;
- ftrack Version / ReviewNote linkage;
- future submission entry if supported.

This is the Artist’s main working page.

---

### E. `/artist/tasks/:taskId/history` — Feedback History

**Primary purpose:** understand how feedback and Version iterations evolved.

Contains:

- Version timeline;
- ReviewNotes;
- feedback changes;
- resolved / unresolved issues where supported;
- Artist guidance history;
- production facts;
- historical outputs.

It does not infer resolution state from text alone.

---

### F. `/artist/signals` — Intent Signals

**Primary purpose:** show task-related attention guidance.

Role-specific interpretation emphasises:

- what remains confirmed;
- whether clarification is pending;
- whether work can continue within existing boundaries;
- link to the Task or Version context.

No Signal management actions are added.

---

# 8. Shared object-placement matrix

| Object | Primary home | Secondary presentation |
|---|---|---|
| Project | VFX Project Overview | CG / Artist context summary |
| Shot | VFX Shot Overview | CG / Artist breadcrumb and summary |
| Task | CG Task Workspace; Artist Task Detail | VFX Shot summaries |
| Version | Role-specific Version pages | Overview cards and Activity |
| IntentBrief | VFX Intent Workspace | CG / Artist summary |
| IntentDecomposition | VFX Intent Workspace | Evidence / provenance |
| ContextReconstruction | VFX Intent Workspace | Evidence / provenance |
| CoreAnchor | VFX Intent Workspace | CG full read-only; Artist summary |
| ExecutionAnchor | CG Execution Workspace | VFX summary; Artist summary |
| HumanGate | Intent or Execution authority workspace | Activity |
| Decision | Intent (Core Anchor) or Alignment (cross-role) **[Amended]** | Activity and outcome summary |
| VFXSupervisorReview | VFX Version Review | CG / Artist relevant summary |
| CGSupervisorReview | CG Version Review | VFX / Artist relevant summary |
| ArtistAgentGuidance | Artist Version Workspace | VFX / CG read-only |
| CrossRoleAssessment | VFX Alignment Workspace | CG full read-only; Artist summary + expansion |
| ReAnchorProposal | VFX Alignment Workspace | CG full read-only; Artist summary + expansion |
| IntentSignal | Signal pages + contextual widgets | Lists, headers, inboxes |
| ContextSnapshot | Evidence / provenance layer | Never primary content |
| AgentRun | Provenance layer | Never primary content |
| ReviewNote | Role-specific Version pages | Activity |
| ftrack linkage | Object header / linkage panel | Integrations / Activity |
| historical output | Contextual History | Never mixed with current output |

---

# 9. Same-page versus separate-flow rules

This section establishes placement rules. Detailed interactions are defined in 7A-3.

## 9.1 Keep on the same page

Use the same page for information that must be compared to understand current state:

- three role perspectives;
- agreements and tensions;
- Intent Signal and its supporting assessment;
- current Core Anchor and concise semantic objects;
- current Execution Anchor and execution guidance;
- Version facts and latest feedback;
- Task goal, non-negotiables, allowed variations, and self-checks.

## 9.2 Use a separate route-backed workspace

Use a separate page when the user must focus on a distinct object or authority responsibility:

- Core Anchor management;
- Execution Anchor management;
- Version review;
- Cross-role Alignment;
- Integration overview;
- Dependencies and escalations.

Decisions are **not** given a separate workspace of their own
**[Amended]** -- see §5.1 and `10_FTRACK_ENTRY_AND_IA_AMENDMENT.md` §5.1.

## 9.3 Use a deliberate multi-step interaction

High-authority or generative actions should follow:

```text
Context
→ Prerequisite check
→ Input or Generate action
→ Running state
→ Review result
→ Human authority action where permitted
→ Immutable result / history
```

Applies to:

- Core Anchor draft and HumanGate;
- Execution Anchor draft and HumanGate;
- VFX review generation;
- CG review generation;
- Artist guidance generation;
- Cross-role Assessment generation;
- any future Version submission or ftrack write-back.

## 9.4 Use a drawer or expandable layer

Use a secondary layer for:

- evidence references;
- provenance;
- ContextSnapshot identity;
- AgentRun identity;
- source records;
- technical integration details;
- old immutable outputs.

## 9.5 Use a confirmation dialog only for bounded human action

Dialogs may confirm:

- HumanGate confirmation / rejection;
- leaving unsaved input;
- explicit Demo-role exit.

Dialogs should not contain long Agent output or become the main workflow.

---

# 10. Intent Signal placement system

Intent Signal appears in five levels.

## 10.1 Global signal indicator

In the role workspace shell:

- attention icon;
- count by relevant current signals;
- opens a lightweight Signal tray;
- links to the role Signal page.

It does not represent unread state.

## 10.2 Role homepage

- VFX: Human review required
- CG: Execution clarification required
- Artist: Supervisor clarification pending

Shows the most important signals and links to the supporting context.

## 10.3 List badge

Appears on:

- VFX Project / Shot cards;
- CG Task cards;
- Artist Task cards.

Values:

- Human review required
- Attention needed
- Low attention

Role-specific wording may accompany the same stored attention level.

## 10.4 Contextual page banner

Appears near the top of:

- VFX Shot Overview;
- VFX Alignment Workspace;
- CG Task Workspace;
- CG Execution Workspace;
- Artist Task Detail;
- Artist Version Workspace.

Includes:

- attention level;
- concise explanation;
- affected context;
- link to supporting assessment or human action.

## 10.5 Signal detail page

Role-specific Signal page contains:

- signal summary;
- drivers;
- role coverage;
- proposal-present flag;
- caveats;
- Project / Shot / Task / Version context;
- supporting assessment link;
- created time.

It contains no acknowledge / dismiss / resolve controls.

---

# 11. ftrack presentation architecture

## 11.1 Object linkage component

Reusable on:

- Project;
- Shot;
- Task;
- Version;
- ReviewNote.

Possible truthful states:

- Linked to ftrack
- Integration-ready
- No linked ftrack entity
- Link state unavailable
- Sync state unavailable
- Controlled write-back not available
- Read-only connector validated

Displayed fields only when supported:

- entity type;
- safe external identifier;
- source-of-truth;
- last sync;
- sync state;
- external record link;
- write-back state.

## 11.2 VFX Integration page

Shows:

- connector health;
- credential presence without secrets;
- validated mode;
- mapped object coverage;
- latest connector validation;
- recent integration events;
- Step 8 capability roadmap.

## 11.3 Activity representation

ftrack-related Activity entries must be visually marked as production facts or connector events, not Agent interpretations.

Examples:

- Version imported from ftrack
- ReviewNote captured from ftrack
- entity linkage confirmed
- controlled write-back prepared
- controlled write-back completed
- controlled write-back failed

Only supported events may render as actual events.

## 11.4 Step 7 honesty rule

When the backend does not provide real linkage or sync data, the UI must show an explicit integration-ready or unavailable state rather than fabricated success.

---

# 12. Activity, history, evidence, and provenance

## 12.1 Activity

Activity answers:

> What happened, in what order, and what type of event was it?

Placement:

- VFX Shot Activity route;
- CG Task Activity route;
- Artist Feedback History focuses only on task/version-relevant events.

Activity is not a chat feed and not a notification centre.

## 12.2 History

History answers:

> What immutable outputs or revisions existed before the current one?

Placement:

- Core Anchor revision history in Intent Workspace;
- Execution Anchor revision history in Execution Workspace;
- Agent output history in relevant Version pages;
- Cross-role Assessment history in Alignment Workspace;
- Version / feedback history in Artist History.

Current and historical outputs must never be visually merged.

## 12.3 Evidence

Evidence answers:

> Which saved production or semantic records support this item?

Pattern:

- compact evidence labels in primary content;
- expandable Evidence panel;
- source type;
- source label;
- safe short identifier;
- link to relevant object when possible.

## 12.4 Provenance

Provenance answers:

> How and when was this Agent output produced?

Pattern:

- Agent;
- capability;
- provider;
- model;
- prompt version;
- run status;
- ContextSnapshot;
- timestamp.

Full UUIDs should appear only in the technical details layer, not as primary headings.

---

# 13. Global navigation model

## VFX Supervisor

Primary sidebar:

```text
Alignment Inbox
Projects
Intent Signals
Integrations
```

Contextual Shot tabs: **[Amended -- see §5.1]**

```text
Overview
Intent
Versions
Alignment
Activity
```

## CG Supervisor

Primary sidebar:

```text
Execution Inbox
Tasks
Intent Signals
```

Contextual Task tabs: **[Amended -- see §6.1]**

```text
Overview
Execution
Versions
Dependencies
Activity
```

## Artist

Primary sidebar:

```text
My Tasks
Intent Signals
```

Contextual Task tabs:

```text
Task Overview
Current Version
Feedback History
```

## Shared top bar

- product name;
- current human identity;
- current role;
- Demo mode badge;
- Signal indicator;
- Exit role view / account control.

No role dropdown.

---

# 14. Breadcrumb rules

Breadcrumbs reflect production hierarchy, not database implementation.

Examples:

### VFX

```text
Projects / D1 Demo Project / Shot 010 / Alignment
```

### CG

```text
Tasks / Compositing Review / Version D1_STEP3_VFX_REVIEW_001
```

### Artist

```text
My Tasks / Compositing Review / Current Version
```

Rules:

- each segment is navigable where permitted;
- Artist does not receive links into unavailable VFX management pages;
- breadcrumbs preserve role context;
- external ftrack links are separate, never breadcrumb items.

---

# 15. Existing-route migration

Current routes include:

```text
/shots
/shots/:shotId
/shots/:shotId/versions/:versionId
```

## Proposed migration

### Phase 1

- keep existing routes working;
- move raw role / actor controls toward `/dev`;
- build new role workspace routes in parallel.

### Phase 2

Role-aware redirects:

- `/shots` → resolved role homepage or Development route;
- `/shots/:shotId`:
  - VFX → `/vfx/shots/:shotId`
  - CG / Artist → redirect to the relevant Task context when resolvable
  - Development → retain legacy page
- `/shots/:shotId/versions/:versionId`:
  - VFX → VFX Version Review
  - CG → CG Version Review
  - Artist → Artist Version Workspace
  - Development → legacy Version page

### Phase 3

- remove legacy routes from portfolio navigation;
- retain a Development compatibility route until all Step 1–6 workflows and tests are migrated;
- do not delete working legacy components before new equivalents pass.

---

# 16. Backend and data implications

Step 7A-2 identifies possible backend needs but does not approve them automatically.

## 16.1 Likely required

### Role / Demo session resolution

Needed to:

- enter correct workspace;
- protect role-prefixed routes;
- remove visible actor controls.

### Role homepage aggregation

The existing APIs may require many requests to compose Inbox pages.

A small role-aware aggregation endpoint may be justified if:

- the frontend would otherwise duplicate fragile joining logic;
- current APIs cannot honestly determine “needs attention” items.

## 16.2 Needs investigation

- Project list completeness;
- Task assignment / relevance;
- Version-to-Task context outside explicit request flows;
- newest relevant role output aggregation;
- Signal list across multiple contexts;
- Activity aggregation;
- ftrack linkage state availability.

## 16.3 Must not be faked

- task assignment if not persisted;
- Signal resolution;
- dependency resolution;
- sync success;
- write-back success;
- user ownership;
- unread counts.

Where unavailable, use honest empty or unavailable states.

---

# 17. Page-priority and implementation scope

Not every route must receive equal complexity.

## Tier 1 — Critical Demo pages

Must be fully designed and implemented:

1. `/demo`
2. `/vfx`
3. `/vfx/shots/:shotId`
4. `/vfx/shots/:shotId/intent`
5. `/vfx/shots/:shotId/alignment`
6. `/cg`
7. `/cg/tasks/:taskId`
8. `/cg/tasks/:taskId/execution`
9. `/cg/tasks/:taskId/versions/:versionId`
10. `/artist`
11. `/artist/tasks/:taskId`
12. `/artist/tasks/:taskId/versions/:versionId`

## Tier 2 — Important supporting pages

Should be implemented with credible scope:

- VFX Project Overview
- VFX Version Review
- VFX Versions (collection) **[Amended, planned]**
- VFX Signals
- VFX Integrations
- CG Dependencies
- CG Signals
- Artist History
- Artist Signals
- Activity routes

## Tier 3 — Can remain lighter

- multi-project administration;
- advanced filtering;
- saved views;
- global search;
- bulk actions;
- organisation settings;
- notification management.

This keeps Step 7 portfolio-grade rather than enterprise-grade.

---

# 18. Proposed decisions to lock

1. Use role-prefixed workspaces: `/vfx`, `/cg`, `/artist`.
2. Use a shared application shell with role-specific navigation.
3. Use VFX Shot as the full creative-alignment context.
4. Use CG Task as the full execution context.
5. Use Artist Task / Version as the full iteration context.
6. Give Core Anchor, Execution Anchor, Alignment, and Version Review distinct route-backed workspaces.
7. Keep Evidence and Provenance in expandable secondary layers.
8. Keep current and historical outputs visually separated.
9. Give Intent Signal a global indicator, homepage presentation, list badge, contextual banner, and role Signal page.
10. Give VFX a full Integration page; CG and Artist receive inline linkage only.
11. Use contextual Activity rather than an enterprise-wide Activity centre.
12. Keep legacy routes temporarily and migrate them gradually.
13. Do not delete existing pages until replacement paths and tests pass.
14. Permit a small aggregation backend only when needed for honest Inbox / Signal presentation.
15. Do not fake assignment, unread, resolution, sync, or write-back state.
16. Prioritise twelve Tier 1 Demo pages; supporting routes may remain lighter.

---

# 19. Open decisions for owner confirmation

## Decision A — Role-prefixed routes

**Recommendation:** confirm `/vfx`, `/cg`, and `/artist`.

Reason:

- makes Demo paths clear;
- makes role-specific navigation explicit;
- supports direct linking;
- prevents the interface from feeling like one shared page with hidden controls.

## Decision B — VFX Shot workspace navigation

**Recommendation (amended -- see `10_FTRACK_ENTRY_AND_IA_AMENDMENT.md` §5.1):** confirm separate `Overview`, `Intent`, `Versions`, `Alignment`, and `Activity` sections. `Decisions` is not an isolated section; Decision visibility is distributed into Intent, Alignment, and Activity.

## Decision C — CG Task workspace navigation

**Recommendation (amended -- see `10_FTRACK_ENTRY_AND_IA_AMENDMENT.md` §5.2):** confirm separate `Overview`, `Execution`, `Versions`, `Dependencies`, and `Activity` sections.

## Decision D — Artist Task workspace navigation

**Recommendation:** confirm `Task Overview`, `Current Version`, and `Feedback History`.

## Decision E — Intent Signal page

**Recommendation:** each role receives a role-filtered Signal page in addition to Signal widgets.

## Decision F — Activity

**Recommendation:** contextual Shot / Task Activity only; no global enterprise Activity centre.

## Decision G — Integration page

**Recommendation:** full VFX-only Integration page; inline linkage cards for CG and Artist.

## Decision H — Legacy route migration

**Recommendation:** preserve old routes during implementation, move raw controls to `/dev`, then redirect role-aware paths only after new pages pass.

## Decision I — Page priority

**Recommendation:** lock the twelve Tier 1 Demo pages as the required high-quality core; Tier 2 pages may be simpler.

---

# 20. 7A-2 acceptance criteria

7A-2 is complete when:

1. global app structure is approved;
2. role workspace routes are approved;
3. each role’s navigation is approved;
4. every major domain object has a primary product location;
5. Intent Signal placement is approved;
6. ftrack placement is approved;
7. Activity, History, Evidence, and Provenance are separated conceptually;
8. same-page vs separate-workspace rules are approved;
9. legacy route migration is approved;
10. Tier 1 Demo pages are confirmed;
11. backend gaps are listed without being silently implemented;
12. owner resolves Decisions A–I.

---

# 21. Next step after approval

Step 7A-3 will specify the exact interaction sequence for:

- Core Anchor;
- Execution Anchor;
- VFX review;
- CG review;
- Artist guidance;
- Version and ReviewNote;
- Cross-role Assessment;
- Intent Signal;
- Re-anchor Proposal;
- HumanGate;
- Decision;
- escalation;
- ftrack sync and controlled write-back;
- history;
- evidence and provenance.

It will decide, for each action:

```text
entry
→ context
→ user input
→ Agent or system action
→ result review
→ human authority point
→ success / failure
→ history
→ next navigation
```
