import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { loadTaskOverviewData } from "@/features/artist/task-overview/data";
import { fetchArtistAnchorContextOrNull } from "@/features/artist/api";
import { actorHeaders, resolveIdentity } from "@/features/session/identity";
import { DEMO_ROLE_COOKIE } from "@/lib/demoIdentity";
import { exitRoleView } from "../../../demo/actions";
import { TaskOverviewPage } from "./TaskOverviewPage";

export default async function Page({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const store = await cookies();
  if (store.get(DEMO_ROLE_COOKIE)?.value !== "artist") {
    redirect("/demo");
  }

  try {
    const identity = await resolveIdentity();
    if (identity === null) redirect("/demo");
    const [data, anchorContext] = await Promise.all([
      loadTaskOverviewData(taskId),
      fetchArtistAnchorContextOrNull(taskId, actorHeaders(identity)),
    ]);
    return (
      <TaskOverviewPage
        taskId={taskId}
        data={data}
        anchorContext={anchorContext}
        unavailable={false}
        onExitRole={exitRoleView}
      />
    );
  } catch {
    return (
      <TaskOverviewPage
        taskId={taskId}
        data={null}
        anchorContext={null}
        unavailable
        onExitRole={exitRoleView}
      />
    );
  }
}
