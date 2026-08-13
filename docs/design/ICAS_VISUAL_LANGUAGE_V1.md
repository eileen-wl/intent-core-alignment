# ICAS Visual Language v1

> **Intent Core Alignment System — Shared Visual Language Implementation Layer**
>
> **Status:** Visual-language implementation baseline for representative archetype refinement  
> **Parent authority:** `docs/design/ICAS_DESIGN.md`  
> **Purpose:** Define the reusable visual grammar that turns structurally-correct ICAS pages into a coherent professional production workspace without changing domain logic, information architecture, authority semantics, or workflow behavior.
>
> **Important:** This document supplements `ICAS_DESIGN.md`. It does **not** replace it. If the two documents ever conflict, `ICAS_DESIGN.md` wins.

---

# 1. Why this document exists

The first Visual Convergence work established the correct structural and semantic hierarchy for representative pages:

- VFX Alignment — Decision Archetype;
- CG Version Review — Review Archetype.

Those pages are now substantially clearer in terms of:

- current object / current state;
- Human authority;
- Agent advisory output;
- Production Evidence;
- progressive disclosure;
- History;
- dark surface hierarchy;
- truthful current vs historical semantics.

However, a second problem remains:

> too much of the interface is still encoded only through text, uppercase labels, rectangular surfaces, status chips, and prose.

This creates a “well-organised report” feeling rather than a mature production workspace.

Visual Language v1 therefore adds a second layer of information encoding:

- **object identity**;
- **authority identity**;
- **semantic icons**;
- **signal strips**;
- **section hierarchy**;
- **row/object grammar**;
- **surface discipline**;
- **production-oriented scanability**.

The goal is not decoration.

The goal is:

> **Users should be able to identify the type, authority, state, and importance of information before reading every word.**

---

# 2. Frozen parent principles

Visual Language v1 must preserve all frozen ICAS design principles.

ICAS remains a:

> **Dark Precision Production Workspace**

The product must remain:

- professional;
- production-grade;
- calm;
- precise;
- medium-high information density;
- serious rather than playful;
- visually adjacent to professional VFX tools;
- distinct from generic SaaS dashboards;
- intelligent without using “AI-themed” visual spectacle.

The global hierarchy remains:

1. Human Action
2. Current State
3. Intent / Anchor Context
4. Agent Interpretation
5. Production Evidence
6. History
7. Provenance

Visual Language v1 must reinforce this hierarchy, not replace it.

---

# 3. Visual-language objectives

Visual Language v1 should solve five system-level problems.

## 3.1 Object recognition

A Version, Anchor, Review Note, Assessment, Dependency, and Evidence item should not all look like ordinary text.

Users should be able to recognise important production objects through stable visual markers.

## 3.2 Authority recognition

Human, Agent, Evidence, and History should not rely only on heading copy to distinguish themselves.

Their visual identity should be recognisable before detailed reading.

## 3.3 Signal scanning

Counts and attention indicators should not always be written as prose sentences.

Where structured counts exist, use compact production-signal presentation.

## 3.4 Section recognition

Not every hierarchy level should use the same uppercase text label.

Page regions, functional subgroups, and metadata must have visibly different grammars.

## 3.5 Surface reduction

Visual hierarchy should rely more on:

- luminance;
- spacing;
- alignment;
- icon anchors;
- row rhythm;
- subtle separators;
- object markers;

and less on:

- repeated grey rectangles;
- nested cards;
- borders around every section.

---

# 4. Icon system

## 4.1 Style

ICAS icons should use one restrained technical icon language.

Preferred characteristics:

- monoline;
- approximately 1.5 px stroke at normal UI scale;
- rounded or neutral line endings;
- geometric;
- precise;
- low-decoration;
- no filled illustrative icons;
- no emoji;
- no 3D;
- no multicolour iconography;
- no hand-drawn style;
- no “AI sparkle” motifs;
- no glowing icon containers.

A Lucide / Phosphor-Regular-like visual character is appropriate.

Implementation rule:

> First inspect the repository for an existing icon library. Reuse it if appropriate. Do not install a new icon dependency without explicit Owner approval.

Icons should normally inherit `currentColor`.

