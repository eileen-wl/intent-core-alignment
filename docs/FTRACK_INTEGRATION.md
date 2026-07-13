# FTRACK_INTEGRATION.md

**Project:** Intent Core Alignment System  
**Status:** Provisional design — exact mappings must be validated against the team’s ftrack workspace  
**Purpose:** Define the boundary and intended behaviour of the first Workflow Connector

## 1. Integration objective

The ftrack Connector allows the independent Intent Alignment System to:

- receive production context from ftrack;
- react to relevant production changes;
- link internal intent records to external production records;
- open the correct internal context from ftrack;
- write back a limited set of human-confirmed results.

The Connector does not turn ftrack into the Intent Core and does not put Agent logic inside ftrack.

## 2. Boundary

```text
ftrack entities and events
→ Ftrack Connector
→ Canonical internal objects
→ Agents / Workflow / Dashboard
```

Agents never receive API credentials or raw ftrack sessions.

## 3. Provisional entity mapping

| ftrack concept | Internal object | Notes |
|---|---|---|
| Project | `Project` | Direct conceptual mapping |
| TypedContext / Object Type representing Sequence | `Sequence` | Determined by workspace profile |
| TypedContext / Object Type representing Shot | `Shot` | Determined by workspace profile |
| Task | `Task` | Task Type may map to Department |
| User | `User` | Linked to internal identity |
| Assignment | `RoleAssignment` | Exact relationship requires validation |
| AssetVersion | `Version` | Primary published-version mapping |
| Component | `VersionArtifact` | Media/file access depends on Location |
| Note | `ReviewNote` | Parent may be Version, Task, or review object |
| Status | External status + internal mapping | Mapping configurable per workspace |
| Custom Attribute | Metadata or mapped domain field | Must be explicitly configured |
| Thumbnail / preview Component | Preview Artifact | Accessibility requires validation |

In ftrack publishing, the Asset normally belongs to a production context, while the Task is associated with the AssetVersion. The Connector should therefore map Version context and Task association separately rather than assume the Asset is a child of the Task.

## 4. Workspace profile

Each connected workspace requires an `FtrackWorkspaceProfile` containing:

- hierarchy object types;
- which object type represents Sequence and Shot;
- task-type-to-department mapping;
- external Status mapping;
- relevant Custom Attributes;
- allowed read entities;
- allowed write-back fields;
- event filters;
- Action and Widget configuration;
- reconciliation settings.

No Agent prompt should contain workspace-specific field names.

## 5. Authentication

The server-side Connector uses:

- `FTRACK_SERVER`
- `FTRACK_API_USER`
- `FTRACK_API_KEY`

Credentials:

- stay on the server;
- are not stored in the browser;
- are not passed to Agents;
- use the minimum required permissions;
- must be revocable and auditable.

## 6. Synchronisation modes

### Initial sync

Purpose:

- discover or validate workspace mappings;
- import relevant Projects, hierarchy, Tasks, users, Versions, Components, Notes, and Statuses;
- create External Entity Links.

### Incremental sync

Primary provisional method:

- subscribe to relevant ftrack update events through the Event Hub.

Optional method:

- use ftrack Webhooks if supported and easier to operate in the selected workspace.

The event payload is treated as a notification. The Connector may re-query the affected entity to build a complete internal record.

### Reconciliation

A scheduled process re-queries records changed since the last successful sync to recover:

- missed events;
- listener downtime;
- partial failures;
- mapping inconsistencies.

Real-time events alone are not considered sufficient.

## 7. Internal event normalisation

External changes become internal events such as:

- `PROJECT_SYNCED`
- `SHOT_SYNCED`
- `TASK_SYNCED`
- `VERSION_PUBLISHED`
- `VERSION_UPDATED`
- `REVIEW_NOTE_ADDED`
- `STATUS_CHANGED`
- `ASSIGNMENT_CHANGED`

The event contains internal IDs after mapping. Downstream modules do not depend on ftrack payload structure.

## 8. Idempotency and duplicate prevention

The Connector must use:

- unique External Entity Links;
- external update timestamps where available;
- event fingerprints;
- idempotent upsert operations;
- Writeback Records;
- origin markers for system-created Notes or updates.

Processing the same event twice must not create duplicate Versions, Notes, Assessments, or write-backs.

## 9. Version and media handling

For an AssetVersion, the Connector should attempt to import:

- external ID;
- version number;
- creator;
- linked Task;
- Asset and context;
- Status;
- creation/update time;
- Components;
- preview or thumbnail;
- accessible file metadata.

A Component becomes a `VersionArtifact`.

The Connector must not assume that every Component is directly downloadable. File access depends on ftrack Location configuration and permissions.

When media is inaccessible, the internal Version remains valid and the Dashboard may request:

- manual preview upload;
- accessible proxy;
- metadata-only review;
- later media reconciliation.

## 10. Notes and feedback

The Connector preserves original Note content, author, timestamp, and parent relationship.

AI-generated clusters or action items are stored internally and do not replace the original ftrack Note.

A Note may be attached to different ftrack entities or review contexts, so the mapping must preserve the external parent and resolve the most relevant internal target.

## 11. Entry from ftrack

Two supported patterns are planned:

### Action
A user selects a Shot, Task, or Version and launches an action such as:

- Open Intent Alignment;
- Review Drift Risk;
- Open Human Gate.

The Action opens a context-aware internal URL.

### Custom Widget / Web View
A lightweight internal page may be embedded in ftrack if:

- the workspace permits custom widgets;
- the application is hosted over HTTPS;
- iframe and communication settings are compatible.

The full Dashboard remains independent even if a Widget is used.

## 12. Write-back policy

Allowed provisional write-backs:

- human-confirmed Review Note;
- request for revision;
- approved Status change;
- link to an internal review or Gate;
- explicitly approved summary field.

Not allowed:

- raw Agent output;
- unconfirmed Assessment;
- automatic Anchor content;
- autonomous approval;
- unrestricted custom-field updates.

Write-back flow:

```text
Human Decision
→ permission check
→ Writeback command
→ Connector
→ ftrack commit
→ Writeback Record
→ incoming event recognised as system-originated
```

## 13. Failure handling

The Connector must handle:

- invalid credentials;
- missing permissions;
- event disconnection;
- unavailable entities;
- failed queries;
- failed commits;
- missing Components;
- inaccessible Locations;
- changed workspace schema;
- duplicate events;
- partial sync;
- write-back loops.

Failures are stored as `IntegrationError` records and shown in integration settings.

## 14. Performance rules

- request only fields needed for the current operation;
- avoid one API query per item when batch queries are possible;
- cache stable workspace configuration;
- process events asynchronously;
- separate event receipt from full entity synchronisation;
- use reconciliation windows rather than full imports for every restart.

## 15. Claims and data boundary

A team-created ftrack workspace with synthetic production data validates technical integration with ftrack.

It does not validate:

- DNEG’s custom workspace configuration;
- DNEG’s permissions or security policy;
- DNEG’s live production data;
- production-scale performance;
- adoption by real DNEG teams.

## 16. Open questions for the skipped feasibility test

- Which ftrack hierarchy entities are available?
- How are Sequence and Shot represented?
- Which Note parents are used in the workspace?
- Can the API identity read and write required fields?
- Which AssetVersion Components are accessible?
- Which event payloads are received?
- Are Webhooks available and permitted?
- Can Actions and Custom Widgets be configured?
- How can system-originated write-back be marked?
- Which Custom Attributes are useful?
- Which Status changes are safe to write?
