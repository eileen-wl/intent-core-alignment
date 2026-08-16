# VFX Alignment — Decision Archetype v1
## Implementation Brief

> **Status:** Human-approved page direction  
> **Applies to:** VFX Supervisor → Shot → Alignment  
> **Global authority:** `docs/design/ICAS_DESIGN.md`  
> **Reference:** Use the Human-approved A+C Alignment reference image supplied with this brief.  
> **Important:** This brief defines the target page structure and hierarchy. It does **not** authorize backend/domain changes.

---

# 1. Page objective

The Alignment page is a **Decision Workspace**.

Its primary job is not to display every available Alignment-related object. Its primary job is:

> Help the Human VFX Supervisor understand the current cross-role alignment issue, see the most important evidence and risks, and decide what Human interpretation/action is required.

The page must make the following understandable within the first viewport:

1. What is the current alignment state?
2. Why does it need attention?
3. Which departments contribute to the situation?
4. What does the current Cross-role Assessment conclude?
5. What Human action or interpretation is needed now?

Supporting evidence, detailed Agent reasoning, provenance, and history must remain available, but they should not dominate the default view.

---

# 2. Non-negotiable product constraints

Do not change:

- backend/domain logic;
- J0→J4 journey semantics;
- Assessment generation logic;
- Core Anchor authority rules;
- Human authority;
- Agent advisory status;
- current/historical semantics;
- evidence/provenance persistence;
- task/version/shot identity;
- Re-anchor Proposal semantics;
- read-purity;
- routing behavior unless strictly required for the visual restructure.

Do not delete valid evidence or historical records for visual simplicity.

The redesign is a **presentation and information-hierarchy change**.

---

# 3. Target information architecture

The page should follow this order:

```text
1. Page / Shot context
2. Compact Current State Rail
3. Alignment Signal
4. Department Execution Strip
5. Current Assessment + Context Inspector
6. Human Attention / Human Action
7. Assessment History
```

The default page should no longer read as:

```text
Anchor Context
→ Human Intent
→ Agent Assessment
→ Production Evidence
→ Agent Interpretation
→ Findings
→ Recommendation
→ History
→ Human Decision
```

That long-report structure is explicitly being replaced.

---

# 4. First viewport target

At approximately 1440–1920px desktop width, the first viewport should expose most or all of:

- Shot identity;
- current Core Anchor / Version / attention;
- concise Alignment Signal;
- compact three-department execution summary;
- current Assessment summary;
- primary Human Attention/action area.

Detailed evidence and long Agent reasoning should not consume the first viewport by default.

---

# 5. Page structure

## 5.1 Page / Shot context

Keep the user oriented with compact context:

```text
Shot 010 — Final confrontation
Alignment
Compositing Review · Comp Resolved V2
```

Do not use oversized breadcrumb text.

Role and global navigation remain handled by the existing ICAS shell.

---

## 5.2 Compact Current State Rail

Purpose:

> Give the user one quick read of the current authoritative production state.

Suggested content:

- Core Anchor R2 · confirmed
- current selected / assessed Version
- attention state
- linked-ftrack state if applicable

This should be compact.

It must not become another large Anchor Context panel.

---

## 5.3 Alignment Signal

This is the page's high-level diagnosis.

Example structure:

```text
ALIGNMENT SIGNAL

Medium attention
Broadly aligned · combined intensity still needs Human interpretation
```

May include compact counts such as:

```text
3 local risks · 1 cross-role tension · 1 open question
```

The signal is a summary of the current Assessment, not a replacement for the real Assessment object.

Use the real current Assessment data.

---

## 5.4 Department Execution Strip

Add one compact cross-department summary containing:

- Animation
- Lighting
- Compositing

For each department show only the most decision-relevant summary, for example:

```text
Animation      Execution R2 · current      Medium
Lighting       Execution R2 · current      Medium
Compositing    Execution R2 · current      Medium
```

Optionally include a very short risk phrase if real data already supports it.

Do not create three large cards.

Do not duplicate full Execution Anchor contents.

The purpose is to make the cross-department nature of Alignment visually legible.

---

# 6. Main Decision Workspace

Use a two-region desktop composition:

```text
MAIN ASSESSMENT AREA       |       CONTEXT INSPECTOR
```

The exact width can be determined during implementation, but the main Assessment area must remain visually dominant.

---

## 6.1 Current Assessment area

Default visible content should prioritize:

### Assessment identity/state
- current Cross-role Assessment;
- attention level;
- assessed Version;
- Assessment completion/currentness.

### Executive conclusion
Show the real Assessment executive summary prominently.

### Key findings
Prefer summarized groups such as:

- Cross-role tensions
- Local-optimum risks
- Open questions
- Advisory recommendation

Do not render all detailed reasoning at maximum prominence.

Use compact rows / grouped findings rather than nested cards where possible.

### Detailed evidence
Provide a disclosure such as:

```text
View detailed evidence
```

### Detailed Agent reasoning
Provide a separate disclosure such as:

```text
View Agent reasoning
```

The user should understand the problem without opening either disclosure.

---

## 6.2 Context Inspector

Purpose:

> Hold supporting context without making it compete with the current decision.

Candidate content:

### Core Intent
- Core Anchor revision
- confirmed state
- concise current direction / key constraint

### Current Production Context
- current Version
- relevant Task
- current Execution Anchor state

### Department status
If useful and not already redundant with the Department strip.

### Evidence & provenance
Collapsed / on-demand.

### Related context links
Only render if real related context exists.

Do not show empty headings.