---

## 4.2 Icon sizes

Use a small number of stable sizes.

### Micro glyph
Approx. `12–14px`

Use for:

- signal strips;
- status markers;
- compact inline object identity;
- small secondary metadata.

### Standard semantic icon
Approx. `16px`

Use for:

- object identity;
- authority identity;
- compact section headers;
- buttons where the icon communicates a real action.

### Region icon
Approx. `18px`

Use sparingly for major semantic regions such as:

- Production Evidence;
- Agent Review;
- Human Authority;
- Version Review;
- Assessment History.

Avoid large decorative icons.

---

# 5. Object grammar

Important domain objects should receive stable semantic icons throughout ICAS.

The exact glyph may depend on the available icon library, but the **semantic mapping must remain stable**.

| Domain object | Preferred icon concept | Meaning |
|---|---|---|
| Core Anchor / Intent | Target / Focus / Crosshair | shared creative direction |
| Execution Anchor | Sliders / Route / Constraint | department execution boundary |
| Version | Layers / Frames / Stack | production Version |
| Review | Scan / Inspect / Search-check | review activity |
| Review Note | Message-square-text / Note | Human review feedback |
| Assessment | Radar / Scan-search / Gauge | structured assessment |
| Dependency | Link / Network / Git-branch | dependency or coordination relation |
| Evidence | File-search / Document-search | factual production evidence |
| Provenance | Fingerprint / Git-commit / Trace | source and reasoning trace |
| History | History / Clock / Timeline | historical state |
| Task | Square-check / Workflow item | production Task |
| Shot | Frame / Film / Viewfinder | production Shot |

Do not casually substitute a different icon for the same object on different pages.

---

## 5.1 Object-marker structure

A compact object marker may use:

```text
[icon] Object name
       secondary state / context
```

or:

```text
[icon] Object name   [state]
```

Do not automatically wrap every object marker in a card.

Use an object marker when it helps the user understand:

- what object this is;
- whether it is selected/current/historical;
- how it relates to the current task.

---

# 6. Authority grammar

Authority is an ICAS-specific visual differentiator.

## 6.1 Human

Human-owned information is authoritative.

Visual characteristics:

- strongest relevant typography;
- slightly stronger luminance when action is required;
- clear Human semantic icon;
- primary Human action may use ICAS purple;
- avoid decorative colour blocks.

Preferred icon concept:

- `UserCheck`;
- `UserRoundCheck`;
- equivalent Human-authority glyph.

Example:

```text
[human icon] Human authority
```

Human action must remain stronger than supporting Agent detail.

---

## 6.2 Agent

Agent output is advisory.

Visual characteristics:

- steel / cool-grey advisory identity;
- lower visual weight than Human action;
- no purple “AI” identity;
- concise first-reading summary;
- detailed reasoning behind disclosure.

Preferred icon concept:

- `ScanSearch`;
- `Radar`;
- `Bot` only if it reads professional and not playful;
- another neutral analysis/advisory glyph.

Example:

```text
[advisory icon] CG Agent Review
```

Do not use sparkle, magic, glow, or futuristic assistant styling.

---

## 6.3 Evidence

Evidence is neutral factual context.

Visual characteristics:

- neutral graphite surface or open canvas;
- compact metadata;
- lower-emphasis than Agent conclusion and Human action;
- source-oriented icon;
- row/list treatment where possible.

Preferred icon concept:

- `FileSearch`;
- `FileText`;
- equivalent evidence/document glyph.

Example:

```text
[evidence icon] Production Evidence
```

---

## 6.4 History

History is supporting context.

Visual characteristics:

- muted;
- compact;
- chronological;
- lower contrast than current work;
- no raised current-state treatment.

Preferred icon concept:

- `History`;
- `Clock3`;
- equivalent timeline glyph.

---

## 6.5 Provenance

Provenance is trust/support information.

Visual characteristics:

- quiet;
- on-demand;
- disclosure-based;
- small trace/source icon.

Preferred icon concept:

- `Fingerprint`;
- `GitCommitHorizontal`;
- `Route`;
- equivalent trace glyph.

---

# 7. Section hierarchy

