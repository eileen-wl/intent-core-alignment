import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { loadTaskOverviewData } from "@/features/cg/task-overview/data";
import { fetchCgAnchorContextOrNull } from "@/features/cg/api";
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
  if (store.get(DEMO_ROLE_COOKIE)?.value !== "cg_supervisor") {
    redirect("/demo");
  }

  try {
    // Step 9B-1 correction: the Execution Anchor Decision read is now
    // role-gated server-side (docs/ROLE_PERMISSIONS.md §2) -- the real,
    // trusted session identity (already confirmed cg_supervisor above)
    // is resolved and forwarded, never a client-supplied value.
    const identity = await resolveIdentity();
    if (identity === null) {
      redirect("/demo");
    }
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
