import type {
  AgentRunRead,
  ContextSnapshotRead,
  CrossRoleEvidenceReference,
  HumanGateRead,
  IntentSignalRead,
  SyncCursorRead,
  WritebackRecordRead,
} from "@intent-core/contracts";

/** Development fixture -- not live production data.
 *
 * Isolated to this Development preview route only: no production
 * component embeds these values, and no page outside `/dev` imports
 * this module. Shaped exactly like the real contracts so the preview
 * exercises the same component props a real page will pass, but every
 * id, timestamp, and summary here is invented for demonstration only. */

export const FIXTURE_INTENT_SIGNAL: IntentSignalRead = {
  id: "fixture-intent-signal-1",
  cross_role_assessment_id: "fixture-assessment-1",
  project_id: "fixture-project-1",
  shot_id: "fixture-shot-1",
  task_id: "fixture-task-1",
  version_id: "fixture-version-1",
  attention_level: "high",
  signal_output: {
    attention_level: "high",
    label: "human_review_required",
    summary:
      "A high-priority cross-role tension was identified between camera timing and compositing contrast interpretations -- human review is warranted.",
    drivers: [
      {
        code: "cross_role_tension",
        summary: "VFX and CG interpret the confrontation's pacing differently.",
        priority: "high",
        assessment_section: "cross_role_tensions",
        assessment_item_index: 0,
      },
      {
        code: "anchor_clarity_gap",
        summary:
          "The Core Anchor's rhythm intensity field is open to two readings.",
        priority: "high",
        assessment_section: "re_anchor_proposal",
        assessment_item_index: 0,
      },
    ],
    role_coverage: { vfx_supervisor: true, cg_supervisor: true, artist: false },
    re_anchor_proposal_present: true,
    caveats: [
      "This is a development fixture; the underlying evidence trail is invented for demonstration.",
    ],
  },
  created_at: "2026-07-20T10:00:00Z",
};

export const FIXTURE_INTENT_SIGNAL_LOW: IntentSignalRead = {
  ...FIXTURE_INTENT_SIGNAL,
  id: "fixture-intent-signal-2",
  attention_level: "low",
  signal_output: {
    ...FIXTURE_INTENT_SIGNAL.signal_output,
    attention_level: "low",
    label: "low_attention",
    summary:
      "No cross-role tension, local-optimum risk, unresolved dependency, or material evidence gap was identified.",
    drivers: [],
    re_anchor_proposal_present: false,
  },
  created_at: "2026-07-18T09:00:00Z",
};

export const FIXTURE_EVIDENCE: CrossRoleEvidenceReference[] = [
  {
    source_type: "core_anchor_revision",
    source_id: "fixture-core-anchor-revision-1",
    label: "Confirmed Core Anchor revision 3",
  },
  {
    source_type: "vfx_supervisor_review",
    source_id: "fixture-vfx-review-1",
    label: "Latest VFX Supervisor review",
  },
];

export const FIXTURE_AGENT_RUN: AgentRunRead = {
  id: "fixture-agent-run-1",
  shot_id: "fixture-shot-1",
  context_snapshot_id: "fixture-context-snapshot-1",
  agent_type: "core_agent",
  capability: "cross_role_assessment",
  provider: "deepseek",
  model_name: "deepseek-chat",
  prompt_version: "core_cross_role_assessment.v1",
  status: "succeeded",
  result_revision_id: null,
  error: null,
  started_at: "2026-07-20T09:58:00Z",
  completed_at: "2026-07-20T10:00:00Z",
};

export const FIXTURE_AGENT_RUN_FAILED: AgentRunRead = {
  ...FIXTURE_AGENT_RUN,
  id: "fixture-agent-run-2",
  status: "failed",
  error: "Structured output failed schema validation (2 field errors).",
  completed_at: "2026-07-19T09:58:30Z",
};

export const FIXTURE_CONTEXT_SNAPSHOT: ContextSnapshotRead = {
  id: "fixture-context-snapshot-1",
  shot_id: "fixture-shot-1",
  payload: {},
  created_at: "2026-07-20T09:57:00Z",
};

export const FIXTURE_HUMAN_GATE: HumanGateRead = {
  id: "fixture-human-gate-1",
  shot_id: "fixture-shot-1",
  core_anchor_revision_id: "fixture-core-anchor-revision-2",
  execution_anchor_revision_id: null,
  gate_type: "core_anchor_confirmation",
  required_role: "vfx_supervisor",
  status: "pending",
  opened_at: "2026-07-21T08:00:00Z",
  resolved_at: null,
  resolved_by_actor_id: null,
  resolved_by_role: null,
  resolved_by_actor_type: null,
  rationale: null,
  decision_id: null,
  created_at: "2026-07-21T08:00:00Z",
  updated_at: "2026-07-21T08:00:00Z",
};

export const FIXTURE_WRITEBACK_PENDING: WritebackRecordRead = {
  id: "fixture-writeback-1",
  entity_type: "core_anchor_revision",
  entity_id: "fixture-core-anchor-revision-1",
  source: "ftrack",
  target_external_id: "fixture-external-1",
  content: "Core Anchor revision 3 confirmed.",
  status: "pending",
  external_note_id: null,
  error: null,
  created_at: "2026-07-21T09:00:00Z",
  completed_at: null,
};

export const FIXTURE_WRITEBACK_FAILED: WritebackRecordRead = {
  ...FIXTURE_WRITEBACK_PENDING,
  id: "fixture-writeback-2",
  status: "failed",
  error: "ftrack API returned a permission error for the target Note.",
  completed_at: "2026-07-21T09:05:00Z",
};

export const FIXTURE_SYNC_CURSOR: SyncCursorRead = {
  key: "ftrack_shot_reconciliation",
  last_synced_at: "2026-07-21T06:00:00Z",
  updated_at: "2026-07-21T06:00:05Z",
};
