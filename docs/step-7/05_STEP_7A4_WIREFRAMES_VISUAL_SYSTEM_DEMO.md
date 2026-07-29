# ICAS Step 7A-4 — Wireframes, Visual System, Components, and Demo Specification

**Version:** v1.0  
**Status:** Proposed for owner review  
**Depends on:** Step 7A-1, 7A-2, 7A-3  
**Scope:** Turn the approved role model, information architecture, and workflows into implementation-ready page structures, reusable components, and a three-role demo.

---

## 1. Goal

Step 7A-4 defines:

- the shared App Shell;
- the visual language for production facts, Agent output, human-confirmed state, Signal, and history;
- the structure of the 12 Tier 1 Demo pages;
- Intent Signal and ftrack component systems;
- current/history/evidence patterns;
- the VFX → CG → Artist demo path;
- the Step 7B–7D implementation backlog.

It does not add enterprise login, notifications, chat, real-time collaboration, media review, or Step 8 ftrack sync/write-back.

---

## 2. Response to the current interface

The current UI is an engineering smoke-test surface:

- browser-default styling;
- raw Role and Actor ID controls;
- one long Shot page;
- no product navigation;
- no role-specific entry;
- no clear current state or next action;
- technical details dominate;
- Intent Signal and ftrack are not visible as product systems.

Migration:

```text
Keep current pages in Development mode
→ build new shared App Shell
→ build /demo, /vfx, /cg, /artist
→ reuse existing APIs and validated logic
→ migrate one workspace at a time
→ redirect legacy routes only after acceptance
```

---

## 3. Visual direction

The product should feel calm, precise, evidence-based, contemporary, and suitable for a professional VFX workflow.

It should not feel hand-drawn, playful, like a generic admin template, like a database inspector, or like a chatbot.

### Layout

```text
┌──────────────────────────────────────────────────────────────┐
│ Top bar: ICAS / Signal / identity / Demo exit               │
├───────────────┬──────────────────────────────────────────────┤
│ Role sidebar  │ Breadcrumbs + object context + tabs          │
│               ├──────────────────────────────────────────────┤
│ Primary nav   │ Main workspace                               │
└───────────────┴──────────────────────────────────────────────┘
```

Recommended:

- Sidebar: 232–256 px
- Page padding: 32 px
- Main content max width: 1440 px
- Long-text column: 720–840 px
- Moderate card radius
- Neutral base with restrained violet accent

### Semantic colour use

- Violet: Agent interpretation and selected navigation
- Dark neutral: human-confirmed state
- Blue/teal: production fact and ftrack linkage
- Amber: attention and unresolved dependency
- Red: blocking failure or permission issue
- Grey: history and unavailable state
- Green: confirmed technical success only, never creative quality

---

## 4. Authority visual language

| Type | Label |
|---|---|
| Production data | `Production fact` |
| Human input | `Human intent` |
| Confirmed authority | `Human-confirmed` |
| Agent analysis | `AI interpretation` |
| Agent suggestion | `AI proposal` |
| Derived attention | `Intent Signal` |
| Human action | `Human review required` |
| Unresolved item | `Open question` |
| Old result | `Historical` |
| Future integration | `Integration-ready` |
| Restricted access | `Read-only for your role` |

Agent cards must show Agent, capability, advisory status, timestamp, Evidence, and Provenance.

Human-confirmed cards must show confirming role, Decision status, and timestamp.

---

## 5. Shared App Shell

### Top bar

- ICAS identity
- Intent Signal indicator
- current human name
- fixed production role
- Demo mode badge
- Exit role view

No Role dropdown or Actor ID field.

### Sidebar

VFX:

```text
Alignment Inbox
Projects
Intent Signals
Integrations
```

CG:

```text
Execution Inbox
Tasks
Intent Signals
```

Artist:

```text
My Tasks
Intent Signals
```

### Context header

Shows human-readable:

- Project
- Shot
- Task
- Version
- current state
- ftrack linkage
- last update

Raw IDs remain secondary.

---

# 6. Tier 1 pages

## 6.1 Demo entry — `/demo` **[Amended -- see `10_FTRACK_ENTRY_AND_IA_AMENDMENT.md` §4]**

