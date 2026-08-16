import { redirect } from "next/navigation";

import { loadExecutionWorkspaceData } from "@/features/cg/execution-workspace/data";
import { fetchCgAnchorContextOrNull } from "@/features/cg/api";
import { actorHeaders, resolveIdentity } from "@/features/session/identity";
import { ExecutionPage } from "./ExecutionPage";

/** The role gate itself already ran in `app/cg/layout.tsx`; this
 * repeats the same defensive, unreachable-in-practice check. Step
 * 9B-2's Execution Anchor Decision read is role-gated server-side
 * (docs/ROLE_PERMISSIONS.md §2). `anchorContext` is fetched again here
 * even though the Task layout already fetches it once for the
 * persistent chrome: `ExecutionPage`'s own body reads
 * `anchorContext.execution_anchor`/`core_anchor` to determine the
 * Execution Anchor Editor's outdated/revision-number state -- Next.js
 * has no mechanism for a layout to pass fetched data down into a
 * page's props. */
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
      loadExecutionWorkspaceData(taskId, headers),
      fetchCgAnchorContextOrNull(taskId, headers),
    ]);
    return (
      <ExecutionPage
        taskId={taskId}
        data={data}
        anchorContext={anchorContext}
      />
    );
  } catch {
    return <ExecutionPage taskId={taskId} data={null} anchorContext={null} />;
  }
}
