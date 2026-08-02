/** Step 8C-6/8C-7: the effective chronological timestamp for a Version
 * or ReviewNote, per the locked contract
 * (docs/step-8/02_STEP_8B_VERSION_NOTE_SYNC_CONTRACT.md §6, ADR-0014
 * Decision 2) -- `created_at` keeps its existing ICAS-ingestion-time
 * meaning and is never redefined or overwritten; `source_created_at`
 * (when present -- only ftrack-synced rows have it) is the real
 * external creation time and takes precedence for chronological
 * ordering, since a historical backfill sync can insert years of real
 * history in one ingestion run.
 *
 * Returns a numeric epoch (`Date#getTime()`), never a string, so every
 * call site compares/sorts numerically -- never a locale-dependent
 * string comparison.
 */
export function getEffectiveTimestamp(entity: {
  created_at: string;
  source_created_at?: string | null;
}): number {
  const effective = entity.source_created_at ?? entity.created_at;
  return new Date(effective).getTime();
}
