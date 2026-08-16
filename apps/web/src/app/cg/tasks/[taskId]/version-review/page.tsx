import { redirect } from "next/navigation";

import { loadVersionReviewWorkspaceData } from "@/features/cg/version-review-workspace/data";
import { resolveIdentity } from "@/features/session/identity";
import { VersionReviewPage } from "./VersionReviewPage";

/** The role gate itself already ran in `app/cg/layout.tsx`; this
 * repeats the same defensive, unreachable-in-practice check. */
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
    const data = await loadVersionReviewWorkspaceData(taskId);
    return <VersionReviewPage taskId={taskId} data={data} />;
  } catch {
    return <VersionReviewPage taskId={taskId} data={null} />;
  }
}
