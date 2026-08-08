import type {
  CoreAnchorRevisionRead,
  CrossRoleAssessmentRead,
} from "@intent-core/contracts";

import { AuthorityLabel } from "@/design";
import type { IntentActionResult } from "@/features/vfx/intent-workspace/actions";
import { StartDraftButton } from "./StartDraftButton";
import styles from "./ReanchorProposalReview.module.css";

/** The dedicated J1 -> J2 human-review section (Package C owner
 * re-validation correction). Rendered only when `data.
 * currentReanchorProposalAssessment` is non-null (see `intent-
 * workspace/data.ts`) -- the Shot's current Cross-role Assessment
 * carries a current Re-anchor Proposal against the currently confirmed
 * Core Anchor revision, at high attention.
 *
 * Read-only except for its one explicit primary action: opening this
 * page (or arriving here from "Review proposal" on Alignment) never
 * creates anything -- only clicking "Create Core Anchor R{n+1} draft
 * from proposal" does, and that button calls the exact same
 * `createCoreAnchorDraftFromConfirmedAction` server action the plain
 * "Create new revision" control already used on this same Normal
 * Confirmed state. This section *replaces* that plain control rather
 * than sitting alongside it (see `IntentWorkspacePage`), so there is
 * still exactly one way to start a new Core Anchor revision from here,
 * never two competing ones. */
export function ReanchorProposalReview({
  confirmedRevision,
  assessment,
  action,
}: {
  confirmedRevision: CoreAnchorRevisionRead;
  assessment: CrossRoleAssessmentRead;
  action: () => Promise<IntentActionResult>;
}) {
  const proposal = assessment.re_anchor_proposal;
  if (proposal === null) {
    return null;
  }

  const output = assessment.assessment_output;
  const combinedConflictFindings = [
    ...output.cross_role_tensions,
    ...output.local_optimum_risks,
  ];
  const nextRevisionNumber = confirmedRevision.revision_number + 1;

  return (
    <section
      className={styles.section}
      aria-labelledby="reanchor-proposal-heading"
    >
      <div className={styles.headerRow}>
        <AuthorityLabel variant="human-review-required" />
        <span className={styles.attentionBadge}>High attention</span>
      </div>
      <h2 id="reanchor-proposal-heading" className={styles.heading}>
        Re-anchor Proposal — Human Review
      </h2>
      <p className={styles.meta}>
        From the current Cross-role Assessment, generated{" "}
        {new Date(assessment.created_at).toLocaleString()}.
      </p>
      <p className={styles.summary}>{output.executive_summary}</p>

      {combinedConflictFindings.length > 0 && (
        <div className={styles.findingsBlock}>
          <h3 className={styles.subheading}>Combined conflict</h3>
          <ul className={styles.findingList}>
            {combinedConflictFindings.map((finding, index) => (
              <li key={index} className={styles.finding}>
                <p className={styles.findingSummary}>{finding.summary}</p>
                <p className={styles.findingWhy}>{finding.why_it_matters}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={styles.proposalCard}>
        <AuthorityLabel variant="ai-proposal" />
        <p className={styles.proposalReason}>
          {proposal.proposal_output.reason_for_consideration}
        </p>
        {proposal.proposal_output.proposed_fields.map((field, index) => (
          <div key={index} className={styles.proposedField}>
            <p className={styles.proposedFieldLabel}>
              Proposed change — {field.field.replace(/_/g, " ")}
            </p>
            <p className={styles.proposedFieldDirection}>
              {field.proposed_direction}
            </p>
            <p className={styles.proposedFieldWhy}>{field.why_it_may_help}</p>
          </div>
        ))}
      </div>

      <p className={styles.advisoryNotice} role="status">
        This Proposal is advisory only. Core Anchor R
        {confirmedRevision.revision_number} remains authoritative until a Human
        VFX Supervisor confirms a new revision.
      </p>

      <StartDraftButton
        label={`Create Core Anchor R${nextRevisionNumber} draft from proposal`}
        pendingLabel="Starting…"
        action={action}
        variant="primary"
      />
    </section>
  );
}
