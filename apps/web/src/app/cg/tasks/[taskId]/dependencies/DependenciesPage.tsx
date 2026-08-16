import { EmptyState, ErrorState } from "@/design";
import type { DependenciesWorkspaceData } from "@/features/cg/dependencies-workspace/data";
import { DependencyRow } from "./DependencyRow";
import { RecordDependencyForm } from "./RecordDependencyForm";
import styles from "./DependenciesPage.module.css";

/** `/cg/tasks/:taskId/dependencies` (Step 7C-4) -- what external
 * decisions, inputs, or cross-role issues could block or distort this
 * Task. Real `TaskDependency` rows only (Step 7C-4's new persisted
 * model -- see `intent_core_api.cross_department.models.TaskDependency`),
 * split into Open dependencies / Cross-role conflicts / Resolved
 * history. Escalation rows (`kind="escalation"`) are recorded from
 * Version Review, not here, but appear in this Task's real history. */
export function DependenciesPage({
  taskId,
  data,
}: {
  taskId: string;
  data: DependenciesWorkspaceData | null;
}) {
  if (!data) {
    return (
      <ErrorState
        title="This page is unavailable"
        description="The ICAS service could not be reached. Try refreshing the page."
      />
    );
  }

  return (
    <>
      <RecordDependencyForm taskId={taskId} />

      {data.dependencies.length === 0 ? (
        <EmptyState title="No unresolved dependencies have been recorded for this Task." />
      ) : (
        <DependenciesSections
          taskId={taskId}
          dependencies={data.dependencies}
        />
      )}
    </>
  );
}

function DependenciesSections({
  taskId,
  dependencies,
}: {
  taskId: string;
  dependencies: DependenciesWorkspaceData["dependencies"];
}) {
  const open = dependencies.filter(
    (dependency) =>
      dependency.kind !== "conflict" && dependency.status !== "resolved",
  );
  const conflicts = dependencies.filter(
    (dependency) =>
      dependency.kind === "conflict" && dependency.status !== "resolved",
  );
  const resolved = dependencies.filter(
    (dependency) => dependency.status === "resolved",
  );

  return (
    <>
      <section className={styles.section}>
        <h3 className={styles.sectionHeading}>Open dependencies</h3>
        {open.length === 0 ? (
          <p className={styles.empty}>No open dependencies.</p>
        ) : (
          <ul className={styles.list}>
            {open.map((dependency) => (
              <DependencyRow
                key={dependency.id}
                taskId={taskId}
                dependency={dependency}
              />
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionHeading}>Cross-role conflicts</h3>
        {conflicts.length === 0 ? (
          <p className={styles.empty}>No open cross-role conflicts.</p>
        ) : (
          <ul className={styles.list}>
            {conflicts.map((dependency) => (
              <DependencyRow
                key={dependency.id}
                taskId={taskId}
                dependency={dependency}
              />
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionHeading}>Resolved / history</h3>
        {resolved.length === 0 ? (
          <p className={styles.empty}>Nothing has been resolved yet.</p>
        ) : (
          <ul className={styles.list}>
            {resolved.map((dependency) => (
              <DependencyRow
                key={dependency.id}
                taskId={taskId}
                dependency={dependency}
              />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
