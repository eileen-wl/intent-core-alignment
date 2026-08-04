"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { AgentGenerationResult } from "@/features/vfx/intent-workspace/actions";
import styles from "./StartDraftButton.module.css";

export function GenerateIntentCapabilityButton({
  label,
  action,
  disabled = false,
}: {
  label: string;
  action: () => Promise<AgentGenerationResult>;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className={styles.wrapper}>
      <button
        className={styles.button}
        type="button"
        disabled={pending || disabled}
        onClick={() => {
          setError(null);
          startTransition(() => {
            action().then((result) =>
              result.ok ? router.refresh() : setError(result.error.message),
            );
          });
        }}
      >
        {pending ? "Generating…" : label}
      </button>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
