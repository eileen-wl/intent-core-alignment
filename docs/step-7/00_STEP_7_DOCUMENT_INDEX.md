# ICAS Step 7 Documentation Index

This folder contains the complete Step 7 planning and implementation document set.

## Recommended reading order

### 01 — Master Plan

`01_STEP_7_MASTER_PLAN.md`

Purpose:

- explains why Step 7 exists;
- defines the four planning rounds, 7A-1 through 7A-4;
- defines the later implementation stages;
- records Step 7 / Step 8 boundaries and planning gates.

This is the planning roadmap, not the detailed product specification.

### 02 — Step 7A-1

`02_STEP_7A1_ROLES_IDENTITY_PERMISSIONS_DEMO.md`

Purpose:

- formal human roles;
- normal, Demo, and Development modes;
- role locking;
- permission and visibility matrices;
- role-specific homepage responsibilities;
- ftrack and Intent Signal visibility by role.

### 03 — Step 7A-2

`03_STEP_7A2_INFORMATION_ARCHITECTURE_ROUTES.md`

Purpose:

- complete sitemap;
- route structure;
- VFX, CG, and Artist navigation;
- object-to-page placement;
- Intent Signal placement;
- ftrack placement;
- legacy-route migration;
- Tier 1 page scope.

### 04 — Step 7A-3

`04_STEP_7A3_CORE_WORKFLOWS_INTERACTIONS.md`

Purpose:

- Core Anchor and Execution Anchor workflows;
- Role Agent generation workflows;
- Cross-role Assessment;
- Intent Signal;
- Re-anchor Proposal;
- HumanGate and Decision;
- ftrack linkage and future write-back;
- history, evidence, provenance, failure, and permission states.

### 05 — Step 7A-4

`05_STEP_7A4_WIREFRAMES_VISUAL_SYSTEM_DEMO.md`

Purpose:

- App Shell structure;
- page-level wireframe baselines;
- visual authority language;
- Intent Signal and ftrack component systems;
- shared component inventory;
- Demo scenario and three-role click path;
- implementation batches.

### 06 — Locked Source of Truth

`06_STEP_7_LOCKED_SOURCE_OF_TRUTH.md`

Purpose:

- compact implementation-facing summary of the decisions already approved in 7A-1 through 7A-4;
- gives Claude Code and developers one short reference for non-negotiable product boundaries.

Important:

- it is **not** a replacement for the four detailed 7A documents;
- it intentionally omits much of their explanation, alternatives, matrices, and detailed workflow reasoning;
- when implementation detail is unclear, consult the relevant 7A document.

### 07 — Step 7B-1 Implementation Brief

`07_STEP_7B1_SHARED_DESIGN_FOUNDATION_BRIEF.md`

Purpose:

- defines only the first implementation batch;
- translates the locked planning into exact development scope, components, boundaries, and validation;
- does not reopen the product planning.

### 08 — Step 7B-1 Implementation Note

`08_STEP_7B1_IMPLEMENTATION_NOTE.md`

Purpose:

- records what the shared design foundation batch actually built.

### 09 — Step 7B-2 Implementation Note

`09_STEP_7B2_IMPLEMENTATION_NOTE.md`

Purpose:

- records what the App Shell and Demo Identity batch actually built;
- superseded in part by document 10 below (the `/demo` hierarchy it
  originally described has since been corrected).

### 10 — ftrack Entry and Information-Architecture Amendment

`10_FTRACK_ENTRY_AND_IA_AMENDMENT.md`

Purpose:

- a narrow, locked correction made before Step 7B-3, not a new planning
  round;
- records the three product entry modes (production/ftrack, portfolio
  Demo, development) and the future ftrack production-entry flow;
- corrects the `/demo` information hierarchy (one dominant guided-demo
  action, three direct role entries moved to a secondary, collapsed
  section);
- corrects the VFX Shot and CG Task contextual navigation (removes the
  isolated `Decisions` tab; adds a `Versions` collection tab ahead of
  Version detail/review);
- corrects the placement of the VFX Integration overview to a secondary
  System/technical-status destination;
- states the Intent Signal honesty rule (`Latest Intent Signal`, not a
  live feed);
- states the real-software implementation standard (same domain model,
  APIs, and routes for production and portfolio Demo -- no separate
  fake Demo implementation).

Does not reopen the role model, route structure, Anchor authority,
HumanGate rules, or four-Agent architecture.

### 11 — Step 7B-3 Implementation Note

`11_STEP_7B3_IMPLEMENTATION_NOTE.md`

Purpose:

- records what the shared semantic components batch actually built:
  the Intent Signal, authority/advisory, Evidence/Provenance, and
  ftrack linkage component families;
