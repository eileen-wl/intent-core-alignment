"use client";

import { useState } from "react";

import {
  AppShell,
  Breadcrumbs,
  ContextTabs,
  EmptyState,
  ErrorState,
  EvidenceLayerSection,
  FtrackLinkageBadge,
  MetadataRow,
  SectionHeader,
} from "@/design";
import { DEMO_IDENTITY_NAME, ROLE_LABEL } from "@/lib/demoIdentity";
import { ROLE_SIDEBAR_ITEMS } from "@/lib/roleNavigation";
import { getAuthorDisplayText } from "@/lib/authorProvenance";
import type { VersionReviewWorkspaceData } from "@/features/cg/version-review-workspace/data";
import { TaskContextHeader } from "../TaskContextHeader";
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
  unavailable,
  onExitRole,
}: {
  taskId: string;
  data: VersionReviewWorkspaceData | null;
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

  return (
    <AppShell
      name={DEMO_IDENTITY_NAME.cg_supervisor}
      role={ROLE_LABEL.cg_supervisor}
      onExitRole={onExitRole}
      sidebarItems={ROLE_SIDEBAR_ITEMS.cg_supervisor}
      currentPath="/cg/tasks"
    >
      {unavailable || data === null ? (
        <>
          <Breadcrumbs
            items={[
              { label: "Tasks", href: "/cg/tasks" },
              { label: "Version Review" },
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
              { label: data.item.project_name, href: "/cg/tasks" },
              { label: data.item.shot_name },
              { label: data.item.task_name },
              { label: "Version Review" },
            ]}
          />
          <TaskContextHeader item={data.item} />
          <ContextTabs
            activeTabId="version-review"
            tabs={[
              {
                id: "overview",
                label: "Overview",
                href: `/cg/tasks/${taskId}`,
              },
              {
                id: "execution",
                label: "Execution",
                href: `/cg/tasks/${taskId}/execution`,
              },
              {
                id: "version-review",
                label: "Version Review",
                href: `/cg/tasks/${taskId}/version-review`,
              },
              {
                id: "dependencies",
                label: "Dependencies",
                href: `/cg/tasks/${taskId}/dependencies`,
              },
              {
                id: "activity",
                label: "Activity",
                href: `/cg/tasks/${taskId}/activity`,
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
                            Active Core Anchor (read-only)
                          </h4>
                          <p className={styles.contextText}>
                            {data.coreAnchorSummary ??
                              "No Core Anchor is confirmed for this Shot yet."}
                          </p>
                        </section>

                        <section className={styles.section}>
                          <h4 className={styles.sectionHeading}>
                            Active Execution Anchor (read-only)
                          </h4>
                          <p className={styles.contextText}>
                            {data.activeExecutionRevision
                              ?.technical_boundaries ??
                              "No Execution Anchor is confirmed for this Task yet."}
                          </p>
                        </section>

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
                      </EvidenceLayerSection>

                      <EvidenceLayerSection kind="human-decision">
                        <p className={styles.empty}>
                          No Human Decision has been recorded for this
                          Production Version review. Escalating to VFX records a
                          Dependency, not a Decision.
                        </p>
                      </EvidenceLayerSection>

                      <section className={styles.section}>
                        <SectionHeader
                          title="Review actions"
                          description="Recording a Review Note or requesting a CG Supervisor review produces new evidence/interpretation; escalating creates a pending action -- none of these is itself a Human Decision."
                          level={3}
                        />
                        <VersionReviewActions
                          taskId={taskId}
                          versionId={selected.version.id}
                          activeExecutionRevisionId={
                            data.activeExecutionRevision?.id ?? null
                          }
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
    </AppShell>
  );
}
