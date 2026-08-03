import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { loadDependenciesWorkspaceData } from "@/features/cg/dependencies-workspace/data";
import { fetchCgAnchorContextOrNull } from "@/features/cg/api";
import { actorHeaders, resolveIdentity } from "@/features/session/identity";
import { DEMO_ROLE_COOKIE } from "@/lib/demoIdentity";
import { exitRoleView } from "../../../../demo/actions";
import { DependenciesPage } from "./DependenciesPage";

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
    const identity = await resolveIdentity();
    if (identity === null) redirect("/demo");
    const [data, anchorContext] = await Promise.all([
      loadDependenciesWorkspaceData(taskId),
      fetchCgAnchorContextOrNull(taskId, actorHeaders(identity)),
    ]);
    return (
      <DependenciesPage
        taskId={taskId}
        data={data}
        anchorContext={anchorContext}
        unavailable={false}
        onExitRole={exitRoleView}
      />
    );
  } catch {
    return (
      <DependenciesPage
        taskId={taskId}
        data={null}
        anchorContext={null}
        unavailable
        onExitRole={exitRoleView}
      />
    );
  }
}
