# PROJECT_CONTEXT.md

**Project:** DNEG × MA Digital Innovation — Intent Core Alignment System  
**Working theme:** Maintaining Creative Control in AI-Assisted Animation/VFX Workflows  
**Status:** Shared project context / source of truth  
**Last updated:** 2026-07-12

---

## 1. Purpose of this document

This document gives every team member and every Claude Code session the same baseline understanding of the project.

It explains:

- why the project exists;
- which part of the animation/VFX workflow it addresses;
- the central problem and design logic;
- the roles included in the system;
- the agreed system concept;
- the boundaries between confirmed findings, design synthesis, and assumptions that still require validation;
- the implementation direction already agreed by the team.

This document is **not**:

- a detailed technical architecture;
- a database schema;
- an API specification;
- a complete UX flow;
- an implementation task list.

Those belong in separate project documents.

---

## 2. Project background

The project explores how animation and VFX teams can maintain creative intent when AI becomes involved in generation, interpretation, comparison, revision, and technical execution.

AI can accelerate production and make it easier to generate multiple options. However, faster output does not automatically create better alignment. As versions, feedback, departmental decisions, and AI-assisted modifications accumulate, the original creative direction can become fragmented, compressed, reinterpreted, or gradually weakened.

The project therefore does not focus mainly on whether AI can generate high-quality content. Its focus is:

> How can teams continue to direct, constrain, review, correct, and confirm AI-assisted work so that the final result remains aligned with a shared creative intent?

---

## 3. Workflow scope

The project focuses on a specific shot-level and sequence-level workflow slice:

```text
VFX Supervisor
      ↓
CG Supervisor
      ↓
Artist
      ↓
Version submission
      ↓
Review / feedback / revision
      ↓
Further versions and cross-department coordination
```

The system is concerned with:

- brief interpretation;
- creative intent transmission;
- intent translation between roles;
- AI-assisted version generation or modification;
- review notes and feedback;
- version comparison;
- technical execution constraints;
- cross-department alignment;
- approval, escalation, and re-anchoring.

The project does **not** attempt to redesign the full animation/VFX pipeline or replace an existing production tracking platform.

---

## 4. Core problem

The central problem is:

> Creative intent does not travel reliably across roles, feedback translations, AI-generated versions, and repeated production iterations.

This problem contains three related conditions.

### 4.1 Unequal visibility of creative intent

Different roles see different parts of the same intention.

A VFX Supervisor may understand the wider story, emotional purpose, rhythm, visual priority, and the reasoning behind a decision. A downstream Artist may receive only a task, note, reference, or deadline.

The task may communicate **what to do** without preserving enough of **why it matters**.

### 4.2 Creative reasoning is compressed during feedback translation

As feedback moves through production, it becomes more actionable, but the reasoning behind it may be shortened, separated from the task, or lost.

This becomes more serious when AI is used to summarise notes, turn feedback into tasks, or generate revision prompts, because the AI may preserve the action while weakening the human judgement that produced it.

### 4.3 Local improvement can create global drift

Individual departments may improve their own work successfully while the combined shot moves away from the intended story, emotion, rhythm, composition, or character state.

A technically strong or visually impressive output can therefore still be “good but wrong”.

---

## 5. How AI increases the pressure

AI is not treated as one single tool. The project considers several AI capabilities:

### Generate / Explore

AI can create multiple visual, motion, look, or shot variations from partial prompts, references, previous versions, or short notes.

**Pressure created:** AI expands incomplete input into a complete output. Missing creative reasoning may be replaced by model defaults.

### Translate / Summarise / Convert

AI can summarise review notes, classify feedback, create action items, or convert creative feedback into production instructions.

**Pressure created:** feedback becomes easier to execute, but the relationship between human judgement and the resulting task may become less visible.

### Revise / Edit / Compare

AI can revise motion, pose, timing, appearance, or visual details and can help compare versions.

**Pressure created:** a specific note may be fixed while an unprotected dimension changes, producing hidden drift.

The system must therefore make AI interpretation visible and reviewable before it becomes a production decision.

---

## 6. Roles included in the system

The project distinguishes three roles because they do not make the same type of judgement.

### 6.1 VFX Supervisor

The VFX Supervisor is responsible for high-level creative alignment.

Their concern is whether a shot or version still serves:

- story;
- emotion;
- rhythm;
- visual focus;
- director intent;
- overall quality and coherence.

The VFX Supervisor owns final confirmation of the primary creative direction.

### 6.2 CG Supervisor

The CG Supervisor operates at the technical execution and production coordination layer.

Their concern is whether creative intent has been translated into an execution that is:

