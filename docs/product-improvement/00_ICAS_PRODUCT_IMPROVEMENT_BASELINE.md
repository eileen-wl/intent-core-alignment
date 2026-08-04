# ICAS Product Improvement Baseline

**Document:** `00_ICAS_PRODUCT_IMPROVEMENT_BASELINE.md`
**Status:** Approved product-improvement source of truth
**Phase:** Post-Step 9B product convergence
**Scope:** Product direction, Golden Journey, capability truth, Demo strategy, and delivery method
**Not an implementation:** This document does not itself authorise source-code, schema, permission,
or data mutations.

---

# 1. Why this baseline exists

ICAS has developed a strong engineering core:

- revisioned Core and Execution Anchors;
- Human Gates and Human Decisions;
- role-aware workspaces and backend authorization;
- multiple Agent capabilities with structured outputs and provenance;
- Versions, Review Notes, dependencies, assessments, signals, and proposals;
- a real read-only ftrack Connector and safe real thumbnail context;
- extensive automated tests.

However, the current product experience does not yet express the original Design Concept as one
coherent system.

The current gap is not simply “some pages need visual polish.” Four layers have drifted apart:

```text
Original Design Concept
        ↓
Implemented backend/domain capabilities
        ↓
Current role-aware product UI
        ↓
Discoverable user journey and coherent Demo data
```

Consequences include:

- Anchors exist as strong domain objects but are not the continuously visible product centre;
- Agent capabilities exist but are hidden, conditional, or still visible only on legacy routes;
- page IA is orderly but the end-to-end task journey is not clear;
- true ftrack data, synthetic Demo data, and state-test fixtures appear as one confusing data world;
- automated tests prove individual parts while no single user journey proves the whole concept;
- completed engineering steps are sometimes mistaken for completion of the original Design
  Concept.

This baseline reconnects those layers before further implementation.

---

# 2. Source-of-truth precedence for the improvement phase

Use the following precedence:

1. **This product-improvement baseline** defines the target product experience and improvement
   decisions.
2. `docs/PRODUCT_SCOPE.md`, `docs/ROLE_PERMISSIONS.md`, `docs/DOMAIN_MODEL.md`,
   `docs/AGENT_CONTRACTS.md`, and `docs/FTRACK_INTEGRATION.md` define locked authority, domain,
   and integration rules.
3. **Current code** is the source of truth for what is actually implemented now.
4. Historical Step documents provide evidence and rationale, but they do not automatically define
   the future target.
5. The original Design Concept defines the product’s conceptual promise, but wording that implies
   autonomous Agent authority must be interpreted through the current human-authority contracts.

When documents and code disagree, do not silently reconcile them. Record the discrepancy as one
of:

- product target not yet implemented;
- implementation exists but current UI does not expose it;
- legacy implementation not migrated;
- historical document is stale;
- terminology needs consolidation.

---

# 3. Product north star

ICAS is:

> An Anchor-centred, role-aware, AI-assisted alignment system that keeps shared creative intent
> visible across department execution, Versions, feedback, and repeated review; lets Agents
> structure, translate, compare, and recommend; and preserves final authority with the correct
> human role.

The product north star is:

```text
Role-aware Workspace
+ Anchor-first experience
+ visible Agent workflow
+ human-controlled decisions
+ continuous alignment and re-anchor loop
```

ICAS must not become:

- a generic production tracker;
- an alternative ftrack clone;
- four disconnected Agent chatbots;
- a passive archive of Review Notes;
- a dashboard that displays many states without guiding the next action;
- a synthetic presentation UI disconnected from the real domain model.

---

# 4. Locked product decisions

## Decision A — Keep role-aware workspaces and add an Anchor Context Layer

Keep the formal product architecture:

```text
/
├── /vfx/**
├── /cg/**
└── /artist/**
```

Do not return to one long shared Dashboard that ignores role ownership.

Add a persistent, role-appropriate **Anchor Context Layer** across key pages so users can always
understand:

1. the current shared direction;
2. the relevant execution boundary;
3. the current alignment/Intent Signal state;
4. the next action or human decision.

The layer may later be implemented as a header, compact bar, expandable drawer, or related
pattern. Its final visual form is not locked here; its information responsibility is locked.

## Decision B — Golden Journey ends with Core Anchor Revision 2

The complete Demo must show that an Anchor is neither disposable nor permanently frozen.

The journey ends with:

- production evidence creating a legitimate tension;
- a Core Agent Re-anchor Proposal;
- a human VFX Supervisor choosing what change is acceptable;
- a human-confirmed `Core Anchor Revision 2`;
- Revision 1 preserved as superseded history;
- downstream Execution Anchors and Artist Guidance marked as needing revision/outdated;
- downstream regeneration and renewed alignment.

