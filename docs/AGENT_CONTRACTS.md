# AGENT_CONTRACTS.md

**Project:** Intent Core Alignment System  
**Status:** Provisional Agent contracts  
**Purpose:** Define what each runtime Agent reads, produces, and is forbidden to do

## 1. Runtime model

The product does not use four autonomous chatbots that talk freely to each other.

It uses an **Agent Orchestrator** that calls role-specific capabilities using:

- a shared internal data model;
- immutable Context Snapshots;
- role-specific prompts and rubrics;
- structured output schemas;
- permission rules;
- human confirmation points.

## 2. Common Agent Run contract

Every Agent Run must record:

- `agent_type`
- `capability`
- `target_entity`
- `context_snapshot_id`
- `model_id`
- `prompt_version`
- `input_schema_version`
- `output_schema_version`
- `status`
- `raw_output`
- `validated_output`
- `latency`
- `usage`
- `errors`
- `created_at`

## 3. Common output envelope

Every machine-consumed Agent output should follow this general shape:

```json
{
  "summary": "Short human-readable result",
  "observations": [],
  "inferences": [],
  "evidence": [],
  "confidence": 0.0,
  "open_questions": [],
  "recommended_actions": [],
  "requires_human_gate": false
}
```

Rules:

- observations describe available source material;
- inferences explain possible meaning;
- evidence points to identifiable sources;
- recommendations are proposals, not Decisions;
- confidence does not represent objective creative truth.

## 4. Core Agent

### Capabilities

#### Intent Decomposition
**Trigger:** Brief or direction added/updated  
**Reads:** IntentBrief, references, VFX input  
**Produces:** Intent Dimensions, candidate constraints, candidate variation zones, risk points, open questions

#### Primary Anchor Drafting
**Trigger:** VFX requests an Anchor draft  
**Reads:** Brief, decomposition, references, existing confirmed context  
**Produces:** Draft CoreAnchorRevision

#### Context Reconstruction
**Trigger:** New Version, Note, Anchor revision, or review preparation  
**Reads:** relevant history and current workflow state  
**Produces:** Context Snapshot summary with source links

#### Alignment Assessment
**Trigger:** Version or Assembly requires review  
**Reads:** exact Context Snapshot  
**Produces:** structured Alignment Assessment

#### Re-anchor Proposal
**Trigger:** significant drift risk or role conflict  
**Reads:** Assessment, Anchor history, evidence, Decisions  
**Produces:** affected dimensions, source of possible drift, questions, reference suggestions, proposed next actions

### Forbidden

- confirm or revise an active Anchor;
- create a Human Decision;
- approve or reject a Version;
- resolve a Human Gate;
- write to ftrack.

## 5. VFX Supervisor Agent

### Purpose
Support high-level creative review.

### Reads

- active Core Anchor revision;
- Brief and references;
- current and previous Versions;
- Review Notes and action items;
- Artist rationale;
- CG Assessments;
- current Shot Assembly;
- cross-department conflicts;
- relevant Human Decisions.

### Produces

- feedback clusters and priorities;
- creative-alignment Assessment;
- story/emotion/rhythm/visual-focus observations;
- likely drift dimensions;
- review questions;
- feedback draft;
- re-anchor recommendation;
- VFX Human Gate recommendation.

### Forbidden

- alter the Core Anchor;
- issue final creative approval;
- present inference as production fact;
- resolve the VFX Supervisor’s gate.

## 6. CG Supervisor Agent

### Purpose
Support translation of creative intent into safe technical execution.

### Reads

- active Core Anchor revision;
- relevant Execution Anchor revision;
- Task and Department;
- Version metadata and Artifacts;
- deterministic Technical Checks;
- dependencies and downstream Tasks;
- Artist rationale;
- Review Notes;
- current Shot Assembly.

### Produces

- Execution Anchor draft;
- technical-translation explanation;
- parameter-stability Assessment;
- production-readiness risk;
- downstream-impact Assessment;
- distinction between safe refinement and potential drift;
- CG Human Gate or VFX escalation recommendation.

### Forbidden

- redefine the Primary Anchor;
- treat technical convenience as approval for creative change;
- confirm production-ready state autonomously;
- publish or change external production state;
- resolve a Human Gate.

## 7. Artist Agent

### Purpose
Help the Artist act with access to the creative “why”.

### Reads

- current Task;
- active Core Anchor revision;
- relevant Execution Anchor revision;
- latest unresolved Review Notes;
- references;
- candidate or previous Versions;
- current Shot Assembly;
- role permission and escalation rules.

### Produces

- Task Context Brief;
- task why;
- must-preserve conditions;
- allowed changes;
- watch-outs;
- Version comparison;
- cross-department warning;
- Submission Rationale draft;
- questions or escalation recommendation.

### Forbidden

- modify either Anchor type;
- choose the final Version on behalf of the Artist;
- decide production readiness;
- approve a direction change;
- resolve a Human Gate.

## 8. Cross-department alignment capability

This is a shared capability, not necessarily a separate user-facing Agent.

### Reads

- Shot Assembly;
- selected department Versions;
- department Assessments;
- Execution Anchors;
- Primary Anchor;
- dependencies;
- available combined preview.

### Produces

- identified conflicts;
- affected intent dimensions;
- department interactions;
- evidence;
- required CG or VFX review;
- Human Gate recommendation.

### Forbidden

- select department Versions automatically;
- override department or VFX decisions.

## 9. Tool access

Agents may use controlled tools for:

- retrieving Context Snapshot records;
- retrieving source evidence;
- requesting media frames or metadata;
- requesting deterministic Technical Checks;
- creating draft Proposal or Assessment records.

Agents may not receive tools that:

- confirm Anchors;
- create Human Decisions;
- resolve Gates;
- update production Status;
- write directly to ftrack.

## 10. Context rules

The Context Builder must:

- include only role-relevant information;
- include exact active Anchor revisions;
- include unresolved Notes and relevant history;
- identify missing context;
- preserve source IDs;
- avoid sending unrestricted workspace data to the model;
- create an immutable Context Snapshot before the Agent call.

## 11. Validation and failure behaviour

- Outputs must pass schema validation before entering product workflow.
- Invalid output is retried or marked failed; it is not silently accepted.
- Unsupported claims must be flagged.
- Missing evidence lowers confidence and may require a Human Gate.
- Model failure must not block access to original production facts.
- An Agent may return “insufficient context” rather than invent an answer.

## 12. Prompt ownership

Prompts are versioned project assets.

A prompt change that alters:

- role authority;
- output meaning;
- Gate conditions;
- Anchor interpretation;
- evidence requirements;

requires review against Product Scope and Role Permissions.
