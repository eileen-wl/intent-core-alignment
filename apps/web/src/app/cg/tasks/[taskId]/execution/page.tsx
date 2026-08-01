import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { loadExecutionWorkspaceData } from "@/features/cg/execution-workspace/data";
import { DEMO_ROLE_COOKIE } from "@/lib/demoIdentity";
import { exitRoleView } from "../../../../demo/actions";
import { ExecutionPage } from "./ExecutionPage";

export default async function Page({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const store = await cookies();
  if (store.get(DEMO_ROLE_COOKIE)?.value !== "cg_supervisor") {
    redirect("/demo");
  }

  try {
    const data = await loadExecutionWorkspaceData(taskId);
    return <ExecutionPage taskId={taskId} data={data} unavailable={false} onExitRole={exitRoleView} />;
  } catch {
    return <ExecutionPage taskId={taskId} data={null} unavailable onExitRole={exitRoleView} />;
  }
}
