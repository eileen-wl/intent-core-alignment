"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { generateArtistGuidanceAction } from "@/features/artist/actions";
import styles from "./GenerateArtistGuidanceButton.module.css";

/** Calls the real, existing Artist Agent guidance-generation endpoint
 * for the Task's real latest Production Version (`versionId` -- never a
 * fabricated or guessed Version). Mirrors
 * `app/vfx/shots/[shotId]/alignment/GenerateAssessmentButton.tsx`'s
 * pattern: on success, refreshes this Server Component route so the
 * newly-persisted guidance renders from the real reload, never from
 * client-held state. Same real call whether this is the first
 * generation or a regeneration after a newer confirmed Execution Anchor
 * -- ArtistAgentGuidance rows are immutable and append-only. */
export function GenerateArtistGuidanceButton({
  taskId,
  versionId,
  label,
  disabledReasons = [],
}: {
  taskId: string;
  versionId: string | null;
  label: string;
  disabledReasons?: string[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const unavailable = disabledReasons.length > 0 || versionId === null;

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={styles.button}
        disabled={isPending || unavailable}
        onClick={() => {
          if (unavailable || versionId === null) return;
          setError(null);
          startTransition(() => {
            generateArtistGuidanceAction(taskId, versionId).then((result) => {
              if (result.ok) {
                router.refresh();
              } else {
                setError(result.error.message);
              }
            });
          });
        }}
      >
        {isPending ? "Generating guidance…" : label}
      </button>
      {disabledReasons.length > 0 && (
        <div className={styles.unavailable} role="status">
          <strong>Guidance generation unavailable</strong>
          <ul>
            {disabledReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
