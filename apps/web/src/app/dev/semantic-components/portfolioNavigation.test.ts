import { describe, expect, it } from "vitest";

import { ROLE_SIDEBAR_ITEMS } from "@/lib/roleNavigation";

describe("portfolio role navigation", () => {
  it("never links to the Development semantic-components preview", () => {
    const allHrefs = Object.values(ROLE_SIDEBAR_ITEMS).flatMap((items) =>
      items.map((item) => item.href),
    );
    for (const href of allHrefs) {
      expect(href).not.toMatch(/^\/dev/);
    }
  });
});
