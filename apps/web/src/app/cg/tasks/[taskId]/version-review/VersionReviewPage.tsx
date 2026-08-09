"use client";

import { useState } from "react";
import type { AnchorContextRead } from "@intent-core/contracts";

import {
  EmptyState,
  AgentContributionPanel,
  EvidenceLayerSection,
  FtrackLinkageBadge,
  MetadataRow,
  SectionHeader,
  VersionMediaResolver,
} from "@/design";
import { getAuthorDisplayText } from "@/lib/authorProvenance";
import type { VersionReviewWorkspaceData } from "@/features/cg/version-review-workspace/data";
import { resolveVersionMediaAction } from "@/features/cg/actions";
import { CgTaskWorkspaceFrame } from "../CgTaskWorkspaceFrame";
import { VersionReviewActions } from "./VersionReviewActions";
import styles from "./VersionReviewPage.module.css";

/** `/cg/tasks/:taskId/version-review` (Step 7C-4) -- whether a
 * Production Version satisfies the active Core Anchor and confirmed
 * Execution Anchor. Locked order: production-context header ->
 * contextual tabs -> [Production Versions list] [Selected Version
 * review]. The Task's associated Versions are its Shot's Versions --
 * see `features/cg/version-review-workspace/data.ts`'s doc comment. */
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
            <div className={styles.grid}>
              <div className={styles.listColumn}>
                <h2 className={styles.columnHeading}>Production Versions</h2>
                <div className={styles.list}>
                  {data.versions.map(({ version, reviewNotes }) => {
                    const isActive = selected?.version.id === version.id;
                    return (
                      <button
                        key={version.id}
                        type="button"
                        className={
                          isActive
                            ? `${styles.row} ${styles.rowActive}`
                            : styles.row
                        }
                        aria-current={isActive || undefined}
                        onClick={() => setSelectedVersionId(version.id)}
                      >
                        <span className={styles.rowName}>
                          {version.name}
                          {version.version_number
                            ? ` (v${version.version_number})`
                            : ""}
                        </span>
                        <span className={styles.rowMeta}>
                          <FtrackLinkageBadge source={version.source} />
                          <span>
                            {new Date(version.created_at).toLocaleString()}
                          </span>
                          <span>
                            {reviewNotes.length} review{" "}
                            {reviewNotes.length === 1 ? "note" : "notes"}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className={styles.detailColumn}>
                <h2 className={styles.columnHeading}>
                  Selected Version review
                </h2>
                <div className={styles.detail}>
                  {selected && (
                    <>
                      <h3 className={styles.detailHeading}>
                        {selected.version.name}
                        {selected.version.version_number
                          ? ` (v${selected.version.version_number})`
                          : ""}
                      </h3>
                      <EvidenceLayerSection kind="production-evidence">
                        <VersionMediaResolver
                          key={selected.version.id}
                          versionId={selected.version.id}
                          resolve={(versionId) =>
                            resolveVersionMediaAction(taskId, versionId)
                          }
                        />
                        <MetadataRow
                          items={[
                            {
                              label: "Created",
                              value: new Date(
                                selected.version.created_at,
                              ).toLocaleString(),
                            },
                            {
                              label: "Source",
                              value: selected.version.source,
                            },
                            { label: "Task", value: data.item.task_name },
                            { label: "Shot", value: data.item.shot_name },
                          ]}
                        />

                        <section className={styles.section}>
                          <h4 className={styles.sectionHeading}>
                            Review notes
                          </h4>
                          {selected.reviewNotes.length === 0 ? (
                            <p className={styles.empty}>
                              No Review Notes have been recorded for this
                              Production Version yet.
                            </p>
                          ) : (
                            <ul className={styles.noteList}>
                              {selected.reviewNotes.map((note) => (
                                <li key={note.id} className={styles.note}>
                                  <p className={styles.noteContent}>
                                    {note.content}
                                  </p>
                                  <p className={styles.noteMeta}>
                                    {getAuthorDisplayText(note)} ·{" "}
                                    {new Date(note.created_at).toLocaleString()}
                                  </p>
                                </li>
                              ))}
                            </ul>
                          )}
                        </section>
                      </EvidenceLayerSection>

                      <EvidenceLayerSection kind="agent-interpretation">
                        <AgentContributionPanel
                          agent="CG Supervisor Agent"
                          capability="Execution Review"
                          state={
                            selectedCgReviews.length
                              ? "completed"
                              : data.activeExecutionRevision
                                ? "ready"
                                : "not_ready"
                          }
                          generatedAt={selectedCgReviews[0]?.created_at}
                          inputs={[
                            `Version ${selected.version.name}`,
                            data.coreAnchorSummary
                              ? "Confirmed Core Anchor"
                              : "Core Anchor missing",
                            data.activeExecutionRevision
                              ? `Execution Anchor R${data.activeExecutionRevision.revision_number}`
                              : "Execution Anchor missing",
                          ]}
                          readiness={[
                            { label: "Production Version", available: true },
                            {
                              label: "Confirmed Core Anchor",
                              available: Boolean(data.coreAnchorSummary),
                            },
                            {
                              label: "Confirmed Execution Anchor",
                              available: Boolean(data.activeExecutionRevision),
                            },
                          ]}
                          output={
                            selectedCgReviews[0] ? (
                              <>
                                <p>
                                  {
                                    selectedCgReviews[0].review_output
                                      .executive_summary
                                  }
                                </p>
                                <p>
                                  Technical concerns:{" "}
                                  {
                                    selectedCgReviews[0].review_output
                                      .technical_concerns.length
                                  }
                                </p>
                                <p>
                                  Questions for the human CG Supervisor:{" "}
                                  {
                                    selectedCgReviews[0].review_output
                                      .questions_for_human_cg_supervisor.length
                                  }
                                </p>
                              </>
                            ) : (
                              <p>
                                No Execution Review has been generated for this
                                selected Version yet.
                              </p>
                            )
                          }
                          authority="Advisory technical interpretation; it does not approve the Version or resolve a Human Decision."
                          nextAction={
                            selectedCgReviews.length
                              ? "Inspect the Agent review, then record a Review Note, dependency, or escalation if needed."
                              : data.activeExecutionRevision
                                ? "Generate Execution Review for the selected Version."
                                : "Create and confirm the Execution Anchor before generating an Execution Review."
                          }
                        />
                        <section className={styles.section}>
                          <h4 className={styles.sectionHeading}>
                            Agent Execution Reviews
                          </h4>
                          {selectedCgReviews.length === 0 ? (
                            <p className={styles.empty}>
                              No Agent Execution Review has been generated for
                              the active Execution Anchor yet.
                            </p>
                          ) : (
                            <p className={styles.contextText}>
                              {selectedCgReviews.length} Agent{" "}
                              {selectedCgReviews.length === 1
                                ? "review"
                                : "reviews"}{" "}
                              recorded.
                            </p>
                          )}
                        </section>
                      </EvidenceLayerSection>

                      <EvidenceLayerSection kind="human-decision" compact>
                        <p className={styles.empty}>
                          No Human Decision has been recorded for this
                          Production Version review. Escalating to VFX records a
                          Dependency, not a Decision.
                        </p>
                      </EvidenceLayerSection>

                      <section className={styles.section}>
                        <SectionHeader
                          title="Review actions"
                          description="Recording a Review Note or generating an Agent Execution Review produces new evidence/interpretation; escalating creates a pending action -- none of these is itself a Human Decision."
                          level={3}
                        />
                        <VersionReviewActions
                          taskId={taskId}
                          versionId={selected.version.id}
                          activeExecutionRevisionId={
                            data.activeExecutionRevision?.id ?? null
                          }
                          hasCurrentReview={data.cgSupervisorReviews.length > 0}
                        />
                      </section>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </CgTaskWorkspaceFrame>
  );
}
