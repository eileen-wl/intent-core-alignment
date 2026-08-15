# ICAS DESIGN.md v0.1

> **Intent Core Alignment System — Implementation-Preflight Visual Design Guidance**
>
> **Status:** Frozen implementation baseline  
> **Purpose:** This document defines the visual and interaction principles that all subsequent ICAS page redesigns, skills, audits, and Claude Code implementations must follow.  
> **Scope:** Global design direction only. It is **not** a page-by-page implementation log and should **not** be updated after every page iteration.  
> **Change rule:** Only revise this document if the **global product design direction itself changes**. Page-specific structure belongs in separate implementation briefs.

---

# 1. Why this document exists

ICAS has already gone through multiple rounds of functional UI construction, UX cleanup, visual adjustment, and page-level refinement. The current product is functionally rich, but repeated visual iteration has exposed a structural problem:

- visual hierarchy is inconsistent across pages;
- large information blocks often have similar visual weight;
- Anchor Context can dominate the task itself;
- Agent output can visually outweigh the Human action that actually matters;
- evidence, interpretation, history, metadata, and decisions are often rendered as equally prominent vertical sections;
- long prose and repeated card structures create reading fatigue;
- pages belonging to the same product do not yet feel governed by a deliberate visual language.

The next phase must therefore **stop treating visual improvement as a sequence of isolated CSS fixes**.

This document establishes a single visual design baseline before implementation continues.

All later work should answer:

> **What should the user notice first, understand second, and inspect only when needed?**

The goal is not to make ICAS “prettier.”  
The goal is to make ICAS **more legible as a professional production decision system**.

---

# 2. Product visual positioning

## 2.1 Core direction

ICAS should be designed as a:

> **Dark Precision Production Workspace**

The intended product qualities are:

- professional;
- production-grade;
- calm;
- precise;
- high-information but controlled;
- serious rather than playful;
- intelligent without looking “AI-themed”;
- visually compatible with professional VFX production environments;
- clearly distinct from generic SaaS dashboards.

ICAS should feel like a tool that a VFX professional could keep open for long periods while working.

---

## 2.2 Relationship to ftrack

ftrack is the first workflow connector and an important environmental reference.

ICAS should therefore be:

> **ftrack-adjacent, not ftrack-cloned**

The transition from ftrack into ICAS should feel visually continuous rather than like entering an unrelated consumer web product.

ICAS may borrow from ftrack:

- dark graphite workspace surfaces;
- compact professional typography;
- restrained status colors;
- dense but scannable information presentation;
- side navigation conventions;
- selected-object emphasis;
- panel-based contextual information;
- low-decoration production-tool aesthetics.

ICAS must **not** copy:

- ftrack's information architecture;
- its exact component styling;
- its color/status system;
- its layout as a whole;
- its role as a production tracker.

ICAS exists because it adds a layer that ftrack does not own:

- shared creative intent;
- Core Anchor / Execution Anchor relationships;
- cross-role alignment;
- Human authority;
- Agent interpretation;
- re-anchor support;
- provenance for intent-related reasoning.

The visual design must make those ICAS-specific concepts clearer, not hide them inside a generic tracking interface.

---

# 3. Visual reference roles

The following products are references for **specific strengths**, not templates to copy.

## 3.1 ftrack — production environment baseline

Borrow:

- dark professional workspace atmosphere;
- compact navigation;
- task/shot-centric information density;
- subtle panel separation;
- restrained status indicators;
- reduced decorative UI.

Do not borrow:

- its exact page structure;
- its exact status palette;
- its production-tracking IA as a substitute for ICAS's intent architecture.

---

## 3.2 Frame.io — review focus and contextual information

Borrow:

- clear separation between the object being reviewed and supporting context;
- stable contextual panels;
- feedback/review information organized around the current object;
- progressive disclosure for supporting detail;
- ability to keep the review target visually dominant.

Do not turn ICAS into a media-player interface.

---

## 3.3 Autodesk Flow Production Tracking / ShotGrid — dense production information

Borrow:

- mature worklist logic;
- compact metadata;
- production-state scanning;
- high-density views without excessive decorative card layouts.