## Decision C — Golden Demo has two scenario controls

The Golden Demo must support:

- `Reset journey` — restore the Demo scenario to its defined starting state;
- `Load completed journey` — load a deterministic, coherent completed state for short
  presentations.

Both controls operate only on Golden-Demo-scoped data.

They must never mutate:

- live ftrack entities;
- live ftrack-linked local records;
- unrelated manual/local data;
- development fixtures outside the Golden Demo namespace.

## Decision D — One Core Anchor branches into three representative departments

The Golden Demo includes three representative department Tasks:

- Animation;
- Lighting;
- Compositing.

These are department and Task contexts, not new authorization roles.

The application still has exactly three human roles:

- VFX Supervisor;
- CG Supervisor;
- Artist.

Department-specific Artist personas use the same `artist` authorization model and the same
`/artist/**` route structure. Do not create `/animation/**`, `/lighting/**`, or `/compositing/**`
applications.

---

# 5. Anchor-first product model

## 5.1 Core Anchor

The Core Anchor is the shared Shot-level creative authority.

It may contain:

- core creative objective;
- Shot objective;
- emotional tone;
- visual focus;
- rhythm and intensity;
- character relationship;
- narrative priority;
- non-negotiable constraints;
- allowed variation;
- references;
- high-risk drift points;
- open questions.

The Core Agent may propose a draft. Only the Human VFX Supervisor can confirm or reject it.

## 5.2 Execution Anchors

Each department Task has a department-specific Execution Anchor that translates—not redefines—the
Core Anchor.

For the Golden Demo:

```text
Core Anchor — Shot 010 Final Confrontation
├── Animation Execution Anchor
├── Lighting Execution Anchor
└── Compositing Execution Anchor
```

The CG Supervisor Agent may propose each Execution Anchor Draft. Only the Human CG Supervisor can
confirm or reject it.

## 5.3 Artist relationship to Anchors

Each department Artist should understand:

```text
WHY
= relevant Core Anchor direction

HOW
= relevant department Execution Anchor

WHAT TO DO NOW
= Artist Agent Guidance for the selected Version/feedback context
```

Artists can read relevant Anchors, compare output against them, prepare rationale, and ask for
clarification. They cannot modify or confirm Anchors.

## 5.4 Continuous visibility requirement

Anchor information must not exist only on deep Intent/Execution pages.

On every key page, the user should be able to answer:

1. What direction is currently authoritative?
2. Which Anchor revision is this page/Version/Guidance using?
3. What is safe to vary?
4. What risk or mismatch currently exists?
5. What is the next valid action, and who owns it?

---

# 6. Visible Agent workflow model

ICAS does not present four independent chatbots. Agent capabilities are embedded in the human
workflow.

Every important Agent contribution should make three things understandable:

```text
Inputs
→ Agent output
→ Human authority / downstream effect
```

An Agent result must clearly state:

- which Agent/capability produced it;
- what source context it used;
- what it produced;
- whether it is advisory, a Draft, an Assessment, or a Proposal;
- which human role may edit/confirm/act;
- which downstream work becomes ready or outdated.

## 6.1 Core Agent

Target visible chain:

```text
Intent Brief
→ Intent Decomposition
→ Context Reconstruction
→ Core Anchor Draft
→ VFX human review and confirmation
```

Later in the journey:

```text
Role outputs + Versions + Review Notes + Dependencies
→ Cross-role/cross-department Assessment
→ Intent Signal
→ Re-anchor Proposal
→ VFX human decision
```

## 6.2 VFX Supervisor Agent

Target visible chain:

```text
Selected Version
+ Core Anchor
+ feedback/history
→ creative review
→ feedback priorities, creative drift observations, review questions,
  and re-anchor recommendation
→ VFX human action
```

The VFX Agent does not confirm creative approval or modify the Core Anchor.

## 6.3 CG Supervisor Agent

The CG Agent has two distinct visible contributions.

### Department technical translation

```text
Confirmed Core Anchor
+ Task/Department context
+ relevant evidence
→ department Execution Anchor Draft
→ CG human edit/confirmation
```

### Version technical review

```text
Selected Version
+ confirmed Core/Execution Anchors
+ Review Notes/Dependencies
→ CG Supervisor Review
→ CG human Review Note, Dependency, or escalation action
```

These contributions must not be collapsed into one ambiguous “AI review” module.

## 6.4 Artist Agent

Target visible chain:

```text
Core Anchor
+ department Execution Anchor
+ selected Version
+ Review Notes/CG Review
→ Artist Guidance
→ practical actions, rationale, self-checks, and supervisor questions
→ human Artist execution/submission preparation
```

