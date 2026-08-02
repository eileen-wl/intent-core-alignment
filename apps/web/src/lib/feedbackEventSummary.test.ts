import type { ArtistFeedbackEventRead } from "@intent-core/contracts";
import { describe, expect, it } from "vitest";

import { feedbackEventSummary } from "./feedbackEventSummary";

function event(
  overrides: Partial<ArtistFeedbackEventRead> = {},
): ArtistFeedbackEventRead {
  return {
    id: "e1",
    event_type: "execution_anchor_confirmed",
    occurred_at: "2026-01-01T00:00:00Z",
    actor_kind: "human",
    actor_id: "cg-1",
    actor_human_role: "cg_supervisor",
    summary:
      "Human cg_supervisor confirmed Execution Anchor Revision 2 -- this Task's operational boundaries",
    related_entity_type: "decision",
    related_entity_id: "d1",
    related_version_id: null,
    route: "/artist/tasks/t1",
    ...overrides,
  };
}

describe("feedbackEventSummary", () => {
  it("composes a human-readable description from the structured event_type/actor_human_role fields for a confirm Decision event", () => {
    const text = feedbackEventSummary(event());
    expect(text).toBe(
      "CG Supervisor confirmed Execution Anchor Revision 2 -- this Task's operational boundaries",
    );
    expect(text).not.toContain("cg_supervisor");
    expect(text).not.toContain("Human ");
  });

  it("does the same for a reject/discard Decision event, and for a VFX Supervisor actor", () => {
    const text = feedbackEventSummary(
      event({
        event_type: "execution_anchor_draft_discarded",
        actor_human_role: "vfx_supervisor",
        summary:
          "Human vfx_supervisor discarded the draft for Execution Anchor Revision 1 -- this Task's operational boundaries",
      }),
    );
    expect(text).toBe(
      "VFX Supervisor discarded the draft for Execution Anchor Revision 1 -- this Task's operational boundaries",
    );
    expect(text).not.toContain("vfx_supervisor");
  });

  it("leaves every other event type's summary completely unchanged, including ReviewNote content", () => {
    const reviewNoteEvent = event({
      event_type: "review_note_recorded",
      actor_human_role: "cg_supervisor",
      summary: 'Review Note recorded: "Tighten the timing on the push-in."',
    });
    expect(feedbackEventSummary(reviewNoteEvent)).toBe(
      'Review Note recorded: "Tighten the timing on the push-in."',
    );

    const versionEvent = event({
      event_type: "version_recorded",
      actor_human_role: null,
      actor_kind: "system",
      summary: 'Production Version "SH010_v001" recorded',
    });
    expect(feedbackEventSummary(versionEvent)).toBe(
      'Production Version "SH010_v001" recorded',
    );
  });

  it("returns the original summary unchanged when the expected raw-role prefix is not present, rather than guessing", () => {
    const unexpectedFormat = event({
      summary: "Execution Anchor confirmed by CG Supervisor",
    });
    expect(feedbackEventSummary(unexpectedFormat)).toBe(
      "Execution Anchor confirmed by CG Supervisor",
    );
  });

  it("returns the original summary unchanged when there is no actor_human_role at all", () => {
    const noRole = event({ actor_human_role: null, actor_kind: "system" });
    expect(feedbackEventSummary(noRole)).toBe(noRole.summary);
  });
});
