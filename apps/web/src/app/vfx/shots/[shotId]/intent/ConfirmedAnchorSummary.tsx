"use client";

import type { CoreAnchorRevisionRead } from "@intent-core/contracts";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { HumanDecisionNotice, Panel } from "@/design";
import { computeChangeSummary } from "@/features/vfx/intent-workspace/changeSummary";
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
 * revision exists and no draft is currently in progress: this covers
 * both Normal Confirmed (the default -- `justConfirmed` false/absent)
 * and, transiently, Just-confirmed Success (Step 7C-2; `justConfirmed`
 * true only when `page.tsx` has validated the `?justConfirmed=` search
 * param against this exact revision). The change summary shown in the
 * latter case is computed from `previousConfirmedRevision` -- the real
 * superseded revision (or `null` for a genuine first-ever
 * confirmation) -- never fabricated. */
export function ConfirmedAnchorSummary({
  revision,
  previousConfirmedRevision = null,
  justConfirmed = false,
}: {
  revision: CoreAnchorRevisionRead;
  previousConfirmedRevision?: CoreAnchorRevisionRead | null;
  justConfirmed?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();

  // The transient success signal is consumed here: once this has
  // rendered with `justConfirmed`, the `?justConfirmed=` param is
  // stripped from the visible URL (no new history entry) so a plain
  // browser refresh re-requests the bare Intent URL and lands on the
  // ordinary Normal Confirmed state, never repeating the success
  // presentation.
  useEffect(() => {
    if (justConfirmed) {
      router.replace(pathname, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally runs once per justConfirmed=true mount, not on every pathname/router identity change
  }, [justConfirmed]);

  const changeSummary = justConfirmed
    ? computeChangeSummary(previousConfirmedRevision, revision)
    : [];

  return (
    <Panel tone="panel" className={styles.panel}>
      {justConfirmed && (
        <p className={styles.confirmedStatus} role="status">
          Revision {revision.revision_number} was confirmed.
          {changeSummary.length > 0 && ` Change summary: ${changeSummary.join(", ")}`}
        </p>
      )}

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
