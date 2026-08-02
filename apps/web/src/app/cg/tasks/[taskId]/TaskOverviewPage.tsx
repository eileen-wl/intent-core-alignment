import Link from "next/link";

import {
  AppShell,
  Breadcrumbs,
  ContextTabs,
  DetailedContext,
  Divider,
  ErrorState,
  WorkingDirectionSection,
} from "@/design";
import { DEMO_IDENTITY_NAME, ROLE_LABEL } from "@/lib/demoIdentity";
import { ROLE_SIDEBAR_ITEMS } from "@/lib/roleNavigation";
import type { TaskOverviewData } from "@/features/cg/task-overview/data";
import { versionDisplayText } from "../../cgWording";
import { TaskContextHeader } from "./TaskContextHeader";
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
      name={DEMO_IDENTITY_NAME.cg_supervisor}
      role={ROLE_LABEL.cg_supervisor}
      onExitRole={onExitRole}
      sidebarItems={ROLE_SIDEBAR_ITEMS.cg_supervisor}
      currentPath="/cg/tasks"
    >
      {unavailable || data === null ? (
        <>
          <Breadcrumbs
            items={[{ label: "Tasks", href: "/cg/tasks" }, { label: "Task" }]}
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
              { label: "Overview" },
            ]}
          />
          <TaskContextHeader item={data.item} />
          <ContextTabs
            activeTabId="overview"
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

          <TaskCurrentFocusPanel focus={data.item.current_focus} />

          <WorkingDirectionSection section={data.workingDirection} />

          <Divider />

          <DetailedContext>
            <dl>
              <dt>Confirmed Core Anchor (read-only)</dt>
              <dd>
                {data.coreAnchorSummary ??
                  "No Core Anchor is confirmed for this Shot yet."}
              </dd>

              <dt>Execution Anchor</dt>
              <dd>
                <Link href={`/cg/tasks/${taskId}/execution`}>
                  {data.item.active_execution_anchor_summary ??
                    "No Execution Anchor is confirmed for this Task yet."}
                </Link>
              </dd>

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
      )}
    </AppShell>
  );
}
