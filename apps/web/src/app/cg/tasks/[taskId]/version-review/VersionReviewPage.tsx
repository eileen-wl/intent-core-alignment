"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import type {
  AnchorContextRead,
  CGProposedExecutionGuidance,
  CGReviewItem,
  CGSupervisorReviewRead,
} from "@intent-core/contracts";

import {
  AuthorityBoundary,
  AuthorityLabel,
  EmptyState,
  FtrackLinkageBadge,
  Icon,
  SignalStrip,
  type SignalStripItem,
  StatusBadge,
  type StatusBadgeStatus,
  VersionMediaResolver,
} from "@/design";
import { getAuthorDisplayText } from "@/lib/authorProvenance";
import type { VersionReviewWorkspaceData } from "@/features/cg/version-review-workspace/data";
import { resolveVersionMediaAction } from "@/features/cg/actions";
import { CgTaskWorkspaceFrame } from "../CgTaskWorkspaceFrame";
import { VersionReviewActions } from "./VersionReviewActions";
import styles from "./VersionReviewPage.module.css";

/** Exact implementation-only generator/debug labels verified present in
 * this codebase's deterministic Agent generators -- ICAS_DESIGN.md
 * §25.9 prohibits exposing these in normal product UI. An explicit
 * allowlist, not a generic "strip any leading bracket" pattern --
 * legitimate product copy that happens to start with a bracket must
 * never be silently removed. Verified two ways: current generator
 * source (`cg_agent_service.py`, `cg_supervisor_review_service.py`)
 * for the base labels, and direct inspection of persisted
 * `execution_anchor_revisions`/`cg_supervisor_reviews` rows for the
 * canonical CG D1 Golden Journey labels below -- the D1-specific
 * generator overrides (`DeterministicD1ExecutionAnchorDraftGenerator`,
 * `DeterministicD1CGSupervisorReviewGenerator` in `d1_scenario.py`)
 * that produced those two no longer emit a bracket label in their
 * current form, so the label only exists in already-persisted rows,
 * not in any current source string. Same base list established for
 * VFX Alignment (its own separate copy, unaffected by this one). */
const GENERATOR_LABELS = [
  "[Cross-role deterministic]",
  "[Artist deterministic]",
  "[CG deterministic]",
  "[Core Agent draft - deterministic placeholder, review required]",
  "[Core Agent intent decomposition - deterministic placeholder, review required]",
  "[Core Agent alignment assessment - deterministic placeholder, review required]",
  "[Core Agent context reconstruction - deterministic placeholder, review required]",
  "[CG Agent execution anchor draft - deterministic placeholder, review required]",
  "[CG Agent execution anchor draft - D1 combined-intensity ceiling translation]",
  "[ICAS Demo — D1]",
] as const;

/** The CG D1 Golden Journey's R2+ compliance label carries a real
 * variable part -- the Execution Anchor revision number that gated
 * `DeterministicD1CGSupervisorReviewGenerator`'s override (only R2 has
 * been generated in this demo's data to date, but the generator's own
 * `revision_number >= 2` gate means R3+ is a legitimate future value,
 * not an arbitrary pattern). */
const CG_D1_COMPLIANCE_LABEL =
  /\[CG D1 deterministic - R\d+ combined-intensity ceiling compliance\]/g;

/** Removes any verified generator label wherever it occurs in `text`
 * (a leading prefix, or embedded mid-sentence if a caller ever
 * composes one field's text into another), then normalizes the
 * resulting whitespace. Text containing no verified label is returned
 * unchanged -- this never touches genuine domain wording. */
function stripGeneratorLabel(text: string): string {
  let result = text;
  let changed = false;
  for (const label of GENERATOR_LABELS) {
    if (result.includes(label)) {
      result = result.split(label).join(" ");
      changed = true;
    }
  }
  const withoutCompliance = result.replace(CG_D1_COMPLIANCE_LABEL, " ");
  if (withoutCompliance !== result) {
    result = withoutCompliance;
    changed = true;
  }
  return changed ? result.replace(/\s+/g, " ").trim() : result;
}

