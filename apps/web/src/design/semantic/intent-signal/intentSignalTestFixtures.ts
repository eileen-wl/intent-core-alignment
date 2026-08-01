import type { IntentSignalRead } from "@intent-core/contracts";

/** Test-only fixtures -- imported exclusively by `.test.tsx` files in
 * this directory, never by a production component. */
export const TEST_SIGNAL_HIGH: IntentSignalRead = {
  id: "test-signal-high",
  cross_role_assessment_id: "test-assessment-1",
  project_id: "test-project-1",
  shot_id: "test-shot-1",
  task_id: "test-task-1",
  version_id: "test-version-1",
  attention_level: "high",
  signal_output: {
    attention_level: "high",
    label: "human_review_required",
    summary: "A high-priority cross-role tension was identified.",
    drivers: [
      {
        code: "cross_role_tension",
        summary: "Camera timing is interpreted differently across roles.",
        priority: "high",
        assessment_section: "cross_role_tensions",
        assessment_item_index: 0,
      },
    ],
    role_coverage: { vfx_supervisor: true, cg_supervisor: true, artist: false },
    re_anchor_proposal_present: true,
    caveats: ["Test caveat."],
  },
  created_at: "2026-07-20T10:00:00Z",
};

export const TEST_SIGNAL_LOW: IntentSignalRead = {
  ...TEST_SIGNAL_HIGH,
  id: "test-signal-low",
  attention_level: "low",
  signal_output: {
    ...TEST_SIGNAL_HIGH.signal_output,
    attention_level: "low",
    label: "low_attention",
    summary: "No cross-role tension or risk was identified.",
    drivers: [],
    re_anchor_proposal_present: false,
  },
};
