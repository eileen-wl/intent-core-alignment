"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ExecutionAnchorRevisionRead } from "@intent-core/contracts";

import { AuthorityBoundary, AuthorityLabel } from "@/design";
import {
  confirmExecutionAnchorRevisionAction,
  createExecutionAnchorDraftAction,
  createExecutionAnchorDraftFromConfirmedAction,
  generateExecutionAnchorDraftAction,
  rejectExecutionAnchorRevisionAction,
  saveExecutionAnchorDraftAction,
} from "@/features/cg/actions";
import styles from "./ExecutionAnchorEditor.module.css";

const EMPTY_CONFIRM_EXPLANATION =
  "Add at least one execution boundary, criterion, dependency, refinement or " +
  "escalation condition before confirming.";

const CONTENT_FIELDS: { key: keyof FieldValues; label: string }[] = [
  { key: "technical_boundaries", label: "Technical boundaries" },
  { key: "parameter_ranges", label: "Parameter ranges" },
  { key: "delivery_conditions", label: "Delivery conditions" },
  { key: "production_ready_criteria", label: "Production-ready criteria" },
  { key: "downstream_dependencies", label: "Downstream dependencies" },
  { key: "publish_requirements", label: "Publish requirements" },
  { key: "allowed_refinements", label: "Allowed refinements" },
  { key: "escalation_conditions", label: "Escalation conditions" },
];

type FieldValues = Record<
  | "technical_boundaries"
  | "parameter_ranges"
  | "delivery_conditions"
  | "production_ready_criteria"
  | "downstream_dependencies"
  | "publish_requirements"
  | "allowed_refinements"
  | "escalation_conditions",
  string
>;

function fieldValuesFromRevision(
  revision: ExecutionAnchorRevisionRead | null,
): FieldValues {
  return {
    technical_boundaries: revision?.technical_boundaries ?? "",
    parameter_ranges: revision?.parameter_ranges ?? "",
    delivery_conditions: revision?.delivery_conditions ?? "",
    production_ready_criteria: revision?.production_ready_criteria ?? "",
    downstream_dependencies: revision?.downstream_dependencies ?? "",
    publish_requirements: revision?.publish_requirements ?? "",
    allowed_refinements: revision?.allowed_refinements ?? "",
    escalation_conditions: revision?.escalation_conditions ?? "",
  };
}

/** The Execution Anchor draft/confirm/reject interaction, mirroring
 * `CoreAnchorRevisionEditor.tsx`'s real domain-rule pattern (create
 * draft -> save -> confirm/reject through the Human CG Supervisor, real
 * HumanGate/Decision recording, real conflict handling). No Execution
 * Anchor yet offers "Generate Execution Anchor draft" (Agent-assisted,
 * reads the confirmed Core Anchor) as the primary action and "Start
 * blank draft" as a secondary manual option; a confirmed, still-current
 * Execution Anchor offers "Create new revision" from that confirmed
 * baseline, unchanged.
 *
 * A confirmed Execution Anchor whose own upstream Core Anchor revision
 * has since been superseded (`isOutdated`, from the real Anchor Context
 * `execution_anchor.context_state` -- owner re-validation correction)
 * instead offers "Generate Execution Anchor R{n+1} draft from Core
 * Anchor R{n}" as the primary action -- the exact same, already-formal
 * `generateExecutionAnchorDraftAction` Agent/Human-Gate path used for a
 * first-ever Execution Anchor, just also offered once a confirmed one
 * already exists and needs retranslating -- with the plain clone-based
 * "Create new revision" relabeled "Start manually from Execution Anchor
 * R{n}" as a secondary option, never removed, just no longer ambiguous
 * about which one actually reflects the new Core Anchor.
 *
 * The backend rejects confirming a draft with no meaningful content in
 * any field -- this editor disables Confirm and explains why in the
 * same case, while Save always remains available for an incomplete
 * working draft. */
