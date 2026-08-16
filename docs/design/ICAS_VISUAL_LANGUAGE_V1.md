# ICAS Visual Language v1

> **Intent Core Alignment System — Shared Visual Language Implementation Layer**
>
> **Status:** All four representative archetypes (Worklist, Decision, Review, Work) are owner-approved and locked. The shared visual language layer is complete for this representative set — see §24 for the final per-archetype reference, §23 for the final Artist Anchor Context grammar, and §26 for the full-product migration plan that follows next.  
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

## 9.5 Narrative composition

Established and revised during the Artist Current Version Work
-archetype correction (expanded Anchor Context passes). An earlier
version of this rule recommended a `[stable label column][fluid
content column]` repeated row, implemented once per domain field. That
pattern was built, browser-reviewed by the Owner, and **rejected**: it
read as a settings/database table once every field had its own
full-width row and divider, not as a coherent reading surface. It is
**no longer the approved default** and must not be reintroduced.

### The rule

> **Semantic siblings do not automatically become equal-width columns
> — and they do not automatically become one full-width UI row per
> field either.**

Both are the same underlying mistake: mechanically translating a list
of domain fields into a layout, instead of composing a layout from
what the content actually is and how it behaves.

Do not mechanically translate domain fields into:

- equal-width narrative columns;
- label/value database rows;
- one full-width UI row per field;
- one card per field.

### When equal-width columns (or grids) remain appropriate

- short, comparable, predictable metadata or metrics;
- content whose length does not vary meaningfully between siblings;
- genuine side-by-side comparison is the point (e.g. Core Anchor vs.
  Execution Anchor identity nodes).

### What to do instead for variable-length narrative content

- Group content according to meaningful semantic objects or reading
  tasks, not by enumerating fields.
- Multiple closely-related facts about the same semantic object may
  live inside one coherent reading block — an identity line, a primary
  statement, then inline "Lead-in — text" clauses in the same flow —
  distinguished by typography and spacing, not by separate rows,
  label columns, or containers.
- Narrative text should normally use the available production
  -workspace width. Do not impose arbitrary `ch` (or similar)
  reading-width caps on narrative prose when they cause premature
  wrapping and leave the workspace visibly empty on one side — this
  was tried and reverted during the Artist Anchor correction (see
  §23).
- Never use fixed heights, internal scrolling, or truncation merely to
  make a narrative layout fit a visual target. Content length must be
  allowed to vary naturally, in both directions.

### Layout proportion follows content behavior

Layout proportion — columns vs. one coherent reading block, equal
-width vs. grouped — must be chosen from the information type and how
its real content behaves (short and predictable vs. long and
variable), not merely from how many fields happen to exist.

### Reference implementation

§23 documents the Artist Anchor Context's final compact-semantic-block
composition as the validated example of this rule. It is a
**role-specific implementation**, not a universal template — do not
turn it into a mandatory layout for every other narrative surface in
ICAS.

### Migration note

This rule is locked. The full-product Visual Language migration phase
(§26) should audit existing long-form equal-width column layouts *and*
any label/value-per-field row grammar elsewhere in ICAS for these two
related anti-patterns, and correct them using the semantic-block
approach where applicable — without forcing every page into an
identical layout.

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

> This section was written while only CG Version Review had validated
> Visual Language v1. All four archetypes are now locked — §24 is the
> accurate, current reference; this section is preserved for
> historical record.

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

> Written before implementation began. All phases below (VL-1 through
> VL-5) are now complete and owner-approved — §24 documents the final
> outcome; this section is preserved for historical record of how the
> work was sequenced.

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

---

# 23. Artist Anchor Context — final role-specific grammar (Work Archetype)

This section documents the Artist expanded Anchor Context as a
**role-specific implementation example** of the Narrative composition
rule (§9.5), validated through several owner browser-review correction
passes. It is not a universal template. VFX and CG Anchor Context
presentation were not changed by this work and remain documented in
their own sections above (§13 for CG, §14 for VFX).

## 23.1 Collapsed state (shared across all three roles)

The collapsed Artist Anchor is the same shared markup as VFX's and
CG's own collapsed state — one shared component branch, not an
Artist-specific composition. It remains a thin first-reading summary:

- real attention state (omitted, not shown as a placeholder, when not
  yet assessed);