Do not allow ICAS to become a database-style tracker where all information has equal visual weight.

---

## 3.4 DaVinci Resolve — task-specific workspaces

Borrow the principle that:

> Different professional tasks may require different page structures while still belonging to the same product.

ICAS pages do **not** need identical layouts.

Consistency should come from:

- typography;
- surface hierarchy;
- spacing;
- state language;
- interaction patterns;
- shared components;
- color semantics;
- hierarchy rules.

Not from forcing every page into the same template.

---

## 3.5 Linear — worklist scanning and filtering

Borrow:

- compact filter controls;
- clear grouping;
- strong scanability;
- low-visual-weight metadata;
- efficient list narrowing.

Do not use Linear as the overall visual personality for ICAS.

---

# 4. Fundamental hierarchy

ICAS contains several fundamentally different types of information.

They must **not** be given equal visual weight.

The default hierarchy is:

1. **Human Action**
2. **Current State**
3. **Intent / Anchor Context**
4. **Agent Interpretation**
5. **Production Evidence**
6. **History**
7. **Provenance**

Conceptually:

```text
Human Action      ██████████
Current State     ████████
Intent / Anchor   ██████
Agent             ████
Evidence          ███
History           ██
Provenance        █
```

This hierarchy is global.

Individual pages may alter emphasis slightly depending on task, but should never invert it without a strong reason.

---

# 5. Human, Agent, Evidence, and History must look different

ICAS should develop a stable visual grammar so the user can recognize the **nature of information before reading it**.

## 5.1 Human

Human-owned decisions and actions are authoritative.

Human UI should feel:

- direct;
- actionable;
- visually stronger;
- clearly separated from advisory Agent output;
- intentional, not decorative.

Human-controlled actions include:

- confirm;
- revise;
- acknowledge;
- reject;
- escalate;
- resolve;
- create a new authoritative revision.

Primary Human actions should receive the clearest interactive emphasis.

---

## 5.2 Agent

Agent output is advisory.

Agent UI should feel:

- lighter than Human action;
- interpretive rather than authoritative;
- inspectable;
- useful but secondary;
- clearly labelled by capability when relevant.

Avoid visually implying that an Agent recommendation is already a decision.

Do not use excessive:

- gradients;
- glow effects;
- “AI magic” styling;
- decorative purple surfaces;
- futuristic visual tropes.

Agent value should come from the quality of interpretation, not from visual spectacle.

---

## 5.3 Evidence

Evidence is factual production context.

Evidence should feel:

- neutral;
- structured;
- inspectable;
- lower-emphasis than the decision/action it supports.

Evidence should not automatically become a large card just because it exists.

Prefer:

- compact rows;
- summaries;
- tables;
- inline metadata;
- expandable evidence sections.

---

## 5.4 History

History should be available without competing with current work.

Default treatment:

- muted;
- compact;
- collapsed when long;
- chronological;
- clearly labelled as historical.

Current and historical content must never look identical.

---

## 5.5 Provenance

Provenance is important for trust, but rarely needs to dominate the default viewport.

Default treatment:

- on-demand;
- disclosure / expandable detail;
- compact;
- factual;
- visually quiet.

Provenance should remain available without becoming a primary page section unless the user's current task is explicitly provenance review.

---

# 6. Page archetype system

ICAS should be treated as **six structural page families plus one history sub-pattern**, not as a collection of unrelated pages.

These archetypes define the user's primary task and information hierarchy. They do **not** prescribe identical layouts.

---

## 6.1 Worklist Archetype

### Representative pages

- Review Inbox

### User goal

> Find what needs attention and enter the right work quickly.

### Priority order

1. What is the work item?
2. Why does it need attention?
3. What is its current state?
4. What is the next action?
5. Supporting production context

### Design principles

- optimize for scanning;
- filtering must be compact and useful;
- grouping should clarify, not dominate;
- avoid five or more equally weighted columns;
- avoid large repeated grey cards;
- metadata should be secondary;
- the CTA should be obvious without being visually detached from the item.

### Work-item structure should usually prioritize

