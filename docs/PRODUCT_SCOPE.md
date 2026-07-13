# PRODUCT_SCOPE.md

**Project:** DNEG × MA Digital Innovation — Intent Core Alignment System  
**Document type:** Product scope / source of truth  
**Status:** Working baseline for team and Claude Code  
**Last updated:** 2026-07-13

---

## 1. Purpose of this document

This document defines what the team is building.

It is intended to prevent:

- different team members building different versions of the product;
- Claude Code sessions inventing new product boundaries;
- the project drifting into a generic production tracker, chatbot, or AI review tool;
- ftrack integration being treated as an afterthought;
- human approval responsibilities being replaced by AI automation.

This document defines:

- the final product;
- the product’s major capability areas;
- the responsibilities of the independent system;
- the responsibilities of ftrack;
- the boundaries of each user role;
- the minimum complete end-to-end workflow;
- the features that are explicitly outside the product scope;
- the conditions under which a feature can be considered complete.

This is a product scope document, not a technical architecture or implementation plan.

---

## 2. Product definition

The product is the **Intent Core Alignment System**.

It is an independent, role-aware, AI-assisted system for animation and VFX production teams.

Its purpose is to help teams maintain shared creative intent across:

- brief interpretation;
- AI-assisted generation and revision;
- review notes;
- version comparison;
- technical execution;
- cross-department collaboration;
- approval and escalation;
- repeated production iterations.

The system structures creative intent as a shared anchor, translates it into role-appropriate execution context, compares new versions and decisions against that anchor, and surfaces possible drift before it becomes embedded in the workflow.

The product must preserve human authority.

It may:

- interpret;
- structure;
- compare;
- summarise;
- identify risks;
- propose actions;
- prepare decisions.

It may not:

- silently redefine creative intent;
- approve a version autonomously;
- modify an anchor without human confirmation;
- replace role-specific professional judgement;
- move production work forward without the required human gate.

---

## 3. Product composition

The complete product consists of six connected parts:

1. **Intent Core**
2. **Core Agent**
3. **Role Agents**
4. **Workflow and Human Gate Layer**
5. **Shared Dashboard**
6. **ftrack Workflow Connector**

All six are part of the intended final system.

---

## 4. Intent Core

The Intent Core is the system’s shared source of truth for creative alignment.

It must contain and manage:

- original brief and source context;
- primary creative anchor;
- secondary execution anchors;
- anchor revisions;
- non-negotiable constraints;
- allowed variation;
- high-risk drift points;
- references;
- unresolved questions;
- current intent status;
- links between versions, feedback, assessments, and decisions.

The Intent Core must not be implemented as a single long text field.

Its key information must be structured so that:

- different roles can read different views of the same intent;
- versions can be compared against specific dimensions;
- changes can be traced to a particular anchor revision;
- AI output can cite the source context it used;
- humans can inspect and correct the system’s interpretation.

---

## 5. Anchor model

### 5.1 Primary anchor

The primary anchor represents the shared creative direction for a shot or task.

It may contain:

- core creative intent;
- shot objective;
- emotional tone;
- visual focus;
- rhythm and intensity;
- character relationship;
- narrative priority;
- non-negotiable constraints;
- allowed variation;
- relevant references;
- high-risk drift points.

The VFX Supervisor is the human authority responsible for confirming and revising the primary anchor.

The Core Agent may create a draft, but it cannot confirm the anchor.

### 5.2 Secondary execution anchor

A secondary execution anchor translates the primary anchor into department-specific execution requirements.

There may be separate secondary anchors for:

- animation;
- FX;
- lighting;
- comp;
- asset;
- technical direction;
- other relevant departments.

A secondary execution anchor may contain:

- technical boundaries;
- parameter ranges;
- delivery conditions;
- production-ready criteria;
- downstream dependencies;
- publish requirements;
- allowed refinements;
- escalation conditions.

The CG Supervisor is the human authority responsible for confirming and revising secondary execution anchors.

A secondary anchor may not redefine the primary creative direction.

### 5.3 Artist access

The Artist can:

- read the confirmed primary anchor;
- read relevant secondary anchors;
- receive role-specific task context;
- compare versions against the anchors;
- prepare a submission rationale;
- raise uncertainty or request escalation.

The Artist cannot:

- confirm or revise the primary anchor;
- confirm or revise a secondary execution anchor;
- approve a change to creative direction;
- independently resolve a conflict that exceeds the execution boundary.

---

## 6. Core Agent scope

The Core Agent is responsible for shared intent interpretation and context maintenance.

The complete Core Agent scope includes:

### 6.1 Intent decomposition

The system helps break a brief or direction into structured dimensions such as:

- emotion;
- visual focus;
- rhythm;
- character relationship;
- narrative purpose;
- technical constraints;
- visual detail constraints;
- possible non-negotiables;
- possible variation zones.

