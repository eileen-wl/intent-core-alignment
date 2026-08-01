# ICAS Step 7A-1 — Roles, Identity, Permissions, and Demo Mode Specification

**Version:** v1.0  
**Status:** Proposed for owner review  
**Parent plan:** Step 7 Experience Architecture Master Plan  
**Scope:** Product-facing role model for the portfolio-grade ICAS prototype  
**Not in scope:** Enterprise authentication, organisation management, SSO, invitation systems, real-time collaboration, notification lifecycle

---

## 1. Objective

Step 7A-1 defines:

- who uses ICAS;
- how a user enters the product;
- how their role is determined;
- what each role is trying to accomplish;
- what each role can see;
- what each role can do;
- how normal product mode differs from Demo mode and Development mode;
- how human identities remain distinct from Agents.

This specification does not yet define the full sitemap or detailed page layout. Those belong to Step 7A-2 and Step 7A-4.

---

## 2. Scope boundary

ICAS Step 7 supports three formal production roles:

1. Human VFX Supervisor
2. Human CG Supervisor
3. Human Artist

It also supports two non-production access modes:

- Demo participant
- Development tester

The following are not added as formal production roles in Step 7:

- Production Coordinator
- Producer
- Director
- Integration administrator
- System administrator

Their data or responsibilities may appear as production facts, Activity records, or future extensions, but they do not receive their own workspace in Step 7.

This keeps the prototype aligned with the existing research scope and current Agent architecture.

---

## 3. Human roles

### 3.1 Human VFX Supervisor

#### Primary responsibility

Maintain the shared creative intent across departments and retain final human authority over the Core Anchor.

#### Main goals

- understand which Shots need attention;
- establish and confirm the Core Anchor;
- inspect how CG and Artist interpretations relate to the shared intent;
- identify cross-role tension and local-optimisation risk;
- review Intent Signals;
- review advisory Re-anchor Proposals;
- make or record VFX-level human decisions;
- coordinate unresolved issues across roles.

#### Main workspace entry

**Alignment Inbox**

#### Primary working objects

- Project
- Shot
- IntentBrief
- IntentDecomposition
- ContextReconstruction
- CoreAnchor / CoreAnchorRevision
- CrossRoleAssessment
- ReAnchorProposal
- IntentSignal
- HumanGate
- Decision
- VFXSupervisorReview
- selected Execution Anchor summaries
- selected Task and Version context
- ftrack Project / Shot / Version / ReviewNote linkage

#### Must not

- become the CG Supervisor or Artist through an in-page switch;
- directly establish the Execution Anchor on behalf of the CG Supervisor;
- treat Agent proposals as already approved;
- automatically apply a Re-anchor Proposal.

---

### 3.2 Human CG Supervisor

#### Primary responsibility

Translate confirmed creative intent into department-level execution boundaries and manage execution dependencies.

#### Main goals

- understand the confirmed Core Anchor;
- establish and confirm the Execution Anchor;
- inspect assigned Tasks and Versions;
- review execution risks;
- coordinate camera, animation, lighting, compositing, and related dependencies;
- interpret VFX feedback for execution;
- support Artists with clear boundaries;
- escalate unresolved creative ambiguity to the VFX Supervisor.

#### Main workspace entry

**Execution Inbox**

#### Primary working objects

- assigned Project / Shot context
- Task
- Core Anchor summary
- ExecutionAnchor / ExecutionAnchorRevision
- CGSupervisorReview
- selected VFXSupervisorReview
- ArtistAgentGuidance
- Version
- ReviewNote
- dependency and escalation information
- HumanGate
- Decision
- relevant Intent Signal interpretation
- ftrack Task / Version / ReviewNote linkage

#### Must not

- modify the Core Anchor;
- generate the VFX Supervisor review;
- generate the Artist guidance;
- generate Cross-role Assessment;
- treat a Re-anchor Proposal as a confirmed decision;
- freely enter another role workspace.

---

### 3.3 Human Artist

#### Primary responsibility

Execute the assigned Task and Version iteration while preserving confirmed creative and execution intent.