The current ICAS interface uses too many similar uppercase headings.

Visual Language v1 introduces three section levels.

---

## 7.1 Level A — Semantic region

A major page region representing a meaningful product concept.

Examples:

- Version Review;
- Production Evidence;
- CG Agent Review;
- Human Authority;
- Alignment Signal;
- Assessment History.

Treatment:

- semantic icon;
- sentence case preferred;
- approximately normal section-title scale;
- medium/strong weight;
- clear spacing relationship to the region;
- no decorative oversized heading.

Example:

```text
[review icon] Version Review
[evidence icon] Production Evidence
[agent icon] CG Agent Review
[human icon] Human Authority
```

Level A headings should help users scan the page without reading every body paragraph.

---

## 7.2 Level B — Functional subgroup

A subgroup inside a semantic region.

Examples:

- Coordination concerns;
- Actionable requirements;
- Implementation priorities;
- Evidence gaps;
- Local-optimum risks;
- Cross-role tensions.

Treatment:

- usually no large icon;
- sentence case preferred;
- compact;
- may pair with count/status;
- visually lighter than Level A;
- may use micro glyph if it communicates a real category.

Example:

```text
Actionable requirements                            3
Coordination concerns                              1
Evidence gaps                                      2
```

Avoid turning every subgroup into another card.

---

## 7.3 Level C — Metadata

Metadata remains compact and can continue to use small uppercase labels where useful.

Examples:

```text
CREATED
SOURCE
TASK
VERSION
DEPARTMENT
CAPTURED
```

Treatment:

- small;
- muted;
- uppercase acceptable;
- tight label/value relationship;
- no standalone panel unless necessary.

Uppercase should primarily serve metadata/category scanning, not every hierarchy level.

---

# 8. Signal strip grammar

Structured counts should be visually scan-friendly.

## 8.1 Purpose

Signal strips replace prose-only count lines such as:

```text
Technical concerns: 0 · Coordination concerns: 1 · Actionable requirements: 3 · Questions: 1 · Evidence gaps: 2
```

with a compact structured production signal.

Conceptually:

```text
Technical 0  |  Coordination 1  |  Requirements 3  |  Questions 1  |  Evidence gaps 2
```

Each item may contain:

```text
[micro glyph] label  count
```

---

## 8.2 Rules

Signal strips should:

- remain compact;
- stay on one line where desktop width allows;
- wrap gracefully on narrower viewports;
- use counts as the strongest element inside each signal item;
- use small semantic glyphs;
- use separators or spacing rather than separate cards;
- remain readable without colour;
- use colour only when it communicates real attention/severity.

Do not create five coloured KPI cards.

Do not make zero values visually dominant.

---

## 8.3 Colour behavior

Default signal items:

- neutral/cool-grey.

Attention:

- amber only for real medium attention;
- red only for real high/blocked state;
- green only for confirmed/completed/resolved semantics.

Zero counts:

- muted, not “success green” by default.

---

## 8.4 CG Version Review signal strip

Candidate metrics from real CG Agent review data:

- Technical concerns;
- Coordination concerns;
- Actionable requirements;
- Questions;
- Evidence gaps.

Suggested micro-icon concepts:

| Metric | Glyph concept |
|---|---|
| Technical concerns | Wrench / Settings / Triangle alert where genuinely risky |
| Coordination | Network / Git-branch / Users |
| Requirements | List-checks / Clipboard-check |
| Questions | Circle-help |
| Evidence gaps | File-question / Search-x |

Do not treat this table as permission to add colour to every metric.

---

## 8.5 VFX Alignment signal strip

Candidate metrics:

- Cross-role tensions;
- Local-optimum risks;
- Unresolved dependencies;
- Open questions.

Aligned findings may be shown separately or more quietly because confirmations should not compete with risks.

Suggested concepts:

| Metric | Glyph concept |
|---|---|
| Cross-role tension | Split / Network / Git-compare |
| Local-optimum risk | Triangle-alert |
| Dependency | Link / Network |
| Open question | Circle-help |
| Aligned | Check / Circle-check |

---

# 9. Surface grammar

ICAS should not become dark-mode card soup.

