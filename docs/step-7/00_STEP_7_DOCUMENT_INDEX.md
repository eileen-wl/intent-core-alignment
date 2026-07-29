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
recorded (currently 00–10).

The detailed 7A documents remain valuable throughout implementation. The Source of Truth is the quick reference; the implementation brief is the immediate coding instruction.