The result is a draft for human review.

### 6.2 Anchor drafting

The system helps turn the structured intent into a primary anchor draft.

The VFX Supervisor must be able to:

- inspect the source;
- edit the draft;
- reject incorrect interpretations;
- add missing constraints;
- confirm the final anchor.

### 6.3 Context reconstruction

The system reconstructs the current context of a shot or task from:

- brief;
- references;
- anchor revisions;
- versions;
- review notes;
- unresolved questions;
- human decisions;
- department state;
- role assignments.

The result must help users understand not only the current task, but why the task exists and how the current state was reached.

### 6.4 Alignment checking

The system compares a version, decision, or change against:

- the relevant primary anchor;
- the relevant secondary execution anchor;
- the latest confirmed feedback;
- previous versions;
- current cross-department state.

The system must identify which intent dimensions may have changed.

### 6.5 Re-anchor support

When a possible drift is detected, the system may propose:

- which anchor dimension may have weakened;
- where the change first appeared;
- which reference should be revisited;
- what question should be asked;
- whether a human gate is required;
- whether the anchor itself may need to be reconsidered.

The system does not decide the outcome.

### 6.6 Intent Signal

The system displays a lightweight current intent state.

The agreed initial states are:

- Stable;
- Stretching;
- Drifting;
- Re-anchor Needed.

The signal must be explainable. A user must be able to inspect why the current state was assigned.

---

## 7. VFX Supervisor Agent scope

The VFX Supervisor Agent supports creative alignment and review.

It must support:

- viewing and editing the primary anchor;
- feedback grouping;
- feedback prioritisation;
- identification of repeated or contradictory notes;
- preparation for review;
- comparison of versions against story, emotion, rhythm, visual focus, and director intent;
- identification of possible creative drift;
- identification of changes that require anchor confirmation;
- creation of re-anchor questions and review prompts;
- preparation of human-readable feedback drafts;
- review of cross-department conflicts that affect the primary anchor.

It must not:

- approve a version automatically;
- revise the primary anchor without confirmation;
- present its creative judgement as objective fact;
- replace the VFX Supervisor’s final decision.

---

## 8. CG Supervisor Agent scope

The CG Supervisor Agent supports technical translation, production coordination, and execution alignment.

It must support:

- translating the primary anchor into execution-level criteria;
- creating secondary execution anchor drafts;
- checking whether technical implementation still serves the primary anchor;
- identifying parameter drift;
- identifying production-readiness risks;
- checking downstream implications;
- distinguishing creative exploration from production-ready work;
- identifying when a technical constraint may affect creative direction;
- escalating primary-anchor conflicts to the VFX Supervisor or Human Gate;
- preparing technical review summaries.

It must not:

- redefine story, emotion, or visual direction independently;
- change the primary anchor;
- treat technical convenience as automatic justification for a creative change;
- approve a version or publish it autonomously;
- replace the CG Supervisor’s professional judgement.

---

## 9. Artist Agent scope

The Artist Agent supports execution with greater access to creative reasoning.

It must support:

- Task Context Briefing;
- explanation of task why;
- translation of primary and secondary anchors into current actions;
- identification of must-preserve conditions;
- identification of allowed variation;
- identification of watch-outs;
- comparison of multiple AI-assisted outputs;
- explanation of how outputs align or conflict with anchors;
- warning about cross-department conflicts;
- preparation of submission rationale;
- identification of questions that require escalation;
- preparation of a version for review.

It must not:

- choose the final version on behalf of the Artist;
- modify any anchor;
- approve a creative direction change;
- determine production readiness independently;
- act as a generic content generator whose primary function is to produce more options.

---

## 10. Cross-department alignment scope

The product must support alignment beyond a single department.

It must be possible to represent a current shot assembly or version combination containing outputs from different departments, for example:

- animation version;
- FX version;
- lighting version;
- comp version;
- other relevant department versions.

The system must be able to surface:

- conflicts between department-level choices;
- cases where each department’s selected version is locally strong but globally inconsistent;
- changes that reinforce or weaken the primary anchor;
- downstream risks;
- questions requiring CG or VFX review.

The product must not assume that a department-level optimum is automatically the best shot-level choice.

---

## 11. Version, feedback, and decision lineage

The system must keep a traceable relationship between:

- the original brief;
- references;
- primary anchor revisions;
- secondary anchor revisions;
- versions;
- review notes;
- AI assessments;
- technical checks;
- submission rationales;
- human gates;
- human decisions;
- ftrack records.

A user must be able to answer:

- which anchor version was active when this assessment was generated;
- which review note led to this revision;
- which version introduced a possible drift;
- which person confirmed or rejected a proposed change;
- whether the final decision was written back to ftrack;
- whether an AI assessment was accepted, edited, or rejected.

Historical records must not be overwritten.

