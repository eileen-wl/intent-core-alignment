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

export type IntentDimensionAnalysis = Schemas["IntentDimensionAnalysis"];
export type IntentDecompositionDimensions =
  Schemas["IntentDecompositionDimensions"];
export type IntentDecompositionRead = Schemas["IntentDecompositionRead"];
export type CoreAnchorDraftFromDecompositionRequest =
  Schemas["CoreAnchorDraftFromDecompositionRequest"];

export type ExecutionAnchorRead = Schemas["ExecutionAnchorRead"];
export type ExecutionAnchorRevisionRead =
  Schemas["ExecutionAnchorRevisionRead"];
export type ExecutionAnchorRevisionDraftCreate =
  Schemas["ExecutionAnchorRevisionDraftCreate"];
export type ExecutionAnchorRevisionUpdate =
  Schemas["ExecutionAnchorRevisionUpdate"];

export type AnchorConfirmRequest = Schemas["AnchorConfirmRequest"];
export type AnchorRejectRequest = Schemas["AnchorRejectRequest"];

export type HumanGateRead = Schemas["HumanGateRead"];

export type DecisionRead = Schemas["DecisionRead"];

export type ContextSnapshotRead = Schemas["ContextSnapshotRead"];
export type AgentRunRead = Schemas["AgentRunRead"];

export type ContextEvidenceReference = Schemas["ContextEvidenceReference"];
export type ContextReconstructionItem = Schemas["ContextReconstructionItem"];
export type ContextReconstructionOutput =
  Schemas["ContextReconstructionOutput"];
export type ContextReconstructionRead = Schemas["ContextReconstructionRead"];

export type VersionCreate = Schemas["VersionCreate"];
export type VersionRead = Schemas["VersionRead"];
export type ReviewNoteCreate = Schemas["ReviewNoteCreate"];
export type ReviewNoteRead = Schemas["ReviewNoteRead"];

export type AlignmentState =
  Schemas["AlignmentAssessmentRead"]["alignment_state"];
export type AlignmentAssessmentRead = Schemas["AlignmentAssessmentRead"];
export type AssessmentDecisionRequest = Schemas["AssessmentDecisionRequest"];

export type VFXReviewEvidenceReference = Schemas["VFXReviewEvidenceReference"];
export type VFXReviewItem = Schemas["VFXReviewItem"];
export type VFXProposedFeedbackNote = Schemas["VFXProposedFeedbackNote"];
export type VFXSupervisorReviewOutput = Schemas["VFXSupervisorReviewOutput"];
export type VFXSupervisorReviewRead = Schemas["VFXSupervisorReviewRead"];

export type CGReviewEvidenceReference = Schemas["CGReviewEvidenceReference"];
export type CGReviewItem = Schemas["CGReviewItem"];
export type CGProposedExecutionGuidance =
  Schemas["CGProposedExecutionGuidance"];
export type CGSupervisorReviewOutput = Schemas["CGSupervisorReviewOutput"];
export type CGSupervisorReviewRead = Schemas["CGSupervisorReviewRead"];

export type ArtistEvidenceReference = Schemas["ArtistEvidenceReference"];
export type ArtistGuidanceItem = Schemas["ArtistGuidanceItem"];
export type ArtistFeedbackTranslation = Schemas["ArtistFeedbackTranslation"];
export type ArtistAgentGuidanceOutput = Schemas["ArtistAgentGuidanceOutput"];
export type ArtistAgentGuidanceRead = Schemas["ArtistAgentGuidanceRead"];
export type ArtistGuidanceGenerateRequest =
  Schemas["ArtistGuidanceGenerateRequest"];

export type CrossRoleEvidenceReference = Schemas["CrossRoleEvidenceReference"];
export type CrossRoleFinding = Schemas["CrossRoleFinding"];
export type RolePerspectiveRead = Schemas["RolePerspectiveRead"];
export type ReAnchorFieldProposal = Schemas["ReAnchorFieldProposal"];
export type ReAnchorProposalOutput = Schemas["ReAnchorProposalOutput"];
export type ReAnchorProposalRead = Schemas["ReAnchorProposalRead"];
export type CrossRoleAssessmentOutput = Schemas["CrossRoleAssessmentOutput"];
export type CrossRoleAssessmentRead = Schemas["CrossRoleAssessmentRead"];
export type CrossRoleAssessmentGenerateRequest =
  Schemas["CrossRoleAssessmentGenerateRequest"];
export type IntentSignalDriver = Schemas["IntentSignalDriver"];
export type RoleCoverage = Schemas["RoleCoverage"];
export type IntentSignalOutput = Schemas["IntentSignalOutput"];
export type IntentSignalRead = Schemas["IntentSignalRead"];

