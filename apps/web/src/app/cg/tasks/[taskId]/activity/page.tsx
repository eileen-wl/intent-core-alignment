import { redirect } from "next/navigation";

import { loadTaskActivityWorkspaceData } from "@/features/cg/activity-workspace/data";
import { resolveIdentity } from "@/features/session/identity";
import { TaskActivityPage } from "./TaskActivityPage";

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
    const data = await loadTaskActivityWorkspaceData(taskId);
    return <TaskActivityPage data={data} />;
  } catch {
    return <TaskActivityPage data={null} />;
  }
}