```text
Type / attention
Title
Short reason
Compact context
Primary next action
```

Detailed Anchor/Version metadata can be expanded or shown as secondary content.

---

## 6.2 Workspace / Orientation Archetype

### Representative pages

- Workspace Home (VFX, CG, Artist)

### User goal

> Understand the current state of my role's work, identify the most important focus, and enter the right work surface.

### Core principles

- synthesis before enumeration;
- cross-object state, not deep object detail;
- maximum 1 Primary Focus + up to 2 secondary named objects;
- remaining work represented as aggregate state + routes, never a full queue;
- no full queue;
- no full object catalogue;
- no full Anchor / Version / Guidance / Dependency detail;
- role-specific primary surface: VFX = creative attention; CG = execution readiness; Artist = personal execution orientation.

---

## 6.3 Object Browser / Catalogue Archetype

### Representative pages

- VFX Shots
- CG Tasks
- Artist Tasks

### User goal

> Recognize, compare, filter, and enter production objects.

### Priority order

1. Object identity
2. Comparable object state
3. Production context
4. Neutral enter-object affordance

### Design principles

- object-first, never reason/action-first;
- no "why this needs you" framing;
- no full `AnchorContextSummary`;
- no deep Overview content;
- compact states/counts are allowed;
- neutral affordance wording (e.g. "Open Shot" / "Open Task");
- role-specific grammar is allowed;
- do not force identical cards/rows across Shot and Task types.

---

## 6.4 Decision Archetype

### Representative pages

- VFX Alignment
- VFX Intent
- CG Dependencies

### User goal

> Understand a meaningful issue and make or prepare a Human judgement.

### Priority order

1. What decision/interpretation is needed?
2. What is the current state?
3. What is the key conflict/risk?
4. What does the Agent infer?
5. What evidence supports it?
6. What historical context matters?

### Design principles

- create a clear **Decision Workspace**, not a report;
- Human Attention must remain visually central;
- key findings should be summarized before detailed reasoning;
- supporting evidence belongs in secondary context or disclosures;
- History must not compete with current judgement;
- Anchor Context should act as guardrail/context, not the page's visual protagonist.

---

## 6.5 Review Archetype

### Representative pages

- CG Version Review
- VFX Versions
- future review-oriented pages

### User goal

> Inspect a specific production object, understand interpretation/review, and respond.

### Priority order

1. Current object under review
2. Review state
3. Production evidence summary
4. Agent review summary
5. Human response/action
6. Detailed reasoning and provenance

### Design principles

- preserve focus on the selected Version/object;
- version/object selectors should remain stable;
- Agent output should first appear as a concise review summary;
- detailed reasoning should be expandable;
- Human response should remain visible and easy to reach;
- supporting context can live in a contextual side region or disclosure.

Avoid turning review pages into long documents.

---

## 6.6 Work Archetype

### Representative pages

- Artist Current Version
- CG Execution
- Task Overview
- VFX Overview when primarily task-oriented

### User goal

> Understand what to do now and continue production work.

### Priority order

1. What do I need to do now?
2. What must remain fixed?
3. What may vary?
4. What current production object am I working on?
5. What should trigger escalation?
6. Supporting Anchor/history context

### Design principles

The page should start from the user's active task, not from a large explanation of the system.

Artist-facing pages in particular should prioritize:

```text
What to do now
What must remain fixed
What may vary
What to watch
Where to escalate
```

Anchor Context should serve as a guardrail.

It should not force the Artist to read the entire intent hierarchy before they can act.

---

## 6.7 History Sub-pattern

### Representative pages/sections

- Activity
- Feedback History
- Assessment History
- Revision History

### User goal

> Understand how the current state came to exist.

### Principles

- chronological;
- compact;
- lower contrast than current work;
- current/historical clearly distinguished;
- show meaningful transitions rather than every fact with equal weight;
- support drill-down into evidence/provenance.

History is a supporting pattern, not a main workspace type of its own.

---

# 7. Dark visual system

Exact colors should be implemented through design tokens and can be tuned during visual implementation.

