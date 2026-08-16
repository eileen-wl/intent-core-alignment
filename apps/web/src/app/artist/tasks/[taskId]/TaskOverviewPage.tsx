import Link from "next/link";
import type { AnchorContextRead } from "@intent-core/contracts";

import {
  AuthorityLabel,
  DetailedContext,
  Divider,
  ErrorState,
  Panel,
  SectionHeader,
  StatusBadge,
  stripGeneratorLabel,
  WorkingDirectionSection,
} from "@/design";
import type { TaskOverviewData } from "@/features/artist/task-overview/data";
import { guidanceStateLabel, versionDisplayText } from "../../artistWording";
import { GenerateArtistGuidanceButton } from "./GenerateArtistGuidanceButton";
import { TaskCurrentFocusPanel } from "./TaskCurrentFocusPanel";
import styles from "./TaskOverviewPage.module.css";

/** One Guidance category, a continuous reading block (never a card) --
 * summary-only rows (never `why_it_matters`/`priority`, which Current
 * Version's own structured finding rows already own; recomposing this
 * page's existing content, not pulling in more of the schema). Every
 * real summary is passed through `stripGeneratorLabel` (the same
 * proven helper `AnchorContextLayer`/Current Version already use) so
 * an internal prefix like "[Artist deterministic]" never reaches the
 * page -- the real semantic guidance text is never altered otherwise.
 * Renders an honest empty sentence rather than hiding the category,
 * since a reader comparing categories needs to see "none identified"
 * as its own real fact. */
