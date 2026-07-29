# ICAS Step 7 — Experience Architecture Source of Truth

**Status:** Locked  
**Scope:** Step 7 role-aware product experience and dashboard  
**Implementation branch:** `feat/step7-role-aware-dashboard`

> **Amended by `10_FTRACK_ENTRY_AND_IA_AMENDMENT.md`:** §5 routes (adds
> planned `/vfx/shots/:shotId/versions` and `/cg/tasks/:taskId/versions`
> collections; removes `/vfx/shots/:shotId/decisions` as an isolated
> route), §9 ftrack presentation (Integrations is a secondary
> System/technical-status destination, not a primary VFX workflow),
> and §14 Demo entry (one dominant guided-demo action; direct role
> entries move to a secondary, collapsed section). The amendment also
> records the three product entry modes (production/ftrack, portfolio
> Demo, development) and the real-software implementation standard.
> Sections below are marked `[Amended]` where it applies.

---

## 1. Product goal

Step 7 turns the validated ICAS engineering system into a coherent, portfolio-grade product experience.

The final interface must let a reviewer understand:

- what ICAS is;
- who uses it;
- how creative intent is captured, translated, reviewed, and re-aligned;
- how VFX Supervisor, CG Supervisor, and Artist responsibilities differ;
- how Agent interpretation differs from human-confirmed authority;
- when Intent Signal surfaces attention;
- where ftrack production facts and linkage appear;
- why humans retain final control.

Step 7 is not an enterprise product expansion. It remains a real, runnable, research-grade prototype.

**[Amended]** "Real, runnable" is a standard, not a slogan: the final
implementation must use the same real domain model, APIs, routes, and
workflow logic for both normal production use and the portfolio Demo --
the Demo may use seeded data as a stable fallback, but never a separate
fake Demo-only implementation. Full standard and explicit enterprise
exclusions: `10_FTRACK_ENTRY_AND_IA_AMENDMENT.md` §9.

---

## 2. Locked human roles

Formal production workspaces:

1. Human VFX Supervisor
2. Human CG Supervisor
3. Human Artist

Not added in Step 7:

- Production Coordinator workspace
- Integration Administrator workspace
- Producer or Director workspace
- enterprise admin roles

Agents are not login roles:

- Core Agent
- VFX Supervisor Agent
- CG Supervisor Agent
- Artist Agent

---

## 3. Identity modes

### Normal mode

- role is resolved at entry;
- role remains fixed for the session;
- no in-workspace role switcher.

### Demo mode

- entry route: `/demo`;
- user chooses one role;
- selected role persists across refresh;
- switching requires `Exit role view`;
- the role selector is not visible inside workspaces.

### Development mode

- retains raw Role and Actor ID controls;
- moves legacy smoke-test tools away from the portfolio-facing UI;
- may use `/dev` routes.

No enterprise authentication, SSO, invitations, or organisation management is required.

---

## 4. Role homepages

### VFX Supervisor

**Homepage:** Alignment Inbox

Primary goals:

- see high-attention Shots;
- review Intent Signals;
- inspect cross-role tensions;
- manage Core Anchor authority;
- review Re-anchor Proposals;
- coordinate human decisions.

### CG Supervisor

**Homepage:** Execution Inbox

Primary goals:

- see assigned Tasks;
- review Execution Anchor state;
- review Versions;
- understand dependencies;
- escalate unresolved ambiguity.

### Artist

**Homepage:** My Tasks

Primary goals:

- know what to work on;
- understand what to change and why;
- see non-negotiables and allowed variations;
- use self-checks;
- raise supervisor questions.

---

## 5. Locked routes

### Entry and development

```text
/
/demo
/dev
```

### VFX **[Amended]**

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

`/vfx/shots/:shotId/versions` (the Version collection) is planned, not
implemented. `/vfx/shots/:shotId/decisions` is removed as an isolated
route -- Decision visibility is distributed into Intent, Alignment, and
Activity instead.

### CG **[Amended]**

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

`/cg/tasks/:taskId/versions` (the Version collection) is planned, not
implemented.

### Artist

```text
/artist
/artist/tasks
/artist/tasks/:taskId
/artist/tasks/:taskId/versions/:versionId
/artist/tasks/:taskId/history
/artist/signals
```

Legacy `/shots` routes remain temporarily available for Development mode and migration safety.

---

## 6. Tier 1 Demo pages

The polished core contains 12 pages:

1. Demo role entry
2. VFX Alignment Inbox
3. VFX Shot Overview
4. VFX Intent Workspace
5. VFX Cross-role Alignment
6. CG Execution Inbox
7. CG Task Workspace
8. CG Execution Anchor Workspace
9. CG Version Review
10. Artist My Tasks
11. Artist Task Detail
12. Artist Version Workspace

Supporting routes may remain lighter.

---

## 7. Main workflow placement

### Core Anchor

- owned by Human VFX Supervisor;
- primary home: VFX Intent Workspace;
- draft editing stays in the workspace;
- HumanGate comparison is shown on-page;
- final Confirm / Reject uses a small explicit dialog.

### Execution Anchor

- owned by Human CG Supervisor;
- primary home: CG Execution Workspace;
- follows the same draft, comparison, HumanGate, and Decision pattern.

### Role Agent outputs

- VFX Agent runs on VFX Version Review;
- CG Agent runs on CG Version Review;
- Artist Agent runs on Artist Version Workspace;
- no generic Agent page.

