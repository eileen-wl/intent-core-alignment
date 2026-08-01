"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ExecutionAnchorRevisionRead } from "@intent-core/contracts";

import { AuthorityBoundary, AuthorityLabel } from "@/design";
import {
  confirmExecutionAnchorRevisionAction,
  createExecutionAnchorDraftAction,
  rejectExecutionAnchorRevisionAction,
  saveExecutionAnchorDraftAction,
} from "@/features/cg/actions";
import styles from "./ExecutionAnchorEditor.module.css";

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

function fieldValuesFromRevision(revision: ExecutionAnchorRevisionRead | null): FieldValues {
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
 * draft -> save -> confirm/reject through the Human CG Supervisor,
 * real HumanGate/Decision recording, real conflict handling) at the
 * honestly supported level -- Execution Anchor has no "start new draft
 * from confirmed" backend capability (unlike Core Anchor), so no such
 * button is offered; starting a fresh draft after a confirmation is
 * honestly a blank draft, stated as such. */
export function ExecutionAnchorEditor({
  taskId,
  draftRevision,
  draftHumanGateId,
  coreAnchorConfirmed,
}: {
  taskId: string;
  draftRevision: ExecutionAnchorRevisionRead | null;
  draftHumanGateId: string | null;
  coreAnchorConfirmed: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [rationale, setRationale] = useState("");
  const [values, setValues] = useState<FieldValues>(() => fieldValuesFromRevision(draftRevision));

  if (draftRevision === null) {
    return (
      <div className={styles.wrapper}>
        {coreAnchorConfirmed ? (
          <button
            type="button"
            className={styles.primaryButton}
            disabled={isPending}
            onClick={() => {
              setError(null);
              startTransition(() => {
                createExecutionAnchorDraftAction(taskId).then((result) => {
                  if (result.ok) {
                    router.refresh();
                  } else {
                    setError(result.error.message);
                  }
                });
              });
            }}
          >
            {isPending ? "Starting draft…" : "Start Execution Anchor draft"}
          </button>
        ) : (
          <p className={styles.empty}>
            Starting an Execution Anchor draft requires a confirmed Core Anchor for this
            Task&apos;s Shot, which does not exist yet.
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
              onChange={(event) => setValues((prev) => ({ ...prev, [key]: event.target.value }))}
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
              saveExecutionAnchorDraftAction(taskId, draftRevision.id, values).then((result) => {
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

      <div className={styles.decisionRow}>
        <button
          type="button"
          className={styles.primaryButton}
          disabled={isPending}
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