#### Main goals

- understand what to change;
- understand why the change matters;
- identify non-negotiables;
- identify allowed variations;
- follow practical actions;
- use self-checks;
- recognise unresolved dependencies;
- ask the Human CG Supervisor for clarification;
- inspect Version and feedback history;
- prepare or submit the next Version when supported by the product flow.

#### Main workspace entry

**My Tasks**

#### Primary working objects

- assigned Task
- current Version
- ReviewNote
- Core Anchor summary
- Execution Anchor summary
- ArtistAgentGuidance
- relevant VFX / CG feedback summaries
- self-checks
- supervisor questions
- task-related Intent Signal interpretation
- ftrack Task / Version / ReviewNote linkage

#### Must not

- create or modify either Anchor;
- resolve HumanGates;
- create authoritative Decisions;
- generate VFX or CG reviews;
- generate Cross-role Assessment;
- freely switch into VFX or CG workspaces.

---

## 4. Agents are not user roles

ICAS contains:

- Core Agent
- VFX Supervisor Agent
- CG Supervisor Agent
- Artist Agent

Agents:

- do not sign in;
- do not receive a human workspace;
- do not appear in the role-entry screen;
- cannot assume human authority;
- cannot resolve HumanGates;
- cannot create authoritative Decisions;
- cannot silently apply proposals.

Every Agent output must visibly include:

- Agent identity;
- capability;
- advisory status;
- provenance;
- evidence access;
- the relevant human authority boundary.

Human and Agent names must never use the same visual treatment.

---

## 5. Access modes

### 5.1 Normal product mode

#### Intended behaviour

```text
Sign in
→ Resolve user identity and production role
→ Enter the assigned role workspace
→ Role remains fixed for the session
```

The workspace header displays:

- user name;
- production role;
- current Project or working context;
- account / exit control.

There is no role selector inside the main workspace.

#### Prototype implementation position

Step 7 does not require enterprise authentication.

A portfolio-grade implementation may use:

- seeded prototype users;
- session-scoped identity;
- a simple role-resolving entry;
- existing human actor IDs;
- route and API authority checks.

The product behaviour must be realistic even if the authentication mechanism is intentionally lightweight.

---

### 5.2 Demo mode

#### Purpose

Allow a reviewer to experience the same scenario from three different human roles without exposing a development role selector.

#### Entry

A dedicated Demo entry presents three choices:

- Enter as VFX Supervisor
- Enter as CG Supervisor
- Enter as Artist

Each choice includes:

- role name;
- one-sentence responsibility;
- the main question the role is trying to answer;
- the workspace they will enter.

#### Session behaviour

After selection:

- the selected role is fixed;
- the user enters that role’s homepage;
- the workspace does not offer an in-page role dropdown;
- the top bar displays `Demo mode`;
- switching role requires `Exit role view`;
- exiting returns to the Demo entry.

#### Demo role identities

The prototype may use seeded identities such as:

- `vfx-1`
- `cg-1`
- `artist-1`

These identifiers should not be displayed as the primary user-facing name.

#### Demo state

Demo mode should use one coherent seeded scenario shared across all three role views.

It should not create a separate fake system with different data.

---

### 5.3 Development mode

Development mode exists only to preserve efficient testing.

It may include:

- direct role selection;
- actor ID controls;
- raw route access;
- fixture tools;
- technical diagnostics.

These controls must be:

- hidden from the normal product UI;
- hidden from the portfolio Demo UI;
- available only through an explicit development route or development-only flag.

The current role selector should eventually move into this mode.

---

## 6. Role-locking policy

### Locked product rule

A user cannot freely switch production roles from within a workspace.

### Allowed role change

- sign out and sign in as another user;
- exit the current Demo role and return to Demo entry;
- use an explicit Development mode tool.

### Not allowed

- top-bar role dropdown in normal mode;
- top-bar role dropdown in Demo workspace;
- changing role without leaving the current role context;
- client-only visual switching that bypasses API authority.

Role locking is both an experience rule and an authority rule.

---