function GuidanceGroup({
  heading,
  items,
  emptyText,
}: {
  heading: string;
  items: { summary: string }[];
  emptyText: string;
}) {
  return (
    <div className={styles.guidanceGroup}>
      <h4 className={styles.guidanceGroupHeading}>{heading}</h4>
      {items.length === 0 ? (
        <p className={styles.guidanceEmpty}>{emptyText}</p>
      ) : (
        <ul className={styles.guidanceList}>
          {items.map((it, index) => (
            // eslint-disable-next-line react/no-array-index-key -- an immutable, unindexed array with no id of their own
            <li key={index} className={styles.guidanceListItem}>
              {stripGeneratorLabel(it.summary)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Risks and escalation combines two real, differently-shaped arrays
 * (structured cross-department dependencies, plain-string questions
 * for the Human Supervisor) into one category -- same combination the
 * page already made before this pass, unchanged here. Same
 * `stripGeneratorLabel` treatment as `GuidanceGroup`. */
function GuidanceRisksGroup({
  dependencies,
  questions,
}: {
  dependencies: { summary: string }[];
  questions: string[];
}) {
  const hasContent = dependencies.length > 0 || questions.length > 0;
  return (
    <div className={styles.guidanceGroup}>
      <h4 className={styles.guidanceGroupHeading}>
        Risks and when to escalate
      </h4>
      {!hasContent ? (
        <p className={styles.guidanceEmpty}>
          No risks or escalation conditions were identified.
        </p>
      ) : (
        <ul className={styles.guidanceList}>
          {dependencies.map((it, index) => (
            // eslint-disable-next-line react/no-array-index-key -- an immutable, unindexed array with no id of their own
            <li key={`dep-${index}`} className={styles.guidanceListItem}>
              {stripGeneratorLabel(it.summary)}
            </li>
          ))}
          {questions.map((q, index) => (
            // eslint-disable-next-line react/no-array-index-key -- an immutable, unindexed array with no id of their own
            <li key={`q-${index}`} className={styles.guidanceListItem}>
              {stripGeneratorLabel(q)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** `/artist/tasks/:taskId` -- the real Task Overview (Step 7C-5),
 * mirroring `app/cg/tasks/[taskId]/TaskOverviewPage.tsx`'s locked order:
 * production-context header -> contextual tabs -> exactly one Current
 * focus -> WHY (Core Anchor, read-only) -> HOW (Execution Anchor,
 * read-only) -> WHAT TO DO NOW (Artist guidance) -> blockers / latest
 * Version / latest feedback. Both Anchors are read-only here -- the
 * Artist can never edit or confirm either from this workspace, and no
 * edit/confirm control is reachable from this page.
 *
 * Visual-language pass: the Guidance panel recomposes the same four
 * real categories (non-negotiables, allowed variation, iteration
 * priorities, risks/escalation) that were previously four equally-
 * heavy stacked `<h3>`+`<ul>` sections into a two-tier reading
 * hierarchy -- primary working guidance (what must remain fixed, next-
 * iteration priorities) read first, supporting guidance (allowed
 * variation, risks/escalation) read after a subtle divider -- never an
 * equal-column grid (that reads as a dashboard, not advisory prose)
 * and never four separate cards. `AuthorityLabel`-marked "AI
 * interpretation", advisory and secondary to the Human task context
 * above it (Current focus / Working Direction), never a report. No
 * guidance field is added or removed; `why_it_matters`/`priority` per
 * item stay owned by Current Version's own structured finding rows,
 * not duplicated here. Every real guidance string (executive summary,
 * every category's items) passes through the same `stripGeneratorLabel`
 * helper `AnchorContextLayer`/Current Version already use, so an
 * internal generator prefix never reaches the page -- the real
 * semantic text is never otherwise altered. The former raw `<dl>`
 * inside `DetailedContext` (a settings-table feel for what is really
 * three prose facts) is replaced with plain label/value rows in the
 * same restrained grammar `MetadataRow` uses elsewhere -- still
 * collapsed by default, still never duplicating the persistent
 * `AnchorContextLayer` above this page. */
export function TaskOverviewPage({
  taskId,
  data,
  anchorContext,
}: {
  taskId: string;
  data: TaskOverviewData | null;
  anchorContext?: AnchorContextRead | null;
}) {
  const showPageSpecificFocus =
    !anchorContext ||
    (data !== null &&
      data.item.current_focus.focus_type !== "none" &&
      data.item.current_focus.title !== anchorContext.next_action.title);

  const guidancePrerequisites: string[] = [];
  if (!data?.item.latest_version_id) {
    guidancePrerequisites.push("A Production Version is required.");
  }
  if (!anchorContext) {
    guidancePrerequisites.push(
      "Anchor prerequisites could not be verified; refresh the Task context.",
    );
  } else {
    if (anchorContext.core_anchor.lifecycle_state !== "confirmed") {
      guidancePrerequisites.push(
        "The VFX Supervisor must confirm the Core Anchor first.",
      );
    }
    if (anchorContext.execution_anchor?.lifecycle_state !== "confirmed") {
      guidancePrerequisites.push(
        "The CG Supervisor must confirm the Execution Anchor.",
      );
    }
  }

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
      {showPageSpecificFocus && (
        <TaskCurrentFocusPanel focus={data.item.current_focus} />
      )}

      {!anchorContext && (
        <WorkingDirectionSection section={data.workingDirection} />
      )}

      <SectionHeader
        title="What to do now: Artist Guidance"
        description="Advisory guidance from the Artist Agent -- never a substitute for either Anchor."
        actions={
          <GenerateArtistGuidanceButton
            taskId={taskId}
            versionId={data.item.latest_version_id}
            label={
              data.latestGuidance ? "Regenerate guidance" : "Generate guidance"
            }
            disabledReasons={guidancePrerequisites}
          />
        }
      />
      <Panel tone="elevated">
        <div className={styles.guidanceMeta}>
          <AuthorityLabel variant="ai-interpretation" />
          <StatusBadge
            status={
              data.item.guidance_state === "outdated" ? "attention" : "neutral"
            }
            label={guidanceStateLabel(data.item.guidance_state)}
          />
        </div>
        {data.latestGuidance ? (
          <>
            <p className={styles.guidanceSummary}>
              {stripGeneratorLabel(
                data.latestGuidance.guidance_output.executive_summary,
              )}
            </p>
            {data.item.guidance_state === "outdated" && (
              <p className={styles.guidanceOutdatedNotice}>
                This guidance references an earlier confirmed Execution Anchor
                revision. Regenerate it to reflect the current one.
              </p>
            )}
            <div className={styles.guidanceBody}>
              <div className={styles.guidanceTier}>
                <GuidanceGroup
                  heading="What must remain fixed"
                  items={data.latestGuidance.guidance_output.non_negotiables}
                  emptyText="No non-negotiable constraints were identified."
                />
                <GuidanceGroup
                  heading="Priorities for the next iteration"
                  items={
                    data.latestGuidance.guidance_output.iteration_priorities
                  }
                  emptyText="No iteration priorities were identified."
                />
              </div>
              <div className={styles.guidanceTier}>
                <p className={styles.guidanceTierLabel}>Supporting guidance</p>
                <GuidanceGroup
                  heading="What variation remains allowed"
                  items={data.latestGuidance.guidance_output.allowed_variations}
                  emptyText="No allowed variation was identified."
                />
                <GuidanceRisksGroup
                  dependencies={
                    data.latestGuidance.guidance_output
                      .cross_department_dependencies
                  }
                  questions={
                    data.latestGuidance.guidance_output
                      .questions_for_human_supervisor
                  }
                />
              </div>
            </div>
          </>
        ) : (
          <p className={styles.guidanceEmpty}>
            No Artist guidance has been generated for this Task yet.
          </p>
        )}
      </Panel>

      <Divider />

      <DetailedContext>
        <div className={styles.contextRows}>
          <div className={styles.contextRow}>
            <span className={styles.contextLabel}>
              Latest Production Version
            </span>
            <span className={styles.contextValue}>
              {data.item.latest_version_name ? (
                <Link href={`/artist/tasks/${taskId}/current-version`}>
                  {versionDisplayText(data.item)}
                </Link>
              ) : (
                "No Version recorded yet."
              )}
            </span>
          </div>

          <div className={styles.contextRow}>
            <span className={styles.contextLabel}>Latest feedback</span>
            <span className={styles.contextValue}>
              <Link href={`/artist/tasks/${taskId}/feedback-history`}>
                {data.item.open_review_note_count > 0
                  ? `${data.item.open_review_note_count} Review Note(s) recorded →`
                  : "View Feedback History →"}
              </Link>
            </span>
          </div>

          <div className={styles.contextRow}>
            <span className={styles.contextLabel}>Blockers</span>
            <span className={styles.contextValue}>
              {data.dependencies.length === 0
                ? "No dependencies have been recorded for this Task yet."
                : `${data.item.open_dependency_count} open of ${data.dependencies.length} recorded.`}
            </span>
          </div>
        </div>
      </DetailedContext>
    </>
  );
}