- records the component-to-domain-contract mapping and the two
  frontend-only display view models introduced
  (`IntentSignalAvailability`, `EvidenceReferenceLike`);
- records the Intent Signal role-wording mapping and its truthfulness
  constraints;
- records which ftrack linkage states are grounded in real persisted
  data and which are explicitly deferred to Step 8;
- records the Development preview (`/dev/semantic-components`) and its
  fixture isolation.

### 12 — Step 7B-3 Visual Refinement Note

`12_STEP_7B3_VISUAL_REFINEMENT_NOTE.md`

Purpose:

- a visual-only refinement pass over the Step 7B-3 semantic components
  and their Development preview -- no domain logic, data mapping,
  routes, or behaviour changed;
- records the typography, surface/card-system, and per-family visual
  changes (Intent Signal, Authority, Evidence/Provenance, ftrack
  linkage) made to address weak hierarchy, small type, and repeated
  pale-card/amber overuse in the first pass;
- records the shared "left accent bar" grammar introduced across
  families for visual consistency without one repeated card template;
- records what remains deferred to Step 7C (in-page placement) and
  Step 7D (live-data and accessibility QA passes).

### 13 — Step 7C-0A VFX Task Model and IA Options

`13_STEP_7C0A_VFX_TASK_MODEL_AND_IA_OPTIONS.md`

Purpose:

- a repository-grounded planning document, not an implementation batch --
  precedes VFX Workspace implementation;
- derives the real VFX Supervisor task model, decision hierarchy, and a
  four-layer information-priority model from the actual persisted domain
  data and already-wired API surface, not from the component gallery;
- documents at least three genuinely different Workspace information-
  architecture alternatives with a qualitative decision matrix and one
  recommended (but explicitly not locked) direction;
- proposes a minimal page inventory against the already-approved route
  list, a real-data/capability map using `AVAILABLE_NOW` /
  `FRONTEND_INTEGRATION` / `SMALL_BACKEND_GAP` / `STEP_8_FTRACK` /
  `OUT_OF_SCOPE` labels, an honest state model, and interaction/visual
  principles tied to the work rather than styling alone;
- records unresolved product questions and repository contradictions
  (notably: two coexisting Version-level review pathways, no cross-Shot
  "requires attention" aggregation, no entity-to-write-back-record
  lookup) for the owner to resolve before Step 7C-0B.
- corrected in place (§0) and **locked** by document 14 below -- read
  document 14 for the resolved decisions.

### 14 — Step 7C-0B VFX Workspace Locked IA and Implementation Plan

`14_STEP_7C0B_VFX_WORKSPACE_LOCKED_IA_AND_IMPLEMENTATION_PLAN.md`

Purpose:

- resolves document 13's open decisions into a **locked** VFX Workspace
  information architecture, interaction model, and implementation plan;
- locks the route/page backbone and tiering, the Shot Overview's
  Current-focus/Next-in-this-Shot interaction model and deterministic
  focus-precedence rule, the CrossRoleAssessment-vs-legacy-
  AlignmentAssessment product decision, a specification (not an
  implementation) for a bounded VFX Inbox read-model aggregation, a
  server-side identity-to-Actor adapter architecture, and the Demo
  scenario resolver;
- provides page-by-page textual wireframes, an information-disclosure
  matrix, a frontend workflow architecture, mutation/refresh
  boundaries, an honest page-state model, and an implementation route --
  none started by this document; **corrected after owner review:** the
  route section originally sketched here (previously an obsolete
  `7C-1A`-`7C-1F` batch sequence) is superseded by the locked `7C-1`
  through `7C-5`, then `7D` route recorded in document 16 and
  cross-referenced here;
- records two additional repository findings from this task's
  re-inspection: `Version` has no `task_id` foreign key (no persisted
  Task-Version relationship exists), and real ftrack write-back
  capability already exists on the Core Anchor confirm endpoint
  (`request_write_back`), unwired in the frontend.
- clarified in place by document 15 below on four points (non-persisted
  "addressed" wording, the Task-Version generation selection rule, and
  the Demo data mechanism) -- its locked IA is otherwise unchanged.

### 15 — Step 7C-0C VFX End-to-End Interaction and Data Flow

`15_STEP_7C0C_VFX_END_TO_END_INTERACTION_AND_DATA_FLOW.md`

Purpose:

- specifies exactly how document 14's locked VFX Workspace IA behaves
  end to end: precise Current-focus predicates (timestamp-grounded,
  replacing any wording that implied a persisted "addressed"/"unread"
  status with the honestly-named derived condition
  `alignment_not_followed_by_anchor_action`), route-context contracts
  for all seven VFX routes, and a locked Task-Version selection
  contract (explicit human choice required for Cross-role Assessment
  generation whenever no existing Assessment already establishes the
  pairing -- no automatic latest/first/index-zero selection);