## 7. Role-specific homepage responsibilities

### 7.1 VFX Supervisor — Alignment Inbox

The first screen should answer:

- Which Shots require human attention?
- What creative ambiguity has appeared?
- Which Core Anchors are waiting for action?
- Which cross-role tensions need coordination?
- Which Re-anchor Proposals need consideration?
- What changed recently?

Priority content:

1. High Intent Signals
2. Human action required
3. Pending Core Anchor work
4. Cross-role tensions
5. Re-anchor Proposals
6. Recent Decisions
7. Project / Shot overview

---

### 7.2 CG Supervisor — Execution Inbox

The first screen should answer:

- Which Tasks require execution clarification?
- Which Tasks lack a confirmed Execution Anchor?
- Which Versions need review?
- Which dependencies are unresolved?
- Which issues must be escalated to the VFX Supervisor?
- What has changed in VFX feedback?

Priority content:

1. Assigned Tasks
2. Execution Anchor status
3. New Version / ReviewNote activity
4. Execution risks
5. Unresolved dependencies
6. Escalations
7. Relevant Intent Signals

---

### 7.3 Artist — My Tasks

The first screen should answer:

- What should I work on now?
- What feedback changed?
- What should I modify?
- Why does it matter?
- What can vary?
- What must not change?
- What needs supervisor clarification?

Priority content:

1. Current Tasks
2. Current Version
3. Latest practical guidance
4. Non-negotiables
5. Allowed variations
6. Self-checks
7. Questions for Human CG Supervisor
8. Submission / next-iteration status

---

## 8. Permission matrix

| Capability | VFX Supervisor | CG Supervisor | Artist |
|---|---:|---:|---:|
| View Project overview | Full | Relevant projects | Assigned context |
| View Shot overview | Full | Relevant shots | Task-related summary |
| View Intent Brief | Full | Full / concise context | Task-relevant summary |
| View confirmed Core Anchor | Full | Full read-only | Summary |
| Create Core Anchor draft | Yes | No | No |
| Resolve Core Anchor HumanGate | Yes | No | No |
| View confirmed Execution Anchor | Full | Full | Summary |
| Create Execution Anchor draft | No | Yes | No |
| Resolve Execution Anchor HumanGate | No | Yes | No |
| Generate VFX Supervisor review | Yes | No | No |
| Generate CG Supervisor review | No | Yes | No |
| Generate Artist guidance | No | No | Yes |
| View Artist guidance | Full | Full | Full |
| View Cross-role Assessment | Full | Full read-only | Role-relevant summary by default |
| Expand full Cross-role Assessment | Yes | Yes | Yes, read-only |
| Generate Cross-role Assessment | Yes | No | No |
| View Intent Signal | Full | Execution-oriented interpretation | Task-oriented interpretation |
| View Re-anchor Proposal | Full | Full read-only | Summary by default |
| Expand full Re-anchor Proposal | Yes | Yes | Yes, read-only |
| Apply Re-anchor Proposal | Not available | Not available | Not available |
| View HumanGate history | Full | Relevant gates | Not default |
| View Decisions | Full | Relevant decisions | Task-related outcome summary |
| View Evidence / provenance | Full | Full | Simplified, expandable |
| View ftrack linkage | Full | Operational linkage | Task / Version linkage |
| View integration health | Full | Operational summary | No global integration page |
| Submit Version | No | Coordination only | Planned Artist action |
| Use another role workspace | No | No | No |

This matrix describes the intended final experience. Existing API authority remains the minimum enforcement boundary.

---

## 9. Content-visibility matrix

### 9.1 Full by default

#### VFX Supervisor

- Core Anchor details
- Cross-role Assessment
- Re-anchor Proposal
- Intent Signal drivers
- Decisions
- evidence and provenance

#### CG Supervisor

- Execution Anchor details
- CG review
- Task dependencies
- Version review
- relevant VFX feedback
- full Cross-role Assessment read-only

#### Artist

- Task
- Version
- ReviewNote
- Artist guidance
- non-negotiables
- allowed variations
- practical actions
- self-checks
- supervisor questions

