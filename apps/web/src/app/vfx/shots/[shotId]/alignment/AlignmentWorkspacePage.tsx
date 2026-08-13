"use client";

import type {
  AnchorContextRead,
  CoreAnchorRevisionRead,
  CrossRoleAssessmentRead,
  CrossRoleFinding,
  VersionRead,
} from "@intent-core/contracts";

import {
  AuthorityLabel,
  EvidenceProvenanceDrawer,
  Icon,
  MetadataRow,
  SignalStrip,
  type SignalStripItem,
  StatusBadge,
  type StatusBadgeStatus,
  stripGeneratorLabel,
} from "@/design";
import { humanRoleLabel } from "@/lib/humanRoleLabel";
import type { AlignmentWorkspaceData } from "@/features/vfx/alignment-workspace/data";
import type { EvidenceReferenceLike } from "@/design";
import { VfxShotWorkspaceFrame } from "../VfxShotWorkspaceFrame";
import { DepartmentExecutionStrip } from "./DepartmentExecutionStrip";
import { HumanAttentionAction } from "./HumanAttentionAction";
import styles from "./AlignmentWorkspacePage.module.css";

function versionLabel(version: VersionRead | undefined): string {
  if (!version) return "Unknown Production Version";
  return version.version_number
    ? `${version.name} (v${version.version_number})`
    : version.name;
}

function revisionLabel(revision: CoreAnchorRevisionRead | undefined): string {
  if (!revision) return "Unknown Core Anchor Revision";
  return `Revision ${revision.revision_number}${revision.core_summary ? ` — ${revision.core_summary}` : ""}`;
}

/** The deterministic Cross-role Assessment generator writes its
 * `executive_summary` as a fixed, mechanical sentence encoding exact
 * finding counts with generator-template pluralization syntax --
 * "tension(s)", "risk(s)", "dependency(ies)"
 * (`cross_role_assessment_service.py`'s
 * `DeterministicCrossRoleAssessmentGenerator.generate`). That is
 * implementation-facing syntax, not acceptable product copy, and the
 * embedded numbers are a text snapshot taken at generation time that
 * can go stale relative to the assessment's own finding arrays -- e.g.
 * the D1 demo seed's `_recomputed_executive_summary` exists
 * specifically because department findings get appended to a base
 * assessment *after* generation via `model_copy`, carrying the
 * pre-augmentation sentence forward unchanged. Detects only that exact
 * known sentence shape (ignoring its embedded digits entirely -- see
 * `crossRoleCountsPhrase` below, which is always given the assessment
 * object's own real array lengths instead); anything else (including
 * genuine free-form Agent prose with no embedded counts) has no
 * verifiable numeric claim to normalize and is shown as recorded. */
const KNOWN_COUNT_SENTENCE =
  /^\d+ cross-role tension\(s\), \d+ local-optimum risk\(s\), and \d+ unresolved dependency\(ies\) considered across/;