- resolves document 14's one open question: the Demo data mechanism is
  locked to an idempotent, name-keyed, real-domain-model seed/bootstrap
  (not a request-time-only resolver), with safe-repeatability rules and
  failure behaviour specified;
- specifies full end-to-end sequences for the Intent, Alignment,
  Version, and Activity workflows, exact server-side identity mutation
  contracts (Server Actions preferred uniformly, with the reasoning),
  state-transition tables for eight domain lifecycles, scoped
  refresh/navigation outcomes per mutation, a concrete D1 walkthrough,
  and 20 browser acceptance scenarios;
- defines the exact handoff to Step 7C-0D (spatial low-fidelity page
  structures and the final implementation brief) without producing any
  page layout itself.
- its §4.3 Demo seed-identity default is superseded by document 16 §2.

### 16 — Step 7C-0D VFX Low-Fidelity Blueprints and Final Implementation Brief

`16_STEP_7C0D_VFX_LOW_FIDELITY_BLUEPRINTS_AND_FINAL_IMPLEMENTATION_BRIEF.md`

Purpose:

- the final Step 7C planning document -- converts documents 14-15's
  locked IA and interaction contracts into spatial low-fidelity page
  blueprints (desktop + narrow-width) for all seven VFX first-pass
  routes, a shared cross-page spatial system (shell, production-context
  header, contextual tabs, primary/secondary information patterns), and
  a component reuse/adaptation map classifying every relevant Step 7B
  component;
- resolves the Demo seed-identity ambiguity left open by document 15: a
  compound deterministic key via the existing `ExternalEntityLink`
  mechanism (Project/Shot/Task) plus a stable description-marker prefix
  (Version), never a Project name alone, with duplicate/partial-seed
  recovery and inconsistent-linked-context handling specified;
- locks the D1 seed's exact scope and lifecycle ordering, resolving the
  stable-seeded-vs-live-Agent-action tension by running real generation
  service calls under the existing deterministic provider (the same
  mode already used by the backend test suite) and locking the Demo's
  starting Current focus to `alignment_not_followed_by_anchor_action`;
- provides the final, owner-approved implementation-ready brief: three
  VFX stages -- `7C-1` (foundations, Alignment Inbox, Shot Overview),
  `7C-2` (Intent Workspace), `7C-3` (Alignment, Versions, Activity, VFX
  close-out) -- each one stage with one owner acceptance gate, followed
  by `7C-4` (CG Workspace) and `7C-5` (Artist Workspace) named only, and
  `7D` (cross-role finalisation); **corrected after owner review:** this
  replaces an earlier, obsolete `7C-1A1`-`7C-1A4`/`7C-1A`-`7C-1F` batch
  sequence that was never part of the approved plan;
- resolves the Demo seed-identity design further: complete scenario-
  level idempotency covering every supporting record (Core/Execution
  Anchor baselines, role reviews, CrossRoleAssessment/Signal/Proposal,
  ContextSnapshot/AgentRun, ReviewNotes), and locks the owner-approved
  `ExternalSource = Literal["ftrack", "demo"]` semantics;
- corrects legacy AlignmentAssessment to fully read-only (no Generate/
  Accept/Reject) anywhere in the new VFX Workspace, and removes an
  unsupported global TopBar Signal indicator from the spatial system;
- corrects the Intent Workspace comparison collapse to a CSS container
  query on the comparison container's own usable width, not viewport
  width alone (the AppShell's sidebar meaningfully narrows the usable
  container width at standard-laptop viewports);
- provides a spatial D1 storyboard and page-level browser-acceptance
  checklists designed to let the owner reject a technically-correct
  page on hierarchy/density grounds alone;
- states the exact readiness criteria for beginning Step `7C-1` -- the
  last planning document before implementation begins.

## Document hierarchy

```text
Master Plan
├── 7A-1 Roles / identity / permissions
├── 7A-2 Information architecture / routes
├── 7A-3 Workflows / interactions
└── 7A-4 Wireframes / visual system / Demo

Approved decisions from 7A-1 to 7A-4
→ Locked Source of Truth

Locked Source of Truth + relevant detailed 7A document
→ 7B-1 and later implementation briefs
```

## Which files should be placed in the repository?

Recommended location:

```text
docs/step-7/
```

Place all files in that folder, including this index. The set has grown
past the original eight as implementation batches and corrections were
recorded (currently 00–16).

The detailed 7A documents remain valuable throughout implementation. The Source of Truth is the quick reference; the implementation brief is the immediate coding instruction.
