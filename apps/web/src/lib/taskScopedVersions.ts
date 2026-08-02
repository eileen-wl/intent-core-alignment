/** Step 8C-6/8C-7: the locked Task-scoped Version compatibility rule
 * (a Shot's Versions include ftrack-synced rows now linked to a real
 * Task via `Version.task_id`, alongside legacy/manual Shot-level rows
 * that have never had Task identity -- `versions_and_feedback.models
 * .Version`'s own module docstring). Include a Version in a Task
 * Workspace when:
 *
 * - `version.task_id === taskId` (it belongs to this real Task); or
 * - `version.task_id` is null/undefined (the existing manual/legacy
 *   compatibility fallback -- never discarded).
 *
 * A Version whose `task_id` is a *different* real Task's id is
 * excluded. Never compares Task names, department labels, or Version
 * names/content -- only the real `task_id` value, matching every other
 * ftrack-lineage resolution in this system (ADR-0014).
 *
 * VFX Shot Workspace pages must NOT use this filter -- Versions remain
 * Shot-wide there by design (docs/step-8/02_STEP_8B_VERSION_NOTE_SYNC
 * _CONTRACT.md's own locked page-responsibility split).
 */
export function isVersionInTaskScope(
  version: { task_id?: string | null },
  taskId: string,
): boolean {
  return version.task_id == null || version.task_id === taskId;
}

/** Filters a list to only the Versions allowed in one Task Workspace
 * (see `isVersionInTaskScope`). Order is preserved -- callers apply
 * their own chronological sort afterward. */
export function filterVersionsForTask<T extends { task_id?: string | null }>(
  versions: T[],
  taskId: string,
): T[] {
  return versions.filter((version) => isVersionInTaskScope(version, taskId));
}
