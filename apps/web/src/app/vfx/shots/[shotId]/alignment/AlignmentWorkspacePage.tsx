"use client";

import Link from "next/link";
import type {
  CoreAnchorRevisionRead,
  CrossRoleFinding,
  VersionRead,
} from "@intent-core/contracts";

import {
  AppShell,
  AuthorityBoundary,
  AuthorityLabel,
  Breadcrumbs,
  ContextTabs,
  EmptyState,
  ErrorState,
  EvidenceLayerSection,
  MetadataRow,
} from "@/design";
import { DEMO_IDENTITY_NAME, ROLE_LABEL } from "@/lib/demoIdentity";
import { ROLE_SIDEBAR_ITEMS } from "@/lib/roleNavigation";
import type { AlignmentWorkspaceData } from "@/features/vfx/alignment-workspace/data";
import { ProductionContextHeader } from "../../ProductionContextHeader";
import { GenerateAssessmentButton } from "./GenerateAssessmentButton";
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
            <div className={styles.findingHead}>
              <p className={styles.findingSummary}>{finding.summary}</p>
              <span
                className={
                  finding.priority === "high"
                    ? `${styles.priority} ${styles.priorityHigh}`
                    : styles.priority
                }
              >
                {finding.priority}
              </span>
            </div>
            <p className={styles.findingWhy}>{finding.why_it_matters}</p>
            <p className={styles.findingRoles}>
              Affects: {finding.affected_roles.join(", ")}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** `/vfx/shots/:shotId/alignment` (Step 7C-3) -- whether the reviewed
 * production work aligns with the active Core Anchor, and where human
 * interpretation is required. Locked order: production-context header
 * -> contextual tabs -> compact human-authority line -> [Current
 * assessment summary] -> [Findings / tensions / risks] -> [Recommended
 * next action] -> [Assessment history]. A Re-anchor Proposal is only
 * ever explained here; "Review proposal" always leads to the real
 * Intent Workspace -- this page never confirms or applies a Core
 * Anchor change itself. */
