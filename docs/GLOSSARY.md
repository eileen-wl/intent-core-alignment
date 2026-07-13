# GLOSSARY.md

**Project:** Intent Core Alignment System  
**Purpose:** Keep terminology consistent across documents, code, prompts, and UI

### Creative Intent
The shared creative purpose a shot, task, version, or decision is expected to serve. It includes both what should be achieved and why it matters.

### Intent Core
The shared, versioned source of truth for Anchors, constraints, references, risks, linked versions, assessments, and human decisions. It is not an Agent.

### Primary Anchor
The human-confirmed creative reference for a shot or task. Confirmed and revised by the VFX Supervisor. Preferred code term: `CoreAnchor`.

### Secondary Execution Anchor
A department- or task-specific translation of the Primary Anchor into execution requirements. Confirmed and revised by the CG Supervisor. Preferred code term: `ExecutionAnchor`.

### Anchor Draft
A proposed Anchor that has not yet been confirmed by the authorised human role.

### Anchor Revision
A preserved version created when a confirmed Anchor changes. Previous revisions must remain traceable.

### Non-negotiable
A confirmed condition that cannot change without escalation and human approval.

### Allowed Variation
A defined area in which exploration or refinement is permitted without automatically triggering a direction-level conflict.

### High-risk Drift Point
A dimension particularly vulnerable to being weakened or unintentionally changed during iteration.

### Alignment
The degree to which a version, change, or decision still serves the relevant confirmed Anchor.

### Drift
A meaningful movement away from a confirmed Anchor. Not every difference is Drift.

### Local Optimum
A choice that performs well within one department or task but may conflict with overall shot alignment.

### Global Alignment
The coherence of the combined shot across departments in relation to the Primary Anchor.

### Re-anchor
A human-controlled process of revisiting, reconfirming, or revising the Anchor when the current direction may have drifted.

### Intent Signal
An explainable state indicator showing current alignment condition. Initial states: Stable, Stretching, Drifting, Re-anchor Needed. It is not a separate Agent.

### Production Fact
A factual record from ftrack or controlled input, such as a Task, Version, Note, assignment, or status. Production Facts remain separate from AI interpretation.

### Version
A recorded iteration of work associated with a Task, Shot, Asset, or department output. A Version is not automatically approved or production-ready.

### Review Note
An original human feedback record. AI summaries must not overwrite it.

### Shot Assembly
A recorded combination of department-level Versions used to evaluate the shot as a whole.

### Cross-department Conflict
A potential incompatibility between department choices, dependencies, or creative outcomes.

### Context Snapshot
An immutable record of the exact relevant context supplied to an Agent Run.

### Assessment
A structured AI- or rule-assisted analysis. It may identify status, risks, evidence, and recommended questions, but it is not a final decision.

### AI Proposal
Any AI-generated draft, suggestion, interpretation, or recommendation that has not been confirmed by a human.

### Human Gate
A workflow control point requiring explicit action from an authorised human role.

### Human Decision
A formal choice made by an authorised person, such as accept, reject, request revision, hold, or revise an Anchor.

### Escalation
Transfer of an unresolved question to the role with the required authority.

### Agent
A role-specific AI-assisted capability with defined inputs, context access, outputs, and permission boundaries. It is not assumed to be fully autonomous.

### Core Agent
Supports intent decomposition, Anchor drafting, context reconstruction, alignment checking, re-anchor suggestions, and Intent Signal support.

### VFX Supervisor Agent
Supports creative review, feedback interpretation, drift detection, review preparation, and VFX-level escalation.

### CG Supervisor Agent
Supports technical translation, Secondary Anchor drafting, production-readiness risk analysis, downstream impact, and CG-level escalation.

### Artist Agent
Supports task why, Anchor-to-action translation, output comparison, submission rationale, and escalation.

### Human Authorship
The principle that people retain responsibility for creative direction, interpretation, and final decisions.

### Workflow Connector
The bounded integration layer that converts external production-platform data into the system’s internal data model and supports controlled write-back.

### ftrack Connector
The first formal Workflow Connector. It handles ftrack authentication, mapping, sync, events, recovery, and approved write-back.

### Canonical Data Model
The platform-independent internal representation used by Agents, workflow logic, the Dashboard, and evaluation.

### External Entity Link
A record connecting an internal object to its corresponding external ftrack object.

### Write-back
A controlled operation that sends approved information from the Intent Alignment System to ftrack.

### Workflow Engine
The application component that enforces valid state transitions and permissions. Workflow authority must not depend only on an Agent prompt.

### Rule Engine
The component that performs deterministic checks such as frame rate, file format, metadata, permissions, and valid status transitions.

### Lineage
The traceable relationship between briefs, Anchors, versions, notes, assessments, Human Gates, decisions, and ftrack records.

### Source of Truth
The authoritative record for a category of information. ftrack owns the production facts it manages; the Intent Core owns confirmed Anchors and intent decision lineage; human decisions own final controlled choices.

### Synthetic Production Data
Artificially created project data used for testing and demonstration. It must not be presented as DNEG production data or hard-coded into product logic.

### Claude Code
The AI-assisted development tool used by the team. It is separate from the runtime Agent system used by the deployed product.