This document locks the **role of each layer**, not arbitrary hexadecimal values.

---

## 7.1 Surface hierarchy

Use multiple luminance levels rather than heavy borders.

### Layer 0 — Canvas

Deep charcoal.

Purpose:

- overall workspace background;
- reduces eye strain;
- establishes continuity with professional VFX tools.

### Layer 1 — Navigation / persistent chrome

Clearly distinct from Canvas by one luminance step.

Used for:

- sidebar;
- top navigation;
- persistent product chrome.

### Layer 2 — Working surface

Graphite surface for the primary task area.

### Layer 3 — Raised / selected / focused surface

Slightly brighter than the working surface.

Used selectively for:

- current selection;
- active review object;
- Human action area;
- focused inspector content.

### Divider

Very subtle.

Prefer:

- luminance contrast;
- spacing;
- alignment;

before adding visible borders.

---

## 7.2 Avoid "dark-mode card soup"

Simply converting every existing white card to dark grey is not acceptable.

Do not create:

```text
dark canvas
  grey card
    lighter grey card
      bordered inner card
```

Use cards only when the information genuinely needs a contained surface.

Otherwise prefer:

- sections;
- dividers;
- rows;
- inline metadata;
- whitespace;
- typography hierarchy.

---

# 8. Color semantics

Color is functional, not decorative.

---

## 8.1 ICAS Purple

Purple represents:

- current selection;
- Intent-related emphasis;
- primary Human action;
- active navigation/tab;
- intentional focus.

Purple does **not** mean:

- “AI”;
- decoration;
- novelty;
- generic highlight.

Avoid large purple gradients or glowing surfaces.

---

## 8.2 Attention colors

### Amber

Medium attention / needs interpretation.

Use in small, controlled areas:

- status chip;
- indicator;
- small emphasis;
- border/accent if needed.

Do not fill entire sections amber.

### Red

High attention / blocked / urgent.

Reserve for genuine urgency.

Avoid using red for ordinary validation feedback or non-critical states.

---

## 8.3 Green

Use for:

- confirmed;
- completed;
- successfully resolved.

Green should remain restrained and should not visually dominate a page.

---

## 8.4 Blue / cyan

Use for:

- external links;
- informational states;
- linked external production entities where appropriate.

Do not compete with ICAS purple for primary interaction.

---

# 9. Typography

Typography should support dense professional reading.

## Principles

- compact;
- neutral;
- highly legible;
- no oversized marketing headings;
- strong hierarchy through weight, size, spacing, and contrast;
- sentence case preferred for most interface labels;
- uppercase only for small metadata/category labels where useful.

### Hierarchy

Use a limited number of levels.

Suggested roles:

- Page / object title
- Section title
- Primary task statement
- Body / working information
- Metadata
- Supporting / historical text

Avoid having every card create another heading hierarchy.

---

# 10. Information density

ICAS should not become sparse.

Target:

> **Medium-high professional information density**

The problem is not “too much information exists.”

The problem is when all information is visible at the same time with equal weight.

Solve complexity through:

> **progressive disclosure**

not through deleting valid domain information.

---

# 11. Progressive disclosure rules

Default visible:

- current state;
- current task;
- Human action;
- key Agent conclusion;
- highest-value risks/findings;
- active production object.

Secondary / expandable:

- detailed Agent reasoning;
- full evidence lists;
- provenance;
- raw model metadata;
- historical assessments;
- older guidance;
- superseded versions;
- extended Anchor details.

A user should be able to understand the page before opening any disclosure.

---

# 12. Anchor Context

Anchor Context is a critical ICAS capability, but should not dominate every page.

## Role

Anchor Context answers:

> What intent and execution boundaries govern the work I am looking at?

It should not become:

> The largest visual block on every page.

## Principles

- show a compact current-state summary first;
- expand into deeper context only when needed;
- page-specific primary task must remain dominant;
- avoid repeating the same Core/Execution facts elsewhere on the same page;
- no empty headings such as “Related Context” when no content exists;
- large expanded context panels should scroll normally;
- persistent/sticky context should remain compact.

---

# 13. Current State

