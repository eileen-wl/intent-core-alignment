"use client";

import type { CoreAnchorRevisionRead, CoreAnchorRevisionUpdate, HumanGateRead, VfxInboxItemRead } from "@intent-core/contracts";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ConfirmationDialog } from "@/design";
import {
  confirmCoreAnchorRevisionAction,
  rejectCoreAnchorRevisionAction,
  saveCoreAnchorDraftAction,
} from "@/features/vfx/intent-workspace/actions";
import { computeChangeSummary } from "@/features/vfx/intent-workspace/changeSummary";
import type { IntentEvidenceData } from "@/features/vfx/intent-workspace/data";
import { IntentSourceContext } from "./IntentSourceContext";
import { FieldIcon } from "./FieldIcon";
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

const CORE_DIRECTION_FIELDS = new Set<keyof FormState["scalars"]>([
  "core_summary",
  "shot_objective",
  "emotional_tone",
  "visual_focus",
]);

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
  confirmedText: (item: { content: string } | { description: string } | { question: string }) => string;
}[] = [
  {
    field: "constraints",
    label: "Constraints",
    addLabel: "Add constraint",
    placeholder: "A constraint",
    confirmedText: (item) => (item as { content: string }).content,
  },
  {
    field: "variation_zones",
    label: "Variation zones",
    addLabel: "Add variation zone",
    placeholder: "A variation zone",
    confirmedText: (item) => (item as { content: string }).content,
  },
  {
    field: "drift_risks",
    label: "Drift risks",
    addLabel: "Add drift risk",
    placeholder: "A drift risk",
    confirmedText: (item) => (item as { description: string }).description,
  },
  {
    field: "open_questions",
    label: "Open questions",
    addLabel: "Add open question",
    placeholder: "An open question",
    confirmedText: (item) => (item as { question: string }).question,
  },
];

/** Whether a simple collection's real content (never metadata like id/
 * order_index) differs between the confirmed revision and the current
 * form state -- drives the row's restrained "Changed" indicator, never
 * `computeChangeSummary` itself (that stays the single source of truth
 * for the textual change summary; this is a separate, purely
 * presentational per-row diff). */
function simpleCollectionChanged(
  confirmedItems: unknown[],
  formItems: SimpleItem[],
  confirmedText: (item: never) => string,
): boolean {
  const before = confirmedItems.map((item) => confirmedText(item as never));
  const after = formItems.map((item) => item.text);
  return JSON.stringify(before) !== JSON.stringify(after);
}

function referencesChanged(
  confirmed: CoreAnchorRevisionRead["references"],
  form: ReferenceItem[],
): boolean {
  const before = confirmed.map((item) => `${item.label}|${item.uri ?? ""}|${item.note ?? ""}`);
  const after = form.map((item) => `${item.label}|${item.uri}|${item.note}`);
  return JSON.stringify(before) !== JSON.stringify(after);
}