### 9.2 Summary by default, expandable

#### Artist

- Core Anchor
- Execution Anchor
- Cross-role Assessment
- Re-anchor Proposal
- Decisions
- provenance

#### CG Supervisor

- project-wide signal distribution
- unrelated Shot decisions
- integration health detail

### 9.3 Hidden from the primary path

- raw UUIDs
- raw AgentRun objects
- raw ContextSnapshot JSON
- old revisions not relevant to the current task
- unrelated Tasks and Versions
- raw ftrack payloads
- development actor controls

These remain available only through evidence, history, or development layers where appropriate.

---

## 10. Intent Signal by role

Intent Signal is one persisted derived object, but the UI presents its relevance differently.

### VFX Supervisor interpretation

Focus:

- shared creative ambiguity;
- cross-role tension;
- need for human coordination;
- possible Re-anchor consideration.

Typical wording:

`Human review required`

### CG Supervisor interpretation

Focus:

- execution ambiguity;
- missing or unclear boundaries;
- unresolved dependencies;
- issues requiring escalation.

Typical wording:

`Execution clarification required`

### Artist interpretation

Focus:

- whether work can safely continue;
- what remains confirmed;
- what requires supervisor clarification.

Typical wording:

`Supervisor clarification pending`

### Locked boundary

Step 7 displays and navigates Intent Signals.

Step 7 does not add:

- read / unread;
- acknowledge;
- assign;
- dismiss;
- resolve;
- notification delivery.

Those require a separate backend capability.

---

## 11. ftrack visibility by role

### VFX Supervisor

Can see:

- Project and Shot linkage;
- Version and ReviewNote source;
- last sync;
- source-of-truth;
- connector health;
- controlled write-back status;
- integration-level overview.

### CG Supervisor

Can see:

- Task linkage;
- Version linkage;
- ReviewNote linkage;
- department / assignee facts where available;
- operational sync state;
- write-back status relevant to the Task.

### Artist

Can see:

- linked Task;
- linked Version;
- ReviewNote source;
- whether the current item is synchronised;
- external record link when available.

### Step 7 boundary

Step 7 creates truthful presentation states such as:

- Linked to ftrack
- Integration-ready
- No linked ftrack entity
- Sync status unavailable
- Controlled write-back not yet available

Step 7 must not fabricate successful sync or write-back evidence.

---

## 12. Production Coordinator decision

### Proposed decision

Production Coordinator is not a formal Step 7 login role.

Rationale:

- current research and Agent architecture centre on VFX Supervisor, CG Supervisor, and Artist;
- introducing another workspace would expand the prototype beyond its validated scope;
- production coordination facts can enter through ftrack, Activity, Task status, assignment, and ReviewNote history;
- a future Coordinator workspace can be added without changing the three-role core.

Status: **Proposed**

---

## 13. Integration administration decision

### Proposed decision

Do not add a separate Integration Administrator workspace.

Instead:

- VFX Supervisor receives the full integration overview;
- CG Supervisor receives Task-level operational sync information;
- Artist receives object-level linkage only;
- Development mode may expose connector diagnostics.

Rationale:

- avoids enterprise administration scope;
- still makes the ftrack connection understandable and demonstrable;
- matches the needs of the current prototype.

Status: **Proposed**

---

## 14. Demo mechanism recommendation

### Recommended prototype behaviour

Route:

```text
/demo
```

Flow:

```text
Demo entry
→ Select one of three role cards
→ Store session-scoped demo identity
→ Redirect to the role homepage
→ Role remains locked
→ Exit role view
→ Return to /demo
```

Possible lightweight implementation:

- signed or server-readable cookie where practical;
- otherwise a prototype session store that cannot bypass existing API authority;
- seeded actor mapping;
- no full authentication product.

Do not expose role as an editable query parameter in the normal workspace URL.

Status: **Proposed**

---

## 15. Backend implications

### Required for honest Step 7 behaviour

Potentially required:

- a session-scoped resolved role;
- role-aware route protection;
- a stable way to resolve the seeded Demo actor;
- API requests using the resolved human actor rather than a visible role dropdown.

