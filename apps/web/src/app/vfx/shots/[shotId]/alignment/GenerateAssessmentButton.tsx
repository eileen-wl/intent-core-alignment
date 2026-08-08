"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { generateAssessmentAction } from "@/features/vfx/alignment-workspace/actions";
import styles from "./GenerateAssessmentButton.module.css";

/** Calls the real, existing Cross-role Assessment generation endpoint
 * for the one real Task+Version pair that satisfies every generation
 * prerequisite (`item.generation_ready_task_id`/`generation_ready_version_id`
 * -- never a fabricated or guessed pair). On success, refreshes this
 * Server Component route so the newly-persisted Assessment renders from
 * the real reload, never from client-held state. */
export function GenerateAssessmentButton({
  shotId,
  taskId,
  versionId,
  label = "Generate Assessment",
  pendingLabel = "Generating Assessment…",
}: {
  shotId: string;
  taskId: string;
  versionId: string;
  /** Package C follow-up (Alignment workspace reassessment): the same
   * real action, just re-labelled "Generate new Cross-role Assessment"
   * when a historical Assessment already exists and this is offered as
   * a genuine reassessment against newer eligible evidence, rather
   * than the first-ever Assessment for this Shot. */
  label?: string;
  pendingLabel?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={styles.button}
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(() => {
            generateAssessmentAction(shotId, versionId, taskId).then(
              (result) => {
                if (result.ok) {
                  router.refresh();
                } else {
                  setError(result.error.message);
                }
              },
            );
          });
        }}
      >
        {isPending ? pendingLabel : label}
      </button>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
