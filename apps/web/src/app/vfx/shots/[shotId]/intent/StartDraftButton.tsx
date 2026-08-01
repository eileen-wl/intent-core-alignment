"use client";

import { useState, useTransition } from "react";

import type { IntentActionResult } from "@/features/vfx/intent-workspace/actions";
import styles from "./StartDraftButton.module.css";

/** Starts a blank first draft or creates a new revision from the current
 * confirmed Core Anchor. `variant="primary"` is reserved for the dominant
 * INITIAL EMPTY creation action; existing confirmed-state uses keep the
 * restrained secondary appearance by default. */
export function StartDraftButton({
  label,
  pendingLabel,
  action,
  variant = "secondary",
}: {
  label: string;
  pendingLabel: string;
  action: () => Promise<IntentActionResult>;
  variant?: "primary" | "secondary";
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const buttonClassName =
    variant === "primary"
      ? `${styles.button} ${styles.primary}`
      : styles.button;

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={buttonClassName}
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(() => {
            action().then((result) => {
              if (!result.ok) {
                setError(result.error.message);
              }
            });
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
