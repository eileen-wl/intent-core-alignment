import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { loadExecutionWorkspaceData } from "@/features/cg/execution-workspace/data";
import { fetchCgAnchorContextOrNull } from "@/features/cg/api";
import { actorHeaders, resolveIdentity } from "@/features/session/identity";
import { DEMO_ROLE_COOKIE } from "@/lib/demoIdentity";
import { exitRoleView } from "../../../../demo/actions";
import { ExecutionPage } from "./ExecutionPage";

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
    // Step 9B-2: the Execution Anchor Decision read is role-gated
    // server-side (Step 9B-1, docs/ROLE_PERMISSIONS.md §2) -- the real,
    // trusted session identity (already confirmed cg_supervisor above)
    // is resolved and forwarded, never a client-supplied value.
    const identity = await resolveIdentity();
    if (identity === null) {
      redirect("/demo");
    }
    const headers = actorHeaders(identity);
    const [data, anchorContext] = await Promise.all([
      loadExecutionWorkspaceData(taskId, headers),
      fetchCgAnchorContextOrNull(taskId, headers),
    ]);
    return (
      <ExecutionPage
        taskId={taskId}
        data={data}
        anchorContext={anchorContext}
        unavailable={false}
        onExitRole={exitRoleView}
      />
    );
  } catch {
    return (
      <ExecutionPage
        taskId={taskId}
        data={null}
        anchorContext={null}
        unavailable
        onExitRole={exitRoleView}
      />
    );
  }
}