- technically feasible;
- stable across departments;
- compatible with pipeline requirements;
- safe for downstream work;
- sufficiently production-ready;
- still aligned with the confirmed creative direction.

The CG Supervisor does not independently redefine the primary creative intent.

### 6.3 Artist

The Artist performs hands-on execution, AI-assisted creation, comparison, refinement, and submission.

Their concern is how to translate current intent and production requirements into concrete work.

The Artist should not be reduced to a passive selector of AI outputs. The system should help the Artist understand the reason behind a task, compare options against shared intent, and explain the basis of a submission.

---

## 7. Current role-specific pain points

### 7.1 VFX Supervisor — working pain point

AI can rapidly produce many visually impressive options, but the VFX Supervisor must still determine whether those options serve the intended story, emotion, rhythm, and direction.

More options may increase review, explanation, comparison, and correction instead of reducing them.

### 7.2 CG Supervisor — working pain point requiring further validation

AI-assisted tools increase the speed and volume of technical outputs, but their change scope, production risk, and downstream effects may not be immediately visible.

The CG Supervisor must determine:

- whether the result is technically reliable;
- whether it can enter the pipeline;
- whether it affects downstream departments;
- whether it still implements the creative direction confirmed by the VFX Supervisor.

This pain point is a design synthesis based on role responsibility, AI capability, and project evidence. It must not be presented as a fully validated DNEG finding.

### 7.3 Artist — current working pain points

#### Pain point 1: Artist becomes an output selector without enough “why”

AI can produce many plausible outputs. When the Artist receives only the task and not enough creative reasoning, selection may be based mainly on what looks good locally.

Misaligned outputs are then submitted upward, increasing review and communication effort.

#### Pain point 2: Departmental optimum is not the overall optimum

An Artist may select the strongest version for their own department. However, strong choices across animation, FX, lighting, composition, or other departments may conflict when combined.

The result can become less coherent and drift away from shared intent.

---

## 8. Agreed design concept

The agreed system is the **Intent Core Alignment System**.

It is a role-aware, multi-agent, human-controlled system that helps animation/VFX teams keep creative intent:

- visible;
- structured;
- traceable;
- comparable across versions;
- available across roles;
- re-confirmable when drift occurs.

The system uses an **anchor-based alignment model**.

### 8.1 Primary anchor

The primary anchor represents the shared creative direction for a shot or task.

It may include:

- core creative intent;
- shot objective;
- emotional tone;
- visual focus;
- rhythm and intensity;
- character relationship;
- non-negotiable constraints;
- allowed variation;
- references;
- high-risk drift points.

The VFX Supervisor has authority to confirm and revise the primary anchor.

### 8.2 Secondary execution anchor

The CG Supervisor translates the primary anchor into department-level execution requirements.

A secondary execution anchor may include:

- asset or character specifications;
- timing and motion boundaries;
- simulation limits;
- lighting constraints;
- material and texture standards;
- render requirements;
- file and publish rules;
- downstream handoff conditions;
- production-ready criteria.

A secondary anchor is not a new creative direction. It is an execution-level translation of the confirmed primary anchor.

### 8.3 Artist execution context

The Artist reads the primary and secondary anchors but does not modify them.

The system translates them into:

- task why;
- must-preserve conditions;
- allowed changes;
- watch-outs;
- relevant references;
- escalation conditions;
- submission rationale support.

---

## 9. System structure

The agreed product structure contains:

### 9.1 Core Agent

The Core Agent is the intent control centre.

Its responsibilities include:

- intent decomposition;
- primary anchor drafting and maintenance support;
- context reconstruction;
- alignment checking;
- re-anchor suggestions;
- intent status signalling;
- synchronising shared context for role-specific services.

The Core Agent does not make final creative decisions.

### 9.2 VFX Supervisor Agent

Supports:

- feedback interpretation;
- feedback grouping and prioritisation;
- creative review preparation;
- drift detection;
- re-anchor support;
- identification of decisions that require VFX Supervisor confirmation.

### 9.3 CG Supervisor Agent

Supports:

- translation of creative intent into execution standards;
- creation of secondary execution anchor drafts;
- technical risk analysis;
- production-readiness support;
- downstream impact analysis;
- escalation where technical execution may affect the primary creative anchor.

### 9.4 Artist Agent

Supports:

- task context briefing;
- anchor-to-action translation;
- AI output comparison;
- cross-department conflict warnings;
- submission rationale preparation;
- escalation when a change exceeds the Artist’s execution authority.

### 9.5 Shared Dashboard

The Dashboard is the human control surface.

It should make visible:

- confirmed creative intent;
- current anchor versions;
- task and role context;
- version lineage;
- feedback history;
- AI assessments;
- technical checks;
- cross-department risks;
- open questions;
- human approval points;
- re-anchor decisions;
- current intent status.