### Cross-role Assessment

- generated and reviewed on VFX Alignment Workspace;
- exact Task and Version must be visible before generation;
- latest result expanded;
- previous results collapsed.

### Re-anchor Proposal

- reviewed on Alignment;
- no `Apply proposal`;
- only `Open Intent Workspace`.

### Intent Signal

- derived automatically from a successful Cross-role Assessment;
- never manually created or edited;
- not a Decision, gate, pass/fail, or notification lifecycle.

---

## 8. Intent Signal presentation

Intent Signal appears at six levels:

1. global indicator;
2. compact tray;
3. role-homepage card;
4. list badge;
5. contextual banner;
6. detail view.

Role wording:

- VFX: `Human review required`
- CG: `Execution clarification required`
- Artist: `Supervisor clarification pending`

Step 7 does not add read, acknowledge, dismiss, assign, resolve, or notification-delivery state.

**[Amended]** Step 7 shows exactly `Latest Intent Signal`, derived from
the latest successful Cross-role Assessment. It must never read as
continuous monitoring, a live unread notification, an always-running
watcher, or an automatically-updating real-time feed -- see
`10_FTRACK_ENTRY_AND_IA_AMENDMENT.md` §8.

---

## 9. ftrack presentation

### VFX

- full Integration overview (a **secondary, System/technical-status
  destination** -- not the VFX Supervisor's primary daily workflow;
  see `10_FTRACK_ENTRY_AND_IA_AMENDMENT.md` §7) **[Amended]**;
- Project / Shot / Version / ReviewNote linkage;
- connector and validation state.

### CG

- Task / Version / ReviewNote operational linkage.

### Artist

- object-level Task / Version linkage only.

Truthful states include:

- Linked to ftrack
- Integration-ready
- No linked entity
- Link status unavailable
- Read-only connector validated
- Sync status unavailable
- Controlled write-back not available

Step 7 must not fabricate sync or write-back success. Real Version, ReviewNote, linkage, sync, and controlled write-back belong to Step 8.

---

## 10. Authority visual language

Required labels:

- Production fact
- Human intent
- Human-confirmed
- AI interpretation
- AI proposal
- Intent Signal
- Human review required
- Open question
- Historical
- Integration-ready
- Read-only for your role

Agent cards show:

- Agent;
- capability;
- advisory status;
- timestamp;
- Evidence;
- Provenance.

Human-confirmed cards show:

- confirming role;
- Decision status;
- timestamp.

---

## 11. Visual direction

The product should feel:

- calm;
- precise;
- professional;
- production-aware;
- evidence-based;
- contemporary.

It should not feel:

- hand-drawn;
- playful;
- like a generic admin template;
- like a database inspector;
- like a chatbot;
- like a copied ftrack UI.

Layout:

- fixed left role navigation;
- compact top bar;
- contextual header;
- route-backed tabs;
- neutral base;
- restrained violet accent;
- amber for attention;
- blue/teal for production facts and ftrack;
- grey for history;
- green only for confirmed technical success.

---

## 12. Shared component system

### Shell

- AppShell
- TopBar
- RoleSidebar
- RoleIdentity
- DemoModeBadge
- Breadcrumbs
- ContextTabs

### Shared states

- PageHeader
- ContextHeader
- SummaryCard
- StatusBadge
- AuthorityLabel
- EmptyState
- ErrorState
- PermissionState
- LoadingSkeleton

### Domain

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

## 13. Demo scenario

**Project:** D1 Demo Project  
**Shot:** Shot 010 — Final confrontation  
**Task:** Compositing Review  
**Version:** D1_STEP3_VFX_REVIEW_001

Scenario:

A restrained dusk confrontation should remain internal and controlled. Camera timing and compositing contrast have begun to drift across role interpretations.

Demo order:

```text
VFX Supervisor
→ CG Supervisor
→ Artist
```

Core thesis:

```text
capture intent
→ translate by role
→ assess across roles
→ surface attention
→ return control to humans
```

The Demo must include seeded fallback data and must not depend entirely on live model availability.

**[Amended]** `/demo` leads with one dominant `Start guided demonstration`
action (enters as VFX Supervisor, matching the Demo order above); the
three direct role entries move to a secondary, collapsed `Explore by
role` section. See `10_FTRACK_ENTRY_AND_IA_AMENDMENT.md` §4.

---

## 14. Implementation sequence

Step 7 is implemented in eight controlled batches:

1. Shared design foundation
2. App Shell and Demo identity
3. Shared Signal / ftrack / authority components
4. VFX core pages
5. CG core pages
6. Artist core pages
7. Supporting pages and legacy migration
8. Demo fixtures and final validation

Each batch must define:

- allowed files;
- route scope;
- APIs reused;
- authority boundaries;
- tests;
- no unapproved backend work;
- no Step 8 implementation;
- no automatic Agent changes.

---

## 15. Explicitly out of scope

- enterprise login or SSO;
- organisation and team administration;
- Production Coordinator workspace;
- notification lifecycle;
- chat;
- assignment workflow and SLA;
- real-time collaboration;
- media review player;
- global search;
- bulk actions;
- automatic Re-anchor Proposal application;
- automatic Agent chains;
- automatic ftrack write-back;
- creative scoring;
- Version pass/fail;
- copied ftrack administration UI.
