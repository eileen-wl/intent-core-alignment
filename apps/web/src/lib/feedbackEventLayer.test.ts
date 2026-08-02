import type { ArtistFeedbackEventType } from "@intent-core/contracts";
import { describe, expect, it } from "vitest";

import { feedbackEventLayer } from "./feedbackEventLayer";

describe("feedbackEventLayer", () => {
  it("classifies real production-object events as Production Evidence, even when system-authored", () => {
    const productionEvidenceTypes: ArtistFeedbackEventType[] = [
      "version_recorded",
      "review_note_recorded",
      "dependency_recorded",
      "escalation_recorded",
    ];
    for (const eventType of productionEvidenceTypes) {
      expect(feedbackEventLayer(eventType)).toBe("production-evidence");
    }
  });

  it("classifies Agent-authored output events as Agent Interpretation", () => {
    const agentInterpretationTypes: ArtistFeedbackEventType[] = [
      "artist_guidance_generated",
      "cg_supervisor_review_generated",
      "cross_role_assessment_involving_task",
    ];
    for (const eventType of agentInterpretationTypes) {
      expect(feedbackEventLayer(eventType)).toBe("agent-interpretation");
    }
  });

  it("classifies confirmation/rejection/acknowledgement events as Human Decision and Provenance", () => {
    const humanDecisionTypes: ArtistFeedbackEventType[] = [
      "dependency_acknowledged",
      "dependency_resolved",
      "execution_anchor_confirmed",
      "execution_anchor_draft_discarded",
    ];
    for (const eventType of humanDecisionTypes) {
      expect(feedbackEventLayer(eventType)).toBe("human-decision");
    }
  });

  it("never classifies a ReviewNote-sourced event as Agent Interpretation merely because a human authored it", () => {
    expect(feedbackEventLayer("review_note_recorded")).toBe(
      "production-evidence",
    );
  });
});
