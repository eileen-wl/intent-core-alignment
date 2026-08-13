import Link from "next/link";
import type {
  CrossRoleAssessmentRead,
  VersionRead,
  VfxInboxItemRead,
} from "@intent-core/contracts";

import { AuthorityBoundary, AuthorityLabel, Icon } from "@/design";
import { GenerateAssessmentButton } from "./GenerateAssessmentButton";
import styles from "./HumanAttentionAction.module.css";

type ReAnchorProposal = NonNullable<
  CrossRoleAssessmentRead["re_anchor_proposal"]
>;

export type HumanAttentionState =
  | { kind: "not_ready" }
  | { kind: "generate_first"; taskId: string; versionId: string }
  | {
      kind: "reassessment_priority";
      taskId: string;
      versionId: string;
      supersededProposal: ReAnchorProposal | null;
    }
  | {
      kind: "review_proposal";
      current: CrossRoleAssessmentRead;
      proposal: ReAnchorProposal;
    }
  | {
      kind: "interpret_only";
      current: CrossRoleAssessmentRead;
      lowAttention: boolean;
    };

/** Locked Human Attention / Human Action state rules (VFX Alignment
 * structural pass, owner-approved). A newer eligible Version being
 * ready for reassessment always takes priority as the primary action,
 * regardless of whether the current assessment also has a Re-anchor
 * Proposal -- the owner's explicit priority decision. Never invents a
 * persisted action: every branch maps to a real, already-existing
 * control (`GenerateAssessmentButton`, the real "Review proposal"
 * route, or a real honest read-only state). */
export function deriveHumanAttentionState(
  item: VfxInboxItemRead,
  current: CrossRoleAssessmentRead | null,
): HumanAttentionState {
  const readyTaskId = item.generation_ready_task_id;
  const readyVersionId = item.generation_ready_version_id;
  const regenerationReady = Boolean(readyTaskId && readyVersionId);

  if (current === null) {
    if (regenerationReady && readyTaskId && readyVersionId) {
      return {
        kind: "generate_first",
        taskId: readyTaskId,
        versionId: readyVersionId,
      };
    }
    return { kind: "not_ready" };
  }

  if (regenerationReady && readyTaskId && readyVersionId) {
    return {
      kind: "reassessment_priority",
      taskId: readyTaskId,
      versionId: readyVersionId,
      supersededProposal: current.re_anchor_proposal,
    };
  }

  if (current.re_anchor_proposal) {
    return {
      kind: "review_proposal",
      current,
      proposal: current.re_anchor_proposal,
    };
  }

  return {
    kind: "interpret_only",
    current,
    lowAttention: current.intent_signal.attention_level === "low",
  };
}

function versionLabel(version: VersionRead | undefined): string {
  if (!version) return "Unknown Production Version";
  return version.version_number
    ? `${version.name} (v${version.version_number})`
    : version.name;
}

/** No Human Decision object is ever attached directly to a
 * CrossRoleAssessment -- a Re-anchor Proposal, if accepted, is
 * confirmed/rejected as a new Core Anchor revision on Intent, never
 * here. This honest statement previously lived in its own standalone
 * "Human Decision and Provenance" section; folded in here (its meaning
 * fully preserved, per the approved brief) since it is standing context
 * for every state in which a current assessment exists. */
function NoDirectDecisionNote({ shotId }: { shotId: string }) {
  return (
    <p className={styles.decisionNote}>
      No Human Decision has been recorded directly against this assessment. A
      Re-anchor Proposal, if accepted, is confirmed or rejected as a new Core
      Anchor revision on the{" "}
      <Link href={`/vfx/shots/${shotId}/intent`}>Intent page</Link>.
    </p>
  );
}

function NotReadyBody({
  shotId,
  item,
}: {
  shotId: string;
  item: VfxInboxItemRead;
}) {
  return (
    <>
      <p className={styles.message}>Cross-role Assessment is not ready yet</p>
      <p className={styles.detail}>
        Prerequisites:{" "}
        {item.core_anchor_state === "confirmed"
          ? "✓ Confirmed Core Anchor"
          : "✕ Confirmed Core Anchor missing"}
        ;{" "}
        {item.relevant_version_id
          ? "✓ Production Version recorded"
          : "✕ No qualifying Production Version"}
        . {item.current_focus.explanation}
      </p>
      {item.current_focus.target_route !== `/vfx/shots/${shotId}` ? (
        <Link href={item.current_focus.target_route}>
          {item.current_focus.primary_action_label ?? "Open next step"} →
        </Link>
      ) : item.relevant_version_id ? (
        <Link href={`/vfx/shots/${shotId}/versions`}>
          Review production evidence →
        </Link>
      ) : (
        <Link href={`/vfx/shots/${shotId}/versions`}>Open Versions →</Link>
      )}
    </>
  );
}

function GenerateFirstBody({
  shotId,
  taskId,
  versionId,
  versionsById,
}: {
  shotId: string;
  taskId: string;
  versionId: string;
  versionsById: Map<string, VersionRead>;
}) {
  return (
    <>
      <p className={styles.message}>
        A new Cross-role Assessment can be generated for this Shot
      </p>
      <p className={styles.detail}>
        Role outputs from the VFX Supervisor, CG Supervisor, and Artist Agent
        are all available for {versionLabel(versionsById.get(versionId))} -- a
        Cross-role Assessment can now be generated.
      </p>
      <GenerateAssessmentButton
        shotId={shotId}
        taskId={taskId}
        versionId={versionId}
      />
    </>
  );
}

