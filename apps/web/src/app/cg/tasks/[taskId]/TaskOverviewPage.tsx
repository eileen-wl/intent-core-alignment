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
import type { TaskOverviewData } from "@/features/cg/task-overview/data";
import { versionDisplayText } from "../../cgWording";
import { TaskCurrentFocusPanel } from "./TaskCurrentFocusPanel";

/** `/cg/tasks/:taskId` -- the real Task Overview (Step 7C-4), mirroring
 * `app/vfx/shots/[shotId]/ShotOverviewPage.tsx`'s locked order:
 * production-context header -> contextual tabs -> exactly one Current
 * focus -> Core Anchor read-only context -> Execution Anchor summary /
 * latest Production Version -> Dependencies summary / recent activity.
 * Core Anchor is read-only here: the CG Supervisor cannot edit or
 * confirm it from this page, and this page never links into the
 * role-scoped VFX Intent route (the CG Demo session has no permission
 * to view it -- an honest, read-only inline summary is shown instead of
 * a link that would just bounce back to /demo). */
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
        title="Execution operations"
        description="Department production context remains available below the shared Anchor Context."
      />
      <Panel tone="elevated">
        <StatusBadge
          status={
            data.confirmedExecutionAnchorRevision ? "confirmed" : "attention"
          }
          label={
            data.confirmedExecutionAnchorRevision
              ? "Execution Anchor confirmed"
              : "Execution Anchor not confirmed"
          }
        />
        <dl>
          <dt>Production-ready criteria</dt>
          <dd>
            {data.confirmedExecutionAnchorRevision?.production_ready_criteria ??
              "No confirmed Execution Anchor production-ready criteria are recorded yet."}
          </dd>
          <dt>Technical boundaries</dt>
          <dd>
            {data.confirmedExecutionAnchorRevision?.technical_boundaries ??
              "Execution translation is not available until the CG Supervisor confirms an Execution Anchor."}
          </dd>
          <dt>Escalation conditions</dt>
          <dd>
            {data.confirmedExecutionAnchorRevision?.escalation_conditions ??
              "No escalation conditions are recorded."}
          </dd>
        </dl>
        {!data.confirmedExecutionAnchorRevision && (
          <Link href={`/cg/tasks/${taskId}/execution`}>
            Establish the Execution Anchor →
          </Link>
        )}
      </Panel>

      <Divider />

      <DetailedContext>
        <dl>
          <dt>Latest Production Version</dt>
          <dd>
            {data.item.latest_version_name ? (
              <Link href={`/cg/tasks/${taskId}/version-review`}>
                {versionDisplayText(data.item)}
              </Link>
            ) : (
              "No Version recorded yet."
            )}
          </dd>

          <dt>Dependencies</dt>
          <dd>
            <Link href={`/cg/tasks/${taskId}/dependencies`}>
              {data.dependencies.length === 0
                ? "No dependencies have been recorded for this Task yet."
                : `${data.item.open_dependency_count} open of ${data.dependencies.length} recorded →`}
            </Link>
          </dd>

          <dt>Activity</dt>
          <dd>
            {data.recentActivity.length === 0 ? (
              "No recorded activity exists for this Task yet."
            ) : (
              <ul>
                {data.recentActivity.map((event) => (
                  <li key={event.id}>{event.summary}</li>
                ))}
              </ul>
            )}
            <Link href={`/cg/tasks/${taskId}/activity`}>
              View full activity →
            </Link>
          </dd>
        </dl>
      </DetailedContext>
    </>
  );
}
