import Link from "next/link";
import type {
  AnchorContextRead,
  ArtistFeedbackTranslation,
  ArtistGuidanceItem,
} from "@intent-core/contracts";

import {
  AuthorityLabel,
  EmptyState,
  FtrackLinkageBadge,
  Icon,
  MetadataRow,
  VersionMediaPanel,
  stripGeneratorLabel,
} from "@/design";
import { getAuthorDisplayText } from "@/lib/authorProvenance";
import type { CurrentVersionData } from "@/features/artist/current-version/data";
import { ArtistTaskWorkspaceFrame } from "../ArtistTaskWorkspaceFrame";
import { GenerateArtistGuidanceButton } from "../GenerateArtistGuidanceButton";
import { PublishResolvedVersionButton } from "./PublishResolvedVersionButton";
import styles from "./CurrentVersionPage.module.css";

/** Work archetype correction: replaces the previous SignalStrip
 * (an analytical "Feedback translations: 0 / Iteration priorities: 2"
 * count instrument, wrong for this archetype -- the Artist needs to
 * know WHAT the priorities are, not how many exist) with a short,
 * always-grammatical takeaway derived only from real already-loaded
 * fields: the real `task_goal` guidance item (the Agent's own read of
 * what this iteration should achieve) plus the real count of
 * structured actionable rows available below. Never CSS-clamps the
 * long raw `executive_summary` -- that field is not used here at all;
 * the full real guidance stays represented by the structured rows
 * themselves (`IterationPriorityGroup`/`FeedbackTranslationGroup`),
 * not by a hidden disclosure. */
/** Owner-reported bug fix: the real `task_goal.summary` is not always
 * terminated with sentence-ending punctuation -- the D1 Golden
 * Journey's R2+ combined-intensity-boundary override, in particular,
 * can be cut off mid-sentence by the backend's own bounded-length
 * truncation (e.g. "...coordinated against Animation and Lighting's
 * current confirmed"). Concatenating the count clause directly onto
 * that with only a space produced a run-on ("...confirmed 2
 * actionable items are ready to review below."). This never
 * truncates further or rewrites the real summary text: if it already
 * ends in `.`/`!`/`?`, it is used as-is; otherwise an ellipsis is
 * appended to honestly signal the real text continues/was cut off,
 * before the count clause starts as its own separate sentence. */
