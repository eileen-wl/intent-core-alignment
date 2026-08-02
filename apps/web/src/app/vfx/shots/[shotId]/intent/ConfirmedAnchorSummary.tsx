"use client";

import type { CoreAnchorRevisionRead } from "@intent-core/contracts";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { EvidenceLayerSection, HumanDecisionNotice } from "@/design";
import {
  computeChangeSummary,
  summarizeEstablishedContent,
} from "@/features/vfx/intent-workspace/changeSummary";
import type { IntentEvidenceData } from "@/features/vfx/intent-workspace/data";
import { humanRoleLabel } from "@/lib/humanRoleLabel";
import styles from "./ConfirmedAnchorSummary.module.css";

const ALWAYS_VISIBLE_FIELDS: {
  field: keyof CoreAnchorRevisionRead;
  label: string;
}[] = [
  { field: "core_summary", label: "Core summary" },
  { field: "shot_objective", label: "Shot objective" },
  { field: "emotional_tone", label: "Emotional tone" },
  { field: "visual_focus", label: "Visual focus" },
];

const EXPANDABLE_SCALAR_FIELDS: {
  field: keyof CoreAnchorRevisionRead;
  label: string;
}[] = [
  { field: "rhythm_intensity", label: "Rhythm and intensity" },
  { field: "character_relationship", label: "Character relationship" },
  { field: "narrative_priority", label: "Narrative priority" },
];

const COLLECTIONS: {
  field: "constraints" | "variation_zones" | "drift_risks" | "open_questions";
  label: string;
  text: (item: never) => string;
}[] = [
  {
    field: "constraints",
    label: "Constraints",
    text: (item: { content: string }) => item.content,
  },
  {
    field: "variation_zones",
    label: "Variation zones",
    text: (item: { content: string }) => item.content,
  },
  {
    field: "drift_risks",
    label: "Drift risks",
    text: (item: { description: string }) => item.description,
  },
  {
    field: "open_questions",
    label: "Open questions",
    text: (item: { question: string }) => item.question,
  },
];

/** NORMAL CONFIRMED and JUST-CONFIRMED SUCCESS (Step 7C-3 content/state
 * pass, building on Step 7C-2's visual finalization §6/§8) -- the only
 * two states with a confirmed revision and no in-progress draft,
 * distinguished solely by the transient `justConfirmed` signal
 * (`page.tsx` has already validated the `?justConfirmed=` search param
 * names this exact revision). Both states share the same authoritative
 * main card ("Core Anchor confirmed") and the same Decision-and-
 * provenance card; only the top banner and one extra supporting card
 * differ. Just-confirmed Success adds the banner plus a real summary
 * card ahead of "Decision recorded": a genuine first-ever confirmation
 * (`previousConfirmedRevision === null`) gets an honest "What was
 * established" summary of `revision`'s own real content
 * (`summarizeEstablishedContent`) -- never "What changed in Revision 1",
 * since there was nothing to change from; a later confirmation instead
 * gets "What changed from Revision N-1" computed from the real
 * superseded revision (`computeChangeSummary`). Neither is ever
 * fabricated, and neither is the reference mockup's hard-coded text. */
