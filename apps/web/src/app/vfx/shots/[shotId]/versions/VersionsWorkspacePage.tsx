"use client";

import { useState } from "react";
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
import type { VersionsWorkspaceData } from "@/features/vfx/versions-workspace/data";
import { ProductionContextHeader } from "../../ProductionContextHeader";
import styles from "./VersionsWorkspacePage.module.css";

/** `/vfx/shots/:shotId/versions` (Step 7C-3) -- the Shot's production-
 * version and review-note workspace, deliberately not Core Anchor
 * revision history. Locked order: production-context header ->
 * contextual tabs -> [Versions list] [Selected version detail]. The
 * left list is Version-led (name/number/timestamp/source/review-note
 * count -- never a Core Anchor field); the right detail panel is a
 * client-side selection, never a navigation, so switching Versions
 * never re-fetches the Shot. */
export function VersionsWorkspacePage({
  shotId,
  data,
  unavailable,
  onExitRole,
}: {
  shotId: string;
  data: VersionsWorkspaceData | null;
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
              { label: "Versions" },
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
              { label: "Versions" },
            ]}
          />
          <ProductionContextHeader item={data.item} />
          <ContextTabs
            activeTabId="versions"
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

          {data.versions.length === 0 ? (
            <EmptyState title="No Production Versions have been recorded for this Shot yet." />
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
                  Production Version details
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
                      <MetadataRow
                        items={[
                          {
                            label: "Created",
                            value: new Date(
                              selected.version.created_at,
                            ).toLocaleString(),
                          },
                          { label: "Source", value: selected.version.source },
                          {
                            label: "Recorded by",
                            value: getAuthorDisplayText(selected.version),
                          },
                        ]}
                      />
                      {selected.version.description && (
                        <p className={styles.description}>
                          {selected.version.description}
                        </p>
                      )}

                      <section className={styles.section}>
                        <h3 className={styles.sectionHeading}>Review notes</h3>
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

                      <section className={styles.section}>
                        <h3 className={styles.sectionHeading}>
                          Active Core Anchor
                        </h3>
                        <p className={styles.contextText}>
                          {data.item.active_core_anchor_summary ??
                            "No Core Anchor is confirmed for this Shot yet."}
                        </p>
                      </section>

                      <section className={styles.section}>
                        <h3 className={styles.sectionHeading}>
                          Alignment Assessment
                        </h3>
                        {(() => {
                          const assessments =
                            data.assessmentsByVersionId.get(
                              selected.version.id,
                            ) ?? [];
                          if (assessments.length === 0) {
                            return (
                              <p className={styles.empty}>
                                No Alignment Assessment has been generated for
                                this Production Version yet.
                              </p>
                            );
                          }
                          return (
                            <>
                              <p className={styles.contextText}>
                                {assessments.length} Cross-role{" "}
                                {assessments.length === 1
                                  ? "Assessment"
                                  : "Assessments"}{" "}
                                recorded for this Production Version.
                              </p>
                              <Link
                                href={`/vfx/shots/${shotId}/alignment`}
                                className={styles.alignmentLink}
                              >
                                Review in Alignment →
                              </Link>
                            </>
                          );
                        })()}
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