Purpose: identify this clearly as a guided portfolio demonstration of
one shared scenario, lead with one dominant guided-demo action, and
keep the three direct role entries available but visually secondary.

```text
ICAS -- Guided portfolio demonstration
D1 Demo Project · Shot 010
Restrained confrontation; timing and contrast have begun to drift.

┌───────────────────────────────┐
│  Start guided demonstration     │  <- dominant primary action,
└───────────────────────────────┘     enters as VFX Supervisor -> /vfx

Production users will ultimately launch ICAS from ftrack; their
verified identity and current context will determine the workspace
they enter.

▸ Explore by role                  <- collapsed, visually quiet
   [VFX Supervisor] [CG Supervisor] [Artist]
    Enter role       Enter role      Enter role
```

Role persists across refresh. Switching requires Exit role view. Both
the primary action and each direct role entry use the identical
role-session mechanism.

---

## 6.2 VFX Alignment Inbox — `/vfx`

Purpose: show what needs VFX attention next.

First screen:

- highest Intent Signal
- affected Shot
- reason
- affected roles
- next human action
- recent Decisions
- recent production changes

```text
Human review required
Shot 010 · Final confrontation
Camera timing and contrast boundaries remain unresolved.
[Open alignment]
```

---

## 6.3 VFX Shot Overview — `/vfx/shots/:shotId`

Purpose: summarise current Shot state.

```text
Shot 010 · Current Version · ftrack state

[Intent Signal banner]

[Core Anchor] [Execution Anchor] [Current Version]

Role alignment snapshot
Open dependencies
Recent Decisions
Recent Activity
```

This page summarises; it does not reproduce every object.

---

## 6.4 VFX Intent Workspace — `/vfx/shots/:shotId/intent`

Purpose: manage the creative-intent chain and Core Anchor authority.

```text
Intent brief
AI interpretation · Core Agent
Human-confirmed Core Anchor
Create new revision
Previous revisions
```

Draft state compares current confirmed revision and draft side by side.

HumanGate confirmation appears only after the full comparison.

---

## 6.5 VFX Alignment Workspace — `/vfx/shots/:shotId/alignment`

Purpose: compare role interpretations and coordinate human review.

```text
Selected Task + Version
Intent Signal
Prerequisite checklist
Generate new assessment

[VFX perspective] [CG perspective] [Artist perspective]

Agreements
Tensions
Local optimum risk
Dependencies
Coordination priorities
Evidence gaps

AI proposal · Re-anchor Proposal
[Open Intent Workspace]

Previous assessments
```

No Apply Proposal button.

---

## 6.6 CG Execution Inbox — `/cg`

Purpose: show which Task needs execution clarification.

```text
Assigned Tasks
Missing anchors
Versions to review
Dependencies

Compositing Review · Shot 010
Execution clarification required
[Open task]
```

---

## 6.7 CG Task Workspace — `/cg/tasks/:taskId`

Purpose: summarise Task context and next execution action.

```text
Task + Shot + Version + ftrack state
Intent Signal banner

Task goal
Core Anchor summary
Execution Anchor summary
Latest CG review
Artist state
Dependencies
Escalation recommendation
Next action
```

---

## 6.8 CG Execution Anchor — `/cg/tasks/:taskId/execution`

Purpose: create and confirm department execution boundaries.

```text
Confirmed Core Anchor context
Current Execution Anchor
Create new revision
HumanGate
Previous revisions
```

Uses the same revision-comparison pattern as Core Anchor.

---

## 6.9 CG Version Review — `/cg/tasks/:taskId/versions/:versionId`

Purpose: review a Version against confirmed execution guidance.

```text
Version facts
ReviewNote
ftrack linkage
Core + Execution Anchor context
Generate CG review
Latest CG Agent interpretation
Dependencies
Escalation conditions
Evidence / Provenance
Previous reviews
```

---

## 6.10 Artist My Tasks — `/artist`

Purpose: tell the Artist what to work on now.

```text
Current priority
Compositing Review · Shot 010
Supervisor clarification pending
Next action
[Open task]

Other tasks
Recent feedback
```

No project-management information.

---

## 6.11 Artist Task Detail — `/artist/tasks/:taskId`

Purpose: explain what the Task requires and why.