- Core Anchor revision/state identity;
- Execution-preferred, Core-fallback concise direction text;
- the disclosure control ("Show anchor context").

The collapsed state was not changed by any of the expanded-state
correction passes below.

## 23.2 Expanded Artist composition

ONE coherent Anchor surface, using the full available production
-workspace width, made of three compact semantic reading blocks plus
one supporting-context footer:

```text
Core Anchor
→ Execution Anchor
→ Readiness / next step
→ compact supporting-context footer
```

A compact header (semantic kicker + collapse control only — no status
badge cluster) precedes the blocks. Each status attaches to the
semantic block it actually qualifies, never to a floating header
cluster. This is exactly one collapse/expand disclosure — no
additional disclosure layer was added inside the expanded state.

### Core Anchor block

- Core Anchor revision/state identity line, with a restrained
  Intent/selected-purple icon tint (object recognition only — never a
  tile/card, never the heading text color itself);
- Core direction ("Why") as the primary prose statement;
- `Must preserve —` as an inline semantic clause in the same block, not
  a separate labelled row;
- conditional draft distinction as quiet supporting metadata, shown
  only when a newer draft or pending Human Gate genuinely exists.

### Execution Anchor block

- Execution Anchor revision/state identity line, with a restrained
  steel/cool advisory icon tint;
- current direction as the primary prose statement, at normal
  (non-bold) reading weight — deliberately quieter than Core Anchor's
  and Readiness's own primary statements, so Execution does not
  visually outweigh its siblings;
- `Allowed to vary —` as an inline clause;
- conditional `Boundary —` as an inline clause;
- conditional draft source as quiet supporting metadata.

Core Anchor and Execution Anchor authority are never merged into one
fact or one block. `Must preserve` (Core, creative) and `Boundary`
(Execution, technical/production) remain semantically distinct and are
never combined or treated as duplicates of each other.

### Readiness / next-step block

- the real attention state, shown as a status badge in this block's
  own header (not a floating cluster);
- `next_action.title` as the block's strongest statement;
- `why_now` as its supporting explanation;
- the real navigation action, when the underlying next action is
  genuinely executable;
