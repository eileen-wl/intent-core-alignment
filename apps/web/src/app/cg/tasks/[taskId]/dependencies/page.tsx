import { redirect } from "next/navigation";

import { loadDependenciesWorkspaceData } from "@/features/cg/dependencies-workspace/data";
import { resolveIdentity } from "@/features/session/identity";
import { DependenciesPage } from "./DependenciesPage";

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
    const data = await loadDependenciesWorkspaceData(taskId);
    return <DependenciesPage taskId={taskId} data={data} />;
  } catch {
    return <DependenciesPage taskId={taskId} data={null} />;
  }
}
