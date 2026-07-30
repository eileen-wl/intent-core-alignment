import type { CoreAnchorRevisionRead } from "@intent-core/contracts";

import { HumanDecisionNotice, Panel } from "@/design";
import styles from "./ConfirmedAnchorSummary.module.css";

const SCALAR_FIELDS: { field: keyof CoreAnchorRevisionRead; label: string }[] = [
  { field: "core_summary", label: "Core summary" },
  { field: "shot_objective", label: "Shot objective" },
  { field: "emotional_tone", label: "Emotional tone" },
  { field: "visual_focus", label: "Visual focus" },
  { field: "rhythm_intensity", label: "Rhythm and intensity" },
  { field: "character_relationship", label: "Character relationship" },
  { field: "narrative_priority", label: "Narrative priority" },
];

const COLLECTIONS: { field: "constraints" | "variation_zones" | "drift_risks" | "open_questions"; label: string; text: (item: never) => string }[] = [
  { field: "constraints", label: "Constraints", text: (item: { content: string }) => item.content },
  { field: "variation_zones", label: "Variation zones", text: (item: { content: string }) => item.content },
  { field: "drift_risks", label: "Drift risks", text: (item: { description: string }) => item.description },
  { field: "open_questions", label: "Open questions", text: (item: { question: string }) => item.question },
];

/** Full confirmed Core Anchor content -- every field, unlike the Shot
 * Overview's one-line `core_summary`-only supporting context
 * (docs/step-7/14_STEP_7C0B_...md §4.4/§11). Shown when a confirmed
 * revision exists and no draft is currently in progress. */
export function ConfirmedAnchorSummary({ revision }: { revision: CoreAnchorRevisionRead }) {
  return (
    <Panel tone="panel" className={styles.panel}>
      <dl className={styles.fields}>
        {SCALAR_FIELDS.filter(({ field }) => revision[field]).map(({ field, label }) => (
          <div key={field} className={styles.field}>
            <dt className={styles.fieldLabel}>{label}</dt>
            <dd className={styles.fieldValue}>{revision[field] as string}</dd>
          </div>
        ))}
      </dl>

      {COLLECTIONS.map(({ field, label, text }) => {
        const items = revision[field] as unknown[];
        if (items.length === 0) return null;
        return (
          <div key={field} className={styles.collection}>
            <h3 className={styles.collectionLabel}>{label}</h3>
            <ul className={styles.collectionList}>
              {items.map((item, index) => (
                // eslint-disable-next-line react/no-array-index-key -- semantic-collection rows have no stable client key beyond position here
                <li key={index}>{text(item as never)}</li>
              ))}
            </ul>
          </div>
        );
      })}

      {revision.references.length > 0 && (
        <div className={styles.collection}>
          <h3 className={styles.collectionLabel}>References</h3>
          <ul className={styles.collectionList}>
            {revision.references.map((reference) => (
              <li key={reference.id}>
                {reference.label}
                {reference.uri && <> — {reference.uri}</>}
                {reference.note && <span className={styles.referenceNote}> ({reference.note})</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {revision.confirmed_by_human_role && revision.confirmed_at && (
        <div className={styles.confirmation}>
          <HumanDecisionNotice
            objectLabel={`Core Anchor revision ${revision.revision_number}`}
            confirmingRole={revision.confirmed_by_human_role}
            confirmedAt={new Date(revision.confirmed_at).toLocaleString()}
          />
        </div>
      )}
    </Panel>
  );
}
