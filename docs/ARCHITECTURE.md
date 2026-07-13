# ARCHITECTURE.md

**Project:** Intent Core Alignment System  
**Status:** Provisional architecture — to be refined after ftrack and runtime-model feasibility tests  
**Purpose:** Define the major system parts, their boundaries, and how information moves between them

## 1. Architecture decision

The product will be built as an **independent web system** with ftrack as its first Workflow Connector.

The recommended implementation is a **modular monolith with background workers**, rather than many microservices.

This means:

- one shared backend codebase contains clearly separated modules;
- background processes handle ftrack events, model calls, and media processing;
- modules communicate through internal contracts and events;
- the system can later split into services without rewriting the domain model.

This structure is appropriate for a small team using Claude Code because it reduces deployment and integration complexity while preserving clear boundaries.

## 2. High-level structure

```text
ftrack Studio
  │
  │ API / Event Hub / optional Webhook
  ▼
Ftrack Connector
  │  converts external records into internal objects
  ▼
Application Backend
  ├── Production Context
  ├── Intent & Anchor Management
  ├── Workflow Engine / Human Gates
  ├── Agent Orchestrator
  ├── Rule Engine
  ├── Cross-department Alignment
  └── Audit & Lineage
  │
  ├───────────────┬─────────────────┐
  ▼               ▼                 ▼
PostgreSQL     Object Storage     Background Queue
  │               │                 │
  │               └── media files   ├── model jobs
  │                                 ├── media jobs
  │                                 └── sync jobs
  ▼
Next.js Dashboard / ftrack-linked view
```

## 3. Main runtime parts

### 3.1 Web application

**Recommended technology:** Next.js + TypeScript

Responsibilities:

- role-aware Dashboard;
- Anchor editing and confirmation;
- Version and feedback review;
- Human Gate decisions;
- ftrack integration settings;
- audit and lineage views;
- context-aware page opened from ftrack.

The frontend must not contain the authoritative permission or workflow rules. It displays allowed actions, while the backend enforces them.

### 3.2 Backend API

**Recommended technology:** FastAPI + Python

Responsibilities:

- authentication and role checks;
- domain operations;
- Anchor versioning;
- Version, feedback, and decision lineage;
- workflow state transitions;
- Human Gates;
- Agent orchestration;
- Rule Engine;
- ftrack mapping and write-back commands;
- API used by the frontend.

The backend is the main authority for product behaviour.

### 3.3 Background worker

Responsibilities:

- runtime-model calls;
- media preprocessing;
- ftrack reconciliation;
- retrying failed jobs;
- long-running Assessments;
- rebuilding Context Snapshots;
- deriving Intent Signal inputs.

A request that may take several seconds or depend on an external service should normally become a background job rather than block the user interface.

### 3.4 Ftrack Connector process

Responsibilities:

- establish ftrack API sessions;
- inspect the connected workspace;
- import relevant entities;
- listen for relevant update events;
- translate ftrack entities into internal objects;
- reconcile missed changes;
- perform authorised write-back;
- prevent duplicate events and write-back loops.

Agents never call ftrack directly.

### 3.5 Model Gateway

Responsibilities:

- provide one internal interface to runtime models;
- select model and provider;
- enforce structured output;
- record model and prompt version;
- record latency, token usage, and errors;
- keep API keys server-side;
- allow the model provider to change without rewriting Agent logic.

Claude Code is not part of the runtime Model Gateway.

### 3.6 Media pipeline

Responsibilities:

- store Version previews and references;
- extract image/video metadata;
- create thumbnails and analysis proxies;
- extract video frames and timecodes when needed;
- link derived media back to the original Version Artifact.

Media analysis must preserve source references so that an Assessment can point to a frame or timecode.

## 4. Internal modules

The backend should contain these logical modules:

```text
production_context
intent
versions_and_feedback
workflow
agents
cross_department
media
integrations
audit
```

### Production Context
Projects, Shots, Tasks, users, departments, assignments, external statuses.

### Intent
Briefs, Primary Anchors, Secondary Execution Anchors, constraints, variation zones, references, revisions.

### Versions and Feedback
Versions, artifacts, Review Notes, action items, submission rationales, lineage.

### Workflow
Permissions, Human Gates, Decisions, valid transitions, escalation.

### Agents
Context Builder, Agent Orchestrator, prompt registry, structured outputs, Agent Run records.

### Cross-department
Shot Assemblies, department selections, conflicts, global-alignment Assessments.

### Integrations
ftrack workspace profile, entity mapping, sync state, integration events, write-back.

### Audit
Immutable records of significant system activity.

## 5. Information-flow rule

All information follows this pattern:

```text
External or manual input
→ validated internal object
→ Context Snapshot
→ Agent or Rule Assessment
→ Human Gate when required
→ Human Decision
→ optional controlled write-back
```

The following records must remain separate:

- production facts;
- human-confirmed Anchors;
- AI Proposals and Assessments;
- deterministic technical checks;
- Human Decisions.

## 6. Internal events

The system should use internal events to connect modules without making them depend directly on each other.

Examples:

- `PROJECT_SYNCED`
- `VERSION_PUBLISHED`
- `REVIEW_NOTE_ADDED`
- `CORE_ANCHOR_CONFIRMED`
- `EXECUTION_ANCHOR_CONFIRMED`
- `ASSESSMENT_COMPLETED`
- `HUMAN_GATE_OPENED`
- `DECISION_RECORDED`
- `WRITEBACK_REQUESTED`
- `WRITEBACK_COMPLETED`

For this project, internal events can be stored in PostgreSQL and dispatched through a background queue. A large streaming platform is unnecessary.

## 7. Workflow authority

The Workflow Engine is responsible for:

- checking role permissions;
- deciding whether an action is allowed;
- creating Human Gates;
- enforcing valid state changes;
- preventing Agents from approving or publishing;
- recording Decisions and transitions.

An Agent can recommend a transition but cannot execute an authoritative transition by itself.

## 8. Intent Signal architecture

Intent Signal is derived, not manually authored by an Agent.

Inputs may include:

- current Alignment Assessments;
- open Human Gates;
- confirmed Anchor violations;
- technical risks;
- cross-department conflicts;
- recent Human Decisions.

The Signal Engine converts these inputs into:

- Stable;
- Stretching;
- Drifting;
- Re-anchor Needed.

The user must be able to inspect the reasons behind the state.

## 9. Data storage

### PostgreSQL
Stores structured product, integration, workflow, and audit data.

### Object storage
Stores images, videos, references, previews, and derived analysis media.

### Background queue
Stores asynchronous jobs and retry state. Redis with a Python worker library is the provisional recommendation.

The exact hosted providers remain undecided.

## 10. Security boundary

- ftrack and model credentials exist only on the server.
- The browser never receives external API keys.
- Agents receive the minimum necessary Context Snapshot, not unrestricted database access.
- ftrack write-back requires a validated human-authorised command.
- Synthetic test data must remain separate from confidential production data.
- Every external call and write-back must be auditable.

## 11. Deployment shape

Provisional deployment units:

1. Next.js web application
2. FastAPI backend
3. Background worker
4. Ftrack Connector listener
5. PostgreSQL
6. Object storage
7. Redis or equivalent queue

These may run in containers and share one repository.

## 12. Architecture decisions still provisional

The following must be reviewed after feasibility testing:

- Event Hub versus Webhook as the main ftrack event source;
- exact ftrack entity and custom-field mapping;
- how media files can be accessed from the test workspace;
- runtime model provider and supported media input;
- worker framework;
- authentication provider;
- hosted database and storage provider;
- whether the ftrack embedded Widget is practical or a linked page is preferable.
