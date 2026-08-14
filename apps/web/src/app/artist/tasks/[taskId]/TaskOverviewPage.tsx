import Link from "next/link";
import type { AnchorContextRead } from "@intent-core/contracts";

import {
  DetailedContext,
  Divider,
  ErrorState,
  Panel,
  SectionHeader,
  StatusBadge,
  WorkingDirectionSection,
} from "@/design";
import type { TaskOverviewData } from "@/features/artist/task-overview/data";
import { guidanceStateLabel, versionDisplayText } from "../../artistWording";
import { GenerateArtistGuidanceButton } from "./GenerateArtistGuidanceButton";
import { TaskCurrentFocusPanel } from "./TaskCurrentFocusPanel";

/** `/artist/tasks/:taskId` -- the real Task Overview (Step 7C-5),
 * mirroring `app/cg/tasks/[taskId]/TaskOverviewPage.tsx`'s locked order:
 * production-context header -> contextual tabs -> exactly one Current
 * focus -> WHY (Core Anchor, read-only) -> HOW (Execution Anchor,
 * read-only) -> WHAT TO DO NOW (Artist guidance) -> blockers / latest
 * Version / latest feedback. Both Anchors are read-only here -- the
 * Artist can never edit or confirm either from this workspace, and no
 * edit/confirm control is reachable from this page. */
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
        <StatusBadge
          status={
            data.item.guidance_state === "outdated" ? "attention" : "neutral"
          }
          label={guidanceStateLabel(data.item.guidance_state)}
        />
        {data.latestGuidance ? (
          <div>
            <p>{data.latestGuidance.guidance_output.executive_summary}</p>
            {data.item.guidance_state === "outdated" && (
              <p>
                This guidance references an earlier confirmed Execution Anchor
                revision. Regenerate it to reflect the current one.
              </p>
            )}
            <h3>What must remain fixed</h3>
            {data.latestGuidance.guidance_output.non_negotiables.length ===
            0 ? (
              <p>No non-negotiable constraints were identified.</p>
            ) : (
              <ul>
                {data.latestGuidance.guidance_output.non_negotiables.map(
                  (it, index) => (
                    <li key={index}>{it.summary}</li>
                  ),
                )}
              </ul>
            )}
            <h3>What variation remains allowed</h3>
            {data.latestGuidance.guidance_output.allowed_variations.length ===
            0 ? (
              <p>No allowed variation was identified.</p>
            ) : (
              <ul>
                {data.latestGuidance.guidance_output.allowed_variations.map(
                  (it, index) => (
                    <li key={index}>{it.summary}</li>
                  ),
                )}
              </ul>
            )}
            <h3>Priorities for the next iteration</h3>
            {data.latestGuidance.guidance_output.iteration_priorities.length ===
            0 ? (
              <p>No iteration priorities were identified.</p>
            ) : (
              <ul>
                {data.latestGuidance.guidance_output.iteration_priorities.map(
                  (it, index) => (
                    <li key={index}>{it.summary}</li>
                  ),
                )}
              </ul>
            )}
            <h3>Risks and when to escalate</h3>
            {data.latestGuidance.guidance_output.cross_department_dependencies
              .length === 0 &&
            data.latestGuidance.guidance_output.questions_for_human_supervisor
              .length === 0 ? (
              <p>No risks or escalation conditions were identified.</p>
            ) : (
              <ul>
                {data.latestGuidance.guidance_output.cross_department_dependencies.map(
                  (it, index) => (
                    <li key={`dep-${index}`}>{it.summary}</li>
                  ),
                )}
                {data.latestGuidance.guidance_output.questions_for_human_supervisor.map(
                  (q, index) => (
                    <li key={`q-${index}`}>{q}</li>
                  ),
                )}
              </ul>
            )}
          </div>
        ) : (
          <p>No Artist guidance has been generated for this Task yet.</p>
        )}
      </Panel>

      <Divider />

      <DetailedContext>
        <dl>
          <dt>Latest Production Version</dt>
          <dd>
            {data.item.latest_version_name ? (
              <Link href={`/artist/tasks/${taskId}/current-version`}>
                {versionDisplayText(data.item)}
              </Link>
            ) : (
              "No Version recorded yet."
            )}
          </dd>

          <dt>Latest feedback</dt>
          <dd>
            <Link href={`/artist/tasks/${taskId}/feedback-history`}>
              {data.item.open_review_note_count > 0
                ? `${data.item.open_review_note_count} Review Note(s) recorded →`
                : "View Feedback History →"}
            </Link>
          </dd>

          <dt>Blockers</dt>
          <dd>
            {data.dependencies.length === 0
              ? "No dependencies have been recorded for this Task yet."
              : `${data.item.open_dependency_count} open of ${data.dependencies.length} recorded.`}
          </dd>
        </dl>
      </DetailedContext>
    </>
  );
}