Every task page should make the current production state understandable quickly.

A current-state presentation may combine:

- current Core Anchor revision;
- current Execution Anchor revision;
- current Version;
- attention;
- readiness;
- guidance/review state.

But it should be a **compact state rail or summary**, not a giant dashboard.

Avoid repeating current-state facts across multiple sections.

---

# 14. Human Action

Human action is one of the most important ICAS differentiators.

Whenever Human input is required:

- state clearly what the Human is deciding;
- explain why the action is needed;
- put the primary action near that explanation;
- visually distinguish Human authority from Agent recommendation.

Avoid placing the primary Human action only after several screens of evidence.

When possible:

```text
Issue
→ concise interpretation
→ Human action
→ supporting detail
```

rather than:

```text
Anchor
→ Evidence
→ Agent
→ More Agent
→ History
→ Metadata
→ Human action
```

---

# 15. Agent Interpretation

Agent interpretation should answer a concrete user question.

Examples:

- What changed?
- What appears misaligned?
- What risks are present?
- Why might the current execution be problematic?
- What should be reviewed?

Default presentation should favor:

- executive summary;
- count/status summary;
- key findings;
- recommendation.

Detailed reasoning should normally be expandable.

Do not dump long Agent-generated prose into the default viewport unless it is the user's explicit task.

---

# 16. Evidence presentation

Evidence should be tied to the question it supports.

Prefer:

- concise summaries;
- source labels;
- department grouping;
- current/historical indicators;
- row-based presentation;
- expandable detail.

Avoid duplicating the same Anchor/Version facts both in Anchor Context and Evidence.

---

# 17. Worklists, filters, and grouping

Filters should help the user narrow work without becoming the page's visual centerpiece.

## Principles

- Project filter should remain visible where meaningful;
- role-specific state filters should reflect the worklist's actual domain;
- filters should be compact;
- grouping should reflect honest item categories;
- group headings should be low-to-medium visual weight;
- result count should update truthfully;
- metadata should not overpower item title/reason;
- primary action should be connected visually to the work item.

Avoid large equal-width five-column panels for every item.

---

# 18. Metadata

Metadata should usually be:

- inline;
- compact;
- muted;
- scan-friendly.

Examples:

```text
Shot 010 · Compositing Review · Comp V2 · Confirmed
```

instead of placing every metadata field in a dedicated card or column.

---

# 19. Current vs historical content

Current and historical information must have distinct treatments.

## Current

- higher contrast;
- stronger state indicator;
- closer to current Human task.

## Historical

- muted;
- lower surface priority;
- often collapsed;
- labelled Historical / Superseded / Previous;
- never visually mistaken for current guidance/assessment/revision.

Immutable historical records should not be destructively rewritten for visual convenience.

---

# 20. Navigation and page identity

A user should always understand:

- which role they are in;
- which Project / Shot / Task they are in;
- which object/version is current;
- which workspace/tab they are using.

Breadcrumb/context text should be compact.

Avoid oversized breadcrumbs that compete with the actual page title.

Active navigation should use the ICAS purple system consistently.

---

# 21. Interaction principles

ICAS should feel stable and production-oriented.

Prefer:

- immediate state changes;
- explicit confirmation when authority changes;
- predictable disclosure;
- stable navigation;
- compact hover/focus feedback.

Avoid:

- decorative motion;
- gratuitous transitions;
- “AI thinking” animations unless there is a genuine wait state;
- hidden critical actions;
- surprising page reflows.

---

# 22. Responsive / viewport principle

Primary target remains desktop production use.

The design should prioritize:

- 1440–1920px desktop widths;
- efficient multi-column use where appropriate;
- no unnecessary giant central column with wasted side space;
- readable line lengths;
- stable side navigation.

Long-form content should not simply stretch across the full viewport.

---

# 23. Page-specific structure is allowed to differ

Consistency does **not** mean every page uses:

- the same number of columns;
- the same card layout;
- the same first section;
- the same placement of Agent output.

The four archetypes have different jobs.

A Review page may use:

```text
object list | selected review
```

A Decision page may use:

```text
decision canvas | context inspector
```

