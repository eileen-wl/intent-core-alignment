"use client";

import { useState } from "react";
import Link from "next/link";

import {
  EmptyState,
  AgentContributionPanel,
  ErrorState,
  FtrackLinkageBadge,
  MetadataRow,
  VersionMediaResolver,
} from "@/design";
import { getAuthorDisplayText } from "@/lib/authorProvenance";
import type { VersionsWorkspaceData } from "@/features/vfx/versions-workspace/data";
import { resolveVersionMediaAction } from "@/features/vfx/versions-workspace/actions";
import styles from "./VersionsWorkspacePage.module.css";
import { GenerateCreativeReviewButton } from "./GenerateCreativeReviewButton";

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
}: {
  shotId: string;
  data: VersionsWorkspaceData | null;
}) {
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    null,
  );

  const selected = data
    ? (data.versions.find((entry) => entry.version.id === selectedVersionId) ??
      data.versions[0] ??
      null)
    : null;
  const selectedVfxReviews = selected?.vfxReviews ?? [];

  if (!data) {
    return (
      <ErrorState
        title="This page is unavailable"
        description="The ICAS service could not be reached. Try refreshing the page."
      />
    );
  }

  return (
    <>
      {data.versions.length === 0 ? (
        <EmptyState
          title="No Production Version is available"
          description="A Production Version is required before Version review and cross-role assessment can run. Versions come from the production workflow; ICAS does not offer a fake local upload."
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
            <h2 className={styles.columnHeading}>Production Version details</h2>
            <div className={styles.detail}>
              {selected && (
                <>
                  <h3 className={styles.detailHeading}>
                    {selected.version.name}
                    {selected.version.version_number
                      ? ` (v${selected.version.version_number})`
                      : ""}
                  </h3>
                  <VersionMediaResolver
                    key={selected.version.id}
                    versionId={selected.version.id}
                    resolve={(versionId) =>
                      resolveVersionMediaAction(shotId, versionId)
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
                        No Review Notes have been recorded for this Production
                        Version yet.
                      </p>
                    ) : (
                      <ul className={styles.noteList}>
                        {selected.reviewNotes.map((note) => (
                          <li key={note.id} className={styles.note}>
                            <p className={styles.noteContent}>{note.content}</p>
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
                    <AgentContributionPanel
                      agent="VFX Supervisor Agent"
                      capability="Creative Review"
                      state={
                        selectedVfxReviews.length
                          ? "completed"
                          : data.item.active_core_anchor_summary
                            ? "ready"
                            : "not_ready"
                      }
                      generatedAt={selectedVfxReviews[0]?.created_at}
                      inputs={[
                        `Version ${selected.version.name}`,
                        data.item.active_core_anchor_summary
                          ? "Confirmed Core Anchor"
                          : "Core Anchor missing",
                        `${selected.reviewNotes.length} Review Notes`,
                      ]}
                      readiness={[
                        {
                          label: "Selected Production Version",
                          available: true,
                        },
                        {
                          label: "Confirmed Core Anchor",
                          available: Boolean(
                            data.item.active_core_anchor_summary,
                          ),
                        },
                      ]}
                      output={
                        selectedVfxReviews[0] ? (
                          <>
                            <p>
                              {
                                selectedVfxReviews[0].review_output
                                  .executive_summary
                              }
                            </p>
                            <p>
                              Creative concerns:{" "}
                              {
                                selectedVfxReviews[0].review_output
                                  .creative_concerns.length
                              }
                            </p>
                            <p>
                              Review priorities:{" "}
                              {
                                selectedVfxReviews[0].review_output
                                  .review_priorities.length
                              }
                            </p>
                          </>
                        ) : (
                          <p>
                            No Creative Review has been generated for this
                            selected Version yet.
                          </p>
                        )
                      }
                      authority="Advisory creative interpretation; it does not approve the Version or create a Human Decision."
                      nextAction={
                        selectedVfxReviews.length ? (
                          "Inspect the review, then record or open a human Review Note or Alignment action."
                        ) : data.item.active_core_anchor_summary ? (
                          <GenerateCreativeReviewButton
                            shotId={shotId}
                            versionId={selected.version.id}
                          />
                        ) : (
                          "Confirm a Core Anchor before generating a Creative Review."
                        )
                      }
                    />
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
                        data.assessmentsByVersionId.get(selected.version.id) ??
                        [];
                      if (assessments.length === 0) {
                        return (
                          <p className={styles.empty}>
                            No Alignment Assessment has been generated for this
                            Production Version yet.
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
  );
}