/** CG Version Review presentation-only helper: the real Version name
 * in this journey already communicates its own number (e.g.
 * "Compositing Conflict V1", "Comp Resolved V2"), so appending
 * "(vN)" again is redundant. Shows the name alone when it already
 * ends with the equivalent "V{number}" (case-insensitive); otherwise
 * preserves the existing "Name (vN)" presentation unchanged. Display
 * only -- never renames the stored Version. */
function displayVersionName(
  name: string,
  versionNumber: number | null,
): string {
  if (!versionNumber) return name;
  if (new RegExp(`v${versionNumber}$`, "i").test(name.trim())) {
    return name;
  }
  return `${name} (v${versionNumber})`;
}

/** Owner correction: the previous approach derived the default-layer
 * takeaway from the stored `executive_summary` sentence -- a single
 * long sentence in real data, so even complete-sentence budgeting
 * still rendered as a long report. This instead builds two short,
 * always-grammatical sentences directly from already-loaded
 * STRUCTURED counts real to the current review -- never parses or
 * truncates `executive_summary`, never fabricates a domain
 * conclusion beyond restating the real counts:
 * - whether the review recorded any technical concerns against the
 *   confirmed Execution Anchor boundary (`technical_concerns.length`);
 * - whether any coordination concerns are open
 *   (`coordination_concerns.length`), i.e. whether cross-role
 *   attention still needs Human review.
 * The full `executive_summary` and every structured finding remain
 * exactly as before in Detailed Agent Review (untouched this turn). */
function buildAgentTakeaway(
  output: CGSupervisorReviewRead["review_output"],
  executionRevisionNumber: number | null,
): string {
  const boundaryLabel = executionRevisionNumber
    ? `the confirmed R${executionRevisionNumber} boundary`
    : "the confirmed Execution Anchor boundary";
  const technicalCount = output.technical_concerns.length;
  const boundaryClause =
    technicalCount === 0
      ? `Execution remains inside ${boundaryLabel}.`
      : `Execution raises ${technicalCount} technical concern${technicalCount === 1 ? "" : "s"} against ${boundaryLabel}.`;

  const coordinationCount = output.coordination_concerns.length;
  const coordinationClause =
    coordinationCount === 0
      ? "No cross-role coordination concerns are currently open."
      : `Cross-role coordination attention is required (${coordinationCount} open concern${coordinationCount === 1 ? "" : "s"}).`;

  return `${boundaryClause} ${coordinationClause}`;
}

function capitalize(text: string): string {
  return text.length === 0 ? text : text[0].toUpperCase() + text.slice(1);
}

const PRIORITY_CLASS: Record<CGReviewItem["priority"], string> = {
  low: "",
  medium: styles.priorityMedium,
  high: styles.priorityHigh,
};

const PREVIEW_SIZE = 2;

/** Selects the most decision-relevant CG review items for the default,
 * unexpanded reading -- highest real priority actually present among
 * the three concern-shaped categories (never `implementation_priorities`
 * or `proposed_execution_guidance`, which are forward-looking guidance,
 * not open concerns), High if any exist, else Medium, else Low, never
 * inventing a priority. Mirrors the same tiered-selection rule
 * established for VFX Alignment's "Most decision-relevant findings". */
function decisionRelevantItems(
  output: CGSupervisorReviewRead["review_output"],
): CGReviewItem[] {
  const concerns = [
    ...output.technical_concerns,
    ...output.coordination_concerns,
    ...output.actionable_requirements,
  ];
  for (const priority of ["high", "medium", "low"] as const) {
    const atPriority = concerns.filter((item) => item.priority === priority);
    if (atPriority.length > 0) {
      return atPriority.slice(0, PREVIEW_SIZE);
    }
  }
  return [];
}