---

## 12. Human Gate scope

A Human Gate is required when the system identifies a decision that exceeds the current role or automation boundary.

Human Gates may be triggered by:

- a possible primary-anchor violation;
- a conflict between primary and secondary anchors;
- a technical limitation that may change creative direction;
- a cross-department conflict;
- a high-risk drift;
- a request to revise the primary anchor;
- disagreement between role-specific assessments;
- uncertainty that cannot be resolved from available context;
- a production-state change requiring human approval.

A Human Gate must display:

- the issue;
- the related shot, task, or version;
- relevant anchors;
- evidence;
- role-specific assessments;
- possible actions;
- the human role required to decide.

A Human Gate must not be resolved by an Agent.

---

## 13. Dashboard scope

The Shared Dashboard is a required part of the product.

It must provide role-aware views rather than one generic interface.

### 13.1 Shared shot view

Must include:

- shot and task context;
- current primary anchor;
- secondary anchor status;
- current intent signal;
- latest versions;
- open feedback;
- open Human Gates;
- current cross-department state;
- version and decision timeline.

### 13.2 VFX Supervisor view

Must include:

- primary anchor editor;
- creative review summary;
- feedback clusters;
- version comparison;
- drift timeline;
- re-anchor controls;
- VFX-specific Human Gates.

### 13.3 CG Supervisor view

Must include:

- secondary execution anchor editor;
- technical constraints;
- production-readiness checks;
- parameter change view;
- downstream impact;
- escalation controls;
- CG-specific Human Gates.

### 13.4 Artist view

Must include:

- task why;
- must preserve;
- allowed variation;
- relevant references;
- current feedback;
- version comparison;
- cross-department warnings;
- submission rationale;
- escalation controls.

### 13.5 Audit and history view

Must include:

- anchor history;
- Agent runs;
- model and prompt version;
- assessment evidence;
- human corrections;
- workflow decisions;
- ftrack sync and write-back history.

The interface must visually distinguish:

- production facts;
- human-confirmed intent;
- AI-generated proposals;
- human decisions.

---

## 14. ftrack integration scope

ftrack is the first formal Workflow Connector.

The integration is part of the product scope, not an optional demonstration layer.

### 14.1 Data read from ftrack

The connector should support relevant production entities including:

- project;
- sequence or hierarchy context;
- shot;
- task;
- user and assignment context;
- asset or published version;
- version components or preview references;
- review notes;
- status;
- relevant custom fields;
- relevant update events.

The connector must not assume that every ftrack workspace has the same schema.

### 14.2 Internal mapping

All ftrack entities must be mapped into platform-independent internal objects.

Agents and the Dashboard must not operate directly on raw ftrack objects.

The system must keep links between internal and external records.

### 14.3 Event handling

The connector must support:

- initial import;
- relevant update events;
- duplicate prevention;
- reconnect and recovery;
- reconciliation after missed events;
- sync error tracking.

### 14.4 Entry points

The integration should support suitable ftrack entry points such as:

- Action;
- embedded Widget;
- link to the independent Dashboard;
- context-aware opening of the correct shot, task, or version.

### 14.5 Write-back

The product may write back selected human-confirmed information such as:

- approved review note;
- request for revision;
- selected status change;
- link to the full Intent Dashboard;
- approved summary field.

Raw AI assessments must not be written back automatically.

All write-backs must be:

- human-confirmed;
- permission-checked;
- traceable;
- protected from duplicate loops.

### 14.6 Claim boundary

A connection to a team-created ftrack workspace does not mean the product is integrated with DNEG’s real production environment.

The project may claim:

> The system is technically integrated with a standard ftrack environment using a controlled production scenario.

It may not claim:

> The system is integrated with DNEG’s live workflow or validated against DNEG production data.

---

## 15. Manual and file-based input scope

The independent system must also support controlled input without ftrack.

This is necessary for:

- direct use of the independent system;
- research testing;
- scenario evaluation;
- handling context that is not stored in ftrack;
- demonstrating system behaviour when external integration is unavailable.

Supported input may include:

- text brief;
- uploaded reference;
- image;
- video;
- review note;
- technical metadata;
- structured file import.

Manual and file-based input must produce the same internal object types used by the ftrack connector.

Demonstration data must not be hard-coded into the product logic.

---

## 16. AI and model scope

The product may use text and multimodal models for:

- intent decomposition;
- anchor drafting;
- context summarisation;
- version comparison;
- creative alignment assessment;
- feedback grouping;
- review preparation;
- task briefing;
- rationale drafting;
- re-anchor suggestions;
- cross-department risk interpretation.

Model output must:

- follow a defined structure;
- identify evidence where possible;
- distinguish observation from inference;
- include uncertainty where appropriate;
- remain linked to the input context;
- be reviewable by humans;
- remain versioned and auditable.

