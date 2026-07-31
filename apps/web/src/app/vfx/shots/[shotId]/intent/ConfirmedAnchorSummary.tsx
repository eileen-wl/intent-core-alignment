"use client";

import type { CoreAnchorRevisionRead } from "@intent-core/contracts";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { HumanDecisionNotice } from "@/design";
import { computeChangeSummary } from "@/features/vfx/intent-workspace/changeSummary";
import styles from "./ConfirmedAnchorSummary.module.css";

const ALWAYS_VISIBLE_FIELDS: { field: keyof CoreAnchorRevisionRead; label: string }[] = [
  { field: "core_summary", label: "Core summary" },
  { field: "shot_objective", label: "Shot objective" },
  { field: "emotional_tone", label: "Emotional tone" },
  { field: "visual_focus", label: "Visual focus" },
];

const EXPANDABLE_SCALAR_FIELDS: { field: keyof CoreAnchorRevisionRead; label: string }[] = [
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

/** NORMAL CONFIRMED and JUST-CONFIRMED SUCCESS (Step 7C-2 visual
 * finalization §6/§8) -- the only two states with a confirmed revision
 * and no in-progress draft, distinguished solely by the transient
 * `justConfirmed` signal (`page.tsx` has already validated the
 * `?justConfirmed=` search param names this exact revision). Both
 * states share the same authoritative main card ("Core Anchor
 * confirmed"); only the top banner and the supporting column's content
 * differ -- Normal Confirmed pairs "Decision recorded" with a static
 * "Shared intent is active" explainer, Just-confirmed Success instead
 * pairs a real "What changed" summary with "Decision recorded", and
 * adds the transient banner. The change summary shown in the latter
 * case is computed from `previousConfirmedRevision` -- the real
 * superseded revision (or `null` for a genuine first-ever confirmation)
 * -- never fabricated, and never the reference mockup's hard-coded
 * change text. */
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
  const [showAllDetails, setShowAllDetails] = useState(false);

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

  const hasExpandableContent =
    EXPANDABLE_SCALAR_FIELDS.some(({ field }) => revision[field]) ||
    COLLECTIONS.some(({ field }) => (revision[field] as unknown[]).length > 0) ||
    revision.references.length > 0;

  return (
    <div className={styles.wrapper}>
      {justConfirmed && (
        <p className={styles.successBanner} role="status">
          Revision {revision.revision_number} confirmed successfully
        </p>
      )}

      <div className={styles.grid}>
        <div className={styles.mainCard}>
          <span className={styles.confirmedPill}>Confirmed</span>
          <h2 className={styles.mainHeading}>Core Anchor confirmed</h2>
          <p className={styles.mainIntro}>
            Revision {revision.revision_number} is the current confirmed Core Anchor.
          </p>

          <dl className={styles.fields}>
            {ALWAYS_VISIBLE_FIELDS.filter(({ field }) => revision[field]).map(({ field, label }) => (
              <div key={field} className={styles.field}>
                <dt className={styles.fieldLabel}>{label}</dt>
                <dd className={styles.fieldValue}>{revision[field] as string}</dd>
              </div>
            ))}
          </dl>

          {hasExpandableContent && (
            <>
              <button
                type="button"
                className={styles.expandToggle}
                aria-expanded={showAllDetails}
                onClick={() => setShowAllDetails((previous) => !previous)}
              >
                {showAllDetails ? "Hide intent details" : "Show all intent details"}
                <span className={styles.chevron} data-open={showAllDetails} aria-hidden="true" />
              </button>

              {showAllDetails && (
                <div className={styles.expandedContent}>
                  <dl className={styles.fields}>
                    {EXPANDABLE_SCALAR_FIELDS.filter(({ field }) => revision[field]).map(
                      ({ field, label }) => (
                        <div key={field} className={styles.field}>
                          <dt className={styles.fieldLabel}>{label}</dt>
                          <dd className={styles.fieldValue}>{revision[field] as string}</dd>
                        </div>
                      ),
                    )}
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
                            {reference.note && (
                              <span className={styles.referenceNote}> ({reference.note})</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {revision.confirmed_by_human_role && revision.confirmed_at && (
            <p className={styles.confirmedFooter}>
              <span>
                Confirmed by <strong>{revision.confirmed_by_human_role}</strong>
              </span>
              <span>Confirmed at {new Date(revision.confirmed_at).toLocaleString()}</span>
            </p>
          )}
        </div>

        <div className={styles.supportingColumn}>
          {justConfirmed && changeSummary.length > 0 && (
            <div className={styles.supportingCard}>
              <h3 className={styles.supportingHeading}>
                What changed in Revision {revision.revision_number}
              </h3>
              <ul className={styles.changeList}>
                {changeSummary.map((change) => (
                  <li key={change}>{change}</li>
                ))}
              </ul>
            </div>
          )}

          {revision.confirmed_by_human_role && revision.confirmed_at && (
            <div className={styles.supportingCard}>
              <h3 className={styles.supportingHeading}>Decision recorded</h3>
              <HumanDecisionNotice
                objectLabel={`Core Anchor revision ${revision.revision_number}`}
                confirmingRole={revision.confirmed_by_human_role}
                confirmedAt={new Date(revision.confirmed_at).toLocaleString()}
              />
            </div>
          )}

          {!justConfirmed && (
            <div className={styles.supportingCard}>
              <h3 className={styles.supportingHeading}>Shared intent is active</h3>
              <p className={styles.supportingText}>
                Downstream CG interpretation, execution constraints, Artist guidance, and Version and
                Alignment review should align to this confirmed revision until a newer one is
                confirmed.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