The Artist Agent does not edit Anchors, submit a Version, mark feedback resolved, or approve work.

---

# 7. Capability truth matrix at baseline

The following table describes the repository state at the beginning of the improvement phase.
Implementation work must re-verify affected rows against current code before editing.

| Capability | Backend/domain | Current role-aware UI | Legacy/current evidence | Baseline classification |
|---|---|---|---|---|
| Core Agent Intent Decomposition | Implemented | Existing result/disclosure is not a complete discoverable generation workflow | Generation controls exist on legacy `/shots/[shotId]` | Implemented, not fully migrated/visible |
| Core Agent Context Reconstruction | Implemented | Existing result/disclosure is not a complete discoverable generation workflow | Generation controls exist on legacy `/shots/[shotId]` | Implemented, not fully migrated/visible |
| Core Agent Core Anchor Drafting | Implemented | Human Draft/Confirm lifecycle is strong; Agent drafting chain/source is not clear | Legacy route has Core Agent draft generation | Implemented, not fully migrated/visible |
| Human Core Anchor lifecycle | Implemented | Visible on VFX Intent | Current role-aware workflow | Implemented and visible |
| CG Agent Execution Anchor Drafting | Implemented | Conditionally visible only when no Draft exists; existing Draft source becomes unclear | Current CG Execution contains generation path plus Human lifecycle | Implemented but conditional/poorly attributed |
| Human Execution Anchor lifecycle | Implemented | Visible on CG Execution | Current role-aware workflow | Implemented and visible |
| VFX Supervisor Agent creative review | Implemented | Missing from current role-aware VFX Versions experience | Generation/result exists on legacy Version route | Implemented on legacy route only / migration gap |
| CG Supervisor Agent Version review | Implemented | Visible on CG Version Review when prerequisites allow | Current role-aware workflow | Implemented and visible, conditional |
| Artist Agent Guidance | Implemented | Visible on Artist Current Version | Current role-aware workflow | Implemented and visible |
| Cross-role Assessment | Implemented | Conditional; unavailable state does not explain prerequisites or next steps sufficiently | Current VFX Alignment | Implemented but hidden by prerequisites |
| Cross-department Assessment meaning | Domain can use Task/department evidence | Current expression is incomplete for a three-department story | Partial Department Overview/Assessment support | Product expression gap |
| Re-anchor Proposal | Implemented | Conditional and deep in the flow | Current Alignment → Intent path | Implemented but not continuously understandable |
| Intent Signal | Deterministic `low`/`medium`/`high` attention-level model, components, and logic exist; the locked `Stable`/`Stretching`/`Drifting`/`Re-anchor needed` lifecycle vocabulary is not implemented | A summary and human-review requirement are visible on current VFX Alignment, but the Signal is not persistent across formal role-aware pages | Current VFX Alignment plus dev/legacy components and tests | Implemented foundation with a designed-but-not-implemented lifecycle vocabulary and a product-integration gap |
| Working Direction summaries | Implemented | Visible on VFX/CG/Artist Overview pages | Step 9B | Implemented and visible |
| Department Execution Overview | Implemented | Visible on VFX Shot Overview | Step 9B | Implemented and visible; expand to three departments |
| Real ftrack Version/Review Note/thumbnail context | Implemented | Visible on Version-focused pages | Step 8/9B | Implemented and visible |
| Artist Submission Rationale/Handoff package | Agent contract/design concept supports it | Not yet a clear current product workflow | Partial Guidance/provenance only | Designed/partial, needs explicit product decision |
| VFX feedback clustering/priority support | Agent contract/design concept supports it | Current Inbox/focus only partially represents it | Legacy VFX review + current work-item system | Partial/migration and product gap |
| Version explosion comparison/selection support | Basic list/selected Version exists | No strong comparison/filter/difference decision support | Current Version pages | Product gap; scope must be bounded later |

This matrix must be updated during implementation rather than replaced by optimistic completion
claims.

---

# 8. Formal product routes and legacy boundary

## 8.1 Formal product routes

The product journey uses:

```text
/
/vfx/**
/cg/**
/artist/**
```

## 8.2 Legacy capability-reference routes

```text
/shots/**
```

Legacy routes may be inspected to reuse already-correct capabilities/components/services, such as:

- Core Agent generation controls;
- VFX Supervisor Agent review;
- Intent Signal presentation;
- provenance patterns.

Rules:

- do not add new product capability only to legacy routes;
- migrate reusable capability into the role-aware experience;
- do not copy legacy permission or IA mistakes;
- freeze or remove legacy routes only after current routes provide equivalent required capability
  and tests.

## 8.3 Development routes

```text
/dev/**
```

These are not part of the user journey or Demo narrative.

---

# 9. Golden Demo Scenario