export function CoreAnchorRevisionEditor({
  shotId,
  shotName,
  item,
  confirmedRevision,
  draftRevision,
  humanGate,
  evidenceData,
}: {
  shotId: string;
  shotName: string;
  /** Only needed to render "Source of creative intent" for FIRST DRAFT
   * (no confirmed revision to compare against yet). */
  item: VfxInboxItemRead;
  confirmedRevision: CoreAnchorRevisionRead | null;
  draftRevision: CoreAnchorRevisionRead;
  humanGate: HumanGateRead | null;
  evidenceData: IntentEvidenceData | null;
}) {
  const isFirstDraft = confirmedRevision === null;
  const syncedKeyRef = useRef<string>("");
  const [form, setForm] = useState<FormState>(() => toFormState(draftRevision));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [rationale, setRationale] = useState("");
  const [dialogMode, setDialogMode] = useState<"confirm" | "reject" | null>(null);
  const [dialogPending, setDialogPending] = useState(false);
  const [dialogConflict, setDialogConflict] = useState<string | null>(null);
  const [decisionOutcome, setDecisionOutcome] = useState<{ kind: "rejected"; at: string } | null>(
    null,
  );
  // Purely presentational: whether the restrained per-field "Changed"
  // indicators are shown on the REVISION DRAFT comparison. Never
  // affects which data is saved/confirmed/rejected.
  const [showChanges, setShowChanges] = useState(true);
  const [isSaving, startSaveTransition] = useTransition();
  const router = useRouter();

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
    const mode = dialogMode;
    const submit = mode === "confirm" ? confirmCoreAnchorRevisionAction : rejectCoreAnchorRevisionAction;
    submit(shotId, draftRevision.id, humanGate.id, rationale).then((result) => {
      setDialogPending(false);
      if (result.ok) {
        setDialogMode(null);
        if (mode === "confirm") {
          // Step 7C-2: no local "just confirmed" message here -- the
          // draft is gone the moment this succeeds, so this component
          // is about to unmount. The transient success presentation
          // moves to `ConfirmedAnchorSummary` via a `?justConfirmed=`
          // navigation, which also forces the fresh server data
          // (confirmedRevision now set, draftRevision now null) that
          // rendering it correctly depends on.
          router.push(`/vfx/shots/${shotId}/intent?justConfirmed=${result.revision.id}`);
        } else {
          setDecisionOutcome({ kind: "rejected", at: new Date().toLocaleString() });
        }
      } else {
        setDialogConflict(result.error.message);
      }
    });
  }

  function scalarField(field: keyof FormState["scalars"], label: string) {
    return (
      <label key={field} className={styles.formField}>
        <span className={styles.fieldLabel}>
          <FieldIcon field={field} />
          {label}
        </span>
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
    );
  }

  function simpleCollectionFieldset(entry: (typeof SIMPLE_COLLECTIONS)[number]) {
    const { field, label, addLabel, placeholder } = entry;
    return (
      <fieldset key={field} className={styles.collectionField}>
        <legend className={styles.fieldLabel}>
          <FieldIcon field={field} />
          {label}
        </legend>
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
    );
  }

  const referencesFieldset = (
    <fieldset className={styles.collectionField}>
      <legend className={styles.fieldLabel}>
        <FieldIcon field="references" />
        References
      </legend>
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
  );

  const saveRow = (
    <div className={styles.saveRow}>
      <button type="button" className={styles.saveButton} onClick={handleSave} disabled={isSaving}>
        {isSaving ? "Saving…" : "Save draft"}
      </button>
      {saveState === "saved" && <span className={styles.savedNotice}>Changes saved.</span>}
      {saveState === "error" && saveError && (
        <span className={styles.saveErrorNotice} role="alert">
          {saveError}
        </span>
      )}
    </div>
  );

  return (
    <div className={styles.wrapper}>
      {decisionOutcome && (
        <p className={styles.outcome} role="status">
          Revision {draftRevision.revision_number} was {decisionOutcome.kind} at {decisionOutcome.at}.
        </p>
      )}

      {isFirstDraft ? (
        <div className={styles.firstDraftGrid}>
          <div className={styles.column}>
            <IntentSourceContext item={item} evidenceData={evidenceData} />
          </div>

          <div className={styles.column}>
            <div className={styles.firstDraftHeader}>
              <h2 className={styles.columnHeading}>Create first Core Anchor draft</h2>
              <span className={styles.revisionBadge}>Revision {draftRevision.revision_number}</span>
              <span className={styles.draftBadge}>Draft</span>
            </div>
            <div className={styles.form}>
              <fieldset className={styles.fieldGroup}>
                <legend className={styles.groupLabel}>Core direction</legend>
                {SCALAR_FIELDS.filter(({ field }) => CORE_DIRECTION_FIELDS.has(field)).map(
                  ({ field, label }) => scalarField(field, label),
                )}
              </fieldset>

              <fieldset className={styles.fieldGroup}>
                <legend className={styles.groupLabel}>Detailed intent</legend>
                {SCALAR_FIELDS.filter(({ field }) => !CORE_DIRECTION_FIELDS.has(field)).map(
                  ({ field, label }) => scalarField(field, label),
                )}
              </fieldset>

              <fieldset className={styles.fieldGroup}>
                <legend className={styles.groupLabel}>Boundaries and uncertainty</legend>
                {SIMPLE_COLLECTIONS.map((entry) => simpleCollectionFieldset(entry))}
                {referencesFieldset}
              </fieldset>

              {saveRow}
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.comparisonGrid}>
          <div className={styles.gridHeaderLeft}>Current confirmed</div>
          <div className={styles.gridHeaderSpacer} aria-hidden="true" />
          <div className={styles.gridHeaderRight}>
            <span>Proposed draft revision</span>
            <span className={styles.revisionBadge}>
              v{draftRevision.revision_number} · Draft
            </span>
            <label className={styles.showChangesToggle}>
              <input
                type="checkbox"
                checked={showChanges}
                onChange={(event) => setShowChanges(event.target.checked)}
              />
              Show changes
            </label>
          </div>

          {SCALAR_FIELDS.map(({ field, label }) => {
            const confirmedValue = confirmedRevision[field] as string | null;
            const changed = showChanges && confirmedRevision[field] !== form.scalars[field];
            return (
              <div className={styles.fieldRow} key={field}>
                <div className={styles.leftCell}>
                  <span className={styles.fieldLabel}>
                    <FieldIcon field={field} />
                    {label}
                  </span>
                  {confirmedValue && <p className={styles.fieldValue}>{confirmedValue}</p>}
                </div>
                <ArrowIcon />
                <div className={[styles.rightCell, changed ? styles.changedCell : ""].join(" ")}>
                  {scalarField(field, label)}
                  {changed && <span className={styles.changedDot} aria-label="Changed" />}
                </div>
              </div>
            );
          })}

          {SIMPLE_COLLECTIONS.map((entry) => {
            const confirmedItems = confirmedRevision[entry.field] as unknown[];
            const changed =
              showChanges && simpleCollectionChanged(confirmedItems, form[entry.field], entry.confirmedText as never);
            return (
              <div className={styles.fieldRow} key={entry.field}>
                <div className={styles.leftCell}>
                  <span className={styles.fieldLabel}>
                    <FieldIcon field={entry.field} />
                    {entry.label}
                  </span>
                  {confirmedItems.length > 0 && (
                    <ul className={styles.readOnlyList}>
                      {confirmedItems.map((confirmedItem, index) => (
                        // eslint-disable-next-line react/no-array-index-key -- read-only confirmed snapshot has no stable id beyond position here
                        <li key={index}>{entry.confirmedText(confirmedItem as never)}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <ArrowIcon />
                <div className={[styles.rightCell, changed ? styles.changedCell : ""].join(" ")}>
                  {simpleCollectionFieldset(entry)}
                  {changed && <span className={styles.changedDot} aria-label="Changed" />}
                </div>
              </div>
            );
          })}

          <div className={styles.fieldRow}>
            <div className={styles.leftCell}>
              <span className={styles.fieldLabel}>
                <FieldIcon field="references" />
                References
              </span>
              {confirmedRevision.references.length > 0 && (
                <ul className={styles.readOnlyList}>
                  {confirmedRevision.references.map((reference) => (
                    <li key={reference.id}>
                      {reference.label}
                      {reference.uri && <> — {reference.uri}</>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <ArrowIcon />
            <div
              className={[
                styles.rightCell,
                showChanges && referencesChanged(confirmedRevision.references, form.references)
                  ? styles.changedCell
                  : "",
              ].join(" ")}
            >
              {referencesFieldset}
              {showChanges && referencesChanged(confirmedRevision.references, form.references) && (
                <span className={styles.changedDot} aria-label="Changed" />
              )}
            </div>
          </div>

          <div className={styles.gridFooterSpan}>{saveRow}</div>
        </div>
      )}

      {changeSummary.length > 0 && (
        <p className={styles.changeSummary}>Change summary: {changeSummary.join(", ")}</p>
      )}

      <div className={styles.decisionBlock}>
        <div className={styles.rationaleHeader}>
          <label className={styles.rationaleLabel} htmlFor="core-anchor-rationale">
            Rationale
          </label>
          <span className={styles.rationaleHint}>Optional but recommended</span>
        </div>
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
            ? `You are confirming revision #${draftRevision.revision_number} as the shared creative intent for ${shotName}. Only a Human VFX Supervisor may confirm a Core Anchor -- once confirmed, downstream CG, Artist, and review work will align to it.`
            : `You are rejecting revision #${draftRevision.revision_number} for ${shotName}. Only a Human VFX Supervisor may reject a Core Anchor draft -- once rejected, it will no longer be available for confirmation, and a new draft can be started afterward.`
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

function ArrowIcon() {
  return (
    <svg className={styles.arrow} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h13" />
      <path d="m14 7 5 5-5 5" />
    </svg>
  );
}