function countPhrase(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function joinNaturally(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

/** Natural-language, correctly-pluralized phrase for a cross-role
 * assessment's three attention-relevant finding categories, built from
 * the assessment's own real array lengths (never from digits embedded
 * in stored text). Zero-count categories are omitted rather than
 * awkwardly announced ("0 local-optimum risks"), since omitting a
 * category that has nothing to report doesn't change the meaning. */
function crossRoleCountsPhrase(
  output: Pick<
    CrossRoleAssessmentRead["assessment_output"],
    "cross_role_tensions" | "local_optimum_risks" | "unresolved_dependencies"
  >,
): string {
  const parts: string[] = [];
  const tensions = output.cross_role_tensions.length;
  const risks = output.local_optimum_risks.length;
  const dependencies = output.unresolved_dependencies.length;
  if (tensions > 0) {
    parts.push(
      countPhrase(tensions, "cross-role tension", "cross-role tensions"),
    );
  }
  if (risks > 0) {
    parts.push(countPhrase(risks, "local-optimum risk", "local-optimum risks"));
  }
  if (dependencies > 0) {
    parts.push(
      countPhrase(
        dependencies,
        "unresolved dependency",
        "unresolved dependencies",
      ),
    );
  }
  if (parts.length === 0) {
    return "no cross-role tensions, local-optimum risks, or unresolved dependencies";
  }
  return joinNaturally(parts);
}

/** Alignment Signal's primary diagnosis. Only reformats text matching
 * the known generator-template shape (see `KNOWN_COUNT_SENTENCE`) --
 * genuine free-form Agent prose passes through unchanged. Always uses
 * `output`'s own live counts, the same real array lengths the Signal
 * Strip and Detailed Assessment category headings use elsewhere on
 * this page. */
function currentDiagnosisText(
  executiveSummary: string,
  output: CrossRoleAssessmentRead["assessment_output"],
): string {
  const cleaned = stripGeneratorLabel(executiveSummary);
  if (!KNOWN_COUNT_SENTENCE.test(cleaned)) {
    return cleaned;
  }
  return (
    `Current assessment identifies ${crossRoleCountsPhrase(output)} across ` +
    "the VFX Supervisor, CG Supervisor, and Artist Agent outputs."
  );
}

/** CG-validated Signal Strip backport (ICAS_VISUAL_LANGUAGE_V1 §8.5):
 * three genuinely distinct real-count metrics. `unresolved_dependencies`
 * is deliberately shown once, labelled "Open questions" -- the same
 * display name the Detailed Assessment's own category heading already
 * uses for that exact field -- rather than also listing it under an
 * "Unresolved dependencies" item, which would represent the same real
 * number twice under two names. */
function alignmentSignalStripItems(
  output: CrossRoleAssessmentRead["assessment_output"],
): SignalStripItem[] {
  return [
    {
      icon: "coordination",
      label: "Cross-role tensions",
      count: output.cross_role_tensions.length,
    },
    {
      icon: "risk",
      label: "Local-optimum risks",
      count: output.local_optimum_risks.length,
    },
    {
      icon: "question",
      label: "Open questions",
      count: output.unresolved_dependencies.length,
    },
  ];
}

const PREVIEW_SIZE = 2;

/** Owner-approved correction: the "Most decision-relevant findings"
 * preview answers "what should the VFX Supervisor look at right now?",
 * not "are there any High-priority records?". Selects from the
 * highest real priority actually present among the four
 * attention-relevant categories (never aligned findings, which are
 * confirmations, not attention items) -- High if any exist, else
 * Medium, else Low, never inventing a priority or rewriting a
 * finding's real text. */
function decisionRelevantFindings(
  output: CrossRoleAssessmentRead["assessment_output"],
): CrossRoleFinding[] {
  const attentionRelevant = [
    ...output.cross_role_tensions,
    ...output.local_optimum_risks,
    ...output.unresolved_dependencies,
    ...output.human_coordination_priorities,
  ];
  for (const priority of ["high", "medium", "low"] as const) {
    const atPriority = attentionRelevant.filter(
      (finding) => finding.priority === priority,
    );
    if (atPriority.length > 0) {
      return atPriority.slice(0, PREVIEW_SIZE);
    }
  }
  return [];
}

const ATTENTION_BADGE_STATUS: Record<
  "low" | "medium" | "high",
  StatusBadgeStatus
> = {
  low: "confirmed",
  medium: "attention",
  high: "blocking",
};

const ATTENTION_LABEL: Record<"low" | "medium" | "high", string> = {
  low: "Low attention",
  medium: "Medium attention",
  high: "High attention",
};

const PRIORITY_CLASS: Record<CrossRoleFinding["priority"], string> = {
  low: "",
  medium: styles.priorityMedium,
  high: styles.priorityHigh,
};

const SEVERITY_RANK: Record<CrossRoleFinding["priority"], number> = {
  low: 0,
  medium: 1,
  high: 2,
};

/** The single highest-severity signal across a cross-role assessment's
 * three attention-relevant finding categories -- e.g. "3 high-priority
 * local-optimum risks". Two assessments can share identical totals (the
 * D1 Golden Journey's conflict/resolved milestone pair both land on 2
 * tensions/3 risks/1 dependency) while differing materially in
 * severity; this surfaces that difference instead of the count alone.
 * On a tie (two categories reach the same top priority), the earlier
 * category in cross-role-tensions/local-optimum-risks/unresolved-
 * dependencies order wins -- a deterministic, arbitrary-but-stable
 * choice, not a claim that one tied category matters more. `null` only
 * when every category is empty. */
function highestSeveritySignal(
  output: Pick<
    CrossRoleAssessmentRead["assessment_output"],
    "cross_role_tensions" | "local_optimum_risks" | "unresolved_dependencies"
  >,
): { label: string; priority: CrossRoleFinding["priority"] } | null {
  const categories: {
    findings: CrossRoleFinding[];
    singular: string;
    plural: string;
  }[] = [
    {
      findings: output.cross_role_tensions,
      singular: "cross-role tension",
      plural: "cross-role tensions",
    },
    {
      findings: output.local_optimum_risks,
      singular: "local-optimum risk",
      plural: "local-optimum risks",
    },
    {
      findings: output.unresolved_dependencies,
      singular: "unresolved dependency",
      plural: "unresolved dependencies",
    },
  ];
  let best: { label: string; priority: CrossRoleFinding["priority"] } | null =
    null;
  for (const { findings, singular, plural } of categories) {
    if (findings.length === 0) continue;
    const topPriority = findings.reduce<CrossRoleFinding["priority"]>(
      (acc, finding) =>
        SEVERITY_RANK[finding.priority] > SEVERITY_RANK[acc]
          ? finding.priority
          : acc,
      "low",
    );
    if (!best || SEVERITY_RANK[topPriority] > SEVERITY_RANK[best.priority]) {
      const noun = findings.length === 1 ? singular : plural;
      best = {
        label: `${findings.length} ${topPriority}-priority ${noun}`,
        priority: topPriority,
      };
    }
  }
  return best;
}

/** Assessment History row summary. Replaces a counts-only summary
 * (which can coincidentally match the current assessment's totals --
 * see `highestSeveritySignal`'s doc comment) with what actually
 * distinguishes this historical assessment: its own real attention
 * level, its own assessed Version, its own highest-severity finding
 * signal, and whether it carried its own Re-anchor Proposal -- fields
 * already loaded for every assessment on this page. Never reads
 * `current`'s values, and never parses the stored (and potentially
 * stale) `executive_summary` text. Uses the Version's own real display
 * name as-is (not `versionLabel`'s "(vN)" suffix) -- that suffix is
 * redundant when the name itself already communicates the version,
 * e.g. "Compositing Conflict V1". */
function historySummaryText(
  assessment: CrossRoleAssessmentRead,
  versionsById: Map<string, VersionRead>,
): string {
  const parts: string[] = [
    ATTENTION_LABEL[assessment.intent_signal.attention_level],
  ];
  const version = versionsById.get(assessment.version_id);
  if (version) {
    parts.push(version.name);
  }
  const signal = highestSeveritySignal(assessment.assessment_output);
  if (signal) {
    parts.push(signal.label);
  }
  if (assessment.re_anchor_proposal) {
    parts.push("Re-anchor proposed");
  }
  return parts.join(" · ");
}

function FindingGroup({
  title,
  findings,
}: {
  title: string;
  findings: CrossRoleFinding[];
}) {
  if (findings.length === 0) return null;
  return (
    <section className={styles.findingGroup}>
      <h3 className={styles.findingGroupTitle}>
        {title} ({findings.length})
      </h3>
      <ul className={styles.findingList}>
        {findings.map((finding, index) => (
          // eslint-disable-next-line react/no-array-index-key -- an assessment's findings are an immutable, unindexed array with no id of their own
          <li key={index} className={styles.finding}>
            <span className={styles.findingIndex} aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className={styles.findingBody}>
              <div className={styles.findingHead}>
                <p className={styles.findingSummary}>
                  {stripGeneratorLabel(finding.summary)}
                </p>
                <span
                  className={`${styles.priority} ${PRIORITY_CLASS[finding.priority]}`}
                >
                  {finding.priority}
                </span>
              </div>
              <p className={styles.findingWhy}>
                {stripGeneratorLabel(finding.why_it_matters)}
              </p>
              <p className={styles.findingRoles}>
                Affects: {finding.affected_roles.map(humanRoleLabel).join(", ")}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** `/vfx/shots/:shotId/alignment` -- VFX Alignment A+C Decision
 * Workspace (`docs/design/briefs/VFX_ALIGNMENT_V1.md`). Target order:
 * Page/Shot context (frame) -> compact Assessment Identity -> Alignment
 * Signal -> Department Execution Strip -> Current Assessment + Context
 * Inspector -> Human Attention / Human Action -> Assessment History.
 * Replaces the previous Production-Evidence/Agent-Interpretation/
 * Human-Decision long-report layering the brief explicitly retires
 * (§3) -- the Production Facts/AI Proposal/Human Decision separation
 * itself is preserved through `AuthorityLabel`/`AuthorityBoundary`
 * (via `HumanAttentionAction`), not through that specific heading
 * pattern. A Re-anchor Proposal is only ever explained here; "Review
 * proposal" always leads to the real Intent Workspace -- this page
 * never confirms or applies a Core Anchor change itself. */
export function AlignmentWorkspacePage({
  shotId,
  data,
  anchorContext,
  unavailable,
  onExitRole,
}: {
  shotId: string;
  data: AlignmentWorkspaceData | null;
  anchorContext?: AnchorContextRead | null;
  unavailable: boolean;
  onExitRole: () => void | Promise<void>;
}) {
  const current =
    data && data.assessments.length > 0 ? data.assessments[0] : null;
  const history = data ? data.assessments.slice(1) : [];
  const reassessmentReady = Boolean(
    data?.item.generation_ready_task_id &&
    data?.item.generation_ready_version_id,
  );

  return (
    <VfxShotWorkspaceFrame
      item={data?.item ?? null}
      anchorContext={anchorContext}
      activeTab="alignment"
      unavailable={unavailable}
      onExitRole={onExitRole}
    >
      {data && (
        <>
          {current && (
            <div className={styles.assessmentIdentity}>
              <span>
                Core Anchor used:{" "}
                {revisionLabel(
                  data.revisionsById.get(current.core_anchor_revision_id),
                )}
              </span>
              <span className={styles.assessmentIdentityMeta}>
                Assessed {new Date(current.created_at).toLocaleString()}
              </span>
            </div>
          )}

          {current === null ? (
            <HumanAttentionAction
              shotId={shotId}
              item={data.item}
              current={null}
              versionsById={data.versionsById}
            />
          ) : (
            <>
              <section
                className={styles.alignmentSignal}
                aria-label="Alignment Signal"
              >
                <span className={styles.regionHeading}>
                  <Icon name="agent" size="region" />
                  Alignment Signal
                </span>
                <div className={styles.signalCanvas}>
                  <div className={styles.signalLeft}>
                    <div className={styles.signalHeader}>
                      <AuthorityLabel variant="ai-interpretation" />
                      <StatusBadge
                        status={
                          ATTENTION_BADGE_STATUS[
                            current.intent_signal.attention_level
                          ]
                        }
                        label={
                          ATTENTION_LABEL[current.intent_signal.attention_level]
                        }
                      />
                    </div>
                    {reassessmentReady && (
                      <p className={styles.staleness}>Historical assessment</p>
                    )}
                    <p className={styles.executiveSummary}>
                      {currentDiagnosisText(
                        current.assessment_output.executive_summary,
                        current.assessment_output,
                      )}
                    </p>
                  </div>
                  <div className={styles.signalRight}>
                    <span className={styles.signalRightHeading}>
                      Cross-role signal
                    </span>
                    <SignalStrip
                      items={alignmentSignalStripItems(
                        current.assessment_output,
                      )}
                    />
                  </div>
                </div>
                <p className={styles.advisoryNote}>
                  Advisory interpretation only; the VFX Supervisor decides
                  whether to create or revise a Core Anchor.
                </p>
              </section>

              <DepartmentExecutionStrip
                shotId={shotId}
                overview={data.departmentExecutionOverview}
              />

              <div className={styles.decisionWorkspace}>
                <div className={styles.assessmentArea}>
                  <h2 className={styles.regionHeading}>
                    <Icon name="review" size="region" />
                    Current Assessment
                  </h2>
                  {(() => {
                    const output = current.assessment_output;
                    const revision = data.revisionsById.get(
                      current.core_anchor_revision_id,
                    );
                    const driftRisks = revision?.drift_risks ?? [];
                    const decisionRelevant = decisionRelevantFindings(output);

                    return (
                      <>
                        <div className={styles.decisionRelevant}>
                          <h3 className={styles.decisionRelevantTitle}>
                            Most decision-relevant findings
                          </h3>
                          {decisionRelevant.length > 0 ? (
                            <ol className={styles.previewList}>
                              {decisionRelevant.map((finding, index) => (
                                // eslint-disable-next-line react/no-array-index-key -- an assessment's findings are an immutable, unindexed array with no id of their own
                                <li key={index} className={styles.previewItem}>
                                  <span
                                    className={styles.previewIndexFocus}
                                    aria-hidden="true"
                                  >
                                    {String(index + 1).padStart(2, "0")}
                                  </span>
                                  <div className={styles.previewHead}>
                                    <p className={styles.previewSummary}>
                                      {stripGeneratorLabel(finding.summary)}
                                    </p>
                                    <span
                                      className={`${styles.priority} ${PRIORITY_CLASS[finding.priority]}`}
                                    >
                                      {finding.priority}
                                    </span>
                                  </div>
                                </li>
                              ))}
                            </ol>
                          ) : (
                            <p className={styles.previewEmpty}>
                              No attention-relevant findings in this assessment.
                            </p>
                          )}
                        </div>

                        <details className={styles.disclosure}>
                          <summary className={styles.disclosureSummary}>
                            <span className={styles.disclosureLabelClosed}>
                              View detailed assessment →
                            </span>
                            <span className={styles.disclosureLabelOpen}>
                              Collapse detailed assessment ↑
                            </span>
                          </summary>
                          <div className={styles.disclosureContent}>
                            <FindingGroup
                              title="Aligned findings"
                              findings={output.agreements}
                            />
                            <FindingGroup
                              title="Cross-role tensions"
                              findings={output.cross_role_tensions}
                            />
                            <FindingGroup
                              title="Local-optimum risks"
                              findings={output.local_optimum_risks}
                            />
                            <FindingGroup
                              title="Open questions"
                              findings={output.unresolved_dependencies}
                            />
                            <FindingGroup
                              title="Advisory recommendations"
                              findings={output.human_coordination_priorities}
                            />
                            {driftRisks.length > 0 && (
                              <section className={styles.findingGroup}>
                                <h3 className={styles.findingGroupTitle}>
                                  Drift risks on the active Core Anchor (
                                  {driftRisks.length})
                                </h3>
                                <ul className={styles.plainList}>
                                  {driftRisks.map((risk) => (
                                    <li key={risk.id}>{risk.description}</li>
                                  ))}
                                </ul>
                              </section>
                            )}
                          </div>
                        </details>
                      </>
                    );
                  })()}
                </div>

                <div className={styles.contextInspector}>
                  <h2 className={styles.regionHeading}>
                    <Icon name="evidence" size="region" />
                    Context
                  </h2>
                  <div className={styles.inspectorGroup}>
                    <h3 className={styles.inspectorGroupTitle}>Core Intent</h3>
                    <p className={styles.inspectorText}>
                      {revisionLabel(
                        data.revisionsById.get(current.core_anchor_revision_id),
                      )}
                    </p>
                  </div>
                  <div className={styles.inspectorGroup}>
                    <h3 className={styles.inspectorGroupTitle}>
                      Current Production Context
                    </h3>
                    <MetadataRow
                      items={[
                        {
                          label: "Assessed Version",
                          value: versionLabel(
                            data.versionsById.get(current.version_id),
                          ),
                        },
                        {
                          label: "Task",
                          value:
                            data.item.relevant_task_name ??
                            "No Task recorded yet",
                        },
                      ]}
                    />
                  </div>
                  <div className={styles.inspectorGroup}>
                    <h3 className={styles.inspectorGroupTitle}>
                      Evidence and provenance
                    </h3>
                    {(() => {
                      const evidence: EvidenceReferenceLike[] =
                        current.assessment_output.shared_intent_read.evidence.map(
                          (item, index) => ({
                            source_type: item.source_type,
                            source_id: item.source_id,
                            label: `Assessment evidence ${index + 1}`,
                          }),
                        );
                      if (
                        data.currentRun ||
                        data.currentSnapshot ||
                        evidence.length > 0
                      ) {
                        return (
                          <EvidenceProvenanceDrawer
                            evidence={evidence}
                            run={data.currentRun ?? null}
                            snapshot={data.currentSnapshot ?? null}
                          />
                        );
                      }
                      return (
                        <p className={styles.empty}>
                          Detailed Agent provenance is unavailable for this
                          output.
                        </p>
                      );
                    })()}
                  </div>
                </div>
              </div>

              <HumanAttentionAction
                shotId={shotId}
                item={data.item}
                current={current}
                versionsById={data.versionsById}
              />

              {history.length > 0 && (
                <section className={styles.historySection}>
                  <h2 className={styles.historySectionTitle}>
                    <Icon name="history" size="standard" />
                    Assessment history
                  </h2>
                  <ul className={styles.historyList}>
                    {history.map((assessment) => (
                      <li key={assessment.id} className={styles.historyItem}>
                        <span className={styles.historyTime}>
                          {new Date(assessment.created_at).toLocaleString()}
                        </span>
                        <span className={styles.historySummary}>
                          {historySummaryText(assessment, data.versionsById)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </>
      )}
    </VfxShotWorkspaceFrame>
  );
}
