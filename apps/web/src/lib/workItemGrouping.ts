/** Shared grouping for the VFX/CG/Artist Review Inbox pages
 * (`app/vfx/inbox/ReviewInboxPage.tsx`, `app/cg/inbox/CgReviewInboxPage.tsx`,
 * `app/artist/inbox/ArtistReviewInboxPage.tsx`). Each role's inbox
 * already computes an honest `category` per work item (its adapter's
 * `category`/`categoryForFocusType`), and an honest `sortRank` (the
 * backend's own priority ordering) -- this only chunks the existing
 * flat list under its existing categories, it never invents a new
 * classification or re-derives priority. Group order follows each
 * group's own highest-priority (lowest `sortRank`) item, so the
 * overall reading order is unchanged from today's flat list; only
 * same-category items now sit together instead of interleaved. */
export interface CategoryGroup<T> {
  category: string;
  items: T[];
}

export function groupByCategory<
  T extends { category: string; sortRank: number },
>(items: T[]): CategoryGroup<T>[] {
  const byCategory = new Map<string, T[]>();
  for (const item of items) {
    const existing = byCategory.get(item.category);
    if (existing) {
      existing.push(item);
    } else {
      byCategory.set(item.category, [item]);
    }
  }

  const groups = Array.from(byCategory.entries()).map(
    ([category, groupItems]) => ({
      category,
      items: [...groupItems].sort((a, b) => a.sortRank - b.sortRank),
    }),
  );

  groups.sort((a, b) => a.items[0].sortRank - b.items[0].sortRank);

  return groups;
}