A Work page may use:

```text
what to do now
constraints
current production object
```

A Worklist may use:

```text
filters
grouped rows
```

This variation is intentional.

---

# 24. Shared visual components

The implementation should aim to reuse shared visual patterns where semantics match.

Candidate shared patterns include:

- Page / Object Header
- Current State Rail
- Attention chip
- Anchor Context summary
- Context Inspector
- Human Attention / Human Action block
- Agent Advisory block
- Evidence disclosure
- History disclosure
- Work-item row
- Filter bar
- Metadata line
- Current / Historical indicator
- Empty state
- Provenance disclosure

Reuse should follow semantic consistency.

Do not force reuse if it makes different archetypes harder to understand.

---

# 25. Anti-patterns / prohibited directions

The following should be treated as explicit design warnings.

## 25.1 Card-in-card

Avoid nested boxed surfaces unless hierarchy genuinely requires containment.

---

## 25.2 Equal visual weight

Do not make:

- Anchor;
- Agent;
- Evidence;
- History;
- Human Action;

all look equally important.

---

## 25.3 Agent-first hierarchy

Agent output must not visually dominate an action owned by a Human.

---

## 25.4 Long prose by default

Do not render every Agent output, evidence explanation, or history item fully expanded.

---

## 25.5 AI decoration

No:

- purple glow;
- AI gradients;
- magical sparkle motifs;
- futuristic “assistant” styling;

unless a later explicit brand decision changes this.

---

## 25.6 Generic SaaS dashboard aesthetic

Avoid:

- oversized KPI cards;
- excessive rounded cards;
- marketing-style whitespace;
- decorative hero sections;
- consumer app visual language.

ICAS is a production workspace.

---

## 25.7 ftrack cloning

Do not copy ftrack's interface as the ICAS interface.

Visual continuity is desirable. Product identity must remain distinct.

---

## 25.8 Deleting domain information for visual simplicity

Never remove valid:

- evidence;
- provenance;
- history;
- authority information;
- intent constraints;

simply because a page feels dense.

Use hierarchy and disclosure instead.

---

## 25.9 Implementation labels in user-facing copy

Do not expose labels such as:

- deterministic generator names;
- fixture/debug names;
- internal implementation tags;
- development-only prefixes;

in normal product UI.

---

## 25.10 New visual components without a semantic role

Do not add a card, panel, badge, chip, icon, or divider simply to “make the page look designed.”

Every element must communicate:

- hierarchy;
- state;
- relationship;
- action;
- provenance;
- navigation;
- grouping.

---

# 26. Skill usage rules

This file is the visual authority that all skills should receive before operating.

Skills may support the design process, but they do not own the product direction.

---

## 26.1 Hallmark

Use for:

- critique of a proposed page structure;
- identifying structural clutter;
- evaluating whether the page still reads like a long report;
- suggesting restructuring within the constraints of the relevant page brief.

Do **not** ask Hallmark to freely redesign ICAS from scratch after a Human-approved structure already exists.

Human-approved structure wins.

---

## 26.2 Impeccable

Use for:

- visual implementation critique;
- hierarchy;
- spacing;
- consistency;
- accessibility;
- typography;
- dark-theme quality;
- final polish.

A detector-clean result is **not** evidence that the design is successful.

Human visual review is still required.

---

## 26.3 Taste Skill

Do not use early in structural design.

Use later for:

- density tuning;
- visual rhythm;
- controlled refinement;

after the page hierarchy and structure are already correct.

Taste must not be used to compensate for incorrect information architecture.

---

## 26.4 Web Design Guidelines

Use as:

- implementation quality / accessibility / interaction guardrails.

Do not treat guideline compliance as a substitute for intentional visual hierarchy.

---

# 27. Claude Code implementation rules

Claude Code is the implementation tool, not the autonomous visual designer.

Before implementing any representative archetype page, Claude Code should receive:

1. this `ICAS DESIGN.md v0.1`;
2. the page-specific implementation brief;
3. the Human-approved visual / structural reference;
4. explicit non-regression constraints.

For major representative pages, implementation should follow this sequence:

