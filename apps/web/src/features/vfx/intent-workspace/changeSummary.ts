import type { CoreAnchorRevisionRead } from "@intent-core/contracts";

/** A concise, real computed diff of counts/changed fields between the
 * confirmed revision and the proposed draft (Step 7C-2;
 * docs/step-7/16_STEP_7C0D_...md §7) -- never a full text diff, never a
 * fabricated score. Comparing against `confirmed === null` (no Anchor
 * has ever been confirmed yet) treats every populated draft field as
 * newly added content, which is honest: there is nothing to compare
 * against. */

const SCALAR_FIELDS: { field: keyof CoreAnchorRevisionRead; label: string }[] =
  [
    { field: "shot_objective", label: "Shot objective" },
    { field: "emotional_tone", label: "Emotional tone" },
    { field: "visual_focus", label: "Visual focus" },
    { field: "rhythm_intensity", label: "Rhythm and intensity" },
    { field: "character_relationship", label: "Character relationship" },
    { field: "narrative_priority", label: "Narrative priority" },
    { field: "core_summary", label: "Core summary" },
  ];

const COLLECTION_FIELDS: {
  field: keyof CoreAnchorRevisionRead;
  singular: string;
  plural: string;
}[] = [
  { field: "constraints", singular: "constraint", plural: "constraints" },
  {
    field: "variation_zones",
    singular: "variation zone",
    plural: "variation zones",
  },
  { field: "drift_risks", singular: "drift risk", plural: "drift risks" },
  { field: "references", singular: "reference", plural: "references" },
  {
    field: "open_questions",
    singular: "open question",
    plural: "open questions",
  },
];

const METADATA_KEYS = new Set(["id", "order_index", "created_at"]);

function collectionContent(
  revision: CoreAnchorRevisionRead | null,
  field: keyof CoreAnchorRevisionRead,
): string[] {
  if (revision === null) return [];
  const items = (revision[field] as Array<Record<string, unknown>>) ?? [];
  return items.map((item) => {
    const rest: Record<string, unknown> = {};
    for (const key of Object.keys(item)) {
      if (!METADATA_KEYS.has(key)) rest[key] = item[key];
    }
    return JSON.stringify(rest);
  });
}

export function computeChangeSummary(
  confirmed: CoreAnchorRevisionRead | null,
  draft: CoreAnchorRevisionRead,
): string[] {
  const items: string[] = [];

  for (const { field, label } of SCALAR_FIELDS) {
    // Normalized so a genuinely empty field compares equal regardless of
    // whether it arrives as `null` (a raw revision) or `""` (a live form
    // state's `toFormState`-normalized value, as `CoreAnchorRevisionEditor`
    // passes for the in-progress draft side) -- otherwise every scalar
    // that is empty on both sides would falsely report as changed,
    // violating no-meaningful-change protection.
    const before = (confirmed ? confirmed[field] : null) ?? "";
    const after = draft[field] ?? "";
    if (before !== after) {
      items.push(`${label} changed`);
    }
  }

  for (const { field, singular, plural } of COLLECTION_FIELDS) {
    const before = collectionContent(confirmed, field);
    const after = collectionContent(draft, field);
    const delta = after.length - before.length;
    if (delta > 0) {
      items.push(`${delta} ${delta === 1 ? singular : plural} added`);
    } else if (delta < 0) {
      const removed = -delta;
      items.push(`${removed} ${removed === 1 ? singular : plural} removed`);
    } else if (JSON.stringify(before) !== JSON.stringify(after)) {
      items.push(`${plural} edited`);
    }
  }

  return items;
}

/** A concise, real summary of what a genuine first-ever confirmation
 * established -- for the Just-confirmed Success "What was established"
 * card (Step 7C-3 basic-layout pass), which must never say "changed"
 * about a Revision 1 that had nothing to change from. Every line is
 * gated on real populated content on `revision` itself; nothing here is
 * invented when a field happens to be empty. */
export function summarizeEstablishedContent(
  revision: CoreAnchorRevisionRead,
): string[] {
  const items: string[] = [];

  if (revision.core_summary || revision.shot_objective) {
    items.push("Shared creative direction established");
  }
  if (revision.constraints.length > 0) {
    const count = revision.constraints.length;
    items.push(
      `${count} confirmed ${count === 1 ? "constraint" : "constraints"}`,
    );
  }
  if (revision.variation_zones.length > 0) {
    const count = revision.variation_zones.length;
    items.push(
      `${count} confirmed variation ${count === 1 ? "boundary" : "boundaries"}`,
    );
  }
  if (revision.open_questions.length > 0) {
    const count = revision.open_questions.length;
    items.push(
      `${count} recorded open ${count === 1 ? "question" : "questions"}`,
    );
  }

  return items;
}
