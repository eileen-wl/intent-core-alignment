import { describe, expect, it } from "vitest";

import { groupByCategory } from "./workItemGrouping";

interface Item {
  id: string;
  category: string;
  sortRank: number;
}

describe("groupByCategory", () => {
  it("chunks items by their existing category, without inventing a new one", () => {
    const items: Item[] = [
      { id: "a", category: "Version review", sortRank: 3 },
      { id: "b", category: "Core Anchor confirmation", sortRank: 1 },
      { id: "c", category: "Version review", sortRank: 4 },
    ];

    const groups = groupByCategory(items);

    expect(groups.map((g) => g.category)).toEqual([
      "Core Anchor confirmation",
      "Version review",
    ]);
    expect(groups[1].items.map((i) => i.id)).toEqual(["a", "c"]);
  });

  it("orders groups by each group's own highest-priority item, preserving overall priority order", () => {
    const items: Item[] = [
      { id: "low-priority-a", category: "A", sortRank: 10 },
      { id: "high-priority-b", category: "B", sortRank: 1 },
      { id: "low-priority-b", category: "B", sortRank: 9 },
    ];

    const groups = groupByCategory(items);

    expect(groups.map((g) => g.category)).toEqual(["B", "A"]);
  });

  it("sorts items within a group by sortRank ascending", () => {
    const items: Item[] = [
      { id: "later", category: "A", sortRank: 5 },
      { id: "earlier", category: "A", sortRank: 2 },
    ];

    const groups = groupByCategory(items);

    expect(groups[0].items.map((i) => i.id)).toEqual(["earlier", "later"]);
  });

  it("returns an empty array for no items", () => {
    expect(groupByCategory([])).toEqual([]);
  });
});
