import { describe, expect, it } from "vitest";

import { getAuthorDisplayText } from "./authorProvenance";

describe("getAuthorDisplayText", () => {
  it("formats a real, internal HumanRole as its human-readable label (Step 9B-2 correction)", () => {
    expect(
      getAuthorDisplayText({
        source: "manual",
        created_by_human_role: "vfx_supervisor",
        created_by_actor_kind: "human",
      }),
    ).toBe("VFX Supervisor");
  });

  it("never renders the raw HumanRole enum for an internal/manual record", () => {
    const text = getAuthorDisplayText({
      source: "manual",
      created_by_human_role: "cg_supervisor",
      created_by_actor_kind: "human",
    });
    expect(text).not.toBe("cg_supervisor");
    expect(text).toBe("CG Supervisor");
  });

  it("falls back to the real actor kind, unconverted, when no human role is recorded -- never fabricates a role", () => {
    expect(
      getAuthorDisplayText({
        source: "manual",
        created_by_human_role: null,
        created_by_actor_kind: "agent",
      }),
    ).toBe("agent");
  });

  it("keeps a real ftrack external author name as source provenance, never converting it into an ICAS HumanRole authority", () => {
    const text = getAuthorDisplayText({
      source: "ftrack",
      created_by_human_role: null,
      created_by_actor_kind: "system",
      external_author_name: "Jamie Lin",
    });
    expect(text).toBe("Source author: Jamie Lin");
  });

  it("passes an unrecognised human_role value through unchanged rather than fabricating a label", () => {
    // Defensive case only -- the persisted field is a real HumanRole
    // enum in practice, but this proves the formatter never guesses.
    expect(
      getAuthorDisplayText({
        source: "manual",
        created_by_human_role: "some_future_role",
        created_by_actor_kind: "human",
      }),
    ).toBe("some_future_role");
  });

  it("does not falsely convert an arbitrary non-role actor id or name", () => {
    // A real external author name that happens to share no structure
    // with a HumanRole value must render completely unchanged --
    // never passed through humanRoleLabel at all.
    const text = getAuthorDisplayText({
      source: "ftrack",
      created_by_human_role: null,
      created_by_actor_kind: "system",
      external_author_name: "artist.render.bot",
    });
    expect(text).toBe("Source author: artist.render.bot");
  });
});