Visual Language v1 defines four practical surface roles.

## 9.1 Canvas

Deep charcoal page background.

Use for:

- overall workspace;
- open reading areas;
- supporting whitespace.

---

## 9.2 Working region

Graphite/open working surface.

Use for:

- ordinary production information;
- evidence;
- detailed reasoning;
- grouped work.

A Working Region does not always need a visible box.

---

## 9.3 Raised / focused surface

Use selectively for:

- selected Version/object;
- current primary review signal;
- Human authority/action;
- meaningful current focus.

Do not use raised surfaces for every section.

---

## 9.4 Row / strip

Use for repeated objects:

- Versions;
- departments;
- findings;
- Review Notes;
- History;
- work items;
- dependencies.

Rows should rely on:

- spacing;
- subtle divider;
- icon/object marker;
- compact metadata;
- selected state.

Prefer rows over repeated cards.

---

# 10. Icon placement rules

Icons must communicate semantic value.

## 10.1 Strong semantic icons

Use consistently for:

- Version;
- Anchor;
- Evidence;
- Agent;
- Human;
- Dependency;
- History;
- Review Note;
- Assessment.

## 10.2 Micro glyphs

Use inside:

- signal strips;
- compact state summaries;
- attention markers;
- category counts.

## 10.3 Body prose

Do not place an icon beside every paragraph or bullet.

Body prose should remain typography-led.

## 10.4 Avoid icon noise

Do not create:

```text
[icon] Execution direction
[icon] Coordination concern
[icon] Requirement 1
[icon] Requirement 2
[icon] Question
[icon] Evidence gap
```

unless each icon communicates a distinct reusable semantic category.

---

# 11. Button and action icon rules

Action icons may be used where they reinforce a real action.

Examples:

- Record Review Note → note/message icon;
- Regenerate Agent Review → refresh/rotate icon;
- Escalate to VFX → arrow-up / escalation / send-up icon;
- Open Version → arrow-right / external/open icon;
- Show context → chevron only;
- View details → disclosure chevron only.

Rules:

- icon + text preferred over icon-only for important production actions;
- no decorative icons in ordinary buttons;
- maintain keyboard/accessibility behavior;
- icons must not replace necessary labels;
- primary Human action remains visually strongest.

---

# 12. Current object grammar

Review and Work pages should make the active production object visually obvious.

A current object treatment may combine:

```text
[object icon] Object name
              compact context
[state]
```

For Version Review specifically, the selected Version should read as an object, not just a heading.

Possible structure:

```text
[version icon] Compositing Conflict V1
               Earlier Production Version

Agent review up to date
Latest production → Comp Resolved V2
```

Do not create a giant hero region.

Do not imply approval.

---

# 13. CG Version Review — Visual Language v1 application

CG Version Review is the first implementation target for Visual Language v1.

The page structure already established during Structural + Semantic Convergence remains frozen.

Do not reopen the page hierarchy.

---

## 13.1 Production Versions

Add stable Version object grammar.

Target:

- Version icon;
- Version name;
- selected/current relationship;
- compact note/ftrack metadata;
- purple only for selected state;
- horizontal compact selector remains.

Do not turn each Version into a large card.

---

## 13.2 Version Review header

Use a Review semantic region header and Version object identity.

Clarify:

- selected Version;
- Earlier vs Latest Production Version;
- Agent review currency;
- latest production context when relevant.

Use semantic icons to reduce dependence on small uppercase labels.

---

## 13.3 Production Evidence

Introduce Evidence authority grammar.

Target:

```text
[evidence icon] Production Evidence
```

Then compact metadata / Review Note rows.

Review Notes may use the Review Note object icon.

Do not create cards for every evidence field.

---

## 13.4 CG Agent Review

This is the strongest Visual Language v1 validation region.

Default first-reading layer should become approximately:

```text
[agent icon] CG Agent Review          [review state]

Concise advisory conclusion.

[signal strip]
Technical 0 | Coordination 1 | Requirements 3 | Questions 1 | Evidence gaps 2

Most important
• finding
• finding

▶ View detailed Agent review
```

Rules:

