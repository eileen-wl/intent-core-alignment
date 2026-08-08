"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { publishResolvedVersionAction } from "@/features/artist/actions";
import styles from "./PublishResolvedVersionButton.module.css";

/** Package C follow-up (J3 -> J4 Version-publish): "Publish next
 * Version from Execution Anchor R{n}" -- the real, generic
 * `POST /versions` domain action, Artist-triggered, `task_id`-scoped
 * to this exact Task. Only ever rendered when the caller's own real
 * readiness check (`CurrentVersionData.canPublishResolvedVersion`,
 * computed from the confirmed Execution Anchor genuinely being current
 * against the confirmed Core Anchor, and no resolved Version already
 * existing for it) says this Task's current Production Version still
 * belongs to the R1/conflict era. A single explicit click; never
 * auto-triggered by navigation, a page load, or any other action. */
export function PublishResolvedVersionButton({
  taskId,
  nextRevisionNumber,
}: {
  taskId: string;
  nextRevisionNumber: number;
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
            publishResolvedVersionAction(taskId).then((result) => {
              if (result.ok) {
                router.refresh();
              } else {
                setError(result.error.message);
              }
            });
          });
        }}
      >
        {isPending
          ? "Publishing…"
          : `Publish next Version from Execution Anchor R${nextRevisionNumber}`}
      </button>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
