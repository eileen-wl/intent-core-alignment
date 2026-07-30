"use client";

import { useState, useTransition } from "react";

import type { IntentActionResult } from "@/features/vfx/intent-workspace/actions";
import styles from "./StartDraftButton.module.css";

/** The one primary action on the confirmed-only and never-confirmed
 * Intent Workspace states: "Create new revision" (copies the confirmed
 * revision) or "Start a Core Anchor" (first draft, nothing confirmed
 * yet). A plain action button, not dialog-gated -- starting a draft is
 * not itself a HumanGate decision (docs/step-7/16_STEP_7C0D_...md §8's
 * dialog is reserved for Confirm/Reject only). On success, the Server
 * Action's own `revalidatePath` calls bring the new draft onto the page
 * without a client-side navigation. */
export function StartDraftButton({
  label,
  pendingLabel,
  action,
}: {
  label: string;
  pendingLabel: string;
  action: () => Promise<IntentActionResult>;
}) {
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