```text
Task objective
Why this matters

[Non-negotiables] [Allowed variations]

Execution Anchor summary
Current Version
Dependencies
Questions for CG Supervisor
[Open current Version]
```

---

## 6.12 Artist Version Workspace — `/artist/tasks/:taskId/versions/:versionId`

Purpose: provide practical guidance for one Version iteration.

```text
Version facts
ReviewNote
ftrack linkage
Intent Signal banner
Confirmed boundaries

Generate Artist guidance

Practical actions
Why each action matters
Self-checks
Questions for Human CG Supervisor
Evidence gaps

Previous guidance
Feedback history
```

---

# 7. Intent Signal component system

Intent Signal appears at six levels:

1. **Global indicator** — top bar count, without unread semantics.
2. **Signal tray** — up to three relevant signals.
3. **Inbox card** — role-specific explanation and next action.
4. **List badge** — Human review required / Attention needed / Low attention.
5. **Contextual banner** — what changed, why it matters, where to go.
6. **Detail view** — drivers, role coverage, proposal state, supporting Assessment.

No score, acknowledgement, dismissal, assignment, or resolution lifecycle.

---

# 8. ftrack component system

## Object linkage badge

States:

- Linked to ftrack
- Integration-ready
- No linked entity
- Link status unavailable

## Linkage panel

Show only supported fields:

- entity type
- safe external identifier
- source-of-truth
- last sync
- sync state
- external link
- write-back readiness

## VFX Integration page cards

- connector configured
- validated mode
- read-only / controlled write-back readiness
- latest validation
- mapping coverage
- recent integration events

Never show successful sync or write-back without backend evidence.

---

# 9. History, Evidence, and Provenance

## History

```text
Latest result
[expanded]

Previous outputs (N)
[collapsed]
```

Historical items show timestamp, source, warning, and provenance.

## Evidence drawer

- supporting records
- source types
- related objects
- evidence gaps

## Provenance drawer

- Agent
- capability
- provider
- model
- prompt version
- AgentRun
- ContextSnapshot
- timestamp
- safe diagnostics

Technical IDs remain secondary.

---

# 10. Shared states

## Empty

Explain:

- what is missing
- why it matters
- who can create it
- next valid action

## Loading

- page skeleton
- explicit Agent running state
- existing valid content stays visible
- duplicate action disabled

## Failure

Categories:

- prerequisite missing
- permission denied
- Agent failure
- invalid structured output
- network failure
- integration unavailable

## Permission

Example:

```text
Read-only for Artist
The Human VFX Supervisor controls the Core Anchor.
```

---

# 11. Demo scenario

**Project:** D1 Demo Project  
**Shot:** Shot 010 — Final confrontation  
**Task:** Compositing Review  
**Version:** D1_STEP3_VFX_REVIEW_001

Creative situation:

A restrained dusk confrontation should remain internal and controlled. The final beat has become more action-led because camera timing and compositing contrast are being interpreted differently across roles.

Core thesis:

```text
capture intent
→ translate by role
→ assess across roles
→ surface attention
→ return control to humans
```

---

# 12. Three-role Demo path

## VFX Supervisor — 3–4 minutes

```text
/demo
→ Alignment Inbox
→ high Intent Signal
→ Shot Overview
→ Alignment Workspace
→ compare three perspectives
→ inspect tension and local optimum risk
→ inspect Re-anchor Proposal
→ open Intent Workspace
→ show human-confirmed Core Anchor
```

Focus: shared intent, cross-role divergence, advisory Proposal, human authority.

## CG Supervisor — 2–3 minutes

```text
Exit role
→ Execution Inbox
→ Task Workspace
→ Execution Anchor
→ Version Review
→ dependencies
→ escalation recommendation
```

Focus: translating intent into execution boundaries.

## Artist — 2 minutes

```text
Exit role
→ My Tasks
→ Task Detail
→ Current Version
→ practical actions
→ why it matters
→ self-checks
→ supervisor questions
```

Focus: actionable context without exposing the entire technical system.

---

# 13. Demo fallback

The Demo must work without live Agent generation.

Required seeded data:

- confirmed Core Anchor
- confirmed Execution Anchor
- VFX review
- CG review
- Artist guidance
- CrossRoleAssessment
- ReAnchorProposal
- IntentSignal
- history and provenance

Live generation remains optional during the presentation.