- Agent identity uses advisory steel/cool-grey;
- no purple AI identity;
- counts become signal strip rather than prose-only line;
- top 1–2 findings remain;
- detailed reasoning stays behind disclosure;
- implementation labels remain hidden;
- no new domain claims.

---

## 13.5 Detailed Agent Review

Do not redesign its information architecture in Visual Language v1.

Apply only controlled visual language:

- Level B subgroup headings;
- count aligned with subgroup title where useful;
- row rhythm;
- micro severity markers where already semantically supported;
- fewer repeated uppercase labels;
- no icon on every finding;
- no new cards.

Detailed reasoning remains secondary and collapsed by default.

---

## 13.6 Human Authority

Introduce Human authority icon grammar.

Target:

```text
[human icon] Human Authority
```

Keep:

- strong Human statement;
- Review Note input;
- Record Review Note;
- Regenerate Agent Review;
- Escalate to VFX.

Consider semantic button icons if the available icon system supports them consistently.

Do not make Agent generation visually stronger than Human response.

---

## 13.7 Provenance

If provenance remains unavailable due to missing frontend wiring, Visual Language v1 must not fabricate it.

Do not expand scope into new data fetching during this visual-language implementation unless explicitly approved.

---

# 14. VFX Alignment — later Visual Language backport

VFX Alignment is FINAL-LOCKED structurally.

Do not reopen:

- Alignment page order;
- Department Execution behavior;
- Human Attention logic;
- Current Assessment progressive disclosure;
- Context Inspector;
- History semantics;
- Anchor behavior.

After CG validates Visual Language v1, Alignment may receive a **visual-language-only backport**.

Potential backport:

## 14.1 Alignment Signal

Before:

```text
Alignment Signal
AI interpretation
Current assessment identifies...
```

After conceptually:

```text
[assessment icon] Alignment Signal
Current cross-role assessment        Medium attention

[signal strip]
Tensions 2 | Local risks 3 | Dependencies 1

Current assessment identifies...
```

Do not remove meaningful diagnosis copy.

---

## 14.2 Department Execution

Use small stable object / execution markers only where helpful.

Do not add an icon to every row simply for decoration.

---

## 14.3 Human Attention

Add Human authority/attention icon grammar without changing structure.

---

## 14.4 Assessment History

Use History semantic icon at the region level.

Do not add icons to every history row unless the row represents a distinct event type that genuinely benefits from one.

---

# 15. Future archetype reuse

Once CG Version Review validates Visual Language v1:

## Review Archetype
Reuse Version / Evidence / Agent / Human / signal-strip patterns.

## Decision Archetype
Reuse Assessment / Human / Context / signal-strip patterns.

## Worklist Archetype
Reuse object marker + attention + reason + next action patterns.

## Work Archetype
Reuse task/object + guardrail + current action + escalation patterns.

Consistency should come from shared visual semantics, not identical layouts.

---

# 16. Accessibility and interaction requirements

Icons must:

- never be the only carrier of critical meaning;
- have appropriate accessible treatment;
- be `aria-hidden` when purely reinforcing visible text;
- have accessible labels when icon-only interaction is unavoidable;
- preserve focus indicators;
- preserve keyboard interaction.

Signal strips must remain understandable without relying on colour.

Do not reduce text contrast merely to make the interface look more sophisticated.

---

# 17. Responsive behavior

Primary target:

> 1440–1920px desktop production use.

At desktop widths:

- semantic region headers should remain compact;
- signal strips should use horizontal space efficiently;
- object markers should not create giant vertical blocks;
- avoid narrow central columns with unused side space.

At smaller widths:

- signal strips may wrap;
- object metadata may stack;
- icons remain aligned with labels;
- no critical action should disappear.

---

# 18. Anti-patterns

Visual Language v1 explicitly prohibits:

## 18.1 Decorative icon injection

Do not add icons only because the page “needs more visual interest.”

## 18.2 Icon on every heading

Semantic icons should establish object/authority identity, not create noise.

## 18.3 Coloured icon circles everywhere

Avoid consumer-SaaS icon tiles.

## 18.4 Mini KPI cards

Signal counts must not become five separate dashboard cards.

## 18.5 Purple = AI