These are lightweight prototype requirements, not enterprise authentication.

### May be required later in Step 7 planning

- dashboard aggregation endpoint;
- role-specific inbox aggregation;
- signal aggregation;
- activity aggregation.

These should be assessed in 7A-2 and 7A-3 rather than assumed now.

### Deferred

- real user registration;
- password flows;
- SSO;
- organisations and teams;
- invitations;
- account recovery;
- production-grade RBAC administration;
- notification lifecycle;
- multi-project membership management.

---

## 16. Development migration rule

The existing role and actor controls are useful for testing.

They should not be deleted immediately.

Migration approach:

1. preserve current controls during planning;
2. introduce Demo and role-resolved workspace entry;
3. move raw role/actor controls to Development mode;
4. update tests to use explicit actor fixtures or development controls;
5. remove them from the portfolio-facing workspace only after replacement paths pass.

This avoids breaking Steps 1–6 while improving the final experience.

---

## 17. Proposed decisions to lock

1. ICAS Step 7 has three formal production roles only.
2. Agent identities are never login roles.
3. Normal product sessions have a fixed role.
4. Demo sessions select a role at entry and lock it until exit.
5. Development role controls remain available only outside the portfolio UI.
6. Each production role receives a different homepage and primary task model.
7. VFX Supervisor owns the full Alignment experience.
8. CG Supervisor owns the Execution experience.
9. Artist owns the Task and Version iteration experience.
10. Artist sees Cross-role Assessment and Re-anchor Proposal as summaries by default, with read-only expansion.
11. Intent Signal is role-contextual presentation over one persisted signal.
12. Step 7 does not add a notification lifecycle.
13. Production Coordinator is not a formal Step 7 workspace.
14. No separate Integration Administrator role is added.
15. VFX receives full integration overview; CG receives operational linkage; Artist receives object linkage.
16. No enterprise authentication system is required.
17. Existing API authority remains the enforcement baseline.
18. Role controls migrate to Development mode rather than disappearing immediately.

---

## 18. Open decisions for owner confirmation

### Decision A — Artist access to full Cross-role Assessment

**Recommendation:** show a task-relevant summary by default, with a read-only `View full assessment` expansion.

Reason:

- preserves transparency;
- avoids overwhelming the Artist;
- avoids creating a false information restriction when the current API allows read access.

### Decision B — Artist access to full Re-anchor Proposal

**Recommendation:** show a concise impact summary by default, with optional read-only expansion.

### Decision C — Demo session persistence

**Recommendation:** keep the selected role until the user explicitly chooses `Exit role view`, including across page refresh.

### Decision D — Integration overview

**Recommendation:** global Integration page visible to VFX Supervisor; CG sees an operational summary inside Task context; Artist sees only linked-object status.

### Decision E — Production Coordinator

**Recommendation:** defer as a formal role and represent coordination through ftrack facts, Activity, assignment, and status.

---

## 19. 7A-1 acceptance criteria

7A-1 is complete when:

1. three formal production roles are confirmed;
2. Agent identities are separated from human identities;
3. normal, Demo, and Development modes are distinguished;
4. role switching policy is locked;
5. every role has a primary responsibility;
6. every role has a homepage purpose;
7. the permission matrix is approved;
8. the content-visibility matrix is approved;
9. Intent Signal presentation by role is approved;
10. ftrack visibility by role is approved;
11. Production Coordinator scope is decided;
12. Integration administration scope is decided;
13. lightweight identity requirements are accepted;
14. enterprise authentication features are explicitly deferred;
15. the owner resolves the remaining open decisions.

---

## 20. Next step after approval

After 7A-1 is approved, Step 7A-2 will define:

- complete sitemap;
- routes;
- page inventory;
- global and role navigation;
- Project / Shot / Task / Version hierarchy;
- Signal placement;
- ftrack placement;
- Activity;
- History;
- Evidence;
- Decisions;
- migration from current pages.

No detailed page layout should be locked before the role model in this document is approved.