## 9.1 Scenario identity

```text
Project: D1 Demo Project
Shot: Shot 010 — Final Confrontation
Creative premise: A restrained dusk confrontation that must remain internal, controlled,
and centred on the relationship rather than spectacle.
```

The scenario is coherent narrative data, not a collection of disconnected UI states.

## 9.2 Department structure

```text
Shot 010 — Final Confrontation
├── Animation Task
├── Lighting Task
└── Compositing Task
```

Each Task has:

- one department;
- one relevant department Artist persona;
- its own Execution Anchor revisions;
- Task-valid Versions/Review Notes;
- Artist Guidance;
- CG Reviews;
- dependencies/escalations where the story requires them.

## 9.3 Department meanings

### Animation

Representative standards:

- performance timing;
- pose/silhouette clarity;
- eye line and character relationship;
- gesture intensity;
- pause duration;
- restrained body movement;
- allowed timing adjustment;
- animation-ready criteria.

Story tension:

> An Animation change improves immediate readability but makes the performance more dramatic and
> weakens the restrained relationship.

### Lighting

Representative standards:

- key/fill ratio;
- exposure range;
- colour temperature;
- facial readability;
- silhouette separation;
- highlight control;
- shadow continuity;
- allowed intensity refinement;
- publish conditions.

Story tension:

> A Lighting change improves facial readability but makes the scene brighter and more heroic than
> the Core Anchor allows.

### Compositing

Representative standards:

- contrast range;
- grade/black level;
- bloom/glow;
- edge integration;
- depth consistency;
- atmospheric and temporal continuity;
- allowed local enhancement;
- final-delivery criteria.

Story tension:

> A Compositing change improves visual impact but strengthens contrast/glow until spectacle begins
> to dominate the character relationship.

## 9.4 Artist personas

The Golden Demo should support three department-specific Artist personas or equivalent department
assignments:

- Animation Artist;
- Lighting Artist;
- Compositing Artist.

They share the same backend `artist` role and permissions.

The exact Demo entry interaction is a later UX decision. It must not create new human roles or
three duplicated products.

---

# 10. Golden Journey

All major product changes and Demo data should support this journey.

## Stage 1 — Capture and structure shared intent

1. VFX Supervisor enters the Intent Brief.
2. Core Agent generates Intent Decomposition.
3. Core Agent reconstructs relevant context.
4. Core Agent proposes Core Anchor Draft Revision 1.
5. The page shows:
   - source input;
   - Agent interpretation;
   - proposed Anchor fields;
   - what requires human authority.
6. VFX Supervisor edits and confirms Revision 1 through HumanGate/Decision.

Expected downstream effect:

- department technical translation becomes ready;
- the shared Anchor Context Layer reflects confirmed Revision 1;
- relevant CG work items become available.

## Stage 2 — Translate shared intent into three department anchors

For Animation, Lighting, and Compositing:

1. CG Agent reads the same confirmed Core Anchor plus department context.
2. It proposes a department-specific Execution Anchor Draft.
3. The UI shows:
   - shared creative requirement;
   - department interpretation;
   - technical standards;
   - allowed refinement;
   - escalation conditions;
   - Agent source/provenance;
   - CG human authority.
4. CG Supervisor edits and confirms each department Execution Anchor separately.

Expected downstream effect:

- each department Artist receives a relevant Working Direction;
- the source Core Anchor revision remains visible;
- unconfirmed/old department Anchors cannot masquerade as current authority.

## Stage 3 — Convert Anchors into department Artist actions

For each department Artist:

1. Task Overview communicates WHY/HOW/WHAT TO DO NOW.
2. Artist Current Version shows relevant Production Evidence.
3. Artist Agent generates Guidance tied to:
   - Core Anchor revision;
   - department Execution Anchor revision;
   - selected Version;
   - Review Notes/CG Review.
4. Guidance includes:
   - practical actions;
   - why each action matters;
   - must-preserve conditions;
   - allowed exploration;
   - self-checks;
   - questions/escalation triggers;
   - submission rationale support.

Expected downstream effect:

- the Artist can act without redefining direction;
- supervisors later receive a Version with explicit execution rationale/context.

## Stage 4 — Return Versions and feedback to Anchor-based review

1. Department Versions and Review Notes become available.
2. CG Agent performs technical/execution review against the relevant Execution Anchor.
3. VFX Supervisor Agent performs creative review against the Core Anchor.
4. The product distinguishes:

```text
CG Review = technical execution and delivery risk
VFX Review = shared creative direction and overall quality
```

5. Human review actions remain separate from Agent interpretations.

## Stage 5 — Create a cross-department local-optimum conflict

The scenario intentionally makes all three departments locally reasonable but jointly misaligned:

