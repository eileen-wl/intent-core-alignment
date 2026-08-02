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

### 4.1 Implemented ftrack sync fields (Step 8)

`Version` and `ReviewNote` are the two objects in this section with a real, implemented ftrack sync path (`ADR-0014`, `docs/step-8/02_STEP_8B_VERSION_NOTE_SYNC_CONTRACT.md`). Both gained the following additive, nullable fields — no existing manually-created row's value ever changes:

| Field | On | Meaning |
|---|---|---|
| `task_id` | `Version` only | Nullable FK to `Task`. Set only when the synced ftrack `AssetVersion`'s own real Task is itself already linked; left `null` for every manually-created `Version` (preserving the existing "a Shot may have several Tasks and several Versions with no join between them" manual convention) and for a synced Version whose real Task was not itself linked. Never inferred from a Task name. |
| `source_created_at` | `Version`, `ReviewNote` | The source system's own creation time (`AssetVersion.date`/`Note.date` for ftrack). Nullable — only populated for synced rows. |
| `external_author_id` | `Version`, `ReviewNote` | The source system's stable author/creator id (`AssetVersion.user.id`/`Note.author.id` for ftrack) — never a username, email, or display name. Nullable; `null` only when the source row has no author relation at all. |
| `external_author_name` | `Version`, `ReviewNote` | A separate, independently-nullable display-only fallback (e.g. a username, or a composed first/last name) for showing source provenance in the UI. Never used for identity or permissions. |

Two existing fields keep their pre-Step-8 meaning unchanged, and are never redefined for a synced row:

- **`created_at`** remains ICAS-ingestion time — when this row was written into ICAS — for every `Version`/`ReviewNote`, manual or synced. It is not source-system time; a historical backfill sync can insert years of real history in one ingestion run, so `created_at` alone is never a safe chronological ordering key for synced rows. Use `source_created_at ?? created_at` for chronological ordering wherever a synced row may appear.
- **Actor provenance fields** (`created_by_actor_kind`, `created_by_actor_id`, `created_by_human_role`) also keep their existing meaning: for every ftrack-synced `Version`/`ReviewNote`, these are always exactly `"system"` / `"ftrack-sync"` / `null` — never derived from the ftrack author, and never given a `human_role`. An external author (`external_author_id`/`external_author_name`) is source-system provenance only — it never becomes, and is never displayed as, an ICAS Human VFX Supervisor, Human CG Supervisor, or Human Artist, and is never read by any permission check, `require_human_role` call, or Decision/HumanGate/Anchor-confirmation path.

`Version.task_id` is nullable specifically to preserve every existing and future manually-created `Version` as an unaffected Shot-level record — a manual `Version` never has ftrack identity, so this addition is purely additive from that row's perspective.

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
- Component and media-location fields;
- technical metadata available from ftrack;
- authentication and user identity mapping.

**Resolved by Step 8, no longer open:** Version-to-Task relationships (`Version.task_id`, nullable FK, real-workspace-validated — §4.1 above) and Note parent types (`asset_version` direct, and `review_session_object`-mediated one-hop; both real-workspace-validated, ADR-0014).
