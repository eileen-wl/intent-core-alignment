"use client";

import { useEffect, useId, useRef } from "react";

import styles from "./ConfirmationDialog.module.css";

/** Small, focused final-confirmation dialog (Step 7C-2;
 * docs/step-7/16_STEP_7C0D_...md §8) -- native `<dialog>` rather than a
 * hand-rolled div-with-backdrop, so focus trapping and Escape-to-close
 * come from the platform, not custom JavaScript. Reserved for genuinely
 * high-authority, irreversible-feeling actions (Core Anchor Confirm/
 * Reject); never used for navigation, Evidence, draft saving, routine
 * generation, or opening another workspace.
 *
 * Deliberately generic and VFX-agnostic -- a shared primitive under
 * `design/components/`, not a Core-Anchor-specific component -- so a
 * future CG/Artist HumanGate dialog (Step 7C-4/7C-5) can reuse it
 * unchanged. */
export function ConfirmationDialog({
  open,
  title,
  description,
  rationale,
  confirmLabel,
  pendingLabel,
  cancelLabel = "Cancel",
  pending,
  conflictMessage,
  onConfirm,
  onCancel,
  onReload,
  focusCancelFirst = false,
}: {
  open: boolean;
  /** e.g. "Confirm this Core Anchor revision?" */
  title: string;
  /** e.g. "You are confirming revision #2 as the shared creative intent for Shot 010." */
  description: string;
  /** The already-entered rationale, echoed read-only -- never a second entry field. */
  rationale?: string | null;
  confirmLabel: string;
  pendingLabel: string;
  cancelLabel?: string;
  pending: boolean;
  /** When set, the dialog's action row is replaced by a single Reload
   * action -- a stale/already-resolved conflict, never presented as a
   * silent failure. */
  conflictMessage?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  onReload?: () => void;
  /** Reject's small deliberate asymmetry (§8): focus starts on Cancel,
   * not the primary action, since the less-common, more-consequential
   * path should not be the "just press Enter" default. */
  focusCancelFirst?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      (focusCancelFirst
        ? cancelButtonRef.current
        : confirmButtonRef.current
      )?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, focusCancelFirst]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    // Escape fires "cancel" (then "close") on a native <dialog> -- both
    // are suppressed while a mutation is in flight, so an in-progress
    // Confirm/Reject can never be dismissed mid-request via Escape.
    const handleCancel = (event: Event) => {
      if (pending) {
        event.preventDefault();
        return;
      }
      onCancel();
    };
    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, [pending, onCancel]);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <h2 id={titleId} className={styles.title}>
        {title}
      </h2>
      <p id={descriptionId} className={styles.description}>
        {description}
      </p>

      {conflictMessage ? (
        <>
          <p className={styles.conflict}>{conflictMessage}</p>
          <div className={styles.actions}>
            <button type="button" className={styles.primary} onClick={onReload}>
              Reload
            </button>
          </div>
        </>
      ) : (
        <>
          {rationale && (
            <div className={styles.rationaleBlock}>
              <span className={styles.rationaleLabel}>Rationale</span>
              <p className={styles.rationaleText}>{rationale}</p>
            </div>
          )}
          <div className={styles.actions}>
            <button
              ref={cancelButtonRef}
              type="button"
              className={styles.cancel}
              onClick={onCancel}
              disabled={pending}
            >
              {cancelLabel}
            </button>
            <button
              ref={confirmButtonRef}
              type="button"
              className={styles.primary}
              onClick={onConfirm}
              disabled={pending}
            >
              {pending ? pendingLabel : confirmLabel}
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