```text
Animation becomes more dramatic
+ Lighting becomes brighter
+ Compositing becomes more contrast-heavy
= the restrained confrontation begins to drift toward spectacle
```

This is not a random error fixture. It represents the research insight that department-local
optimisation can weaken global creative intent.

## Stage 6 — Assess alignment and make the Signal visible

1. Core Agent receives:
   - Core Anchor;
   - three Execution Anchors;
   - selected Versions;
   - Review Notes;
   - CG Reviews;
   - VFX Review;
   - Artist Guidance/rationale;
   - Dependencies/Decisions.
2. It generates a cross-role and cross-department Assessment.
3. The Assessment identifies:
   - agreements;
   - tensions;
   - affected Anchor dimensions;
   - local-optimum interactions;
   - unresolved dependencies;
   - evidence gaps;
   - coordination priorities.
4. Intent Signal progresses meaningfully:

```text
Stable → Stretching → Drifting → Re-anchor needed
```

The Signal must be discoverable beyond the deep Alignment page.

## Stage 7 — Human-controlled re-anchor

1. Core Agent proposes a Re-anchor Proposal.
2. It identifies affected dimensions and evidence; it does not alter the Anchor.
3. VFX Supervisor reviews production evidence and chooses what new variation is acceptable.
4. VFX Supervisor creates/edits Core Anchor Revision 2.
5. HumanGate/Decision confirms Revision 2.
6. Revision 1 is preserved as superseded.

Example outcome:

- permit a bounded increase in contrast/visibility;
- retain restrained performance and relationship focus;
- keep prohibited jump cuts/over-dramatisation;
- clarify exposure/contrast limits and related drift risks.

## Stage 8 — Propagate the new Anchor downstream

After Revision 2 is confirmed:

- all three Execution Anchors are identified as based on an older Core Anchor and need review;
- relevant Artist Guidance becomes outdated;
- CG work items direct each department to re-translate/confirm;
- Artists receive regenerated Guidance;
- Intent Signal can return to Stable after required human actions.

This completes the loop:

```text
Intent
→ Core Anchor
→ Department Execution Anchors
→ Artist actions
→ Versions and feedback
→ CG/VFX reviews
→ Cross-role/cross-department alignment
→ Re-anchor
→ Updated downstream execution
```

---

# 11. Page responsibility principles

The current route hierarchy can remain, but page responsibilities must become journey-oriented.

## Workspace Home

Answers:

- What should this role focus on now?
- Which Golden/Live data world am I viewing?
- What changed since the last human action?

It should not duplicate the full object list or deep object Overview.

## Review Inbox

Answers:

- Which actionable work items require this role?
- Why are they ready?
- Which human/Agent/downstream event created them?
- What happens after action?

It remains work-item-first, but must not hide all secondary problems behind one unexplained focus.

## Shots / Tasks

Answers:

- What objects can this role access?
- What are their Anchor/Signal/readiness states?
- Which data world do they belong to?

It is an object catalogue, not the primary to-do list.

## Overview

Answers the four universal questions:

1. Current authoritative direction?
2. Current production situation?
3. Agent interpretation/risk?
4. Next human action?

## Deep Intent / Execution / Version / Alignment pages

These contain complete evidence, Drafts, revisions, Agent Runs, and human actions. They should not
be the first place where the user learns that an Anchor or Agent capability exists.

---

# 12. Prerequisite and empty-state rules

A capability must not disappear without explanation because prerequisites are missing.

Instead of only:

```text
No Alignment Assessment has been recorded.
```

show:

```text
Generate Cross-role Assessment

Not ready:
✓ Confirmed Core Anchor
✓ Confirmed Execution Anchor
✕ No Production Version
✕ Artist Guidance not generated

Next step: Open Artist Current Version
```

Every blocked capability state should explain:

- what the capability does;
- which prerequisites are met/missing;
- why the missing input matters;
- the next permitted action/route;
- which role owns that action.

Empty states should be beginnings of a journey, not dead ends.

---

# 13. Agent attribution and provenance UX

Technical provenance already exists, but product-level explanation needs improvement.

For each Agent result, present a concise collaboration summary before deep provenance:

```text
Agent
Core Agent · Intent Decomposition

Inputs
Intent Brief · references · current Shot context

Output
Proposed intent dimensions, candidate constraints, variation zones, and drift risks

Authority
Advisory; VFX Supervisor may edit and use it in a Core Anchor Draft
```

Deep disclosure may then expose:

- ContextSnapshot;
- source records;
- AgentRun;
- provider/model;
- prompt/schema version;
- timestamp;
- confidence/evidence.

Do not make ordinary users infer workflow meaning from `0 sources`, UUIDs, or technical run fields.