function ensureSentenceEnd(text: string): string {
  const trimmed = text.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}…`;
}

function buildGuidanceTakeaway(
  output: NonNullable<CurrentVersionData["currentGuidance"]>["guidance_output"],
): string {
  const goal = ensureSentenceEnd(stripGeneratorLabel(output.task_goal.summary));
  const actionableCount =
    output.iteration_priorities.length + output.feedback_translations.length;
  const actionableClause =
    actionableCount === 0
      ? "No specific iteration priorities or translated feedback are recorded yet."
      : `${actionableCount} actionable item${actionableCount === 1 ? "" : "s"} ${actionableCount === 1 ? "is" : "are"} ready to review below.`;
  return `${goal} ${actionableClause}`;
}

const PRIORITY_CLASS: Record<
  ArtistGuidanceItem["priority"] | ArtistFeedbackTranslation["priority"],
  string
> = {
  low: "",
  medium: styles.priorityMedium,
  high: styles.priorityHigh,
};

/** Work archetype correction: real structured guidance content as
 * numbered actionable rows -- the same neutral index-box grammar
 * already validated on VFX Alignment's Detailed Assessment findings
 * -- instead of a bare count. Renders nothing when the real array is
 * empty (never an empty count instrument). */
function IterationPriorityGroup({ items }: { items: ArtistGuidanceItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className={styles.findingGroup}>
      <h4 className={styles.subheading}>
        Iteration priorities ({items.length})
      </h4>
      <ul className={styles.findingList}>
        {items.map((item, index) => (
          // eslint-disable-next-line react/no-array-index-key -- an immutable, unindexed array with no id of their own
          <li key={index} className={styles.finding}>
            <span className={styles.findingIndex} aria-hidden="true">
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
                {stripGeneratorLabel(item.why_it_matters)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Same real object (`ArtistFeedbackTranslation`), a different real
 * shape: `practical_action` is the translated, actionable instruction
 * itself (the row's primary line); `underlying_intent` is the real
 * supporting explanation for why that action matters. */
function FeedbackTranslationGroup({
  items,
}: {
  items: ArtistFeedbackTranslation[];
}) {
  if (items.length === 0) return null;
  return (
    <section className={styles.findingGroup}>
      <h4 className={styles.subheading}>
        Feedback translations ({items.length})
      </h4>
      <ul className={styles.findingList}>
        {items.map((item, index) => (
          // eslint-disable-next-line react/no-array-index-key -- an immutable, unindexed array with no id of their own
          <li key={index} className={styles.finding}>
            <span className={styles.findingIndex} aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className={styles.findingBody}>
              <div className={styles.findingHead}>
                <p className={styles.findingSummary}>
                  {stripGeneratorLabel(item.practical_action)}
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

/** `/artist/tasks/:taskId/current-version` (Step 7C-5; Work archetype
 * visual-language pass) -- the latest work Version and the feedback
 * that applies to it. Locked order: production-context header ->
 * contextual tabs -> [Production Versions list] [Current Version].
 * Artist-facing: no review/escalation actions, only the real
 * guidance-generation and Version-publish actions that already exist.
 * The Task's associated Production Versions are its Shot's Versions --
 * see `features/artist/current-version/data.ts`'s doc comment. Never
 * confuses a Production Version with an Anchor Revision -- these stay
 * distinct sections. Selecting a different Version navigates via
 * `?version=`, since Review Notes/guidance are only loaded for the
 * selected Version, not every Version up front.
 *
 * Visual-language pass: retires the previous Production-Evidence/
 * Agent-Interpretation/Human-Decision heading layering
 * (`EvidenceLayerSection`) and the full-report `AgentContributionPanel`,
 * the same way CG Version Review and VFX Alignment already did -- the
 * Production Facts/AI Proposal/Human Decision separation itself is
 * preserved through region structure and `AuthorityLabel`, not that
 * specific heading pattern. The former "Human Decision and Provenance"
 * section (a bare "Confirmed under {role} authority" / "not exposed in
 * the Artist role view" restatement of Core/Execution Anchor state) is
 * dropped entirely rather than restyled: `ArtistTaskWorkspaceFrame`
 * already renders the shared `AnchorContextLayer` above every tab,
 * including this one, and its Artist-role branch already states the
 * same real Core/Execution Anchor identity and state -- concisely, and
 * as the one persistent guardrail rather than a second, page-local
 * copy. Artist still never sees Decision actor/rationale/timestamp
 * detail or any confirm/reject/edit control -- that boundary was never
 * carried by the removed section itself.
 *
 * Work archetype correction (owner review pass): the page previously
 * still read as an analysis surface -- an analytical SignalStrip on
 * Artist guidance, a hero-weight executive summary, a strong-purple
 * Regenerate action, and near-equal visual weight between the Version
 * selector and the Current Version object it selects. Corrected so the
 * reading order is unambiguous: Current Version (primary object) ->
 * Supervisor feedback (Human, outranks Agent) -> Artist guidance
 * (concise advisory takeaway + real structured priority/translation
 * rows + a now-neutral/advisory Regenerate action) -> quiet Related
 * context. No domain logic, route, or permission boundary changed. */
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
                {/* Work archetype correction: a secondary switcher, not
                 * a second strongly-weighted object display -- a
                 * standard-size icon (not the region-size icon Current
                 * Version's own heading uses below) keeps this
                 * visually quieter, matching its role as navigation
                 * into the primary work object rather than a second
                 * copy of it. */}
                <h2 className={styles.regionHeadingSecondary}>
                  <Icon name="version" size="standard" />
                  Production Versions
                </h2>
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
                        <span
                          className={`${styles.iconTile} ${styles.iconTileSmall}`}
                          aria-hidden="true"
                        >
                          <Icon name="version" size="standard" />
                        </span>
                        <span className={styles.rowBody}>
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
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>

              <div className={styles.detailColumn}>
                {data.selectedVersion && (
                  <>
                    {/* Current Version -- the primary work object. A
                     * raised object surface (matching the same
                     * treatment CG Version Review uses for its own
                     * selected Version), distinct from the working
                     * regions below it. */}
                    <section
                      className={styles.currentVersionSurface}
                      aria-label="Current Version"
                    >
                      <h2 className={styles.regionHeading}>
                        <Icon name="version" size="region" />
                        Current Version
                      </h2>
                      <div className={styles.versionObjectRow}>
                        <span
                          className={`${styles.iconTile} ${styles.iconTileLarge}`}
                          aria-hidden="true"
                        >
                          <Icon name="version" size="region" />
                        </span>
                        <div className={styles.versionObjectBody}>
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
                        </div>
                      </div>
                      <VersionMediaPanel media={data.media} />
                    </section>

                    {/* Feedback -- Human Supervisor input, the
                     * actionable work input this Version must respond
                     * to. Reuses the same Review Note object grammar
                     * already validated in CG Version Review (icon
                     * tile + content + author/timestamp) -- the same
                     * real `ReviewNoteRead` object, never called an
                     * "Agent finding". Ordered, and visually
                     * outranking, Agent guidance below it. */}
                    <section
                      className={styles.section}
                      aria-label="Supervisor feedback"
                    >
                      <h2 className={styles.regionHeading}>
                        <Icon name="review-note" size="region" />
                        Supervisor feedback
                      </h2>
                      {data.reviewNotes.length === 0 ? (
                        <p className={styles.empty}>
                          No Review Notes have been recorded for this Production
                          Version yet.
                        </p>
                      ) : (
                        <ul className={styles.noteList}>
                          {data.reviewNotes.map((note) => (
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
                                  {new Date(note.created_at).toLocaleString()}
                                </p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>

                    {/* Artist guidance -- advisory, steel/cool identity,
                     * never purple, and never a hero. A concise
                     * work-relevant takeaway (not the long raw
                     * executive_summary) followed by the real
                     * structured guidance rows -- that is the "full
                     * guidance" representation now, not a Signal
                     * Strip. Historical guidance and the generation
                     * action live in the same region since both are
                     * about the same real object. */}
                    <section
                      className={styles.section}
                      aria-label="Artist guidance"
                    >
                      <h2 className={styles.regionHeading}>
                        <Icon name="agent" size="region" />
                        Artist guidance
                      </h2>
                      <AuthorityLabel variant="ai-interpretation" />
                      {data.currentGuidance ? (
                        <>
                          <p className={styles.guidanceTakeaway}>
                            {buildGuidanceTakeaway(
                              data.currentGuidance.guidance_output,
                            )}
                          </p>
                          <IterationPriorityGroup
                            items={
                              data.currentGuidance.guidance_output
                                .iteration_priorities
                            }
                          />
                          <FeedbackTranslationGroup
                            items={
                              data.currentGuidance.guidance_output
                                .feedback_translations
                            }
                          />
                        </>
                      ) : (
                        <p className={styles.empty}>
                          {data.executionAnchorRevision
                            ? `No current Artist guidance has been generated for Execution Anchor R${data.executionAnchorRevision.revision_number} yet.`
                            : "No Artist guidance has been generated for this Version yet."}
                        </p>
                      )}
                      {data.guidancesWithProvenance.some(
                        (entry) => !entry.isCurrent,
                      ) && (
                        <div className={styles.historicalGuidance}>
                          <h4 className={styles.subheading}>
                            Historical guidance
                          </h4>
                          <ul className={styles.noteList}>
                            {data.guidancesWithProvenance
                              .filter((entry) => !entry.isCurrent)
                              .map((entry) => (
                                <li
                                  key={entry.guidance.id}
                                  className={styles.note}
                                >
                                  <span className={styles.historicalLabel}>
                                    Historical
                                  </span>
                                  <p className={styles.noteMeta}>
                                    {entry.executionAnchorRevisionNumber !==
                                    null
                                      ? `Execution Anchor R${entry.executionAnchorRevisionNumber}`
                                      : "Execution Anchor revision unavailable"}{" "}
                                    ·{" "}
                                    {new Date(
                                      entry.guidance.created_at,
                                    ).toLocaleString()}
                                  </p>
                                  <p className={styles.noteContent}>
                                    {stripGeneratorLabel(
                                      entry.guidance.guidance_output
                                        .executive_summary,
                                    )}
                                  </p>
                                </li>
                              ))}
                          </ul>
                        </div>
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
                            : ["Execution Anchor confirmation is required."]),
                        ]}
                        label={
                          data.currentGuidance
                            ? "Regenerate guidance"
                            : "Generate guidance"
                        }
                      />
                      <p className={styles.advisoryNote}>
                        Advisory execution guidance; the Artist may act within
                        the confirmed boundaries, but cannot edit or confirm
                        either Anchor or approve the Version.
                      </p>
                    </section>

                    {/* Related context -- real counts only, no
                     * dashboard signal matrix, quiet secondary
                     * treatment. Full detail on each event already
                     * lives in Feedback History, reachable from the
                     * tab above; no second link is added here since
                     * that destination is already one click away. */}
                    <div className={styles.secondaryContext}>
                      <span className={styles.secondaryContextLabel}>
                        Related context
                      </span>
                      {data.cgSupervisorReviews.length === 0 ? (
                        <p className={styles.empty}>
                          No Agent Execution Review has been generated for the
                          active Execution Anchor yet.
                        </p>
                      ) : (
                        <p className={styles.contextText}>
                          {data.cgSupervisorReviews.length} Agent{" "}
                          {data.cgSupervisorReviews.length === 1
                            ? "review"
                            : "reviews"}{" "}
                          recorded.
                        </p>
                      )}
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
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </ArtistTaskWorkspaceFrame>
  );
}