Purple remains:

- current selection;
- Intent;
- primary Human action;
- active navigation;
- intentional focus.

Agent identity remains advisory steel/cool.

## 18.6 Card soup

Do not solve visual hierarchy by wrapping every new icon/header in another rectangle.

## 18.7 Visual simplification by deletion

Do not remove valid:

- Evidence;
- provenance;
- History;
- authority information;
- intent constraints;
- review detail.

Use hierarchy and disclosure.

## 18.8 Reopening locked page structure

Visual Language implementation must not silently reopen previously approved IA or workflow.

---

# 19. Implementation strategy

Visual Language v1 should be implemented in controlled phases.

## Phase VL-1 — Shared language definition

Status: **this document**

Lock:

- Object Grammar;
- Authority Grammar;
- Icon style;
- Signal Strip;
- Section hierarchy;
- Surface Grammar.

---

## Phase VL-2 — CG Version Review implementation

Apply Visual Language v1 only to the structurally-approved CG Version Review.

Goals:

- prove icons feel production-grade rather than decorative;
- prove signal strip improves scanning;
- reduce text-only hierarchy;
- preserve information density;
- preserve Human > Agent hierarchy;
- avoid card soup.

Owner browser review required.

---

## Phase VL-3 — Lock Visual Language v1

After CG browser validation, freeze:

- chosen icon family;
- icon sizes;
- icon/object mappings;
- signal-strip visual grammar;
- semantic region header grammar;
- authority icon treatment.

Do not continue changing the system page by page.

---

## Phase VL-4 — VFX Alignment backport

Apply only validated shared language.

No structural redesign.

---

## Phase VL-5 — Remaining representative archetypes

Continue with:

- VFX Review Inbox — Worklist Archetype;
- Artist Current Version — Work Archetype.

They should inherit the validated visual system rather than inventing a new one.

---

# 20. CG Version Review acceptance criteria for Visual Language v1

The implementation is successful only if Owner review can answer **yes** to the following.

## Scanability

- Can I identify Version, Evidence, Agent Review, and Human Authority before reading all prose?
- Does the page no longer feel like a series of text headings and grey rectangles?
- Can I scan the Agent review counts in a few seconds?

## Object identity

- Does a Version visually read as a production object?
- Is the selected Version obvious without a giant card?
- Are Review Notes recognisable as Review Notes?

## Authority

- Is Human authority visibly different from Agent advice?
- Is Agent identity advisory rather than “AI-themed”?
- Is Evidence clearly factual and secondary?

## Density

- Has information been visually encoded without deleting valid content?
- Does the page remain medium-high density?
- Do signal strips reduce prose without becoming dashboard KPI cards?

## Production feel

- Does the result feel like a professional VFX production workspace?
- Are icons restrained and technical?
- Is the interface visually richer without becoming playful or decorative?

## Consistency

- Could these patterns later be reused in Alignment, Review Inbox, and Artist Current Version without forcing identical layouts?

If these answers are not clearly yes, Visual Language v1 is not locked.

---

# 21. Implementation freeze during CG validation

During the first CG Visual Language implementation, do **not** change:

- backend/domain logic;
- API contracts;
- Golden Journey semantics;
- routes;
- CG Task IA;
- Version selection behavior;
- Review-state logic;
- Agent generation behavior;
- Review Note behavior;
- Human authority semantics;
- escalation semantics;
- Anchor interaction;
- VFX Alignment structure;
- Provenance data wiring.

The purpose of this phase is:

> **visual language implementation, not another structural redesign.**

---

# 22. Owner decision summary

Visual Language v1 currently proposes the following system direction:

```text
Object Grammar
+ Authority Grammar
+ Semantic Icons
+ Production Signal Strips
+ Three-level Section Hierarchy
+ Restrained Surface Grammar
```

Icons are:

```text
technical
monoline
small
semantic
restrained
consistent
```

They are **not**:

```text
decorative
colourful
playful
AI-themed
placed everywhere
```

The intended result is:

> ICAS should stop reading as “well-formatted reports inside a dark UI” and begin reading as a coherent visual production system where objects, authority, state, and evidence can be scanned before every sentence is read.
