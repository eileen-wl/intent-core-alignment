/** Step 8C-6/8C-7: author/creator display text for a Version or
 * ReviewNote, distinguishing ftrack source provenance from an ICAS
 * Human role attribution (docs/step-8/02_STEP_8B_VERSION_NOTE_SYNC
 * _CONTRACT.md §4/§7, ADR-0014 Decision 2).
 *
 * An ftrack external author is production provenance, never an ICAS
 * Human VFX Supervisor, Human CG Supervisor, or Human Artist -- a
 * ftrack-synced row's own `created_by_actor_kind`/`created_by_human_role`
 * are always fixed to `"system"`/`null` server-side (never a human
 * role), so this never needs to override or suppress those fields; it
 * only prefers the real external author's *name* as display text when
 * one exists, self-labelled so it can never be mistaken for a Human
 * role. `external_author_id` (a stable but not human-readable id) is
 * never used as display text -- the existing `created_by_human_role ??
 * created_by_actor_kind` fallback is always a safe, existing, already-
 * rendered value, so that fallback is used instead whenever no display
 * name is available.
 *
 * For a manual/local record (`source !== "ftrack"`, or no
 * `external_author_name`), the return value is byte-identical to the
 * existing `created_by_human_role ?? created_by_actor_kind` expression
 * this replaces -- a drop-in replacement, not a new UI section.
 */
export function getAuthorDisplayText(entity: {
  source: string;
  created_by_human_role?: string | null;
  created_by_actor_kind: string;
  external_author_name?: string | null;
}): string {
  if (entity.source === "ftrack" && entity.external_author_name) {
    return `Source author: ${entity.external_author_name}`;
  }
  return entity.created_by_human_role ?? entity.created_by_actor_kind;
}