- a visually secondary supporting tier — attention reasoning, the
  `review_requirement` (only shown as distinct text when it says
  something the AI/rule summary doesn't already say), the downstream
  consequence, and a conditional upstream explanation — demoted in
  weight/tone/spacing below the block's primary statement, with no
  content removed.

No fact repeats:

- the real upstream state, when it exists, renders in exactly one
  place inside this block — not also as a separate header badge;
- the attention `review_requirement` renders once, not twice, when no
  AI/rule summary exists or the summary would otherwise duplicate it
  verbatim.

### Supporting-context footer

One quiet compact metadata rail, not a section with its own heading:

- current Production Version identity;
- Guidance state, as plain toned inline text (confirmed/attention
  /unavailable semantics), never a strong pill/chip;
- Related Context, rendered only when a real Artist-accessible route
  exists — no reserved empty space when it does not. The capability
  stays in code for when a real route applies; it must not be deleted
  merely because it is not reachable under today's backend contract.

## 23.3 Non-negotiable content/authority facts

- Artist remains fully read-only throughout the expanded Anchor: no
  edit, confirm, approve, or re-anchor control anywhere in the region.
- Core Anchor and Execution Anchor facts are never merged or treated
  as interchangeable.
- No real content-contract fact may be silently dropped for visual
  compactness — compaction is achieved through grouping, typography,
  and tone, never through deletion, truncation, or hidden disclosure.

---

# 24. Final four-archetype reference (locked)

The four representative ICAS archetypes are now owner-approved and
locked. This section is the accurate, implementation-level reference
for each. The phased plan in §19–21 and the earlier reuse sketch in
§15 are preserved for historical record; this section is the current
source of truth.

Shared grammar should be reused across archetypes. Archetype
composition should remain task-specific — these four pages do **not**
use identical layouts, and future pages mapped to these archetypes are
not expected to either.

## 24.1 Worklist — VFX Review Inbox

**Primary purpose:** Human triage / work-item-first entry.

Approved grammar:

- dense continuous list;
- grouped real work items;
- work-item title → reason → production context → action;
- type identity belongs primarily at the group level where grouped;
- compact object-specific state wording;
- tertiary integration metadata;
- Human-required action outranks integration/provenance;
- no dashboard KPIs;
- no card soup.

## 24.2 Decision — VFX Alignment

**Primary purpose:** cross-role interpretation and Human
decision/attention.

Approved grammar:

- Anchor guardrail;
- current Alignment Signal;
- Department Execution;
- Current Assessment + Context Inspector;
- strongest Human-owned action/intent region;
- muted History;
- Agent advisory remains below Human authority;
- SignalStrip may be used for genuine structured decision signals;
- evidence remains neutral.

## 24.3 Review — CG Version Review

**Primary purpose:** review one Version against Execution/Intent
context.

Approved grammar:

- Version relationship / rail;
- selected Version as primary review object;
- Production Evidence;
- concise Agent Review;
- structured Review Signal;
- top findings;
- Human Authority;
- detailed review via consistent disclosure;
- Human response outranks Agent advisory.

## 24.4 Work — Artist Current Version

**Primary purpose:** active execution work.

Approved grammar:

- Production Versions = secondary selector;
- Current Version = primary work object;
- Supervisor Feedback > Agent Guidance;
- Agent Guidance is actionable work input, not an analytics surface;
- structured iteration priorities / feedback translations are shown as
  real actionable rows;
- no count-only SignalStrip for Artist work guidance;
- Regenerate Guidance is a secondary Agent-support action;
- related context remains quiet.

See §23 for the Artist Anchor Context's own final grammar, which
applies within this archetype's frame.

---

# 25. Shared grammar validated across the four representative pages

## Authority

Human > Agent > Evidence > History.

## Purple

Purple means:

- current selection;
- Intent;
- primary Human focus/action.

Purple does **not** mean Agent.

## Agent

Steel/cool advisory identity (`--accent-advisory-*`). Never purple,
never "AI-themed" decoration.

## Attention / status

- neutral = low/unavailable/general;
- amber = medium attention;
- red = high/blocked;
- green = confirmed/current/completed where semantically true.

Status labels should be object-specific where ambiguity exists — e.g.
`Core Anchor confirmed`, `Execution current`, not a bare `confirmed` /
`current` that could describe more than one real object on the same
surface.

## Semantic icons

- use icons at meaningful object/region identity level;
- do not add icons to every field;
- omit an icon rather than use a semantically incorrect one — a
  missing icon communicates nothing false; a borrowed icon from an
  unrelated concept (e.g. using the Human Authority icon to mean
  "workflow readiness") does.

## Surface discipline

- avoid card soup;
- semantic surfaces should correspond to real work objects / authority
  boundaries;
- do not create containers only to make the page feel designed.

## Findings / feedback

- compact numbered row grammar is valid where the content is genuinely
  a list of review/guidance items;
- category structure may remain archetype-specific;
- not every textual statement should become a numbered finding.

## Disclosures

The same control should retain the same location/identity across
collapsed and expanded states. Use truthful `View ... →` / `Collapse
... ↑`-style grammar where applicable. Expanding a region should never
introduce a different heading/identity than what was visible while
collapsed.

## Internal implementation labels

Known generator/demo prefixes must be removed presentation-only,
through verified allowlisted logic — an explicit, exact-string
allowlist, never a generic "strip any bracketed content" pattern,
which would also silently remove legitimate product copy that happens
to start with a bracket.

## Text wrapping

Do not add arbitrary character-width caps that cause premature
wrapping in production-workspace surfaces. Narrative prose should use
the naturally available container width; wrapping should occur because
the container is genuinely narrow, not because of an arbitrary
internal cap.

---

# 26. Full-product migration note (next phase)

The four representative archetypes above are the validated visual
-language reference set, not the finished product. Full-product
migration is the next phase and must:

- inventory all remaining routes/pages;
- preserve existing page responsibility and role permissions;
- map each page to the closest archetype/shared grammar where useful;
- reuse visual primitives without forcing every page into one layout;
- audit long-form equal-column narrative anti-patterns (§9.5);
- audit stale icon/status grammar;
- audit Human/Agent/Evidence/History hierarchy;
- audit disclosure consistency;
- audit internal-label leakage;
- avoid changing domain/IA merely for visual convenience.

After migration:

- run a global consistency audit;
- then perform a final polish pass.

This phase has not started. Nothing in this document should be read as
implying otherwise.
