import { describe, expect, it } from "vitest";

import { ROLE_CARDS } from "./roleCards";

describe("ROLE_CARDS", () => {
  it("contains only serialisable string fields, never a callback function", () => {
    for (const card of ROLE_CARDS) {
      for (const [key, value] of Object.entries(card)) {
        expect(typeof value, `${key} on ${card.role}`).toBe("string");
      }
    }
  });

  it("covers exactly the three formal Demo roles, in Demo order", () => {
    expect(ROLE_CARDS.map((card) => card.role)).toEqual([
      "vfx_supervisor",
      "cg_supervisor",
      "artist",
    ]);
  });

  it("round-trips through JSON without losing any field", () => {
    // A Server Component can only pass props across the Client
    // Component boundary that survive this exact serialisation --
    // this is the regression this data module must never fail again.
    const roundTripped = JSON.parse(JSON.stringify(ROLE_CARDS)) as unknown;
    expect(roundTripped).toEqual(ROLE_CARDS);
  });
});
