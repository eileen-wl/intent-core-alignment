import Link from "next/link";

import {
  AppShell,
  AuthorityLabel,
  Breadcrumbs,
  ContextTabs,
  Divider,
  ErrorState,
  MetadataRow,
  Panel,
  SectionHeader,
  StatusBadge,
  WorkingDirectionSection,
} from "@/design";
import { DEMO_IDENTITY_NAME, ROLE_LABEL } from "@/lib/demoIdentity";
import { ROLE_SIDEBAR_ITEMS } from "@/lib/roleNavigation";
import type { TaskOverviewData } from "@/features/artist/task-overview/data";
import { guidanceStateLabel, versionDisplayText } from "../../artistWording";
import { GenerateArtistGuidanceButton } from "./GenerateArtistGuidanceButton";
import { TaskContextHeader } from "./TaskContextHeader";
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
  unavailable,
  onExitRole,
}: {
  taskId: string;
  data: TaskOverviewData | null;
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
              { label: "Task" },
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
              { label: "Task Overview" },
            ]}
          />
          <TaskContextHeader item={data.item} />
          <ContextTabs
            activeTabId="overview"
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

          <TaskCurrentFocusPanel focus={data.item.current_focus} />

          <WorkingDirectionSection section={data.workingDirection} />

          <Divider />

          <SectionHeader
            title="Why: Creative Intent"
            description="The confirmed Core Anchor for this Shot -- what this work is for."
          />
          <Panel>
            <AuthorityLabel
              variant="read-only"
              detail="Confirmed by the VFX Supervisor"
            />
            {data.coreAnchorRevision ? (
              <MetadataRow
                items={[
                  {
                    label: "Shot objective",
                    value:
                      data.coreAnchorRevision.shot_objective ?? "Not recorded",
                  },
                  {
                    label: "Emotional tone",
                    value:
                      data.coreAnchorRevision.emotional_tone ?? "Not recorded",
                  },
                  {
                    label: "Narrative priority",
                    value:
                      data.coreAnchorRevision.narrative_priority ??
                      "Not recorded",
                  },
                  {
                    label: "Core summary",
                    value:
                      data.coreAnchorRevision.core_summary ?? "Not recorded",
                  },
                ]}
              />
            ) : (
              <p>No Core Anchor is confirmed for this Shot yet.</p>
            )}
          </Panel>

          <SectionHeader
            title="How: Execution Approach"
            description="The confirmed Execution Anchor for this Task -- how this work should be carried out."
          />
          <Panel>
            <AuthorityLabel
              variant="read-only"
              detail="Confirmed by the CG Supervisor"
            />
            {data.executionAnchorRevision ? (
              <MetadataRow
                items={[
                  {
                    label: "Technical boundaries",
                    value:
                      data.executionAnchorRevision.technical_boundaries ??
                      "Not recorded",
                  },
                  {
                    label: "Allowed refinements",
                    value:
                      data.executionAnchorRevision.allowed_refinements ??
                      "Not recorded",
                  },
                  {
                    label: "Escalation conditions",
                    value:
                      data.executionAnchorRevision.escalation_conditions ??
                      "Not recorded",
                  },
                ]}
              />
            ) : (
              <p>No Execution Anchor is confirmed for this Task yet.</p>
            )}
          </Panel>

          <SectionHeader
            title="What to do now: Artist Guidance"
            description="Advisory guidance from the Artist Agent -- never a substitute for either Anchor."
            actions={
              data.item.latest_version_id && (
                <GenerateArtistGuidanceButton
                  taskId={taskId}
                  versionId={data.item.latest_version_id}
                  label={
                    data.latestGuidance
                      ? "Regenerate guidance"
                      : "Generate guidance"
                  }
                />
              )
            }
          />
          <Panel tone="elevated">
            <StatusBadge
              status={
                data.item.guidance_state === "outdated"
                  ? "attention"
                  : "neutral"
              }
              label={guidanceStateLabel(data.item.guidance_state)}
            />
            {data.latestGuidance ? (
              <div>
                <p>{data.latestGuidance.guidance_output.executive_summary}</p>
                {data.item.guidance_state === "outdated" && (
                  <p>
                    This guidance references an earlier confirmed Execution
                    Anchor revision. Regenerate it to reflect the current one.
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
                {data.latestGuidance.guidance_output.allowed_variations
                  .length === 0 ? (
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
                {data.latestGuidance.guidance_output.iteration_priorities
                  .length === 0 ? (
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
                {data.latestGuidance.guidance_output
                  .cross_department_dependencies.length === 0 &&
                data.latestGuidance.guidance_output
                  .questions_for_human_supervisor.length === 0 ? (
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
        </>
      )}
    </AppShell>
  );
}
