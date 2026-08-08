import Link from "next/link";
import type { AnchorContextRead } from "@intent-core/contracts";

import {
  EmptyState,
  AgentContributionPanel,
  EvidenceLayerSection,
  FtrackLinkageBadge,
  MetadataRow,
  VersionMediaPanel,
} from "@/design";
import { getAuthorDisplayText } from "@/lib/authorProvenance";
import type { CurrentVersionData } from "@/features/artist/current-version/data";
import { ArtistTaskWorkspaceFrame } from "../ArtistTaskWorkspaceFrame";
import { GenerateArtistGuidanceButton } from "../GenerateArtistGuidanceButton";
import { PublishResolvedVersionButton } from "./PublishResolvedVersionButton";
import styles from "./CurrentVersionPage.module.css";

/** `/artist/tasks/:taskId/current-version` (Step 7C-5) -- the latest
 * work Version and the feedback that applies to it. Locked order:
 * production-context header -> contextual tabs -> [Production Versions
 * list] [Selected Version]. Mirrors
 * `app/cg/tasks/[taskId]/version-review/VersionReviewPage.tsx`'s layout,
 * but Artist-facing: no review/escalation actions, only the real
 * guidance-generation action that already exists. The Task's associated
 * Production Versions are its Shot's Versions -- see
 * `features/artist/current-version/data.ts`'s doc comment. Never
 * confuses a Production Version with an Anchor Revision -- these stay
 * distinct sections. Selecting a different Version navigates via
 * `?version=`, since Review Notes/guidance are only loaded for the
 * selected Version, not every Version up front. */