function ProposalSummary({
  proposal,
  shotId,
}: {
  proposal: ReAnchorProposal;
  shotId: string;
}) {
  return (
    <div className={styles.proposalCard}>
      <AuthorityLabel variant="ai-proposal" />
      <p className={styles.proposalReason}>
        {proposal.proposal_output.reason_for_consideration}
      </p>
      <Link
        href={`/vfx/shots/${shotId}/intent`}
        className={styles.reviewProposalLink}
      >
        Review proposal →
      </Link>
    </div>
  );
}

function ReassessmentPriorityBody({
  shotId,
  taskId,
  versionId,
  supersededProposal,
  versionsById,
}: {
  shotId: string;
  taskId: string;
  versionId: string;
  supersededProposal: ReAnchorProposal | null;
  versionsById: Map<string, VersionRead>;
}) {
  return (
    <>
      <p className={styles.message}>
        A newer eligible Version is ready for reassessment
      </p>
      <p className={styles.detail}>
        Current resolved evidence for{" "}
        {versionLabel(versionsById.get(versionId))} is now available --
        generating a new Cross-role Assessment keeps the historical Assessment
        exactly as it is.
      </p>
      <GenerateAssessmentButton
        shotId={shotId}
        taskId={taskId}
        versionId={versionId}
        label="Generate new Cross-role Assessment"
        pendingLabel="Generating new Assessment…"
      />
      {supersededProposal && (
        <div className={styles.superseded}>
          <p className={styles.supersededLabel}>From the previous assessment</p>
          <ProposalSummary proposal={supersededProposal} shotId={shotId} />
        </div>
      )}
    </>
  );
}

function ReviewProposalBody({
  current,
  proposal,
  shotId,
}: {
  current: CrossRoleAssessmentRead;
  proposal: ReAnchorProposal;
  shotId: string;
}) {
  return (
    <>
      {current.intent_signal.attention_level !== "low" && (
        <AuthorityLabel variant="human-review-required" />
      )}
      <p className={styles.message}>
        {current.intent_signal.signal_output.summary}
      </p>
      <ProposalSummary proposal={proposal} shotId={shotId} />
      <NoDirectDecisionNote shotId={shotId} />
    </>
  );
}

function InterpretOnlyBody({
  current,
  lowAttention,
  shotId,
}: {
  current: CrossRoleAssessmentRead;
  lowAttention: boolean;
  shotId: string;
}) {
  return (
    <>
      {!lowAttention && <AuthorityLabel variant="human-review-required" />}
      <p className={styles.message}>
        {current.intent_signal.signal_output.summary}
      </p>
      <p className={styles.detail} role="status">
        {lowAttention
          ? "No human review is required based on this assessment."
          : "Human review is required -- the VFX Supervisor should interpret these findings."}
      </p>
      <p className={styles.detail}>
        No Re-anchor Proposal exists for the current assessment.
      </p>
      <NoDirectDecisionNote shotId={shotId} />
    </>
  );
}

/** `/vfx/shots/:shotId/alignment` -- Human Attention / Human Action
 * (brief §7): the page's most important region after current state,
 * extracted from the previous Agent-Interpretation nesting into its own
 * elevated, distinct block. Never invents a persisted action -- every
 * state maps to a real control that already exists on this page
 * (`GenerateAssessmentButton`'s two real call sites, or the real
 * "Review proposal" route to Intent). */
export function HumanAttentionAction({
  shotId,
  item,
  current,
  versionsById,
}: {
  shotId: string;
  item: VfxInboxItemRead;
  current: CrossRoleAssessmentRead | null;
  versionsById: Map<string, VersionRead>;
}) {
  const state = deriveHumanAttentionState(item, current);

  return (
    <section className={styles.section} aria-label="Human Attention">
      <AuthorityBoundary
        tone="human"
        label={
          <span className={styles.humanRegionHeading}>
            <span
              className={`${styles.iconTile} ${styles.iconTileSmall}`}
              aria-hidden="true"
            >
              <Icon name="human" size="standard" />
            </span>
            Human intent
          </span>
        }
        ownerLabel="The Human VFX Supervisor"
        statement="owns interpretation and confirmation of alignment findings. The Core Agent's cross-role assessment is advisory only."
        flush
      >
        <div className={styles.body}>
          {state.kind === "not_ready" && (
            <NotReadyBody shotId={shotId} item={item} />
          )}
          {state.kind === "generate_first" && (
            <GenerateFirstBody
              shotId={shotId}
              taskId={state.taskId}
              versionId={state.versionId}
              versionsById={versionsById}
            />
          )}
          {state.kind === "reassessment_priority" && (
            <ReassessmentPriorityBody
              shotId={shotId}
              taskId={state.taskId}
              versionId={state.versionId}
              supersededProposal={state.supersededProposal}
              versionsById={versionsById}
            />
          )}
          {state.kind === "review_proposal" && (
            <ReviewProposalBody
              current={state.current}
              proposal={state.proposal}
              shotId={shotId}
            />
          )}
          {state.kind === "interpret_only" && (
            <InterpretOnlyBody
              current={state.current}
              lowAttention={state.lowAttention}
              shotId={shotId}
            />
          )}
        </div>
      </AuthorityBoundary>
    </section>
  );
}
