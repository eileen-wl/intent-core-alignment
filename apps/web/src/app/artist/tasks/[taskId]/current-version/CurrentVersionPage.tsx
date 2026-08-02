import Link from "next/link";

import {
  AppShell,
  Breadcrumbs,
  ContextTabs,
  EmptyState,
  ErrorState,
  FtrackLinkageBadge,
  MetadataRow,
} from "@/design";
import { DEMO_IDENTITY_NAME, ROLE_LABEL } from "@/lib/demoIdentity";
import { ROLE_SIDEBAR_ITEMS } from "@/lib/roleNavigation";
import { getAuthorDisplayText } from "@/lib/authorProvenance";
import type { CurrentVersionData } from "@/features/artist/current-version/data";
import { TaskContextHeader } from "../TaskContextHeader";
import { GenerateArtistGuidanceButton } from "../GenerateArtistGuidanceButton";
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
  unavailable,
  onExitRole,
}: {
  taskId: string;
  data: CurrentVersionData | null;
  unavailable: boolean;
  onExitRole: () => void | Promise<void>;
}) {
  return (
    <AppShell
      name={DEMO_IDENTITY_NAME.artist}
      role={ROLE_LABEL.artist}
      onExitRole={onExitRole}
      sidebarItems={ROLE_SIDEBAR_ITEMS.artist}
      currentPath="/artist/tasks"
    >
      {unavailable || data === null ? (
        <>
          <Breadcrumbs
            items={[
              { label: "Tasks", href: "/artist/tasks" },
              { label: "Current Version" },
            ]}
          />
          <ErrorState
            title={
              unavailable
                ? "This Task is unavailable"
                : "This Task could not be found"
            }
            description={
              unavailable
                ? "The ICAS service could not be reached. Try refreshing the page."
                : "This Task does not exist, or its identifier is invalid."
            }
          />
        </>
      ) : (
        <>
          <Breadcrumbs
            items={[
              { label: data.item.project_name, href: "/artist/tasks" },
              { label: data.item.shot_name },
              { label: data.item.task_name },
              { label: "Current Version" },
            ]}
          />
          <TaskContextHeader item={data.item} />
          <ContextTabs
            activeTabId="current-version"
            tabs={[
              {
                id: "overview",
                label: "Task Overview",
                href: `/artist/tasks/${taskId}`,
              },
              {
                id: "current-version",
                label: "Current Version",
                href: `/artist/tasks/${taskId}/current-version`,
              },
              {
                id: "feedback-history",
                label: "Feedback History",
                href: `/artist/tasks/${taskId}/feedback-history`,
              },
            ]}
          />

          {data.versions.length === 0 ? (
            <EmptyState title="No Production Versions have been recorded for this Task yet." />
          ) : (
            <div className={styles.grid}>
              <div className={styles.listColumn}>
                <h2 className={styles.columnHeading}>Production Versions</h2>
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
                          {data.executionAnchorRevision?.technical_boundaries ??
                            "No Execution Anchor is confirmed for this Task yet."}
                        </p>
                      </section>

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
                          label={
                            data.guidances.length > 0
                              ? "Regenerate guidance"
                              : "Generate guidance"
                          }
                        />
                      </section>

                      <section className={styles.section}>
                        <h4 className={styles.sectionHeading}>Review notes</h4>
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
                            No Cross-role Assessment involves this Version yet.
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
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