export function CurrentVersionPage({
  taskId,
  data,
  anchorContext,
  unavailable,
  onExitRole,
}: {
  taskId: string;
  data: CurrentVersionData | null;
  anchorContext?: AnchorContextRead | null;
  unavailable: boolean;
  onExitRole: () => void | Promise<void>;
}) {
  return (
    <ArtistTaskWorkspaceFrame
      item={data?.item ?? null}
      anchorContext={anchorContext}
      activeTab="current-version"
      unavailable={unavailable}
      onExitRole={onExitRole}
    >
      {data && (
        <>
          {data.versions.length === 0 ? (
            <EmptyState
              title="No Production Version is available"
              description="A Production Version is required before feedback, Guidance, and cross-role assessment can refer to this Task. It must arrive from the production workflow; there is no local upload action here."
            />
          ) : (
            <div className={styles.grid}>
              <div className={styles.listColumn}>
                <h2 className={styles.columnHeading}>Production Versions</h2>
                {data.canPublishResolvedVersion &&
                  data.publishableExecutionAnchorRevision && (
                    <PublishResolvedVersionButton
                      taskId={taskId}
                      nextRevisionNumber={
                        data.publishableExecutionAnchorRevision.revision_number
                      }
                    />
                  )}
                <div className={styles.list}>
                  {data.versions.map((version) => {
                    const isActive = data.selectedVersion?.id === version.id;
                    return (
                      <Link
                        key={version.id}
                        href={`/artist/tasks/${taskId}/current-version?version=${version.id}`}
                        className={
                          isActive
                            ? `${styles.row} ${styles.rowActive}`
                            : styles.row
                        }
                        aria-current={isActive || undefined}
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
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>

              <div className={styles.detailColumn}>
                <h2 className={styles.columnHeading}>Selected Version</h2>
                <div className={styles.detail}>
                  {data.selectedVersion && (
                    <>
                      <h3 className={styles.detailHeading}>
                        {data.selectedVersion.name}
                        {data.selectedVersion.version_number
                          ? ` (v${data.selectedVersion.version_number})`
                          : ""}
                      </h3>
                      <EvidenceLayerSection kind="production-evidence">
                        <VersionMediaPanel media={data.media} />
                        <MetadataRow
                          items={[
                            {
                              label: "Created",
                              value: `${new Date(data.selectedVersion.created_at).toLocaleString()} · ${getAuthorDisplayText(
                                data.selectedVersion,
                              )}`,
                            },
                            {
                              label: "Source",
                              value: data.selectedVersion.source,
                            },
                            { label: "Task", value: data.item.task_name },
                            { label: "Shot", value: data.item.shot_name },
                          ]}
                        />

                        <section className={styles.section}>
                          <h4 className={styles.sectionHeading}>
                            Active Core Anchor (read-only)
                          </h4>
                          <p className={styles.contextText}>
                            {data.coreAnchorRevision?.core_summary ??
                              "No Core Anchor is confirmed for this Shot yet."}
                          </p>
                        </section>

                        <section className={styles.section}>
                          <h4 className={styles.sectionHeading}>
                            Active Execution Anchor (read-only)
                          </h4>
                          <p className={styles.contextText}>
                            {data.executionAnchorRevision
                              ?.technical_boundaries ??
                              "No Execution Anchor is confirmed for this Task yet."}
                          </p>
                        </section>

                        <section className={styles.section}>
                          <h4 className={styles.sectionHeading}>
                            Review notes
                          </h4>
                          {data.reviewNotes.length === 0 ? (
                            <p className={styles.empty}>
                              No Review Notes have been recorded for this
                              Production Version yet.
                            </p>
                          ) : (
                            <ul className={styles.noteList}>
                              {data.reviewNotes.map((note) => (
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
                          agent="Artist Agent"
                          capability="Iteration Guidance"
                          state={
                            data.guidances.length
                              ? "completed"
                              : data.coreAnchorRevision &&
                                  data.executionAnchorRevision
                                ? "ready"
                                : "not_ready"
                          }
                          generatedAt={data.guidances[0]?.created_at}
                          inputs={[
                            `Version ${data.selectedVersion.name}`,
                            data.coreAnchorRevision
                              ? `Core Anchor R${data.coreAnchorRevision.revision_number}`
                              : "Core Anchor missing",
                            data.executionAnchorRevision
                              ? `Execution Anchor R${data.executionAnchorRevision.revision_number}`
                              : "Execution Anchor missing",
                            `${data.reviewNotes.length} Review Notes`,
                          ]}
                          readiness={[
                            {
                              label: "Confirmed Core Anchor",
                              available: Boolean(data.coreAnchorRevision),
                            },
                            {
                              label: "Confirmed Execution Anchor",
                              available: Boolean(data.executionAnchorRevision),
                            },
                            {
                              label: "Current Production Version",
                              available: Boolean(data.selectedVersion),
                            },
                          ]}
                          output={
                            data.guidances[0] ? (
                              <>
                                <p>
                                  {
                                    data.guidances[0].guidance_output
                                      .executive_summary
                                  }
                                </p>
                                <p>
                                  Feedback translations:{" "}
                                  {
                                    data.guidances[0].guidance_output
                                      .feedback_translations.length
                                  }
                                </p>
                                <p>
                                  Iteration priorities:{" "}
                                  {
                                    data.guidances[0].guidance_output
                                      .iteration_priorities.length
                                  }
                                </p>
                              </>
                            ) : (
                              <p>
                                No guidance has been generated for this Version
                                yet.
                              </p>
                            )
                          }
                          authority="Advisory execution guidance; the Artist may act within the confirmed boundaries, but cannot edit or confirm either Anchor or approve the Version."
                          nextAction={
                            data.guidances.length
                              ? "Use the current guidance and escalate unresolved supervisor questions."
                              : data.coreAnchorRevision &&
                                  data.executionAnchorRevision
                                ? "Generate guidance for the current Version."
                                : "Wait for or request Core Anchor confirmation, then wait for or request Execution Anchor confirmation."
                          }
                        />
                        <section className={styles.section}>
                          <h4 className={styles.sectionHeading}>
                            Applicable Artist guidance
                          </h4>
                          {data.guidances.length === 0 ? (
                            <p className={styles.empty}>
                              No Artist guidance has been generated for this
                              Version yet.
                            </p>
                          ) : (
                            <p className={styles.contextText}>
                              {
                                data.guidances[0].guidance_output
                                  .executive_summary
                              }
                            </p>
                          )}
                          <GenerateArtistGuidanceButton
                            taskId={taskId}
                            versionId={data.selectedVersion.id}
                            disabledReasons={[
                              ...(data.coreAnchorRevision
                                ? []
                                : ["Core Anchor confirmation is required."]),
                              ...(data.executionAnchorRevision
                                ? []
                                : [
                                    "Execution Anchor confirmation is required.",
                                  ]),
                            ]}
                            label={
                              data.guidances.length > 0
                                ? "Regenerate guidance"
                                : "Generate guidance"
                            }
                          />
                        </section>

                        <section className={styles.section}>
                          <h4 className={styles.sectionHeading}>
                            CG Supervisor reviews
                          </h4>
                          {data.cgSupervisorReviews.length === 0 ? (
                            <p className={styles.empty}>
                              No CG Supervisor review has been generated for the
                              active Execution Anchor yet.
                            </p>
                          ) : (
                            <p className={styles.contextText}>
                              {data.cgSupervisorReviews.length} CG Supervisor{" "}
                              {data.cgSupervisorReviews.length === 1
                                ? "review"
                                : "reviews"}{" "}
                              recorded.
                            </p>
                          )}
                        </section>

                        <section className={styles.section}>
                          <h4 className={styles.sectionHeading}>
                            Cross-role Assessments
                          </h4>
                          {data.crossRoleAssessments.length === 0 ? (
                            <p className={styles.empty}>
                              No Cross-role Assessment involves this Version
                              yet.
                            </p>
                          ) : (
                            <p className={styles.contextText}>
                              {data.crossRoleAssessments.length} Cross-role{" "}
                              {data.crossRoleAssessments.length === 1
                                ? "Assessment"
                                : "Assessments"}{" "}
                              recorded.
                            </p>
                          )}
                        </section>
                      </EvidenceLayerSection>

                      <EvidenceLayerSection kind="human-decision">
                        <p className={styles.contextText}>
                          Confirmed authority references
                        </p>

                        <section className={styles.section}>
                          <h4 className={styles.sectionHeading}>Core Anchor</h4>
                          {data.coreAnchorRevision ? (
                            <>
                              <p className={styles.contextText}>
                                Confirmed under VFX Supervisor authority.
                              </p>
                              <p className={styles.empty}>
                                Detailed Decision provenance is not exposed in
                                the Artist role view.
                              </p>
                            </>
                          ) : (
                            <p className={styles.contextText}>
                              No Core Anchor is confirmed for this Shot yet.
                            </p>
                          )}
                        </section>

                        <section className={styles.section}>
                          <h4 className={styles.sectionHeading}>
                            Execution Anchor
                          </h4>
                          {data.executionAnchorRevision ? (
                            <>
                              <p className={styles.contextText}>
                                Confirmed under CG Supervisor authority.
                              </p>
                              <p className={styles.empty}>
                                Detailed Decision provenance is not exposed in
                                the Artist role view.
                              </p>
                            </>
                          ) : (
                            <p className={styles.contextText}>
                              No Execution Anchor is confirmed for this Task
                              yet.
                            </p>
                          )}
                        </section>
                      </EvidenceLayerSection>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </ArtistTaskWorkspaceFrame>
  );
}