Models must not be used as the sole authority for deterministic checks such as:

- frame rate equality;
- file naming;
- required metadata;
- task status rules;
- version numbering;
- unresolved blocking notes;
- permission checks.

These belong to standard software rules.

---

## 17. Product-level permissions

The minimum role permissions are:

### VFX Supervisor

Can:

- confirm and revise the primary anchor;
- resolve creative-direction Human Gates;
- accept or reject a proposed direction change;
- confirm re-anchoring;
- issue formal creative review decisions.

### CG Supervisor

Can:

- read the primary anchor;
- create and revise secondary execution anchors;
- resolve technical execution gates within their authority;
- request escalation;
- prepare formal technical review decisions.

Cannot:

- independently revise the primary anchor.

### Artist

Can:

- read relevant anchors;
- read task context;
- upload or submit versions;
- provide rationale;
- raise questions;
- request escalation.

Cannot:

- revise or confirm anchors;
- approve a direction change;
- resolve a production-level or creative Human Gate.

### Agent

Can:

- propose;
- analyse;
- summarise;
- compare;
- recommend;
- prepare drafts.

Cannot:

- confirm an anchor;
- approve a version;
- resolve a Human Gate;
- modify a human decision;
- perform an unapproved ftrack write-back.

Permissions must be enforced by the application, not only described in prompts or hidden in the interface.

---

## 18. Required end-to-end product workflow

The complete product must be able to support this workflow:

1. A project, shot, task, version, and review context enters from ftrack or manual input.
2. The Core Agent interprets the brief and prepares an intent decomposition.
3. The system prepares a primary anchor draft.
4. The VFX Supervisor edits and confirms the primary anchor.
5. The CG Supervisor Agent prepares relevant secondary execution anchor drafts.
6. The CG Supervisor edits and confirms the secondary anchors.
7. The Artist receives task why, constraints, variation zones, references, and escalation conditions.
8. A new version is submitted or synchronised from ftrack.
9. The system reconstructs the current context.
10. The system performs creative alignment analysis.
11. The system performs technical and production checks.
12. The Artist receives version comparison and submission support.
13. The CG Supervisor receives execution and downstream-risk analysis.
14. The VFX Supervisor receives creative alignment and drift analysis.
15. Cross-department conflicts are surfaced when relevant.
16. A Human Gate is created when the change exceeds the current authority boundary.
17. The required human makes the decision.
18. The decision is recorded with evidence and rationale.
19. Approved information may be selectively written back to ftrack.
20. The complete lineage remains visible and auditable.

---

## 19. Explicitly out of scope

The product is not intended to include:

- a replacement for ftrack;
- full project scheduling;
- full resource planning;
- payroll or time tracking;
- production budgeting;
- a complete digital asset management system;
- a full review player equivalent to specialist review software;
- a new generative image, video, or animation foundation model;
- autonomous creative approval;
- autonomous production publishing;
- unrestricted model access to confidential production data;
- automatic modification of DCC project files;
- automatic rigging, simulation, lighting, compositing, or rendering;
- a claim of proven effectiveness in real DNEG production;
- a claim that the proposed CG Supervisor pain point has already been fully validated;
- a generic team chatbot unrelated to shot, task, version, and anchor context.

These areas may be discussed as future context, but they must not be introduced into the current product without an approved scope decision.

---

## 20. Product completion conditions

A feature is not complete only because:

- a page exists;
- a model returns text;
- a mock interaction looks correct;
- a hard-coded scenario produces the expected result.

A feature is complete when:

- its input source is defined;
- its output is structured;
- the correct role can access it;
- prohibited roles cannot change it;
- its relationship to anchors and versions is traceable;
- AI output is visibly distinguished from human confirmation;
- relevant error states are handled;
- it works through the same internal domain model as the rest of the product;
- it has an agreed test or evaluation method;
- it does not violate the product boundaries in this document.

---

## 21. Scope change rule

Any proposal that changes one of the following requires team review before implementation:

- the authority of a user role;
- the meaning of a primary or secondary anchor;
- the boundary between the independent system and ftrack;
- what the system may write back to ftrack;
- whether an Agent can perform a workflow transition;
- the required end-to-end workflow;
- a new production-management capability;
- a new external platform dependency;
- removal of traceability or human confirmation.

The change must be recorded in an Architecture or Product Decision Record before code is modified.

---

## 22. Required reading

Before implementing or reviewing a feature, contributors and Claude Code must read:

1. `docs/PROJECT_CONTEXT.md`
2. `docs/PRODUCT_SCOPE.md`
3. `docs/GLOSSARY.md`
4. `docs/ROLE_PERMISSIONS.md`
5. the relevant Agent or integration contract
6. any applicable decision records

When a feature request conflicts with this scope, the conflict must be resolved explicitly rather than silently implemented.
