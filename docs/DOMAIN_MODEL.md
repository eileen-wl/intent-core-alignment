# DOMAIN_MODEL.md

**Project:** Intent Core Alignment System  
**Status:** Provisional domain model  
**Purpose:** Define the shared internal objects used by the Connector, backend, Agents, and Dashboard

## 1. Core principle

The system uses its own platform-independent data model.

ftrack, manual input, file import, and evaluation scenarios must all be converted into the same internal objects before they are used by Agents or the Dashboard.

## 2. Relationship overview

```text
Project
└── Sequence
    └── Shot
        ├── Task
        │   ├── Version
        │   │   ├── VersionArtifact
        │   │   ├── ReviewNote
        │   │   └── Assessment
        │   └── ExecutionAnchor
        ├── CoreAnchor
        ├── ShotAssembly
        ├── HumanGate
        └── Decision
```

Every important object may also be connected to:

- an external ftrack entity;
- a Context Snapshot;
- an Agent Run;
- an Audit Event.

## 3. Production context objects

| Object | Purpose | Important relationships |
|---|---|---|
| `Workspace` | Connected production environment | Has Projects and integration settings |
| `Project` | Top-level production context | Has Sequences, Shots, users |
| `Sequence` | Groups related Shots | Belongs to Project |
| `Shot` | Main creative-alignment unit | Has Tasks, Anchors, Versions, Assemblies |
| `Task` | Defined work for a department or user | Belongs to Shot; has Versions |
| `Department` | Animation, FX, Lighting, Comp, etc. | Linked to Tasks and Execution Anchors |
| `User` | Human system user | Has role assignments |
| `RoleAssignment` | User authority in a specific scope | Links User, role, Project/Shot/Task |
| `StatusMapping` | Maps external status to internal meaning | Belongs to Workspace profile |

Department and hierarchy names must be configurable because ftrack workspaces may differ.

## 4. Version and feedback objects

| Object | Purpose | Important relationships |
|---|---|---|
| `Version` | A recorded iteration of work | Belongs to Task or Shot; has Artifacts |
| `VersionArtifact` | Image, video, component, thumbnail, cache, metadata file | Belongs to Version |
| `ReviewNote` | Original human feedback | Linked to Version, Task, or Shot |
| `ReviewActionItem` | Structured action derived from notes | Must link to source Review Notes |
| `SubmissionRationale` | Artist-owned reason for submitting a Version | Linked to Version and author |
| `VersionRelation` | Parent, comparison, replacement, or dependency relation | Links two Versions |

Original Review Notes must never be replaced by an AI summary.

## 5. Intent objects

| Object | Purpose | Important relationships |
|---|---|---|
| `IntentBrief` | Original creative and production direction | Linked to Shot and sources |
| `CoreAnchor` | Primary Anchor identity | Has immutable revisions |
| `CoreAnchorRevision` | One confirmed or draft version of Primary Anchor | Linked to Shot and confirmer |
| `ExecutionAnchor` | Secondary Anchor identity for a Task/Department | Has revisions |
| `ExecutionAnchorRevision` | One version of execution requirements | Linked to exact CoreAnchorRevision |
| `IntentDimension` | Emotion, visual focus, rhythm, etc. | Used inside Anchor revisions |
| `Constraint` | Non-negotiable, preferred, or technical condition | Linked to Anchor revision |
| `VariationZone` | Allowed area of exploration | Linked to Anchor revision |
| `DriftRisk` | High-risk point requiring attention | Linked to Anchor revision |
| `Reference` | Source image, video, text, or link | Linked to Brief, Anchor, Task, or Version |
| `OpenQuestion` | Missing or disputed context | Linked to Anchor or workflow |

## 6. Anchor lifecycle

A `CoreAnchor` or `ExecutionAnchor` is the continuing identity.

Each change creates a new revision:

```text
CoreAnchor
├── Revision 1 — confirmed
├── Revision 2 — superseded
└── Revision 3 — active
```

Required rules:

- confirmed revisions are never overwritten;
- only one revision is active at a time;
- an Execution Anchor revision must point to the exact Core Anchor revision it translates;
- when the linked Core Anchor changes, the Execution Anchor is marked `stale` until reconfirmed;
- AI may create draft revisions only.

## 7. Agent and assessment objects

| Object | Purpose | Important relationships |
|---|---|---|
| `ContextSnapshot` | Immutable context used for one Agent Run | Links exact Anchor, Version, Notes, references |
| `AgentRun` | Record of a runtime Agent execution | Links prompt, model, input, output, status |
| `Assessment` | Structured analysis or risk judgement | Links AgentRun and target object |
| `AssessmentEvidence` | Source supporting an Assessment | Links to Note, frame, timecode, metadata, Anchor |
| `TechnicalCheck` | Deterministic rule result | Links to Version or Artifact |
| `ReAnchorProposal` | Proposed action when drift is suspected | Links to Assessment and evidence |
| `IntentSignalRecord` | Derived state and explanation at a point in time | Links to input Assessments and Gates |

An `Assessment` is not a `Decision`.

## 8. Cross-department objects

| Object | Purpose | Important relationships |
|---|---|---|
| `ShotAssembly` | Current combination of department Versions | Belongs to Shot |
| `AssemblyItem` | One selected department Version | Links Assembly, Department, Version |
| `CrossDepartmentConflict` | Potential incompatibility in an Assembly | Links affected items, Anchors, evidence |

This allows the system to represent “local optimum versus global alignment”.

## 9. Human-control objects

| Object | Purpose | Important relationships |
|---|---|---|
| `HumanGate` | Open decision requiring authorised human action | Links issue, target, required role, evidence |
| `Decision` | Formal human outcome | Resolves or supersedes a Gate/Decision |
| `WorkflowTransition` | Recorded state change | Links actor, before/after state, Decision |
| `AuditEvent` | Immutable significant activity log | Links actor, source, target, timestamp |

Decisions must record:

- authorised actor;
- decision type;
- rationale;
- related evidence;
- timestamp;
- affected entity;
- whether a write-back was requested.

## 10. Integration objects

| Object | Purpose |
|---|---|
| `IntegrationConnection` | One configured external connection |
| `FtrackWorkspaceProfile` | Workspace-specific mapping of hierarchy, task types, statuses, and fields |
| `ExternalEntityLink` | Connects an internal ID to an ftrack entity ID |
| `IntegrationEvent` | Raw or normalised incoming external event |
| `SyncCursor` | Last successful sync or reconciliation state |
| `WritebackRecord` | Tracks an outbound ftrack operation |
| `IntegrationError` | Failed sync, event, or write-back requiring review |

The pair `(provider, external_entity_type, external_id)` must be unique.

## 11. Core invariants

1. Production Facts, AI Proposals, and Human Decisions are separate records.
2. Every Assessment references one immutable Context Snapshot.
3. Every Assessment identifies the Anchor revision it used.
4. AI cannot create a confirmed Anchor or Decision.
5. Confirmed Anchor history is immutable.
6. Original Notes remain preserved.
7. Intent Signal is derived from other records and is not an editable truth.
8. ftrack entities are accessed through External Entity Links, not stored as raw Agent context.
9. Every authoritative workflow change has an authorised actor and Audit Event.
10. Synthetic scenarios use the same domain model but remain marked as synthetic.

## 12. Fields still requiring validation

The following are deliberately not final:

- exact ftrack hierarchy representation;
- external Task and Department mapping;
- external Status mapping;
- Version-to-Task relationships in the chosen workspace;
- Note parent types;
- Component and media-location fields;
- technical metadata available from ftrack;
- authentication and user identity mapping.
