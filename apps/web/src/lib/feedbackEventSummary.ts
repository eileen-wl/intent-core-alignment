import type { ArtistFeedbackEventRead } from "@intent-core/contracts";

import { humanRoleLabel } from "./humanRoleLabel";

/** Step 9B-2 owner-validation correction: for the two Feedback History
 * event types whose server-generated `summary` embeds the raw,
 * persisted `actor_human_role` enum value (e.g. `"Human cg_supervisor
 * confirmed Execution Anchor Revision 2 -- ..."`,
 * `apps/api/.../artist_feedback_history/service.py`), this composes
 * the visible description from the event's own structured
 * `event_type`/`actor_human_role` fields instead of rendering the raw
 * summary text -- never a broad regex over arbitrary content, and
 * never touching the persisted `summary` value itself (`event.summary`
 * is read, matched, and only its own known "Human <role> " prefix is
 * replaced; nothing else about it is altered).
 *
 * Every other event type's `summary` (Version/ReviewNote/Dependency
 * text, Agent-output descriptions) never embeds a role enum and is
 * returned unchanged -- this function is intentionally narrow, not a
 * general-purpose text rewriter. If the expected prefix is not found
 * (a future backend format change, or a non-human actor), the original
 * summary is returned unchanged rather than guessed at. */
export function feedbackEventSummary(event: ArtistFeedbackEventRead): string {
  const isDecisionEvent =
    event.event_type === "execution_anchor_confirmed" ||
    event.event_type === "execution_anchor_draft_discarded";
  if (!isDecisionEvent || !event.actor_human_role) {
    return event.summary;
  }

  const rawPrefix = `Human ${event.actor_human_role} `;
  if (!event.summary.startsWith(rawPrefix)) {
    return event.summary;
  }

  return `${humanRoleLabel(event.actor_human_role)} ${event.summary.slice(rawPrefix.length)}`;
}