export type CoreAnchorContextRead = Schemas["CoreAnchorContextRead"];
export type ExecutionAnchorContextRead = Schemas["ExecutionAnchorContextRead"];
export type AnchorAttentionContextRead = Schemas["AnchorAttentionContextRead"];
export type AnchorVersionContextRead = Schemas["AnchorVersionContextRead"];
export type AnchorNextActionRead = Schemas["AnchorNextActionRead"];
export type AnchorContextRead = Schemas["AnchorContextRead"];

export type SyncCursorRead = Schemas["SyncCursorRead"];
export type SyncCursorUpsert = Schemas["SyncCursorUpsert"];

export type WritebackRecordRead = Schemas["WritebackRecordRead"];
export type WritebackRecordStatusUpdate =
  Schemas["WritebackRecordStatusUpdate"];

export type WorkerHeartbeatRead = Schemas["WorkerHeartbeatRead"];
export type WorkerHeartbeatUpsert = Schemas["WorkerHeartbeatUpsert"];

export type HTTPValidationError = Schemas["HTTPValidationError"];
export type ValidationError = Schemas["ValidationError"];

export type VfxCurrentFocusType =
  Schemas["VfxInboxCurrentFocusRead"]["focus_type"];
export type VfxInboxCurrentFocusRead = Schemas["VfxInboxCurrentFocusRead"];
export type VfxInboxNextFocusRead = Schemas["VfxInboxNextFocusRead"];
export type VfxInboxItemRead = Schemas["VfxInboxItemRead"];
export type VfxInboxRead = Schemas["VfxInboxRead"];

export type DepartmentExecutionAnchorState =
  Schemas["DepartmentExecutionTaskRead"]["execution_anchor_state"];
export type DepartmentExecutionLastUpdatedSource =
  Schemas["DepartmentExecutionTaskRead"]["last_updated_source"];
export type DepartmentExecutionVersionScope = NonNullable<
  Schemas["DepartmentExecutionTaskRead"]["latest_version_scope"]
>;
export type DepartmentExecutionTaskRead =
  Schemas["DepartmentExecutionTaskRead"];
export type DepartmentExecutionOverviewRead =
  Schemas["DepartmentExecutionOverviewRead"];

export type ShotActivityEventType =
  Schemas["ShotActivityEventRead"]["event_type"];
export type ShotActivityEventRead = Schemas["ShotActivityEventRead"];
export type ShotActivityRead = Schemas["ShotActivityRead"];

export type VersionMediaState = Schemas["VersionMediaRead"]["media_state"];
export type VersionMediaRead = Schemas["VersionMediaRead"];

export type CgCurrentFocusType =
  Schemas["CgInboxCurrentFocusRead"]["focus_type"];
export type ExecutionAnchorState =
  Schemas["CgInboxItemRead"]["execution_anchor_state"];
export type CgInboxCurrentFocusRead = Schemas["CgInboxCurrentFocusRead"];
export type CgInboxItemRead = Schemas["CgInboxItemRead"];
export type CgInboxRead = Schemas["CgInboxRead"];

export type TaskDependencyKind = Schemas["TaskDependencyRead"]["kind"];
export type TaskDependencyStatus = Schemas["TaskDependencyRead"]["status"];
export type TaskDependencySeverity = NonNullable<
  Schemas["TaskDependencyRead"]["severity"]
>;
export type TaskDependencyRead = Schemas["TaskDependencyRead"];
export type TaskDependencyCreate = Schemas["TaskDependencyCreate"];
export type EscalationCreate = Schemas["EscalationCreate"];

export type TaskActivityEventType =
  Schemas["TaskActivityEventRead"]["event_type"];
export type TaskActivityEventRead = Schemas["TaskActivityEventRead"];
export type TaskActivityRead = Schemas["TaskActivityRead"];

export type ArtistCurrentFocusType =
  Schemas["ArtistInboxCurrentFocusRead"]["focus_type"];
export type ArtistExecutionAnchorState =
  Schemas["ArtistInboxItemRead"]["execution_anchor_state"];
export type ArtistGuidanceState =
  Schemas["ArtistInboxItemRead"]["guidance_state"];
export type ArtistInboxCurrentFocusRead =
  Schemas["ArtistInboxCurrentFocusRead"];
export type ArtistInboxItemRead = Schemas["ArtistInboxItemRead"];
export type ArtistInboxRead = Schemas["ArtistInboxRead"];

export type ArtistFeedbackEventType =
  Schemas["ArtistFeedbackEventRead"]["event_type"];
export type ArtistFeedbackEventRead = Schemas["ArtistFeedbackEventRead"];
export type ArtistFeedbackHistoryRead = Schemas["ArtistFeedbackHistoryRead"];