The Inspector should visually resemble a stable professional context region, not a large stack of independent cards.

---

# 7. Human Attention / Human Action

This is the most important visual priority after the current state.

The section should answer:

> What does the Human VFX Supervisor need to interpret or decide now?

Example:

```text
HUMAN ATTENTION

Current execution is broadly aligned, but the combined
intensity still requires your interpretation.
```

Actions must reflect real available workflow/state.

Possible actions may include, depending on the actual current state:

- review / acknowledge alignment;
- review Re-anchor Proposal;
- create / revise Core Anchor;
- navigate to relevant Human decision workflow.

Do not invent a new backend action merely to match the mockup.

If the current implementation does not have a literal “Acknowledge alignment” action, map the design to the real Human action(s) that exist.

Human action controls should be visually stronger than Agent-related controls.

---

# 8. Assessment History

Historical Assessment content belongs below the current decision workspace.

Default treatment:

- compact;
- muted;
- clearly labelled historical;
- collapsed if verbose.

History should communicate meaningful transitions such as:

```text
High attention
→ Re-anchor Proposal
→ Core R2 confirmed
→ new Medium assessment
```

Do not delete historical Assessments.

Do not visually confuse historical Assessment findings with the current Assessment.

---

# 9. Existing content mapping requirements

Before implementation, inspect the current Alignment page and produce a mapping table using this exact format:

| Existing component / section | Current responsibility | Target responsibility | Target location | Action |
|---|---|---|---|---|
| ... | ... | ... | ... | keep / reuse / collapse / restructure / remove duplicate presentation |

The mapping must cover at minimum:

- current Anchor Context component;
- Human Intent notice;
- current Cross-role Assessment summary;
- Production Evidence;
- Agent Interpretation;
- Findings;
- Recommended next action;
- Re-anchor Proposal presentation where applicable;
- Human Decision and Provenance;
- Assessment history;
- Evidence / provenance disclosures;
- current Shot/Task/Version context.

No implementation may begin until the mapping explains where every meaningful current section goes.

“Remove” is allowed only for **duplicate presentation**, never for removal of underlying valid domain information.

---

# 10. Dark visual direction

Follow `ICAS_DESIGN.md`.

Alignment should feel:

> dark, precise, compact, professional, production-oriented.

Use:

- deep charcoal canvas;
- graphite working surfaces;
- subtle luminance differences;
- restrained dividers;
- off-white primary text;
- cool grey secondary text;
- purple for selected/current/primary Human emphasis;
- amber for medium attention;
- red only for genuinely high/blocked states;
- green for confirmed/completed.

Avoid:

- black-on-black flatness;
- converting every existing card into a dark card;
- large purple surfaces;
- glow;
- gradients;
- excessive rounded containers;
- card-in-card nesting.

---

# 11. Typography and density

Target:

> Medium-high professional density.

Use compact hierarchy.

Do not introduce:

- marketing-scale headings;
- excessive vertical whitespace;
- huge status cards.

The page should comfortably use a 1440–1920px desktop viewport.

Keep line lengths controlled in long reasoning text.

---

# 12. Progressive disclosure

Default visible:

- state;
- signal;
- department status;
- executive summary;
- key findings;
- Human attention/action.

Collapsed / secondary:

- full evidence;
- long Agent reasoning;
- provenance;
- historical detail;
- raw metadata.

A user should not need to scroll several screens before reaching the Human task.

---

# 13. Shared-component principle

Reuse existing shared components when their semantics still fit.

However:

> Do not preserve an unsuitable visual structure merely because a shared component already exists.

If a shared component currently forces excessive prominence, consider:

- compact variant;
- inspector variant;
- summary variant;

instead of duplicating domain logic.

Any new shared visual variant should remain semantically truthful.

---

# 14. First implementation stage: structure only

When implementation is approved, the first code pass should focus on:

- layout;
- grouping;
- content hierarchy;
- disclosure;
- component positioning;
- duplicate-presentation removal.

Do not spend the first pass polishing:

- exact colors;
- micro spacing;
- shadows;
- hover animation;
- fine typography.

Owner visual review happens after the structural pass.

Only after the structure is approved should the dark visual styling be refined.

---

# 15. Acceptance criteria

The first structural pass is successful only if the Owner can answer yes to these:

1. Can I understand the current Alignment issue within a few seconds?
2. Can I see Animation / Lighting / Compositing together without reading three large cards?
3. Is the current Assessment more important than its detailed evidence?
4. Is Human Attention clearly more important than Agent reasoning?
5. Is Anchor Context now supporting context rather than the page's dominant block?
6. Are historical Assessments clearly secondary?
7. Can I reach detailed evidence/provenance when I need it?
8. Does the page stop feeling like one long report?
9. Has no valid domain information been destroyed?
10. Does the structure plausibly support the approved A+C reference design?

---

# 16. Initial Claude Code instruction

For the **first turn after receiving this brief**, do **not** write code.

Your task is only to:

1. read `docs/design/ICAS_DESIGN.md`;
2. read this brief;
3. inspect the current Alignment implementation;
4. identify the exact files/components/data loaders involved;
5. produce the required existing→target mapping table;
6. identify any places where the approved design conflicts with current real domain/actions;
7. identify what can be reused versus what needs a visual variant;
8. propose the smallest implementation plan that reaches the target structure without changing domain logic.

Do not:
- edit files;
- install skills;
- run a redesign;
- alter backend/domain behavior;
- implement styling;
- commit.

Stop after the mapping and implementation plan for Human review.
