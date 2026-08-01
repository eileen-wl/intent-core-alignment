import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { loadVersionReviewWorkspaceData } from "@/features/cg/version-review-workspace/data";
import { DEMO_ROLE_COOKIE } from "@/lib/demoIdentity";
import { exitRoleView } from "../../../../demo/actions";
import { VersionReviewPage } from "./VersionReviewPage";

export default async function Page({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const store = await cookies();
  if (store.get(DEMO_ROLE_COOKIE)?.value !== "cg_supervisor") {
    redirect("/demo");
  }

  try {
    const data = await loadVersionReviewWorkspaceData(taskId);
    return (
      <VersionReviewPage taskId={taskId} data={data} unavailable={false} onExitRole={exitRoleView} />
    );
  } catch {
    return (
      <VersionReviewPage taskId={taskId} data={null} unavailable onExitRole={exitRoleView} />
    );
  }
}
