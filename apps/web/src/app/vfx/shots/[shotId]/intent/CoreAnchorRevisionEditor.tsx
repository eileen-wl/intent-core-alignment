"use client";

import type { CoreAnchorRevisionRead, CoreAnchorRevisionUpdate, HumanGateRead } from "@intent-core/contracts";
import { useEffect, useRef, useState, useTransition } from "react";

import { ComparisonArea, ConfirmationDialog } from "@/design";
import {
  confirmCoreAnchorRevisionAction,
  rejectCoreAnchorRevisionAction,
  saveCoreAnchorDraftAction,
} from "@/features/vfx/intent-workspace/actions";
import { computeChangeSummary } from "@/features/vfx/intent-workspace/changeSummary";
import styles from "./CoreAnchorRevisionEditor.module.css";

const SCALAR_FIELDS: { field: keyof FormState["scalars"]; label: string }[] = [
  { field: "core_summary", label: "Core summary" },
  { field: "shot_objective", label: "Shot objective" },
  { field: "emotional_tone", label: "Emotional tone" },
  { field: "visual_focus", label: "Visual focus" },
  { field: "rhythm_intensity", label: "Rhythm and intensity" },
  { field: "character_relationship", label: "Character relationship" },
  { field: "narrative_priority", label: "Narrative priority" },
];

interface SimpleItem {
  key: string;
  text: string;
}
interface ReferenceItem {
  key: string;
  label: string;
  uri: string;
  note: string;
}

interface FormState {
  scalars: {
    core_summary: string;
    shot_objective: string;
    emotional_tone: string;
    visual_focus: string;
    rhythm_intensity: string;
    character_relationship: string;
    narrative_priority: string;
  };
  constraints: SimpleItem[];
  variation_zones: SimpleItem[];
  drift_risks: SimpleItem[];
  open_questions: SimpleItem[];
  references: ReferenceItem[];
}

let nextKey = 0;
function newKey(): string {
  nextKey += 1;
  return `local-${nextKey}`;
}

function toFormState(revision: CoreAnchorRevisionRead): FormState {
  return {
    scalars: {
      core_summary: revision.core_summary ?? "",
      shot_objective: revision.shot_objective ?? "",
      emotional_tone: revision.emotional_tone ?? "",
      visual_focus: revision.visual_focus ?? "",
      rhythm_intensity: revision.rhythm_intensity ?? "",
      character_relationship: revision.character_relationship ?? "",
      narrative_priority: revision.narrative_priority ?? "",
    },
    constraints: revision.constraints.map((item) => ({ key: newKey(), text: item.content })),
    variation_zones: revision.variation_zones.map((item) => ({ key: newKey(), text: item.content })),
    drift_risks: revision.drift_risks.map((item) => ({ key: newKey(), text: item.description })),
    open_questions: revision.open_questions.map((item) => ({ key: newKey(), text: item.question })),
    references: revision.references.map((item) => ({
      key: newKey(),
      label: item.label,
      uri: item.uri ?? "",
      note: item.note ?? "",
    })),
  };
}

function toUpdatePayload(form: FormState): CoreAnchorRevisionUpdate {
  return {
    ...form.scalars,
    constraints: form.constraints.map((item) => ({ content: item.text })),
    variation_zones: form.variation_zones.map((item) => ({ content: item.text })),
    drift_risks: form.drift_risks.map((item) => ({ description: item.text })),
    open_questions: form.open_questions.map((item) => ({ question: item.text })),
    references: form.references.map((item) => ({
      label: item.label,
      uri: item.uri || null,
      note: item.note || null,
    })),
  };
}

const SIMPLE_COLLECTIONS: {
  field: "constraints" | "variation_zones" | "drift_risks" | "open_questions";
  label: string;
  addLabel: string;
  placeholder: string;
}[] = [
  { field: "constraints", label: "Constraints", addLabel: "Add constraint", placeholder: "A constraint" },
  {
    field: "variation_zones",
    label: "Variation zones",
    addLabel: "Add variation zone",
    placeholder: "A variation zone",
  },
  { field: "drift_risks", label: "Drift risks", addLabel: "Add drift risk", placeholder: "A drift risk" },
  {
    field: "open_questions",
    label: "Open questions",
    addLabel: "Add open question",
    placeholder: "An open question",
  },
];