---

# 14. Intent Signal product requirement

Intent Signal is not merely an Alignment result or dev component.

It is a persistent, lightweight orientation signal with states such as:

- Stable;
- Stretching;
- Drifting;
- Re-anchor needed.

Role-aware meaning:

- VFX: Is the shared creative direction stable?
- CG: Is technical execution pressure affecting intent?
- Artist: Is the current modification safely inside the relevant execution boundary?

The Signal must:

- cite/lead to the evidence behind it;
- never pretend to be a Human Decision;
- update based on real scenario state;
- indicate when human review is required;
- be visible in key headers/Overview/list states without dominating every page.

The exact visual design is deferred to the Anchor-first/UX packages.

---

# 15. Data-world separation

## 15.1 Golden Demo Scenario

Purpose:

- demonstrate the complete concept;
- tell one coherent story across all three human roles and three departments;
- support Reset and Load completed;
- provide deterministic owner/evaluation paths.

Requirements:

- stable Demo namespace/identity;
- clear Demo label in UI;
- coherent causal records;
- reset limited to Demo-scoped rows;
- no mutation of live ftrack-linked data;
- no need to manufacture every boundary state inside the main story.

## 15.2 Live ftrack Data

Purpose:

- prove real Connector mapping;
- prove real Version/Review Note/thumbnail context;
- demonstrate real partial-data handling.

It does not need a complete synthetic Anchor/Agent journey.

UI must label it as live ftrack-linked context rather than silently mixing it with Demo data.

## 15.3 Development Fixtures

Purpose:

- automated lifecycle testing;
- missing-context/empty states;
- error/retry states;
- authorization tests;
- isolated owner checks.

Requirements:

- hidden from normal Demo object lists by default;
- clearly identifiable in dev/test tools;
- not used as the narrative Golden Journey;
- not mistaken for live production data.

---

# 16. Improvement packages

The improvement phase uses four coherent packages, not an indefinitely nested Step tree.

## Package A — Anchor-first experience

Goal:

- make Core/Execution Anchors and Intent Signal continuously understandable across key role-aware
  pages;
- clarify current revision, source revision, permitted variation, risk, and next action;
- clarify Home/Inbox/Object/Overview responsibilities.

Likely work:

- Anchor Context Layer;
- role-appropriate Anchor summaries;
- Signal integration;
- clearer current vs selected Version/Anchor labels;
- journey-aware empty/prerequisite states.

## Package B — Visible Agent journey completion

Goal:

- expose the full Agent input → output → human authority chain in current role-aware routes;
- migrate correct legacy capabilities;
- restore VFX Agent creative review;
- make Core Agent decomposition/context/drafting discoverable;
- clarify CG drafting vs CG Version review;
- strengthen Artist Guidance/submission preparation;
- make cross-role/cross-department Assessment prerequisites actionable.

### Package B implementation checkpoint (2026-08-03)

Package B is in progress on `feat/package-b-agent-journey-completion`. The first implementation
pass adds a shared `AgentContributionPanel` to formal VFX, CG, and Artist routes, presenting Inputs,
Agent contribution, Human authority, Next human action, lifecycle, and collapsed provenance. It
wires existing decomposition, reconstruction, drafting, creative review, execution review,
iteration guidance, and cross-role assessment capabilities without adding roles, routes, persistence,
Demo seed data, or ftrack writes. Focused frontend tests (96 tests), web typecheck, touched ESLint,
and `git diff --check` pass; owner visual validation is pending. Package B is not complete.

### Package B owner-validation correction checkpoint (2026-08-04)

The correction pass keeps Package B in progress and adds truthful readiness/action handling on
the six formal routes, formal Core Anchor Draft and VFX Creative Review actions, selected-Version
CG Review persistence, and captured Cross-role Assessment provenance where available. The focused
CG Review backend suite (61 tests), six formal frontend page suites (97 tests), regenerated
TypeScript contracts, and web typecheck pass. Owner re-validation remains pending; Package B is
not complete. Packages C and D have not started.

### Package B final merge-gate closeout (2026-08-04)

Owner visual validation passed. The complete merge gate passed: 1,138 backend/infra tests
(contracts 53, API 966, worker 36, Connector 81, infra 2), 1,018 frontend tests across 129
test files, migration upgrade/downgrade validation including the CG Supervisor Review
`version_id` migration, clean production build with 18 static pages generated, full Ruff and
mypy checks, regenerated Python/OpenAPI/TypeScript contracts, Web TypeScript, ESLint, Prettier,
`uv lock --check`, frozen pnpm lockfile installation, and `git diff --check`. Existing seeded
Agent outputs may truthfully show unavailable provenance when no historical AgentRun or
ContextSnapshot was recorded; newly generated outputs retain real provenance. Package B is
complete. Package C is the next approved package and has not started; Package D has not started.