export function ExecutionAnchorEditor({
  taskId,
  draftRevision,
  draftHumanGateId,
  coreAnchorConfirmed,
  hasConfirmedRevision,
  confirmedRevisionNumber = null,
  isOutdated = false,
  coreAnchorRevisionNumber = null,
}: {
  taskId: string;
  draftRevision: ExecutionAnchorRevisionRead | null;
  draftHumanGateId: string | null;
  coreAnchorConfirmed: boolean;
  hasConfirmedRevision: boolean;
  /** The confirmed Execution Anchor's own revision number, for the
   * "R{n+1}" labels below -- `null` when there is no confirmed revision
   * (`hasConfirmedRevision` is `false`). */
  confirmedRevisionNumber?: number | null;
  /** True only when the confirmed Execution Anchor's own upstream Core
   * Anchor revision has been superseded (real Anchor Context state, not
   * a UI guess) -- see `ExecutionPage.tsx`. */
  isOutdated?: boolean;
  /** The Shot's currently confirmed Core Anchor revision number, for
   * the "from Core Anchor R{n}" half of the outdated-state label. */
  coreAnchorRevisionNumber?: number | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [rationale, setRationale] = useState("");
  const [values, setValues] = useState<FieldValues>(() =>
    fieldValuesFromRevision(draftRevision),
  );

  // Re-sync `values` whenever the server hands us a genuinely different
  // revision -- a new draft appearing (Generate/Create-new-revision/Start
  // blank, none of which remount this component) or this same draft's
  // own content changing after a save. Without this, the lazy useState
  // initializer above only ever runs once, so a draft created with real
  // copied/generated content (not blank) would render with stale blank
  // fields until a manual page reload. Mirrors
  // `CoreAnchorRevisionEditor.tsx`'s identical `syncedKeyRef` pattern.
  const syncedKeyRef = useRef<string>("");
  const revisionKey = draftRevision
    ? `${draftRevision.id}:${draftRevision.updated_at}`
    : "none";
  useEffect(() => {
    if (syncedKeyRef.current !== revisionKey) {
      setValues(fieldValuesFromRevision(draftRevision));
      syncedKeyRef.current = revisionKey;
    }
  }, [revisionKey, draftRevision]);

  if (draftRevision === null) {
    function runStartAction(
      action: () => Promise<{ ok: boolean; error?: { message: string } }>,
    ) {
      setError(null);
      startTransition(() => {
        action().then((result) => {
          if (result.ok) {
            router.refresh();
          } else if (result.error) {
            setError(result.error.message);
          }
        });
      });
    }

    const nextRevisionNumber =
      confirmedRevisionNumber !== null ? confirmedRevisionNumber + 1 : null;

    return (
      <div className={styles.wrapper}>
        {hasConfirmedRevision && isOutdated ? (
          <div className={styles.startActions}>
            <button
              type="button"
              className={styles.primaryButton}
              disabled={isPending}
              onClick={() =>
                runStartAction(() => generateExecutionAnchorDraftAction(taskId))
              }
            >
              {isPending
                ? "Generating…"
                : `Generate Execution Anchor ${
                    nextRevisionNumber !== null ? `R${nextRevisionNumber} ` : ""
                  }draft from Core Anchor${
                    coreAnchorRevisionNumber !== null
                      ? ` R${coreAnchorRevisionNumber}`
                      : ""
                  }`}
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              disabled={isPending}
              onClick={() =>
                runStartAction(() =>
                  createExecutionAnchorDraftFromConfirmedAction(taskId),
                )
              }
            >
              {isPending
                ? "Starting…"
                : `Start manually from Execution Anchor${
                    confirmedRevisionNumber !== null
                      ? ` R${confirmedRevisionNumber}`
                      : ""
                  }`}
            </button>
          </div>
        ) : hasConfirmedRevision ? (
          <button
            type="button"
            className={styles.primaryButton}
            disabled={isPending}
            onClick={() =>
              runStartAction(() =>
                createExecutionAnchorDraftFromConfirmedAction(taskId),
              )
            }
          >
            {isPending ? "Starting…" : "Create new revision"}
          </button>
        ) : coreAnchorConfirmed ? (
          <div className={styles.startActions}>
            <button
              type="button"
              className={styles.primaryButton}
              disabled={isPending}
              onClick={() =>
                runStartAction(() => generateExecutionAnchorDraftAction(taskId))
              }
            >
              {isPending ? "Generating…" : "Generate Execution Anchor draft"}
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              disabled={isPending}
              onClick={() =>
                runStartAction(() => createExecutionAnchorDraftAction(taskId))
              }
            >
              {isPending ? "Starting draft…" : "Start blank draft"}
            </button>
          </div>
        ) : (
          <p className={styles.empty}>
            Starting an Execution Anchor draft requires a confirmed Core Anchor
            for this Task&apos;s Shot, which does not exist yet.
          </p>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  const hasMeaningfulContent = Object.values(values).some(
    (value) => value.trim().length > 0,
  );
  const confirmDisabled = isPending || !hasMeaningfulContent;

  return (
    <div className={styles.wrapper}>
      <AuthorityBoundary
        tone="human"
        label={<AuthorityLabel variant="human-intent" />}
        ownerLabel="The Human CG Supervisor"
        statement="owns Execution Anchor confirmation. Agent output remains advisory until human confirmation."
      />

      <div className={styles.fields}>
        {CONTENT_FIELDS.map(({ key, label }) => (
          <label key={key} className={styles.fieldLabel}>
            {label}
            <textarea
              className={styles.fieldInput}
              value={values[key]}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, [key]: event.target.value }))
              }
              rows={2}
            />
          </label>
        ))}
      </div>

      <div className={styles.saveRow}>
        <button
          type="button"
          className={styles.secondaryButton}
          disabled={isPending}
          onClick={() => {
            setError(null);
            setSaveStatus(null);
            startTransition(() => {
              saveExecutionAnchorDraftAction(
                taskId,
                draftRevision.id,
                values,
              ).then((result) => {
                if (result.ok) {
                  setSaveStatus("Changes saved.");
                  router.refresh();
                } else {
                  setError(result.error.message);
                }
              });
            });
          }}
        >
          {isPending ? "Saving…" : "Save changes"}
        </button>
        {saveStatus && (
          <span className={styles.saveStatus} role="status">
            {saveStatus}
          </span>
        )}
      </div>

      <label className={styles.fieldLabel}>
        Rationale (optional)
        <textarea
          className={styles.fieldInput}
          value={rationale}
          onChange={(event) => setRationale(event.target.value)}
          rows={2}
        />
      </label>

      {!hasMeaningfulContent && (
        <p className={styles.blockingReason} role="status">
          {EMPTY_CONFIRM_EXPLANATION}
        </p>
      )}

      <div className={styles.decisionRow}>
        <button
          type="button"
          className={styles.primaryButton}
          disabled={confirmDisabled}
          onClick={() => {
            setError(null);
            startTransition(() => {
              confirmExecutionAnchorRevisionAction(
                taskId,
                draftRevision.id,
                draftHumanGateId,
                rationale,
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
          {isPending ? "Confirming…" : "Confirm Execution Anchor"}
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          disabled={isPending}
          onClick={() => {
            setError(null);
            startTransition(() => {
              rejectExecutionAnchorRevisionAction(
                taskId,
                draftRevision.id,
                draftHumanGateId,
                rationale,
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
          {isPending ? "Discarding…" : "Discard draft"}
        </button>
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
