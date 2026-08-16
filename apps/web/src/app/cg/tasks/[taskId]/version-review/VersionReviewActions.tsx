"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Icon } from "@/design";
import {
  createReviewNoteAction,
  escalateTaskAction,
  generateCgSupervisorReviewAction,
} from "@/features/cg/actions";
import styles from "./VersionReviewActions.module.css";

/** Real, persisted Version Review actions (Step 7C-4): add a Review
 * Note, generate an advisory Agent Execution Review for the active
 * Execution Anchor revision, and escalate to VFX. No fabricated
 * acknowledge/approval state -- `ReviewNote` has no status field to
 * back one.
 *
 * Truthful action priority (Review Workspace pass): Recording a Review
 * Note is the Human CG Supervisor's own direct, always-available
 * response -- the literal "respond" in the Review Archetype's "inspect
 * and respond" goal -- so it is the one primary (ICAS Purple) action.
 * Generating/regenerating an Execution Review triggers Agent work, not
 * a Human response, so it stays secondary/neutral. Escalating is the
 * conditional "something needs VFX attention" path, kept in its
 * existing restrained-amber treatment. Not all three are equally
 * primary. */
export function VersionReviewActions({
  taskId,
  versionId,
  activeExecutionRevisionId,
  hasCurrentReview = false,
}: {
  taskId: string;
  versionId: string;
  activeExecutionRevisionId: string | null;
  /** True when an Agent Execution Review already exists for the active
   * Execution Anchor revision -- real evidence-currentness gating
   * (Package C follow-up), not a hard block: generating again against
   * the exact same unchanged evidence is still a real, supported
   * product action (e.g. a fresh read), so the control stays enabled
   * and simply relabels to "Regenerate" to make that an explicit
   * choice rather than an accidental repeat click. */
  hasCurrentReview?: boolean;
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
          className={styles.primaryButton}
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
          <Icon name="review-note" size="standard" />
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
            <Icon name="regenerate" size="standard" />
            {isPending
              ? "Generating…"
              : hasCurrentReview
                ? "Regenerate Agent Execution Review"
                : "Generate Agent Execution Review"}
          </button>
        )}

        <button
          type="button"
          className={styles.escalateButton}
          disabled={isPending}
          onClick={() => setShowEscalationForm((prev) => !prev)}
        >
          <Icon name="escalate" size="standard" />
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