## Package C — Coherent Golden Demo scenario

Goal:

- create one resettable/loadable, three-department journey across VFX, CG, and department Artists;
- separate Demo, Live ftrack, and development fixture data worlds;
- support Core Anchor Revision 2 and downstream invalidation/regeneration.

## Package D — UX and visual convergence

Goal:

- streamline user journey and terminology after product structure is correct;
- remove duplication;
- improve navigation, hierarchy, affordance, readability, responsiveness, and presentation quality;
- freeze/remove legacy routes only after required capabilities are migrated;
- prepare the final Demo/evaluation path.

Step 9C/9D concepts are absorbed into this broader package rather than pursued as isolated surface
polish before the product journey is repaired.

---

# 17. Delivery method and speed rules

## 17.1 One branch per package

Use one branch for each coherent package. Do not create a new branch for every card, label, or owner
correction.

## 17.2 Three gates per package

```text
Gate 1 — Product/interaction proposal approved
Gate 2 — Implementation complete and owner journey validation passed
Gate 3 — Full regression, documentation update, merge
```

Small corrections remain inside the same package.

## 17.3 Test tiers

### Development loop

Run focused tests for touched services/pages/components and touched-package type/lint checks.

### Package owner-validation gate

Run relevant integration suites plus a coherent package journey.

### Merge gate

Run full repository regression once per package, or use CI as the approved full-regression gate.

Documentation-only changes do not require the full backend/frontend test suites.

## 17.4 Documentation economy

Maintain:

- this baseline;
- one implementation note per package;
- the main roadmap.

Do not create a separate formal closeout document for every minor correction.

## 17.5 Context economy for Codex/Claude

For each task:

- read this baseline;
- read current code and only directly relevant contracts/modules;
- do not reread/re-summarise all Step 1–9 history;
- do not repeatedly prove untouched safety constraints;
- report actual diffs and remaining product gaps.

---

# 18. Test and evaluation target: one Golden Journey

In addition to existing unit/integration coverage, the final product should have one coherent
journey-level validation (automated where practical, owner-validated where visual/human judgement is
required) that covers:

```text
VFX creates/generates and confirms Core Anchor Revision 1
→ three CG department Execution Anchor Drafts become ready
→ CG confirms them
→ three department Artists receive relevant direction/guidance
→ Versions/Review Notes return
→ CG and VFX Agent reviews exist
→ cross-role/cross-department conflict is assessed
→ Signal reaches Re-anchor needed
→ VFX confirms Core Anchor Revision 2
→ downstream Anchors/Guidance become stale or need revision
→ regenerated downstream direction restores Stable
```

This does not replace focused tests. It proves the product concept rather than isolated components.

---

# 19. Non-negotiable constraints during improvement

Preserve:

- three human roles only;
- VFX authority over Core Anchors;
- CG authority over Execution Anchors;
- Artist read/execute/escalate boundary;
- Agent advisory/Draft/Assessment/Proposal status;
- HumanGate and Decision authority;
- immutable/revisioned confirmed history;
- backend authorization;
- Connector isolation;
- read-only ftrack default and controlled write-back policy;
- credential and transient-media safety;
- evidence/provenance links;
- current safe ftrack thumbnail-only truth in the controlled workspace.

Do not:

- create new department authorization roles;
- create separate duplicated department applications;
- let Agents auto-confirm, auto-approve, or auto-resolve;
- hide a missing prerequisite by fabricating data;
- hard-code Golden Demo outcomes into normal services;
- allow Demo reset to touch live data;
- rebuild existing capabilities without first checking current/legacy reuse;
- optimise visual polish before the journey structure is coherent.

---

# 20. Success criteria for the improvement phase

The improvement phase is successful when a new team member can use the current role-aware product
and explain, without reading internal docs:

1. What the current Core Anchor is.
2. Which department Execution Anchor applies.
3. Which Anchor revision a Version/Guidance/Review uses.
4. What each Agent read and produced.
5. What is Production Evidence versus Agent Interpretation versus Human Decision.
6. What action is available now and which role owns it.
7. How Animation, Lighting, and Compositing can each be locally reasonable but globally misaligned.
8. Why Intent Signal changed.
9. Why a Re-anchor Proposal does not automatically change direction.
10. How VFX confirmation of Revision 2 propagates back to CG and Artists.
11. Which data is Golden Demo, live ftrack, or development fixture data.
12. How to complete the Golden Journey from VFX to Artists and back to VFX/CG.

A technically implemented capability that remains undiscoverable in the current product journey is
not considered fully complete.

---

# 21. First implementation boundary