export function AlignmentWorkspacePage({
  shotId,
  data,
  unavailable,
  onExitRole,
}: {
  shotId: string;
  data: AlignmentWorkspaceData | null;
  unavailable: boolean;
  onExitRole: () => void | Promise<void>;
}) {
  const current =
    data && data.assessments.length > 0 ? data.assessments[0] : null;
  const history = data ? data.assessments.slice(1) : [];

  return (
    <AppShell
      name={DEMO_IDENTITY_NAME.vfx_supervisor}
      role={ROLE_LABEL.vfx_supervisor}
      onExitRole={onExitRole}
      sidebarItems={ROLE_SIDEBAR_ITEMS.vfx_supervisor}
      currentPath="/vfx/shots"
    >
      {unavailable || data === null ? (
        <>
          <Breadcrumbs
            items={[
              { label: "Shots", href: "/vfx/shots" },
              { label: "Alignment" },
            ]}
          />
          <ErrorState
            title={
              unavailable
                ? "This Shot is unavailable"
                : "This Shot could not be found"
            }
            description={
              unavailable
                ? "The ICAS service could not be reached. Try refreshing the page."
                : "This Shot does not exist, or its identifier is invalid."
            }
          />
        </>
      ) : (
        <>
          <Breadcrumbs
            items={[
              { label: data.item.project_name, href: "/vfx/shots" },
              { label: data.item.shot_name },
              { label: "Alignment" },
            ]}
          />
          <ProductionContextHeader item={data.item} />
          <ContextTabs
            activeTabId="alignment"
            tabs={[
              {
                id: "overview",
                label: "Overview",
                href: `/vfx/shots/${shotId}`,
              },
              {
                id: "intent",
                label: "Intent",
                href: `/vfx/shots/${shotId}/intent`,
              },
              {
                id: "versions",
                label: "Versions",
                href: `/vfx/shots/${shotId}/versions`,
              },
              {
                id: "alignment",
                label: "Alignment",
                href: `/vfx/shots/${shotId}/alignment`,
              },
              {
                id: "activity",
                label: "Activity",
                href: `/vfx/shots/${shotId}/activity`,
              },
            ]}
          />

          <div className={styles.authorityLine}>
            <AuthorityBoundary
              tone="human"
              label={<AuthorityLabel variant="human-intent" />}
              ownerLabel="The Human VFX Supervisor"
              statement="owns interpretation and confirmation of alignment findings. The Core Agent's cross-role assessment is advisory only."
            />
          </div>

          {current === null ? (
            data.item.generation_ready_task_id &&
            data.item.generation_ready_version_id ? (
              <EmptyState
                title="A new Cross-role Assessment can be generated for this Shot"
                description={`Role outputs from the VFX Supervisor, CG Supervisor, and Artist Agent are all available for ${versionLabel(
                  data.versionsById.get(data.item.generation_ready_version_id),
                )} -- a Cross-role Assessment can now be generated.`}
                action={
                  <GenerateAssessmentButton
                    shotId={shotId}
                    taskId={data.item.generation_ready_task_id}
                    versionId={data.item.generation_ready_version_id}
                  />
                }
              />
            ) : (
              <EmptyState title="No Alignment Assessment has been recorded for this Shot yet." />
            )
          ) : (
            <>
              <EvidenceLayerSection kind="production-evidence">
                <MetadataRow
                  items={[
                    {
                      label: "Assessed Version",
                      value: versionLabel(
                        data.versionsById.get(current.version_id),
                      ),
                    },
                    {
                      label: "Core Anchor used",
                      value: revisionLabel(
                        data.revisionsById.get(current.core_anchor_revision_id),
                      ),
                    },
                  ]}
                />
              </EvidenceLayerSection>

              <EvidenceLayerSection kind="agent-interpretation">
                <section className={styles.summaryCard}>
                  <div className={styles.summaryHeader}>
                    <AuthorityLabel variant="ai-interpretation" />
                  </div>
                  <p className={styles.executiveSummary}>
                    {current.assessment_output.executive_summary}
                  </p>
                  <MetadataRow
                    items={[
                      {
                        label: "Assessed at",
                        value: new Date(current.created_at).toLocaleString(),
                      },
                      {
                        label: "Assessor",
                        value: "Core Agent · cross-role assessment",
                      },
                    ]}
                  />
                </section>

                <section className={styles.findingsSection}>
                  <h2 className={styles.sectionTitle}>Findings</h2>
                  <FindingGroup
                    title="Aligned findings"
                    findings={current.assessment_output.agreements}
                  />
                  <FindingGroup
                    title="Cross-role tensions"
                    findings={current.assessment_output.cross_role_tensions}
                  />
                  <FindingGroup
                    title="Local-optimum risks"
                    findings={current.assessment_output.local_optimum_risks}
                  />
                  <FindingGroup
                    title="Open questions"
                    findings={current.assessment_output.unresolved_dependencies}
                  />
                  <FindingGroup
                    title="Advisory recommendations"
                    findings={
                      current.assessment_output.human_coordination_priorities
                    }
                  />

                  {(() => {
                    const revision = data.revisionsById.get(
                      current.core_anchor_revision_id,
                    );
                    const driftRisks = revision?.drift_risks ?? [];
                    if (driftRisks.length === 0) return null;
                    return (
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
                    );
                  })()}
                </section>

                <section className={styles.nextActionSection}>
                  <h2 className={styles.sectionTitle}>
                    Recommended next action
                  </h2>
                  {current.intent_signal.attention_level !== "low" && (
                    <AuthorityLabel variant="human-review-required" />
                  )}
                  <p className={styles.nextActionText}>
                    {current.intent_signal.signal_output.summary}
                  </p>
                  <p className={styles.nextActionMeta} role="status">
                    {current.intent_signal.attention_level === "low"
                      ? "No human review is required based on this assessment."
                      : "Human review is required -- the VFX Supervisor should interpret these findings."}
                  </p>

                  {current.re_anchor_proposal ? (
                    <div className={styles.proposalCard}>
                      <AuthorityLabel variant="ai-proposal" />
                      <p className={styles.proposalReason}>
                        {
                          current.re_anchor_proposal.proposal_output
                            .reason_for_consideration
                        }
                      </p>
                      <Link
                        href={`/vfx/shots/${shotId}/intent`}
                        className={styles.reviewProposalLink}
                      >
                        Review proposal →
                      </Link>
                    </div>
                  ) : (
                    <p className={styles.empty}>
                      No Re-anchor Proposal exists for the current assessment.
                    </p>
                  )}
                </section>

                {history.length > 0 && (
                  <section className={styles.historySection}>
                    <h2 className={styles.sectionTitle}>Assessment history</h2>
                    <ul className={styles.historyList}>
                      {history.map((assessment) => (
                        <li key={assessment.id} className={styles.historyItem}>
                          <span className={styles.historyTime}>
                            {new Date(assessment.created_at).toLocaleString()}
                          </span>
                          <span className={styles.historySummary}>
                            {assessment.assessment_output.executive_summary}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </EvidenceLayerSection>

              <EvidenceLayerSection kind="human-decision">
                <p className={styles.empty}>
                  No Human Decision has been recorded directly against this
                  assessment. A Re-anchor Proposal, if accepted, is confirmed or
                  rejected as a new Core Anchor revision on the{" "}
                  <Link href={`/vfx/shots/${shotId}/intent`}>Intent page</Link>.
                </p>
              </EvidenceLayerSection>
            </>
          )}
        </>
      )}
    </AppShell>
  );
}