The Dashboard is not merely a reporting interface. It is where people inspect, edit, confirm, reject, and escalate system proposals.

---

## 10. Human authority and system boundaries

The system must preserve human authorship and role authority.

### Non-negotiable principles

- AI may propose an anchor, but a human confirms it.
- AI may identify drift, but it does not declare a final creative truth.
- AI may recommend approval, revision, escalation, or re-anchoring, but it does not automatically make the final production decision.
- The VFX Supervisor controls the primary creative anchor.
- The CG Supervisor controls secondary execution anchors within the boundaries of the primary anchor.
- The Artist can read and act on anchors but cannot redefine them.
- Technical convenience must not automatically override creative intent.
- AI output, production facts, and human decisions must remain distinguishable.
- Every important decision must be traceable to its source context, anchor version, evidence, and responsible person.

---

## 11. Implementation direction already agreed

The team has agreed to:

> Build the Intent Core Alignment System as an independent system, with ftrack as the first formal workflow connector.

This means:

### The independent system owns

- anchors and anchor revisions;
- reconstructed context;
- AI assessments;
- role-specific views;
- intent signals;
- human gates;
- decision lineage;
- cross-department alignment logic;
- agent orchestration;
- the shared dashboard.

### ftrack remains responsible for

- project and production entities;
- shots and tasks;
- versions and published assets;
- review notes;
- production statuses;
- user and assignment context;
- workflow events already managed by the production tracker.

### The ftrack connector is responsible for

- reading relevant ftrack entities;
- mapping them into the system’s internal data model;
- receiving relevant workflow events;
- preventing duplicate synchronisation;
- linking external and internal records;
- selectively writing back human-confirmed notes or status changes;
- preserving a clear boundary between production tracking and intent alignment.

The system must not be structurally dependent on ftrack-specific objects. ftrack data must pass through a connector and be converted into an internal, platform-independent model before it is used by agents or the Dashboard.

---

## 12. Evidence discipline

The project must distinguish between:

### Confirmed or strongly supported context

- the project focus on creative control in AI-assisted workflows;
- the importance of feedback and review in maintaining intent;
- the distinction between VFX Supervisor, CG Supervisor, and Artist responsibilities;
- the risk that AI-generated outputs can be visually strong while misaligned;
- the need for human guardrails and confirmation.

### Design synthesis

- the anchor model;
- the Core Agent and Role Agent structure;
- the proposed information flow;
- the secondary CG execution anchor;
- the Human Gate model;
- cross-department alignment checks.

These are design responses based on the team’s research and synthesis. They are not claims that DNEG currently uses or has validated this system.

### Assumptions requiring validation

- the exact CG Supervisor pain point;
- the exact fields and workflow states available in DNEG’s ftrack configuration;
- how DNEG maps roles, departments, statuses, versions, and approvals;
- how much real production data can legally or practically be processed by external AI systems;
- whether professionals find the proposed signals and role views useful in real production;
- whether the system reduces review effort or rework at scale.

The project must not present these assumptions as proven industry facts.

---

## 13. What the project is not

The Intent Core Alignment System is not:

- a replacement for ftrack;
- a complete production management platform;
- a new animation or VFX content-generation model;
- an autonomous approval system;
- a generic chatbot layer;
- a tool that replaces VFX, CG, or Artist judgement;
- a claim that AI can reliably understand creative intent without human confirmation;
- a claim that the system has been integrated with DNEG’s real production environment.

---

## 14. Success definition

The project succeeds when the implemented system can demonstrate that:

1. production facts can enter from ftrack through a formal connector;
2. shared creative intent can be structured into a confirmed primary anchor;
3. creative intent can be translated into secondary execution anchors;
4. Artists can receive role-appropriate task context and compare outputs against shared intent;
5. VFX and CG roles receive different but connected review perspectives;
6. version, feedback, anchor, assessment, and decision lineage remain traceable;
7. potential drift and cross-department conflicts are surfaced with evidence;
8. high-risk changes trigger human confirmation rather than automatic system action;
9. human decisions can be recorded and, where appropriate, selectively written back to ftrack;
10. the complete process remains understandable and controllable by human users.

---

## 15. Required reading for contributors and Claude Code

Before proposing architecture or changing code, read:

1. `docs/PROJECT_CONTEXT.md`
2. `docs/PRODUCT_SCOPE.md`
3. `docs/GLOSSARY.md`
4. `docs/ROLE_PERMISSIONS.md`
5. the relevant module contract
6. any applicable Architecture Decision Records

If a proposed implementation conflicts with this document, the conflict must be raised and resolved before coding continues.