The first task after approving this baseline is **documentation/bootstrap only**:

- add/update root `AGENTS.md` for Codex;
- add this baseline at
  `docs/product-improvement/00_ICAS_PRODUCT_IMPROVEMENT_BASELINE.md`;
- update the main roadmap only enough to record that the product-improvement phase is approved and
  Package A is next;
- make no application, API, schema, Demo Seed, permission, or ftrack change;
- run `git diff --check`, not the full repository test suites.

The first source-code package is Package A, after a separate product/interaction proposal is
approved.

---

# 22. Package A implementation checkpoint (2026-08-03)

**Status:** Package A implementation, owner visual validation, and the final full merge gate are
complete on `feat/package-a-anchor-first-experience`; Package A is complete and merge-ready.

Implemented on the current formal role-aware routes:

- one derived, read-only, role-authorized Anchor Context projection at
  `GET /vfx/shots/{shot_id}/anchor-context`, `GET /cg/tasks/{task_id}/anchor-context`, and
  `GET /artist/tasks/{task_id}/anchor-context`;
- shared `VfxShotWorkspaceFrame`, `CgTaskWorkspaceFrame`, and `ArtistTaskWorkspaceFrame`
  ownership of breadcrumbs, object context header, persistent compact/expandable Anchor Context,
  tabs, unavailable/not-found handling, spacing, and the page-content slot;
- migration of all 13 formal Shot/Task routes to those frames without changing paths, sidebar
  structure, tab names, or role boundaries;
- role-specific VFX authority, CG Core-to-Execution relationship, and Artist WHY/HOW/WHAT TO DO
  NOW presentations, including confirmed-versus-Draft distinction and truthful Execution Draft
  source rendering;
- only the real `low` / `medium` / `high` Intent Signal states plus `not_assessed`; missing Signal
  data is never treated as low;
- Anchor-aware Home, Review Inbox, and Shot/Task catalogue summaries without placing one global
  Anchor layer on multi-object pages; formal VFX escalations are counted only from real unresolved
  `TaskDependency(kind="escalation")` records, never inferred from high attention;
- actionable no-Version and assessment-not-ready states that explain current prerequisites and use
  real routes, with no fake upload or autonomous action.

Current data-model constraints are represented explicitly rather than filled with synthetic copy:

- a confirmed Execution revision's stored `core_anchor_revision_id` proves its upstream Core
  revision; when that row cannot be resolved, the relationship is `relationship_unavailable`;
- there is no persisted Demo/fixture provenance discriminator for an Execution Draft, so the UI
  never guesses that source. It reports Agent-proposed, human-created, or copied-from-prior only
  when stored provenance proves it, otherwise `unknown`;
- Home, Inbox, and catalogue pages now use role-authorized, bounded compact aggregate reads at
  `GET /vfx/anchor-contexts`, `GET /cg/anchor-contexts`, and
  `GET /artist/anchor-contexts`; the browser no longer issues one full Anchor Context request per
  row, and no persistence cache was introduced.

The owner-validation correction strengthens the approved interaction without changing the domain:

- object Overview routes default the Anchor Context to expanded, other tabs default it to compact,
  and an explicit accessible disclosure control remembers the user's role/object choice only in
  browser session storage;
- VFX and CG Home lead with at most five backend-ordered Anchor actions, then scope health, then
  browse/resume entry points; no arbitrary first object is presented as the Workspace Anchor;
- Artist Home separates proven `ready_to_work` Tasks from `waiting_upstream` Tasks and shows the
  large WHY/HOW/WHAT briefing only when exactly one ready Task is proven;
- Inbox/catalogue rows separate Anchor, direction, attention/readiness, next action, and secondary
  production context, using backend action labels and direct routes where available;
- the old Overview Working Direction presentation is a load-failure fallback only, so a normally
  loaded expanded Anchor briefing is not duplicated below it;
- `No immediate review action`, missing direction, missing Guidance, and `not_assessed` attention
  are distinct read-model states rather than contradictory copy.

The correction has its own focused validation across the aggregate reads, disclosure/session
interaction, three Homes, row hierarchy, Overview de-duplication, and affected route loaders,
alongside touched-package lint/type/format checks. The project owner subsequently confirmed the
Package A visual checklist (VFX/CG/Artist Overview, Home, Inbox, catalogue, Anchor expansion,
readiness, and attention behavior). The final merge gate then passed 1,138 backend tests, 1,017
frontend tests, the production web build, Ruff format/check, mypy, Python and TypeScript contract
checks, web typecheck, ESLint, Prettier, lockfile checks, and `git diff --check`.

Package A is complete. Package B — Visible Agent journey completion — is the next approved
package and has not started. Packages C and D have not started.