/** ICAS Visual Language v1 §8.4: the same five real counts the prose
 * count line showed, in the same order, as Signal Strip items. Always
 * includes all five (including a real zero) -- the previous prose line
 * hid "Evidence gaps" entirely at zero, which the Signal Strip's own
 * "zero values remain visually quiet, not hidden" rule replaces. */
function signalStripItems(
  output: CGSupervisorReviewRead["review_output"],
): SignalStripItem[] {
  return [
    {
      icon: "technical",
      label: "Technical",
      count: output.technical_concerns.length,
    },
    {
      icon: "coordination",
      label: "Coordination",
      count: output.coordination_concerns.length,
    },
    {
      icon: "requirements",
      label: "Requirements",
      count: output.actionable_requirements.length,
    },
    {
      icon: "question",
      label: "Questions",
      count: output.questions_for_human_cg_supervisor.length,
    },
    {
      icon: "evidence-gap",
      label: "Evidence gaps",
      count: output.evidence_gaps.length,
    },
  ];
}

function ReviewItemGroup({
  title,
  items,
}: {
  title: string;
  items: CGReviewItem[];
}) {
  if (items.length === 0) return null;
  return (
    <section className={styles.findingGroup}>
      <h4 className={styles.findingGroupTitle}>
        {title} ({items.length})
      </h4>
      <ul className={styles.findingList}>
        {items.map((item, index) => (
          // eslint-disable-next-line react/no-array-index-key -- a review's items are an immutable, unindexed array with no id of their own
          <li key={index} className={styles.finding}>
            <span className={styles.previewIndex} aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className={styles.findingBody}>
              <div className={styles.findingHead}>
                <p className={styles.findingSummary}>
                  {stripGeneratorLabel(item.summary)}
                </p>
                <span
                  className={`${styles.priority} ${PRIORITY_CLASS[item.priority]}`}
                >
                  {item.priority}
                </span>
              </div>
              <p className={styles.findingWhy}>
                {stripGeneratorLabel(item.rationale)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function GuidanceGroup({ items }: { items: CGProposedExecutionGuidance[] }) {
  if (items.length === 0) return null;
  return (
    <section className={styles.findingGroup}>
      <h4 className={styles.findingGroupTitle}>
        Proposed execution guidance ({items.length})
      </h4>
      <ul className={styles.findingList}>
        {items.map((item, index) => (
          // eslint-disable-next-line react/no-array-index-key -- a review's items are an immutable, unindexed array with no id of their own
          <li key={index} className={styles.finding}>
            <span className={styles.previewIndex} aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className={styles.findingBody}>
              <div className={styles.findingHead}>
                <p className={styles.findingSummary}>
                  {stripGeneratorLabel(item.guidance)}
                </p>
                <span
                  className={`${styles.priority} ${PRIORITY_CLASS[item.priority]}`}
                >
                  {item.priority}
                </span>
              </div>
              <p className={styles.findingWhy}>
                {stripGeneratorLabel(item.underlying_intent)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Owner correction: "Reviewed"/"Review outdated"/"Not yet reviewed" read
 * as if they described Human approval of the Version itself. These
 * describe only whether a CG Supervisor Agent Execution Review exists
 * and reflects the active confirmed Execution Anchor revision -- never
 * Human/Version approval. "current" deliberately does not use
 * StatusBadge's green "confirmed" status (reserved for real
 * confirmed/completed authority state) -- an existing Agent review is
 * advisory, so it stays in the same restrained neutral treatment as
 * other Agent-advisory content. */
const REVIEW_STATE_STATUS: Record<
  "not_reviewed" | "current" | "outdated",
  StatusBadgeStatus
> = {
  not_reviewed: "unavailable",
  current: "neutral",
  outdated: "attention",
};

const REVIEW_STATE_LABEL: Record<
  "not_reviewed" | "current" | "outdated",
  string
> = {
  not_reviewed: "No Agent review",
  current: "Agent review current",
  outdated: "Agent review outdated",
};

/** `/cg/tasks/:taskId/version-review` (Step 7C-4) -- whether a
 * Production Version satisfies the active Core Anchor and confirmed
 * Execution Anchor. ICAS Review Archetype (second representative
 * page, reusing the dark visual grammar VFX Alignment established):
 * a compact horizontal Version selector, then Version Review Header ->
 * Production Evidence -> Agent Review Summary (concise; full detail
 * collapsed) -> Human Response. Retires the previous Production-
 * Evidence/Agent-Interpretation/Human-Decision heading layering
 * (`EvidenceLayerSection`) the same way Alignment did -- the
 * Production Facts/AI Proposal/Human Decision separation itself is
 * preserved through region structure, `AuthorityLabel`, and
 * `AuthorityBoundary`, not that specific heading pattern. The Task's
 * associated Versions are its Shot's Versions -- see
 * `features/cg/version-review-workspace/data.ts`'s doc comment. */
export function VersionReviewPage({
  taskId,
  data,
  anchorContext,
  unavailable,
  onExitRole,
}: {
  taskId: string;
  data: VersionReviewWorkspaceData | null;
  anchorContext?: AnchorContextRead | null;
  unavailable: boolean;
  onExitRole: () => void | Promise<void>;
}) {
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    null,
  );

  const selected = data
    ? (data.versions.find((entry) => entry.version.id === selectedVersionId) ??
      data.versions[0] ??
      null)
    : null;
  const selectedCgReviews = selected
    ? (data?.cgSupervisorReviews.filter(
        (review) => review.version_id === selected.version.id,
      ) ?? [])
    : [];
  const currentReview = selectedCgReviews[0] ?? null;
  const olderReviews = selectedCgReviews.slice(1);

  const reviewState: "not_reviewed" | "current" | "outdated" =
    currentReview === null
      ? "not_reviewed"
      : data?.activeExecutionRevision &&
          currentReview.execution_anchor_revision_id ===
            data.activeExecutionRevision.id
        ? "current"
        : "outdated";

  const isLatestVersion = Boolean(
    selected && data && selected.version.id === data.item.latest_version_id,
  );

  return (
    <CgTaskWorkspaceFrame
      item={data?.item ?? null}
      anchorContext={anchorContext}
      activeTab="version-review"
      unavailable={unavailable}
      onExitRole={onExitRole}
    >
      {data && (
        <>
          {data.versions.length === 0 ? (
            <EmptyState
              title="No Production Version is available"
              description="A Production Version is required before CG Version review and cross-role assessment can run. The Version must arrive from the production workflow; no local upload is implied."
            />
          ) : (
            <div className={styles.workspace}>
              {/* D. Version selector -- compact horizontal row, never
               * competing with the Review Workspace's own width. */}
              <section
                className={styles.selectorSection}
                aria-label="Production Versions"
              >
                <span className={styles.columnHeading}>
                  Production Versions
                </span>
                <div className={styles.selectorList}>
                  {data.versions.map(({ version, reviewNotes }, index) => {
                    const isActive = selected?.version.id === version.id;
                    const isLatestChip =
                      version.id === data.item.latest_version_id;
                    return (
                      <Fragment key={version.id}>
                        {index > 0 && (
                          <span
                            className={styles.railConnector}
                            aria-hidden="true"
                          />
                        )}
                        <button
                          type="button"
                          className={
                            isActive
                              ? `${styles.chip} ${styles.chipActive}`
                              : styles.chip
                          }
                          aria-current={isActive || undefined}
                          onClick={() => setSelectedVersionId(version.id)}
                        >
                          <span className={styles.chipPrimary}>
                            <span
                              className={`${styles.iconTile} ${styles.iconTileSmall}`}
                              aria-hidden="true"
                            >
                              <Icon name="version" size="standard" />
                            </span>
                            <span className={styles.chipName}>
                              {displayVersionName(
                                version.name,
                                version.version_number,
                              )}
                            </span>
                            {isActive && (
                              <span
                                className={`${styles.chipPill} ${styles.chipPillActive}`}
                              >
                                reviewing
                              </span>
                            )}
                            {isLatestChip && (
                              <span
                                className={`${styles.chipPill} ${styles.chipPillLatest}`}
                              >
                                latest
                              </span>
                            )}
                          </span>
                          <span className={styles.chipSecondary}>
                            <span className={styles.chipMeta}>
                              {isLatestChip ? "Latest" : "Earlier"} ·{" "}
                              {reviewNotes.length} review{" "}
                              {reviewNotes.length === 1 ? "note" : "notes"}
                            </span>
                            <FtrackLinkageBadge source={version.source} />
                          </span>
                        </button>
                      </Fragment>
                    );
                  })}
                </div>
              </section>

              <div className={styles.reviewColumn}>
                {selected && (
                  <>
                    {/* C+E. Selected Version + Production Evidence --
                     * owner-approved reference: these visually belong to
                     * ONE raised review-object surface (Version object on
                     * top, Evidence below a divider), not two detached
                     * sections. Each keeps its own `aria-label`ed
                     * `<section>` for accessibility/landmark purposes;
                     * `.selectedVersionSurface` supplies the single shared
                     * background/radius. */}
                    <div className={styles.selectedVersionSurface}>
                      <section
                        className={styles.versionHeader}
                        aria-label="Version under review"
                      >
                        <div className={styles.versionObjectRow}>
                          <span
                            className={`${styles.iconTile} ${styles.iconTileLarge}`}
                            aria-hidden="true"
                          >
                            <Icon name="version" size="region" />
                          </span>
                          <div className={styles.versionObjectBody}>
                            <div className={styles.versionTitleRow}>
                              <h3 className={styles.versionTitle}>
                                {displayVersionName(
                                  selected.version.name,
                                  selected.version.version_number,
                                )}
                              </h3>
                              {isLatestVersion ? (
                                <StatusBadge
                                  status="confirmed"
                                  label="Latest Production Version"
                                />
                              ) : (
                                <StatusBadge
                                  status="neutral"
                                  label="Earlier Production Version"
                                />
                              )}
                              <StatusBadge
                                status={REVIEW_STATE_STATUS[reviewState]}
                                label={REVIEW_STATE_LABEL[reviewState]}
                              />
                            </div>
                            <p className={styles.versionMeta}>
                              {data.item.task_name}
                              {data.item.department
                                ? ` · ${data.item.department}`
                                : ""}{" "}
                              · {data.item.shot_name} ·{" "}
                              {selected.reviewNotes.length} review{" "}
                              {selected.reviewNotes.length === 1
                                ? "note"
                                : "notes"}
                            </p>
                            {!isLatestVersion &&
                              data.item.latest_version_name && (
                                <p className={styles.versionLatestNote}>
                                  <span className={styles.versionLatestLabel}>
                                    Latest production
                                  </span>
                                  <span className={styles.versionLatestValue}>
                                    →{" "}
                                    {displayVersionName(
                                      data.item.latest_version_name,
                                      data.item.latest_version_number,
                                    )}
                                  </span>
                                </p>
                              )}
                          </div>
                        </div>
                      </section>

                      <section
                        className={styles.evidenceSection}
                        aria-label="Production Evidence"
                      >
                        <span className={styles.regionHeading}>
                          <Icon name="evidence" size="region" />
                          Production evidence
                        </span>
                        <VersionMediaResolver
                          key={selected.version.id}
                          versionId={selected.version.id}
                          resolve={(versionId) =>
                            resolveVersionMediaAction(taskId, versionId)
                          }
                        />
                        <dl className={styles.evidenceGrid}>
                          <div className={styles.evidenceField}>
                            <dt className={styles.evidenceLabel}>Created</dt>
                            <dd className={styles.evidenceValue}>
                              {new Date(
                                selected.version.created_at,
                              ).toLocaleString()}
                            </dd>
                          </div>
                          <div className={styles.evidenceField}>
                            <dt className={styles.evidenceLabel}>Source</dt>
                            <dd className={styles.evidenceValue}>
                              {selected.version.source}
                            </dd>
                          </div>
                          <div className={styles.evidenceField}>
                            <dt className={styles.evidenceLabel}>
                              Core Anchor
                            </dt>
                            <dd className={styles.evidenceValue}>
                              {data.coreAnchorRevisionNumber
                                ? `R${data.coreAnchorRevisionNumber}${
                                    data.coreAnchorStatus
                                      ? ` · ${capitalize(data.coreAnchorStatus)}`
                                      : ""
                                  }`
                                : "Not confirmed"}
                            </dd>
                          </div>
                          <div className={styles.evidenceField}>
                            <dt className={styles.evidenceLabel}>
                              Execution Anchor
                            </dt>
                            <dd className={styles.evidenceValue}>
                              {data.activeExecutionRevision
                                ? `R${data.activeExecutionRevision.revision_number} · ${capitalize(data.activeExecutionRevision.status)}`
                                : "Not confirmed"}
                            </dd>
                          </div>
                        </dl>
                        <div className={styles.subsection}>
                          {selected.reviewNotes.length === 0 ? (
                            <p className={styles.empty}>
                              No Review Notes have been recorded for this
                              Production Version yet.
                            </p>
                          ) : (
                            <ul className={styles.noteList}>
                              {selected.reviewNotes.map((note) => (
                                <li key={note.id} className={styles.note}>
                                  <span
                                    className={`${styles.iconTile} ${styles.iconTileSmall}`}
                                    aria-hidden="true"
                                  >
                                    <Icon name="review-note" size="standard" />
                                  </span>
                                  <div>
                                    <p className={styles.noteContent}>
                                      {note.content}
                                    </p>
                                    <p className={styles.noteMeta}>
                                      {getAuthorDisplayText(note)} ·{" "}
                                      {new Date(
                                        note.created_at,
                                      ).toLocaleString()}
                                    </p>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </section>
                    </div>

                    {/* F. Agent Review Summary -- concise first-reading
                     * layer only. Inputs/Prerequisites/full reasoning/
                     * Human authority/Next action all move into the
                     * detail disclosure below, collapsed by default. */}
                    <section
                      className={styles.agentSection}
                      aria-label="CG Supervisor Agent Execution Review"
                    >
                      <span className={styles.regionHeading}>
                        <Icon name="agent" size="region" />
                        CG Agent review
                      </span>
                      <div className={styles.agentCanvas}>
                        <div className={styles.agentLeft}>
                          <AuthorityLabel variant="ai-interpretation" />
                          {currentReview ? (
                            <>
                              <p className={styles.agentGenerated}>
                                Generated{" "}
                                {new Date(
                                  currentReview.created_at,
                                ).toLocaleString()}
                              </p>
                              <p className={styles.executiveSummary}>
                                {buildAgentTakeaway(
                                  currentReview.review_output,
                                  data.activeExecutionRevision
                                    ?.revision_number ?? null,
                                )}
                              </p>
                            </>
                          ) : (
                            <p className={styles.empty}>
                              No Execution Review has been generated for this
                              selected Version yet.
                            </p>
                          )}
                        </div>
                        {currentReview && (
                          <div className={styles.agentRight}>
                            <span className={styles.agentRightHeading}>
                              Review signal
                            </span>
                            <SignalStrip
                              items={signalStripItems(
                                currentReview.review_output,
                              )}
                            />
                          </div>
                        )}
                      </div>
                      {currentReview &&
                        (() => {
                          const decisionRelevant = decisionRelevantItems(
                            currentReview.review_output,
                          );
                          return decisionRelevant.length > 0 ? (
                            <ol className={styles.previewList}>
                              {decisionRelevant.map((item, index) => (
                                // eslint-disable-next-line react/no-array-index-key -- a review's items are an immutable, unindexed array with no id of their own
                                <li key={index} className={styles.previewItem}>
                                  <span
                                    className={styles.previewIndexFocus}
                                    aria-hidden="true"
                                  >
                                    {String(index + 1).padStart(2, "0")}
                                  </span>
                                  <div className={styles.previewBody}>
                                    <div className={styles.previewHead}>
                                      <p className={styles.previewSummary}>
                                        {stripGeneratorLabel(item.summary)}
                                      </p>
                                      <span
                                        className={`${styles.priority} ${PRIORITY_CLASS[item.priority]}`}
                                      >
                                        {item.priority}
                                      </span>
                                    </div>
                                    <p className={styles.previewWhy}>
                                      {stripGeneratorLabel(item.rationale)}
                                    </p>
                                  </div>
                                </li>
                              ))}
                            </ol>
                          ) : null;
                        })()}
                      <div className={styles.agentFooter}>
                        <p className={styles.advisoryNote}>
                          Advisory technical interpretation only; it does not
                          approve the Version or resolve a Human Decision.
                        </p>
                        {currentReview && (
                          <details className={styles.disclosure}>
                            <summary className={styles.disclosureSummary}>
                              <span className={styles.disclosureLabelClosed}>
                                View detailed Agent review →
                              </span>
                              <span className={styles.disclosureLabelOpen}>
                                Collapse detailed Agent review ↑
                              </span>
                            </summary>
                            <div className={styles.disclosureContent}>
                              <section className={styles.findingGroup}>
                                <h4 className={styles.findingGroupTitle}>
                                  Review context
                                </h4>
                                <dl className={styles.reviewContextGrid}>
                                  <div className={styles.evidenceField}>
                                    <dt className={styles.evidenceLabel}>
                                      Version
                                    </dt>
                                    <dd className={styles.evidenceValue}>
                                      {selected.version.name}
                                    </dd>
                                  </div>
                                  <div className={styles.evidenceField}>
                                    <dt className={styles.evidenceLabel}>
                                      Core Anchor
                                    </dt>
                                    <dd className={styles.evidenceValue}>
                                      {data.coreAnchorSummary
                                        ? "Confirmed"
                                        : "Missing"}
                                    </dd>
                                  </div>
                                  <div className={styles.evidenceField}>
                                    <dt className={styles.evidenceLabel}>
                                      Execution Anchor
                                    </dt>
                                    <dd className={styles.evidenceValue}>
                                      {data.activeExecutionRevision ? (
                                        <Link
                                          href={`/cg/tasks/${taskId}/execution`}
                                          className={styles.evidenceLink}
                                        >
                                          {`Confirmed R${data.activeExecutionRevision.revision_number} →`}
                                        </Link>
                                      ) : (
                                        "Missing"
                                      )}
                                    </dd>
                                  </div>
                                </dl>
                              </section>
                              <section className={styles.findingGroup}>
                                <h4 className={styles.findingGroupTitle}>
                                  Execution direction
                                </h4>
                                <p className={styles.findingSummary}>
                                  {stripGeneratorLabel(
                                    currentReview.review_output
                                      .execution_direction_read.summary,
                                  )}
                                </p>
                                <p className={styles.findingWhy}>
                                  {stripGeneratorLabel(
                                    currentReview.review_output
                                      .execution_direction_read.rationale,
                                  )}
                                </p>
                              </section>
                              <ReviewItemGroup
                                title="Technical concerns"
                                items={
                                  currentReview.review_output.technical_concerns
                                }
                              />
                              <ReviewItemGroup
                                title="Coordination concerns"
                                items={
                                  currentReview.review_output
                                    .coordination_concerns
                                }
                              />
                              <ReviewItemGroup
                                title="Actionable requirements"
                                items={
                                  currentReview.review_output
                                    .actionable_requirements
                                }
                              />
                              <ReviewItemGroup
                                title="Implementation priorities"
                                items={
                                  currentReview.review_output
                                    .implementation_priorities
                                }
                              />
                              <GuidanceGroup
                                items={
                                  currentReview.review_output
                                    .proposed_execution_guidance
                                }
                              />
                              {currentReview.review_output
                                .questions_for_human_cg_supervisor.length >
                                0 && (
                                <section className={styles.findingGroup}>
                                  <h4 className={styles.findingGroupTitle}>
                                    Questions for the Human CG Supervisor (
                                    {
                                      currentReview.review_output
                                        .questions_for_human_cg_supervisor
                                        .length
                                    }
                                    )
                                  </h4>
                                  <ul className={styles.plainList}>
                                    {currentReview.review_output.questions_for_human_cg_supervisor.map(
                                      (question, index) => (
                                        // eslint-disable-next-line react/no-array-index-key -- an immutable, unindexed string array
                                        <li key={index}>
                                          {stripGeneratorLabel(question)}
                                        </li>
                                      ),
                                    )}
                                  </ul>
                                </section>
                              )}
                              {currentReview.review_output.evidence_gaps
                                .length > 0 && (
                                <section className={styles.findingGroup}>
                                  <h4 className={styles.findingGroupTitle}>
                                    Evidence gaps (
                                    {
                                      currentReview.review_output.evidence_gaps
                                        .length
                                    }
                                    )
                                  </h4>
                                  <ul className={styles.plainList}>
                                    {currentReview.review_output.evidence_gaps.map(
                                      (gap, index) => (
                                        // eslint-disable-next-line react/no-array-index-key -- an immutable, unindexed string array
                                        <li key={index}>
                                          {stripGeneratorLabel(gap)}
                                        </li>
                                      ),
                                    )}
                                  </ul>
                                </section>
                              )}
                              <section
                                className={styles.findingGroup}
                                aria-label="Detail footer"
                              >
                                <div className={styles.detailFooter}>
                                  <div className={styles.detailFooterItem}>
                                    <span className={styles.evidenceLabel}>
                                      Human authority
                                    </span>
                                    <p>
                                      Advisory technical interpretation; it does
                                      not approve the Version or resolve a Human
                                      Decision.
                                    </p>
                                  </div>
                                  <div className={styles.detailFooterItem}>
                                    <span className={styles.evidenceLabel}>
                                      Next human action
                                    </span>
                                    <p>
                                      Inspect the Agent review, then record a
                                      Review Note, dependency, or escalation if
                                      needed.
                                    </p>
                                  </div>
                                  <div className={styles.detailFooterItem}>
                                    <span className={styles.evidenceLabel}>
                                      Evidence and provenance
                                    </span>
                                    <p>
                                      Detailed Agent provenance is unavailable
                                      for this output.
                                    </p>
                                  </div>
                                </div>
                              </section>
                            </div>
                          </details>
                        )}
                      </div>
                    </section>

                    {olderReviews.length > 0 && (
                      <section
                        className={styles.historySection}
                        aria-label="Earlier Agent Execution Reviews"
                      >
                        <h4 className={styles.historySectionTitle}>
                          Earlier Agent Execution Reviews
                        </h4>
                        <ul className={styles.historyList}>
                          {olderReviews.map((review) => (
                            <li key={review.id} className={styles.historyItem}>
                              <span className={styles.historyTime}>
                                {new Date(review.created_at).toLocaleString()}
                              </span>
                              <span className={styles.historySummary}>
                                {stripGeneratorLabel(
                                  review.review_output.executive_summary,
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}

                    {/* G. Human Response -- strongest, Human-owned surface */}
                    <section
                      className={styles.humanSection}
                      aria-label="Human Response"
                    >
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
                            Human authority
                          </span>
                        }
                        ownerLabel="The Human CG Supervisor"
                        statement="owns interpretation and response to this Production Version's review. The CG Supervisor Agent's execution review is advisory only; escalating to VFX records a Dependency, not a Human Decision."
                        flush
                      >
                        <VersionReviewActions
                          taskId={taskId}
                          versionId={selected.version.id}
                          activeExecutionRevisionId={
                            data.activeExecutionRevision?.id ?? null
                          }
                          hasCurrentReview={data.cgSupervisorReviews.length > 0}
                        />
                      </AuthorityBoundary>
                    </section>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </CgTaskWorkspaceFrame>
  );
}