---

# 14. Component inventory

## Shell

- AppShell
- RoleSidebar
- TopBar
- RoleIdentity
- DemoModeBadge
- Breadcrumbs
- ContextTabs

## Shared

- PageHeader
- ContextHeader
- SummaryCard
- StatusBadge
- AuthorityLabel
- EmptyState
- ErrorState
- PermissionState
- LoadingSkeleton

## Domain

- ProjectCard
- ShotCard
- TaskCard
- VersionCard
- AnchorSummary
- AnchorRevisionComparison
- HumanGatePanel
- DecisionCard
- AgentOutputCard
- RolePerspectiveCard
- ReAnchorProposalCard
- IntentSignalWidget
- FtrackLinkageBadge
- ActivityTimeline
- HistoricalOutputGroup
- EvidenceDrawer
- ProvenanceDrawer
- GenerationPanel

---

# 15. Step 7B–7D backlog

## Step 7B — Shared foundation

1. design tokens and layout primitives
2. App Shell and role identity
3. `/demo` and session role locking
4. authority, status, loading, error, permission components
5. Intent Signal, ftrack, history, Evidence, and Provenance components

## Step 7C — Role workspaces

### VFX first

- Alignment Inbox
- Shot Overview
- Intent Workspace
- Alignment Workspace

### CG second

- Execution Inbox
- Task Workspace
- Execution Anchor
- CG Version Review

### Artist third

- My Tasks
- Task Detail
- Artist Version Workspace

### Supporting routes

- Signals
- Versions (collection) **[Amended, planned]**
- Activity (carries Decision visibility -- see amendment)
- Dependencies
- Integrations (secondary System destination -- see amendment)
- Feedback History
- legacy-route migration

## Step 7D — Validation

- seeded Demo
- role permissions
- route refresh
- current vs history
- evidence and provenance
- ftrack honesty states
- loading / empty / failure
- tests
- TypeScript
- ESLint
- Prettier
- production build
- browser acceptance
- Demo rehearsal

---

# 16. Claude Code implementation batches

Use eight controlled batches:

1. Shared design foundation
2. App Shell and Demo identity
3. Shared Signal / ftrack / authority components
4. VFX core pages
5. CG core pages
6. Artist core pages
7. Supporting pages and legacy migration
8. Demo fixtures and final validation

Each batch must state:

- files allowed to change
- routes
- APIs reused
- authority boundaries
- tests
- no unapproved backend work
- no Step 8 implementation
- no automatic Agent changes

---

# 17. Out of scope

Step 7 does not add:

- enterprise login or SSO
- organisation management
- Production Coordinator workspace
- notifications
- chat
- assignments and SLA
- real-time collaboration
- media review player
- global search
- bulk actions
- automatic Proposal application
- automatic Agent chains
- automatic write-back
- creative scoring
- Version pass/fail
- copied ftrack UI

---

# 18. Decisions for owner confirmation

A. Use the calm, professional, layered visual direction with restrained violet accent.  
B. Use fixed left navigation, compact top bar, contextual header, and route-backed tabs.  
C. Treat the 12 Tier 1 pages as the polished core.  
D. Use the six-level Intent Signal component system.  
E. Use object-level ftrack linkage plus one VFX Integration overview.  
F. Use drawers for Evidence and Provenance.  
G. Use the D1 restrained-confrontation scenario and VFX → CG → Artist demo order.  
H. Support live generation but always keep seeded fallback data.  
I. Implement in eight controlled Claude Code batches, with VFX pages first.

---

# 19. Acceptance criteria

7A-4 is complete when:

1. visual direction is approved;
2. App Shell is approved;
3. all 12 Tier 1 page structures are approved;
4. Signal and ftrack component systems are approved;
5. authority, history, Evidence, and Provenance patterns are approved;
6. shared states are approved;
7. Demo narrative and fallback are approved;
8. implementation backlog and Claude Code batches are approved;
9. Decisions A–I are resolved;
10. no enterprise feature enters the Step 7 core scope.

---

# 20. Next step after approval

```text
Step 7 planning complete
→ update master documentation
→ create implementation backlog
→ begin Step 7B-1: Shared Design Foundation
```

The first implementation task builds only the shared visual and layout foundation. It does not rebuild every role page at once.
