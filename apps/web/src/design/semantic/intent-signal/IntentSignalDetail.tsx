import type { HumanRole, IntentSignalRead } from "@intent-core/contracts";
import type { ReactNode } from "react";

import { AuthorityLabel } from "../../components/AuthorityLabel";
import { MetadataRow } from "../../components/MetadataRow";
import {
  intentSignalDriverCodeLabel,
  intentSignalRoleWording,
} from "./intentSignalModel";
import styles from "./IntentSignalDetail.module.css";

const ALL_ROLES = ["vfx_supervisor", "cg_supervisor", "artist"] as const;

/** Level 6 -- full detail view. Takes a resolved `IntentSignalRead`
 * directly (the caller decides at a higher level whether to render
 * this or an empty/failure state, matching the 7B-1 EmptyState/
 * ErrorState convention rather than re-deriving that branching here).
 * Grouped in the order the reader needs it: conclusion, attention
 * level facts, role coverage, drivers, caveats, then an optional
 * provenance link. `variant="historical"` marks a superseded result
 * using the existing `AuthorityLabel` "historical" vocabulary plus a
 * muted left accent -- current and historical results are never
 * visually merged, and historical stays legible rather than dimmed
 * into illegibility. */
export function IntentSignalDetail({
  signal,
  role,
  variant = "latest",
  provenance,
}: {
  signal: IntentSignalRead;
  role?: HumanRole;
  variant?: "latest" | "historical";
  /** Optional composition slot for a provenance reference (e.g. an
   * `EvidenceProvenanceDrawer`) -- this component has no AgentRun/
   * ContextSnapshot fields of its own (those belong to the parent
   * CrossRoleAssessment), so the caller supplies the rendered link. */
  provenance?: ReactNode;
}) {
  const { signal_output: output } = signal;
  const covered = ALL_ROLES.filter((r) => output.role_coverage[r]);
  const notCovered = ALL_ROLES.filter((r) => !output.role_coverage[r]);
  const isHistorical = variant === "historical";
  const isAttention = signal.attention_level !== "low";

  return (
    <div
      className={
        isHistorical
          ? `${styles.detail} ${styles.detailHistorical}`
          : isAttention
            ? `${styles.detail} ${styles.detailAttention}`
            : styles.detail
      }
    >
      <div className={styles.header}>
        <AuthorityLabel variant="intent-signal" />
        {isHistorical && <AuthorityLabel variant="historical" />}
      </div>

      {role && (
        <p className={styles.wording}>
          {intentSignalRoleWording(role, signal.attention_level)}
        </p>
      )}
      <p className={styles.summary}>{output.summary}</p>

      <MetadataRow
        items={[
          { label: "Attention level", value: signal.attention_level },
          { label: "Created", value: signal.created_at },
          {
            label: "Re-anchor Proposal",
            value: output.re_anchor_proposal_present
              ? "Present"
              : "Not present",
          },
        ]}
      />

      <section>
        <h4 className={styles.sectionTitle}>Role coverage</h4>
        <p className={styles.roleCoverage}>
          Covered: {covered.length > 0 ? covered.join(", ") : "none"}
          {notCovered.length > 0 && (
            <> · Not covered: {notCovered.join(", ")}</>
          )}
        </p>
      </section>

      <section>
        <h4 className={styles.sectionTitle}>Drivers</h4>
        {output.drivers.length === 0 ? (
          <p className={styles.empty}>No drivers recorded.</p>
        ) : (
          <ul className={styles.driverList}>
            {output.drivers.map((driver, index) => (
              <li key={index} className={styles.driver}>
                <div className={styles.driverHead}>
                  <span className={styles.driverCode}>
                    {intentSignalDriverCodeLabel(driver.code)}
                  </span>
                  <span
                    className={
                      driver.priority === "high"
                        ? `${styles.driverPriority} ${styles.driverPriorityHigh}`
                        : styles.driverPriority
                    }
                  >
                    {driver.priority}
                  </span>
                </div>
                <p className={styles.driverSummary}>{driver.summary}</p>
                <p className={styles.driverSource}>
                  via {driver.assessment_section}[{driver.assessment_item_index}
                  ]
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {output.caveats.length > 0 && (
        <section>
          <h4 className={styles.sectionTitle}>Caveats</h4>
          <ul className={styles.caveatList}>
            {output.caveats.map((caveat, index) => (
              <li key={index}>{caveat}</li>
            ))}
          </ul>
        </section>
      )}

      {provenance && (
        <section>
          <h4 className={styles.sectionTitle}>Provenance</h4>
          {provenance}
        </section>
      )}
    </div>
  );
}