```text
Human-approved design
        ↓
Claude code/component mapping
        ↓
Hallmark critique of mapping if needed
        ↓
Human review
        ↓
Structural implementation only
        ↓
Owner screenshot/video validation
        ↓
Dark visual styling
        ↓
Owner review
        ↓
Impeccable implementation critique/polish
        ↓
Final owner validation
```

Claude Code must not silently:

- change domain logic;
- rewrite journey semantics;
- remove evidence;
- remove authority/provenance;
- invent new workflow;
- change current/historical semantics;
- change task/shot/version identity;
- create new state transitions;
- reinterpret product requirements;

for the sake of visual redesign.

---

# 28. Representative archetypes for implementation

The first representative page for each archetype is:

| Archetype | Representative page |
|---|---|
| Worklist | VFX Review Inbox |
| Workspace / Orientation | VFX Workspace Home |
| Object Browser / Catalogue | VFX Shots |
| Decision | VFX Alignment |
| Review | CG Version Review |
| Work | Artist Current Version |

These pages are not the only pages in each family.

They are the first design references from which shared visual patterns may later be reused.

The individual page structure belongs in separate briefs and should **not** be added to this global document.

---

# 29. Acceptance criteria for visual convergence

A redesigned page should not be considered complete simply because:

- tests pass;
- lint is clean;
- a skill reports no issues;
- the page is dark;
- all content is present.

Owner review should be able to answer **yes** to the following:

### Hierarchy

- Can I identify the page's primary task within a few seconds?
- Is the Human-owned action visually stronger than supporting Agent output?
- Is current state obvious?
- Is supporting information visibly secondary?

### Density

- Is the page information-rich without feeling like one continuous document?
- Are long supporting details collapsed where appropriate?
- Are repeated facts removed or consolidated?

### Production feel

- Does the page feel compatible with a professional VFX production environment?
- Does the dark UI feel intentional rather than like an inverted light theme?
- Are surfaces separated without excessive cards and borders?

### ICAS identity

- Is Intent visibly present without dominating every page?
- Can I distinguish Human authority, Agent advice, Evidence, and History?
- Does the page feel different from a generic project tracker?

### Workflow

- Can I understand what to do next?
- Can I inspect more detail without losing my place?
- Can I understand current vs historical state?
- Does the page preserve truthful production and provenance information?

If these questions are not answered clearly, the page is not visually complete.

---

# 30. Frozen principles

The following are considered locked for this implementation phase:

1. ICAS is a **Dark Precision Production Workspace**.
2. ICAS should feel visually adjacent to ftrack but must not clone it.
3. Human authority is visually stronger than Agent advice.
4. Current state is more prominent than history.
5. Evidence supports decisions; it does not compete with them.
6. Provenance is available on demand.
7. The product targets medium-high information density.
8. Complexity is managed through hierarchy and progressive disclosure, not destructive simplification.
9. The system uses six page archetypes: Worklist, Workspace / Orientation, Object Browser / Catalogue, Decision, Review, Work.
10. Different archetypes may use different page structures.
11. Shared semantics should use shared visual components.
12. Purple is reserved for current/selected/Intent/primary Human action, not generic AI decoration.
13. Dark UI must use luminance hierarchy rather than card-and-border accumulation.
14. Representative pages are designed and validated before their patterns are extended across the product.
15. Skills assist the Human-approved design direction; they do not replace it.
16. Claude Code implements approved design; it does not independently determine visual product direction.
17. This file is an **implementation-preflight baseline**, not a running implementation diary.

---

# 31. Document maintenance rule

This document should now be treated as frozen.

Do **not** update it after:

- every page redesign;
- every visual polish pass;
- every skill critique;
- every implementation commit.

Page-specific decisions belong in page briefs.

A future revision such as `ICAS DESIGN.md v0.2` is only justified if the team deliberately changes a global principle such as:

- dark vs light product direction;
- Human/Agent visual hierarchy;
- page archetype model;
- shared color semantics;
- global density philosophy;
- relationship to ftrack.

Otherwise, this file remains the stable design baseline for the visual implementation phase.
