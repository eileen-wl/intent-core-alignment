import type { ArtistFeedbackEventType } from "@intent-core/contracts";

import type { EvidenceLayerKind } from "@/design";

/** Step 9B-2: deterministic Production Evidence / Agent Interpretation
 * / Human Decision classification for Artist Feedback History timeline
 * events -- keyed by the real, persisted `event_type` (a semantic
 * source-object/event distinction already made server-side by
 * `build_task_feedback_history`), never by the visible actor label. A
 * `system`-actor event (e.g. `dependency_recorded`) is still Production
 * Evidence, not Agent Interpretation, because its *source object* is a
 * structural production fact, not an Agent inference. */
const EVENT_TYPE_LAYER: Record<ArtistFeedbackEventType, EvidenceLayerKind> = {
  version_recorded: "production-evidence",
  review_note_recorded: "production-evidence",
  dependency_recorded: "production-evidence",
  escalation_recorded: "production-evidence",
  artist_guidance_generated: "agent-interpretation",
  cg_supervisor_review_generated: "agent-interpretation",
  cross_role_assessment_involving_task: "agent-interpretation",
  dependency_acknowledged: "human-decision",
  dependency_resolved: "human-decision",
  execution_anchor_confirmed: "human-decision",
  execution_anchor_draft_discarded: "human-decision",
};

export function feedbackEventLayer(
  eventType: ArtistFeedbackEventType,
): EvidenceLayerKind {
  return EVENT_TYPE_LAYER[eventType];
}
