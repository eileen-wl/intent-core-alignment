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
  // The form state as of the last successful Save (or the initial load) --
  // compared against the live `form` below to detect unsaved edits.
  // Confirming always resolves whatever is currently *persisted* for this
  // revision (the backend call sends only `revisionId`, never the live
  // form), so confirming while this differs from `form` would silently
  // discard in-progress edits -- see `hasUnsavedChanges`.
  const [lastSavedForm, setLastSavedForm] = useState<FormState>(() => toFormState(draftRevision));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [rationale, setRationale] = useState("");
  const [dialogMode, setDialogMode] = useState<"confirm" | "reject" | null>(null);
  const [dialogPending, setDialogPending] = useState(false);
  const [dialogConflict, setDialogConflict] = useState<string | null>(null);
  const [decisionOutcome, setDecisionOutcome] = useState<{ kind: "discarded"; at: string } | null>(
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
      const synced = toFormState(draftRevision);
      setForm(synced);
      setLastSavedForm(synced);
      syncedKeyRef.current = revisionKey;
    }
  }, [revisionKey, draftRevision]);

  const changeSummary = computeChangeSummary(confirmedRevision, {
    ...draftRevision,
    ...toUpdatePayload(form),
  } as CoreAnchorRevisionRead);

  // Real blocking reasons for Confirm/Reject -- each one has an honest,
  // on-page explanation below rather than a silently disabled button.
  // Confirming resolves whatever is currently persisted for this
  // revision, so unsaved edits must be saved first or they would be
  // silently discarded; a save/confirm/reject already in flight must
  // finish before another one starts. A draft that has never had a
  // HumanGate loaded (the legacy-compatibility case
  // `intent.human_gate_service` documents) is deliberately NOT a
  // blocking reason here -- the real backend confirm/reject call creates
  // that missing gate atomically with the resolution itself.
  const hasUnsavedChanges = JSON.stringify(form) !== JSON.stringify(lastSavedForm);
  const requestInFlight = isSaving || dialogPending;
  const confirmDisabled = requestInFlight || hasUnsavedChanges;
  const rejectDisabled = requestInFlight;
  const draftStatusLabel = hasUnsavedChanges ? "Unsaved changes" : "Saved";
  const contentOverview = [
    { label: "Constraints", value: form.constraints.length },
    { label: "Variation zones", value: form.variation_zones.length },
    { label: "Drift risks", value: form.drift_risks.length },
    { label: "Open questions", value: form.open_questions.length },
  ];

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
          const synced = toFormState(result.revision);
          setForm(synced);
          setLastSavedForm(synced);
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
    setDialogPending(true);
    const mode = dialogMode;
    const submit = mode === "confirm" ? confirmCoreAnchorRevisionAction : rejectCoreAnchorRevisionAction;
    // `humanGate` may legitimately be null here -- a legacy draft that
    // has never had a gate created for it. The Server Action's own
    // `validateGateAndRevision` treats that as safe to proceed (the real
    // backend confirm/reject call creates the missing gate atomically),
    // never as a stale conflict.
    submit(shotId, draftRevision.id, humanGate?.id ?? null, rationale).then((result) => {
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
          setDecisionOutcome({ kind: "discarded", at: new Date().toLocaleString() });
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


  function firstDraftScalarField(
    field: keyof FormState["scalars"],
    label: string,
    rows: number,
  ) {
    return (
      <label key={field} className={styles.firstDraftScalarRow}>
        <span className={styles.firstDraftScalarLabel}>
          <FieldIcon field={field} />
          {label}
        </span>
        <textarea
          className={styles.firstDraftScalarInput}
          value={form.scalars[field]}
          onChange={(event) =>
            setForm((previous) => ({
              ...previous,
              scalars: { ...previous.scalars, [field]: event.target.value },
            }))
          }
          rows={rows}
        />
      </label>
    );
  }

  function firstDraftCollectionSection(entry: (typeof SIMPLE_COLLECTIONS)[number]) {
    const { field, label, addLabel, placeholder } = entry;
    const emptyCopy: Record<(typeof SIMPLE_COLLECTIONS)[number]["field"], string> = {
      constraints: "No constraints added yet.",
      variation_zones: "No variation zones added yet.",
      drift_risks: "No drift risks identified yet.",
      open_questions: "No open questions yet.",
    };

    return (
      <section key={field} className={styles.firstDraftCollectionSection}>
        <div className={styles.firstDraftCollectionHeader}>
          <h3 className={styles.firstDraftCollectionTitle}>
            <FieldIcon field={field} />
            {label} ({form[field].length})
          </h3>
          <button
            type="button"
            className={styles.firstDraftInlineAction}
            onClick={() => addSimpleItem(field)}
          >
            + {addLabel}
          </button>
        </div>

        {form[field].length === 0 ? (
          <p className={styles.firstDraftCollectionEmpty}>{emptyCopy[field]}</p>
        ) : (
          <div className={styles.firstDraftCollectionItems}>
            {form[field].map((item) => (
              <div key={item.key} className={styles.firstDraftCollectionRow}>
                <input
                  type="text"
                  className={styles.firstDraftCollectionInput}
                  value={item.text}
                  placeholder={placeholder}
                  onChange={(event) => updateSimpleCollection(field, item.key, event.target.value)}
                  aria-invalid={Boolean(fieldErrors[`${field}:${item.key}`])}
                />
                <button
                  type="button"
                  className={styles.firstDraftRemoveButton}
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
          </div>
        )}
      </section>
    );
  }

  const firstDraftReferencesSection = (
    <section className={styles.firstDraftCollectionSection}>
      <div className={styles.firstDraftCollectionHeader}>
        <h3 className={styles.firstDraftCollectionTitle}>
          <FieldIcon field="references" />
          References ({form.references.length})
        </h3>
        <button
          type="button"
          className={styles.firstDraftInlineAction}
          onClick={() =>
            setForm((previous) => ({
              ...previous,
              references: [
                ...previous.references,
                { key: newKey(), label: "", uri: "", note: "" },
              ],
            }))
          }
        >
          + Add reference
        </button>
      </div>

      {form.references.length === 0 ? (
        <p className={styles.firstDraftCollectionEmpty}>No references linked yet.</p>
      ) : (
        <div className={styles.firstDraftReferenceItems}>
          {form.references.map((reference) => (
            <div key={reference.key} className={styles.firstDraftReferenceRow}>
              <div className={styles.firstDraftReferenceFields}>
                <input
                  type="text"
                  className={styles.firstDraftCollectionInput}
                  value={reference.label}
                  placeholder="Label"
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      references: previous.references.map((item) =>
                        item.key === reference.key
                          ? { ...item, label: event.target.value }
                          : item,
                      ),
                    }))
                  }
                  aria-invalid={Boolean(fieldErrors[`references:${reference.key}`])}
                />
                <input
                  type="text"
                  className={styles.firstDraftCollectionInput}
                  value={reference.uri}
                  placeholder="URI (optional)"
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      references: previous.references.map((item) =>
                        item.key === reference.key
                          ? { ...item, uri: event.target.value }
                          : item,
                      ),
                    }))
                  }
                />
                <input
                  type="text"
                  className={styles.firstDraftCollectionInput}
                  value={reference.note}
                  placeholder="Note (optional)"
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      references: previous.references.map((item) =>
                        item.key === reference.key
                          ? { ...item, note: event.target.value }
                          : item,
                      ),
                    }))
                  }
                />
              </div>
              <button
                type="button"
                className={styles.firstDraftRemoveButton}
                onClick={() =>
                  setForm((previous) => ({
                    ...previous,
                    references: previous.references.filter(
                      (item) => item.key !== reference.key,
                    ),
                  }))
                }
              >
                Remove
              </button>
              {fieldErrors[`references:${reference.key}`] && (
                <p className={styles.fieldError}>
                  {fieldErrors[`references:${reference.key}`]}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );

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

  return (
    <div className={styles.wrapper}>
      {decisionOutcome && (
        <p className={styles.outcome} role="status">
          Revision {draftRevision.revision_number} was {decisionOutcome.kind} at {decisionOutcome.at}.
        </p>
      )}

      {isFirstDraft ? (
        <div className={styles.firstDraftWorkspace}>
          <aside className={styles.sourceColumn}>
            <IntentSourceContext item={item} evidenceData={evidenceData} firstDraft />
          </aside>

          <section className={styles.firstDraftEditorCard} aria-labelledby="first-draft-title">
            <div className={styles.firstDraftHeader}>
              <div>
                <p className={styles.editorEyebrow}>Revision 1 editor</p>
                <h2 id="first-draft-title" className={styles.firstDraftTitle}>
                  Create the first Core Anchor
                </h2>
              </div>
              <div className={styles.draftIdentity}>
                <span className={styles.revisionBadge}>
                  Revision {draftRevision.revision_number}
                </span>
                <span className={styles.draftBadge}>Draft in progress</span>
              </div>
            </div>

            <div className={styles.firstDraftEditorGrid}>
              <div className={styles.editorColumn}>
                <fieldset className={styles.firstDraftFieldGroup}>
                  <legend className={styles.firstDraftGroupLabel}>
                    <span className={styles.groupNumber}>1</span>
                    Core direction
                  </legend>
                  <div className={styles.firstDraftScalarFields}>
                    {firstDraftScalarField("core_summary", "Core summary", 2)}
                    {firstDraftScalarField("shot_objective", "Shot objective", 2)}
                    {firstDraftScalarField("emotional_tone", "Emotional tone", 1)}
                    {firstDraftScalarField("visual_focus", "Visual focus", 1)}
                  </div>
                </fieldset>

                <fieldset className={styles.firstDraftFieldGroup}>
                  <legend className={styles.firstDraftGroupLabel}>
                    <span className={styles.groupNumber}>2</span>
                    Detailed intent
                  </legend>
                  <div className={styles.firstDraftScalarFields}>
                    {firstDraftScalarField("rhythm_intensity", "Rhythm and intensity", 1)}
                    {firstDraftScalarField(
                      "character_relationship",
                      "Character relationship",
                      1,
                    )}
                    {firstDraftScalarField("narrative_priority", "Narrative priority", 1)}
                  </div>
                </fieldset>
              </div>

              <fieldset
                className={`${styles.firstDraftFieldGroup} ${styles.boundariesGroup}`}
              >
                <legend className={styles.firstDraftGroupLabel}>
                  <span className={styles.groupNumber}>3</span>
                  Boundaries and uncertainty
                </legend>
                <div className={styles.firstDraftBoundaryList}>
                  {SIMPLE_COLLECTIONS.map((entry) =>
                    firstDraftCollectionSection(entry),
                  )}
                  {firstDraftReferencesSection}
                </div>
              </fieldset>
            </div>

            <div className={styles.firstDraftRationale}>
              <div className={styles.firstDraftRationaleCopy}>
                <label className={styles.rationaleLabel} htmlFor="core-anchor-rationale">
                  Decision rationale · Optional
                </label>
                <span className={styles.rationaleHint}>
                  Included in the recorded Decision when provided.
                </span>
              </div>
              <textarea
                id="core-anchor-rationale"
                className={styles.rationaleInput}
                value={rationale}
                onChange={(event) => setRationale(event.target.value)}
                rows={2}
                placeholder="Explain why these intent choices are right for this Shot…"
              />
            </div>
          </section>

          <section className={styles.firstDraftFooter} aria-label="Draft status and actions">
            <div className={styles.draftStatusPanel}>
              <div className={styles.draftStatusCopy}>
                <span className={styles.statusIcon} aria-hidden="true">
                  ✓
                </span>
                <div>
                  <p className={styles.statusTitle}>Draft status: {draftStatusLabel}</p>
                  <p className={styles.statusDetail}>
                    {hasUnsavedChanges
                      ? "Save the working revision before confirming it."
                      : saveState === "saved"
                        ? "Changes saved."
                        : "This working revision is saved but is not active intent."}
                  </p>
                </div>
              </div>

              <div className={styles.contentOverviewBlock}>
                <p className={styles.contentOverviewTitle}>Content overview</p>
                <div className={styles.contentOverview} aria-label="Content overview">
                  {contentOverview.map((entry) => (
                    <div key={entry.label} className={styles.overviewMetric}>
                      <strong>{entry.value}</strong>
                      <span>{entry.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className={styles.firstDraftActionPanel}>
              <div className={styles.actionExplanation}>
                <span className={styles.actionInfoIcon} aria-hidden="true">
                  i
                </span>
                <p>
                  <strong>Save draft:</strong> Keeps the working revision private and editable.
                  <br />
                  <strong>Confirm:</strong> Submits this draft for the VFX Supervisor decision
                  and makes Revision 1 the active shared intent.
                </p>
              </div>

              {(hasUnsavedChanges || requestInFlight) && (
                <p className={styles.blockingReason} role="status">
                  {requestInFlight
                    ? "Another request is in progress -- please wait."
                    : "Save the draft before confirming -- Confirm resolves the saved draft, not unsaved edits."}
                </p>
              )}

              <div className={styles.firstDraftActions}>
                <button
                  type="button"
                  className={styles.rejectButton}
                  onClick={() => openDialog("reject")}
                  disabled={rejectDisabled}
                >
                  Discard draft
                </button>
                <button
                  type="button"
                  className={styles.saveButton}
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? "Saving…" : "Save draft"}
                </button>
                <button
                  type="button"
                  className={styles.confirmPrimaryButton}
                  onClick={() => openDialog("confirm")}
                  disabled={confirmDisabled}
                >
                  Confirm first Core Anchor
                  <span aria-hidden="true">→</span>
                </button>
              </div>

              {saveState === "error" && saveError && (
                <span className={styles.saveErrorNotice} role="alert">
                  {saveError}
                </span>
              )}
            </div>
          </section>
        </div>
      ) : (
        <div className={styles.comparisonGrid}>
          <div className={styles.gridHeaderLeft}>
            Current: Revision {confirmedRevision.revision_number} · Confirmed
          </div>
          <div className={styles.gridHeaderSpacer} aria-hidden="true" />
          <div className={styles.gridHeaderRight}>
            <span>Proposed: Revision {draftRevision.revision_number} · Draft in progress</span>
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
            // `form.scalars[field]` normalizes a null scalar to "" (see
            // `toFormState`), so the confirmed side must be normalized
            // the same way here -- otherwise every scalar field that is
            // genuinely null on both sides would falsely flag as
            // "Changed" (null !== ""), violating no-meaningful-change
            // protection.
            const changed = showChanges && (confirmedRevision[field] ?? "") !== form.scalars[field];
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
        </div>
      )}

      {!isFirstDraft && (
        <>
          {changeSummary.length > 0 && (
            <p className={styles.changeSummary}>Change summary: {changeSummary.join(", ")}</p>
          )}

          <div className={styles.decisionBlock}>
            <div className={styles.rationaleHeader}>
              <label className={styles.rationaleLabel} htmlFor="core-anchor-rationale">
                Decision rationale · Optional
              </label>
              <span className={styles.rationaleHint}>
                Included in the recorded Decision when provided.
              </span>
            </div>
            <textarea
              id="core-anchor-rationale"
              className={styles.rationaleInput}
              value={rationale}
              onChange={(event) => setRationale(event.target.value)}
              rows={3}
            />
            {(hasUnsavedChanges || requestInFlight) && (
              <p className={styles.blockingReason} role="status">
                {requestInFlight
                  ? "Another request is in progress -- please wait."
                  : "Save the draft before confirming -- Confirm resolves the saved draft, not unsaved edits."}
              </p>
            )}
            <div className={styles.decisionActions}>
              <button
                type="button"
                className={styles.rejectButton}
                onClick={() => openDialog("reject")}
                disabled={rejectDisabled}
              >
                Discard draft
              </button>
              <button type="button" className={styles.saveButton} onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Saving…" : "Save draft"}
              </button>
              <button
                type="button"
                className={styles.confirmButton}
                onClick={() => openDialog("confirm")}
                disabled={confirmDisabled}
              >
                Confirm revision
              </button>
            </div>
            {saveState === "saved" && <span className={styles.savedNotice}>Changes saved.</span>}
            {saveState === "error" && saveError && (
              <span className={styles.saveErrorNotice} role="alert">
                {saveError}
              </span>
            )}
          </div>
        </>
      )}

      <ConfirmationDialog
        open={dialogMode !== null}
        title={
          dialogMode === "confirm"
            ? isFirstDraft
              ? "Confirm the first Core Anchor?"
              : "Confirm this Core Anchor revision?"
            : isFirstDraft
              ? "Discard this Core Anchor draft?"
              : "Discard this Core Anchor draft revision?"
        }
        description={
          dialogMode === "confirm"
            ? isFirstDraft
              ? `You are confirming Revision 1 as the first active Core Anchor for ${shotName}. This records the Human VFX Supervisor decision and makes the revision the shared creative intent that downstream work should align to.`
              : `You are confirming revision #${draftRevision.revision_number} as the shared creative intent for ${shotName}. Only a Human VFX Supervisor may confirm a Core Anchor -- once confirmed, downstream CG, Artist, and review work will align to it.`
            : isFirstDraft
              ? `You are discarding the working Revision 1 draft for ${shotName}. It will no longer be available for confirmation, and the Shot will return to having no Core Anchor draft.`
              : `You are discarding proposed revision #${draftRevision.revision_number} for ${shotName}. It will no longer be available for confirmation, and Revision ${confirmedRevision.revision_number} will remain the active Core Anchor.`
        }
        rationale={rationale || null}
        confirmLabel={
          dialogMode === "confirm"
            ? isFirstDraft
              ? "Confirm first Core Anchor"
              : "Confirm revision"
            : "Discard draft"
        }
        pendingLabel={dialogMode === "confirm" ? "Confirming…" : "Discarding…"}
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
