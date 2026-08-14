import { redirect } from "next/navigation";

import { loadTaskOverviewData } from "@/features/artist/task-overview/data";
import { fetchArtistAnchorContextOrNull } from "@/features/artist/api";
import { actorHeaders, resolveIdentity } from "@/features/session/identity";
import { TaskOverviewPage } from "./TaskOverviewPage";

/** The role gate itself already ran in `app/artist/layout.tsx`; this
 * repeats the same defensive, unreachable-in-practice check.
 * `anchorContext` is fetched again here even though the Task layout
 * already fetches it once for the persistent chrome:
 * `TaskOverviewPage`'s own body reads `anchorContext.next_action`/
 * `core_anchor`/`execution_anchor` to decide the Current-focus panel
 * and guidance prerequisites -- Next.js has no mechanism for a layout
 * to pass fetched data down into a page's props. */
export default async function Page({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const identity = await resolveIdentity();
  if (identity?.role !== "artist") {
    redirect("/demo");
  }

  try {
    const [data, anchorContext] = await Promise.all([
      loadTaskOverviewData(taskId),
      fetchArtistAnchorContextOrNull(taskId, actorHeaders(identity)),
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
