export type { paths, components, operations } from "./generated/api";

import type { components } from "./generated/api";

type Schemas = components["schemas"];

export type ProjectCreate = Schemas["ProjectCreate"];
export type ProjectRead = Schemas["ProjectRead"];
export type ShotCreate = Schemas["ShotCreate"];
export type ShotRead = Schemas["ShotRead"];
export type TaskCreate = Schemas["TaskCreate"];
export type TaskRead = Schemas["TaskRead"];

export type RecordSource = Schemas["ProjectRead"]["source"];

// Derived rather than hand-declared: HumanRole has no standalone OpenAPI
// schema of its own (it only ever appears inlined on fields like
// `confirmed_by_human_role`), so this stays in sync with the backend's
// literal automatically instead of duplicating it.
export type HumanRole = NonNullable<
  Schemas["CoreAnchorRevisionRead"]["confirmed_by_human_role"]
>;

export type IntentBriefCreate = Schemas["IntentBriefCreate"];
export type IntentBriefRead = Schemas["IntentBriefRead"];

export type CoreAnchorRead = Schemas["CoreAnchorRead"];
export type CoreAnchorRevisionRead = Schemas["CoreAnchorRevisionRead"];
export type CoreAnchorRevisionDraftCreate =
  Schemas["CoreAnchorRevisionDraftCreate"];
export type CoreAnchorRevisionUpdate = Schemas["CoreAnchorRevisionUpdate"];

export type ExecutionAnchorRead = Schemas["ExecutionAnchorRead"];
export type ExecutionAnchorRevisionRead =
  Schemas["ExecutionAnchorRevisionRead"];
export type ExecutionAnchorRevisionDraftCreate =
  Schemas["ExecutionAnchorRevisionDraftCreate"];
export type ExecutionAnchorRevisionUpdate =
  Schemas["ExecutionAnchorRevisionUpdate"];

export type AnchorConfirmRequest = Schemas["AnchorConfirmRequest"];
export type AnchorRejectRequest = Schemas["AnchorRejectRequest"];

export type DecisionRead = Schemas["DecisionRead"];

export type ContextSnapshotRead = Schemas["ContextSnapshotRead"];
export type AgentRunRead = Schemas["AgentRunRead"];

export type VersionCreate = Schemas["VersionCreate"];
export type VersionRead = Schemas["VersionRead"];
export type ReviewNoteCreate = Schemas["ReviewNoteCreate"];
export type ReviewNoteRead = Schemas["ReviewNoteRead"];

export type AlignmentState = Schemas["AlignmentAssessmentRead"]["alignment_state"];
export type AlignmentAssessmentRead = Schemas["AlignmentAssessmentRead"];

export type SyncCursorRead = Schemas["SyncCursorRead"];
export type SyncCursorUpsert = Schemas["SyncCursorUpsert"];

export type WritebackRecordRead = Schemas["WritebackRecordRead"];
export type WritebackRecordStatusUpdate =
  Schemas["WritebackRecordStatusUpdate"];

export type WorkerHeartbeatRead = Schemas["WorkerHeartbeatRead"];
export type WorkerHeartbeatUpsert = Schemas["WorkerHeartbeatUpsert"];

export type HTTPValidationError = Schemas["HTTPValidationError"];
export type ValidationError = Schemas["ValidationError"];