export function CoreAnchorRevisionEditor({
  shotId,
  shotName,
  confirmedRevision,
  draftRevision,
  humanGate,
}: {
  shotId: string;
  shotName: string;
  confirmedRevision: CoreAnchorRevisionRead | null;
  draftRevision: CoreAnchorRevisionRead;
  humanGate: HumanGateRead | null;
}) {
  const syncedKeyRef = useRef<string>("");
  const [form, setForm] = useState<FormState>(() => toFormState(draftRevision));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [rationale, setRationale] = useState("");
  const [dialogMode, setDialogMode] = useState<"confirm" | "reject" | null>(null);
  const [dialogPending, setDialogPending] = useState(false);
  const [dialogConflict, setDialogConflict] = useState<string | null>(null);
  const [decisionOutcome, setDecisionOutcome] = useState<
    { kind: "confirmed" | "rejected"; at: string } | null
  >(null);
  const [isSaving, startSaveTransition] = useTransition();

  const revisionKey = `${draftRevision.id}:${draftRevision.updated_at}`;
  useEffect(() => {
    if (syncedKeyRef.current !== revisionKey) {
      setForm(toFormState(draftRevision));
      syncedKeyRef.current = revisionKey;
    }
  }, [revisionKey, draftRevision]);

  const changeSummary = computeChangeSummary(confirmedRevision, {
    ...draftRevision,
    ...toUpdatePayload(form),
  } as CoreAnchorRevisionRead);

  function updateSimpleCollection(
    field: (typeof SIMPLE_COLLECTIONS)[number]["field"],
    key: string,
    text: string,
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: previous[field].map((item) => (item.key === key ? { ...item, text } : item)),
    }));
  }

  function addSimpleItem(field: (typeof SIMPLE_COLLECTIONS)[number]["field"]) {
    setForm((previous) => ({
      ...previous,
      [field]: [...previous[field], { key: newKey(), text: "" }],
    }));
  }

  function removeSimpleItem(field: (typeof SIMPLE_COLLECTIONS)[number]["field"], key: string) {
    setForm((previous) => ({
      ...previous,
      [field]: previous[field].filter((item) => item.key !== key),
    }));
    setFieldErrors((previous) => {
      const next = { ...previous };
      delete next[`${field}:${key}`];
      return next;
    });
  }

  function handleSave() {
    const errors: Record<string, string> = {};
    for (const { field } of SIMPLE_COLLECTIONS) {
      for (const item of form[field]) {
        if (!item.text.trim()) {
          errors[`${field}:${item.key}`] = "This field cannot be blank.";
        }
      }
    }
    for (const reference of form.references) {
      if (!reference.label.trim()) {
        errors[`references:${reference.key}`] = "A reference needs a label.";
      }
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setSaveState("saving");
    setSaveError(null);
    startSaveTransition(() => {
      saveCoreAnchorDraftAction(shotId, draftRevision.id, toUpdatePayload(form)).then((result) => {
        if (result.ok) {
          setSaveState("saved");
          syncedKeyRef.current = `${result.revision.id}:${result.revision.updated_at}`;
          setForm(toFormState(result.revision));
        } else {
          setSaveState("error");
          setSaveError(result.error.message);
        }
      });
    });
  }

  function openDialog(mode: "confirm" | "reject") {
    setDialogConflict(null);
    setDialogMode(mode);
  }

  function closeDialog() {
    if (dialogPending) return;
    setDialogMode(null);
  }

  function submitDialog() {
    if (!humanGate) return;
    setDialogPending(true);
    const submit = dialogMode === "confirm" ? confirmCoreAnchorRevisionAction : rejectCoreAnchorRevisionAction;
    submit(shotId, draftRevision.id, humanGate.id, rationale).then((result) => {
      setDialogPending(false);
      if (result.ok) {
        setDialogMode(null);
        setDecisionOutcome({
          kind: dialogMode === "confirm" ? "confirmed" : "rejected",
          at: new Date().toLocaleString(),
        });
      } else if (result.error.kind === "conflict") {
        setDialogConflict(result.error.message);
      } else {
        setDialogConflict(result.error.message);
      }
    });
  }

  return (
    <div className={styles.wrapper}>
      {decisionOutcome && (
        <p className={styles.outcome} role="status">
          Revision {draftRevision.revision_number} was {decisionOutcome.kind} at {decisionOutcome.at}.
        </p>
      )}

      <ComparisonArea>
        <div className={styles.column}>
          <h2 className={styles.columnHeading}>Current confirmed</h2>
          {confirmedRevision ? (
            <div className={styles.readOnlyFields}>
              {SCALAR_FIELDS.map(({ field, label }) =>
                confirmedRevision[field] ? (
                  <div key={field} className={styles.readOnlyField}>
                    <span className={styles.fieldLabel}>{label}</span>
                    <p className={styles.fieldValue}>{confirmedRevision[field] as string}</p>
                  </div>
                ) : null,
              )}
            </div>
          ) : (
            <p className={styles.empty}>No Core Anchor confirmed yet.</p>
          )}
        </div>

        <div className={styles.column}>
          <h2 className={styles.columnHeading}>Proposed draft</h2>
          <div className={styles.form}>
            {SCALAR_FIELDS.map(({ field, label }) => (
              <label key={field} className={styles.formField}>
                <span className={styles.fieldLabel}>{label}</span>
                <textarea
                  className={styles.textarea}
                  value={form.scalars[field]}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      scalars: { ...previous.scalars, [field]: event.target.value },
                    }))
                  }
                  rows={2}
                />
              </label>
            ))}

            {SIMPLE_COLLECTIONS.map(({ field, label, addLabel, placeholder }) => (
              <fieldset key={field} className={styles.collectionField}>
                <legend className={styles.fieldLabel}>{label}</legend>
                {form[field].map((item) => (
                  <div key={item.key} className={styles.collectionRow}>
                    <input
                      type="text"
                      className={styles.textInput}
                      value={item.text}
                      placeholder={placeholder}
                      onChange={(event) => updateSimpleCollection(field, item.key, event.target.value)}
                      aria-invalid={Boolean(fieldErrors[`${field}:${item.key}`])}
                    />
                    <button
                      type="button"
                      className={styles.removeButton}
                      onClick={() => removeSimpleItem(field, item.key)}
                      aria-label={`Remove ${placeholder.toLowerCase()}`}
                    >
                      Remove
                    </button>
                    {fieldErrors[`${field}:${item.key}`] && (
                      <p className={styles.fieldError}>{fieldErrors[`${field}:${item.key}`]}</p>
                    )}
                  </div>
                ))}
                <button type="button" className={styles.addButton} onClick={() => addSimpleItem(field)}>
                  {addLabel}
                </button>
              </fieldset>
            ))}

            <fieldset className={styles.collectionField}>
              <legend className={styles.fieldLabel}>References</legend>
              {form.references.map((reference) => (
                <div key={reference.key} className={styles.referenceRow}>
                  <input
                    type="text"
                    className={styles.textInput}
                    value={reference.label}
                    placeholder="Label"
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        references: previous.references.map((item) =>
                          item.key === reference.key ? { ...item, label: event.target.value } : item,
                        ),
                      }))
                    }
                    aria-invalid={Boolean(fieldErrors[`references:${reference.key}`])}
                  />
                  <input
                    type="text"
                    className={styles.textInput}
                    value={reference.uri}
                    placeholder="URI (optional)"
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        references: previous.references.map((item) =>
                          item.key === reference.key ? { ...item, uri: event.target.value } : item,
                        ),
                      }))
                    }
                  />
                  <input
                    type="text"
                    className={styles.textInput}
                    value={reference.note}
                    placeholder="Note (optional)"
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        references: previous.references.map((item) =>
                          item.key === reference.key ? { ...item, note: event.target.value } : item,
                        ),
                      }))
                    }
                  />
                  <button
                    type="button"
                    className={styles.removeButton}
                    onClick={() =>
                      setForm((previous) => ({
                        ...previous,
                        references: previous.references.filter((item) => item.key !== reference.key),
                      }))
                    }
                  >
                    Remove
                  </button>
                  {fieldErrors[`references:${reference.key}`] && (
                    <p className={styles.fieldError}>{fieldErrors[`references:${reference.key}`]}</p>
                  )}
                </div>
              ))}
              <button
                type="button"
                className={styles.addButton}
                onClick={() =>
                  setForm((previous) => ({
                    ...previous,
                    references: [...previous.references, { key: newKey(), label: "", uri: "", note: "" }],
                  }))
                }
              >
                Add reference
              </button>
            </fieldset>

            <div className={styles.saveRow}>
              <button
                type="button"
                className={styles.saveButton}
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? "Saving…" : "Save draft"}
              </button>
              {saveState === "saved" && <span className={styles.savedNotice}>Changes saved.</span>}
              {saveState === "error" && saveError && (
                <span className={styles.saveErrorNotice} role="alert">
                  {saveError}
                </span>
              )}
            </div>
          </div>
        </div>
      </ComparisonArea>

      {changeSummary.length > 0 && (
        <p className={styles.changeSummary}>Change summary: {changeSummary.join(", ")}</p>
      )}

      <div className={styles.decisionBlock}>
        <label className={styles.rationaleLabel} htmlFor="core-anchor-rationale">
          Rationale
        </label>
        <textarea
          id="core-anchor-rationale"
          className={styles.rationaleInput}
          value={rationale}
          onChange={(event) => setRationale(event.target.value)}
          rows={3}
        />
        <div className={styles.decisionActions}>
          <button
            type="button"
            className={styles.rejectButton}
            onClick={() => openDialog("reject")}
            disabled={!humanGate}
          >
            Reject
          </button>
          <button
            type="button"
            className={styles.confirmButton}
            onClick={() => openDialog("confirm")}
            disabled={!humanGate}
          >
            Confirm
          </button>
        </div>
      </div>

      <ConfirmationDialog
        open={dialogMode !== null}
        title={
          dialogMode === "confirm"
            ? "Confirm this Core Anchor revision?"
            : "Reject this Core Anchor revision?"
        }
        description={
          dialogMode === "confirm"
            ? `You are confirming revision #${draftRevision.revision_number} as the shared creative intent for ${shotName}.`
            : `You are rejecting revision #${draftRevision.revision_number} for ${shotName}.`
        }
        rationale={rationale || null}
        confirmLabel={dialogMode === "confirm" ? "Confirm" : "Reject"}
        pendingLabel={dialogMode === "confirm" ? "Confirming…" : "Rejecting…"}
        pending={dialogPending}
        conflictMessage={dialogConflict}
        onConfirm={submitDialog}
        onCancel={closeDialog}
        onReload={() => window.location.reload()}
        focusCancelFirst={dialogMode === "reject"}
      />
    </div>
  );
}
