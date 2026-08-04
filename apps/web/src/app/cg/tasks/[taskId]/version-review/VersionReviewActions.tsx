"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  createReviewNoteAction,
  escalateTaskAction,
  generateCgSupervisorReviewAction,
} from "@/features/cg/actions";
import styles from "./VersionReviewActions.module.css";

/** Real, persisted Version Review actions (Step 7C-4): add a Review
 * Note, generate a CG Supervisor review for the active Execution
 * Anchor revision, and escalate to VFX. No fabricated
 * acknowledge/approval state -- `ReviewNote` has no status field to
 * back one. */
export function VersionReviewActions({
  taskId,
  versionId,
  activeExecutionRevisionId,
}: {
  taskId: string;
  versionId: string;
  activeExecutionRevisionId: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState("");
  const [escalationText, setEscalationText] = useState("");
  const [showEscalationForm, setShowEscalationForm] = useState(false);

  return (
    <div className={styles.wrapper}>
      <label className={styles.fieldLabel}>
        Add Review Note
        <textarea
          className={styles.fieldInput}
          value={noteContent}
          onChange={(event) => setNoteContent(event.target.value)}
          rows={2}
        />
      </label>
      <div className={styles.actionRow}>
        <button
          type="button"
          className={styles.secondaryButton}
          disabled={isPending || noteContent.trim().length === 0}
          onClick={() => {
            setError(null);
            startTransition(() => {
              createReviewNoteAction(taskId, versionId, noteContent).then(
                (result) => {
                  if (result.ok) {
                    setNoteContent("");
                    router.refresh();
                  } else {
                    setError(result.error.message);
                  }
                },
              );
            });
          }}
        >
          {isPending ? "Recording…" : "Record Review Note"}
        </button>

        {activeExecutionRevisionId && (
          <button
            type="button"
            className={styles.secondaryButton}
            disabled={isPending}
            onClick={() => {
              setError(null);
              startTransition(() => {
                generateCgSupervisorReviewAction(
                  taskId,
                  activeExecutionRevisionId,
                  versionId,
                ).then((result) => {
                  if (result.ok) {
                    router.refresh();
                  } else {
                    setError(result.error.message);
                  }
                });
              });
            }}
          >
            {isPending ? "Generating…" : "Generate CG Supervisor review"}
          </button>
        )}

        <button
          type="button"
          className={styles.escalateButton}
          disabled={isPending}
          onClick={() => setShowEscalationForm((prev) => !prev)}
        >
          Escalate to VFX
        </button>
      </div>

      {showEscalationForm && (
        <div className={styles.escalationForm}>
          <label className={styles.fieldLabel}>
            Escalation description
            <textarea
              className={styles.fieldInput}
              value={escalationText}
              onChange={(event) => setEscalationText(event.target.value)}
              rows={2}
            />
          </label>
          <button
            type="button"
            className={styles.escalateButton}
            disabled={isPending || escalationText.trim().length === 0}
            onClick={() => {
              setError(null);
              startTransition(() => {
                escalateTaskAction(taskId, escalationText, versionId).then(
                  (result) => {
                    if (result.ok) {
                      setEscalationText("");
                      setShowEscalationForm(false);
                      router.refresh();
                    } else {
                      setError(result.error.message);
                    }
                  },
                );
              });
            }}
          >
            {isPending ? "Escalating…" : "Confirm escalation"}
          </button>
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
