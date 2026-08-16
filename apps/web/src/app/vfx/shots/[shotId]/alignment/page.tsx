import { redirect } from "next/navigation";

import {
  loadAlignmentWorkspaceData,
  type AlignmentWorkspaceData,
} from "@/features/vfx/alignment-workspace/data";
import { actorHeaders, resolveIdentity } from "@/features/session/identity";
import { AlignmentWorkspacePage } from "./AlignmentWorkspacePage";

/** `/vfx/shots/:shotId/alignment` (Step 7C-3) -- whether the reviewed
 * production work aligns with the active Core Anchor. The role gate
 * itself already ran in `app/vfx/layout.tsx`; this repeats the same
 * defensive, unreachable-in-practice check purely so `identity` narrows
 * to non-null for `actorHeaders` (`fetchDepartmentExecutionOverview` is
 * role-gated server-side). */
export default async function Page({
  params,
}: {
  params: Promise<{ shotId: string }>;
}) {
  const { shotId } = await params;
  const identity = await resolveIdentity();
  if (identity?.role !== "vfx_supervisor") {
    redirect("/demo");
  }

  let data: AlignmentWorkspaceData | null = null;
  try {
    data = await loadAlignmentWorkspaceData(shotId, actorHeaders(identity));
  } catch {
    data = null;
  }

  return <AlignmentWorkspacePage shotId={shotId} data={data} />;
}
