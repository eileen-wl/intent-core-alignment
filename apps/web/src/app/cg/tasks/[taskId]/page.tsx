import { redirect } from "next/navigation";

import { loadTaskOverviewData } from "@/features/cg/task-overview/data";
import { fetchCgAnchorContextOrNull } from "@/features/cg/api";
import { actorHeaders, resolveIdentity } from "@/features/session/identity";
import { TaskOverviewPage } from "./TaskOverviewPage";

/** The role gate itself already ran in `app/cg/layout.tsx`; this
 * repeats the same defensive, unreachable-in-practice check. Step
 * 9B-1's Execution Anchor Decision read is role-gated server-side
 * (docs/ROLE_PERMISSIONS.md §2). `anchorContext` is fetched again here
 * even though `app/cg/tasks/[taskId]/layout.tsx` already fetches it
 * once for the persistent chrome: `TaskOverviewPage`'s own body reads
 * `anchorContext.next_action` to decide whether to also show a
 * page-specific Current-focus panel -- Next.js has no mechanism for a
 * layout to pass fetched data down into a page's props. */
export default async function Page({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const identity = await resolveIdentity();
  if (identity?.role !== "cg_supervisor") {
    redirect("/demo");
  }

  try {
    const headers = actorHeaders(identity);
    const [data, anchorContext] = await Promise.all([
      loadTaskOverviewData(taskId, headers),
      fetchCgAnchorContextOrNull(taskId, headers),
    ]);
    return (
      <TaskOverviewPage
        taskId={taskId}
        data={data}
        anchorContext={anchorContext}
      />
    );
  } catch {
    return (
      <TaskOverviewPage taskId={taskId} data={null} anchorContext={null} />
    );
  }
}