export function ConfirmedAnchorSummary({
  revision,
  previousConfirmedRevision = null,
  justConfirmed = false,
  evidenceData = null,
  decisionRationale = null,
}: {
  revision: CoreAnchorRevisionRead;
  previousConfirmedRevision?: CoreAnchorRevisionRead | null;
  justConfirmed?: boolean;
  /** For the Decision-and-provenance card's honest "available evidence"
   * line -- `null` when not yet loaded or genuinely unavailable. */
  evidenceData?: IntentEvidenceData | null;
  /** The real recorded rationale from the Decision that confirmed
   * `revision`, or `null` when none was provided -- the card says so
   * honestly rather than omitting the line. */
  decisionRationale?: string | null;
}) {
  const pathname = usePathname();
  const [showAllDetails, setShowAllDetails] = useState(false);

  // The transient success signal is consumed here: once this has
  // rendered with `justConfirmed`, the `?justConfirmed=` param is
  // stripped from the visible URL so a plain browser refresh (or
  // reopening the now-clean URL) re-requests the bare Intent URL and
  // lands on the ordinary Normal Confirmed state, never repeating the
  // success presentation. This deliberately uses the browser History
  // API (`replaceState`), never a Next.js router navigation
  // (`router.replace`/`router.push`): a router navigation triggers a
  // fresh RSC fetch of this same route, which re-validates
  // `?justConfirmed=` against the (now-stripped) URL and would
  // immediately re-render this component with `justConfirmed=false` --
  // making the success view disappear almost instantly instead of
  // staying visible for this render. `history.replaceState` only
  // updates the visible URL and browser history entry; it never
  // triggers a Next.js navigation, data refetch, or re-render, and it
  // never persists anything to the database -- `justConfirmed` was
  // always a URL-only signal, already validated server-side in
  // `page.tsx` before this component ever saw it.
  useEffect(() => {
    if (justConfirmed) {
      window.history.replaceState(null, "", pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally runs once per justConfirmed=true mount, not on every pathname identity change
  }, [justConfirmed]);

  // Two real, non-overlapping content branches for the transient success
  // card -- a genuine first-ever confirmation has nothing to have
  // "changed" from, so it gets an honest "What was established" summary
  // instead of a fabricated "What changed in Revision 1".
  const isFirstConfirmation = previousConfirmedRevision === null;
  const changeSummary =
    justConfirmed && !isFirstConfirmation
      ? computeChangeSummary(previousConfirmedRevision, revision)
      : [];
  const establishedContent =
    justConfirmed && isFirstConfirmation
      ? summarizeEstablishedContent(revision)
      : [];

  const hasExpandableContent =
    EXPANDABLE_SCALAR_FIELDS.some(({ field }) => revision[field]) ||
    COLLECTIONS.some(
      ({ field }) => (revision[field] as unknown[]).length > 0,
    ) ||
    revision.references.length > 0;

  const evidenceCount = evidenceData?.evidence.length ?? 0;
  const nextStepStatement = justConfirmed
    ? `Revision ${revision.revision_number} is now the active Core Anchor. Downstream work should align to this revision.`
    : "Downstream work should align to this revision.";

  return (
    <div className={styles.wrapper}>
      {justConfirmed && (
        <p className={styles.successBanner} role="status">
          Revision {revision.revision_number} confirmed successfully
        </p>
      )}

      <div className={styles.grid}>
        <EvidenceLayerSection
          kind="production-evidence"
          className={styles.mainCard}
          headingLevel={3}
        >
          <div className={styles.headerRow}>
            <div>
              <span className={styles.confirmedPill}>Confirmed</span>
              <h2 className={styles.mainHeading}>Core Anchor confirmed</h2>
            </div>
            <div className={styles.identityBadges}>
              <span className={styles.revisionBadge}>
                Revision {revision.revision_number}
              </span>
              <span className={styles.activeBadge}>Active</span>
            </div>
          </div>

          <dl className={styles.fields}>
            {ALWAYS_VISIBLE_FIELDS.filter(({ field }) => revision[field]).map(
              ({ field, label }) => (
                <div key={field} className={styles.field}>
                  <dt className={styles.fieldLabel}>{label}</dt>
                  <dd className={styles.fieldValue}>
                    {revision[field] as string}
                  </dd>
                </div>
              ),
            )}
          </dl>

          {hasExpandableContent && (
            <>
              <button
                type="button"
                className={styles.expandToggle}
                aria-expanded={showAllDetails}
                onClick={() => setShowAllDetails((previous) => !previous)}
              >
                {showAllDetails
                  ? "Hide intent details"
                  : "Show all intent details"}
                <span
                  className={styles.chevron}
                  data-open={showAllDetails}
                  aria-hidden="true"
                />
              </button>

              {showAllDetails && (
                <div className={styles.expandedContent}>
                  <dl className={styles.fields}>
                    {EXPANDABLE_SCALAR_FIELDS.filter(
                      ({ field }) => revision[field],
                    ).map(({ field, label }) => (
                      <div key={field} className={styles.field}>
                        <dt className={styles.fieldLabel}>{label}</dt>
                        <dd className={styles.fieldValue}>
                          {revision[field] as string}
                        </dd>
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
                            {reference.note && (
                              <span className={styles.referenceNote}>
                                {" "}
                                ({reference.note})
                              </span>
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
                Confirmed by{" "}
                <strong>
                  {humanRoleLabel(revision.confirmed_by_human_role)}
                </strong>
              </span>
              <span>
                Confirmed at {new Date(revision.confirmed_at).toLocaleString()}
              </span>
            </p>
          )}
        </EvidenceLayerSection>

        <div className={styles.supportingColumn}>
          {justConfirmed &&
            isFirstConfirmation &&
            establishedContent.length > 0 && (
              <div className={styles.supportingCard}>
                <h3 className={styles.supportingHeading}>
                  What was established
                </h3>
                <ul className={styles.changeList}>
                  {establishedContent.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

          {justConfirmed &&
            previousConfirmedRevision !== null &&
            changeSummary.length > 0 && (
              <div className={styles.supportingCard}>
                <h3 className={styles.supportingHeading}>
                  What changed from Revision{" "}
                  {previousConfirmedRevision.revision_number}
                </h3>
                <ul className={styles.changeList}>
                  {changeSummary.map((change) => (
                    <li key={change}>{change}</li>
                  ))}
                </ul>
              </div>
            )}

          {revision.confirmed_by_human_role && revision.confirmed_at && (
            <EvidenceLayerSection
              kind="human-decision"
              className={styles.supportingCard}
              headingLevel={3}
            >
              <h3 className={styles.supportingHeading}>Decision recorded</h3>
              <HumanDecisionNotice
                objectLabel={`Core Anchor revision ${revision.revision_number}`}
                confirmingRole={revision.confirmed_by_human_role}
                confirmedAt={new Date(revision.confirmed_at).toLocaleString()}
                rationale={decisionRationale || "No rationale was provided."}
              />
              {revision.supersedes_revision_id && previousConfirmedRevision && (
                <p className={styles.supportingText}>
                  Supersedes Revision{" "}
                  {previousConfirmedRevision.revision_number}
                </p>
              )}
              {evidenceData !== null &&
                (evidenceCount === 0 ? (
                  <p className={styles.supportingText}>
                    No evidence references were recorded for this Decision.
                  </p>
                ) : (
                  <p className={styles.supportingText}>
                    {evidenceCount} evidence{" "}
                    {evidenceCount === 1 ? "source" : "sources"} -- see Evidence
                    and provenance below.
                  </p>
                ))}
              <p className={styles.supportingText}>{nextStepStatement}</p>
            </EvidenceLayerSection>
          )}
        </div>
      </div>
    </div>
  );
}
